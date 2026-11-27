const assert = require('node:assert/strict');
const {boot} = require('./galaxy-harness.cjs');

const phone = boot({width:390,height:844});
const {$,window,runFrames,runUntilIdle,resize,pointer} = phone;
const state = () => window.SozApp.inspect();
const card = $('meaningCard');
function finishTrip(word) {
  let landed = state();
  for (let i=0; i<80 && landed.cameraTravelling; i++) {
    runFrames(1); landed=state();
  }
  assert.equal(landed.cameraTravelling,false,'The original flight finishes without restarting');
  const home=landed.screenPositions.find(p=>p.word===word);
  assert(Math.hypot(home.x-landed.focusCenter.x,home.y-landed.focusCenter.y)<.01,'The map lands on the actual word in the resized viewport');
  assert(!card.classList.contains('flight-arrival'));
  runUntilIdle();
}

window.SozApp.selectWord('gözəl');
assert.equal($('meaningEnglish').textContent,'beautiful');
assert.equal(Number(card.style.getPropertyValue('--card-reveal')),0,'The definition is available while its visual appearance waits for the camera');
assert.equal($('mapFilterKeys').querySelectorAll('button').length,5);
runFrames(15);
for (const h of [832,810,789,775]) {
  resize(390,h);
  const moving=state();
  assert(moving.cameraTravelling,'A mobile address-bar resize must not cancel a tap');
  assert(moving.particles.slice(1).every(p=>p.waiting),'A resize must not release the whole family at once');
}
assert(Number($('bubbles').querySelector('.surrounding-words').getAttribute('opacity'))<.2,'The foreground word is clear of background labels during the dive');
finishTrip('gözəl');

const peer=state().particles.find(p=>p.word==='çirkin');
pointer('pointerdown',1,peer.x,peer.y,$('bubbles').querySelector('[data-word="çirkin"]'));
pointer('pointerup',1,peer.x,peer.y);
runFrames(18);
resize(844,390);
assert(state().cameraTravelling,'A turn into landscape preserves the selected flight');
finishTrip('çirkin');
assert.equal($('meaningEnglish').textContent,'ugly');
assert.equal(Number($('bubbles').querySelector('.surrounding-words').getAttribute('opacity')),1);
assert.equal(phone.errors.length,0);
console.log('PASS phone viewport changes and rotation preserve the tap, its flight, the timed card reveal, and the final atlas location.');
