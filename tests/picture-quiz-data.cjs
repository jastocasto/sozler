// Picture-quiz data and logic: every picture names a real headword, SVG markup is
// limited to drawing elements, and every question has four distinct, non-confusable options.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('node:assert/strict');
const dist = path.join(__dirname, '../dist');
const sandbox = { window: {} };
for (const file of ['data', 'lexicon', 'grammar', 'vocabulary', 'review', 'bilingual', 'expansion', 'nominal', 'additions',
  'relations', 'references', 'growth', 'orthography-lexical', 'orthography-lexical-evidence', 'print-definitions', 'orthography',
  'verification', 'pictures'])
  vm.runInNewContext(fs.readFileSync(path.join(dist, file + '.js'), 'utf8'), sandbox);
const w = sandbox.window;
const model = require('../dist/model.js').createModel(w.WORD_WEB_DATA, w.WORD_WEB_EXTRA, w.WORD_WEB_GRAMMAR, w.WORD_WEB_VOCABULARY,
  w.WORD_WEB_REVIEW, w.WORD_WEB_BILINGUAL, w.WORD_WEB_EXPANSION, w.WORD_WEB_NOMINAL, w.WORD_WEB_ADDITIONS, w.WORD_WEB_RELATIONS,
  w.WORD_WEB_REFERENCES, w.WORD_WEB_GROWTH, w.WORD_WEB_VERIFICATION, w.WORD_WEB_ORTHOGRAPHY, w.WORD_WEB_ORTHOGRAPHY_LEXICAL,
  w.WORD_WEB_PRINT_DEFINITIONS);
const { createPictureQuiz } = require('../dist/picture-quiz.js');
const data = w.WORD_WEB_PICTURES;

// Data integrity.
assert(data.pictures.length >= 600, 'at least 600 pictures');
const ids = new Set(data.categories.map(c => c.id));
const words = new Set(), drawings = new Set();
const allowed = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'g']);
const attributes = new Set(['d', 'points', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2',
  'transform', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'fill-rule']);
for (const [word, category, svg, source, group] of data.pictures) {
  assert(group === undefined || /^[a-z]+$/.test(group), word + ' group');
  const node = model.byWord.get(word);
  assert(node, word + ' is an atlas headword');
  assert(node.en && node.az, word + ' has a bilingual definition to show after answering');
  assert(ids.has(category), word + ' has a known category');
  assert(source === 0 || source === 1);
  assert(!words.has(word), word + ' has one picture');
  words.add(word);
  assert(!drawings.has(svg), word + ' has its own drawing');
  drawings.add(svg);
  assert(svg.length < 12000, word + ' drawing is compact');
  for (const [, tag, attrs] of svg.matchAll(/<\s*\/?\s*([a-zA-Z]+)([^>]*)>/g)) {
    assert(allowed.has(tag), `${word}: <${tag}>`);
    for (const [, name, value] of attrs.matchAll(/([a-zA-Z][a-zA-Z0-9:-]*)="([^"]*)"/g)) {
      assert(attributes.has(name), `${word}: ${name}`);
      assert(/^[0-9a-zA-Z .,\-()#]*$/.test(value), `${word}: ${name}=${value}`);
      if (name === 'fill' || name === 'stroke') assert(['none', 'currentColor'].includes(value), `${word}: colour ${value}`);
    }
  }
  assert(!/<script|on[a-z]+=|href|url\(|style/i.test(svg), word + ' has no active content');
  assert.equal(svg.replace(/<[^>]*>/g, '').trim(), '', word + ' has no text in the drawing');
}
const attribution = JSON.parse(fs.readFileSync(path.join(dist, 'pictures-attribution.json'), 'utf8'));
assert.equal(attribution.pictures, data.pictures.length);
assert.equal(attribution.credits.length, data.pictures.length);
for (const credit of attribution.credits) if (credit.source === 'openmoji') assert(credit.author && credit.openmoji, credit.word + ' credits its OpenMoji author');
assert.equal(attribution.sources.openmoji.license, 'CC BY-SA 4.0');

// The pictures live only on the quiz page: no map script refers to them.
for (const file of ['app.js', 'galaxy.js', 'galaxy-view.js', 'word-info.js', 'learning-ui.js', 'race-ui.js'])
  assert(!/WORD_WEB_PICTURES/.test(fs.readFileSync(path.join(dist, file), 'utf8')), file + ' does not read picture data');

// Quiz logic.
const quiz = createPictureQuiz(model, data);
assert.equal(quiz.items.length, data.pictures.length);
assert(quiz.categories.length >= 6);
let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (const mode of ['picture', 'word']) for (const category of ['all', ...quiz.categories.map(c => c.id)]) {
  for (let r = 0; r < 4; r++) {
    const state = quiz.round({ category, mode, random });
    assert.equal(state.questions.length, 10);
    assert.equal(new Set(state.questions.map(q => q.answer.word)).size, 10, 'no repeated question in a round');
    for (const q of state.questions) {
      if (category !== 'all') assert.equal(q.answer.category, category);
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options.map(o => o.word)).size, 4);
      assert(q.options.includes(q.answer));
      for (const a of q.options) for (const b of q.options) if (a !== b) assert(!quiz.confusable(a, b), `${a.word} / ${b.word}`);
    }
  }
}
// Confusable pairs are kept apart.
const neck = quiz.byWord.get('boyun'), chin = quiz.byWord.get('çənə');
if (neck && chin) assert(quiz.confusable(neck, chin), 'two pointer drawings on the same bust are not offered together');
const boat = quiz.byWord.get('qayıq'), motorboat = quiz.byWord.get('kater');
if (boat && motorboat) assert(quiz.confusable(boat, motorboat), 'boat and motor boat are not offered together');

// Answering and review.
const state = quiz.round({ random });
assert.equal(quiz.answer(state, 'not-an-option'), null);
const first = state.questions[0];
const wrong = first.options.find(o => o !== first.answer).word;
assert.deepEqual(quiz.answer(state, wrong), { word: first.answer.word, chosen: wrong, correct: false });
assert.equal(quiz.answer(state, first.answer.word), null, 'one answer per question');
assert(quiz.next(state));
assert(quiz.answer(state, state.questions[1].answer.word).correct);
while (!state.complete) { if (state.answers.length === state.index) quiz.answer(state, state.questions[state.index].answer.word); quiz.next(state); }
assert.equal(state.answers.length, 10);
const retry = quiz.round({ words: [first.answer.word], random });
assert.equal(retry.questions.length, 1);
assert.equal(retry.questions[0].answer.word, first.answer.word);
console.log('picture quiz data ok:', data.pictures.length, 'pictures,', quiz.categories.map(c => c.id + ' ' + c.count).join(', '));
