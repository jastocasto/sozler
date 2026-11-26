const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'../dist');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),sandbox);
const {createModel}=require('../dist/model.js'),{describeWord,examples}=require('../dist/word-info.js'),{step}=require('../dist/physics.js');
const {loadLayers,MODEL_GLOBALS}=require('./layers.cjs');
loadLayers(sandbox);
const model=createModel(...MODEL_GLOBALS.map(key=>sandbox.window[key]));
for(const n of model.nodes){const info=describeWord(n,model.byWord);if(n.az)assert(info.definition.trim());if(info.generated){assert(info.base);assert(info.form);}if(info.suffix)assert.equal(info.base.w+info.suffix,n.w);}
for(const [word,example]of Object.entries(examples)){assert(model.allByWord.has(word),word);assert.equal(example.length,2);assert(example.every(text=>text.trim().length>10));}
const book=model.nominalSearch('kitablar').find(f=>f.w==='kitablar');assert.equal(book.lemma,'kitab');assert(book.tags.includes('plural'));assert(book.az&&book.en);assert(!model.byWord.has('kitabdan'));assert.equal(model.resolveWord('kitabdan').w,'kitab');
assert(describeWord(model.byWord.get('eləmək'),model.byWord).usage.includes('Danışıq'));
function particle(overrides={}){return {x:0,y:0,tx:0,ty:0,vx:0,vy:0,r:30,depth:0,scale:1,scaleV:0,targetScale:1,...overrides};}
const p=particle({x:90,scale:.82});let crosses=0,previous=p.x,scaleOvershoot=false;
for(let i=0;i<300;i++){step([p],[]);if(p.x*previous<0)crosses++;previous=p.x;if(p.scale>1.01)scaleOvershoot=true;}
assert(crosses>=2,'Position should rebound past equilibrium');assert(scaleOvershoot,'Selection should visibly bounce');assert(Math.abs(p.x)<.01,'Spring should settle');assert(Math.abs(p.scale-1)<.001);
const thrown=particle({x:100,vx:12});step([thrown],[]);assert(thrown.x>100,'Released bubble must initially continue with its momentum');for(let i=0;i<350;i++)step([thrown],[]);assert(Math.abs(thrown.x)<.01);
const fixed=particle({x:80});step([fixed],[],fixed);assert.equal(fixed.x,80,'Dragged position must follow the pointer');
for(const word of ['eləmək','etmək','məlumat','gözəl','söz']){
 const hood=model.neighborhood(model.byWord.get(word),2,new Set(['root','syn','ant','ending','topic']));
 const ps=hood.items.map((item,i)=>particle({node:item.node,depth:item.depth,tx:Math.cos(i*2.4)*item.depth*220,ty:Math.sin(i*2.4)*item.depth*220,x:i%2,y:i%3,scale:.85}));
 const byId=new Map(ps.map(p=>[p.node.id,p])),edges=hood.edges.map(e=>({a:byId.get(e.a.id),b:byId.get(e.b.id)}));let energy;
 for(let i=0;i<1200;i++)energy=step(ps,edges);
 assert(ps.every(p=>[p.x,p.y,p.vx,p.vy,p.scale].every(Number.isFinite)));assert(energy<.035,`${word} must settle, received ${energy}`);
}
console.log(`PASS: ${model.nodes.length} definitions, ${Object.keys(examples).length} bilingual examples, base/suffix explanations, position and scale rebound, release momentum, drag pinning, dense-web stability and settling.`);
