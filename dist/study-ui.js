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
 if(['words','words/find','progress','media','settings','grammar','vocab','read'].includes(path) ||
  /^read\/[a-z0-9-]{1,80}$/.test(path) ||
  /^vocab\/(new|review(?:\/[0-2])?|bank\/[0-3])$/.test(path) || /^practice\/(words|clips|phrasing|speaking)$/.test(path) ||
  /^(media\/)?word\/[^/]+$/.test(path) || sources.some(s=>path==='media/'+s.id))return path;
 return 'today';
}
function tabFor(route) {
 const section=route.split('/')[0];
 if(section==='today'||section==='progress')return 'home';
 if(section==='vocab'||section==='words'||section==='word'||route==='practice/words')return 'vocab';
 return section==='settings'?'settings':'study';
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
function mount({study,model,savedWords,openWord,navigate,getMotion,setMotion,analyze}) {
 const $=id=>document.getElementById(id);
 const lessons=root.SozStudyContent,clips=root.SozStudyListening;
 const lessonsById=new Map(lessons.map(x=>[x.id,x])),clipsById=new Map(clips.map(x=>[x.id,x]));
 const wordsWithAudio=new Map();
 for(const clip of clips)if(clip.word&&!wordsWithAudio.has(clip.word))wordsWithAudio.set(clip.word,clip);
 let current=null,currentDay=null;
 const boxes={today:$('studyToday'),grammar:$('studyDaily'),vocab:$('studyVocab'),words:$('studyLibraryContent'),progress:$('studyLibraryContent'),media:$('studyMediaContent'),practice:$('studyPracticeContent'),word:$('studyPracticeContent'),read:$('studyReadingContent'),settings:$('studySettings')};
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
 const library=root.SozStudyLibrary.mount({host:boxes.words,study,model,openWord,savedWords,onChange:storageFeedback,
  openReading:id=>navigate('read/'+id),
  openBanks:()=>navigate('vocab'),reviewBank:level=>navigate('vocab/review/'+level),practiceWord:w=>navigate('word/'+encodeURIComponent(w))});
 const practice=root.SozStudyPractice.mount({host:boxes.practice,study,model,lessons,clips,onChange:storageFeedback,onFinish:()=>navigate(current?.startsWith('word/')?'words':'grammar')});
 const media=root.SozStudyMedia.mount({host:boxes.media,study,model,sources,onChange:storageFeedback});
 const reader=root.SozStudyReader.mount({host:boxes.read,study,model,analyze,navigate,openWord,onChange:storageFeedback});
 const vocab=root.SozStudyVocab.mount({host:boxes.vocab,study,model,navigate,discover:discoverWord,onChange:storageFeedback});
 function discoverWord(day,skipped) {
  const ordinal=Math.floor(Date.parse(day+'T00:00:00Z')/86400000),ratings=study.wordRatings();
  const eligible=word=>{
   const node=model.byWord.get(word);
   return Boolean(node)&&!ratings.has(word)&&!skipped.has(word)&&
    (!model.textLoaded()||Boolean(root.SozStudyAnswer.englishCue(node)));
  };
  const fromReading=study.words().find(record=>record.reading&&eligible(record.key));
  if(fromReading)return model.byWord.get(fromReading.key);
  const bookmarks=Array.from(savedWords?.()||[]),bookmarked=bookmarks.find(word=>eligible(word)&&model.byWord.has(word));
  if(bookmarked)return model.byWord.get(bookmarked);
  const focus=rotate(vocabulary,ordinal).concat(rotate(lessons,ordinal).map(l=>l.word),rotate(clips,ordinal).map(c=>c.word));
  const lesson=focus.find(word=>eligible(word)&&model.byWord.has(word));
  if(lesson)return model.byWord.get(lesson);
  // Keep the deck useful for established learners after the interview vocabulary is covered.
  const ranked=model.commonWords(),offset=1500+(ordinal*17)%Math.max(1,Math.min(ranked.length,14000)-1500);
  return ranked.slice(offset,offset+150).find(node=>eligible(node.w)) || ranked.find(node=>eligible(node.w)) ||
   model.nodes.find(node=>eligible(node.w)) || null;
 }
 function daily() {
  const day=study.day(),ordinal=Math.floor(Date.parse(day+'T00:00:00Z')/86400000);
  const {minutes,speaking}=study.settings(),source=sources[ordinal%sources.length];
  const lessonCandidates=rotate(lessons,ordinal),clipCandidates=rotate(clips,ordinal);
  const lessonCount=minutes>=30?3:minutes>=14?2:1;
  const grammarPlan=study.plan({kind:'lesson',lessons:lessonCandidates.map(l=>l.id),accept:(kind,id)=>lessonsById.has(id),limit:lessonCount,newLimit:lessonCount});
  const clipCount=Math.max(1,Math.min(4,Math.round(minutes/12)));
  const listenPlan=study.plan({kind:'lesson',lessons:clipCandidates.map(c=>c.id),accept:(kind,id)=>clipsById.has(id),limit:clipCount,newLimit:clipCount});
  const speakingLesson=grammarPlan[0]?.key||lessonCandidates[0]?.id;
  const speakTasks=speakingLesson?[{type:'speak',key:speakingLesson}]:[];
  const rows=[
   {key:'phrasing',title:'Grammar & phrasing',description:'Interpret the speaker’s intent and reconstruct the phrase in Azerbaijani.',tasks:grammarPlan.flatMap(({key})=>[{type:'read',key},{type:'grammar',key}])},
   {key:'media',title:'Follow a native speaker',description:source.name+' · '+source.title,source}
  ];
  if(clips.length && (minutes>=10||ordinal%2===0))rows.push({key:'clips',title:'Listen without the transcript',description:'Catch the meaning on a first listen. Replay to find what you missed.',tasks:listenPlan.map(i=>({type:'listen',key:i.key}))});
  if(speaking)rows.push({key:'speaking',title:'Put it in your own words',description:'Use today’s expressions in a fresh sentence and check it against a model.',tasks:speakTasks});
  for(const row of rows) {
   if(row.source){row.done=study.hasAttempt('media:'+day+':'+source.id);row.total=1;row.completed=Number(row.done);}
   else{
    const session=practice.status(row.key);row.total=session?.total??row.tasks.length;row.completed=session?.completed||0;
    row.finished=!!session?.finished;row.done=row.total===0||row.completed===row.total;row.skipped=session?.skipped||0;
   }
  }
  return {rows,source,minutes};
 }
 function startRow(row) {navigate(row.source?'media/'+row.source.id:'practice/'+row.key);}
 function practiceList(rows) {
  const list=element('ul','study-plan-list');
  for(const row of rows){
   const li=element('li','study-plan-row'),copy=element('div');
   copy.append(element('h3','',row.title),element('p','',row.description));
   const text=row.done?(row.total?'Complete':'Up to date'):row.finished?'Finished · '+row.skipped+' skipped':row.completed?'Continue':'Start';
   const action=button(text,'study-button',()=>startRow(row));action.setAttribute('aria-label',row.title+' · '+text);action.dataset.studyTask=row.key;
   if(row.done&&!row.total)action.disabled=true;
   li.append(copy,action);list.append(li);
  }
  return list;
 }
 function renderToday() {
  const {rows,minutes}=daily(),summary=study.summary(model.nodes.length),{target,started,completed,due}=vocab.status(summary);
  const grid=element('div','study-today-grid study-home-grid'),lead=element('section','study-lead');
  const leadTitle=element('div','study-lead-title');
  leadTitle.append(element('h2','','Daily vocabulary'),element('span','study-tally',completed+' / '+target));
  const meter=element('progress');meter.max=target;meter.value=completed;meter.setAttribute('aria-label','New words mastered today');
  const actions=element('div','study-word-actions');
  if(completed<target)actions.append(button(started?'Continue flashcards':'Learn '+target+' words','study-cta',()=>navigate('vocab/new')));
  if(due)actions.append(button('Review '+due+' due','study-button',()=>navigate('vocab/review')));
  if(!actions.childElementCount)actions.append(button('Open word banks','study-button',()=>navigate('vocab')));
  lead.append(leadTitle,meter,element('p','study-note','New words mastered today'),actions);
  const practiceTitle=element('div','study-lead-title');
  practiceTitle.append(element('h2','','Daily study'),element('span','study-note',minutes+' min planned'));
  const planned=element('section','study-section study-planned');
  planned.append(practiceTitle,practiceList(rows),button('Open reading desk','study-text-link',()=>navigate('read')));
  const aside=element('aside','study-day-aside');aside.append(vocab.coverage(summary));
  grid.append(lead,aside,planned);boxes.today.replaceChildren(grid);
 }
 function renderGrammar() {
  const {rows,source}=daily(),grid=element('div','study-today-grid');
  const exercises=element('section','study-section study-planned');
  exercises.append(element('h2','','Today’s exercises'),practiceList(rows));
  const materials=element('aside','study-day-aside'),listen=element('section','study-section');
  const reading=element('section','study-section');
  reading.append(element('h2','','Reading desk'),element('p','','Scan a page, tap words for their meanings, and save them for study.'),
   button('Read a page','study-button',()=>navigate('read')));
  listen.append(element('h2','','Listening desk'),element('p','',source.prompt),button('Open listening desk','study-button',()=>navigate('media')));
  const conjugation=element('section','study-section study-study-reference');
  const link=element('a','study-button','Open verb conjugations');link.href='#grammar=qa%C3%A7maq';
  conjugation.append(element('h2','','Grammar reference'),element('p','','Look up a verb and explore its tenses and forms.'),link);
  materials.append(reading,listen,conjugation);grid.append(exercises,materials);boxes.grammar.replaceChildren(grid);
 }
 function settings() {
  const prefs=study.settings();$('studyMinutes').value=String(prefs.minutes);$('studySpeaking').checked=prefs.speaking;
  $('studyNewWords').value=String(prefs.newWords);$('studyMotion').value=getMotion();$('studySettingsStatus').textContent='';
 }
 $('studySaveSettings').addEventListener('click',()=>{
  const n=Number($('studyMinutes').value),target=Number($('studyNewWords').value),status=$('studySettingsStatus');
  if(!Number.isInteger(n)||n<5||n>90){status.textContent='Choose a whole number from 5 to 90 minutes.';$('studyMinutes').focus();return;}
  if(!Number.isInteger(target)||target<1||target>30){status.textContent='Choose from 1 to 30 new words per day.';$('studyNewWords').focus();return;}
  study.setSettings({minutes:n,speaking:$('studySpeaking').checked,newWords:target});setMotion($('studyMotion').value);
  storageFeedback();status.textContent='Your daily routine has been updated.';
 });
 $('studyExport').addEventListener('click',()=>{
  const status=$('studySettingsStatus');
  try {
   const backup=JSON.parse(study.exportJSON()),pages=reader.exportPages();if(pages.length)backup.readingPages=pages;
   const file=new Blob([JSON.stringify(backup)],{type:'application/json'}),url=URL.createObjectURL(file);
   const a=document.createElement('a');a.href=url;a.download='sozler-study-'+study.day()+'.json';
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   status.textContent='Your backup file is ready to save.';
  }catch{status.textContent='The backup download could not start. Try opening this page directly in your phone’s browser.';}
 });
 $('studyImport').addEventListener('change',async e=>{
  const input=e.currentTarget,file=input.files?.[0],status=$('studySettingsStatus');if(!file)return;
  try{
   const contents=await file.text(),data=JSON.parse(contents),pages=root.SozStudyReader.validatePages(data?.readingPages ?? []);
   const result=study.importJSON(contents),restored=reader.restore(pages);settings();storageFeedback();
   status.textContent='Backup merged. '+result.added+' new '+(result.added===1?'record':'records')+' added. '+result.duplicates+' already on this device.'+
    (pages.length?(restored.saved?' '+restored.added+' reading pages added.':' Reading pages are available for this session. Keep your backup.'):'');
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
  if(current?.startsWith('media'))media.close();
  if(current?.startsWith('vocab'))vocab.close();
  if(current==='read'||current?.startsWith('read/'))reader.close();
  current=null;
 }
 function open(route='today',force=false) {
  if(!force&&route===current&&study.day()===currentDay)return;
  if(route==='practice/words'){navigate(vocab.status().due?'vocab/review':'vocab/new',true);return;}
  close();current=route;currentDay=study.day();
  const boundary=route.indexOf('/'),tab=boundary<0?route:route.slice(0,boundary),key=boundary<0?'':route.slice(boundary+1);
  const bank=tab==='vocab'&&key.startsWith('bank/')?Number(key.slice(5)):null;
  const area=bank===null?boxes[tab]||boxes.today:boxes.words;
  for(const box of new Set(Object.values(boxes)))box.hidden=box!==area;
  const titles={today:'Today',grammar:'Daily study',vocab:'Vocabulary',words:'My words',progress:'My progress',media:'Listening desk',read:'Reading desk',settings:'Settings',word:'Word practice',practice:'Daily practice'};
  let title=titles[tab]||titles.today;
  $('studyDate').textContent=tab==='today'||tab==='grammar'?dates.format(new Date(currentDay+'T12:00:00Z'))+' · Bakı':'';
  const sourceLink=$('studyWordSource');sourceLink.hidden=true;
  if(tab==='words'){
   if(key==='find')title='Find a word';
   library.library({initialScope:key==='find'?'find':'mine'});
  }
  else if(tab==='vocab'){
   if(bank!==null){
    title=root.SozStudyLibrary.levels[bank];library.library({initialScope:'mine',level:bank});
   }else if(!key)vocab.landing();
   else{
    const [mode,level]=key.split('/');
    title=mode==='new'?'New words':'Word review';vocab.open(mode,level===undefined?undefined:Number(level));
   }
  }
  else if(tab==='grammar')renderGrammar();
  else if(tab==='progress')library.progress();
  else if(tab==='media'){
   let word=null;if(key.startsWith('word/'))try{word=model.resolveWord(decodeURIComponent(key.slice(5)));}catch{}
   media.open(word?null:key,word?.w);
  }
  else if(tab==='settings')settings();
  else if(tab==='read')reader.open(key);
  else if(tab==='practice'){
   const row=daily().rows.find(r=>r.key===key);
   if(!row){navigate('today',true);return;}
   title=row.title;practice.start({key:row.key,title:row.title,tasks:row.tasks});
  }else if(tab==='word'){
   let word;try{word=model.resolveWord(decodeURIComponent(key));}catch{}
   if(!word){navigate('words',true);return;}title=word.w;singleWord(word.w);
   const record=study.word(word.w),context=record?.context,reading=record?.reading;
   if(context?.text||context?.source||reading){
    const listening=Boolean(context?.text||context?.source);
    const dest=listening?'media/word/'+encodeURIComponent(word.w):'read/'+reading.pageId;
    sourceLink.textContent=listening?'Revisit my saved excerpt':'Revisit my saved page';sourceLink.href=routeHash(dest);sourceLink.hidden=false;
    sourceLink.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(dest);};
   }
  }else renderToday();
  $('studyHeading').textContent=title;document.title=title+' — SÖZ';storageFeedback();
  $('studyPage').scrollTop=0;$('studyHeading').focus?.({preventScroll:true});
 }
 function resume(){
  if(!current||document.hidden)return;
  study.refresh();storageFeedback();
  if(study.day()!==currentDay || ['today','grammar','words','vocab','progress'].includes(current)||current.startsWith('vocab/bank/'))open(current,true);
 }
 document.addEventListener('visibilitychange',resume);root.addEventListener?.('pageshow',resume);
 return {open,close};
}
root.SozStudyUI={sources,readRoute,routeHash,tabFor,createStore,mount};
})(typeof window!=='undefined'?window:globalThis);
