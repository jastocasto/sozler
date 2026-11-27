const assert = require('node:assert/strict');
const {boot} = require('./galaxy-harness.cjs');

const {window, $, pointer, captures, runUntilIdle} = boot({width: 320, height: 568, reduced: true});
const home = $('universeButton'), label = home.querySelector('.tool-label'), graph = $('graph');
window.document.elementFromPoint = (x, y) => x >= 80 && x <= 190 && y >= 460 && y <= 506 ? label : graph;
const finger = (x = 135, y = 483, identifier = 1) => ({identifier, clientX: x, clientY: y});
function touch(type, target, touches, changedTouches = touches) {
  const event = new window.Event(type, {bubbles: true, cancelable: true});
  Object.assign(event, {touches, changedTouches});
  target.dispatchEvent(event);
  return event;
}
let activations = 0;
home.addEventListener('click', () => activations++);

$('orbitToggle').click();
pointer('pointerdown', 1, 130, 270); pointer('pointermove', 1, 185, 270); pointer('pointerup', 1, 185, 270);
runUntilIdle();
assert.equal(window.SozApp.inspect().view, 'explore');
touch('touchstart', label, [finger()]);
assert(touch('touchend', label, [], [finger(139)]).defaultPrevented, 'the browser will not synthesize a duplicate click');
runUntilIdle();
assert.equal(activations, 1);
assert.equal(window.SozApp.inspect().view, 'universe', 'Home works when a map drag suppressed the native click');

touch('touchstart', label, [finger()]);
touch('touchmove', label, [finger(162)]);
touch('touchend', label, [], [finger()]);
touch('touchstart', label, [finger(85)]);
touch('touchend', label, [], [finger(79)]);
touch('touchstart', label, [finger()]);
touch('touchcancel', label, [], [finger()]);
touch('touchend', label, [], [finger()]);
const other = finger(210, 320, 2);
touch('touchstart', label, [finger()]);
const secondary = new window.Event('pointerdown', {bubbles: true, cancelable: true});
Object.assign(secondary, {pointerType: 'touch', pointerId: 2, isPrimary: false, button: 0, clientX: 210, clientY: 320});
graph.dispatchEvent(secondary);
assert(!captures.has(2), 'a second contact on the map cannot accidentally select a word or route');
touch('touchstart', graph, [finger(), other], [other]);
pointer('pointerup', 2, 210, 320);
touch('touchend', graph, [finger()], [other]);
touch('touchend', label, [], [finger()]);
assert.equal(activations, 1, 'dragging away, releasing outside, cancelling and using two fingers do not activate Home');

home.click();
assert.equal(activations, 2, 'the ordinary click entry point remains available to mouse and keyboard users');
console.log('PASS Home after a map drag, one activation per tap, cancelled and multi-contact gestures, and the regular click entry point.');
