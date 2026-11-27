const assert = require('node:assert/strict');
const {boot} = require('./galaxy-harness.cjs');

// This pair has both a shared root and opposite meanings in the dictionary.
const h = boot({reduced: true, hash: '#w=' + encodeURIComponent('təhlükəli')});
const {$, window, model} = h;
h.runUntilIdle();
const selected = 'təhlükəli', neighbor = 'təhlükəsiz';
const node = word => $('bubbles').querySelector('[data-word="' + word + '"]');
const traced = () => [...$('links').querySelectorAll('.traced-edge')];
function event(element, type, pointerType) {
  const e = new window.Event(type);
  if (pointerType) e.pointerType = pointerType;
  element.dispatchEvent(e);
}
const pair = Array.from(model.related(model.byWord.get(selected))).filter(r => r.node.w === neighbor);
assert.deepEqual(pair.map(r => r.edge.type).sort(), ['ant', 'root']);
const ids = pair.map(r => r.edge.id).sort((a, b) => a - b);
const target = node(neighbor), layer = $('links');
assert.equal(node(selected).style.getPropertyValue('--word-surface') || '', '');
assert.equal(node(selected).querySelector('.bubble').getAttribute('fill'), '#ecaa6b');
assert.equal(target.querySelector('.bubble').getAttribute('fill'), window.WordWeb.types[target.dataset.type].fill);
assert.equal($('bubbles').querySelector('.surrounding-word .bubble').getAttribute('fill'), '#41423f');
assert.equal(traced().length, 0);

event(target, 'pointerenter', 'touch');
assert.equal(traced().length, 0);
event(target, 'pointerenter', 'mouse');
assert.deepEqual(traced().map(p => Number(p.dataset.edgeId)).sort((a, b) => a - b), ids);
assert.equal(new Set(traced().map(p => p.getAttribute('d'))).size, 2);
assert(layer.classList.contains('tracing-relations'));
for (const phrase of ['Əks məna', 'Eyni kök və törəmə sözlər']) {
  assert(target.querySelector('title').textContent.includes(phrase));
  assert(target.getAttribute('aria-label').includes(phrase));
}
event(target, 'pointerleave', 'mouse');
assert.equal(traced().length, 0);
event(target, 'focus');
assert.equal(traced().length, 2);
event(target, 'blur');
assert(!layer.classList.contains('tracing-relations'));
event(node(selected), 'focus');
assert.equal(traced().length, 0);
event(node(selected), 'blur');

$('filters').querySelector('[data-type="root"]').click();
h.runUntilIdle();
assert.equal(node(neighbor).querySelector('.bubble').getAttribute('fill'), window.WordWeb.types.ant.fill);
event(node(neighbor), 'focus');
assert.deepEqual(traced().map(p => Number(p.dataset.edgeId)), [pair.find(r => r.edge.type === 'ant').edge.id]);
assert(!node(neighbor).getAttribute('aria-label').includes('Eyni kök və törəmə sözlər'));
const point = window.SozApp.inspect().particles.find(p => p.word === neighbor);
h.pointer('pointerdown', 1, point.x, point.y, node(neighbor));
h.pointer('pointerup', 1, point.x, point.y);
h.runUntilIdle();
assert.equal(window.SozApp.inspect().selected, neighbor);
assert.deepEqual(h.errors, []);
console.log('PASS: real multi-relation mouse and keyboard traces, native speech labels, filtering and touch navigation');
