const assert = require('node:assert/strict');
const {create, dayKey} = require('../dist/study-model.js');

class TestStorage {
  constructor() { this.data = new Map(); this.blocked = false; }
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i] ?? null; }
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k, v) {
    if (this.blocked) { const error = Error('full'); error.name = 'QuotaExceededError'; throw error; }
    this.data.set(k, String(v));
  }
}
let time = Date.parse('2026-11-27T09:00:00Z');
const repo = (storage = new TestStorage(), extra = {}) => create({storage, now:() => time, ...extra});
const answer = (r, id, key, channel, correct, more = {}) => r.record({id, kind:'word', key, channel, correct, ...more});
const atDay = day => { time = Date.parse(day + 'T09:00:00Z'); };
assert.equal(dayKey('2028-02-29T19:59:59Z'), '2028-02-29');
assert.equal(dayKey('2028-02-29T20:00:00Z'), '2028-03-01');

{
  const storage = new TestStorage(), r = repo(storage);
  assert.deepEqual(r.settings(), {minutes:20, speaking:true, newWords:10, startPage:'today'});
  assert.equal(r.word('gözəl'), null);
  assert.equal(r.summary(90856).unassessed, 90856);
  r.trackWord('gözəl');
  assert.equal(r.word('gözəl').rating, null);
  assert.equal(r.trackWord('gözəl'), false);
  r.rateWord('gözəl', 0); r.rateWord('gözəl', 1); r.rateWord('gözəl', 2); r.rateWord('gözəl', 3);
  assert.equal(r.rateWord('gözəl', 3), false);
  r.trackWord('görüş');
  assert.deepEqual(r.summary(90856).ratings, [0, 0, 0, 1]);
  assert.equal(r.summary(90856).unassessed, 90855);
  assert.equal(r.summary(90856).inLibraryUnrated, 1);
  assert.equal(r.summary().today.ratings, 1);
  assert.equal(r.summary().today.proficientChange, 1);
  r.rateWord('gözəl', 0);
  assert.equal(r.summary().today.proficientChange, 0);
  r.rateWord('gözəl', null);
  assert.deepEqual(r.summary().ratings, [0, 0, 0, 0]);
  assert.equal(r.summary(90856).unassessed, 90856);
  r.setSettings({minutes:25, speaking:false});
  r.setContext('gözəl', {text:'  Bu necə gözəl söhbətdir!  ', source:'https://example.org/audio', seconds:74});
  const reopened = repo(storage);
  assert.deepEqual(reopened.word('gözəl').context, {text:'Bu necə gözəl söhbətdir!', source:'https://example.org/audio', seconds:74});
  assert.deepEqual(reopened.settings(), {minutes:25, speaking:false, newWords:10, startPage:'today'}, 'Old routine settings get the new default word goal');
  const detached = reopened.word('gözəl');
  detached.context.text = 'changed'; detached.evidence.listen.correct = 9000;
  assert.equal(reopened.word('gözəl').evidence.listen.correct, 0);
  assert.equal(reopened.word('gözəl').context.text, 'Bu necə gözəl söhbətdir!');
  assert.equal(storage.data.size, 1, 'A tab writes one journal for the day');
  assert.throws(() => r.setContext('gözəl', {source:'javascript:alert(1)'}));
  assert.throws(() => r.setContext('gözəl', {source:'https://name:password@example.com/file'}));
  assert.throws(() => r.setContext('gözəl', {seconds:-1}));
  assert.throws(() => r.setContext('gözəl', {text:'A'.repeat(601)}));
  assert.throws(() => r.rateWord('gözəl', 4));
  assert.throws(() => r.setSettings({minutes:0}));
  const restored = repo();
  restored.importJSON(r.exportJSON());
  assert.equal(restored.settings().newWords, 10, 'An older backup gets the default deck target');
  r.setSettings({startPage:'atlas',newWords:7});
  assert.deepEqual(repo(storage).settings(), {minutes:25, speaking:false, newWords:7, startPage:'atlas'});
  restored.importJSON(r.exportJSON());
  assert.equal(restored.settings().newWords, 7, 'The deck target travels with the backup');
  assert.throws(() => r.setSettings({startPage:'settings'}));
}

{
  atDay('2026-11-27');
  const r = repo();
  r.rateWord('müzakirə', 2);
  answer(r, 'first', 'müzakirə', 'recall', true);
  assert.equal(r.word('müzakirə').due, '2026-11-28');
  assert.equal(answer(r, 'first', 'müzakirə', 'recall', true), false);
  answer(r, 'repeat', 'müzakirə', 'recall', true);
  assert.equal(r.word('müzakirə').due, '2026-11-28', 'Same-day repetition does not extend the interval');
  atDay('2026-11-28');
  answer(r, 'second', 'müzakirə', 'recall', true);
  assert.equal(r.word('müzakirə').due, '2026-12-01');
  atDay('2026-11-29');
  answer(r, 'early', 'müzakirə', 'recall', true);
  assert.equal(r.word('müzakirə').due, '2026-12-01', 'Early practice does not replace the delayed retrieval');
  atDay('2026-12-01');
  answer(r, 'delayed', 'müzakirə', 'recall', true);
  assert.equal(r.word('müzakirə').due, '2026-12-08');
  answer(r, 'heard', 'müzakirə', 'listen', false, {condition:'normal'});
  assert.equal(r.word('müzakirə').due, '2026-12-02', 'A weak listening channel is scheduled sooner');
  answer(r, 'immediate', 'müzakirə', 'listen', true, {condition:'slower'});
  assert.equal(r.word('müzakirə').due, '2026-12-02', 'A supported immediate retry still returns tomorrow');
  assert.equal(r.word('müzakirə').rating, 2, 'Exercise grades do not overwrite the learner’s own rating');
  atDay('2026-12-02');
  answer(r, 'easy', 'müzakirə', 'recognize', true, {condition:'transcript'});
  assert.equal(r.plan({kind:'word'})[0].channel, 'listen', 'Reading the transcript does not postpone the due listening cue');
  assert.equal(r.word('müzakirə').evidence.recall.days, 4);
  assert.equal(r.word('müzakirə').evidence.recall.attempts, 5);
  assert.equal(r.attempt('easy').condition, 'transcript');
  assert.equal(r.hasAttempt('easy'), true);
  assert.equal(r.attempt('missing'), null);
}

{
  atDay('2026-12-04');
  const r = repo();
  answer(r, 'a', 'məqam', 'recognize', true);
  answer(r, 'b', 'məqam', 'listen', true, {condition:'normal', selfReported:true});
  answer(r, 'c', 'məqam', 'listen', true, {condition:'replay'});
  answer(r, 'd', 'məqam', 'listen', true, {condition:'slower'});
  answer(r, 'e', 'məqam', 'listen', true, {condition:'normal'});
  answer(r, 'f', 'məqam', 'listen', true, {condition:'normal'});
  answer(r, 'g', 'məqam', 'use', true, {condition:'independent'});
  answer(r, 'h', 'məqam', 'use', true, {condition:'supported'});
  answer(r, 'i', 'interview:01', 'use', true, {kind:'lesson', condition:'independent'});
  const w = r.word('məqam'), today = r.summary().today;
  assert.equal(w.rating, null, 'Good quiz scores never assert proficiency');
  assert.deepEqual([w.evidence.listen.correct, w.evidence.listen.unaided, w.evidence.listen.unaidedDays, w.evidence.listen.selfReportedCorrect], [5, 2, 1, 1]);
  assert.deepEqual(w.evidence.listen.conditions.normal, {attempts:3, correct:3});
  assert.deepEqual([w.evidence.use.unaided, w.evidence.use.selfReported], [1, 2]);
  assert.deepEqual([today.attempts, today.words, today.lessons, today.firstListen, today.firstUse], [9, 1, 1, 1, 1]);
  atDay('2026-12-05');
  answer(r, 'j', 'məqam', 'listen', true, {condition:'normal'});
  answer(r, 'k', 'məqam', 'use', true, {condition:'independent'});
  assert.deepEqual([r.word('məqam').evidence.listen.unaidedDays, r.word('məqam').evidence.use.unaidedDays], [2, 2]);
  assert.equal(r.summary().today.firstListen, 0);
  assert.equal(r.summary().today.firstUse, 0);
  assert.deepEqual(r.summary().history.map(x => x.day), ['2026-12-04', '2026-12-05']);
  atDay('2026-12-06');
  answer(r, 'coached-1', 'debat', 'listen', true, {condition:'slower'});
  atDay('2026-12-07');
  answer(r, 'coached-2', 'debat', 'listen', true, {condition:'replay'});
  assert.equal(r.word('debat').due, '2026-12-08', 'Supported successes do not lengthen the first-pass listening interval');
}

{
  atDay('2026-12-04');
  const r = repo(), words = ['xəbər', 'məqam', 'mənbə', 'qərar', 'rəy'], lessons = ['clip-one', 'grammar-one', 'clip-two'];
  r.trackWord('gözəl'); r.trackWord('baxış');
  const agenda = r.plan({words, lessons, limit:4, newLimit:2});
  assert.deepEqual(agenda.map(item => item.reason), ['due', 'due', 'new', 'new']);
  assert.deepEqual(r.plan({words, lessons, limit:4, newLimit:2}), agenda);
  assert.deepEqual([...new Set(agenda.map(item => item.kind))], ['word', 'lesson']);
  assert.deepEqual(r.plan({words, lessons, limit:1, newLimit:0}).map(item => item.reason), ['due']);
  answer(r, 'reading', 'mənbə', 'recognize', true);
  answer(r, 'grammar', 'grammar-one', 'recall', true, {kind:'lesson'});
  const clips = r.plan({kind:'lesson', accept:(kind, key) => key.startsWith('clip-'), words, lessons, limit:1, newLimit:1});
  assert.equal(clips.length, 1, 'A grammar answer does not consume the listening budget');
  assert.equal(clips[0].kind, 'lesson'); assert(clips[0].key.startsWith('clip-'));
  r.record({id:'clip', kind:'lesson', key:clips[0].key, channel:'listen', correct:true, condition:'normal'});
  assert.deepEqual(r.plan({kind:'lesson', accept:(kind,key) => key.startsWith('clip-'), lessons, limit:1}), []);
  assert.deepEqual(r.plan({kind:'word', words, limit:1}), [], 'Distinct practiced words count once toward the word target');
  assert.equal(r.plan({kind:'word', words, limit:1, extra:true})[0].reason, 'due');
  atDay('2026-12-05');
  assert.equal(r.plan({kind:'lesson', accept:(kind, key) => key.startsWith('clip-'), lessons, limit:1})[0].reason, 'due');
  assert.equal(r.plan({words, lessons, limit:0}).length, 0);
}

{
  atDay('2026-12-08');
  const storage = new TestStorage(), first = repo(storage), second = repo(storage);
  first.trackWord('külək'); second.rateWord('dəniz', 2);
  answer(first, 'shared-task', 'külək', 'recall', false);
  answer(second, 'shared-task', 'külək', 'recall', true);
  first.refresh(); second.refresh();
  assert.deepEqual(first.summary(), second.summary());
  assert.deepEqual(first.words(), second.words());
  assert.equal(first.summary().today.attempts, 1, 'Concurrent journals count a question once');
  assert.equal(first.summary().tracked, 2);
  second.rateWord('külək', 1);
  first.refresh();
  assert.equal(first.word('külək').rating, 1);
  const independent = repo();
  independent.rateWord('başlıq', 3);
  const backup = first.exportJSON(), imported = independent.importJSON(backup);
  assert.equal(imported.added, JSON.parse(backup).events.length);
  assert.equal(independent.word('başlıq').rating, 3, 'A restore merges with existing work');
  assert.equal(independent.word('külək').rating, 1);
  assert.equal(independent.importJSON(backup).added, 0, 'Repeated restores are idempotent');
  const damaged = JSON.parse(backup);
  damaged.events.push({id:'broken', at:time, op:'rating',kind:'word',key:'a',value:14});
  const before = independent.exportJSON();
  assert.throws(() => independent.importJSON(JSON.stringify(damaged)));
  assert.equal(independent.exportJSON(), before, 'Invalid input does not partially merge');
  const conflict = JSON.parse(backup);
  conflict.events.find(e => e.op === 'answer').key = 'başqa';
  assert.throws(() => independent.importJSON(JSON.stringify(conflict)), /different study items/);
  assert.equal(independent.exportJSON(), before);
  assert.throws(() => independent.importJSON('{"version":2,"events":[]}'));
}

{
  atDay('2026-12-10');
  const storage = new TestStorage(), r = repo(storage);
  storage.blocked = true;
  answer(r, 'saved-later', 'söhbət', 'use', true, {condition:'independent'});
  assert.deepEqual(r.status(), {persistent:false, reason:'quota', pending:1});
  assert.equal(r.summary().today.attempts, 1, 'Storage failure still permits a session and backup');
  assert.equal(JSON.parse(r.exportJSON()).events.length, 1);
  storage.blocked = false; r.refresh();
  assert.deepEqual(r.status(), {persistent:true, reason:null, pending:0});
  assert.equal(repo(storage).hasAttempt('saved-later'), true);
  const memory = repo(null);
  memory.rateWord('səhər', 1);
  assert.deepEqual(memory.status(), {persistent:false, reason:'unavailable', pending:1});
  const stranded = new Map([['soz-toxumasi:study:v1:records', 'broken old backup']]);
  const fallback = {getItem:k => stranded.get(k) ?? null, setItem:(k,v) => stranded.set(k,v)};
  const incomplete = repo(fallback); incomplete.trackWord('qəzet');
  assert.equal(incomplete.status().reason, 'invalid-data');
  assert.equal(stranded.get('soz-toxumasi:study:v1:records'), 'broken old backup');
  stranded.set('soz-toxumasi:study:v1:records', memory.exportJSON());
  incomplete.refresh(); assert.equal(incomplete.status().persistent, true);
  assert.equal(repo(fallback).summary().tracked, 2);
  const limited = repo(new TestStorage(), {validWord:w=>w==='gözəl', validLesson:k=>k==='lesson-one'});
  assert.throws(() => limited.trackWord('yox'));
  assert.throws(() => limited.record({id:'r',kind:'lesson',key:'unavailable',channel:'recall',correct:true}));
  assert.equal(limited.plan({words:['yox','gözəl'], lessons:['no','lesson-one']}).length, 2);
  assert.deepEqual(limited.summary().ratings, [0,0,0,0]);
  const future = repo();
  future.rateWord('gözəl', 2);
  future.rateWord('future-headword', 3);
  answer(future, 'retired', 'lesson-retired', 'recall', true, {kind:'lesson'});
  limited.importJSON(future.exportJSON());
  assert.equal(limited.word('gözəl').rating, 2, 'Retired content cannot invalidate an otherwise good backup');
  assert.equal(limited.summary(1).assessed, 1);
  assert.deepEqual(limited.plan({limit:5, newLimit:0}), []);
  const newer = repo();
  newer.importJSON(limited.exportJSON());
  assert.equal(newer.word('future-headword').rating, 3, 'Unsupported records survive a backup round trip');
  assert.equal(newer.hasAttempt('retired'), true);
}

{
  atDay('2026-12-10');
  const storage = new TestStorage(), r = repo(storage);
  r.setSettings({newWords:4});
  const levels = ['çalar', 'təəssürat', 'təşəbbüs', 'gözəl'];
  assert(r.rateCard(levels[0], 0, 'new'));
  r.rateWord(levels[0], null);
  assert(r.rateCard(levels[0], 0, 'new'));
  assert.equal(r.summary().today.newCards, 1, 'Correcting a cleared rating does not count the same card twice');
  levels.slice(1).forEach((word, i) => assert(r.rateCard(word, i+1, 'new')));
  assert.equal(r.rateCard('əlavə', 1, 'new'), false, 'A direct deck URL cannot exceed the daily goal');
  assert.equal(r.rateCard('çalar', 0, 'new'), false);
  assert.deepEqual(r.summary().ratings, [1, 1, 1, 1]);
  assert.equal(r.summary().today.newCards, 4);
  assert.deepEqual(levels.map(word => r.word(word).due), ['2026-12-11','2026-12-13','2026-12-17',null]);
  assert.deepEqual(r.reviewCards({dueOnly:false}), levels.slice(0,3));
  assert.deepEqual(r.reviewCards(), []);
  const restored = repo();restored.importJSON(r.exportJSON());
  assert.equal(restored.summary().today.newCards, 4);
  assert.deepEqual(restored.reviewCards({dueOnly:false,level:3}), []);
  atDay('2026-12-11');
  assert.deepEqual(restored.reviewCards(), ['çalar']);
  assert.equal(restored.summary().dueCards, 1);
  assert(restored.rateCard('çalar', 3, 'review'));
  assert.equal(restored.word('çalar').due, null);
  assert.equal(restored.summary().today.reviewCards, 1);
  assert.equal(restored.rateCard('çalar', 0, 'review'), false);
  answer(restored, 'optional', 'gözəl', 'recognize', false);
  assert.equal(restored.word('gözəl').evidence.recognize.attempts, 1);
  assert.equal(restored.word('gözəl').due, null, 'Optional quiz evidence does not put a proficient word back in review');
  atDay('2026-12-19');
  assert(!restored.plan({kind:'word',words:levels,extra:true}).some(item => item.key==='gözəl'||item.key==='çalar'));
  restored.rateWord('gözəl', 1);
  assert(restored.reviewCards().includes('gözəl'), 'Lowering your own rating makes a word eligible again');
}

console.log('PASS personal ratings, daily flashcards, proficient-word retirement, evidence, spaced reviews, concurrent journals, backup recovery and storage failures.');
