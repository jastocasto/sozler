const assert=require('node:assert/strict'),{boot}=require('./galaxy-harness.cjs'),geometry=require('./assert-web-geometry.cjs');
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
  runFrames(32);
  assert(s().camera.zoom>beforeHop.camera.zoom*1.35,'even a tap between equal-sized neighbours travels into the map');
  assert(s().particles[0].visualRadius>standard*1.35,'the tapped bubble follows the forward zoom');
  runFrames(36);
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
