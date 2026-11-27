const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),G=require('../dist/galaxy.js');
const s={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/galaxy-data.js','utf8'),s);const data=s.window.WORD_GALAXY_DATA,atlas={points:data.points.map(([word,x,y,z,cluster])=>({word,x,y,z,cluster,region:data.clusters[cluster].region}))},frozen=JSON.stringify(data.points);
for(const [width,height]of [[390,844],[1440,900]])for(const word of ['ailə','gözəl','kitab','şallaq']){
 const point=atlas.points.find(p=>p.word===word);let previous=null;
 for(const zoom of [.012,.06,.12,.199,.2,.201,.3,.4,.6,.8,1.2,2.4]){
  const camera=G.focus(point,zoom),project=G.transform(camera,width,height),glyphs=G.glyphs(atlas,camera,width,height),g=glyphs.find(v=>v.point===point);assert(g,word+' remains visible');
  assert(Math.hypot(g.screen.x-width/2,g.screen.y-height/2)<1e-7);assert(g.r>0&&g.r<=48);assert(g.labelOpacity>=0&&g.labelOpacity<=1);
  if(previous){assert(g.r>=previous.r-.01,'A tracked word should grow as the camera zooms closer');assert(g.labelOpacity>=previous.labelOpacity-.001);if(zoom<=.201&&zoom>=.2)assert(g.r-previous.r<.1,'No full-sized bubble jump at the old .20 threshold');}
  if(zoom<.3)assert.equal(g.labelOpacity,0);if(zoom>=.8)assert.equal(g.labelOpacity,1);
  for(const v of glyphs){const expected=project(v.point);assert.equal(v.screen.x,expected.x);assert.equal(v.screen.y,expected.y);}
  const large=glyphs.filter(v=>v.r>3);for(let i=0;i<large.length;i++)for(let j=i+1;j<large.length;j++)assert(Math.hypot(large[i].screen.x-large[j].screen.x,large[i].screen.y-large[j].screen.y)>large[i].r+large[j].r,'Fixed atlas bubbles must not overlap');
  previous=g;
 }
}
// Camera travel reuses the same screen objects for word glyphs and connection
// endpoints. The on-demand projector must still return independent positions.
const sample=atlas.points.slice(0,8),screens=sample.map(()=>({}));
const points=[...sample,{x:-350,y:70,z:15000},{x:28,y:42,z:-15000},{x:33,y:0}];
const destinations=points.map(()=>({})),originalObjects=destinations.slice();
for(const lens of [0,.4,1,0]){
 const project=G.transform({x:12,y:5,z:3,zoom:.85,angle:.12,tilt:.3,roll:.2,lens,vanishX:107,vanishY:381},390,844);
 project.all(points,destinations);
 points.forEach((p,i)=>{
  assert.equal(destinations[i],originalObjects[i],'batched projection retains every edge endpoint reference');
  assert.deepEqual(destinations[i],project(p),'batched and single points match, including near-plane clipping');
 });
 assert.equal(destinations.some(p=>p.occluded),!!lens);
}
for(const [width,height] of [[390,844],[1440,900]]){
 for(const zoom of [.09,.2,.8]){
  const project=G.transform({...G.focus(sample[0],zoom),angle:.12,tilt:.3},width,height);
  const independent=sample.map(project);
  sample.forEach((point,i)=>{
   assert.equal(project.into(point,screens[i]),screens[i]);
   assert.deepEqual(screens[i],independent[i]);
  });
 }
 const camera=G.focus(sample[0],.2);
 let measurements=0;
 const glyphs=G.glyphs({points:sample},camera,width,height,null,(word,size)=>{measurements++;return word.length*size;});
 assert(glyphs.some(v=>v.r>3),'circles are large enough for the proximity pass');
 assert(glyphs.every(v=>v.labelOpacity===0&&v.lines.length===0));
 assert.equal(measurements,0,'invisible labels skip text measurements throughout travel');
}
// The live buffer keeps words/arrays stable while strokes and labels appear or disappear.
const local={points:sample},visibleBuffer={glyphs:sample.map(point=>({point,screen:{}})),visible:[]};
for(const zoom of [.01,.85,.01]){
 const camera=G.focus(sample[0],zoom),project=G.transform(camera,390,844);
 visibleBuffer.glyphs.forEach(g=>project.into(g.point,g.screen));
 const buffered=G.glyphs(local,camera,390,844,null,null,visibleBuffer);
 const independent=G.glyphs(local,camera,390,844);
 assert.equal(buffered,visibleBuffer.visible);
 assert.equal(buffered.length,independent.length);
 buffered.forEach((g,i)=>{
  assert.equal(g,visibleBuffer.glyphs[sample.indexOf(g.point)]);
  for(const k of ['r','labelOpacity','fontSize'])assert.equal(g[k],independent[i][k]);
  assert.deepEqual(g.lines,independent[i].lines);
 });
}
assert.equal(JSON.stringify(data.points),frozen);
console.log('PASS: the same words grow from dots through the old threshold into labeled circles; all centers match their permanent projected points, opacity increases continuously, circles do not overlap and source coordinates are untouched.');
