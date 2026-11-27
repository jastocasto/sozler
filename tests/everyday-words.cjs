const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {loadLayers, MODEL_GLOBALS, fetchJSON} = require('./layers.cjs');
const {createModel, restoreModel} = require('../dist/model.js');
const core = require('../dist/soz-core.json');
const source = fs.readFileSync('scripts/content/verification/common-words.json');
const review = JSON.parse(source);
const report = require('../dist/verification-attribution.json').common_words;
assert.equal(report.source_sha256, crypto.createHash('sha256').update(source).digest('hex'));
assert.equal(report.revisions, review.revisions.length);

const context = vm.createContext({window: {}});
loadLayers(context);
const args = MODEL_GLOBALS.map(key => context.window[key]);
const phase = MODEL_GLOBALS.indexOf('WORD_WEB_VERIFICATION');
args[phase] = {...args[phase], commonWordReview: undefined};
const before = createModel(...args);
const active = restoreModel(core, {fetchJSON});
active.ensureText();
const reviewed = new Map(review.revisions.map(entry => [entry.word, entry]));
assert.equal(active.nodes.length, before.nodes.length);
assert.equal(active.byWord.size, before.byWord.size);
for (const node of before.nodes) {
  const current = active.byWord.get(node.w);
  assert.equal(current?.id, node.id, node.w);
  const expected = reviewed.get(node.w) || node;
  assert.equal(current.az || '', expected.az || '', node.w);
  assert.equal(current.en || '', expected.en || '', node.w);
  if (reviewed.has(node.w)) {
    assert.equal(current.pos, expected.pos);
    assert.deepEqual(current.bilingualSenses, [{az: expected.az, en: expected.en}, ...expected.senses]);
    assert.deepEqual(current.definitionSources, expected.sources);
  }
}
const tokens = value => value.normalize('NFC').toLocaleLowerCase('az').match(/[\p{L}\p{N}]+/gu) || [];
let frequent = 0;
for (const [i, rank] of core.frequency.entries()) {
  if (!rank || rank > 1000) continue;
  const node = active.nodes[i];
  assert(node.az.trim() && node.en.trim(), node.w + ' has both languages');
  const head = tokens(node.w), gloss = tokens(node.az);
  assert(gloss.length > 0);
  const repeats = gloss.length % head.length === 0 && gloss.every((token, j) => token === head[j % head.length]);
  assert(!repeats, node.w + ' explains the headword');
  frequent++;
}
assert.equal(frequent, 1000);
for (const entry of ['gözəl', 'güzel', 'GÜZEL', 'guzel', 'gozel']) {
  assert.equal(active.resolveWord(entry)?.w, 'gözəl', entry);
  assert.equal(active.search(entry, 1)[0]?.w, 'gözəl', entry);
}
assert(!active.byWord.has('güzel'));
assert.equal(active.byWord.get('gözəl').en, 'beautiful');

const key = (a, b, type) => [...[a,b].sort(), type].join('|');
const oldKeys = new Set(before.edges.map(edge => key(edge.a.w, edge.b.w, edge.type)));
const newKeys = new Set(active.edges.map(edge => key(edge.a.w, edge.b.w, edge.type)));
const dropped = new Set(review.retyped_connections.map(row => key(row.a, row.b, row.old_type)));
const added = new Set(review.retyped_connections.map(row => key(row.a, row.b, row.type)));
assert.deepEqual(new Set([...oldKeys].filter(k => !newKeys.has(k))), dropped);
assert.deepEqual(new Set([...newKeys].filter(k => !oldKeys.has(k))), added);
for (const row of [...review.connection_evidence, ...review.retyped_connections]) {
  for (const [from,to] of [[row.a,row.b], [row.b,row.a]]) {
    active.ensureDetails(from);
    const pair = active.related(active.byWord.get(from)).find(item => item.node.w === to && item.edge.type === row.type);
    assert(pair, from + ' → ' + to);
    const proof = active.connectionInfo(pair.edge, from);
    assert.equal(proof.sense, row.sense_az);
    assert.equal(proof.senseEnglish, row.sense_en);
    assert.deepEqual(proof.refs, row.sources);
  }
}
const html = fs.readFileSync('dist/verification-report.html','utf8');
const section = html.match(/<section id="common-words"[^>]*>([\s\S]*?)<\/section>/);
assert(section);
const links = [...section[1].matchAll(/href="\.\/#w=([^"]+)"/g)].map(match => decodeURIComponent(match[1]));
assert.deepEqual(links, [...reviewed.keys()]);
console.log('PASS all 1,000 frequent words have substantive Azerbaijani and English entries,',
  reviewed.size, 'reviewed cards, spelling lookups, stable word IDs and the exact published relationship changes.');
