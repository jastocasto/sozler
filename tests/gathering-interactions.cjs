const assert=require('node:assert/strict'),{boot}=require('./galaxy-harness.cjs'),C=require('../dist/connection-layout.js'),P=require('../dist/physics.js');
for(const [width,height]of [[320,568],[390,844],[844,390],[280,200],[1440,900]])for(const count of [0,6,19,500]){
 const l=C.collective(width,height,count),p=[l.center,...l.slots.slice(0,Math.min(count,l.capacity))].map(p=>({...p,scale:1}));assert.equal(l.slots.length,count);
 if(l.contained)for(const a of p){const r=P.radius(a);assert(a.x-r>=l.bounds.left&&a.x+r<=l.bounds.right);assert(a.y-r>=l.bounds.top&&a.y+r<=l.bounds.bottom);}
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++)assert(Math.hypot(p[i].x-p[j].x,p[i].y-p[j].y)>P.radius(p[i])+P.radius(p[j])+3);
}
// This test owns viewport layout and graph membership. The continuous-gathering test checks animated arrivals.
for(const [width,height]of [[320,568],[390,844],[844,390],[1440,900]]){
 const h=boot({width,height,reduced:true}),{window,$,runFrames,pointer}=h,inspect=()=>window.SozApp.inspect();
 const model=h.model;
 const fixed=JSON.stringify(window.WORD_GALAXY_DATA.points);
 function separated(){const p=inspect().particles;for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++)assert(Math.hypot(p[i].x-p[j].x,p[i].y-p[j].y)>=p[i].r+p[j].r-.001);}
 function settled(){const s=inspect(),b=s.focusBounds;if(s.contained)for(const p of s.particles){assert(p.x-p.r>=b.left-3&&p.x+p.r<=b.right+3,p.word+' horizontal');assert(p.y-p.r>=b.top-3&&p.y+p.r<=b.bottom+3,p.word+' vertical');}separated();}
 for(const word of ['gözəl','çirkin','həmişə','daim','dopamin','sənət']){
  window.SozApp.selectWord(word);assert(inspect().particles.some(p=>p.word===word),'Selection renders immediately during the flight');
  h.runUntilIdle(separated);settled();const expected=C.relationships(model.related(model.byWord.get(word))).map(r=>r.node.w),seen=new Set();
  const selected=window.document.querySelector('.word-node.selected');assert(selected.querySelector('.selection-orbit').getAttribute('stroke-dasharray'));assert.equal(selected.querySelector('.bubble').getAttribute('fill'),'#ecaa6b');
  for(const p of inspect().particles)if(p.word!==word)seen.add(p.word);
  assert.deepEqual([...seen].sort(),[...expected].sort(),'Gathering exposes every direct relation, without invented links');
  assert($('connectionPager').hidden);assert.equal(inspect().connectionPages,1);
 }
 // All 19 connections, including the distant opposite cluster, fit a normal phone.
 if(width===390){window.SozApp.selectWord('gözəl');runFrames(150,separated);assert.equal(inspect().connectionPages,1);assert(inspect().particles.some(p=>p.word==='çirkin'));}
 window.SozApp.selectWord('həmişə');runFrames(150,separated);const p=inspect().particles.find(p=>p.word==='daim'),bubble=window.document.querySelector('[data-word="daim"]');assert(p&&bubble);pointer('pointerdown',91,p.x,p.y,bubble);pointer('pointermove',91,p.x+75,p.y+60);separated();pointer('pointerup',91,p.x+75,p.y+60);h.runUntilIdle(separated);settled();
 $('universeButton').click();runFrames(150);assert.equal(inspect().view,'universe');assert.equal(inspect().particles.length,0);assert($('connectionPager').hidden);assert.equal(JSON.stringify(window.WORD_GALAXY_DATA.points),fixed);assert.equal(h.errors.length,0);
 console.log(`PASS: gathering at ${width}×${height}; vibrant selection, real neighbors prioritized, all connections reachable, collision-free arrivals/dragging and preserved permanent coordinates.`);
}
