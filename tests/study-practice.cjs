const assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const modelApi=require('../dist/study-model.js');
const practiceApi=require('../dist/study-practice.js');
const lesson=require('../dist/study-content.js')[0];

const {document,Event}=parseHTML('<html><body><main></main></body></html>').window;
const host=document.querySelector('main');
const store=new Map(),storage={
 get length(){return store.size;},
 key:i=>[...store.keys()][i],
 getItem:k=>store.get(k)??null,
 setItem:(k,v)=>store.set(k,String(v))
};
const clips=[{
 id:'native-sentence',az:'Onlar şəhərdə yaşayırlar.',en:'They live in the city.',word:'şəhər',wordEn:'city',surface:'şəhərdə',
 src:'study-audio/native.mp3',question:'Where do they live?',choices:['In the city','Outside the city','In two places'],answer:0,note:'The locative ending marks the place.'
}];
const byWord=new Map([['şəhər',{w:'şəhər',en:'city',az:'Şəhər yaşayış məntəqəsidir.'}],[lesson.word,{w:lesson.word,en:'contextual vocabulary'}]]);
const model={byWord};
const create=document.createElement.bind(document);
let sound,playCalls=0,blocked=false;
document.createElement=(name,...args)=>{
 const e=create(name,...args);
 if(name==='audio'){
  sound=e;e.pause=()=>{};
  e.play=()=>{playCalls++;if(blocked)return Promise.reject(new Error('Playback blocked'));e.onplaying?.();return Promise.resolve();};
 }
 return e;
};
const repo=modelApi.create({storage,now:()=>Date.parse('2026-11-27T15:00:00Z'),validWord:w=>byWord.has(w),validLesson:id=>clips[0].id===id||lesson.id===id});
let summary;
const mount=()=>practiceApi.mount({host,study:repo,model,lessons:[lesson],clips,storage,onFinish:result=>{summary=result;}});
let practice=mount();
function start(key,tasks){return practice.start({key,title:'Daily study',tasks});}
function findButton(label){return [...host.querySelectorAll('button')].find(b=>b.textContent===label);}
function click(label){const b=findButton(label);assert(b,'Missing '+label+' in '+host.textContent);assert(!b.disabled,'Disabled '+label);b.click();return b;}
function typeAnswer(value){
 const field=host.querySelector('input');assert(field&&!field.disabled);
 field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));
 host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
}
const audio={type:'listen',key:clips[0].id};
const sentence={type:'speak',source:'word',key:'şəhər'};
const check=repo.summary(byWord.size).today;
assert.equal(check.attempts,0);
assert.equal(practiceApi.normalized(' İNDİ,   şəhər!'),'indi şəhər');
assert.notEqual(practiceApi.normalized('şəhər'),practiceApi.normalized('seher'));

// A complete playback, not pressing Play or seeing the transcript, unlocks the listening answer.
start('daily-listen',[audio,sentence]);
assert(host.querySelector('.practice-option').disabled);
click('Play at normal speed');
assert.equal(playCalls,1);assert(host.querySelector('.practice-option').disabled);
assert(!host.textContent.includes(clips[0].az));
sound.onended();const yes=click('In the city');
assert.equal(repo.lesson(clips[0].id).evidence.listen.unaided,1);
yes.click();assert.equal(repo.summary(byWord.size).today.attempts,1);
assert(host.textContent.includes(clips[0].az));assert(host.textContent.includes('First listen at normal speed'));
click('Add şəhər to my library');assert(repo.word('şəhər'));
practice.close();practice=mount();
// Reload with a recalculated plan: the runner keeps its original queue and scored feedback.
start('daily-listen',[{type:'recall',key:'şəhər'}]);
assert(host.textContent.includes('First listen at normal speed'));
assert.deepEqual(practice.status('daily-listen'),{key:'daily-listen',total:2,completed:1,skipped:0,finished:false});
click('Next exercise');
assert(host.textContent.includes('Say an original sentence'));
const sentenceInput=host.querySelector('textarea');sentenceInput.value='Bu şəhər mənim üçün doğmadır.';
sentenceInput.dispatchEvent(new Event('input',{bubbles:true}));
click('I’ve said my sentence');assert.equal(host.querySelector('textarea').value,'Bu şəhər mənim üçün doğmadır.');
click('I used it independently');
assert.equal(repo.word('şəhər').evidence.use.unaided,1);
assert.equal(repo.word('şəhər').evidence.use.selfReportedCorrect,1);
assert.equal(repo.word('şəhər').rating,null);
click('Save my sentence with this word');
assert.equal(repo.word('şəhər').context.text,'Bu şəhər mənim üçün doğmadır.');
click('Finish session');click('Back to today');
assert.equal(summary.completed,2);assert.equal(summary.finished,true);

start('slower',[audio]);click('Play at 0.8×');sound.onended();
click('Replay at normal speed');sound.onended();click('In the city');
assert.equal(repo.lesson(clips[0].id).evidence.listen.unaided,1);
assert.equal(repo.lesson(clips[0].id).evidence.listen.conditions.slower.correct,1);
start('replay',[audio]);click('Play at normal speed');sound.onended();
click('Replay at normal speed');sound.onended();click('In the city');
assert.equal(repo.lesson(clips[0].id).evidence.listen.conditions.replay.correct,1);
start('reading-fallback',[audio]);click('Read instead');assert(host.textContent.includes(clips[0].az));
click('In the city');
assert.equal(repo.lesson(clips[0].id).evidence.recognize.conditions.transcript.correct,1);
assert.equal(repo.lesson(clips[0].id).evidence.listen.attempts,3);

start('target-word',[{...audio,source:'word'}]);assert(host.querySelector('input').disabled);
click('Play at normal speed');sound.onended();typeAnswer('ŞƏHƏRDƏ!');
assert.equal(repo.word('şəhər').evidence.listen.unaided,1);

start('phrase',[{type:'read',key:lesson.id},{type:'grammar',key:lesson.id},{type:'speak',key:lesson.id}]);
click(lesson.choices[(lesson.answer+1)%lesson.choices.length]);assert(host.textContent.includes(lesson.choices[lesson.answer]));
assert.equal(repo.lesson(lesson.id).evidence.recognize.correct,0);
click('Next exercise');assert(!host.textContent.includes(lesson.az));
typeAnswer(lesson.accept[0].toLocaleUpperCase('az')+'!');
assert.equal(repo.lesson(lesson.id).evidence.recall.correct,1);
assert(host.querySelector('.practice-grammar-correct.practice-grammar-pop .practice-checkmark'));
click('Next exercise');assert(host.textContent.includes(lesson.speak));click('Show the example');click('I’ve said my sentence');
assert(!findButton('I used it independently'));click('I used it with help');
assert.equal(repo.lesson(lesson.id).evidence.use.selfReported,1);assert.equal(repo.lesson(lesson.id).evidence.use.unaided,0);

start('lexical',[{type:'recognize',key:'şəhər'},{type:'recall',key:'şəhər'}]);
click('Show dictionary meaning');click('I knew a meaning');
assert.equal(repo.word('şəhər').evidence.recognize.selfReported,1);
click('Next exercise');typeAnswer('şəhər');assert.equal(repo.word('şəhər').evidence.recall.unaided,1);
repo.setContext('şəhər',{text:'Biz şəhərdə yaşayırıq.'});
start('hint',[{type:'recall',key:'şəhər'}]);click('Use my saved example');assert(host.textContent.includes('Biz şəhərdə'));
typeAnswer('şəhər');assert.equal(repo.word('şəhər').evidence.recall.unaided,1);
assert.equal(repo.word('şəhər').evidence.recall.conditions.supported.correct,1);

start('show-answer',[{type:'grammar',key:lesson.id}]);click('Show answer');
assert.equal(repo.lesson(lesson.id).evidence.recall.attempts,2);assert.equal(repo.lesson(lesson.id).evidence.recall.correct,1);
start('missing',[{type:'listen',key:'missing'}]);assert(host.textContent.includes('No exercises available'));
const beforeSkip=repo.summary(byWord.size).today.attempts;
start('quiet-now',[sentence]);click('Skip this item');assert.equal(repo.summary(byWord.size).today.attempts,beforeSkip);
assert.equal(practice.status('quiet-now').skipped,1);
const draftsKey='soz-toxumasi:practice:v1',drafts=JSON.parse(storage.getItem(draftsKey));
drafts[repo.day()+'|broken']={index:0,key:'broken',day:repo.day(),steps:[null]};
storage.setItem(draftsKey,JSON.stringify(drafts));
assert.equal(practice.status('broken'),null);
start('broken',[audio]);assert(findButton('Play at normal speed'));
const before=repo.summary(byWord.size).today.attempts;
start('audio-failure',[audio]);blocked=true;click('Play at normal speed');
Promise.resolve().then(()=>{
 assert(host.textContent.includes('Audio is unavailable'));assert(host.querySelector('.practice-option').disabled);
 click('Read instead');click('In the city');
 assert.equal(repo.summary(byWord.size).today.attempts,before+1);
 assert.equal(repo.lesson(clips[0].id).evidence.listen.attempts,3);
 console.log('PASS: daily practice resumes, preserves original answers and scores first-pass listening, slower/replayed audio, reading, word recall, grammar and spoken self-checks separately.');
}).catch(e=>{console.error(e);process.exitCode=1;});
