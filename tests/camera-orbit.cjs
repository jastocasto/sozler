// Orbiting the atlas changes the projection only. Dynamic links and word bubbles
// still use the same world anchors throughout camera movement.
const assert = require('node:assert/strict');
const G = require('../dist/galaxy.js');
const {boot} = require('./galaxy-harness.cjs');
const bounds = {minX:-37000,maxX:53000,minY:-30000,maxY:35000};
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
 assert(toggle&&!toggle.hidden);assert.equal(toggle.getAttribute('aria-pressed'),'false');
 toggle.click();assert.equal(toggle.getAttribute('aria-pressed'),'true');
 key(toggle,'ArrowRight');key(graph,'ArrowUp');runFrames(3);
 let state=inspect();
 const rotatedButtons=regionButtons();
 assert(rotatedButtons.size>0);
 for(const [region,button] of rotatedButtons)assert.equal(button,initialButtons.get(region),'orbit preserves focusable region controls');
 assert(state.orbitMode);assert(state.camera.angle>initial.angle&&state.camera.tilt>initial.tilt);assert.equal(state.camera.zoom,initial.zoom);
 pointer('pointerdown',1,100,300);pointer('pointermove',1,155,320);pointer('pointerup',1,155,320);runFrames(2);
 const rotated=inspect().camera;assert(rotated.angle>state.camera.angle&&rotated.tilt<state.camera.tilt);assert.equal(rotated.x,initial.x);assert.equal(rotated.y,initial.y);
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
