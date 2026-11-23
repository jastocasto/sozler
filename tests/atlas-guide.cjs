const assert = require('node:assert/strict');
const {boot} = require('./galaxy-harness.cjs');

const {window, $, input} = boot({width: 390, height: 844, reduced: true});
const data = window.WORD_GALAXY_DATA;
const list = $('atlasGuideList');
const dialog = $('atlasGuide');
function openGuide() {
  $('menuButton').click();
  $('atlasGuideButton').click();
  assert(dialog.hasAttribute('open'));
  assert(!$('menuDialog').hasAttribute('open'));
}

assert.equal(list.childElementCount, 0);
openGuide();
assert.equal(list.querySelectorAll('details').length, data.regions.length);
assert.equal(list.querySelectorAll('[data-cluster]').length, data.clusters.length);
for (const row of list.querySelectorAll('.guide-group')) {
  const words = [...row.querySelectorAll('[data-word]')].map(button => button.dataset.word);
  assert(words.length >= 1 && words.length <= 3);
  assert.equal(words.length, new Set(words).size);
}

input('atlasGuideSearch', 'nature heyvan');
const animals = list.querySelector('[data-cluster]');
assert.equal(animals.dataset.cluster, 'animals');
assert.equal(list.querySelectorAll('[data-cluster]').length, 1);
assert(list.querySelector('details').hasAttribute('open'));
const animal = list.querySelector('[data-word]').dataset.word;
animals.click();
assert(!dialog.hasAttribute('open'));
assert.equal($('breadcrumbRegion').textContent, 'Təbiət');
assert.equal($('breadcrumbCluster').textContent, 'Heyvanlar');
assert.equal(window.SozApp.inspect().view, 'cluster');

openGuide();
assert.equal($('atlasGuideSearch').value, '');
assert(list.querySelector('[data-cluster="animals"]').closest('details').hasAttribute('open'));
list.querySelector('[data-cluster="animals"]').click();
assert.equal(window.SozApp.inspect().view, 'cluster', 'Revisiting a group from the guide must show its map');
openGuide();
input('atlasGuideSearch', 'Animals');
list.querySelector('[data-word]').click();
assert.equal($('meaningWord').textContent, animal);
assert.equal(window.location.hash, '#w=' + encodeURIComponent(animal));
assert.equal($('breadcrumbCluster').textContent, 'Heyvanlar');

openGuide();
input('atlasGuideSearch', 'no-such-atlas-topic');
assert.equal(list.childElementCount, 0);
assert.match($('atlasGuideStatus').textContent, /tapılmadı/);
input('atlasGuideSearch', 'mechul');
assert.equal(list.querySelector('[data-cluster]').dataset.cluster, 'v-passive');
const passive = list.querySelector('[data-word]').dataset.word;
list.querySelector('[data-word]').click();
assert.equal($('meaningWord').textContent, passive);
assert.equal($('breadcrumbCluster').textContent, 'Məchul fellər');

$('raceButton').click();
$('raceStart').click();
assert($('atlasGuideButton').disabled);
$('atlasGuideButton').onclick();
assert(!dialog.hasAttribute('open'));
$('raceExit').click();
assert(!$('atlasGuideButton').disabled);
console.log('PASS atlas guide browsing, bilingual search, cluster and word jumps, spelling-only groups and race lock');
