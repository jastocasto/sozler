const assert=require('node:assert/strict'),{boot}=require('./galaxy-harness.cjs'),geometry=require('./assert-web-geometry.cjs');
const Camera=require('../dist/galaxy.js');
// While the lens is open, equally spaced front and back stars diverge. A
// finger can still pick them under a rolled or grazing view without jumping.
for(const [width,height] of [[390,844],[844,390],[1440,900]]){
 const camera={x:0,y:0,z:0,zoom:1,angle:0,tilt:-.18,roll:0,lens:1,vanishX:width/2,vanishY:height*.41};
 const depth=Math.min(width,height)*.37,front={x:55,y:0,z:depth},back={x:55,y:0,z:-depth};
 const project=Camera.transform(camera,width,height);
 assert(project(front).x-camera.vanishX>(project(back).x-camera.vanishX)*2.3,'the nearer star passes substantially faster');
 const behind={x:0,y:0,z:depth*4};assert(project(behind).occluded);
 const words={points:[{word:'front',node:{id:1},...front},{word:'behind',node:{id:2},...behind}]};
 assert.deepEqual(Camera.glyphs(words,camera,width,height).map(g=>g.point.word),['front']);
 const [a,b]=words.points,screens=new Map(words.points.map(p=>[p.word,project(p)]));
 const web=Camera.connectionView({edges:[{from:a,to:b,a:a.node,b:b.node,type:'syn'}]},screens).group(new Set(['syn']),new Set());
 assert.equal(web.visible(width,height).length,0,'a line that passes behind the eye cannot streak across the view');
 Object.assign(screens.get(b.word),project(back));assert.equal(web.visible(width,height).length,1);
 const tapped={x:width*.26,y:height*.58,r:18},newFlight=Camera.makeWordFlight(camera,behind,tapped,{x:width/2,y:height*.43,r:30},width,height,0);
 const held=project(newFlight.fromAnchor),nextPose=Camera.sampleWordFlight(newFlight,.00001,width,height).camera;
 assert(!held.occluded&&Math.hypot(held.x-tapped.x,held.y-tapped.y)<1e-7,'a moving satellite can be retapped even with a home beyond the clipping plane');
 assert(Math.hypot(nextPose.x-camera.x,nextPose.y-camera.y,nextPose.z-camera.z)<.01,'retapping preserves the current eye position on takeoff');
 for(const pose of [camera,Camera.orbit(camera,.6,1.35)]){
  const render=Camera.transform(pose,width,height);
  for(const word of [front,back,behind]){
   const pixel=render(word),hit=Camera.unproject(pixel,pose,width,height,word.z,word);
   assert(Math.hypot(hit.x-word.x,hit.y-word.y,hit.z-word.z)<1e-7,'interrupted flight picks the same atlas point at its depth');
   const target={x:pixel.x+19,y:pixel.y-12},anchored=Camera.aimAt(pose,word,target,width,height);
   const aligned=Camera.transform(anchored,width,height)(word);
   assert(Math.hypot(aligned.x-target.x,aligned.y-target.y)<1e-7);
   const flat=Camera.closeFlightLens(anchored,word,target,width,height),held=Camera.transform(flat,width,height)(word);
   assert(!flat.lens&&Math.hypot(held.x-target.x,held.y-target.y)<1e-7&&Math.abs(held.depth*flat.zoom-aligned.depth*anchored.zoom)<1e-7);
  }
 }
 const orbit=Camera.orbit({x:1900,y:-4000,z:0,zoom:.009,angle:0,tilt:.52,roll:Math.PI/2},1.34,1.55);
 const word={x:11000,y:10000,z:300},source={...Camera.transform(orbit,width,height)(word),r:.7};
 const center={x:width/2,y:height*.43,r:30},flight=Camera.makeWordFlight(orbit,word,source,center,width,height,0);
 for(let frame=0;frame<=30;frame++){
  const t=frame/30,view=Camera.sampleWordFlight(flight,t,width,height),pixel=Camera.transform(view.camera,width,height)(view.anchor);
  assert(!pixel.occluded,'the eye cannot pass through the selected word, including from a steep orbit');
  if(t>=.25&&t<=.71){
   const flat=Camera.transform({...view.camera,lens:0},width,height)(view.anchor);
   assert(Math.abs(pixel.depth-flat.depth)<1e-8,'the target lies on the focus plane during passage');
  }
 }
}
for(const [width,height,reduced]of[[390,674,false],[1440,900,false],[390,674,true]]){
 const h=boot({width,height,reduced}),{window,runFrames,$}=h,s=()=>window.SozApp.inspect(),G=window.WordGalaxy,before=s(),original=JSON.stringify(window.WORD_GALAXY_DATA.points),origin=before.screenPositions.find(p=>p.word==='gözəl');
 window.SozApp.selectWord('gözəl');const first=s();if(!reduced){assert.deepEqual(first.camera,before.camera);assert(Math.hypot(first.particles[0].x-origin.x,first.particles[0].y-origin.y)<.001);assert(first.cameraTravelling);const moving=first.particles.slice(1).some(p=>Math.hypot(p.x-p.targetX,p.y-p.targetY)>5);assert(moving,'Related words start away from their destination');const anchor=first.selectionAnchor,record=window.WORD_GALAXY_DATA.points.find(p=>p[0]==='gözəl');assert(Math.hypot(anchor.x-record[1],anchor.y-record[2])<.001);
 for(let i=0;i<12;i++){runFrames(2);const state=s();geometry(state);const p=state.particles[0],expected=G.transform(state.camera,width,height)(anchor);assert(p.x>=Math.min(origin.x,state.focusCenter.x)-.01&&p.x<=Math.max(origin.x,state.focusCenter.x)+.01,'Zoom keeps the chosen word on its path to center');assert(p.y>=Math.min(origin.y,state.focusCenter.y)-.01&&p.y<=Math.max(origin.y,state.focusCenter.y)+.01);assert(Math.hypot(p.x-expected.x,p.y-expected.y)<.001,'Selected word is pinned to a world anchor, moved only by the camera');}assert.notDeepEqual(s().camera,before.camera);assert(s().camera.zoom>before.camera.zoom,'The view zooms toward a tiny selected word');
 const bg=before.screenPositions.find(p=>p.word==='kitab'),next=s().screenPositions.find(p=>p.word==='kitab');assert(Math.hypot(bg.x-next.x,bg.y-next.y)>1,'The surrounding atlas moves too');}
 runFrames(340);geometry(s());assert(s().settled);assert(!s().cameraTravelling);const standard=s().particles[0].visualRadius;assert(standard>=30&&standard<=52);
 const beforeHop=s(),peer=beforeHop.particles.find(p=>p.word==='çirkin');
 const peerElement=$('bubbles').querySelector('[data-word="çirkin"]');
 h.pointer('pointerdown',3,peer.x,peer.y,peerElement);h.pointer('pointerup',3,peer.x,peer.y);
 if(!reduced){
  assert(Math.hypot(s().particles[0].x-peer.x,s().particles[0].y-peer.y)<.001);
  runFrames(40);
  const passing=s();
  assert(passing.camera.lens>.85&&passing.camera.zoom>beforeHop.camera.zoom*1.8,'an equal-size hop opens a forward-facing perspective view');
  assert(passing.particles[0].visualRadius>standard*1.5&&passing.particles[0].visualRadius<standard*2,'the approaching word stays readable');
  runFrames(38);
 }
 const landed=s(),atlasHome=landed.screenPositions.find(p=>p.word===peer.word);
 assert(Math.hypot(atlasHome.x-landed.focusCenter.x,atlasHome.y-landed.focusCenter.y)<.001,'the new view arrives at the word’s permanent atlas location');
 if(!reduced){
  const other=landed.particles.find(p=>p.word!==landed.selected);window.SozApp.selectWord(other.word);
  assert(Math.hypot(s().particles[0].x-other.x,s().particles[0].y-other.y)<.001);
  runFrames(8);
  const next=s().particles.find(p=>p.word!==s().selected);window.SozApp.selectWord(next.word);
  assert(Math.hypot(s().particles[0].x-next.x,s().particles[0].y-next.y)<.001,'a tap midway through the trip starts at the displayed pixel');
 }
 runFrames(380);geometry(s());assert(s().settled);assert(Math.abs(s().particles[0].visualRadius-standard)<.01);
 window.SozApp.selectWord('şallaq');runFrames(340);geometry(s());assert(s().settled);assert(s().relatedWords.includes('qamçı'));if(width===390&&!reduced){h.$('zoomIn').click();h.runFrames(340);const big=s().particles[0];assert(big.visualRadius>standard);window.SozApp.selectWord(big.word);h.runFrames(380);geometry(s());assert(Math.abs(s().particles[0].visualRadius-standard)<.01,'Selection from a large zoom returns to the same bubble size through camera travel');}assert.equal(JSON.stringify(window.WORD_GALAXY_DATA.points),original);assert.equal(h.errors.length,0);console.log(`PASS ${width}×${height}${reduced?' reduced motion':''}: world-anchored selection, moving background, camera zoom to a standard bubble size, interruption continuity, remote search, collisions and centering.`);
}
