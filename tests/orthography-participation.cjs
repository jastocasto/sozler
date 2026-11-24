const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {boot} = require('./galaxy-harness.cjs');

const dist = path.join(__dirname,'../dist');
const read = file => fs.readFileSync(path.join(dist,file),'utf8');
const context = vm.createContext({window:{}});
const {MODEL_GLOBALS:globals,loadLayers} = require('./layers.cjs');
loadLayers(context);
for (const file of ['conjugation-data.js','galaxy-data.js','race-data.js','learning-data.js']) vm.runInContext(read(file),context,{filename:file});
const w = context.window;
const {createModel} = require('../dist/model.js');
const args = globals.map(name => w[name]);
const original = createModel(...args.slice(0,-1));
const model = createModel(...args);
const galaxy = require('../dist/galaxy.js');
const atlas = galaxy.createAtlas(w.WORD_GALAXY_DATA,model);

assert.equal(model.nodes.length,original.nodes.length);
assert.equal(model.byWord.size,atlas.points.length);
assert.deepEqual(model.grammarRecords,original.grammarRecords);
assert.deepEqual(model.nominalRecords,original.nominalRecords);
// Spelling-dictionary words join topic and word-formation clusters; no separate spelling region remains.
const data = w.WORD_GALAXY_DATA;
assert(!atlas.regions.some(region=>region.id==='orthography'));
assert.equal(atlas.regions.length,data.regions.length);
assert.equal(atlas.clusters.length,data.clusters.length);
const spellingWords = new Set(model.orthographyNodes.map(n=>n.w));
const spellingPoints = atlas.points.filter(point=>spellingWords.has(point.word));
assert.equal(spellingPoints.length,model.orthographyNodes.length);
assert.equal(data.spelling.count,model.orthographyNodes.length);
for (const [word,x,y,z] of data.points) {
  const point = atlas.byWord.get(word);
  assert(point.x===x && point.y===y && point.z===z,word+' keeps its position');
}
// Named groups, none dwarfing the rest, and every word inside its own circle with no circles overlapping.
const reach = new Map();
for (const point of atlas.points) {
  const cluster = atlas.clusters[point.cluster];
  assert.equal(point.region,cluster.region);
  reach.set(point.cluster,Math.max(reach.get(point.cluster)||0,Math.hypot(point.x-cluster.x,point.y-cluster.y)));
}
for (const cluster of atlas.clusters) {
  assert(cluster.label&&cluster.en,cluster.id+' is named');
  assert((reach.get(cluster.index)||0)<=cluster.radius,cluster.id+' holds its words');
  assert(cluster.count<=atlas.points.length*.09,cluster.id+' is one group among many');
}
for (const [i,a] of atlas.clusters.entries()) for (const b of atlas.clusters.slice(i+1)) {
  assert(Math.hypot(a.x-b.x,a.y-b.y)>(reach.get(a.index)||0)+(reach.get(b.index)||0),a.id+' and '+b.id+' do not overlap');
}
assert.equal(atlas.clusters.reduce((n,c)=>n+c.count,0),atlas.points.length);
assert.equal(atlas.regions.reduce((n,r)=>n+r.count,0),atlas.points.length);
const cluster = word => atlas.clusters[atlas.byWord.get(word).cluster];
for (const word of ['abdəstli','abdəstsiz','abdəstlik']) assert.equal(cluster(word),cluster('abdəst'),word+' sits with its base word');
const spellingGroups = new Set(spellingPoints.map(point=>point.cluster));
assert(spellingGroups.size>40,'Spelling words are spread over many groups');
assert(atlas.clusters.some(c=>c.label.startsWith('Feli isimlər')&&spellingGroups.has(c.index)));
const pass = w.WORD_WEB_ORTHOGRAPHY_LEXICAL;
const type = (a,b,kind) => model.related(model.byWord.get(a)).find(item => item.node.w===b&&item.edge.type===kind);
for (const [a,b,kind] of pass.edges) {
  const forward = type(a,b,kind);
  if (!forward && kind==='topic') continue; // A more specific relation can supersede a topic link.
  assert(forward, a+' '+kind+' '+b);
  assert.equal(type(b,a,kind)?.edge,forward.edge);
  assert(model.connectionInfo(forward.edge,a)?.refs.every(ref=>ref.url.startsWith('https://')));
}
const abadFamily=pass.families.find(([word])=>word==='abad')[1];
assert(abadFamily.includes('abadlaşma'));
assert(abadFamily.includes('abadlaşdırılma'));
for(const [i,a] of abadFamily.entries())for(const b of abadFamily.slice(i+1)){
  assert(type(a,b,'root'),'Shared abad family: '+a+' / '+b);
  assert(type(b,a,'root'));
}
assert(!pass.families.some(([,members])=>members.includes('bu')&&members.includes('gün')));
assert(model.byWord.get('abadlaşdırılma').en.startsWith('The process'));
assert(model.byWord.get('abadlaşdırılma').definitionSources.length);
assert(type('abadan','abad','syn'));
assert(type('abadlaşdırılmaq','abadlaşdırmaq','root'));
assert(model.related(model.byWord.get('abandon')).some(item=>item.edge.type==='topic'));

const engine = require('../dist/conjugation-engine.js');
const profiles = engine.withDictionary(w.WORD_CONJUGATIONS,model);
const conjugate = engine.create(profiles);
assert(profiles.order.length>w.WORD_CONJUGATIONS.order.length);
for (const node of model.nodes) {
  if ((node.pos==='verb'||model.verbEvidence[node.w])&&/(maq|mək)$/.test(node.w)) {
    const profile = profiles.verbs[node.w];
    assert(profile,node.w+' enters fel təsrifləri');
    if (!profile.blocked) assert.equal(engine.make(profile,'infinitive',0,false),node.w);
  }
}
for (const noun of ['alacadamaq','aqrar-əmək','bal-qaymaq','burun-damaq','barmaq']) assert.equal(conjugate.get(noun),null);
assert(conjugate.get('imək').blocked);
const present = conjugate.rows.findIndex(row=>row.id==='present');
for (const [verb,form] of [['boyatmaq','boyadır'],['bitişdirmək','bitişdirir'],['cildlədilmək','cildlədilir'],['qaranlıqlaşmaq','qaranlıqlaşır']]) {
  assert.equal(conjugate.form(verb,present,2,false)?.full,form);
}

const race = require('../dist/race.js');
const bank = race.mapRoutes(w.WORD_RACE_DATA,atlas);
assert.equal(new Set(bank.dailyMap.map(c=>c.start)).size,model.nodes.length);
assert.equal(new Set(bank.dailyMap.map(c=>c.target)).size,model.nodes.length);
for (const challenge of bank.dailyMap) {
  let previous = bank.neighbors(challenge.start)[0], word = challenge.start;
  for (let i=0;i<3;i++) [previous,word]=[word,bank.neighbors(word).find(neighbor=>neighbor!==previous)];
  assert.equal(word,challenge.target);
}
const learning = require('../dist/learning.js').createLearning(model,w.WORD_WEB_LEARNING);
assert(learning.dailyWords.includes('ehkam'));
assert(Array.from({length:60},(_,i)=>learning.daily(new Date(Date.UTC(2026,10,19+i))).word).some(n=>n.orthographyPage));

const h = boot({width:390,height:844,reduced:true,hash:'#w=abadan'});
const inspect = () => h.window.SozApp.inspect();
const total = model.nodes.length.toLocaleString('az')+' söz';
assert.equal(h.$('universeTotal').textContent,total);
assert.equal(h.$('breadcrumbHome').nextElementSibling,h.$('universeTotal'));
assert.equal(h.$('graph').getAttribute('aria-describedby'),'universeTotal');
assert(!h.$('mapCounts'));
assert(!h.$('universeWelcome'));
assert.equal(h.$('zoomLabel').textContent,'1×');
h.$('zoomIn').click();assert.notEqual(h.$('zoomLabel').textContent,'1×');
h.$('universeButton').click();
assert.equal(h.$('universeTotal').textContent,total);
assert(!h.$('atlasLabels').querySelector('[data-region="orthography"]'));
// Mobile labels depend on region size and available space as the dictionary grows.
const regionLabel = h.$('atlasLabels').querySelector('[data-region]');
assert(regionLabel);
const visibleRegion = atlas.regions.find(region=>region.id===regionLabel.dataset.region);
assert.equal(h.counts.arcs.length,atlas.points.length,'The overview draws the spelling entries as individual dots');
assert(inspect().atlasLines.some(line=>spellingWords.has(line.a)!==spellingWords.has(line.b)));
regionLabel.click();
assert.equal(inspect().view,'region');
assert.equal(h.$('breadcrumbRegion').textContent,visibleRegion.label);
assert.equal(inspect().camera.x,visibleRegion.x);
assert.equal(inspect().camera.y,visibleRegion.y);
assert.match(h.$('brandHome').querySelector('img').getAttribute('src'),/^favicon\.svg\?v=/);
h.$('brandHome').click();
assert.equal(inspect().view,'universe');
h.$('zoomIn').click();
h.$('zoomIn').click();
assert(inspect().visible<atlas.points.length);
assert.equal(h.$('universeTotal').textContent,total);
h.$('breadcrumbHome').click();
assert.equal(inspect().view,'universe');
h.window.SozApp.selectWord('abadan');
assert(inspect().particles.some(p=>p.word==='abad'),'Synonym appears as a real bubble');
h.window.SozApp.selectWord('abadlaşma');
assert(inspect().particles.some(p=>p.word==='abad'),'The shared root is a real bubble from the action noun');
assert([...h.$('connections').querySelectorAll('[data-type=root] .word-chip')].some(n=>n.textContent==='abadlıq'));
h.window.SozApp.selectWord('abadlaşdırılma');
assert.match(h.$('meaningEnglish').textContent,/The process of being improved/);
assert(h.$('meaningSource').querySelectorAll('a').length>=2);
h.input('search','abadlaşdırılma');
assert.match(h.$('searchResults').querySelector('.preview-en').textContent,/The process of being improved/);
h.$('dictionaryTab').click();
h.input('librarySearch','abadlaşdırılma');
assert.match(h.$('libraryList').querySelector('.preview-en').textContent,/The process of being improved/);
h.$('libraryDialog').close();
h.window.SozApp.selectWord('abadlaşdırılmaq');
assert(inspect().particles.some(p=>p.word==='abadlaşdırmaq'),'Root family appears as a real bubble');
h.$('grammarTab').click();
h.input('conjugationVerb','boyatmaq');
assert.equal(h.$('conjugationResults').querySelector('strong').textContent,'boyatmaq');
h.$('conjugationResults').querySelector('button').click();
h.$('tenseNext').click();
h.$('conjugationPersons').children[2].click();
assert.equal(inspect().conjugation.form,'boyadır');
h.$('conjugationBack').click();

const isolated = model.orthographyNodes.find(n=>!model.related(n).length);
const challenge = bank.dailyMap.find(c=>c.start===isolated.w);
h.window.WordRace.practice = () => ({...challenge,mode:'practice',id:'test-route',day:'2026-11-19'});
h.$('raceButton').click();
h.$('racePracticeTab').click();
h.$('raceStart').click();
h.runFrames(4);
h.intervals.forEach(tick=>tick());
assert(inspect().race.active);
assert.equal(inspect().selected,challenge.start);
let previous = bank.neighbors(challenge.start)[0];
for (let i=0;i<3;i++) {
  const current = inspect().selected, next = bank.neighbors(current).find(word=>word!==previous);
  const particle = inspect().particles.find(p=>p.word===next);
  assert(particle,'Race next stop appears as a bubble');
  const bubble = [...h.window.document.querySelectorAll('[data-word]')].find(node=>node.getAttribute('data-word')===next);
  h.pointer('pointerdown',i+1,particle.x,particle.y,bubble);
  h.pointer('pointerup',i+1,particle.x,particle.y);
  h.runFrames(5);
  h.intervals.forEach(tick=>tick());
  assert.equal(inspect().selected,next);
  previous=current;
}
assert(inspect().race.complete);
assert.equal(inspect().race.taps,3);
assert.equal(h.errors.length,0);
console.log('PASS spelling words in named topic and word-formation clusters without overlap, full overview dots, AZ home button, reciprocal lexical bubbles, verb picker, curated daily rotation, and a playable three-tap race from an isolated entry.');
