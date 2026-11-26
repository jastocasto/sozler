const assert = require('node:assert/strict');
const {boot} = require('./galaxy-harness.cjs');

for (const reduced of [false, true]) {
  const h = boot({width: 1024, height: 800, reduced});
  const {$, window} = h;
  h.runUntilIdle();
  const panel = $('atlasRoutesPanel'), pulse = $('atlas-route-pulse');
  const defaultRoutes = Array.from(window.SozApp.inspect().atlasLanes, lane => 'pair-' + lane.route.from + '-' + lane.route.to);
  $('routesToggle').click();
  const control = [...panel.querySelectorAll('.route-pair')].find(b => !defaultRoutes.includes(b.dataset.routeControl));
  const key = control.dataset.routeControl;
  control.click();
  h.runUntilIdle();
  const lane = window.SozApp.inspect().atlasLanes.find(lane => 'pair-' + lane.route.from + '-' + lane.route.to === key);
  assert(lane, 'the selected pair is painted even when absent from the default routes');
  assert.equal(pulse.children.length, reduced ? 0 : 2);
  if (!reduced) {
    assert.equal(pulse.style.getPropertyValue('--route-curve'), `path("M${lane.x1} ${lane.y1} Q${lane.cx} ${lane.cy} ${lane.x2} ${lane.y2}")`);
    assert(pulse.lastElementChild.classList.contains('return-pulse'));
    const draws = h.counts.frames;
    h.runFrames(90);
    assert.equal(h.counts.frames, draws, 'CSS pulses do not restart the canvas');
    for (const dot of [...pulse.children]) dot.dispatchEvent(new window.Event('animationend', {bubbles:true}));
    assert.equal(pulse.children.length, 0);
    h.resize(1024, 801);
    h.runUntilIdle();
    assert.equal(pulse.children.length, 0, 'repainting a selected route does not replay it');
    panel.querySelector('.route-back').click();
    h.runUntilIdle();
    panel.querySelector('[data-route-control="' + key + '"]').click();
    h.runUntilIdle();
    assert.equal(pulse.children.length, 2);
  }
  $('routesToggle').click();
  h.runUntilIdle();
  assert.equal(pulse.children.length, 0);
  assert.deepEqual(h.errors, []);
}
console.log('PASS: a selected region pair pulses once on its painted curve, sleeps, and respects dismissal and reduced motion.');
