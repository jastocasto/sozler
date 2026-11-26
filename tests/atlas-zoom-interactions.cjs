const assert=require('node:assert/strict'),{boot}=require('./galaxy-harness.cjs');
for(const [width,height,reduced]of (process.env.SOZ_TEST_VIEWPORTS?JSON.parse(process.env.SOZ_TEST_VIEWPORTS):[[390,844,false],[1440,900,false],[390,844,true]])){
 const h=boot({width,height,reduced}),{window,$,runFrames,pointer,counts,frames}=h,s=()=>window.SozApp.inspect();
 if(reduced){
  $('fitButton').click();assert.equal(s().view,'word');assert(!s().cameraTravelling);
  const radius=s().particles[0].visualRadius;
  $('zoomIn').click();h.runUntilIdle();assert(s().particles[0].visualRadius>radius);
  $('universeButton').click();h.runUntilIdle();assert.equal(s().visible,h.model.nodes.length);
  assert.equal(s().particles.length,0);assert.equal(frames.size,0);
  console.log('PASS: reduced motion switches instantly between the fitted word and full atlas.');
  continue;
 }
 const original=JSON.stringify(window.WORD_GALAXY_DATA.points),points=window.WordGalaxy.createAtlas(window.WORD_GALAXY_DATA,h.model).byWord;
 function continuity(){const st=s(),project=window.WordGalaxy.transform(st.camera,width,height),glyphs=new Map(st.atlasGlyphs.map(v=>[v.word,v]));assert.equal(st.particles.length,0,'Zoom must not summon an unrelated physics layer');assert.equal(counts.arcs,glyphs.size,'Every canvas circle belongs to exactly one projected word');
  for(const v of glyphs.values()){const p=project(points.get(v.word));assert(Math.hypot(v.x-p.x,v.y-p.y)<1e-7);}
  for(const e of st.atlasLines){const a=project(points.get(e.a)),b=project(points.get(e.b));assert(a&&b);assert.equal(e.x1,a.x);assert.equal(e.y1,a.y);assert.equal(e.x2,b.x);assert.equal(e.y2,b.y);}
  for(const control of window.document.querySelectorAll('.atlas-word')){const v=glyphs.get(control.dataset.word),xy=control.getAttribute('transform').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);assert(v&&v.labelOpacity>0);assert(Math.hypot(v.x-xy[0],v.y-xy[1])<1e-7);assert.equal(Number(control.firstElementChild.getAttribute('r')),v.r);assert(!control.querySelector('.bubble'),'No duplicate visible SVG bubble');}
 }
 $('menuButton').click();$('regionDirectory').querySelector('[data-region="people"]').click();runFrames(120);continuity();
 // Zoom controls must retain the dots/circles throughout the animated camera travel.
 let steps=0;while(s().camera.zoom<.8&&steps++<12){$('zoomIn').click();runFrames(55,continuity,8);}assert(s().atlasGlyphs.some(v=>v.labelOpacity===1));assert(counts.texts,'Words are rendered inside their growing circles');assert.equal(frames.size,0,'Idle atlas does not animate or rerun collision work');
 const held=new Map(s().atlasGlyphs.map(v=>[v.word,v]));$('zoomOut').click();runFrames(55,continuity,8);$('zoomIn').click();runFrames(55,continuity,8);for(const v of s().atlasGlyphs){const old=held.get(v.word);if(old)assert(Math.hypot(v.x-old.x,v.y-old.y)+Math.abs(v.r-old.r)<1e-7,'Zooming back returns each circle to its exact position and size');}
 pointer('pointerdown',11,100,height/2);pointer('pointerdown',12,200,height/2);pointer('pointermove',12,215,height/2);runFrames(3);continuity();pointer('pointerup',12,215,height/2);pointer('pointerup',11,100,height/2);runFrames(3);continuity();assert.equal(h.captures.size,0);
 pointer('pointerdown',13,30,150);pointer('pointermove',13,45,165);runFrames(3);continuity();pointer('pointerup',13,45,165);runFrames(3);assert.equal(s().view,'explore');
 const before=s().atlasGlyphs.find(v=>v.labelOpacity>0&&v.x>=0&&v.x<=width&&v.y>=0&&v.y<=height);assert(before,'The explored map has a visible word hit target');
 // Two close wheel scales must preserve identity and the exact projected anchor.
 for(const deltaY of [2,-2]){const e=new window.Event('wheel',{bubbles:true,cancelable:true});Object.assign(e,{deltaY,clientX:before.x,clientY:before.y});$('graph').dispatchEvent(e);runFrames(3);continuity();assert(s().atlasGlyphs.some(v=>v.word===before.word));}
 const v=s().atlasGlyphs.find(v=>v.word===before.word),target=window.document.querySelector('.atlas-word[data-word="'+v.word+'"]')||$('graph');pointer('pointerdown',90,v.x,v.y,target);pointer('pointerup',90,v.x,v.y);runFrames(45);assert.equal(s().view,'word');assert.equal(s().selected,v.word);assert.equal($('meaningWord').textContent,v.word);assert(s().particles.some(p=>p.word===v.word));require('./assert-web-geometry.cjs')(s());
 $('universeButton').click();runFrames(120);continuity();assert.equal(s().visible,points.size);assert.equal(s().particles.length,0);assert.equal(frames.size,0);assert.equal(JSON.stringify(window.WORD_GALAXY_DATA.points),original);
 console.log(`PASS: ${width}×${height}${reduced?' reduced motion':''}: uninterrupted dot-to-word rendering during zoom travel, all line endpoints/hit targets aligned, real circle tap selects that word, magnetic mode preserved and idle atlas sleeps.`);
}
