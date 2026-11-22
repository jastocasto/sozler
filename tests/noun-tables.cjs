// Noun tables: rule-built case/possessive forms with evidence-based stem changes.
const assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const { restoreModel } = require('../dist/model.js'), { fetchJSON } = require('./layers.cjs'), M = require('../dist/morphology.js');
const model = restoreModel(JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/soz-core.json'), 'utf8')), { fetchJSON });
model.ensureText();
// Stem change as the page uses it: from the word's detail file.
const table = (word, owner = 0) => { model.ensureDetails(word); return M.declension(word, model.wordDetails(word)?.s?.[0])[owner].rows; };
const forms = (word, owner = 0) => Object.fromEntries(table(word, owner).map(r => [r.id, [r.singular, r.plural]]));
assert.deepEqual(forms('kitab'), { nom: ['kitab', 'kitablar'], gen: ['kitabın', 'kitabların'], dat: ['kitaba', 'kitablara'], acc: ['kitabı', 'kitabları'], loc: ['kitabda', 'kitablarda'], abl: ['kitabdan', 'kitablardan'], ins: ['kitabla', 'kitablarla'] });
assert.deepEqual(forms('kitab', 4).abl, ['kitabımızdan', 'kitablarımızdan'], 'bizim kitabımızdan');
assert.deepEqual(forms('kitab', 3).dat, ['kitabına', 'kitablarına'], 'third person takes n before the case');
assert.deepEqual(forms('kitab', 6).nom, ['kitabı', 'kitabları'], 'onların kitabı / kitabları');
// k/q softening only before a vowel, decided from evidence: native words soften, loans do not.
assert.deepEqual(forms('çörək').acc, ['çörəyi', 'çörəkləri']);
assert.deepEqual(forms('çörək').loc, ['çörəkdə', 'çörəklərdə']);
assert.deepEqual(forms('otaq', 1).loc, ['otağımda', 'otaqlarımda']);
assert.equal(forms('uşaq', 4).dat[1], 'uşaqlarımıza');
assert.equal(forms('fabrik').acc[0], 'fabriki');
assert.equal(forms('texnik').acc[0], 'texniki');
assert.equal(forms('hüquq').acc[0], 'hüququ');
assert.equal(forms('dostluq').acc[0], 'dostluğu');
// Vowel loss before a vowel ending only.
assert.deepEqual(forms('ağız', 3).abl, ['ağzından', 'ağızlarından']);
assert.equal(forms('ağız').loc[0], 'ağızda');
assert.equal(forms('oğul', 3).nom[0], 'oğlu');
assert.equal(forms('qızıl').acc[0], 'qızılı', 'qızıl keeps its vowel');
// Vowel-final nouns and su.
assert.deepEqual(forms('alma'), { nom: ['alma', 'almalar'], gen: ['almanın', 'almaların'], dat: ['almaya', 'almalara'], acc: ['almanı', 'almaları'], loc: ['almada', 'almalarda'], abl: ['almadan', 'almalardan'], ins: ['almayla', 'almalarla'] });
assert.equal(forms('alma', 3).nom[0], 'alması');
assert.deepEqual([forms('su').gen[0], forms('su').acc[0], forms('su').dat[0], forms('su', 1).nom[0], forms('su').loc[0]], ['suyun', 'suyu', 'suya', 'suyum', 'suda']);
// Every evidence-backed stem decision is one of the known shapes and sources.
const stems = require('../scripts/content/nouns/stems.json');
for (const [word, [shape, source]] of Object.entries(stems)) {
  assert(['soft', 'hard', 'drop'].includes(shape) && ['archive', 'corpus', 'compound', 'rule', 'uncertain'].includes(source), word);
  assert(model.byWord.has(word), word + ' is a headword');
}
console.log('PASS: noun tables with evidence-based stem changes (çörəyi, otağı, ağzı, suyu; fabriki, hüququ)');
