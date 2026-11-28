/* Personal study exercises. The study model owns evidence and review dates. */
(function(root){
'use strict';
const sessionStorageKey='soz-toxumasi:practice:v1';
const labels={recognize:'Word meaning',recall:'Word recall',listen:'Listening',read:'Reading',grammar:'Grammar in context',speak:'Spoken practice'};
function normalized(value){
 return String(value??'').normalize('NFC').toLocaleLowerCase('az').replace(/[\p{P}\p{Z}\s]+/gu,' ').trim();
}
function mount({host,study,model,lessons=root.SozStudyContent||[],clips=root.SozStudyListening||[],onChange=()=>{},onFinish=()=>{},storage}){
 const doc=host.ownerDocument,lessonById=new Map(lessons.map(x=>[x.id,x])),clipById=new Map(clips.map(x=>[x.id,x]));
 const cache=new Map();
 if(storage===undefined){try{storage=root.localStorage;}catch{storage=null;}}
 let session=null,audio=null,renderId=0,storageAvailable=Boolean(storage);
 function element(tag,className='',value,lang){
  const el=doc.createElement(tag);
  if(className)el.className=className;
  if(value!==undefined)el.textContent=value;
  if(lang)el.lang=lang;
  return el;
 }
 function button(label,className,action){
  const b=element('button',className,label);b.type='button';b.addEventListener('click',action);return b;
 }
 function stopAudio(){
  if(!audio)return;
  audio.onended=audio.onerror=audio.onplaying=null;
  audio.pause?.();audio=null;
 }
 function savedSessions(){
  try{
   const value=JSON.parse(storage?.getItem(sessionStorageKey)||'{}');
   return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  }catch{return {};}
 }
 function persist(){
  if(!session)return;
  const key=session.day+'|'+session.key;
  cache.set(key,session);
  try{
   if(!storage)return;
   const records=savedSessions();records[key]=session;
   const recent=Object.entries(records).filter(([,s])=>s?.day&&Array.isArray(s.steps))
    .sort((a,b)=>b[1].day.localeCompare(a[1].day));
   // Backups hold the learning history. Only recent in-progress sessions need
   // a copy of their exercise order, entered answers and playback conditions.
   const retained=Object.fromEntries(recent.slice(0,36));retained[key]=session;
   storage.setItem(sessionStorageKey,JSON.stringify(retained));
   storageAvailable=true;
  }catch{storageAvailable=false;}
 }
 function getSession(key){
  const day=study.day(),id=day+'|'+key,s=cache.get(id)||savedSessions()[id];
  if(!s||s.day!==day||s.key!==key||!Array.isArray(s.steps)||!Number.isInteger(s.index)||s.index<0||s.index>s.steps.length)return null;
  if(!s.steps.every(t=>t&&Object.hasOwn(labels,t.type)&&typeof t.key==='string'))return null;
  return s;
 }
 function sourceFor(t){
  if(t.type==='listen'||t.source==='clip')return clipById.get(t.key);
  if(t.type==='recognize'||t.type==='recall'||t.source==='word')return model.byWord.get(t.key);
  return lessonById.get(t.key);
 }
 function asTask(raw){
  if(!raw||!Object.hasOwn(labels,raw.type)||typeof raw.key!=='string')return null;
  const t={type:raw.type,key:raw.key};
  if((raw.type==='listen'&&raw.source==='word')||(raw.type==='speak'&&['clip','word'].includes(raw.source)))t.source=raw.source;
  return sourceFor(t)?t:null;
 }
 function attemptId(t,s=session){
  return JSON.stringify(['practice',s.day,s.key,t.type,t.source||'',t.key]);
 }
 function counts(s){
  const completed=s.steps.filter(t=>t.outcome||study.hasAttempt(attemptId(t,s))).length;
  return {key:s.key,completed,total:s.steps.length,skipped:s.steps.filter(t=>t.skipped).length,finished:s.index>=s.steps.length};
 }
 function status(key){const s=getSession(key);return s&&Array.isArray(s.steps)?counts(s):null;}
 function close(){persist();stopAudio();renderId++;session=null;host.replaceChildren();}
 function leave(){const report=counts(session);close();onFinish(report);}
 function start({key,title,tasks}){
  close();
  const previous=getSession(key);
  if(previous){
   session=previous;
  }else{
   const seen=new Set(),steps=[];
   for(const raw of tasks||[]){
    const t=asTask(raw);if(!t)continue;
    const id=[t.type,t.source,t.key].join('|');
    if(!seen.has(id)){seen.add(id);steps.push(t);}
   }
   session={day:study.day(),key,title,steps,index:0};
  }
  persist();render(true);return counts(session);
 }
 function advance(){
  if(!session)return;
  session.index++;persist();render(true);
 }
 function submit(t,correct,channel,condition,extra={}){
  if(!session||session.steps[session.index]!==t||t.outcome)return;
  const wordTask=t.type==='recognize'||t.type==='recall'||t.source==='word';
  const key=t.type==='listen'&&t.source==='word'?sourceFor(t).word:t.key;
  const id=attemptId(t);
  const selfReported=t.type==='speak'||t.type==='recognize';
  const recorded=study.record({id,kind:wordTask?'word':'lesson',key,channel,correct,condition,selfReported});
  if(!recorded&&!study.hasAttempt(id))return;
  // A completed answer may have arrived through a second tab or a backup.
  // Its original score wins even if this tab supplied a different answer.
  if(recorded)t.outcome={correct,channel,condition,selfReported,...extra};
  else if(study.attempt)t.outcome=study.attempt(id);
  delete t.draft;
  persist();render(true,t.type==='grammar'&&recorded&&t.outcome.correct);onChange(counts(session));
 }
 function dictionaryInfo(node){
  return root.WordInfo?.describeWord(node,model.byWord)||{definition:node.az,definitionEnglish:node.en};
 }
 function dictionaryReady(node,card,ready){
  if(node?.en||model.primaryReady?.(node)||!model.ensurePrimary){ready();return;}
  const generation=renderId;
  const wait=element('p','practice-note','Loading this dictionary entry…');
  card.append(wait);
  let primary;
  try{primary=model.ensurePrimary(node);}catch{primary=Promise.reject();}
  Promise.resolve(primary).then(()=>{
   if(generation===renderId){wait.remove();ready();}
  },()=>{
   if(generation!==renderId)return;
   wait.textContent='The dictionary entry could not be loaded.';
   card.append(button('Try again','practice-secondary',()=>render(false)));
  });
 }
 function skipButton(){
  return button('Skip this item','practice-secondary',()=>{
   session.steps[session.index].skipped=true;advance();onChange(counts(session));
  });
 }
 function unavailable(card){
  card.append(element('p','practice-note','This item is unavailable for this exercise.'));
 }
 function addLinkedWord(card,t){
  const word=sourceFor(t)?.word;
  if(!word||!model.byWord.has(word))return;
  const link=button('Add '+word+' to my library','practice-secondary',()=>{
   study.trackWord(word);link.disabled=true;link.textContent=word+' · in my library';onChange(counts(session));
  });
  if(study.word(word)){link.disabled=true;link.textContent=word+' · in my library';}
  card.append(link);
 }
 function finishView(card){
  const report=counts(session),outcomes=session.steps.filter(x=>x.outcome);
  card.append(element('p','practice-step',session.title),element('h2','practice-prompt',session.steps.length?'Session complete':'No exercises available'));
  if(report.completed){
   const wordCount=outcomes.filter(x=>x.type==='recognize'||x.type==='recall'||x.source==='word').length;
   const phraseCount=outcomes.length-wordCount;
   const parts=[];
   if(wordCount)parts.push(wordCount+' word '+(wordCount===1?'check':'checks'));
   if(phraseCount)parts.push(phraseCount+' phrase '+(phraseCount===1?'exercise':'exercises'));
   card.append(element('p','practice-note',parts.length?parts.join(' and ')+' recorded.':'Your answers are in your study history.'));
   const firstListen=outcomes.filter(x=>x.outcome.correct&&x.outcome.condition==='normal'&&x.outcome.channel==='listen').length;
   if(firstListen)card.append(element('p','practice-note',firstListen+' understood on the first listen at normal speed.'));
   if(outcomes.some(x=>!x.outcome.correct))card.append(element('p','practice-note','Missed items return sooner in your review plan.'));
  }
  if(report.skipped)card.append(element('p','practice-note',report.skipped+' skipped.'));
  card.append(button('Back to today','practice-primary',leave));
 }
 function render(focus, celebrate=false){
  stopAudio();renderId++;
  const card=element('section','practice-card');card.lang='en';
  host.replaceChildren(card);
  if(session.index>=session.steps.length){finishView(card);if(focus)focusHeading(card);return;}
  const t=session.steps[session.index];
  const top=element('div','practice-header');
  const navigation=element('div','practice-actions');
  if(!t.outcome&&!study.hasAttempt(attemptId(t)))navigation.append(skipButton());
  navigation.append(button('Pause','practice-secondary',leave));
  top.append(element('span','practice-step',labels[t.type]+' · '+(session.index+1)+' of '+session.steps.length),navigation);
  const meter=element('progress','practice-meter');meter.max=session.steps.length;meter.value=session.index;
  meter.setAttribute('aria-label','Session progress');
  card.append(top,meter);
  if(!sourceFor(t)){
   unavailable(card);
   if(t.outcome||study.hasAttempt(attemptId(t)))card.append(button('Continue','practice-primary',advance));
   return;
  }
  if(t.outcome||study.hasAttempt(attemptId(t))){
   t.outcome=t.outcome||study.attempt?.(attemptId(t));feedback(card,t,celebrate);
  }
  else if(t.type==='listen'){listening(card,t);}
  else if(t.type==='read'){reading(card,t);}
  else if(t.type==='grammar'){grammar(card,t);}
  else if(t.type==='speak'){speaking(card,t);}
  else{vocabulary(card,t);}
  if(!storageAvailable)card.append(element('p','practice-note','This session can resume while this page stays open.'));
  if(focus)focusHeading(card);
 }
 function focusHeading(card){
  const title=card.querySelector('h2');
  if(title){title.tabIndex=-1;title.focus?.({preventScroll:true});}
 }
 function addSentence(card,source,includeEnglish){
  card.append(element('p','practice-az',source.az,'az'));
  if(includeEnglish)card.append(element('p','practice-note',source.en,'en'));
 }
 function addRecording(card,item){
  const recorded=item.src?item:clipById.get(item.audioId);
  if(!recorded?.src||normalized(recorded.az)!==normalized(item.az))return;
  const player=element('audio','practice-audio');player.controls=true;player.preload='none';player.src=recorded.src;
  player.setAttribute('aria-label','Listen with the transcript');audio=player;
  card.append(element('p','practice-note','Listen with the transcript.'),player);
  if(recorded.credit)card.append(element('small','practice-note',recorded.credit));
 }
 function optionList(card,options,answer,onAnswer,enabled=true){
  const group=element('div','practice-options');
  group.setAttribute('role','group');group.setAttribute('aria-label','Answer choices');
  options.forEach((option,i)=>{
   const b=button(option,'practice-option',()=>onAnswer(i===answer,i));b.disabled=!enabled;group.append(b);
  });
  card.append(group);return group;
 }
 function letterKeys(input){
  const details=element('details','practice-letters');
  details.append(element('summary','','Azerbaijani letters'));
  const row=element('div','practice-actions');
  for(const letter of ['ə','ğ','ı','ö','ş','ü','ç']){
   row.append(button(letter,'practice-secondary',()=>{
    const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
    input.value=input.value.slice(0,start)+letter+input.value.slice(end);
    input.focus();input.setSelectionRange?.(start+1,start+1);
    input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));
   }));
  }
  details.append(row);return details;
 }
 function inputForm(card,t,label,submitAnswer,reveal){
  const form=element('form','practice-form'),field=element('label','practice-field'),input=element('input');
  input.type='text';input.lang='az';input.autocomplete='off';input.autocapitalize='none';
  input.setAttribute('autocorrect','off');input.spellcheck=false;input.maxLength=240;input.enterKeyHint='done';
  input.value=t.draft||'';
  const check=element('button','practice-primary','Check answer');check.type='submit';check.disabled=!input.value.trim();
  field.append(element('span','',label),input);form.append(field,letterKeys(input),check);
  if(reveal)form.append(button('Show answer','practice-secondary',reveal));
  input.addEventListener('input',()=>{t.draft=input.value;check.disabled=!input.value.trim();persist();});
  form.addEventListener('submit',e=>{e.preventDefault();if(input.value.trim())submitAnswer(input.value);});
  card.append(form);return form;
 }
 function vocabulary(card,t){
  const node=model.byWord.get(t.key);
  card.append(element('h2','practice-prompt',t.type==='recall'?'Recall the Azerbaijani word':'What does this word mean?'));
  dictionaryReady(node,card,()=>{
   const info=dictionaryInfo(node);
   if(!node.en?.trim()){unavailable(card);return;}
   const context=study.word(t.key)?.context?.text;
   function savedExample(){
    if(!context)return;
    if(t.support)card.append(element('p','practice-note',context,'az'));
    else card.append(button('Use my saved example','practice-secondary',()=>{t.support=true;persist();render(false);}));
   }
   if(t.type==='recall'){
    card.append(element('p','practice-cue',info.definitionEnglish,'en'));
    const letters=Array.from(node.w).filter(x=>/\p{L}/u.test(x)).length;
    card.append(element('p','practice-note','Your library headword starts with “'+node.w[0]+'” and has '+letters+' letters.'));
    savedExample();
    inputForm(card,t,'Azerbaijani headword',value=>submit(t,normalized(value)===normalized(node.w),'recall',t.support?'supported':'independent'),()=>submit(t,false,'recall','supported'));
    return;
   }
   card.append(element('p','practice-az',node.w,'az'));
   if(!t.revealed){
    savedExample();
    card.append(element('p','practice-note','Say a meaning to yourself before you turn the word over.'),
     button('Show dictionary meaning','practice-primary',()=>{t.revealed=true;persist();render(false);}));
   }else{
    card.append(element('p','practice-cue',node.en,'en'));
    if(node.az)card.append(element('p','practice-note',node.az,'az'));
    card.append(button('I knew a meaning','practice-primary',()=>submit(t,true,'recognize',t.support?'supported':'independent')),
     button('I needed the definition','practice-secondary',()=>submit(t,false,'recognize','supported')));
   }
  });
 }
 function reading(card,t){
  const lesson=sourceFor(t);
  card.append(element('h2','practice-prompt',lesson.meaning));addSentence(card,lesson,false);
  optionList(card,lesson.choices,lesson.answer,(correct,choice)=>submit(t,correct,'recognize','transcript',{choice}));
 }
 function grammar(card,t){
  const lesson=sourceFor(t);
  card.append(element('h2','practice-prompt','Complete the sentence'),element('p','practice-az',lesson.gap,'az'),
   element('p','practice-note',lesson.cue||lesson.en,'en'));
  inputForm(card,t,'Missing word or phrase',value=>submit(t,lesson.accept.some(a=>normalized(a)===normalized(value)),'recall','independent'),
   ()=>submit(t,false,'recall','supported'));
 }
 function speaking(card,t){
  const source=sourceFor(t),expression=t.source==='word'?t.key:(source.accept?.[0]||source.surface||source.word);
  card.append(element('h2','practice-prompt','Say an original sentence'));
  const prompt=t.source==='word'?'Tell a listener something true about this week using this word.':
   source.speak||'Use this word or expression to talk about a different situation from your own life.';
  if(expression)card.append(element('p','practice-az',expression,'az'));
  card.append(element('p','practice-cue',prompt));
  const draft=element('details','practice-draft'),field=element('label','practice-field'),note=element('textarea');
  draft.append(element('summary','','Write down my sentence'));
  note.value=t.sentence||'';note.rows=2;note.maxLength=480;note.lang='az';note.autocomplete='off';
  note.addEventListener('input',()=>{t.sentence=note.value;persist();});
  field.append(element('span','','Optional sentence for this session'),note);draft.append(field);card.append(draft);
  if(t.support){
   if(source.w){const info=dictionaryInfo(source);card.append(element('p','practice-note',info.definitionEnglish||'', 'en'));
    if(info.example)card.append(element('p','practice-note',info.example[0],'az'));
   }else{addSentence(card,source,true);addRecording(card,source);}
  }else{
   card.append(button(t.source==='word'?'Show a meaning':'Show the example','practice-secondary',()=>{t.support=true;persist();render(false);}));
  }
  if(!t.spoken){
   card.append(button('I’ve said my sentence','practice-primary',()=>{t.spoken=true;persist();render(false);}),
    button('I couldn’t use it yet','practice-secondary',()=>submit(t,false,'use','supported')));
   return;
  }
  card.append(element('p','practice-note','Did it express your own idea, with the word in a form that fit?'));
  if(!t.support)card.append(button('I used it independently','practice-primary',()=>submit(t,true,'use','independent')));
  card.append(button('I used it with help',t.support?'practice-primary':'practice-secondary',()=>submit(t,true,'use','supported')),
   button('I need to try it again','practice-secondary',()=>submit(t,false,'use','supported')));
 }
 function listening(card,t){
  const clip=sourceFor(t),word=t.source==='word'?model.byWord.get(clip.word):null;
  if(t.source==='word'&&!word){unavailable(card);return;}
  if(word&&!clip.wordEn&&!word.en){
   dictionaryReady(word,card,()=>{if(word.en)listening(card,t);else unavailable(card);});
   return;
  }
  const assist=t.audio||(t.audio={plays:0,slow:false,heard:false,read:false});
  card.append(element('h2','practice-prompt',word?(assist.read?'Find the word in the sentence':'Which Azerbaijani word did you hear?'):clip.question));
  if(word)card.append(element('p','practice-note',(assist.read?'Find':'Listen for')+' the word meaning “'+(clip.wordEn||word.en)+'”.'));
  const mode=()=>assist.read?'transcript':assist.slow?'slower':assist.plays===1?'normal':'replay';
  const result=(correct,extra)=>{
   if(!assist.read&&!assist.heard)return;
   submit(t,correct,assist.read?'recognize':'listen',mode(),extra);
  };
  if(assist.read){
   addSentence(card,clip,false);
   card.append(element('p','practice-note','This answer will count as reading practice.'));
  }else{
   const intro=element('p','practice-note','A speaker reads this sentence aloud. Listen once, then replay or slow down if you need to.');
   card.append(intro);
  }
  const controls=element('div','practice-actions'),message=element('p','practice-note');
  message.setAttribute('role','status');
  function enable(ready){
   for(const control of card.querySelectorAll('.practice-options button, .practice-form input, .practice-form button'))control.disabled=!ready;
   const input=card.querySelector('.practice-form input'),check=card.querySelector('.practice-form [type=submit]');
   if(check)check.disabled=!ready||!input.value.trim();
  }
  if(!assist.read){
   const player=element('audio');player.preload='none';player.src=clip.src;
   audio=player;let generation=0;
   const full=button(assist.plays?'Replay at normal speed':'Play at normal speed','practice-primary',()=>play(1));
   const slow=button('Play at 0.8×','practice-secondary',()=>play(.8));
   const read=button('Read instead','practice-secondary',()=>{assist.read=true;persist();render(false);});
   const fail=()=>{
    if(audio!==player)return;
    message.textContent='Audio is unavailable. You can retry or read the transcript.';
    full.disabled=slow.disabled=false;
   };
   function play(rate){
    const playingId=++generation;
    player.pause?.();player.currentTime=0;player.defaultPlaybackRate=rate;player.playbackRate=rate;player.preservesPitch=true;
    let counted=false;
    function heardSound(){
     if(counted||generation!==playingId||audio!==player)return;
     counted=true;assist.plays++;if(rate<1)assist.slow=true;
     full.textContent='Replay at normal speed';persist();
    }
    player.onplaying=()=>{heardSound();player.playbackRate=rate;message.textContent=rate===1?'Playing at normal speed…':'Playing at 0.8×…';};
    player.onended=()=>{
     if(audio!==player||generation!==playingId)return;
     heardSound();assist.heard=true;persist();enable(true);message.textContent='Choose your answer or listen again.';
    };
    player.onerror=fail;message.textContent='Loading audio…';
    try{const action=player.play();action?.catch(()=>{if(playingId===generation)fail();});}catch{fail();}
   }
   controls.append(full,slow,read);card.append(controls,player,message);
  }
  if(word){
   inputForm(card,t,assist.read?'Azerbaijani word or dictionary form':'The word you heard or its dictionary form',value=>result([word.w,clip.surface].some(form=>form&&normalized(value)===normalized(form))),()=>result(false));
  }else{
   optionList(card,clip.choices,clip.answer,(correct,choice)=>result(correct,{choice}));
  }
  enable(assist.read||assist.heard);
 }
 function feedback(card,t,celebrate){
  const item=sourceFor(t),a=t.outcome,box=element('div','practice-feedback');box.setAttribute('role','status');
  const next=button(session.index+1===session.steps.length?'Finish session':'Next exercise','practice-primary',advance);
  if(!a){
   box.append(element('h2','practice-prompt','Answer already recorded'));
   card.append(box,next);return;
  }
  const speaking=t.type==='speak',recognized=t.type==='recognize';
  const title=speaking?(a.correct?'Sentence practice recorded':'You can revisit this phrase'):
   recognized?(a.correct?'Meaning recognized':'Saved for another review'):
   a.correct?'That’s right':'Let’s look at the answer';
  box.classList.add(a.correct?'is-correct':'needs-review');
  const heading=element('h2','practice-prompt',title);
  if(t.type==='grammar'&&a.correct){
   if(celebrate)box.classList.add('practice-grammar-pop');
   const mark=element('span','practice-checkmark','✓');mark.setAttribute('aria-hidden','true');
   heading.prepend(mark);
   box.classList.add('practice-grammar-correct');
  }
  box.append(heading);
  if(item.w){
   box.append(element('p','practice-az',item.w,'az'),element('p','practice-note',item.en||'','en'));
   const example=dictionaryInfo(item).example;
   if(example)box.append(element('p','practice-note',example[0],'az'));
  }else{
   if(t.type==='read'||(t.type==='listen'&&t.source!=='word')){
    if(!a.correct&&Number.isInteger(a.choice))box.append(element('p','practice-note','You chose “'+item.choices[a.choice]+'”.'));
    box.append(element('p','practice-cue',item.choices[item.answer],'en'));
   }
   if(t.type==='listen'&&t.source==='word')box.append(element('p','practice-cue',item.word,'az'));
   addSentence(box,item,true);
   if(item.explanation||item.note)box.append(element('p','practice-note',item.explanation||item.note));
  }
  if(t.type==='listen'){
   const mode=a.condition==='normal'?'First listen at normal speed':a.condition==='slower'?'Listening with slower playback':
    a.condition==='replay'?'Listening after a replay':'Reading with the transcript';
   box.append(element('p','practice-note',mode+' recorded.'));
  }
  if(speaking){
   if(t.sentence?.trim()){
    box.append(element('p','practice-note',t.sentence,'az'));
    const context=t.source==='word'&&study.word(t.key)?.context;
    if(context&&!context.text&&!context.source&&context.seconds===null){
     const keep=button('Save my sentence with this word','practice-secondary',()=>{
      // Someone may have saved an example in another tab since this view opened.
      const now=study.word(t.key)?.context;
      if(!now||now.text||now.source||now.seconds!==null){keep.disabled=true;keep.textContent='A word note is already saved';return;}
      try{study.setContext(t.key,{text:t.sentence.trim()});}catch{keep.textContent='This sentence could not be saved';return;}
      keep.disabled=true;keep.textContent='Sentence saved';onChange(counts(session));
     });
     box.append(keep);
    }
   }
   box.append(element('p','practice-note',a.correct&&a.condition==='independent'?'Saved as your self-check of independent spoken use.':'Saved as supported spoken practice.'));
  }
  addRecording(box,item);
  card.append(box,next);
  if(!item.w)addLinkedWord(card,t);
 }
 return {start,status,close};
}
const api={mount,normalized};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SozStudyPractice=api;
})(typeof window!=='undefined'?window:globalThis);
