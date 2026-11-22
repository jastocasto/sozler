#!/usr/bin/env node
// Turn corpus token counts into a frequency rank for each headword.
//
//   python3 -I scripts/count_corpus_words.py counts.tsv wikipedia=… web=… subtitles=…
//   node --max-old-space-size=6144 scripts/build_frequency.cjs counts.tsv
//
// A token counts for the headword it spells (kitab), otherwise for the
// headword the search analyser finds (kitablarımızdan -> kitab, getdim ->
// getmək). Each corpus is scaled to occurrences per million words and the
// corpora are averaged, so encyclopedic, web and spoken language weigh the
// same. Counts below 3 in a corpus are ignored as noise. Writes
// scripts/content/frequency/headword-frequency.tsv; build_runtime.cjs reads it.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), readline = require('readline');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist');
const W = require(path.join(dist, 'model.js')), CE = require(path.join(dist, 'conjugation-engine.js')), EN = require(path.join(dist, 'conjugation-english.js')), M = require(path.join(dist, 'morphology.js'));
const MIN_COUNT = 3; // per corpus; rarer tokens are ignored there, and are matched only as exact headwords

(async () => {
  const countsFile = process.argv[2];
  if (!countsFile) { console.error('usage: build_frequency.cjs counts.tsv'); process.exit(2); }
  const sandbox = { window: {} };
  for (const f of ['conjugation-data', 'conjugation-english-data']) vm.runInNewContext(fs.readFileSync(path.join(dist, f + '.js'), 'utf8'), sandbox);
  const model = W.restoreModel(JSON.parse(fs.readFileSync(path.join(dist, 'soz-core.json'), 'utf8')));
  const D = CE.withDictionary(sandbox.window.WORD_CONJUGATIONS, model), E = CE.create(D);
  const analyser = M.create({ model, normalize: W.normalize, engine: E, verbs: D.verbs, english: EN, englishData: sandbox.window.CONJUGATION_ENGLISH_DATA });
  model.prepareSearch();
  const byLower = new Map();
  for (const n of model.nodes) if (!byLower.has(n.lower)) byLower.set(n.lower, n);
  const sums = new Map();
  let names = null, totals = null, tokens = 0, exact = 0, analysed = 0, unmatched = 0, started = Date.now();
  const lines = readline.createInterface({ input: fs.createReadStream(countsFile, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    const [token, ...cells] = line.split('\t');
    if (token === '#corpora') { names = cells; continue; }
    if (token === '#totals') { totals = cells.map(Number); continue; }
    const counts = cells.map(c => +c >= MIN_COUNT ? +c : 0);
    tokens++;
    if (!counts.some(Boolean)) continue;
    // A declined pronoun counts for the pronoun, not for a rare homograph (məni "me", not "sperm").
    let node = analyser.pronoun(token)?.node || byLower.get(token);
    if (node) exact++;
    else { node = analyser.analyze(token, 1)[0]; node = node && !node.loose ? node.node : null; if (node) analysed++; }
    if (!node) { unmatched++; continue; }
    const sum = sums.get(node.w) || new Array(counts.length).fill(0);
    counts.forEach((c, i) => sum[i] += c);
    sums.set(node.w, sum);
    if (tokens % 100000 === 0) console.error(tokens, 'tokens', ((Date.now() - started) / 1000).toFixed(0) + 's');
  }
  if (!totals) throw Error('counts file has no #totals line');
  const rows = [...sums].map(([word, counts]) => {
    const perMillion = counts.reduce((total, c, i) => total + c / totals[i], 0) / counts.length * 1e6;
    return { word, counts, perMillion };
  }).filter(r => r.perMillion > 0).sort((a, b) => b.perMillion - a.perMillion || a.word.localeCompare(b.word, 'az'));
  const out = path.join(root, 'scripts', 'content', 'frequency', 'headword-frequency.tsv');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, '# rank\theadword\tper_million\t' + names.join('\t') + '\n' + rows.map((r, i) => [i + 1, r.word, r.perMillion.toFixed(3), ...r.counts].join('\t')).join('\n') + '\n');
  const summary = { corpus_tokens: Object.fromEntries(names.map((n, i) => [n, totals[i]])), min_count_per_corpus: MIN_COUNT, token_types: tokens, matched_exact: exact, matched_by_analysis: analysed, unmatched, headwords_ranked: rows.length };
  fs.writeFileSync(path.join(path.dirname(out), 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
  fs.writeFileSync(path.join(dist, 'frequency-attribution.json'), JSON.stringify({
    sources: [
      { name: 'Azerbaijani Wikipedia, articles (latest dump)', url: 'https://dumps.wikimedia.org/azwiki/', license: 'CC BY-SA 4.0' },
      { name: 'OPUS CCAligned v1, Azerbaijani monolingual (web crawl)', url: 'https://opus.nlpl.eu/CCAligned/corpus/version/CCAligned', citation: 'El-Kishky et al. 2020, CCAligned; J. Tiedemann 2012, Parallel Data, Tools and Interfaces in OPUS' },
      { name: 'OPUS OpenSubtitles v2024, Azerbaijani monolingual', url: 'https://opus.nlpl.eu/OpenSubtitles/corpus/version/OpenSubtitles', citation: 'P. Lison and J. Tiedemann 2016, OpenSubtitles2016; http://www.opensubtitles.org/' }
    ],
    method: 'Lowercase Azerbaijani word tokens are counted in each corpus (Wikipedia markup removed). A token counts for the headword it spells, otherwise for the headword the site search analyser derives it from (inflected nouns and conjugated verbs). Counts below ' + MIN_COUNT + ' in a corpus are ignored. Each corpus is scaled to occurrences per million words and the corpora are averaged with equal weight. Headwords are ranked by that average.',
    levels: 'A1 rank 1–500, A2 501–1500, B1 1501–3500, B2 3501–7000, C1 7001–15000, C2 above 15000. An approximation from frequency, not an official CEFR word list.',
    published: 'Only ranks are published in the site data; per-corpus counts are in scripts/content/frequency/headword-frequency.tsv. No corpus text is stored.',
    limitations: 'Homographs share one count (gəlir "income" and gəlir "comes" are both counted for the exact headword gəlir). The analyser chooses one reading per token. The subtitle corpus is small. Wikipedia over-represents names and technical vocabulary.',
    summary
  }, null, 1) + '\n');
  console.log(JSON.stringify(summary));
  console.log('top 40:', rows.slice(0, 40).map(r => r.word).join(' '));
})();
