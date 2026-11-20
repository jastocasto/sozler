// DOM/gesture verification; real CSS rendering still requires browser QA.
const assert=require('node:assert/strict'),{boot}=require('./galaxy-harness.cjs');
for(const [width,height,reduced]of [[320,568,false],[390,844,false],[844,390,false],[1440,900,false],[370,650,true]]){
 const h=boot({width,height,reduced}),{$,window,runFrames,pointer,resize,frames,captures}=h,inspect=()=>window.SozApp.inspect();
 $('fitButton').click();runFrames(150);assert(inspect().particles.length>0);assert(inspect().particles.length<=(width<640?44:72));
 function separated(){const ps=inspect().particles;for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)assert(Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y)>=ps[i].r+ps[j].r-1e-3);}
 runFrames(90,separated);assert.equal($('sheetExtra').hidden,true);assert.equal($('meaningDefinition').lang,'az');assert.equal($('meaningEnglish').lang,'en');
 if(reduced){assert.equal(frames.size,0);window.SozApp.selectWord('kompüter');assert.equal(inspect().flight,false);assert.equal($('meaningWord').textContent,'kompüter');runFrames(3);assert.equal(frames.size,0);}else {runFrames(60);assert.equal(frames.size,0);}
 const before=inspect().camera.zoom;pointer('pointerdown',1,80,160);pointer('pointerdown',2,180,160);pointer('pointermove',2,230,160);pointer('pointerup',2,230,160);pointer('pointerup',1,80,160);runFrames(5);assert(inspect().camera.zoom>before);assert.equal(captures.size,0);separated();
 const word=inspect().selected;pointer('pointerdown',3,50,150);pointer('pointermove',3,90,180);pointer('pointercancel',3,90,180);runFrames(6);assert.equal(captures.size,0);assert.equal(inspect().selected,word);
 pointer('pointerdown',4,60,160);resize(height,width);assert.equal(captures.size,0,'Resize releases pointer capture');assert.equal($('graph').getAttribute('viewBox'),`${0} ${0} ${height} ${width}`);runFrames(10,separated);
 $('sheetToggle').click();assert.equal($('meaningCard').dataset.expanded,'true');assert(!$('sheetExtra').hidden);$('sheetToggle').click();assert($('sheetExtra').hidden);
 $('universeButton').click();runFrames(150);assert.equal(inspect().view,'universe');assert(inspect().camera.zoom>0);assert.equal(inspect().particles.length,0);
 console.log(`PASS: ${width}×${height}${reduced?' reduced motion':''}: bounded readable layer, frame-by-frame collision separation, compact bilingual sheet, pinch, pan/cancel, capture cleanup and portrait/landscape resizing.`);
}
