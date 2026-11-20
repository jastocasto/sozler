const assert=require('node:assert/strict'),{boot}=require('./galaxy-harness.cjs');
for(const[width,height]of[[390,674],[320,568],[844,390],[1440,900]]){
 const h=boot({width,height,hash:'#grammar=yazmaq&t=1&p=0&n=0'}),{$,window,pointer,runFrames,input}=h,wheel=$('tenseWheel'),state=()=>window.SozApp.inspect().conjugation,meaning=()=>$('conjugationEnglish').textContent;
 assert.equal(meaning(),'I am writing');assert.equal($('fixedVerbStem').textContent,'yaz');assert.equal(window.document.querySelectorAll('.wheel-guide').length,1);assert(!window.document.querySelector('.conjugation-heading'));assert($('conjugationArchive').closest('.conjugation-header'));assert($('conjugationEnglish').closest('.conjugation-content'));assert.equal($('conjugationEnglish').lang,'en');
 pointer('pointerdown',1,180,300,wheel);pointer('pointermove',1,180,240,wheel);assert.equal(meaning(),'I wrote','English follows vertical drag before release');pointer('pointerup',1,180,240,wheel);runFrames(80);assert.equal(state().english,'I wrote');
 const finish=280-parseFloat(wheel.style.getPropertyValue('--suffix-width'))*.65;pointer('pointerdown',2,280,300,wheel);pointer('pointermove',2,finish,300,wheel);assert.notEqual(meaning(),'I wrote','English follows horizontal drag before release');pointer('pointerup',2,finish,300,wheel);runFrames(80);assert.equal(meaning(),'You wrote');assert.equal($('conjugationMeaningPerson').textContent,'you');
 $('conjugationNegative').click();assert.equal(meaning(),'You did not write');$('conjugationQuestion').click();assert.equal(meaning(),'Did you not write?');assert($('conjugationAnnouncement').textContent.includes('Did you not write?'));$('conjugationQuestion').click();$('conjugationPositive').click();
 $('tense-option-5').click();runFrames(80);assert.equal(meaning(),'You have written');$('tense-option-6').click();runFrames(80);assert.equal(meaning(),'You will write');$('conjugationPersons').children[4].click();runFrames(80);assert.equal(meaning(),'You will write');assert($('conjugationMeaningPerson').textContent.includes('plural'));
 input('conjugationVerb','qaçmaq');$('conjugationVerb').dispatchEvent(new window.Event('change'));assert.equal(meaning(),'You will run');$('tense-option-2').click();runFrames(80);assert.equal(meaning(),'You ran');
 input('conjugationVerb','blorbmaq');assert.equal(state().english,null);assert.equal(meaning(),'Choose a verb from the dictionary.');assert.equal($('conjugationEnglishNote').textContent,'');
 $('conjugationArchive').open=true;$('conjugationArchiveClose').click();assert(!$('conjugationArchive').open);$('conjugationBack').click();assert.equal(window.SozApp.inspect().page,'map');assert.equal(h.errors.length,0);console.log(`PASS: live English at ${width}×${height}, both swipe axes, persons, negative/question, verb changes, invalid input and archive return.`);
}

const { $,window,input }=boot({width:390,height:844,reduced:true,hash:'#grammar=köçürtmək&t=6&p=3'});
const state=()=>window.SozApp.inspect().conjugation;
assert.equal(state().form,'köçürdəcəyik');
assert.equal($('fixedVerbStem').textContent,'köçürd');
assert.equal($('conjugationEnglish').textContent,'We will have it moved');
assert.match($('conjugationEnglishNote').textContent,/We will copy it/);
assert.match($('conjugationSource').getAttribute('href'),/#page=40$/);
$('conjugationNegative').click();
assert.equal(state().form,'köçürtməyəcəyik');
assert.equal($('conjugationEnglish').textContent,'We will not have it moved');
$('conjugationPositive').click();
input('conjugationVerb','bitişdirmək');
$('conjugationVerb').dispatchEvent(new window.Event('change'));
assert.equal(state().form,'bitişdirəcəyik');
assert.equal($('conjugationEnglish').textContent,'We will join');
input('conjugationVerb','dartmaq');
$('conjugationVerb').dispatchEvent(new window.Event('change'));
assert.equal(state().form,'dartacağıq');
input('conjugationVerb','atmaq');
$('conjugationVerb').dispatchEvent(new window.Event('change'));
assert.equal(state().form,'atacağıq');
console.log('PASS screenshot reproduction, t/d alternation and unchanged lexical t, reviewed English alternatives, and whole-atlas English gloss fallback.');
