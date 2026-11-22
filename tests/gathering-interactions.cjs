const assert=require('node:assert/strict'),{boot}=require('./galaxy-harness.cjs'),C=require('../dist/connection-layout.js'),P=require('../dist/physics.js');
for(const [width,height]of [[320,568],[390,844],[844,390],[280,200],[1440,900]])for(const count of [0,6,19,500]){
 const l=C.collective(width,height,count),p=[l.center,...l.slots.slice(0,Math.min(count,l.capacity))].map(p=>({...p,scale:1}));assert.equal(l.slots.length,count);
 if(l.contained)for(const a of p){const r=P.radius(a);assert(a.x-r>=l.bounds.left&&a.x+r<=l.bounds.right);assert(a.y-r>=l.bounds.top&&a.y+r<=l.bounds.bottom);}
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++)assert(Math.hypot(p[i].x-p[j].x,p[i].y-p[j].y)>P.radius(p[i])+P.radius(p[j])+3);
}
for(const [width,height,reduced]of [[320,568,false],[390,844,false],[844,390,false],[1440,900,false],[390,844,true]]){
 const h=boot({width,height,reduced,layers:true}),{window,$,runFrames,pointer}=h,inspect=()=>window.SozApp.inspect();
 const model=window.WordWeb.createModel(window.WORD_WEB_DATA,window.WORD_WEB_EXTRA,window.WORD_WEB_GRAMMAR,window.WORD_WEB_VOCABULARY,window.WORD_WEB_REVIEW,window.WORD_WEB_BILINGUAL,window.WORD_WEB_EXPANSION,window.WORD_WEB_NOMINAL,window.WORD_WEB_ADDITIONS,window.WORD_WEB_RELATIONS);
 const fixed=JSON.stringify(window.WORD_GALAXY_DATA.points);
 function separated(){const p=inspect().particles;for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++)assert(Math.hypot(p[i].x-p[j].x,p[i].y-p[j].y)>=p[i].r+p[j].r-.001);}
 function settled(){const s=inspect(),b=s.focusBounds;for(const p of s.particles){assert(p.x-p.r>=b.left-3&&p.x+p.r<=b.right+3,p.word+' horizontal');assert(p.y-p.r>=b.top-3&&p.y+p.r<=b.bottom+3,p.word+' vertical');}separated();}
 for(const word of ['gözəl','çirkin','həmişə','daim','dopamin','sənət']){
  window.SozApp.selectWord(word);assert(inspect().particles.some(p=>p.word===word),'Selection renders immediately during the flight');
  runFrames(150,separated);settled();const expected=C.relationships(model.related(model.byWord.get(word))).map(r=>r.node.w),seen=new Set();
  const selected=window.document.querySelector('.word-node.selected');assert(selected.querySelector('.selection-orbit').getAttribute('stroke-dasharray'));assert.equal(selected.querySelector('.bubble').getAttribute('fill'),'#ecaa6b');
  assert.equal(inspect().particles.length,Math.min(expected.length,inspect().connectionCapacity)+1);
  for(const r of expected.slice(0,inspect().connectionCapacity))assert(inspect().particles.some(p=>p.word===r),'Nearest documented connections must be visible: '+r);
  while(true){for(const p of inspect().particles)if(p.word!==word)seen.add(p.word);if($('connectionsNext').disabled)break;$('connectionsNext').click();runFrames(150,separated);settled();}
  assert.deepEqual([...seen].sort(),[...expected].sort(),'Gathering must expose every direct relation exactly, without invented links');
  assert.equal($('connectionPager').hidden,expected.length<=inspect().connectionCapacity);
 }
 // All 19 connections, including the distant opposite cluster, fit a normal phone.
 if(width===390){window.SozApp.selectWord('gözəl');runFrames(150,separated);assert.equal(inspect().connectionPages,1);assert(inspect().particles.some(p=>p.word==='çirkin'));}
 window.SozApp.selectWord('həmişə');runFrames(150,separated);const p=inspect().particles.find(p=>p.word==='daim'),bubble=window.document.querySelector('[data-word="daim"]');assert(p&&bubble);pointer('pointerdown',91,p.x,p.y,bubble);pointer('pointermove',91,p.x+75,p.y+60);separated();pointer('pointerup',91,p.x+75,p.y+60);runFrames(150,separated);settled();
 $('universeButton').click();runFrames(150);assert.equal(inspect().view,'universe');assert.equal(inspect().particles.length,0);assert($('connectionPager').hidden);assert.equal(JSON.stringify(window.WORD_GALAXY_DATA.points),fixed);assert.equal(h.errors.length,0);
 console.log(`PASS: gathering at ${width}×${height}${reduced?' reduced motion':''}; vibrant selection, real neighbors prioritized, all connections reachable, collision-free arrivals/dragging and preserved permanent coordinates.`);
}
