const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const G=require('../dist/galaxy.js'),{restoreModel}=require('../dist/model.js'),s={window:{}};
for(const f of ['nominal','galaxy-data'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist',f+'.js'),'utf8'),s);
const w=s.window,model=restoreModel(require('../dist/soz-core.json'),{fetchJSON:require('./layers.cjs').fetchJSON}),data=w.WORD_GALAXY_DATA,atlas=G.createAtlas(data,model);
assert.equal(atlas.points.length,model.nodes.length);assert.equal(atlas.byWord.size,model.nodes.length);assert.equal(atlas.regions.length,10);assert(atlas.clusters.length>50);assert.equal(atlas.regions.reduce((sum,r)=>sum+r.count,0),model.nodes.length);
const archived=new Set(w.WORD_WEB_NOMINAL.excluded);
for(const p of atlas.points){assert(p.node&&[p.x,p.y,p.z].every(Number.isFinite));assert.equal(data.clusters[p.cluster].region,p.region);assert(!p.node.form);if(archived.has(p.word))assert(p.node.orthographyPage,p.word+' has a separately attested spelling entry');}
const group=word=>atlas.clusters[atlas.byWord.get(word).cluster].id,region=word=>atlas.regions[atlas.byWord.get(word).region].id;
for(const word of ['gözəl','qəşəng','yaraşıqlı','cazibədar','zərif','gözəllik'])assert.equal(group(word),'beauty');
for(const word of ['çirkin','eybəcər','yaraşıqsız'])assert.equal(group(word),'ugliness');
assert.equal(group('mehriban'),'kindness');assert.equal(group('qəddar'),'cruelty');assert.equal(region('qəddar'),region('gözəl'));
for(const word of ['eləmək','etmək','yaratmaq','getmək','öyrənmək'])assert.equal(region(word),'actions');
for(const word of ['öpüş göndərmək','busə etmək','öpüş almaq'])assert.equal(group(word),'interact');
for(const word of ['naz-nəvaziş','sevdicik','həmağuş'])assert.equal(group(word),'feelings');
assert.equal(group('maçamaç'),'manner');
assert.equal(group('kompüter'),'digital');assert.equal(group('kitab'),'learning');assert.equal(group('otaq'),'home');
for(const e of atlas.edges){assert(e.from&&e.to);assert.equal(e.from.node,e.a);assert.equal(e.to.node,e.b);}
const frozen=JSON.stringify(data.points),points=atlas.points.filter((p,i)=>i%211===0);
for(const [width,height]of [[320,568],[390,844],[844,390],[280,200],[1440,900]]){
 const overview=G.overview(atlas,width,height);assert(overview.zoom>0);
 for(const p of points){const cam={...G.focus(p),angle:.17,tilt:.35},project=G.transform(cam,width,height),q=project(p),back=G.unproject(q,cam,width,height,p.z);assert(Math.abs(back.x-p.x)<1e-7&&Math.abs(back.y-p.y)<1e-7);const centered=G.transform(G.focus(p),width,height)(p);assert(Math.abs(centered.x-width/2)<1e-7&&Math.abs(centered.y-height/2)<1e-7);}
 for(const area of [...atlas.regions,...atlas.clusters])assert(G.area(area,width,height).zoom>0);
 const from=G.focus(atlas.byWord.get('gözəl')),to=G.focus(atlas.byWord.get('kompüter')),flight=G.makeFlight(from,to,width,height,1000);assert(flight.far);assert(flight.valley<Math.min(from.zoom,to.zoom));let turning=false;
 for(let t=1000;t<3000;t+=23){const c=G.sampleFlight(flight,t);assert([c.x,c.y,c.zoom,c.angle,c.tilt].every(Number.isFinite));assert(c.zoom>0);if(Math.abs(c.angle)>.05)turning=true;}assert(turning);const done=G.sampleFlight(flight,5000);assert(done.done);assert.equal(done.x,to.x);assert.equal(done.zoom,to.zoom);
 const immediate=G.sampleFlight(G.makeFlight(from,to,width,height,0,true),0);assert(immediate.done);assert.equal(immediate.x,to.x);
 const anchor={x:width*.3,y:height*.6},before=G.unproject(anchor,from,width,height),after=G.unproject(anchor,G.zoomAt(from,anchor,from.zoom*2,width,height),width,height);assert(Math.abs(before.x-after.x)<1e-7&&Math.abs(before.y-after.y)<1e-7);
}
assert.equal(JSON.stringify(data.points),frozen,'Camera operations must never reposition words');
console.log(`PASS: all ${atlas.points.length} headwords at fixed coordinates in 10 regions/${atlas.clusters.length} navigation groups; reviewed concept anchors, unchanged relationship graph, finite and invertible depth projection, focus centering, anchored zoom and continuous reduced-motion-aware camera travel.`);
