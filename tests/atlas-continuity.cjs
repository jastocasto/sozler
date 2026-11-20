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
assert.equal(JSON.stringify(data.points),frozen);
console.log('PASS: the same words grow from dots through the old threshold into labeled circles; all centers match their permanent projected points, opacity increases continuously, circles do not overlap and source coordinates are untouched.');
