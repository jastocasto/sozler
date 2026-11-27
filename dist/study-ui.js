/* The daily desk assembles private learning records, the dictionary and the two kinds of listening practice. */
(function(root) {
'use strict';
const sources = [
 {id:'sohbetgah-city',name:'Söhbətgah',title:'İnsanyönümlü şəhər, avtobus zolaqları, tıxaclar və həlli',
  url:'https://www.youtube.com/watch?v=Y93NbcHsmHI&t=568s',
  prompt:'At 9:28 the conversation turns to new bike lanes. Listen for a claim and the reason that follows it. Retell both in your own words.'},
 {id:'akinchi-heritage',name:'Əkinçi',title:'Tarixlə gələcək arasında: Bakıda memarlıq irsinin taleyi',
  url:'https://www.youtube.com/watch?v=dn_CL7fE_qE',
  prompt:'Listen for a contrast between development and preservation. Replay a short stretch and paraphrase the speaker’s reasoning.'},
 {id:'sohbetgah-cinema',name:'Söhbətgah',title:'Kino nədir? · Hikmət Rəhimov',
  url:'https://www.youtube.com/watch?v=4YMvyaVTO2I',
  prompt:'Choose one exchange with the filmmaker. What does the host ask, and how directly does the guest answer? Rephrase the answer as if you were telling a friend.'},
 {id:'akinchi-reading',name:'Əkinçi',title:'Oxu bacarığı, fikrin ifadəsi və tərcümələr',
  url:'https://www.youtube.com/watch?v=RJ5J78TBRPo',
  prompt:'Catch one observation about reading or translation. What wording tells you whether the speaker is making a strong claim or leaving room for doubt?'},
 {id:'sohbetgah-interview',name:'Söhbətgah',title:'Söhbətgah nədir? · Geniş müsahibə',
  url:'https://www.youtube.com/watch?v=-oB0CnQ8kDc',
  prompt:'Follow a change of speaker. Notice a phrase that signals agreement, interruption or a follow-up. Try the phrase in a different conversation.'},
 {id:'akinchi-art',name:'Əkinçi',title:'Azərbaycanda təsviri sənət bazarı',
  url:'https://www.youtube.com/watch?v=qWpTPG9A1jk',
  prompt:'Listen for two things that can affect the value of a painting. Put the comparison into a single Azerbaijani sentence.'},
 {id:'sohbetgah-traffic',name:'Söhbətgah',title:'Tıxac probleminin səbəbi',
  url:'https://www.youtube.com/watch?v=Y93NbcHsmHI&t=2225s',
  prompt:'Start at the chapter on congestion, 37:05. Which wording introduces a cause? Use it to describe a different problem in your neighbourhood.'},
 {id:'akinchi-expectations',name:'Əkinçi',title:'Perfeksionizm haqqında bilməli olduqlarımız',
  url:'https://www.youtube.com/watch?v=ai0fIbT0AwI',
  prompt:'Catch a contrast between a benefit and a cost of high expectations. Repeat the transition aloud, then give a different example.'}
];
const vocabulary = ['eyham','güzəşt','birmənalı','ziddiyyət','əsaslandırmaq','vurğulamaq','qənaət','yanaşma','təşəbbüs','mülahizə','mübahisəli','əsaslı','müqayisə','mövqe','nəzərdə tutmaq','istisna','ehtimal','mədəni irs','ifadə etmək','tərəddüd','müzakirə','nəticə çıxarmaq','şərh','təəssürat','nüans','iddia','müddəa','təkzib','fərziyyə','arqument','məhdudiyyət','mahiyyət','incəlik','praqmatik'];
const dates = new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Baku'});
const routeHash = route => route==='today'?'#study':'#study/'+route;
function readRoute(hash) {
 if(hash==='#study'||hash==='#study/'||hash==='#study/today')return 'today';
 if(!hash.startsWith('#study/'))return null;
 const path=hash.slice(7);
 if(['words','progress','media','settings'].includes(path) || /^practice\/(words|clips|phrasing|speaking)$/.test(path) || /^(media\/)?word\/[^/]+$/.test(path) || sources.some(s=>path==='media/'+s.id))return path;
 return 'today';
}
function rotate(items,offset) {
 if(!items.length)return [];
 const split=offset%items.length;
 return items.slice(split).concat(items.slice(0,split));
}
function createStore(model) {
 const lessonIds=new Set([...root.SozStudyContent,...root.SozStudyListening,...sources].map(x=>x.id));
 return root.SozStudyModel.create({validWord:w=>model.byWord.has(w),validLesson:id=>lessonIds.has(id)});
}
function mount({study,model,savedWords,openWord,navigate}) {
 const $=id=>document.getElementById(id);
 const lessons=root.SozStudyContent,clips=root.SozStudyListening;
 const lessonsById=new Map(lessons.map(x=>[x.id,x])),clipsById=new Map(clips.map(x=>[x.id,x]));
 const wordsWithAudio=new Map();
 for(const clip of clips)if(clip.word&&!wordsWithAudio.has(clip.word))wordsWithAudio.set(clip.word,clip);
 let current=null,currentDay=null;
 const boxes={today:$('studyToday'),words:$('studyLibraryContent'),progress:$('studyLibraryContent'),media:$('studyMediaContent'),practice:$('studyPracticeContent'),word:$('studyPracticeContent'),settings:$('studySettings')};
 function element(tag,cls,text) {
  const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;
 }
 function button(text,cls,action) {
  const b=element('button',cls,text);b.type='button';b.addEventListener('click',action);return b;
 }
 function storageFeedback() {
  const bar=$('studyStorageStatus'),state=study.status();bar.hidden=state.persistent;
  if(!state.persistent)bar.textContent=state.reason==='invalid-data'
   ? 'Some saved study data could not be read. Keep a backup of this session and use Settings & backup to restore a known copy.'
   : 'This browser could not save all of your progress. Download a backup in Settings & backup before closing this page.';
 }
 const library=root.SozStudyLibrary.mount({host:boxes.words,study,model,openWord,savedWords,onChange:storageFeedback,practiceWord:w=>navigate('word/'+encodeURIComponent(w))});
 const practice=root.SozStudyPractice.mount({host:boxes.practice,study,model,lessons,clips,onChange:storageFeedback,onFinish:()=>navigate('today')});
 const media=root.SozStudyMedia.mount({host:boxes.media,study,model,sources,onChange:storageFeedback});
 function reviewTask(item) {
  if(item.channel==='listen'&&wordsWithAudio.has(item.key))return {type:'listen',source:'word',key:wordsWithAudio.get(item.key).id};
  if(item.channel==='use'&&study.settings().speaking)return {type:'speak',source:'word',key:item.key};
  return {type:item.channel==='recognize'||item.reason==='new'?'recognize':'recall',key:item.key};
 }
 function discoveryWords(ordinal,lessonCandidates,clipCandidates) {
  const tracked=study.words().sort((a,b)=>b.updated.localeCompare(a.updated)),known=new Set(tracked.map(r=>r.key));
  const bookmarks=[...(savedWords?.()||[])],related=[];
  const seeds=[...new Set([...tracked.slice(0,4).map(r=>r.key),...bookmarks.slice(0,3)])];
  for(const word of seeds){
   const node=model.byWord.get(word);
   if(node)for(const candidate of model.related(node,new Set(['syn','ant','topic','root'])).slice(0,12))related.push(candidate.node.w);
  }
  const unseen=w=>model.byWord.has(w)&&!known.has(w);
  const focus=rotate(vocabulary,ordinal).filter(unseen).slice(0,4);
  const phrases=lessonCandidates.map(l=>l.word).concat(clipCandidates.map(c=>c.word)).filter(unseen).slice(0,4);
  // Once a learner knows the starting set, keep drawing from the ranked dictionary.
  const ranked=model.commonWords(),offset=1500+(ordinal*17)%Math.max(1,Math.min(ranked.length,14000)-1500);
  const wider=ranked.slice(offset,offset+100).map(n=>n.w).filter(unseen).slice(0,2);
  return [...new Set([...bookmarks.filter(unseen).slice(0,4),...related.filter(unseen).slice(0,4),...focus,...phrases,...wider])];
 }
 function daily() {
  const day=study.day(),ordinal=Math.floor(Date.parse(day+'T00:00:00Z')/86400000);
  const {minutes,speaking}=study.settings(),source=sources[ordinal%sources.length];
  const lessonCandidates=rotate(lessons,ordinal),clipCandidates=rotate(clips,ordinal);
  const wordCandidates=discoveryWords(ordinal,lessonCandidates,clipCandidates);
  const wordCount=Math.max(1,Math.min(12,Math.round(minutes/6))),lessonCount=minutes>=30?3:minutes>=14?2:1;
  const wordPlan=study.plan({kind:'word',words:wordCandidates,limit:wordCount,newLimit:wordCount});
  const grammarPlan=study.plan({kind:'lesson',lessons:lessonCandidates.map(l=>l.id),accept:(kind,id)=>lessonsById.has(id),limit:lessonCount,newLimit:lessonCount});
  const clipCount=Math.max(1,Math.min(4,Math.round(minutes/12)));
  const listenPlan=study.plan({kind:'lesson',lessons:clipCandidates.map(c=>c.id),accept:(kind,id)=>clipsById.has(id),limit:clipCount,newLimit:clipCount});
  const speakingLesson=grammarPlan[0]?.key||lessonCandidates[0]?.id;
  const speakTasks=speakingLesson?[{type:'speak',key:speakingLesson}]:[];
  if(wordPlan.length&&minutes>=15)speakTasks.push({type:'speak',source:'word',key:wordPlan[0].key});
  const rows=[
   {key:'media',title:'Follow a native speaker',description:source.name+' · '+source.title,source},
   {key:'words',title:'Review your words',description:'Review what is due and discover vocabulary from your bookmarks, word connections and interviews.',tasks:wordPlan.flatMap(item=>{
    const first=reviewTask(item);
    return first.type==='recognize'&&minutes>=10?[first,{type:'recall',key:item.key}]:[first];
   })}
  ];
  if(clips.length && (minutes>=10||ordinal%2===0))rows.push({key:'clips',title:'Listen without the transcript',description:'Catch the meaning on a first listen. Replay to find what you missed.',tasks:listenPlan.map(i=>({type:'listen',key:i.key}))});
  if(minutes>=10||ordinal%2===1)rows.push({key:'phrasing',title:'Read between the lines',description:'Interpret a speaker’s intention and reconstruct the phrase in Azerbaijani.',tasks:grammarPlan.flatMap(({key})=>[{type:'read',key},{type:'grammar',key}])});
  if(speaking)rows.push({key:'speaking',title:'Put it in your own words',description:'Use today’s expressions in a fresh sentence and check it against a model.',tasks:speakTasks});
  for(const row of rows) {
   if(row.source){row.done=study.hasAttempt('media:'+day+':'+source.id);row.total=1;row.completed=Number(row.done);}
   else{
    const session=practice.status(row.key);row.total=session?.total??row.tasks.length;row.completed=session?.completed||0;
    row.finished=!!session?.finished;row.done=row.total===0||row.completed===row.total;row.skipped=session?.skipped||0;
   }
  }
  return {rows,source,day,minutes,feature:lessonCandidates[0],summary:study.summary(model.nodes.length)};
 }
 function startRow(row) {navigate(row.source?'media/'+row.source.id:'practice/'+row.key);}
 function renderToday() {
  const data=daily(),{rows,summary}=data,next=rows.find(r=>!r.done&&!r.finished);
  const grid=element('div','study-today-grid'),plan=element('section','study-day-plan'),lead=element('div','study-lead');
  lead.append(element('p','study-day-meta',data.minutes+'-minute routine · '+rows.filter(r=>r.done).length+' of '+rows.length+' activities complete'));
  if(next) {
   lead.append(element('h2','',next.source?'Listen to '+next.source.name:next.title),element('p','',next.source?next.source.prompt:next.description),
    button(next.source?'Open listening exercise':next.completed?'Continue practice':'Start practice','study-cta',()=>startRow(next)));
  }else{
   lead.append(element('h2','',rows.every(r=>r.done)?'Today’s plan is complete':'Today’s session is finished'),
    element('p','',summary.today.attempts+' practice responses today. See which words you understood, recalled or used.'),
    button('See my progress','study-cta',()=>navigate('progress')));
  }
  const list=element('ol','study-plan-list');
  for(const row of rows){
   const li=element('li','study-plan-row'),copy=element('div');
   copy.append(element('h3','',row.title),element('p','',row.description));
   const text=row.done?(row.total?'Complete':'Up to date'):row.finished?'Finished · '+row.skipped+' skipped':row.completed?row.completed+'/'+row.total+' · Continue':'Start';
   const action=button(text,'study-button',()=>startRow(row));action.setAttribute('aria-label',row.title+' · '+text);action.dataset.studyTask=row.key;
   if(row.done&&!row.total)action.disabled=true;
   li.append(copy,action);list.append(li);
  }
  plan.append(lead,element('h2','','Your plan'),list);
  const aside=element('aside','study-day-aside'),bank=element('section','study-feature');
  bank.append(element('h2','','Your word bank'));
  const bankText=summary.tracked
   ? summary.tracked+' '+(summary.tracked===1?'word':'words')+' collected. '+summary.dueWords+' due for review.'
   : 'Start with words you already use or save a phrase you caught in a podcast.';
  bank.append(element('p','',bankText),button(summary.tracked?'Open my words':'Build my word bank','study-text-link',()=>navigate('words')));aside.append(bank);
  if(data.feature) {
   const note=element('section','study-feature'),phrase=element('p','study-phrase',data.feature.accept[0]);phrase.lang='az';
   note.append(element('h2','','An expression to notice'),phrase,element('p','',data.feature.skill),
    button('Explore the word','study-text-link',()=>openWord(data.feature.word)));aside.append(note);
  }
  grid.append(plan,aside);boxes.today.replaceChildren(grid);
 }
 function settings() {
  const prefs=study.settings();$('studyMinutes').value=String(prefs.minutes);$('studySpeaking').checked=prefs.speaking;
  $('studyStartPage').querySelectorAll('option').forEach(o=>{o.selected=o.value===prefs.startPage;});$('studySettingsStatus').textContent='';
 }
 $('studySaveSettings').addEventListener('click',()=>{
  const n=Number($('studyMinutes').value),status=$('studySettingsStatus');
  if(!Number.isInteger(n)||n<5||n>90){status.textContent='Choose a whole number from 5 to 90 minutes.';$('studyMinutes').focus();return;}
  study.setSettings({minutes:n,speaking:$('studySpeaking').checked,startPage:$('studyStartPage').value||'atlas'});
  storageFeedback();status.textContent='Your daily routine has been updated.';
 });
 $('studyExport').addEventListener('click',()=>{
  const status=$('studySettingsStatus');
  try {
   const file=new Blob([study.exportJSON()],{type:'application/json'}),url=URL.createObjectURL(file);
   const a=document.createElement('a');a.href=url;a.download='sozler-study-'+study.day()+'.json';
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   status.textContent='Your backup file is ready to save.';
  }catch{status.textContent='The backup download could not start. Try opening this page directly in your phone’s browser.';}
 });
 $('studyImport').addEventListener('change',async e=>{
  const input=e.currentTarget,file=input.files?.[0],status=$('studySettingsStatus');if(!file)return;
  try{
   const result=study.importJSON(await file.text());settings();storageFeedback();
   status.textContent='Backup merged. '+result.added+' new '+(result.added===1?'record':'records')+' added. '+result.duplicates+' already on this device.';
  }catch(err){status.textContent='Could not restore this backup. '+err.message;}
  input.value='';
 });
 function singleWord(w) {
  const tasks=[{type:'recognize',key:w},{type:'recall',key:w}],clip=wordsWithAudio.get(w);
  if(clip)tasks.push({type:'listen',key:clip.id,source:'word'});
  if(study.settings().speaking)tasks.push({type:'speak',key:w,source:'word'});
  practice.start({key:'word/'+w,title:w,tasks});
 }
 function close() {
  if(current?.startsWith('practice/')||current?.startsWith('word/'))practice.close();
  if(current==='media'||current?.startsWith('media/'))media.close();
  current=null;
 }
 function open(route='today',force=false) {
  if(!force&&route===current&&study.day()===currentDay)return;
  close();current=route;currentDay=study.day();
  const boundary=route.indexOf('/'),tab=boundary<0?route:route.slice(0,boundary),key=boundary<0?'':route.slice(boundary+1);
  const area=boxes[tab]||boxes.today;for(const box of new Set(Object.values(boxes)))box.hidden=box!==area;
  const navTab=tab==='word'?'words':tab==='practice'?'today':tab;
  document.querySelectorAll('[data-study-route]').forEach(a=>{if(a.dataset.studyRoute===navTab)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const titles={today:'Today’s practice',words:'My words',progress:'My progress',media:'Listening desk',settings:'Settings & backup',word:'Word practice',practice:'Daily practice'};
  let title=titles[tab]||titles.today;
  $('studyDate').textContent=tab==='today'?dates.format(new Date(currentDay+'T12:00:00Z'))+' · Bakı':'';
  const sourceLink=$('studyWordSource');sourceLink.hidden=true;
  if(tab==='words')library.library();
  else if(tab==='progress')library.progress();
  else if(tab==='media'){
   let word=null;if(key.startsWith('word/'))try{word=model.resolveWord(decodeURIComponent(key.slice(5)));}catch{}
   media.open(word?null:key,word?.w);
  }
  else if(tab==='settings')settings();
  else if(tab==='practice'){
   const row=daily().rows.find(r=>r.key===key);
   if(!row){navigate('today',true);return;}
   title=row.title;practice.start({key:row.key,title:row.title,tasks:row.tasks});
  }else if(tab==='word'){
   let word;try{word=model.resolveWord(decodeURIComponent(key));}catch{}
   if(!word){navigate('words',true);return;}title=word.w;singleWord(word.w);
   const context=study.word(word.w)?.context;
   if(context?.text||context?.source){
    const dest='media/word/'+encodeURIComponent(word.w);sourceLink.href=routeHash(dest);sourceLink.hidden=false;
    sourceLink.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(dest);};
   }
  }else renderToday();
  $('studyHeading').textContent=title;document.title=title+' — SÖZ';storageFeedback();
  $('studyPage').scrollTop=0;$('studyHeading').focus?.({preventScroll:true});
 }
 document.querySelectorAll('[data-study-route]').forEach(a=>a.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(a.dataset.studyRoute);}));
 function resume(){
  if(!current||document.hidden)return;
  study.refresh();storageFeedback();
  if(study.day()!==currentDay || ['today','words','progress'].includes(current))open(current,true);
 }
 document.addEventListener('visibilitychange',resume);root.addEventListener?.('pageshow',resume);
 return {open,close};
}
root.SozStudyUI={sources,readRoute,routeHash,createStore,mount};
})(typeof window!=='undefined'?window:globalThis);
