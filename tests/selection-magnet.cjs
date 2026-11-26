const assert=require('node:assert/strict'),{boot}=require('./galaxy-harness.cjs'),C=require('../dist/connection-layout.js');
const viewports=process.env.SOZ_TEST_VIEWPORTS?JSON.parse(process.env.SOZ_TEST_VIEWPORTS):[[390,700,false],[1440,900,true]];
for(const [width,height,reduced]of viewports){
 const h=boot({width,height,reduced}),{$,window,runFrames,pointer,counts,input}=h,s=()=>window.SozApp.inspect();
 const coordinates=JSON.stringify(window.WORD_GALAXY_DATA.points),related=new Set(['zorakılıq','şiddət','təcavüz','zorakı','zor','zorlama']);
 function geometry(centered=true){require('./assert-web-geometry.cjs')(s(),{centered});}
 function selected(word='zorakılıq'){window.SozApp.selectWord(word);geometry();runFrames(36,()=>geometry());}
 selected();assert(s().cameraTravelling||reduced,'The selected word begins a continuous focus move');
 h.runUntilIdle(()=>geometry());
 const expected=new Set([s().selected,...s().relatedWords]);
 assert([...related].every(word=>expected.has(word)),'Known audited neighbors remain linked');
 assert.deepEqual(new Set(s().particles.map(p=>p.word)),expected);
 for(const id of ['zoomIn','zoomOut','fitButton']){$(id).click();h.runUntilIdle(()=>geometry());assert.deepEqual(new Set(s().particles.map(p=>p.word)),expected);}
 pointer('pointerdown',1,20,200);pointer('pointermove',1,21,201);pointer('pointerup',1,21,201);runFrames(10,()=>geometry());
 pointer('pointerdown',2,20,200);pointer('pointermove',2,100,250);pointer('pointerup',2,100,250);runFrames(10,()=>geometry());
 pointer('pointerdown',3,80,170);pointer('pointerdown',4,200,170);pointer('pointermove',4,255,170);pointer('pointerup',4,255,170);pointer('pointerup',3,80,170);runFrames(40,()=>geometry(),8);assert.equal(h.captures.size,0);
 for(const deltaY of [400,-400]){const e=new window.Event('wheel',{bubbles:true,cancelable:true});Object.assign(e,{deltaY,clientX:width/2,clientY:height/2});$('graph').dispatchEvent(e);if(s().view!=='word')$('fitButton').click();runFrames(40,()=>geometry(),8);}
 for(const key of ['+','-','ArrowLeft','ArrowDown']){const e=new window.Event('keydown',{bubbles:true});e.key=key;$('graph').dispatchEvent(e);if(s().view!=='word')$('fitButton').click();runFrames(40,()=>geometry(),8);}
 // A viewport resize and visibility transition preserve the gathered family.
 h.resize(width,height+100);runFrames(40,()=>geometry(),8);h.resize(width,height);runFrames(40,()=>geometry(),8);
 const dragged=s().particles.find(p=>p.word==='şiddət');pointer('pointerdown',5,dragged.x,dragged.y,window.document.querySelector('[data-word="şiddət"]'));pointer('pointermove',5,dragged.x+30,dragged.y+20);geometry(false);
 window.document.hidden=true;window.document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(h.captures.size,0);window.document.hidden=false;window.document.dispatchEvent(new window.Event('visibilitychange'));runFrames(40,()=>geometry(),8);
 // Rapid changes must replace the entire focused graph and cancel stale gestures.
 for(const word of ['kompüter','həmişə','zorakılıq']){window.SozApp.selectWord(word);runFrames(3,()=>geometry());}runFrames(40,()=>geometry(),8);
 input('search','zorakılıq');$('searchResults').firstElementChild.click();runFrames(40,()=>geometry(),8);assert.equal(s().selected,'zorakılıq');
 const peer=window.document.querySelector('[data-word="şiddət"]'),pp=s().particles.find(p=>p.word==='şiddət');pointer('pointerdown',6,pp.x,pp.y,peer);pointer('pointerup',6,pp.x,pp.y);runFrames(40,()=>geometry(),8);assert.equal(s().selected,'şiddət');$('backButton').click();runFrames(40,()=>geometry(),8);assert.equal(s().selected,'zorakılıq');
 window.location.hash='#w='+encodeURIComponent('zorakılıq');window.dispatchEvent(new window.Event('hashchange'));runFrames(40,()=>geometry(),8);
 $('universeButton').click();runFrames(150);assert.equal(s().view,'universe');assert.equal(s().particles.length,0);
 // Tap a real point in the overview: it must enter the same magnetic path.
 const row=window.WORD_GALAXY_DATA.points.find(p=>p[0]==='zorakılıq'),p=window.WordGalaxy.transform(s().camera,width,height)({x:row[1],y:row[2],z:row[3]});pointer('pointerdown',7,p.x,p.y);pointer('pointerup',7,p.x,p.y);runFrames(40,()=>geometry(),8);assert.equal(s().selected,'zorakılıq');
 if(width===390&&!reduced){for(const word of ['eləmək','etmək','məlumat','təsvirat','gözəl','çirkin','dil','kitab','tibb','mineral','riyaziyyat']){window.SozApp.selectWord(word);geometry();const allowed=new Set([word,...s().relatedWords]);for(const p of s().particles)assert(allowed.has(p.word),'An unrelated atlas bubble entered a focused group');}}
 assert.equal(JSON.stringify(window.WORD_GALAXY_DATA.points),coordinates);assert.equal(h.errors.length,0);
 console.log(`PASS: ${width}×${height}${reduced?' reduced motion':''}; zorakılıq and its documented neighbors, exact centering, continuous attraction, shared line/bubble positions, zoom/pinch/wheel/jitter/pan/cancel/resize/visibility, rapid changes, search/bubble/history/hash/point selection.`);
}
