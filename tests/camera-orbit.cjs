// Orbiting the atlas changes the projection only. Dynamic links and word bubbles
// still use the same world anchors throughout camera movement.
const assert = require('node:assert/strict');
const G = require('../dist/galaxy.js');
const {boot} = require('./galaxy-harness.cjs');
const bounds = {minX:-37000,maxX:53000,minY:-30000,maxY:35000};
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
assert.equal(G.touchTurn({angle:0,distance:80},{angle:.025,distance:84}),0,'fingertip jitter does not turn the map');
assert.equal(G.touchTurn({angle:.3,distance:12},{angle:1,distance:20}),0,'a nearly coincident pair has no stable angle');
assert(Math.abs(G.touchTurn({angle:Math.PI-.06,distance:90},{angle:-Math.PI+.14,distance:95})-.20)<1e-10);

function checkTwoFingers(h,width,height,initial){
 const {$,window,pointer,runFrames}=h,read=()=>window.SozApp.inspect();
 const start={x:width*.48,y:height*.52},centre={x:start.x+21,y:start.y-17};
 const span=45,scale=1.4,turn=Math.PI/4;
 const left={x:centre.x-span*scale*Math.cos(turn),y:centre.y-span*scale*Math.sin(turn)};
 const right={x:2*centre.x-left.x,y:2*centre.y-left.y};
 const world=G.unproject(start,initial,width,height);
 const underRight=G.unproject({x:start.x+span,y:start.y},initial,width,height);
 const beforeFrames=h.counts.frames;
 assert(!$('map').classList.contains('touch-explored'));
 pointer('pointerdown',21,start.x-span,start.y);
 pointer('pointerdown',22,start.x+span,start.y);
 pointer('pointermove',22,start.x+span+1,start.y+1);
 assert.equal(read().camera.roll,initial.roll,'a small wiggle preserves the bearing');
 assert(!$('map').classList.contains('touch-explored'),'a brief two-finger tap keeps the touch hint');
 pointer('pointermove',21,left.x,left.y);
 pointer('pointermove',22,right.x,right.y);
 const live=read().camera,project=G.transform(live,width,height);
 assert(!read().orbitMode,'turning needs no mode switch');
 assert($('map').classList.contains('touch-explored'));
 assert(Math.abs(angleDifference(live.roll,initial.roll)-turn)<1e-8);
 assert(Math.abs(live.zoom/initial.zoom-scale)<1e-8);
 assert(Math.hypot(project(world).x-centre.x,project(world).y-centre.y)<1e-6,'the original midpoint stays under the two fingertips');
 assert(Math.hypot(project(underRight).x-right.x,project(underRight).y-right.y)<1e-6,'zoom and twist follow the fingers on the map plane');
 assert.equal(h.counts.frames,beforeFrames,'touch events do not synchronously repaint the galaxy');
 runFrames(1);
 assert.equal(h.counts.frames,beforeFrames+1,'simultaneous pan, zoom and rotation share one projected frame');
 assert(!$('viewport').hasAttribute('transform'));
 assert(!$('atlasLabels').style.transform,'geographic labels remain upright');
 const frame=read(),[name,worldX,worldY,worldZ]=window.WORD_GALAXY_DATA.points[0];
 const actual=frame.screenPositions.find(word=>word.word===name),expected=project({x:worldX,y:worldY,z:worldZ});
 assert(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-6,'the visible atlas tracks the live camera before release');
 pointer('pointerup',22,right.x,right.y);
 assert.deepEqual(read().camera,live,'the committed pose matches the displayed pose');
 pointer('pointermove',21,left.x+19,left.y+11);
 const continued=read().camera;
 assert.equal(continued.roll,live.roll);assert.equal(continued.zoom,live.zoom);
 const anchor=G.unproject(left,live,width,height),moved=G.transform(continued,width,height)(anchor);
 assert(Math.hypot(moved.x-left.x-19,moved.y-left.y-11)<1e-6,'one remaining finger continues the pan');
 pointer('pointerup',21,left.x+19,left.y+11);
 assert.equal(read().view,'explore','lifting the final finger does not select a word');
 assert.equal(h.captures.size,0);
 // Interrupt a combined gesture after its first actual turn. Stray events from
 // the second finger must neither change the camera nor select a nearby word.
 pointer('pointerdown',31,start.x-span,start.y);pointer('pointerdown',32,start.x+span,start.y);
 pointer('pointermove',32,right.x,right.y);
 const interrupted=read().camera;
 pointer('pointercancel',32,right.x,right.y);pointer('pointermove',31,0,0);pointer('pointerup',31,0,0);
 assert.deepEqual(read().camera,interrupted);assert.equal(h.captures.size,0);assert(!read().pinching);assert.equal(read().view,'explore');
 const finger=G.unproject(start,interrupted,width,height);
 pointer('pointerdown',34,start.x,start.y);pointer('pointerup',34,start.x+37,start.y-13);
 const flick=G.transform(read().camera,width,height)(finger);
 assert(Math.hypot(flick.x-start.x-37,flick.y-start.y+13)<1e-6,'a final displacement delivered on release still pans');
 assert.equal(read().view,'explore');
 $('universeButton').click();h.runUntilIdle();
}
for(const [width,height] of [[390,844],[1440,900]]){
 const home = G.overview({bounds},width,height);
 const near = {x:home.x,y:home.y,z:300}, far = {...near,z:-300};
 const separation = camera => {
  const project = G.transform(camera,width,height), a = project(near), b = project(far);
  return {x:a.x-b.x,y:a.y-b.y};
 };
 const xy = separation(home), yawed = separation(G.orbit(home,Math.PI/2,0)), pitched = separation(G.orbit(home,0,-.4));
 assert(Math.hypot(xy.x,xy.y)>15,'elevation is visible even on a phone');
 assert(Math.abs(xy.x*yawed.y-xy.y*yawed.x)/Math.hypot(xy.x,xy.y)>4,'changing bearing reveals horizontal parallax');
 assert(Math.hypot(xy.x-pitched.x,xy.y-pitched.y)>6,'changing tilt reveals vertical parallax');
 for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI]){
  for(const tilt of [-10,.4,10]){
   const cam = G.orbit(home,yaw,tilt);
   assert(cam.tilt>=-.10&&cam.tilt<=.94);
   for(const z of [-375,0,375])for(const zoom of [.003,.03,.9,6]){
    const p={x:cam.x+1120,y:cam.y-310,z},before={...cam,zoom};
    const pixel=G.transform(before,width,height)(p), restored=G.unproject(pixel,before,width,height,z);
    assert(Math.hypot(p.x-restored.x,p.y-restored.y)<1e-7);
    const after=G.zoomAt(before,pixel,zoom*1.4,width,height,z);
    const anchored=G.transform(after,width,height)(p);
    assert(Math.hypot(anchored.x-pixel.x,anchored.y-pixel.y)<1e-7,'zoom follows the picked elevation');
   }
  }
 }
 assert(Math.abs(G.angleBetween(Math.PI-.02,-Math.PI+.02,.5)-Math.PI)<1e-7,'travel takes the short way across north');
}
for(const [width,height,reduced] of [[390,844,true],[1440,900,false]]){
 const h=boot({width,height,reduced}), {$,window,pointer,runFrames}=h;
 const inspect=()=>window.SozApp.inspect(), toggle=$('orbitToggle'), graph=$('graph');
 const key=(el,key)=>{const e=new window.Event('keydown',{bubbles:true,cancelable:true});e.key=key;el.dispatchEvent(e);};
 const first=inspect(),initial=first.camera;
 const regionButtons=()=>new Map([...$('atlasLabels').querySelectorAll('[data-region]')].map(button=>[button.dataset.region,button]));
 const initialButtons=regionButtons(), boxes=[];
 assert.equal(initialButtons.size,window.WORD_GALAXY_DATA.regions.length,'all region names have room at these viewport sizes');
 const project=G.transform(initial,width,height);
 for(const region of window.WORD_GALAXY_DATA.regions){
  const button=initialButtons.get(region.id),style=button.style;
  const w=parseFloat(style.width),h=parseFloat(style.height),x=parseFloat(style.left)-w/2,y=parseFloat(style.top)-h/2;
  assert(boxes.every(b=>x+w<=b.x||x>=b.x+b.w||y+h<=b.y||y>=b.y+b.h),'callouts do not overlap');
  boxes.push({x,y,w,h});
  const leader=button.querySelector('.atlas-leader');
  if(!leader.hidden){
   const line=leader.style,length=parseFloat(line.width),angle=parseFloat(line.transform.slice(7));
   const end={x:x+parseFloat(line.left)+length*Math.cos(angle),y:y+parseFloat(line.top)+length*Math.sin(angle)};
   const anchor=project(region);
   assert(Math.hypot(end.x-anchor.x,end.y-anchor.y)<3,'leader ends at the actual projected region centre');
  }
 }
 if(height>width){
  let top=Infinity,bottom=-Infinity,left=Infinity,right=-Infinity;
  for(const p of first.screenPositions){top=Math.min(top,p.y);bottom=Math.max(bottom,p.y);left=Math.min(left,p.x);right=Math.max(right,p.x);}
  assert(bottom-top>height*.66&&right-left>width*.75,'portrait galaxy fills the chart in both dimensions');
  assert(top>=0&&left>=0&&right<=width&&bottom<=height,'every word fits');
 }
 checkTwoFingers(h,width,height,initial);
 assert(toggle&&!toggle.hidden);assert.equal(toggle.getAttribute('aria-pressed'),'false');
 toggle.click();assert.equal(toggle.getAttribute('aria-pressed'),'true');
 key(toggle,'ArrowRight');key(graph,'ArrowUp');runFrames(3);
 let state=inspect();
 const rotatedButtons=regionButtons();
 assert(rotatedButtons.size>0);
 for(const [region,button] of rotatedButtons)assert.equal(button,initialButtons.get(region),'orbit preserves focusable region controls');
 assert(state.orbitMode);assert(state.camera.angle>initial.angle&&state.camera.tilt>initial.tilt);assert.equal(state.camera.zoom,initial.zoom);
 pointer('pointerdown',1,100,300);pointer('pointermove',1,155,320);pointer('pointerup',1,155,320);runFrames(2);
 const rotated=inspect().camera,screenDrag=G.touchOrbit(state.camera,55,20,width,height);
 assert.deepEqual({...rotated},screenDrag);assert.equal(rotated.x,initial.x);assert.equal(rotated.y,initial.y);
 assert(rotated.angle>state.camera.angle);
 if(height>width)assert(rotated.tilt>state.camera.tilt,'a touch drag follows the portrait roll');
 else assert(rotated.tilt<state.camera.tilt);
 toggle.click();pointer('pointerdown',2,70,270);pointer('pointermove',2,120,310);pointer('pointerup',2,120,310);runFrames(2);
 state=inspect();assert(!state.orbitMode);assert(state.camera.x!==initial.x);assert.equal(state.camera.angle,rotated.angle);
 key(graph,'Home');h.runUntilIdle();assert.deepEqual(inspect().camera,initial);
 if(reduced){
  $('menuButton').click();$('regionDirectory').querySelector('[data-region="people"]').click();
  assert.equal(inspect().view,'region');assert(!toggle.hidden);toggle.click();assert(inspect().orbitMode);
  key(toggle,'ArrowRight');runFrames(2);assert.equal(inspect().view,'explore');
  key(graph,'Home');assert.equal(toggle.getAttribute('aria-pressed'),'false');
 }
 toggle.click();window.SozApp.selectWord('şallaq');assert(toggle.hidden);assert(!inspect().orbitMode);
 h.runUntilIdle();state=inspect();const chosen=state.particles.find(p=>p.word==='şallaq');assert(Math.hypot(chosen.x-state.focusCenter.x,chosen.y-state.focusCenter.y)<.001);
 assert.equal(h.errors.length,0);
 console.log('PASS orbit, pan, keyboard reset, focused-word centering and finite inverse at '+width+'×'+height+(reduced?' with reduced motion':''));
}
