const assert=require('node:assert/strict'),E=require('../dist/race.js'),fs=require('fs'),vm=require('vm'),s={window:{}};vm.runInNewContext(fs.readFileSync('dist/race-data.js','utf8'),s);const bank=s.window.WORD_RACE_DATA,c=E.daily(bank,new Date('2026-11-16T12:00:00Z'));assert.deepEqual(c,E.daily(bank,new Date('2026-11-16T19:59:00Z')));assert.notEqual(c.id,E.daily(bank,new Date('2026-11-16T20:00:00Z')).id);const state=E.begin(c,1000);assert(!E.tap(state,'hidden',false,1100));assert.equal(state.taps,0);assert(E.tap(state,c.start,true,1200));assert(E.tap(state,c.target,true,1400));assert(E.tap(state,c.start,true,1500,true));assert.equal(state.taps,3);assert(E.tap(state,'unrelated visible word',true,1550));assert.equal(state.taps,4);assert.equal(E.finish(state,c.target,false,1600),null);const score=E.finish(state,c.target,true,2000);assert.equal(score.ms,1000);assert.equal(score.taps,4);assert(!E.tap(state,c.target,true,2100));const betterTime={...score,ms:500,taps:6},betterTaps={...score,ms:3000,taps:2};let ranks=E.rank(null,score);ranks=E.rank(E.rank(ranks,betterTime),betterTaps);assert.equal(ranks.time.ms,500);assert.equal(ranks.taps.taps,2);console.log('PASS daily Baku rollover, hidden-word rejection, every word/Back tap counted, center-before-finish, and independent time/tap rankings.');

const p1=E.practice(bank,c,()=>0,new Date('2026-11-16T12:00:00Z'));assert.equal(p1.mode,'practice');assert.notEqual(p1.id,c.id);assert(![c.start,c.target].includes(p1.start));assert(![c.start,c.target].includes(p1.target));const p2=E.practice(bank,p1,()=>0,new Date(),[p1.id]);assert.notEqual(p2.id,p1.id);assert(![p1.start,p1.target].includes(p2.start));assert(![p1.start,p1.target].includes(p2.target));assert.deepEqual(c,E.daily(bank,new Date('2026-11-16T12:00:00Z')));console.log('PASS repeatable Daily challenge and fresh Practice pairs, separate score IDs, new words and recent-pair avoidance.');

const dayMs = 86400000;
const rotationStart = Date.UTC(2026, 10, 27) / dayMs;
const atNoon = day => new Date(day * dayMs + dayMs / 2);
const atlasBank = {...bank, dailyMap: [{start: 'a', target: 'b', route: 'map'}], rotationStep: 1};
assert.equal(E.daily(atlasBank, atNoon(rotationStart - 2)).start, bank.challenges[(rotationStart - 2) % bank.challenges.length].start);
const visited = new Set();
for (let offset = 0; offset < bank.challenges.length * 2; offset++) {
 const day = rotationStart + offset;
 const route = E.daily(atlasBank, atNoon(day));
 if (offset % 2) {
  assert.equal(route.route, 'map');
 } else {
  const expected = bank.challenges[(rotationStart + offset / 2) % bank.challenges.length];
  assert.deepEqual([route.start, route.target], [expected.start, expected.target]);
  visited.add(route.start + '>' + route.target);
 }
 const withoutAtlas = E.daily(bank, atNoon(day));
 assert.deepEqual([withoutAtlas.start, withoutAtlas.target], [bank.challenges[day % bank.challenges.length].start, bank.challenges[day % bank.challenges.length].target]);
}
assert.equal(visited.size, bank.challenges.length);
console.log('PASS every authored daily route appears once per cycle, interleaved with atlas days.');
