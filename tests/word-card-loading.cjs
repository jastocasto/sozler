'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('./galaxy-harness.cjs');
const { fetchJSON } = require('./layers.cjs');
const { shardOf, restoreModel } = require('../dist/model.js');
const dist = path.resolve(__dirname, '../dist');
const core = fetchJSON('soz-core.json');
const textBytes = fs.readFileSync(path.join(dist, core.text.file)), text = JSON.parse(textBytes);
const bulk = [], groups = new Map();
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function network(file, options) {
  const name = file.split('?')[0];
  if (name === core.text.file) {
    assert.equal(options.integrity, 'sha256-' + crypto.createHash('sha256').update(textBytes).digest('base64'));
    const attempt = deferred(); bulk.push(attempt); return attempt.promise;
  }
  if (name.startsWith('meanings/')) {
    const attempt = deferred();
    const attempts = groups.get(name) || []; attempts.push(attempt); groups.set(name, attempts);
    return attempt.promise;
  }
  return fetchJSON(file);
}
const filename = word => 'meanings/' + core.text.meaningHashes[shardOf(word, core.text.meaningHashes.length)] + '.json';
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const old = {
    nodes: {count: 1, orthographyStart: 1, cols: {id:{values:[7]}, w:{values:['ev']}}, sparse:{}, rank:[0], excluded:[]},
    edges: {types:[], notes:[], flat:[]}, nominal:[], grammarRecords:[], aliases:{}, verbEvidence:{}, meta:{},
    details: {count:1,hashes:['unused']}, text:{file:'soz-text.json',hash:'legacy'}
  };
  let oldRequests=0;
  const oldText = {cols:{az:{values:['yaşayış yeri']},en:{values:['home']}}};
  const legacy=restoreModel(old,{fetchJSON:()=>{oldRequests++;return oldText;}});
  const oldWord=legacy.byWord.get('ev');
  assert.equal(legacy.ensurePrimary(oldWord),true);assert(!legacy.primaryReady(oldWord));assert.equal(oldRequests,0);
  legacy.ensureText();assert(legacy.primaryReady(oldWord));assert.equal(oldWord.en,'home');assert.equal(oldRequests,1);
  const inline=restoreModel({...old,text:undefined,nodes:{...old.nodes,cols:{...old.nodes.cols,...oldText.cols}}});
  assert(inline.primaryReady(inline.byWord.get('ev')));assert.equal(inline.byWord.get('ev').az,'yaşayış yeri');

  const h = boot({hash: '#w=' + encodeURIComponent('gözəl'), fetchJSON: network, reduced: true});
  const { $, model, window } = h;
  const select = w => window.SozApp.selectWord(w);
  const checkPair = w => {
    const i = core.nodes.cols.w.values.indexOf(w);
    assert.equal($('meaningWord').textContent, w);
    assert.equal($('meaningDefinition').textContent, text.cols.az.values[i]);
    assert.equal($('meaningEnglish').textContent, text.cols.en.values[i]);
    assert($('retryDefinition').hidden);
  };
  checkPair('gözəl');
  assert.equal($('meaningEnglish').textContent, 'beautiful');
  assert(model.search('beautiful', 20).some(n => n.w === 'gözəl'));
  $('sheetToggle').click(); checkPair('gözəl');
  for (const w of ['su', 'ev', 'kitab']) { select(w); checkPair(w); }
  assert.equal(groups.size, 0, 'starter cards read no extra file');
  assert.equal(bulk.length, 1);

  const a = 'öpüş göndərmək', b = 'həmağuş', af = filename(a), bf = filename(b);
  assert.notEqual(af, bf);
  Object.defineProperty(window.navigator,'onLine',{value:false,configurable:true});
  select(a);assert.equal(groups.size,0);assert($('retryDefinition').hidden, 'an offline card waits for its cached text');
  Object.defineProperty(window.navigator,'onLine',{value:true,configurable:true});
  select(a); assert.match($('meaningEnglish').textContent, /Loading/);
  select(b); assert.match($('meaningEnglish').textContent, /Loading/);
  groups.get(af)[0].resolve(fetchJSON(af));
  await tick();
  assert.equal($('meaningWord').textContent, b);
  assert.match($('meaningEnglish').textContent, /Loading/, 'the late first group cannot overwrite a new selection');
  groups.get(bf)[0].reject(new Error('mobile connection interrupted'));
  bulk[0].reject(new Error('bulk request interrupted'));
  await tick();
  assert.match($('meaningEnglish').textContent, /load the definition/);
  assert(!$('retryDefinition').hidden);

  $('retryDefinition').click();
  assert.equal(bulk.length, 2);
  assert.equal(groups.get(bf).length, 2);
  $('sheetToggle').click();
  groups.get(bf)[1].resolve(fetchJSON(bf));
  await tick(); checkPair(b);
  assert.equal($('sheetToggle').getAttribute('aria-expanded'), 'true');
  assert(!model.textLoaded(), 'an uncommon card can be read while the large request is still pending');
  select(a); checkPair(a);
  assert.equal(groups.get(af).length, 1);

  // A partial or mismatched download must be retryable even when a loader
  // fails while applying it. A reconnect recovers the complete dictionary.
  bulk[1].resolve({cols: {}});
  await tick(); assert(!model.textLoaded()); checkPair(a);
  window.dispatchEvent(new window.Event('online'));
  assert.equal(bulk.length, 3);
  bulk[2].resolve(text);
  await tick(); assert(model.textLoaded()); checkPair(a);
  assert.equal(h.errors.length, 0);
  console.log('PASS starter and long-tail bilingual cards during delayed downloads, stale selection, failed and mismatched responses, retry and reconnection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
