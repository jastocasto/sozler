const assert = require('node:assert/strict');
const { boot } = require('./galaxy-harness.cjs');
const geometry = require('./assert-web-geometry.cjs');

const h = boot({ width: 390, height: 844 });
const inspect = () => h.window.SozApp.inspect();
const wordControl = word => h.$('bubbles').querySelector(`[data-word="${word}"]`);
function tap(word, pointerId) {
  const state = inspect();
  const p = [...state.particles, ...state.surroundings].find(body => body.word === word);
  assert(p, word);
  h.pointer('pointerdown', pointerId, p.x, p.y, wordControl(word));
  h.pointer('pointerup', pointerId, p.x, p.y);
  assert.equal(inspect().selected, word);
}

const oldWord = 'afət';
h.window.SozApp.selectWord('gözəl');
h.runUntilIdle();
const family = inspect().particles;
const start = family.find(p => p.word === oldWord), center = family.find(p => p.word === 'çirkin');
const oldFill = wordControl(oldWord).querySelector('.bubble').getAttribute('fill');
tap('çirkin', 1);
const departure = wordControl(oldWord);
assert(departure.classList.contains('departing-word'));
assert.equal(departure.getAttribute('aria-hidden'), 'true');
assert(!departure.hasAttribute('tabindex'));
assert.equal(departure.querySelector('.bubble').getAttribute('fill'), oldFill);
assert.equal(+departure.querySelector('.bubble').getAttribute('r'), start.visualRadius);
let pos = inspect().surroundings.find(p => p.word === oldWord);
assert(Math.hypot(pos.x - start.x, pos.y - start.y) < .01, 'launch from the last painted location');

h.runFrames(5);
pos = inspect().surroundings.find(p => p.word === oldWord);
const radial = (pos.x - start.x) * (start.x - center.x) + (pos.y - start.y) * (start.y - center.y);
assert(radial > 0 && Math.hypot(pos.x - start.x, pos.y - start.y) > 12, 'old neighbor is visibly flung outward');
assert(departure.querySelector('.departure-trail').getAttribute('d'));
h.runFrames(10);
geometry(inspect());
const opacity = +departure.getAttribute('opacity'), r = +departure.querySelector('.bubble').getAttribute('r');
assert(opacity > .25 && opacity < .93 && r < start.visualRadius && r > 5, 'the word is still visible partway through the fade');
pos = inspect().surroundings.find(p => p.word === oldWord);
tap(oldWord, 2);
const returning = inspect().particles[0];
assert(Math.hypot(returning.x - pos.x, returning.y - pos.y) < .01, 'can recall an outgoing word in flight');
assert.equal(returning.visualRadius, r);
assert.equal(h.$('bubbles').querySelectorAll(`[data-word="${oldWord}"]`).length, 1);
assert.equal(+wordControl(oldWord).getAttribute('opacity'), opacity, 'reselection preserves the visible opacity');
assert(!wordControl(oldWord).classList.contains('departing-word'));
h.runFrames(60);
assert(!h.$('bubbles').querySelector('.departing-word'));
assert.equal(Number(wordControl(oldWord).getAttribute('opacity') ?? 1), 1);
h.runUntilIdle();
geometry(inspect());
assert.equal(h.errors.length, 0);

const quiet = boot({ width: 390, height: 844, reduced: true });
quiet.window.SozApp.selectWord('gözəl');
quiet.window.SozApp.selectWord('çirkin');
assert(!quiet.$('bubbles').querySelector('.departing-word'));
assert(!quiet.$('bubbles').querySelector('.departure-trail'));
assert.equal(quiet.errors.length, 0);
console.log('PASS outgoing bubbles keep their colors, launch outward on visible trails, fade, can be recalled mid-flight, and leave no stale controls or connections.');
