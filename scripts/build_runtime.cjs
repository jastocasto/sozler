#!/usr/bin/env node
// Precompute the browser data model once, so visitors do not have to.
//
// Reads the data layers in dist/ (the same files the page used to load), runs
// createModel, and writes:
//   dist/soz-core.json      everything the map, search and meaning strip need
//   dist/details/N.json     link evidence, one file per hash shard of headwords
//   dist/forms-archive.json the full noun-form records (Forms section)
// It then rebuilds the model with restoreModel from those files and fails
// unless it matches createModel for every word, link, order and sample search.
//
//   node --max-old-space-size=8192 scripts/build_runtime.cjs
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), assert = require('node:assert/strict');
const dist = path.join(__dirname, '..', 'dist');
const { createModel, restoreModel, shardOf, normalize } = require(path.join(dist, 'model.js'));
const LAYERS = ['data', 'lexicon', 'grammar', 'vocabulary', 'review', 'bilingual', 'expansion', 'nominal', 'additions', 'relations',
  'references', 'growth', 'orthography-lexical', 'orthography-lexical-evidence', 'orthography', 'verification', 'print-definitions'];
const SHARDS = 1024;
const content = path.join(__dirname, 'content');
const readOptional = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
// Word origins and homonyms from English Wiktionary (scripts/build_etymology.py).
const etymology = readOptional(path.join(content, 'etymology', 'etymology.json'), {});
const etymologyLanguages = readOptional(path.join(content, 'etymology', 'languages.json'), {});
// Frequency rank per headword from public corpora (scripts/build_frequency.cjs).
const frequencyFile = path.join(content, 'frequency', 'headword-frequency.tsv'), frequencyRank = new Map();
if (fs.existsSync(frequencyFile)) for (const line of fs.readFileSync(frequencyFile, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [rank, word] = line.split('\t');
  frequencyRank.set(word, +rank);
}
const DERIVED = new Set(['lower', 'key', 'english', 'azerbaijani']);
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const empty = v => v === undefined || v === null || v === '';
const t0 = Date.now(), log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', ...a);

// ---- normalize() must equal the original locale-aware version on all text ----
const originalNormalize = s => String(s || '').toLocaleLowerCase('az').replace(/ı/g, 'i').replace(/ə/g, 'e').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

// ---- load and run createModel exactly as the page did ----
const sandbox = { window: {} };
for (const f of LAYERS) vm.runInNewContext(fs.readFileSync(path.join(dist, f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
const w = sandbox.window;
const m = createModel(w.WORD_WEB_DATA, w.WORD_WEB_EXTRA, w.WORD_WEB_GRAMMAR, w.WORD_WEB_VOCABULARY, w.WORD_WEB_REVIEW, w.WORD_WEB_BILINGUAL,
  w.WORD_WEB_EXPANSION, w.WORD_WEB_NOMINAL, w.WORD_WEB_ADDITIONS, w.WORD_WEB_RELATIONS, w.WORD_WEB_REFERENCES, w.WORD_WEB_GROWTH,
  w.WORD_WEB_VERIFICATION, w.WORD_WEB_ORTHOGRAPHY, w.WORD_WEB_ORTHOGRAPHY_LEXICAL, w.WORD_WEB_PRINT_DEFINITIONS);
log('createModel', m.nodes.length, 'nodes', m.edges.length, 'edges');

const nodes = m.nodes, count = nodes.length, index = new Map(nodes.map((n, i) => [n, i]));
{
  const texts = new Set();
  for (const n of m.allNodes.concat(nodes)) for (const t of [n.w, n.en, n.az, ...(n.bilingualSenses || []).flatMap(x => [x.az, x.en])]) texts.add(t);
  for (const r of m.grammarRecords.concat(m.nominalRecords)) for (const t of [r.w, r.base, r.lemma, r.az, r.en, ...(r.senses || [])]) texts.add(t);
  for (const t of texts) assert.equal(normalize(t), originalNormalize(t), 'normalize ' + t);
  log('normalize matches the locale-aware version on', texts.size, 'texts');
}
const orthographyStart = nodes.indexOf(m.orthographyNodes[0]);
assert(orthographyStart > 0 && nodes.slice(orthographyStart).every((n, i) => n === m.orthographyNodes[i]), 'spelling entries form the tail of the node list');

// ---- nodes: dense columns for common fields, sparse maps for rare ones ----
const fieldCounts = new Map();
for (let i = 0; i < count; i++) for (const [k, v] of Object.entries(nodes[i])) {
  if (DERIVED.has(k) || empty(v) || (k === 'verbEvidence' && i >= orthographyStart)) continue;
  fieldCounts.set(k, (fieldCounts.get(k) || 0) + 1);
}
const refs = [], refIndex = new Map();
const refId = r => { const k = JSON.stringify(r); if (!refIndex.has(k)) { refIndex.set(k, refs.length); refs.push(r); } return refIndex.get(k); };
const cols = {}, sparse = {};
for (const [field, present] of fieldCounts) {
  const value = i => { const v = nodes[i][field]; return empty(v) ? null : v; };
  if (present < count * 0.25) {
    const map = {};
    for (let i = 0; i < count; i++) { const v = value(i); if (v !== null) map[i] = v; }
    sparse[field] = map;
    continue;
  }
  const values = Array.from({ length: count }, (_, i) => value(i));
  if (field === 'definitionSources') { cols[field] = { refList: true, values: values.map(v => v && v.map(refId)) }; continue; }
  const distinct = new Set(values.filter(v => v !== null));
  if ([...distinct].every(v => typeof v === 'string') && distinct.size <= 512) {
    const dict = [...distinct], code = new Map(dict.map((v, i) => [v, i]));
    cols[field] = { dict, values: values.map(v => v === null ? null : code.get(v)) };
  } else cols[field] = { values };
}
// Search text is recomputed in the browser; store it only where the formula differs.
const searchText = (first, senses, side) => normalize([first, ...(senses || []).map(s => s[side])].join('; '));
const english = {}, azerbaijani = {};
for (let i = 0; i < count; i++) {
  const n = nodes[i];
  if (n.english !== searchText(n.en, n.bilingualSenses, 'en')) english[i] = n.english;
  if (n.azerbaijani !== searchText(n.az, n.bilingualSenses, 'az')) azerbaijani[i] = n.azerbaijani;
  assert.equal(n.lower, n.w.toLocaleLowerCase('az'), n.w + ' lower');
  assert.equal(n.key, normalize(n.w), n.w + ' key');
  if (i >= orthographyStart) assert.equal(n.verbEvidence, m.verbEvidence[n.w], n.w + ' verb evidence');
}
// Alphabetical rank; words the collator treats as equal share a rank.
const collator = new Intl.Collator('az'), order = nodes.map((n, i) => i).sort((a, b) => collator.compare(nodes[a].w, nodes[b].w) || a - b);
const rank = new Array(count);
order.forEach((i, k) => { rank[i] = k && collator.compare(nodes[order[k - 1]].w, nodes[i].w) === 0 ? rank[order[k - 1]] : k; });
const excluded = [];
for (const [word, n] of m.allByWord) if (!m.byWord.has(word)) excluded.push([word, n.id]);

// ---- edges ----
const typeList = Object.keys(require(path.join(dist, 'model.js')).types), noteList = [], noteIndex = new Map(), flat = [];
for (const e of m.edges) {
  if (!noteIndex.has(e.note)) { noteIndex.set(e.note, noteList.length); noteList.push(e.note); }
  flat.push(index.get(e.a), index.get(e.b), typeList.indexOf(e.type), noteIndex.get(e.note));
}

// ---- detail shards: evidence of every link, stored with both of its words ----
let untranslatable = 0;
const prepareProof = p => {
  if ((p.senseAz && p.senseEn) || !p.sense) return p;
  try {
    const pair = m.translationPair(p.language || 'en', p.sense), qualifier = p.qualifier ? m.translationPair(p.language || 'en', p.qualifier) : null;
    return { ...p, $t: [pair.az, pair.en, qualifier?.az || '', qualifier?.en || ''] };
  } catch { untranslatable++; return p; }
};
const shards = Array.from({ length: SHARDS }, () => ({ ev: [], evIndex: new Map(), e: [], refs: [], refIndex: new Map(), w: {} }));
let wordDetails = 0;
for (const n of nodes) if (etymology[n.w]) { shards[shardOf(n.w, SHARDS)].w[n.w] = etymology[n.w]; wordDetails++; }
const homonyms = nodes.filter(n => etymology[n.w]?.h).map(n => n.w);
// Citations repeat across a shard's proofs, so each shard keeps a table of them.
const shardRef = (shard, ref) => { const k = JSON.stringify(ref); if (!shard.refIndex.has(k)) { shard.refIndex.set(k, shard.refs.length); shard.refs.push(ref); } return shard.refIndex.get(k); };
m.edges.forEach((e, id) => {
  if (!e.evidence.length) return;
  for (const s of new Set([shardOf(e.a.w, SHARDS), shardOf(e.b.w, SHARDS)])) {
    const shard = shards[s];
    shard.e.push([id, e.evidence.map(p => {
      const k = JSON.stringify(p);
      if (!shard.evIndex.has(k)) { const proof = prepareProof(p); shard.evIndex.set(k, shard.ev.length); shard.ev.push(proof.refs ? { ...proof, refs: proof.refs.map(ref => shardRef(shard, ref)) } : proof); }
      return shard.evIndex.get(k);
    })]);
  }
});
fs.rmSync(path.join(dist, 'details'), { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'details'));
let detailBytes = 0;
const shardHashes = shards.map((shard, i) => {
  const text = JSON.stringify({ refs: shard.refs, ev: shard.ev, e: shard.e, w: shard.w });
  fs.writeFileSync(path.join(dist, 'details', i + '.json'), text);
  detailBytes += text.length;
  return hash(text).slice(0, 16);
});
log('word origins for', wordDetails, 'headwords;', homonyms.length, 'with homonyms');
log('details', SHARDS, 'files', (detailBytes / 1048576).toFixed(1), 'MB;', untranslatable, 'proofs without a translation pair');

// ---- forms archive ----
const COMPACT_FORM = new Set(['w', 'base', 'lemma', 'kind', 'id', 'key', 'baseKey', 'lemmaKey', 'meaningKey', 'definitions']);
const formsText = JSON.stringify(m.nominalRecords.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !COMPACT_FORM.has(k)))));
fs.writeFileSync(path.join(dist, 'forms-archive.json'), formsText);

// ---- core ----
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));
const core = {
  meta: {
    orthography: pick(w.WORD_WEB_ORTHOGRAPHY, ['title', 'edition', 'year', 'url']),
    nominal: pick(w.WORD_WEB_NOMINAL.meta, ['moved_entries']),
    growth: pick(w.WORD_WEB_GROWTH.meta, ['added_entries']),
    verification: pick(w.WORD_WEB_VERIFICATION.meta, ['assessed_entries', 'corrected_entries']),
    etymologyLanguages
  },
  homonyms,
  frequency: frequencyRank.size ? nodes.map(n => frequencyRank.get(n.w) || 0) : null,
  nodes: { count, orthographyStart, cols, sparse, english, azerbaijani, rank, excluded },
  refs,
  edges: { types: typeList, notes: noteList, flat },
  aliases: m.aliases,
  verbEvidence: m.verbEvidence,
  grammarRecords: m.grammarRecords,
  nominal: m.nominalRecords.map(r => [r.w, r.base, r.lemma ?? null, r.kind, r.id]),
  formsArchive: hash(formsText).slice(0, 16),
  details: { count: SHARDS, hashes: shardHashes }
};
const json = JSON.stringify(core);
fs.writeFileSync(path.join(dist, 'soz-core.json'), json);
fs.rmSync(path.join(dist, 'soz-core.js'), { force: true });
log('soz-core.json', (json.length / 1048576).toFixed(1), 'MB; forms-archive.json', (formsText.length / 1048576).toFixed(1), 'MB');

// ---- verify: the restored model must behave like createModel ----
const restoredCore = JSON.parse(fs.readFileSync(path.join(dist, 'soz-core.json'), 'utf8'));
// Equivalence with createModel is checked without the frequency layer, which
// only reorders search results; frequency is checked separately at the end.
const fetchJSON = file => JSON.parse(fs.readFileSync(path.join(dist, file.split('?')[0]), 'utf8'));
const r = restoreModel({ ...restoredCore, frequency: null }, { fetchJSON });
const canon = value => JSON.stringify(value, (k, v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.keys(v).sort().filter(key => !empty(v[key])).map(key => [key, v[key]]));
  return v;
});
const words = list => list.map(n => n.w).join('\n');
assert.equal(r.nodes.length, count);
assert.equal(r.prepareSearch(1000), false, 'search text is prepared in slices');
assert.equal(r.prepareSearch(), true);
for (let i = 0; i < count; i++) assert.equal(canon(r.nodes[i]), canon(nodes[i]), 'node ' + nodes[i].w);
assert.equal(words(r.orthographyNodes), words(m.orthographyNodes));
assert.equal(words(r.specialNodes), words(m.specialNodes));
assert.equal(words(r.alphabetical), words(m.alphabetical));
for (const [word] of m.allByWord) assert(r.allByWord.has(word), 'allByWord ' + word);
assert.equal(r.allByWord.size, m.allByWord.size);
assert.equal(r.edges.length, m.edges.length);
const edgeKey = e => [e.a.w, e.b.w, e.type, e.note].join('\t');
for (let i = 0; i < m.edges.length; i++) assert.equal(edgeKey(r.edges[i]), edgeKey(m.edges[i]), 'edge ' + i);
for (const n of nodes) assert.equal(r.degree(r.byWord.get(n.w)), m.adjacency.get(n.id).length, 'degree of ' + n.w);
for (const n of nodes) {
  const a = m.adjacency.get(n.id).map(x => x.node.w + '\t' + edgeKey(x.edge)).join('\n'), b = r.adjacency.get(n.id).map(x => x.node.w + '\t' + edgeKey(x.edge)).join('\n');
  assert.equal(b, a, 'adjacency order of ' + n.w);
}
assert.equal(canon(r.aliases), canon(m.aliases));
assert.equal(canon(r.verbEvidence), canon(m.verbEvidence));
assert.equal(canon(r.grammarRecords), canon(m.grammarRecords));
log('nodes, edges and orders match');
// Before any detail file loads, an edge has no evidence and no connection sense.
assert.equal(r.edges[0].evidence.length, 0);
for (const n of nodes) assert.equal(r.ensureDetails(n.w), true);
assert.equal(r.ensureForms(), true);
for (const n of nodes) assert.equal(canon(r.wordDetails(n.w)), canon(etymology[n.w] || null), 'word details of ' + n.w);
for (const word of homonyms) assert(r.isHomonym(word), 'homonym ' + word);
let infoChecked = 0, infoErrors = 0;
const info = (model, edge, word) => { try { return canon(model.connectionInfo(edge, word)); } catch (error) { return 'ERROR ' + error.message; } };
for (let i = 0; i < m.edges.length; i++) {
  const a = m.edges[i], b = r.edges[i];
  assert.equal(canon(b.evidence.map(({ $t, ...p }) => p)), canon(a.evidence), 'evidence of edge ' + edgeKey(a));
  for (const word of [a.a.w, a.b.w]) {
    const expected = info(m, a, word);
    if (expected.startsWith('ERROR')) { infoErrors++; continue; }
    assert.equal(info(r, b, word), expected, 'connectionInfo ' + edgeKey(a) + ' for ' + word);
    infoChecked++;
  }
}
log('connection senses match for', infoChecked, 'edge ends;', infoErrors, 'already failed in createModel');
assert.equal(canon(r.nominalRecords), canon(m.nominalRecords));
for (const [form, list] of m.formsByWord) assert.equal(canon(r.formsByWord.get(form)), canon(list), 'forms of ' + form);
// Sample searches: word starts, English glosses, archived forms and spelling without diacritics.
const samples = ['a', 'ev', 'kitab', 'gozel', 'house', 'beautiful', 'melumat', 'çay', 'kitablar', 'otaqda', 'getmək', 'yazdım', 'ş', 'qələm', 'zzzz'];
for (let i = 0; i < count; i += 997) { const word = nodes[i].w; samples.push(word, word.slice(0, 3), normalize(word.slice(0, 4)), (nodes[i].en || '').split(/[ ;,]/)[0]); }
for (const q of samples) {
  assert.equal(words(r.search(q, 9)), words(m.search(q, 9)), 'search ' + q);
  assert.equal(r.grammarSearch(q).map(x => x.id).join(), m.grammarSearch(q).map(x => x.id).join(), 'grammarSearch ' + q);
  assert.equal(r.nominalSearch(q).map(x => x.id).join(), m.nominalSearch(q).map(x => x.id).join(), 'nominalSearch ' + q);
  assert.equal(r.resolveWord(q)?.w, m.resolveWord(q)?.w, 'resolveWord ' + q);
  assert.equal(r.archiveMode(q), m.archiveMode(q), 'archiveMode ' + q);
}
for (const q of ['a', 'beautiful', 'su']) assert.equal(words(r.search(q, count)), words(m.search(q, count)), 'full search ' + q);
for (const form of [...m.formsByWord.keys()].filter((_, i) => i % 50 === 0)) assert.equal(r.resolveWord(form)?.w, m.resolveWord(form)?.w, 'resolveWord ' + form);
const filters = new Set(typeList);
for (let i = 0; i < count; i += 211) for (const depth of [1, 2]) {
  const a = m.neighborhood(nodes[i], depth, filters), b = r.neighborhood(r.nodes[i], depth, filters);
  assert.equal(b.items.map(x => x.node.w + '/' + x.depth + '/' + x.type).join(), a.items.map(x => x.node.w + '/' + x.depth + '/' + x.type).join(), 'neighborhood ' + nodes[i].w);
  assert.equal(b.edges.map(edgeKey).join('\n'), a.edges.map(edgeKey).join('\n'));
  assert.equal(b.total, a.total);
}
if (restoredCore.frequency) {
  const f = restoreModel(restoredCore, { fetchJSON });
  let ranked = 0;
  for (const n of f.nodes) { const info = f.frequency(n); if (info) { ranked++; assert.equal(info.rank, frequencyRank.get(n.w)); } else assert(!frequencyRank.has(n.w)); }
  for (const q of samples) assert.deepEqual(new Set(f.search(q, 30).map(n => n.w)).size, f.search(q, 30).length);
  const common = f.search('ev', 5).map(n => n.w);
  assert.equal(common[0], 'ev', 'exact headword still first');
  log('frequency ranks for', ranked, 'headwords; search prefers common words:', f.search('gö', 6).map(n => n.w).join(' '));
}
log('PASS: restored model matches createModel;', samples.length, 'search samples');
