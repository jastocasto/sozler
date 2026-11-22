// Picture quiz page: menu entry, #sekil route, both modes, keyboard answers, feedback,
// results, retry, storage fallback, return to the map, and no pictures in the map.
//   NODE_PATH=/path/to/linkedom/node_modules node tests/picture-quiz-page.cjs
const { parseHTML } = require('linkedom'); const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const dir = path.join(__dirname, '../dist'), { window } = parseHTML(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'));
const storage = new Map(); let storageFails = false;
const history = { states: [], pushState(state, title, url) { this.states.push(url); window.location.hash = url; }, replaceState(state, title, url) { window.location.hash = url; } };
Object.assign(window, { console, setTimeout, clearTimeout, setInterval: () => 0, matchMedia: () => ({ matches: false, addEventListener() {} }), ResizeObserver: class { observe() {} },
  requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => { if (storageFails) throw Error('storage unavailable'); storage.set(k, v); } },
  location: { hash: '' }, history });
Object.defineProperties(window.HTMLElement.prototype, { clientWidth: { get() { return 1000; } }, clientHeight: { get() { return 600; } } });
window.HTMLElement.prototype.showModal = function () { this.setAttribute('open', ''); }; window.HTMLElement.prototype.close = function () { this.removeAttribute('open'); };
window.HTMLElement.prototype.scrollIntoView = function () {};
require('./galaxy-harness.cjs').canvasMock(window);
const ctx = vm.createContext(window);
for (const script of window.document.querySelectorAll('script[src]')) { const file = script.getAttribute('src').split('?')[0]; vm.runInContext(fs.readFileSync(path.join(dir, file), 'utf8'), ctx, { filename: file }); }
const $ = id => window.document.getElementById(id), page = $('pictureQuizPage');
const key = k => { const e = new window.Event('keydown', { bubbles: true, cancelable: true }); e.key = k; page.dispatchEvent(e); };
const options = () => [...$('pictureOptions').children];

// Closed by default; the map has no picture markup.
assert(page.hidden, 'picture page starts hidden');
const studio = window.document.querySelector('.galaxy-studio');
assert(!studio.hidden);
const mapMarkup = studio.innerHTML;
const pictures = window.WORD_WEB_PICTURES.pictures;
assert(!pictures.slice(0, 50).some(p => mapMarkup.includes(p[2])), 'no picture drawing in the map');

// Menu entry opens the page and writes #sekil.
$('menuButton').click(); assert($('menuDialog').hasAttribute('open'));
$('pictureQuizButton').click();
assert(!$('menuDialog').hasAttribute('open'), 'menu closes');
assert(!page.hidden && studio.hidden, 'picture page replaces the map');
assert.equal(window.location.hash, '#sekil');
assert(!$('pictureIntro').hidden && $('picturePlay').hidden);
const chips = [...$('pictureCategories').children];
assert(chips.length >= 7, 'all topics plus "Hamısı"');
assert.equal(chips[0].getAttribute('aria-pressed'), 'true');
assert(/şəkil/.test($('pictureCount').textContent));

// Topic choice is remembered; picture -> word round with keyboard answers.
const animals = chips.find(c => c.textContent.startsWith('Heyvanlar'));
animals.click();
assert.equal([...$('pictureCategories').children].find(c => c.textContent.startsWith('Heyvanlar')).getAttribute('aria-pressed'), 'true');
assert.equal(JSON.parse(storage.get('soz-toxumasi:picture-quiz:v1')).category, 'animals');
$('pictureStart').click();
assert(!$('picturePlay').hidden && $('pictureIntro').hidden);
assert.equal($('pictureStage').querySelectorAll('svg').length, 1, 'one picture on the stage');
assert.equal($('pictureStage').getAttribute('aria-label'), 'Tapılacaq şəkil', 'the label does not give the answer away');
assert.equal(options().length, 4);
assert(options().every(b => b.querySelector('.option-word')), 'word options');
assert.match($('pictureProgress').textContent, /^1 \/ 10/);
const animalWords = new Set(pictures.filter(p => p[1] === 'animals').map(p => p[0]));
let correct = 0;
for (let i = 0; i < 10; i++) {
  const words = options().map(b => b.dataset.word);
  // The right answer is the option whose picture is on the stage.
  const svg = $('pictureStage').querySelector('svg').innerHTML;
  const right = pictures.find(p => svg === p[2] || svg.replace(/\s+/g, '') === p[2].replace(/\s+/g, ''))?.[0];
  assert(right && words.includes(right), 'the drawn word is among the options');
  assert(animalWords.has(right), 'question comes from the chosen topic');
  const pick = i === 0 ? words.find(w => w !== right) : right;
  key(String(words.indexOf(pick) + 1));
  assert(!$('pictureFeedback').hidden);
  assert(options().every(b => b.disabled));
  assert.equal(options().find(b => b.dataset.word === right).classList.contains('correct'), true);
  if (pick !== right) { assert(options().find(b => b.dataset.word === pick).classList.contains('incorrect')); assert.match($('pictureFeedback').textContent, /alınmadı/); }
  else correct++;
  assert($('pictureFeedback').querySelector('.feedback-word').textContent === right);
  assert($('pictureFeedback').querySelectorAll('p[lang=az], p[lang=en]').length >= 2, 'bilingual definition after answering');
  assert.equal($('pictureStage').getAttribute('aria-label'), 'Şəkil: ' + right);
  key('1'); // a second answer is ignored
  assert.equal(options().filter(b => b.classList.contains('incorrect')).length, pick === right ? 0 : 1);
  assert(!$('pictureNext').hidden);
  key('Enter');
}
assert(!$('pictureResults').hidden && $('picturePlay').hidden);
assert.equal($('pictureResultScore').textContent, '9 / 10');
assert.equal($('pictureReview').children.length, 10);
assert($('pictureReview').querySelectorAll('svg').length === 10, 'review shows each picture');
assert(!$('pictureRetry').hidden);
const saved = JSON.parse(storage.get('soz-toxumasi:picture-quiz:v1'));
assert.equal(saved.best['picture:animals'], 9); assert.equal(saved.rounds, 1);

// Retry only the missed word.
$('pictureRetry').click();
assert.match($('pictureProgress').textContent, /^1 \/ 1/);
const missed = options().find(b => $('pictureStage').querySelector('svg').innerHTML === pictures.find(p => p[0] === b.dataset.word)[2]);
assert(missed); missed.click(); $('pictureNext').click();
assert.equal($('pictureResultScore').textContent, '1 / 1');
assert.equal(JSON.parse(storage.get('soz-toxumasi:picture-quiz:v1')).rounds, 1, 'a review round does not count as a new round');

// Word -> picture mode.
$('pictureChange').click();
assert(!$('pictureIntro').hidden);
window.document.querySelector('[data-picture-mode=word]').click();
assert.equal(window.document.querySelector('[data-picture-mode=word]').getAttribute('aria-pressed'), 'true');
$('pictureStart').click();
assert($('pictureStage').classList.contains('is-word'));
const shown = $('pictureStage').textContent.trim();
assert(shown.length > 0);
assert(options().every(b => b.querySelector('svg')), 'picture options');
assert(options().every(b => /^Şəkil \d$/.test(b.getAttribute('aria-label'))), 'picture options do not name their word before answering');
const target = options().find(b => b.dataset.word === shown);
assert(target); target.click();
assert(target.classList.contains('correct'));
assert(target.querySelector('.option-caption').textContent === shown, 'answered pictures show their word');

// Leaving and coming back resumes the round; the map is restored without pictures.
$('pictureBack').click();
assert(page.hidden && !studio.hidden);
assert(!window.location.hash.startsWith('#sekil'));
assert(!studio.querySelector('.picture-stage, .picture-option'));
window.location.hash = '#sekil'; window.dispatchEvent(new window.Event('hashchange'));
assert(!page.hidden && !$('picturePlay').hidden, 'returning resumes the open question');
assert(!$('pictureNext').hidden, 'answered question stays answered');

// "Open in the map" from feedback shows the word in the atlas.
$('pictureFeedback').querySelector('.quiet-link').click();
assert(page.hidden && !studio.hidden);
assert.equal($('meaningWord').textContent, shown);
assert(!$('meaningCard').querySelector('svg.picture, .picture-stage'), 'the meaning card has no picture');

// Storage failure keeps the quiz working.
storageFails = true;
window.location.hash = '#sekil'; window.dispatchEvent(new window.Event('hashchange'));
for (let i = 0; i < 20 && $('pictureResults').hidden; i++) { if ($('pictureNext').hidden) options()[0].click(); $('pictureNext').click(); }
assert(!$('pictureResults').hidden);
assert.match($('pictureResultText').textContent, /yalnız bu sessiyada/);
console.log('PASS: picture quiz page — menu entry and #sekil route, topic filter, picture→word and word→picture rounds, keyboard answers, bilingual feedback, results, missed-only retry, resume, map link, storage fallback, map without pictures.');
