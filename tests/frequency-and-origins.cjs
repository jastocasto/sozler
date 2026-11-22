// Frequency ranks, learner levels, word origins and homonyms in the precomputed model.
const assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const { restoreModel } = require('../dist/model.js'), { fetchJSON } = require('./layers.cjs');
const dist = path.join(__dirname, '../dist');
const model = restoreModel(JSON.parse(fs.readFileSync(path.join(dist, 'soz-core.json'), 'utf8')), { fetchJSON });
const node = w => model.byWord.get(w);

// Frequency: the most common words rank first and map to levels by rank.
const top = model.commonWords().slice(0, 12).map(n => n.w);
for (const w of ['və', 'bu', 'bir', 'mən', 'olmaq', 'etmək']) assert(top.includes(w), w + ' is among the most common words: ' + top.join(' '));
for (const w of ['ev', 'kitab', 'su', 'getmək', 'gəlmək']) assert.equal(model.frequency(node(w)).level, 'A1', w + ' is A1');
const levels = model.commonWords().map(n => model.frequency(n));
levels.forEach((f, i) => assert.equal(f.rank, i + 1, 'ranks are consecutive'));
const bounds = { A1: 500, A2: 1500, B1: 3500, B2: 7000, C1: 15000, C2: Infinity };
for (const f of levels) assert(f.rank <= bounds[f.level] && f.band >= 1 && f.band <= 5);
assert(levels.length > 30000, 'tens of thousands of headwords are ranked');
assert.equal(model.frequency(node('zzzz')), null);
// Pronoun forms count for the pronoun, not for a rare homograph.
assert(!model.frequency(node('bun')) || model.frequency(node('bun')).rank > 1000, 'bunu/bunun count for bu, not bun');
// Search prefers common words within the same kind of match, after the exact headword.
assert.equal(model.search('ev', 5)[0].w, 'ev');
const prefix = model.search('gö', 6).map(n => model.frequency(n)?.rank || Infinity);
assert.deepEqual(prefix, [...prefix].sort((a, b) => a - b), 'prefix matches are ordered by frequency');

// Origins and homonyms arrive with the word's detail file.
assert(model.isHomonym('çay') && model.isHomonym('bal') && !model.isHomonym('kitab'));
assert.equal(model.wordDetails('çay'), null, 'details load on demand');
assert.equal(model.ensureDetails('çay'), true);
const cay = model.wordDetails('çay');
assert.deepEqual(cay.h.map(h => h.glosses[0]), ['tea', 'river']);
assert.deepEqual(cay.o.map(o => o.chain[0]), ['Sinitic', 'Proto-Turkic']);
model.ensureDetails('avtomobil');
assert.deepEqual(model.wordDetails('avtomobil').o[0].chain, ['Russian', 'French', 'Ancient Greek']);
assert.equal(model.wordDetails('avtomobil').o[0].kind, 'borrowed');
model.ensureDetails('kitab');
assert.deepEqual(model.wordDetails('kitab').o[0].chain, ['Arabic']);
for (const language of ['Arabic', 'Russian', 'Proto-Turkic']) assert(model.meta.etymologyLanguages[language][0], language + ' has an Azerbaijani name');
console.log('PASS: frequency ranks and levels, frequency-ordered search, word origins and homonyms');
