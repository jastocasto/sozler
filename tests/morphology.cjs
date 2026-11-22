// Word-form recognition in search: inflected nouns and conjugated verbs resolve
// to their dictionary headword with a grammatical description and English gloss.
const assert = require('node:assert/strict'), fs = require('fs'), vm = require('vm'), path = require('path');
const dist = path.join(__dirname, '../dist'), sandbox = { window: {} };
for (const f of ['conjugation-data', 'conjugation-english-data']) vm.runInNewContext(fs.readFileSync(path.join(dist, f + '.js'), 'utf8'), sandbox);
const W = require('../dist/model.js'), CE = require('../dist/conjugation-engine.js'), EN = require('../dist/conjugation-english.js'), M = require('../dist/morphology.js');
const model = W.restoreModel(JSON.parse(fs.readFileSync(path.join(dist, 'soz-core.json'), 'utf8')), { fetchJSON: require('./layers.cjs').fetchJSON });
model.ensureText();
const D = CE.withDictionary(sandbox.window.WORD_CONJUGATIONS, model), E = CE.create(D);
const analyser = M.create({ model, normalize: W.normalize, engine: E, verbs: D.verbs, english: EN, englishData: sandbox.window.CONJUGATION_ENGLISH_DATA });
const first = q => analyser.analyze(q)[0];
function expect(query, word, segments, labels, english) {
  // A form can have several readings (suyu: "the water" or "his water"); find the expected one.
  const found = analyser.analyze(query), a = found.find(x => x.word === word && x.segments.join('·') === segments && labels.every(label => x.parts.some(p => p.az.includes(label))));
  assert(a, `${query}: expected ${word} ${segments} ${labels}, got ${found.map(x => x.word + ' ' + x.segments.join('·') + ' ' + x.parts.map(p => p.az).join(' · ')).join(' | ') || 'nothing'}`);
  if (english !== undefined) assert.equal(a.english, english, query + ' English');
  assert.equal(a.node, model.byWord.get(word), query + ' links to the headword');
  return a;
}
// Nouns: plural, possessive, case, -kı and "to be", including stem changes.
expect('kitablarımızdan', 'kitab', 'kitab·lar·ımız·dan', ['cəm', 'bizim', 'çıxışlıq'], 'from our books');
expect('uşaqlarımıza', 'uşaq', 'uşaq·lar·ımız·a', ['cəm', 'bizim', 'yönlük'], 'to our children');
expect('çörəyimiz', 'çörək', 'çörəy·imiz', ['bizim'], 'our bread');
expect('otağımda', 'otaq', 'otağ·ım·da', ['mənim', 'yerlik'], 'in my room');
expect('ağzından', 'ağız', 'ağz·ı·ndan', ['onun', 'çıxışlıq']);
expect('suyu', 'su', 'suy·u', ['onun']);
expect('evdəyik', 'ev', 'ev·də·yik', ['yerlik', 'I şəxs cəm'], 'we are in the house');
expect('evdəki', 'ev', 'ev·də·ki', ['yerlik', 'aid olan'], 'the one in the house');
expect('müəlliməm', 'müəllim', 'müəllim·əm', ['xəbərlik'], 'I am a teacher');
expect('müəllimlər', 'müəllim', 'müəllim·lər', ['cəm'], 'teachers');
// Verbs: every form comes from the conjugation engine, with its English meaning.
const getdim = expect('getdim', 'getmək', 'get·dim', ['Şühudi keçmiş', 'I şəxs tək'], 'I went');
assert.deepEqual(getdim.grammar, { tense: E.rows.findIndex(r => r.id === 'past'), person: 0, negative: false });
expect('gedirəm', 'getmək', 'ged·irəm', ['İndiki zaman'], 'I am going');
expect('yazmışam', 'yazmaq', 'yaz·mışam', ['Nəqli keçmiş'], 'I have written');
expect('gəlməyəcəklər', 'gəlmək', 'gəl·məyəcəklər', ['Qəti gələcək', 'inkar'], 'They will not come');
expect('oxuyuram', 'oxumaq', 'oxu·yuram', ['İndiki zaman'], 'I am reading');
// Typed without Azerbaijani letters.
assert.equal(first('kitablarimizdan').word, 'kitab');
assert(first('kitablarimizdan').loose);
assert.equal(first('gedirem').word, 'getmək');
// No analysis for headwords typed as they are, for very short input, or for nonsense.
assert.equal(analyser.analyze('kitab').length, 0);
assert.equal(analyser.analyze('ev').length, 0);
for (const nonsense of ['xyzlərimizdən', 'qwrtdim', 'zzzz']) assert.equal(analyser.analyze(nonsense).length, 0, nonsense);
// English plural helper.
assert.equal(M.pluralize('child'), 'children');
assert.equal(M.pluralize('city'), 'cities');
assert.equal(M.pluralize('box'), 'boxes');
console.log('PASS: inflected nouns and conjugated verbs resolve to headwords with grammar and English glosses');
