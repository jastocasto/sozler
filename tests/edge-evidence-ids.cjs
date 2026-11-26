'use strict';
const assert = require('node:assert/strict');
const { assignEvidenceIds } = require('../scripts/edge_evidence_ids.cjs');
const { restoreModel } = require('../dist/model.js');

const edge = (a, b, type) => ({ a: { w: a }, b: { w: b }, type });
const first = edge('ev', 'yer', 'topic');
const second = edge('ev', 'yurd', 'syn');
const added = edge('yer', 'ev', 'syn');
const registry = [];
assert.deepEqual(assignEvidenceIds([first, second], registry).evidenceIdRuns, []);
const original = registry.slice();
const reversed = edge('yurd', 'ev', 'syn');
const update = assignEvidenceIds([added, reversed], registry);
assert.deepEqual(registry.slice(0, 2), original, 'retired numbers are reserved');
assert.equal(update.evidenceOrder[0], undefined);
assert.equal(update.evidenceOrder[1], reversed);
assert.equal(update.evidenceOrder[2], added);
assert.deepEqual(assignEvidenceIds([first, second, added], registry).evidenceIdRuns, []);
assert.equal(registry.length, 3);

// The new graph reorders edges and revives an old one. Identical shard rows
// must still attach the original proof to each relation, including siblings
// with the same endpoints and different types.
const graph = [added, first, second];
const runs = assignEvidenceIds(graph, registry).evidenceIdRuns;
const words = ['ev', 'yer', 'yurd'];
function snapshot(edges, evidenceIdRuns) {
  const flat = edges.flatMap(e => [words.indexOf(e.a.w), words.indexOf(e.b.w), e.type === 'topic' ? 0 : 1, 0]);
  return {
    nodes: {count: 3, orthographyStart: 3, cols: {w: {values: words}, id: {values: [0,1,2]}}, sparse: {}, rank: [0,1,2], excluded: []},
    edges: {flat, types: ['topic','syn'], notes: [''], evidenceIdRuns},
    verbEvidence: {}, nominal: [], grammarRecords: [], aliases: {}, meta: {},
    details: {count: 1, hashes: ['example']}
  };
}
function proofs(edges, runs) {
  const model = restoreModel(snapshot(edges, runs), {fetchJSON: () => ({
    ev: [{sense: 'first'}, {sense: 'second'}, {sense: 'added'}], e: [[0,[0]], [1,[1]], [2,[2]]]
  })});
  model.ensureDetails('ev');
  return model.edges.map(e => e.evidence[0].sense);
}
assert.deepEqual(proofs([first, second], undefined), ['first','second']);
assert.deepEqual(proofs(graph, runs), ['added','first','second']);
console.log('PASS stable evidence after insertions, reversal, retirement, reintroduction and legacy hydration.');
