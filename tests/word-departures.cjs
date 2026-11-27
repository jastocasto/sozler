const assert = require('node:assert/strict');
const { boot } = require('./galaxy-harness.cjs');
const geometry = require('./assert-web-geometry.cjs');

const h = boot({ width: 390, height: 844 });
const inspect = () => h.window.SozApp.inspect();
const wordControl = word => h.$('bubbles').querySelector(`[data-word="${word}"]`);
function tap(word, pointerId, touch, target = wordControl(word)) {
  const state = inspect();
  const p = [...state.particles, ...state.surroundings].find(body => body.word === word);
  assert(p, word);
  const {x, y} = touch || p;
  h.pointer('pointerdown', pointerId, x, y, target);
  h.pointer('pointerup', pointerId, x, y);
  assert.equal(inspect().selected, word);
}

const oldWord = 'afət';
h.window.SozApp.selectWord('gözəl');
h.runUntilIdle();
const family = inspect().particles;
const start = family.find(p => p.word === oldWord), center = family.find(p => p.word === 'çirkin');
const oldFill = wordControl(oldWord).querySelector('.bubble').getAttribute('fill');
const oldRelation = h.window.WordWeb.types[wordControl(oldWord).dataset.type].color;
tap('çirkin', 1);
const departure = wordControl(oldWord);
const inFrame = p => p.x >= 0 && p.x <= 390 && p.y >= 105 && p.y <= 680;
const oldPositions = new Map(family.filter(p => inFrame(p) && wordControl(p.word)?.classList.contains('departing-word')).map(p => [p.word, p]));
function sampleBurst() {
  const visible = inspect().surroundings.filter(p => oldPositions.has(p.word) && inFrame(p) && +wordControl(p.word).getAttribute('opacity') > .25);
  return visible.map(p => {
    const origin = oldPositions.get(p.word), dx = p.x - origin.x, dy = p.y - origin.y;
    return {word: p.word, distance: Math.hypot(dx, dy), sector: Math.round(Math.atan2(dy, dx) * 4 / Math.PI + 8) % 8,
      outward: dx * (origin.x - center.x) + dy * (origin.y - center.y) > 0};
  });
}
assert(departure.classList.contains('departing-word'));
assert.equal(departure.getAttribute('aria-hidden'), 'true');
assert(!departure.hasAttribute('tabindex'));
assert.equal(departure.querySelector('.bubble').getAttribute('fill'), oldFill);
assert.equal(+departure.querySelector('.bubble').getAttribute('r'), start.visualRadius);
let pos = inspect().surroundings.find(p => p.word === oldWord);
assert(Math.hypot(pos.x - start.x, pos.y - start.y) < .01, 'launch from the last painted location');

h.runFrames(6);
pos = inspect().surroundings.find(p => p.word === oldWord);
const radial = (pos.x - start.x) * (start.x - center.x) + (pos.y - start.y) * (start.y - center.y);
assert(radial > 0 && Math.hypot(pos.x - start.x, pos.y - start.y) > 12, 'old neighbor is visibly flung outward');
const trail = departure.querySelector('.departure-trail');
assert(trail.getAttribute('d').endsWith(' Z'));
assert.equal(trail.getAttribute('fill'), oldRelation, 'the moving tail carries the former relationship color');
const first = sampleBurst();
assert(first.length >= oldPositions.size * .78 && first.filter(p => p.outward).length >= first.length * .85, 'the former family starts by moving out across the screen');
assert(new Set(first.filter(p => p.distance > 6).map(p => p.sector)).size >= 5, 'old words fan into different sectors, even when the tapped bubble is near the rim');
h.runFrames(10);
geometry(inspect());
const middle = sampleBurst(), offsets = new Map(middle.map(p => [p.word, p.distance]));
assert(middle.length >= oldPositions.size * .60, 'a passing camera cannot whisk the burst off the phone in a quarter second');
h.runFrames(12);
const late = sampleBurst();
assert(late.length >= oldPositions.size * .27, 'readable former words continue down their trails for nearly half a second');
assert(late.filter(p => p.outward && p.distance > 35 && p.distance + 3 >= (offsets.get(p.word) || 0)).length >= late.length * .8, 'visible words continue away instead of crossing back toward the selected family');
const opacity = +departure.getAttribute('opacity'), r = +departure.querySelector('.bubble').getAttribute('r');
assert(opacity > .25 && opacity < .75 && r < start.visualRadius * .75 && r > 5, 'the word shrinks and fades during its outward flight');
pos = inspect().surroundings.find(p => p.word === oldWord);
const hit = departure.querySelector('.departure-hit');
assert(+hit.getAttribute('stroke-width') >= 44 && hit.getAttribute('d').split(' l').length >= 3, 'the finger target follows recent painted positions');
const state = inspect(), others = [...state.particles, ...state.surroundings].filter(p => p.word !== oldWord);
const offset = Math.max(r + 2, 18);
const finger = Array.from({length: 8}, (_, i) => ({
  x: pos.x + Math.cos(i * Math.PI / 4) * offset, y: pos.y + Math.sin(i * Math.PI / 4) * offset
})).find(point => others.every(body => Math.hypot(point.x - body.x, point.y - body.y) > body.r + .5));
assert(finger && offset < 22, 'catch the moving word just outside its newly shrunken circle');
tap(oldWord, 2, finger, hit);
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
console.log('PASS former neighbors fan outward on visible, colored trails, stay catchable on a phone, shrink through the burst, and release their controls and connections.');
