(function(root){
'use strict';

const levels=['Don’t know yet','Know a little','Know well','Use proficiently'];
const collator=new Intl.Collator('az');
const numbers=new Intl.NumberFormat('en');
const pageSize=15;
const count=(n,noun)=>numbers.format(n)+' '+noun+(n===1?'':'s');

function mount({host,study,model,openWord,practiceWord,onChange,savedWords}){
 const document=host.ownerDocument;
 const fold=root.WordWeb.normalize;
 let scope='mine',filter='all',sort='recent',mineQuery='',atlasQuery='',page=0,placing=false;
 let records=[],byWord=new Map(),placementIndex=0,searchTimer=0;
 let libraryUI=null;

 function make(tag,cls,text){
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=text;
  return el;
 }
 function button(text,cls,action){
  const b=make('button',cls,text);
  b.type='button';
  b.addEventListener('click',action);
  return b;
 }
 function note(text){return make('p','study-note',text);}
 function section(title){
  const part=make('section','study-section');
  part.append(make('h2','',title));
  return part;
 }
 function select(label,options,value,onSelect){
  const control=make('select','study-input study-select');
  control.setAttribute('aria-label',label);
  for(const [v,text] of options){
   const option=make('option','',text);
   option.value=String(v);
   if(String(v)===String(value))option.selected=true;
   control.append(option);
  }
  control.addEventListener('change',()=>onSelect(control.value));
  return control;
 }
 function readRecords(){
  records=study.words().slice().sort((a,b)=>collator.compare(a.key,b.key));
  byWord=new Map(records.map(record=>[record.key,record]));
 }
 function refreshWord(word){
  const current=study.word(word);
  let lo=0,hi=records.length;
  while(lo<hi){
   const mid=Math.floor((lo+hi)/2);
   if(collator.compare(records[mid].key,word)<0)lo=mid+1;else hi=mid;
  }
  while(lo<records.length&&collator.compare(records[lo].key,word)===0&&records[lo].key!==word)lo++;
  records.splice(lo,records[lo]?.key===word?1:0,current);
  byWord.set(word,current);
 }
 function definition(n){
  const gloss=make('p','study-word-gloss',n.en||'');
  gloss.lang='en';
  if(!n.en&&!model.primaryReady(n)){
   const result=model.ensurePrimary(n);
   if(result&&typeof result.then==='function')result.then(()=>{gloss.textContent=n.en||'';},()=>{});
   else gloss.textContent=n.en||'';
  }
  return gloss;
 }
 function saveRating(word,rating){
  study.rateWord(word,rating);
  refreshWord(word);
  if(libraryUI)libraryUI.message.textContent=rating===null?'Rating cleared for '+word+'.':word+' · '+levels[rating];
  if(onChange)onChange();
 }
 function addWord(word){
  study.trackWord(word);
  refreshWord(word);
  if(libraryUI)libraryUI.message.textContent=word+' added to your library.';
  if(onChange)onChange();
 }
 function appendContext(body,context){
  if(!context)return;
  if(context.text){
   const phrase=make('blockquote','study-word-phrase',context.text);
   phrase.lang='az';body.append(phrase);
  }
  if(!context.source)return;
  const source=make('small','study-word-source');
  let url;
  try{
   const candidate=new URL(context.source);
   if((candidate.protocol==='https:'||candidate.protocol==='http:')&&!candidate.username&&!candidate.password)url=candidate.href;
  }catch{}
  if(url){
   const link=make('a','','Open source');
   link.href=root.SozStudyMedia?.linkAtTime(url,context.seconds)||url;
   link.target='_blank';link.rel='noopener noreferrer';source.append(link);
  }else source.textContent=context.source;
  if(Number.isInteger(context.seconds)&&context.seconds>=0){
   const time=root.SozStudyMedia?.timeLabel(context.seconds)??(Math.floor(context.seconds/60)+':'+String(context.seconds%60).padStart(2,'0'));
   source.append(document.createTextNode(' · '+time));
  }
  body.append(source);
 }
 function wordEvidence(record){
  const {recognize,listen,recall,use}=record.evidence;
  const attempts=recognize.attempts+listen.attempts+recall.attempts+use.attempts;
  if(!attempts)return '';
  const details=[count(attempts,'practice answer')];
  if(listen.attempts)details.push(numbers.format(listen.unaided)+' correct on the first listen');
  if(use.attempts)details.push(count(use.unaided,'independent use'));
  return details.join(' · ');
 }
 function wordRow(n,record){
  const row=make('li','study-word-row');
  row.dataset.word=n.w;
  const body=make('div','study-word-main');
  const name=button(n.w,'study-word-name',()=>openWord(n.w));
  name.lang='az';
  name.setAttribute('aria-label','Open '+n.w+' in the atlas');
  body.append(name,definition(n));
  if(record){
   appendContext(body,record.context);
   const evidence=wordEvidence(record);
   if(evidence)body.append(make('small','study-word-evidence',evidence));
  }
  const actions=make('div','study-word-actions');
  const options=[['',record?'Not rated':'Rate this word'],...levels.map((label,i)=>[i,label])];
  const rating=select('Your level for '+n.w,options,record?.rating??'',value=>{
   saveRating(n.w,value===''?null:Number(value));
   renderResults({word:n.w,action:'rating'});
  });
  rating.dataset.action='rating';
  actions.append(rating);
  if(!record){
   const add=button('Add to library','study-button study-secondary',()=>{
    addWord(n.w);renderResults({word:n.w,action:'practice'});
   });
   actions.append(add);
  }else{
   const practice=button('Practice','study-button study-secondary',()=>practiceWord(n.w));
   practice.dataset.action='practice';
   practice.setAttribute('aria-label','Practice '+n.w);
   actions.append(practice);
  }
  row.append(body,actions);
  return row;
 }
 function list(nodes){
  const rows=make('ul','study-word-list');
  const fragment=document.createDocumentFragment();
  for(const n of nodes)fragment.append(wordRow(n,byWord.get(n.w)));
  rows.append(fragment);return rows;
 }
 function restoreRowFocus(container,focus){
  if(!focus)return;
  for(const row of container.querySelectorAll('[data-word]'))if(row.dataset.word===focus.word){
   row.querySelector('[data-action="'+focus.action+'"]')?.focus?.({preventScroll:true});
   return;
  }
  libraryUI.message.focus?.({preventScroll:true});
 }
 function empty(message){
  return make('p','study-empty',message);
 }
 function renderPlacement(){
  const part=section('Rate common words');
  const ranked=model.commonWords();
  while(placementIndex<ranked.length&&byWord.get(ranked[placementIndex].w)?.rating!=null)placementIndex++;
  const n=ranked[placementIndex];
  if(!n){
   part.append(empty('You’ve reached the end of the frequency list. Search the atlas to add another word.'));
  }else{
   const rank=model.frequency(n)?.rank;
   if(rank)part.append(make('small','study-tag','Corpus rank '+numbers.format(rank)));
   const word=make('h3','study-placement-word',n.w);
   word.lang='az';word.tabIndex=-1;part.append(word);
   const reveal=make('details','study-placement-meaning');
   reveal.append(make('summary','','Show meaning'),definition(n));part.append(reveal);
   const choices=make('div','study-rating-options');
   choices.setAttribute('role','group');choices.setAttribute('aria-label','Your level for '+n.w);
   for(const [i,label] of levels.entries()){
    choices.append(button(label,'study-button study-secondary',()=>{
     placementIndex++;saveRating(n.w,i);renderResults();focusPlacement();
    }));
   }
   part.append(choices,button('Skip this word','study-text-button',()=>{placementIndex++;renderResults();focusPlacement();}));
  }
  part.append(button('Finish rating','study-text-button',()=>{placing=false;library();libraryUI.search.focus();}));
  return part;
 }
 function focusPlacement(){
  libraryUI?.results.querySelector('.study-placement-word')?.focus?.({preventScroll:true});
 }
 function matches(record,day,query){
  if(filter==='due'&&(!record.due||record.due>day))return false;
  if(filter==='unrated'&&record.rating!==null)return false;
  if(filter==='note'&&!record.context?.text&&!record.context?.source)return false;
  if(filter==='both'&&!(record.evidence.listen.unaided&&record.evidence.use.unaided))return false;
  if(/^\d$/.test(filter)&&record.rating!==Number(filter))return false;
  if(!query)return true;
  const n=model.byWord.get(record.key);
  return [record.key,n?.en,n?.az,record.context?.text,record.context?.source].some(x=>x&&fold(x).includes(query));
 }
 function paginate(total){
  const nav=make('nav','study-pagination');
  nav.setAttribute('aria-label','Library results');
  const max=Math.ceil(total/pageSize);
  function turn(change){
   page+=change;renderResults();
   const first=libraryUI.results.querySelector('.study-word-name');
   first?.focus?.({preventScroll:true});
   libraryUI.results.scrollIntoView?.({block:'nearest'});
  }
  const prev=button('Previous','study-button study-secondary',()=>turn(-1));
  const next=button('Next','study-button study-secondary',()=>turn(1));
  prev.disabled=page===0;next.disabled=page>=max-1;
  nav.append(prev,make('span','study-note','Page '+(page+1)+' of '+max),next);
  return nav;
 }
 function renderMine(results){
  const query=fold(mineQuery.trim()),day=study.day();
  const entries=records.filter(record=>matches(record,day,query));
  if(sort==='recent')entries.sort((a,b)=>b.added.localeCompare(a.added));
  if(sort==='due')entries.sort((a,b)=>a.due.localeCompare(b.due));
  page=Math.min(page,Math.max(0,Math.ceil(entries.length/pageSize)-1));
  if(!entries.length){
   results.append(empty(records.length?'No library words match these filters.':'Your library is ready. Add something you heard recently, or rate a word you already use.'));
   if(!records.length)results.append(button('Find a word','study-button',()=>changeScope('find',true)));
   return;
  }
  const first=page*pageSize,shown=entries.slice(first,first+pageSize);
  if(entries.length>pageSize)results.append(note((first+1)+'–'+(first+shown.length)+' of '+count(entries.length,'word')));
  results.append(list(shown.map(r=>model.byWord.get(r.key)).filter(Boolean)));
  if(entries.length>pageSize)results.append(paginate(entries.length));
 }
 function renderFind(results){
  if(placing){results.append(renderPlacement());return;}
  const query=atlasQuery.trim();
  if(query){
   const options=model.search(query,12);
   const exact=model.resolveWord(query);
   const nodes=exact?[exact,...options.filter(n=>n.w!==exact.w)].slice(0,12):options;
   if(nodes.length)results.append(list(nodes));else results.append(empty('No atlas headword matches this search.'));
   return;
  }
  if(typeof savedWords==='function'){
   const saved=Array.from(savedWords()||[],word=>model.byWord.get(word)).filter(n=>n&&!byWord.has(n.w));
   if(saved.length){
    const part=section('Your atlas bookmarks');
    part.append(note('Add a bookmark to your study library when you want to practice it.'));
    page=Math.min(page,Math.ceil(saved.length/pageSize)-1);
    part.append(list(saved.slice(page*pageSize,(page+1)*pageSize)));
    if(saved.length>pageSize)part.append(paginate(saved.length));
    results.append(part);
   }
  }
  const placement=section('Build your starting library');
  placement.append(note('Quickly rate words you already encounter, starting with the most frequent.'),button('Rate common words','study-button study-secondary',()=>{
   placing=true;library();focusPlacement();
  }));
  results.append(placement);
 }
 function renderResults(focus=null){
  if(!libraryUI||!host.contains(libraryUI.page))return;
  const {results,description}=libraryUI;
  description.textContent=count(records.length,'word')+' in your personal library';
  results.replaceChildren();
  if(scope==='mine')renderMine(results);else renderFind(results);
  restoreRowFocus(results,focus);
 }
 function changeScope(next,focus=false){
  scope=next;page=0;placing=false;library();
  if(focus)libraryUI.search.focus();
 }
 function library(){
  clearTimeout(searchTimer);
  readRecords();
  const container=make('div','study-library');
  const description=note('');container.append(description);
  const toolbar=make('div','study-library-toolbar'),switcher=make('div','study-segmented');
  switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Choose where to look for words');
  for(const [key,text] of [['mine','My words'],['find','Find words']]){
   const b=button(text,'study-tab',()=>changeScope(key));
   b.setAttribute('aria-pressed',String(scope===key));switcher.append(b);
  }
  toolbar.append(switcher);
  const search=make('input','study-input study-search');
  search.type='search';search.autocomplete='off';search.spellcheck=false;
  search.id='studyWordSearch';search.value=scope==='mine'?mineQuery:atlasQuery;
  const label=make('label','study-input-label',scope==='mine'?'Search your library':'Search the Azerbaijani atlas');
  label.htmlFor=search.id;search.setAttribute('aria-label',label.textContent);
  search.placeholder=scope==='mine'?'Word, meaning, or saved phrase':'Azerbaijani word or English meaning';
  search.addEventListener('input',()=>{
   page=0;
   if(scope==='mine')mineQuery=search.value;else atlasQuery=search.value;
   clearTimeout(searchTimer);
   if(scope==='find'&&search.value.trim())searchTimer=setTimeout(renderResults,150);
   else renderResults();
  });
  search.addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(searchTimer);renderResults();}});
  if(!placing)toolbar.append(label,search);
  if(scope==='mine'){
   const options=[['all','All levels'],['due','Due for review'],['note','With a saved context'],['both','Understood and used independently'],['unrated','Not rated'],...levels.map((v,i)=>[i,v])];
   const controls=make('div','study-library-filters');
   controls.append(select('Filter your library',options,filter,value=>{filter=value;page=0;renderResults();}),
    select('Sort your library',[['recent','Recently added'],['az','Alphabetical'],['due','Next review']],sort,value=>{sort=value;page=0;renderResults();}));
   toolbar.append(controls);
  }
  const results=make('div','study-library-results'),message=make('p','study-library-status');
  message.setAttribute('role','status');message.tabIndex=-1;
  container.append(toolbar,message,results);host.replaceChildren(container);
  libraryUI={page:container,results,message,description,search};renderResults();
 }

 function overallEvidence(items){
  const bySkill={listened:0,used:0,both:0};
  for(const record of items){
   const listen=record.evidence.listen.unaided>0,use=record.evidence.use.unaided>0;
   if(listen)bySkill.listened++;if(use)bySkill.used++;if(listen&&use)bySkill.both++;
  }
  return bySkill;
 }
 function metric(value,label){
  const item=make('div','study-metric');
  item.append(make('strong','',numbers.format(value)),make('span','',label));return item;
 }
 function progressRow(title,value,total,caption){
  const row=make('div','study-coverage-row');
  row.append(make('strong','',title),make('span','study-coverage-count',numbers.format(value)+' of '+numbers.format(total)));
  if(total>0){
   const meter=make('progress','study-coverage-bar');meter.max=total;meter.value=value;
   meter.setAttribute('aria-label',title);row.append(meter);
  }
  if(caption)row.append(make('small','study-note',caption));
  return row;
 }
 function week(summary){
  const part=section('This week'),list=make('ol','study-week');
  const start=new Date(summary.day+'T12:00:00Z');
  start.setUTCDate(start.getUTCDate()-6);
  const history=new Map(summary.history.map(d=>[d.day,d]));
  const weekdays=new Intl.DateTimeFormat('en',{weekday:'short',timeZone:'UTC'});
  const exactDate=new Intl.DateTimeFormat('en',{month:'long',day:'numeric',timeZone:'UTC'});
  const days=[];
  let firstListen=0,firstUse=0,added=0,proficientChange=0;
  for(let i=0;i<7;i++){
   const day=start.toISOString().slice(0,10),record=history.get(day);
   firstListen+=record?.firstListen||0;firstUse+=record?.firstUse||0;added+=record?.added||0;
   proficientChange+=record?.proficientChange||0;
   days.push({day,label:weekdays.format(start),date:exactDate.format(start),attempts:record?.attempts||0,ratings:record?.ratings||0});
   start.setUTCDate(start.getUTCDate()+1);
  }
  const max=Math.max(1,...days.map(d=>d.attempts));
  for(const d of days){
   const item=make('li','study-week-day'),time=make('time','',d.label);
   time.setAttribute('datetime',d.day);
   const display=make('strong','',String(d.attempts));
   item.setAttribute('aria-label',d.date+', '+count(d.attempts,'practice answer')+', '+count(d.ratings,'word rating'));
   item.title=item.getAttribute('aria-label');item.dataset.active=String(Boolean(d.attempts||d.ratings));
   item.style.setProperty('--study-day-height',Math.round(d.attempts/max*100)+'%');
   item.append(time,display);list.append(item);
  }
  const attempts=days.reduce((n,d)=>n+d.attempts,0),active=days.filter(d=>d.attempts||d.ratings).length;
  part.append(note(count(attempts,'practice answer')+' in the last seven days · '+count(active,'active day')),list);
  if(added||firstListen||firstUse||proficientChange){
   const gains=make('ul','study-week-gains');
   if(added)gains.append(make('li','',count(added,'word')+' added to your library'));
   if(firstListen)gains.append(make('li','',count(firstListen,'new word')+' understood on the first listen'));
   if(firstUse)gains.append(make('li','',count(firstUse,'new word')+' used independently in a sentence'));
   if(proficientChange)gains.append(make('li','',numbers.format(Math.abs(proficientChange))+(proficientChange>0?' more':' fewer')+' in your self-rated proficient group'));
   part.append(gains);
  }
  return part;
 }
 function skills(lessons){
  const part=section('Grammar in context');
  const content=new Map((root.SozStudyContent||[]).map(item=>[item.id,item]));
  const skills=new Map();
  for(const lesson of lessons){
   const entry=content.get(lesson.key);if(!entry)continue;
   const {recognize,listen,recall,use}=lesson.evidence;
   const understanding=recognize.attempts+listen.attempts,production=recall.attempts+use.attempts;
   if(!understanding&&!production)continue;
   const row=skills.get(entry.skill)||{reading:0,readCorrect:0,using:0,useCorrect:0};
   row.reading+=understanding;row.readCorrect+=recognize.correct+listen.correct;
   row.using+=production;row.useCorrect+=recall.correct+use.correct;skills.set(entry.skill,row);
  }
  if(!skills.size){part.append(note('Your first grammar exercise will appear here with the pattern you practiced.'));return part;}
  const dl=make('dl','study-grammar-skills');
  for(const [key,record] of skills){
   const evidence=[];
   if(record.reading)evidence.push(record.readCorrect+'/'+record.reading+' comprehension');
   if(record.using)evidence.push(record.useCorrect+'/'+record.using+' production');
   dl.append(make('dt','',key),make('dd','',evidence.join(' · ')));
  }
  part.append(dl);return part;
 }
 function progress(){
  clearTimeout(searchTimer);libraryUI=null;readRecords();
  const summary=study.summary(model.nodes.length),evidence=overallEvidence(records);
  const container=make('div','study-progress');
  container.append(note(count(summary.tracked,'word')+' in your library'));
  const mastery=section('Understanding and using words');
  mastery.append(note('These counts show where you understood a word at normal speed on the first listen and where you reported using it independently in your own sentence.'));
  const metrics=make('div','study-metrics');
  metrics.append(metric(evidence.listened,'Understood on first listen'),metric(evidence.used,'Used in a sentence'),metric(evidence.both,'Words with both'));
  mastery.append(metrics);container.append(mastery,week(summary));

  const confidence=section('Your word ratings'),ratingList=make('dl','study-rating-counts');
  levels.forEach((text,i)=>ratingList.append(make('dt','',text),make('dd','',numbers.format(summary.ratings[i]))));
  ratingList.append(make('dt','','In your library, not rated'),make('dd','',numbers.format(summary.tracked-summary.assessed)));
  confidence.append(ratingList);
  const due=records.filter(r=>r.due&&r.due<=summary.day).sort((a,b)=>a.due.localeCompare(b.due));
  if(due.length){
   confidence.append(note(count(due.length,'word')+' due for review'));
   const links=make('div','study-word-actions');
   for(const r of due.slice(0,3)){
    const link=button(r.key,'study-text-button',()=>practiceWord(r.key));
    link.lang='az';link.setAttribute('aria-label','Review '+r.key);links.append(link);
   }
   confidence.append(links);
  }
  container.append(confidence);

  const coverage=section('Your place in the atlas'),bars=make('div','study-coverage');
  bars.append(progressRow('Atlas words rated',summary.assessed,model.nodes.length,count(summary.unassessed,'headword')+' still to assess'));
  const ranked=model.commonWords();
  for(const limit of [1000,5000]){
   const top=ranked.slice(0,limit);
   if(!top.length||limit===5000&&ranked.length<=1000)continue;
   const rated=top.filter(n=>byWord.get(n.w)?.rating!=null);
   const proficient=rated.filter(n=>byWord.get(n.w).rating===3).length;
   bars.append(progressRow('Most frequent '+numbers.format(top.length)+' words',rated.length,top.length,count(proficient,'word')+' you rate proficient'));
  }
  coverage.append(bars);container.append(coverage,skills(study.lessons()));
  host.replaceChildren(container);
 }
 return {library,progress};
}

root.SozStudyLibrary={mount,levels};
})(typeof window!=='undefined'?window:globalThis);
