const assert = require('node:assert/strict');
const {assessMeaning, assessHeadword, englishCue} = require('../dist/study-answer.js');

const comment = {w:'şərh', az:'Bir məsələ barədə bildirilən fikir.', en:'A comment, commentary, or explanation, depending on context.',
  bilingualSenses:[{az:'Paylaşımın altında yazılan fikir.', en:'A comment on an online post.'}]};
const beautiful = {w:'gözəl', az:'Görünüşcə və ya keyfiyyətcə xoş olan.', en:'beautiful'};
const savings = {w:'qənaət', en:'economy, saving (frugal use of resources)', bilingualSenses:[{en:'conclusion'}]};
const joke = {w:'mırta', en:'For a laugh, for fun, or as a joke.'};
const otherWord = {w:'rəy', en:'opinion'};
const model = {
  byWord:new Map([comment,beautiful,otherWord].map(node => [node.w,node])),
  formsByWord:new Map([['gözəllər',['gözəl']]]),
  resolveWord(word) {
    return this.byWord.get(word) || (['guzel','gözəllər'].includes(word) ? beautiful : undefined);
  },
  related:() => []
};

assert.equal(assessMeaning(comment,'It means a comment.',model).kind,'match');
assert.equal(assessMeaning(comment,'an online comment',model).sense.en,'A comment on an online post.');
assert.equal(assessMeaning(comment,'Paylaşımın altında yazılan fikir',model).kind,'match');
assert.equal(assessMeaning(savings,'conclusion',model).kind,'match');
assert.equal(assessMeaning(joke,'for fun',model).kind,'match');
assert.equal(assessMeaning(beautiful,'lovely',model).kind,'close');
assert.equal(assessMeaning(beautiful,'not beautiful',model).kind,'unmatched');
assert.equal(assessMeaning({w:'animal', en:'A small, furry mammal.'},'small',model).kind,'unmatched');
assert.equal(assessMeaning({w:'enmək', en:'to go down after the signal'},'go down before the signal',model).kind,'unmatched');

assert(assessHeadword(beautiful,'guzel',model));
assert(assessHeadword(beautiful,'Gözəl!',model));
assert(!assessHeadword(beautiful,'gözəllər',model));
assert(!assessHeadword(comment,'rəy',model));
assert.equal(englishCue({w:'Bakı', en:'Bakı', bilingualSenses:[{en:'Bakı is the capital of Azerbaijan.'}]}),
  '___ is the capital of Azerbaijan.');
assert.equal(englishCue({w:'radio', en:'radio'}),'');
console.log('PASS bilingual and secondary-sense guesses, approximate matches, reversal and negation checks, headword spelling, and English cues without the answer.');
