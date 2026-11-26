'use strict';
const assert = require('node:assert/strict');

function assignEvidenceIds(edges, registry) {
  const evidenceIdByKey = new Map(registry.map((key, id) => [key, id]));
  assert(!evidenceIdByKey.has(''), 'empty line in evidence ID registry');
  assert.equal(evidenceIdByKey.size, registry.length, 'duplicate connection in evidence ID registry');
  const evidenceOrder = [];
  const evidenceIdRuns = [];
  let nextIdInRun = 0;
  for (const [position, edge] of edges.entries()) {
    const endpoints = [edge.a.w, edge.b.w].sort();
    const key = JSON.stringify([endpoints[0], endpoints[1], edge.type]);
    let id = evidenceIdByKey.get(key);
    if (id === undefined) {
      id = registry.length;
      registry.push(key);
      evidenceIdByKey.set(key, id);
    }
    evidenceOrder[id] = edge;
    if (id !== nextIdInRun) evidenceIdRuns.push([position, id]);
    nextIdInRun = id + 1;
  }
  return { evidenceOrder, evidenceIdRuns };
}

module.exports = { assignEvidenceIds };
