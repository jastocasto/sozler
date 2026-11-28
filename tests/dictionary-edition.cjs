// Sourced additions and revisions must reach the searchable, reciprocal dictionary graph.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createModel} = require('../dist/model.js');
const {MODEL_GLOBALS, loadLayers} = require('./layers.cjs');
const root = path.join(__dirname, '..');
const attributions = require('../dist/verification-attribution.json');
const fields = ['entries', 'revisions', 'connections'];
const editions = ['dictionary-edition', 'usage-edition'].map(name => {
  const source = fs.readFileSync(path.join(root, 'scripts/content/verification', name + '.json'));
  const edition = JSON.parse(source);
  const attribution = attributions[name.replace('-', '_')];
  assert.equal(attribution.source_sha256, crypto.createHash('sha256').update(source).digest('hex'));
  for (const field of fields) assert.equal(attribution[field], edition[field].length);
  return edition;
});
const edition = Object.fromEntries(fields.map(field => [field, editions.flatMap(item => item[field])]));

const sandbox = vm.createContext({window:{}});
loadLayers(sandbox);
const args = MODEL_GLOBALS.map(name => sandbox.window[name]);
const active = createModel(...args);
const priorArgs = args.slice();
const index = MODEL_GLOBALS.indexOf('WORD_WEB_VERIFICATION');
priorArgs[index] = {...args[index], dictionaryEdition: undefined};
const prior = createModel(...priorArgs);
assert.equal(active.nodes.length, prior.nodes.length + edition.entries.length);
for (const node of prior.nodes) assert.equal(active.byWord.get(node.w).id, node.id, node.w + ' keeps its ID');
for (const {word} of edition.entries) {
  assert(!prior.byWord.has(word));
  assert(!active.byWord.get(word).orthographyPage, word + ' is directly attested by its dictionary entry');
  assert.equal(active.search(word, 1)[0].w, word);
}
for (const {word} of edition.revisions) assert(prior.byWord.has(word));
for (const entry of [...edition.entries, ...edition.revisions]) {
  const node = active.byWord.get(entry.word);
  assert.equal(node.az, entry.az);
  assert.equal(node.en, entry.en);
  assert.equal(node.pos, entry.pos);
  assert.equal(node.definitionAuditStatus, 'source-compared');
  assert.equal(JSON.stringify(node.bilingualSenses), JSON.stringify([{az: entry.az, en: entry.en}, ...entry.senses]));
  assert.equal(JSON.stringify(node.definitionSources), JSON.stringify(entry.sources));
  assert.equal(node.definitionRegister, entry.register);
  assert.equal(JSON.stringify(node.definitionExample), JSON.stringify(entry.example));
  assert.equal(node.definitionUsage, entry.usage);
}
function edgeBetween(model, a, b, type) {
  const node = model.byWord.get(a);
  return node && model.related(node).find(item => item.node.w === b && item.edge.type === type)?.edge;
}
for (const {a,b,type,sense_az,sense_en,sources} of edition.connections) {
  assert(!edgeBetween(prior, a, b, type), a + ' ↔ ' + b + ' is a newly documented relation');
  const edge = edgeBetween(active, a, b, type);
  assert(edge, a + ' ↔ ' + b);
  assert.equal(edgeBetween(active, b, a, type), edge);
  const proof = active.connectionInfo(edge, b);
  assert.equal(proof.sense, sense_az);
  assert.equal(proof.senseEnglish, sense_en);
  assert.equal(JSON.stringify(proof.refs), JSON.stringify(sources));
}
assert.equal(active.edges.length, prior.edges.length + edition.connections.length);
assert(active.search('blow someone a kiss', 20).some(node => node.w === 'öpüş göndərmək'));
const kiss = active.byWord.get('öpüş');
assert.equal(kiss.pos, 'noun');
assert(kiss.bilingualSenses.some(s => s.en.includes('blow someone a kiss')));
for (const [query, word] of [
  ['geci tezi', 'geci-tezi'], ['geci tezi olmaq', 'geci-tezi olmaq'],
  ['nağayırmaq', 'nağayırsan'], ['qadan alaram', 'qadanı alaram'], ['qadan alım', 'qadanı alım'],
  ['qurbanın olum', 'qurban olum'], ['nə var nə yox', 'nə var, nə yox']
]) {
  assert.equal(active.resolveWord(query)?.w, word);
  assert.equal(active.search(query, 1)[0]?.w, word);
}
assert(active.byWord.get('şərh').bilingualSenses.some(s => /comment on an online post/.test(s.en)));
assert.equal(active.byWord.get('mırta').definitionRegister, 'slang');
assert.equal(active.byWord.get('girov götürmək').en, 'To take someone hostage.');
console.log('PASS', edition.entries.length, 'new searchable entries,', edition.revisions.length, 'bilingual revisions,', edition.connections.length, 'new reciprocal sourced relations; existing word IDs retained.');
