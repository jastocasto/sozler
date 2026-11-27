const assert = require('node:assert/strict');
const {boot} = require('./galaxy-harness.cjs');
const geometry = require('./assert-web-geometry.cjs');
const C = require('../dist/connection-layout.js');

for (const [width, height, reduced] of [[390,844,false], [1440,900,false], [390,844,true]]) {
  const h = boot({width,height,reduced});
  const {window,runFrames} = h;
  const state = () => window.SozApp.inspect();
  const dom = window.document;
  const edges = () => [...dom.querySelectorAll('#links .selected-edge')];
  const strength = el => Number(el.style.getPropertyValue('--arrival') || 1);
  window.SozApp.selectWord('irsiyyət');
  assert(state().relatedWords.includes('irs') && state().relatedWords.includes('irsi'));

  if (!reduced) {
    runFrames(60);
    assert(state().cameraTravelling);
    assert(state().particles.slice(1).every(p => p.waiting));
    runFrames(5);
    const staged = state(), center = staged.focusCenter, neighbors = staged.particles.slice(1);
    assert(!staged.cameraTravelling);
    assert(neighbors.every(p => p.waiting && p.visualRadius < 10), 'waiting words retain their small atlas glyphs');
    assert(edges().length && edges().every(e => strength(e) === 0), 'strings do not precede their words');
    assert(new Set(neighbors.map(p => p.releaseAt)).size > 1, 'the launches are staggered');
    assert(neighbors.some(p => Math.hypot(p.x-p.targetX,p.y-p.targetY) > 100));
    for (const p of neighbors) {
      const origin = staged.screenPositions.find(q => q.word === p.word);
      const dx = origin.x-center.x, dy = origin.y-center.y, distance = Math.hypot(dx,dy);
      const x = p.x-center.x, y = p.y-center.y;
      assert(dx*x+dy*y > 0, p.word + ' is on the same side as its atlas location');
      assert(Math.abs(dx*y-dy*x)/distance < p.visualRadius*2+2, p.word + ' keeps the projected bearing of its atlas location');
    }
    let streakSeen = false, stringGrowing = false;
    const starts = new Map(neighbors.map(p => [p.word,p]));
    runFrames(18, () => {
      geometry(state());
      streakSeen ||= !!dom.querySelector('.arrival-trail[d]');
      stringGrowing ||= edges().some(e => strength(e) > 0 && strength(e) < 1);
    });
    assert(streakSeen && stringGrowing, 'the flying words leave short trails as their strings appear');
    assert(state().particles.slice(1).some(p => Math.hypot(p.x-starts.get(p.word).x,p.y-starts.get(p.word).y)>25));
  }

  let inward = false, rebound = false, prior = state().particles[1];
  for (let i=0;i<180;i++) {
    runFrames(1);
    const {particles} = state(), current = particles[1], center = particles[0];
    const a = Math.hypot(prior.x-center.x,prior.y-center.y), b = Math.hypot(current.x-center.x,current.y-center.y);
    if (a-b>.3) inward=true;
    if (inward && b-a>.3) rebound=true;
    prior=current;
  }
  if (!reduced) assert(rebound, 'an arriving word rebounds after its inward flight');
  runFrames(420);
  const rest = state();
  geometry(rest);
  assert(rest.settled);
  for (const p of rest.particles) assert(Math.abs(p.visualRadius-rest.particles[0].visualRadius)<.01,p.word+' has an equal-sized bubble');
  assert(!dom.querySelector('.arrival-trail[d]') && edges().every(e => strength(e) === 1));
  for (const path of dom.querySelectorAll('#links path')) assert.equal(+path.getAttribute('stroke-width'),path.classList.contains('selected-edge')?4.05:.75);

  if (!reduced) {
    window.SozApp.selectWord('irs');
    const shared = state().particles.find(p => p.word === 'irsiyyət');
    assert(shared && !shared.waiting && Math.hypot(shared.x-rest.particles[0].x, shared.y-rest.particles[0].y)<.1, 'an existing word continues from its current bubble');
    runFrames(8);
    h.setReducedMotion(true);
    runFrames(1);
    const immediate = state();
    assert(immediate.settled && !immediate.cameraTravelling);
    assert(immediate.particles.every(p => !p.waiting));
    assert(!dom.querySelector('.arrival-trail[d]') && edges().every(e => strength(e) === 1));
    assert(Math.hypot(immediate.particles[0].x-immediate.focusCenter.x,immediate.particles[0].y-immediate.focusCenter.y)<.1);
  }
  console.log(`PASS ${width}×${height}${reduced?' reduced motion':''}: actual origin bearings, staggered release, trails and strings, rebound, equal resting sizes, shared neighbors and reduced motion.`);

  if (width===390 && !reduced) {
    h.setReducedMotion(false);
    window.SozApp.selectWord('qan');
    const slowFrameMs=125;
    for (let i=0;i<160&&h.frames.size;i++) runFrames(1,null,1,slowFrameMs);
    const landed=state(), radius=landed.particles[0].visualRadius;
    assert(landed.settled && !landed.cameraTravelling && h.frames.size===0);
    assert(landed.relatedWords.length>=80 && landed.particles.length===landed.relatedWords.length+1);
    for (const p of landed.particles) {
      assert(!p.waiting && Math.hypot(p.x-p.targetX,p.y-p.targetY)<.01,p.word+' reaches its resting slot');
      assert(Math.abs(p.visualRadius-radius)<.01,p.word+' reaches full size on a slow display');
    }
    geometry(landed);
    runFrames(3,null,1,slowFrameMs);
    assert.deepEqual(state().particles,landed.particles,'the entire family stays still after landing');
    console.log(`PASS ${landed.particles.length} bubbles reach full size, settle without overlap, and stop animating at 8 Hz.`);
  }
}

for (const [width,height] of [[320,568],[390,844],[1440,900]]) {
  const layout = C.collective(width,height,133);
  assert.equal(layout.slots.length,133);
  assert(layout.slots.every(p=>p.r===layout.center.r));
  for (let i=0;i<layout.slots.length;i++) for(let j=i+1;j<layout.slots.length;j++) {
    const a=layout.slots[i],b=layout.slots[j];
    assert(Math.hypot(a.x-b.x,a.y-b.y)>layout.center.r*2.2);
  }
}
console.log('PASS dense families retain equal-sized circles and expand their spatial layout.');
