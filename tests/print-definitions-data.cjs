// Print-dictionary definition layer: only fills headwords that had no definition,
// cites every definition and link, and never weakens reviewed data or false-relation blocks.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict'), s = { window: {} };
for (const f of ['data', 'lexicon', 'grammar', 'vocabulary', 'review', 'bilingual', 'expansion', 'nominal', 'additions', 'relations',
  'references', 'growth', 'orthography-lexical', 'orthography-lexical-evidence', 'orthography', 'verification', 'print-definitions', 'galaxy-data'])
  vm.runInNewContext(fs.readFileSync('dist/' + f + '.js', 'utf8'), s);
const w = s.window, { createModel } = require('../dist/model.js');
const args = [w.WORD_WEB_DATA, w.WORD_WEB_EXTRA, w.WORD_WEB_GRAMMAR, w.WORD_WEB_VOCABULARY, w.WORD_WEB_REVIEW, w.WORD_WEB_BILINGUAL,
  w.WORD_WEB_EXPANSION, w.WORD_WEB_NOMINAL, w.WORD_WEB_ADDITIONS, w.WORD_WEB_RELATIONS, w.WORD_WEB_REFERENCES, w.WORD_WEB_GROWTH,
  w.WORD_WEB_VERIFICATION, w.WORD_WEB_ORTHOGRAPHY, w.WORD_WEB_ORTHOGRAPHY_LEXICAL];
const before = createModel(...args), m = createModel(...args, w.WORD_WEB_PRINT_DEFINITIONS), layer = w.WORD_WEB_PRINT_DEFINITIONS;
const attribution = JSON.parse(fs.readFileSync('dist/print-definitions-attribution.json', 'utf8'));
const METHODS = new Set(['paraphrase', 'derivation', 'cross-reference', 'rule', 'authored', 'meaning']);
const POS = new Set(['noun', 'verb', 'adjective', 'adverb', 'numeral', 'pronoun', 'interjection', 'postposition', 'conjunction', 'particle', 'phrase']);

// Same headwords, same identities and the same atlas: the layer adds text and links only.
assert.equal(m.nodes.length, before.nodes.length);
assert.equal(m.nodes.length, w.WORD_GALAXY_DATA.points.length + before.orthographyNodes.length);
for (const n of before.nodes) assert.equal(m.byWord.get(n.w).id, n.id, n.w + ' persistent identity');

// Existing definitions are untouched; new ones fill only empty spelling entries.
let filled = 0;
for (const n of before.nodes) {
  const after = m.byWord.get(n.w), had = n.az?.trim() && n.en?.trim();
  if (had) { assert.equal(after.az, n.az, n.w); assert.equal(after.en, n.en, n.w); assert(!after.definitionMethod, n.w + ' keeps its reviewed definition'); continue; }
  if (!layer.definitions[n.w]) continue;
  filled++;
  assert(n.orthographyPage, n.w + ' is a spelling entry');
  assert(after.az.trim() && after.en.trim() && !after.special, n.w + ' now defined');
  assert(METHODS.has(after.definitionMethod), n.w);
}
assert.equal(filled, Object.keys(layer.definitions).length, 'every layer definition is used');
assert.equal(filled, attribution.summary.definitions);
for (const [word, d] of Object.entries(layer.definitions)) {
  assert(METHODS.has(d.method), word);
  assert(POS.has(d.pos), word + ' ' + d.pos);
  assert(/^\S/.test(d.az) && /[.!?»]$/.test(d.az.trim()) || d.method === 'cross-reference', word + ' az sentence');
  assert(d.en.trim().length >= 2 && d.en.length <= 400, word + ' en gloss');
  // Undecoded legacy-font text shows up as Cyrillic or as runs of Latin-1 look-alike letters.
  assert(!/[\u0400-\u04ff]|[\u00c0-\u00ff]{3}/.test((d.az + d.en).replace(/[\u00e7\u00c7\u00f6\u00d6\u00fc\u00dc\u00e9]/g, '')), word + ' decoded text');
  assert(d.refs.length && d.refs.every(r => r.title && /^https:\/\//.test(r.url)), word + ' cited');
  if (d.method === 'paraphrase') assert(d.refs.some(r => /izahli_lugeti|Azerbaycanca_Ingilisce|Azerbaycan_dilinin_dialektoloji_lugeti/.test(r.url)), word + ' paraphrase cites print evidence');
  // AI-written definitions claim no print source: they cite only the orthography page for the spelling.
  if (d.method === 'authored') assert(d.refs.length === 1 && /Orfoqrafiya_2021/.test(d.refs[0].url), word + ' authored cites the spelling only');
  if (d.method === 'rule' || d.method === 'derivation') assert(m.byWord.has(d.base), word + ' names an existing base word');
  if (d.method === 'cross-reference') assert(m.byWord.has(d.see), word + ' names an existing target');
  // An AI-written meaning replaces a rule definition that only said how the word is built; that formation stays as a note.
  if (d.method === 'meaning') {
    assert(d.refs.some(r => /Orfoqrafiya_2021/.test(r.url)), word + ' meaning cites the spelling');
    if (d.formation) assert(/(?:sözlərindən düzələn (?:qoşa|mürəkkəb) söz|sözlərindən ibarət birləşmə|ön hissəsi artırılmaqla düzələn söz|şəkilçisi ilə düzələn (?:isim|sifət))\.$/.test(d.formation.az) && d.formation.en, word + ' formation note');
    assert(!/sözlərindən düzələn|ön hissəsi artırılmaqla|şəkilçisi ilə düzələn/.test(d.az), word + ' meaning is not a formation');
  }
}

// The public report and the exported review queue use the same runtime build.
const coverage = JSON.parse(require('node:child_process').execFileSync('python3', ['scripts/audit_definition_coverage.py'], { encoding: 'utf8' }));
assert.equal(coverage.headwords, m.nodes.length);
assert.equal(coverage.missing, m.nodes.filter(n => !(n.en?.trim() && n.az?.trim())).length);
assert.equal(coverage.missing, attribution.summary.undefined_after);
assert.equal(coverage.missing + coverage['formation-only'] + coverage['needs-review'] + coverage['other-bilingual'], m.nodes.length);
const report = fs.readFileSync('dist/verification-report.html', 'utf8');
for (const field of ['headwords', 'missing', 'formation-only', 'needs-review']) {
  const shown = report.match(new RegExp('data-coverage="' + field + '">([^<]+)<'));
  assert(shown, 'missing coverage report field ' + field);
  assert.equal(Number(shown[1].replace(/\s/g, '')), coverage[field], field);
}

// Links join existing headwords once, carry a cited reason, and respect every block list.
const edge = (a, b, t) => m.related(m.byWord.get(a)).find(r => r.node.w === b && r.edge.type === t)?.edge;
const pairKey = (a, b) => [a, b].sort().join('|');
const removed = new Set(layer.blocked.map(([a, b, kind]) => pairKey(a, b) + '|' + kind));
const known = new Set(before.edges.filter(e => !removed.has(pairKey(e.a.w, e.b.w) + '|' + e.type))
  .map(e => pairKey(e.a.w, e.b.w)));
let added = 0;
for (const [a, b, kind, , , proofs] of layer.edges) {
  assert(m.byWord.has(a) && m.byWord.has(b) && a !== b, a + ' ' + b);
  assert(['root', 'syn', 'topic', 'ant'].includes(kind));
  assert(!known.has([a, b].sort().join('|')), a + ' ' + b + ' was not already connected');
  assert(proofs.length && proofs.every(p => p.senseAz && p.senseEn && p.refs.length && p.refs.every(r => /^https:\/\//.test(r.url))));
  if (edge(a, b, kind)) added++;
}
assert(added >= layer.edges.length * 0.99, 'layer links reach the graph');
for (const layerName of ['WORD_WEB_REVIEW', 'WORD_WEB_RELATIONS', 'WORD_WEB_GROWTH', 'WORD_WEB_VERIFICATION'])
  for (const [a, b, t] of w[layerName]?.blocked || []) assert(!edge(a, b, t), a + ' ' + b + ' stays blocked');
for (const [a, b, t] of [['evsiz', 'siz', 'root'], ['vətəndaş', 'daş', 'root'], ['xilaskar', 'kar', 'root'], ['beşinci', 'inci', 'root'],
  ['dönüş', 'iş', 'root'], ['vətəndaş', 'daş', 'topic']])
  assert(!edge(a, b, t), a + ' ' + b + ' false relation');
assert(!edge('maniçilik', 'mani', 'root') && !edge('manilik', 'maniçi', 'root'));
assert(!edge('maniçilik', 'manilik', 'root') && edge('maniçilik', 'manilik', 'syn'));
// The PDF marks this contrast in the sense of permanence of settlement.
assert(edge('köçərilik', 'oturaqlıq', 'ant'));
assert(!edge('monitorinq', 'dualizm', 'ant'), 'the next printed headword starts inside the extracted monitoring entry');
// Suffix and compound rules never link lexicalised words to look-alike bases.
const layerPairs = new Set(layer.edges.map(e => [e[0], e[1]].sort().join('|')));
for (const [a, b] of [['qaraçı', 'qara'], ['alma', 'almaq'], ['dəli', 'də'], ['balıq', 'bal'], ['qardaş', 'qar'], ['ataş', 'ata'], ['bacarıq', 'bacar']])
  assert(!layerPairs.has([a, b].sort().join('|')), a + ' ' + b + ' look-alike base');

// Representative entries from each method.
const node = word => m.byWord.get(word);
// Reviewed spellings and idioms must reach the word sheet with the cited print pages.
const reviewRows = fs.readFileSync('scripts/content/print-definitions/dictionary-review.tsv', 'utf8').trimEnd().split('\n').slice(1);
assert.equal(attribution.summary.dictionary_reviews, reviewRows.length);
for (const row of reviewRows) {
  const [word, pos, az, en, pages] = row.split('\t');
  const entry = node(word);
  assert.equal(entry.az, az, word);
  assert.equal(entry.en, en, word);
  assert.equal(entry.pos, pos, word);
  assert.equal(entry.definitionMethod, 'paraphrase', word);
  assert.deepEqual(Array.from(entry.definitionSources, r => r.url.match(/_(\d)\.pdf#page=(\d+)$/).slice(1).join('.')), pages.split(','), word);
}
const contextualMeanings = Object.assign({}, ...[68, 69, 70, 71].map(batch =>
  JSON.parse(fs.readFileSync('scripts/content/print-definitions/meanings/batch-' + batch + '.json', 'utf8'))));
for (const [word, entry] of Object.entries(contextualMeanings)) {
  const n = node(word);
  assert.equal(n.az, entry.az, word);
  assert.equal(n.en, entry.en, word);
  assert.equal(n.definitionMethod, 'meaning', word);
  for (const ref of entry.references || []) assert(n.definitionSources.some(r => r.url === ref.url), word + ' context citation');
}
assert.match(node('it-bat düşmək').en, /go missing/);
assert.match(node('termoqraflı').en, /records temperature/);
assert.match(node('girələmə').en, /favourable opportunity/);
assert(!edge('termoqraf', 'qraf', 'topic') && !edge('repressor', 'rep', 'topic'));
// A phrase may appear on a later page than the start of its enclosing print entry.
assert(layer.definitions['başına qalmaq'].refs.some(r => r.url.endsWith('_1.pdf#page=236')));
assert.equal(node('it-bat düşmək').definitionMethod, 'paraphrase');
assert(edge('it-bat düşmək', 'itmək', 'syn'));
const meaningDir = 'scripts/content/print-definitions/meanings';
const supplementFiles = fs.readdirSync(meaningDir).filter(name => /^supplement-.*\.json$/.test(name)).sort();
assert.deepEqual(supplementFiles, Object.keys(attribution.supplements));
for (const file of supplementFiles) {
  const entries = JSON.parse(fs.readFileSync(meaningDir + '/' + file, 'utf8'));
  for (const [word, entry] of Object.entries(entries)) {
    const n = node(word);
    assert.equal(n.az, entry.az, word);
    assert.equal(n.en, entry.en, word);
    assert.equal(n.pos, entry.pos, word);
    assert.equal(n.definitionMethod, 'meaning', word);
    for (const ref of entry.references) assert(n.definitionSources.some(r => r.url === ref.url), word);
    for (const [kind, targets] of Object.entries(entry.links || {})) {
      for (const target of targets) {
        assert(edge(word, target, kind), `${word} → ${target} (${kind})`);
      }
    }
  }
}
assert.match(node('limonotu').definitionFormation.az, /limon/);
assert(edge('limonotu', 'arıotu', 'syn'));
assert(edge('oxcüllüt', 'cüllüt', 'topic'));
assert(!edge('oxcüllüt', 'cüllüt', 'syn'));
assert(edge('qaragözlük etmək', 'ağlamaq', 'topic'));
assert(!edge('qaragözlük etmək', 'ağlamaq', 'syn'));
assert(!node('düzquyruqlu').en.includes('Orthurus'), 'the name of a plant does not define a tail shape');
const regional = node('aşqara');
assert.equal(regional.definitionMethod, 'paraphrase');
assert.match(regional.az, /Oğuz/);
assert(regional.definitionSources.some(r => r.url.endsWith('dialektoloji_lugeti.pdf#page=27')));
assert(edge('aşqara', 'xuruş', 'syn'));
assert.match(node('amperlik').definitionFormation.az, /sifət\.$/);
assert.match(node('amperlik').definitionFormation.en, /^adjective formed from amper/);
assert.equal(node('mumiyalama').definitionMethod, 'derivation');
assert.match(node('mumiyalama').en, /embalm/);
assert(edge('mumiyalama', 'mumiyalamaq', 'root'));
assert.equal(node('elektrocərrahiyyə').en, 'electrosurgery');
assert(edge('damardaxili', 'damar', 'topic') && edge('damardaxili', 'daxili', 'topic'));
assert.equal(node('stulsuz').en, 'without chair');
// A paired word gets its meaning, with the formation kept apart (istək + arzulu); a wrong split is never made.
assert.equal(node('istək-arzulu').definitionMethod, 'meaning');
assert(!/düzələn/.test(node('istək-arzulu').az));
assert.match(node('istək-arzulu').definitionFormation.az, /«istək» və «arzulu»/);
assert(edge('istək-arzulu', 'arzulu', 'topic'));
assert.equal(node('transport').definitionMethod, 'meaning');
assert(!node('transport').definitionFormation);
assert(!edge('transport', 'port', 'topic') && !edge('transport', 'trans', 'topic'));
const degree = model => { const d = new Map(); for (const e of model.edges) { d.set(e.a.w, 1); d.set(e.b.w, 1); } return model.nodes.filter(n => !d.has(n.w)).length; };
const isolatedBefore = degree(before), isolatedAfter = degree(m);
assert(isolatedAfter < isolatedBefore, 'fewer isolated words');
assert.equal(attribution.summary.isolated_after, isolatedAfter);
console.log(`PASS ${filled} new cited definitions (${Object.entries(attribution.summary.definitions_by_method).map(([k, v]) => v + ' ' + k).join(', ')}), ${layer.edges.length} new links; isolated words ${isolatedBefore} → ${isolatedAfter}; reviewed text, identities and blocks preserved.`);
