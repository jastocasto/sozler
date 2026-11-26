const assert = require('node:assert/strict');
const {parseHTML} = require('linkedom');
const {createIndex} = require('../dist/atlas-routes');
const {types} = require('../dist/model');
const {mount} = require('../dist/atlas-route-panel');

const {document, HTMLElement, Event} = parseHTML('<html><body><button id="routesToggle"></button><section id="atlasRoutesPanel"></section></body></html>');
let focused = document.body;
Object.defineProperty(document, 'activeElement', {get: () => focused});
HTMLElement.prototype.focus = function () { focused = this; };
const container = document.getElementById('atlasRoutesPanel');
const toggle = document.getElementById('routesToggle');

const points = ['alma', 'armud', 'yemək', 'çəngəl'].map((word, i) => ({
  word, region: i < 2 ? 0 : i - 1, node: {id:i, w:word, az:word, en:['apple','pear','food','fork'][i]}
}));
const atlas = {
  regions: ['Bitkilər', 'Qida', 'Əşyalar'].map(label => ({label})),
  edges: [[2,0,'topic'], [1,2,'root'], [2,3,'topic'], [0,1,'topic']].map(([a,b,type], id) => ({
    id, type, from:points[a], to:points[b]
  }))
};
const index = createIndex(atlas);
const calls = [];
const panel = mount({container, toggle, atlas, index, types, onSelect: node => calls.push(['word', node]),
  onRegion: region => calls.push(['region', region]), onRoute: (from,to) => calls.push(['pair',from,to])});
const q = s => container.querySelector(s);
const qa = s => [...container.querySelectorAll(s)];
assert(container.hidden);
assert.equal(toggle.getAttribute('aria-controls'), container.id);
assert.equal(toggle.getAttribute('aria-expanded'), 'false');

toggle.click();
assert(panel.isOpen());
assert.equal(document.activeElement, q('h2'));
assert.equal(qa('.route-pair').length, 2);
assert.match(q('.route-summary').textContent, /2 bölgə cütü · 3 əlaqə/);
q('.route-pair').click();
assert.deepEqual(calls.at(-1), ['pair',0,1]);
assert.equal(q('h2').textContent, 'Bitkilər ↔ Qida');
assert.equal(q('.route-summary').textContent, '2 söz əlaqəsi');
assert.equal(qa('.route-breakdown li').length, 2);
assert(qa('.route-examples li').every(row => row.querySelector('.route-word').textContent !== 'yemək'));
q('.route-back').click();
assert.equal(document.activeElement.dataset.routeControl, 'pair-0-1');
assert.deepEqual(calls.at(-1), ['pair',null,null]);

panel.open(1,0);
panel.setFilters(new Set(['topic']));
assert.equal(qa('.route-examples li').length, 1);
const sample = q('.route-word');
assert.deepEqual(qa('.route-gloss').map(node => node.textContent), ['apple', 'food']);
for (const word of qa('.route-word')) {
  const gloss = word.parentElement.querySelector('.route-gloss');
  assert.equal(gloss.id, word.getAttribute('aria-describedby'));
  assert.equal(gloss.getAttribute('lang'), 'en');
  assert.equal(gloss.title, gloss.textContent);
  assert.equal(word.getAttribute('aria-label'), word.textContent + ' · sözə keç');
}
sample.focus();
panel.refresh();
assert.equal(document.activeElement.textContent, sample.textContent);
q('.route-word').click();
assert.deepEqual(calls.at(-1), ['word',points[0].node]);
assert(!panel.isOpen());

panel.open(0,1);
q('.route-visit').click();
assert.deepEqual(calls.at(-1), ['region',0]);
assert(!panel.isOpen());

panel.setFilters(new Set());
toggle.click();
assert.equal(qa('.route-pair').length,0);
assert(q('.route-empty').textContent.includes('süzgəc'));
panel.open(0,1);
assert.equal(qa('.route-word').length,0);
assert.equal(q('.route-summary').textContent,'0 söz əlaqəsi');
const escape = new Event('keydown', {bubbles:true, cancelable:true});
Object.defineProperty(escape, 'key', {value:'Escape'});
q('h2').dispatchEvent(escape);
assert(!panel.isOpen());
assert.equal(document.activeElement, toggle);

panel.setFilters(new Set(['root']));
points[1].node.en = '';
panel.open(0,1);
assert.equal(q('.route-summary').textContent,'1 söz əlaqəsi');
assert.equal(qa('.route-word').length,0);
assert(q('.route-empty').textContent.includes('nümunə'));
points[1].node.en = 'the fruit of a pear tree';
panel.refresh();
assert.equal(qa('.route-word').length, 2);
assert.equal(q('.route-gloss').textContent, points[1].node.en);
q('.route-close').click();
assert.equal(document.activeElement,toggle);
assert(!panel.isOpen());
console.log('PASS: route panel uses real pairs, filter counts and hydrated examples, with word and region actions and focus restoration.');
