/* Picture quiz page (#sekil). Pictures appear only on this page, never in the word map. */
(function(root){
'use strict';
const SVG='http://www.w3.org/2000/svg',storageKey='soz-toxumasi:picture-quiz:v1';
function mount({model,html,onMap,onStudyAnswer}){
 const $=id=>document.getElementById(id),page=$('pictureQuizPage'),data=root.WORD_WEB_PICTURES;
 let engine=null;
 try{engine=root.PictureQuiz.createPictureQuiz(model,data);}catch(error){console.error(error);}
 let quiz=null,active=false,storageAvailable=true;
 const settings={mode:'picture',category:'all'},stats={best:{},rounds:0};
 try{const stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(stored&&typeof stored==='object'){if(stored.best&&typeof stored.best==='object')for(const [k,v] of Object.entries(stored.best))if(Number.isInteger(v)&&v>=0&&v<=10)stats.best[k]=v;if(Number.isInteger(stored.rounds)&&stored.rounds>=0)stats.rounds=stored.rounds;if(stored.mode==='picture'||stored.mode==='word')settings.mode=stored.mode;if(stored.category==='all'||engine?.categories.some(c=>c.id===stored.category))settings.category=stored.category;}}catch{}
 function save(){try{localStorage.setItem(storageKey,JSON.stringify({best:stats.best,rounds:stats.rounds,mode:settings.mode,category:settings.category}));}catch{storageAvailable=false;}}
 function picture(item,cls){
  const svg=document.createElementNS(SVG,'svg');
  for(const [k,v] of Object.entries({viewBox:data?.viewBox||'0 0 72 72',fill:'none',stroke:'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(k,v);
  // Markup is checked against a drawing-only allowlist at build time (scripts/build_pictures.py).
  svg.innerHTML=item.svg;if(cls)svg.setAttribute('class',cls);return svg;
 }
 const categoryLabel=id=>id==='all'?'Hamısı':engine.categories.find(c=>c.id===id)?.label||id;
 function definition(word){const n=model.byWord.get(word),info=root.WordInfo?.describeWord?.(n,model.byWord);return {az:info?.definition||n.az||'',en:info?.definitionEnglish||n.en||''};}
 // While a question is open the page is locked to one screen: the picture shrinks to fit, nothing scrolls.
 function show(section){for(const id of ['pictureIntro','picturePlay','pictureResults'])$(id).hidden=id!==section;page.classList.toggle('is-playing',section==='picturePlay');page.scrollTop=0;}
 function renderIntro(){
  for(const b of page.querySelectorAll('[data-picture-mode]'))b.setAttribute('aria-pressed',String(b.dataset.pictureMode===settings.mode));
  const holder=$('pictureCategories');holder.replaceChildren();
  for(const c of [{id:'all',label:'Hamısı',count:engine.items.length},...engine.categories]){
   const b=html('button','picture-chip');b.type='button';b.append(html('span','',c.label),html('small','',String(c.count)));
   b.setAttribute('aria-pressed',String(c.id===settings.category));b.onclick=()=>{settings.category=c.id;save();renderIntro();};holder.append(b);
  }
  const best=stats.best[settings.mode+':'+settings.category];
  $('pictureBest').textContent=(best!==undefined?`Bu seçimdə ən yaxşı nəticə: ${best} / 10. `:'')+(stats.rounds?`Tamamlanmış sınaq: ${stats.rounds}.`:'Hər sınaq 10 sualdır.');
  $('pictureCount').textContent=engine.items.length.toLocaleString('az')+' şəkil';
  $('pictureProgress').textContent='';
 }
 for(const b of page.querySelectorAll('[data-picture-mode]'))b.onclick=()=>{settings.mode=b.dataset.pictureMode;save();renderIntro();};
 function scoreText(){return `${quiz.index+1} / ${quiz.questions.length} · ${quiz.answers.filter(a=>a.correct).length} doğru`;}
 function start(words=null){
  quiz=engine.round({mode:settings.mode,category:settings.category,words});quiz.review=!!words;
  show('picturePlay');question();
 }
 function question(){
  const q=quiz.questions[quiz.index],stage=$('pictureStage'),options=$('pictureOptions');
  $('pictureProgress').textContent=scoreText();$('pictureMeter').max=quiz.questions.length;$('pictureMeter').value=quiz.answers.length;
  stage.replaceChildren();options.replaceChildren();
  if(quiz.mode==='picture'){
   $('picturePrompt').textContent='Bu şəkildə nə var?';stage.className='picture-stage';
   stage.setAttribute('role','img');stage.setAttribute('aria-label','Tapılacaq şəkil');stage.append(picture(q.answer));
  }else{
   $('picturePrompt').textContent='Bu söz hansı şəkildir?';stage.className='picture-stage is-word';
   stage.removeAttribute('role');stage.removeAttribute('aria-label');const w=html('p','stage-word',q.answer.word);w.lang='az';stage.append(w);
  }
  options.className='picture-options '+(quiz.mode==='word'?'is-pictures':'is-words');$('picturePlay').classList.toggle('is-word',quiz.mode==='word');
  q.options.forEach((item,index)=>{
   const b=html('button','picture-option'),number=html('span','option-number',String(index+1));b.type='button';b.dataset.word=item.word;number.setAttribute('aria-hidden','true');b.append(number);
   if(quiz.mode==='word'){b.append(picture(item));b.setAttribute('aria-label','Şəkil '+(index+1));}
   else{const label=html('span','option-word',item.word);label.lang='az';b.append(label);}
   b.onclick=()=>submit(item.word);options.append(b);
  });
  $('pictureFeedback').replaceChildren();$('pictureFeedback').hidden=true;$('pictureNext').hidden=true;$('pictureHint').hidden=false;
  $('picturePrompt').focus({preventScroll:true});
 }
 function submit(word){
  const result=engine.answer(quiz,word);if(!result)return;
  onStudyAnswer?.(result);
  const q=quiz.questions[quiz.index];
  for(const b of $('pictureOptions').children){
   b.disabled=true;const correct=b.dataset.word===q.answer.word,chosen=b.dataset.word===word;
   b.classList.toggle('correct',correct);b.classList.toggle('incorrect',chosen&&!correct);
   if(correct||chosen){
    if(quiz.mode==='word'){const caption=html('span','option-caption',b.dataset.word);caption.lang='az';b.append(caption);}
    const mark=html('span','answer-mark',correct?'✓':'×');mark.setAttribute('aria-hidden','true');b.append(mark);
    b.setAttribute('aria-label',b.dataset.word+(correct?' — düzgün cavab':' — seçdiyin cavab, səhv'));
   }
  }
  if(quiz.mode==='picture')$('pictureStage').setAttribute('aria-label','Şəkil: '+q.answer.word);
  // Compact result: mark, word, map link, a two-line definition and the English gloss, beside the Next button.
  const feedback=$('pictureFeedback'),d=definition(q.answer.word),head=html('p','feedback-head');feedback.hidden=false;$('pictureHint').hidden=true;
  feedback.classList.toggle('is-correct',result.correct);
  head.append(html('span','feedback-mark',result.correct?'✓':'×'),html('strong','feedback-status',result.correct?'Doğrudur.':'Bu dəfə alınmadı.'),' ');
  if(!result.correct)head.append(html('span','feedback-label','Düzgün cavab:'));
  const named=html('span','feedback-word',q.answer.word);named.lang='az';head.append(named);
  const open=html('button','quiet-link feedback-map','↗');open.type='button';open.setAttribute('aria-label',q.answer.word+' sözünü xəritədə aç');open.title='Sözü xəritədə aç';open.onclick=()=>onMap(q.answer.word);head.append(open);
  const az=html('p','feedback-az',d.az),en=html('p','feedback-en',d.en);az.lang='az';en.lang='en';feedback.append(head,az,en);
  $('pictureProgress').textContent=scoreText();$('pictureMeter').value=quiz.answers.length;
  $('pictureNext').replaceChildren(html('span','next-label',quiz.index===quiz.questions.length-1?'Nəticə':'Növbəti'),' →');$('pictureNext').hidden=false;$('pictureNext').focus({preventScroll:true});
 }
 function finish(){
  show('pictureResults');
  const score=quiz.answers.filter(a=>a.correct).length,missed=quiz.answers.filter(a=>!a.correct);
  $('pictureResultScore').textContent=`${score} / ${quiz.questions.length}`;$('pictureProgress').textContent='';
  if(!quiz.review){const key=quiz.mode+':'+quiz.category;stats.best[key]=Math.max(stats.best[key]||0,score);stats.rounds++;save();}
  $('pictureResultText').textContent=(missed.length?`${missed.length} sözü bir daha nəzərdən keçir.`:'Hamısı doğru!')+` Mövzu: ${categoryLabel(quiz.category)}.`+(!storageAvailable?' Nəticə yalnız bu sessiyada saxlanır.':'');
  $('pictureRetry').hidden=!missed.length;
  const review=$('pictureReview');review.replaceChildren();
  quiz.questions.forEach((q,i)=>{
   const a=quiz.answers[i],row=html('article','picture-review-row'+(a.correct?' is-correct':' is-wrong')),text=html('div','review-text'),heading=html('div','review-heading');
   const mark=html('span','review-mark',a.correct?'✓':'×'),open=html('button','review-word',q.answer.word+' ↗');open.type='button';open.lang='az';open.onclick=()=>onMap(q.answer.word);
   heading.append(mark,open);text.append(heading);if(!a.correct){const chosen=html('small','review-chosen',`Seçimin: ${a.chosen}`);text.append(chosen);}
   const en=html('small','review-en',model.byWord.get(q.answer.word).en||'');en.lang='en';text.append(en);
   row.append(picture(q.answer,'review-picture'),text);review.append(row);
  });
  $('pictureResultScore').focus({preventScroll:true});
 }
 $('pictureStart').onclick=()=>start();$('pictureAgain').onclick=()=>start();
 $('pictureRetry').onclick=()=>start(quiz.answers.filter(a=>!a.correct).map(a=>a.word));
 $('pictureChange').onclick=()=>{quiz=null;renderIntro();show('pictureIntro');$('pictureQuizTitle').focus({preventScroll:true});};
 $('pictureNext').onclick=()=>{if(engine.next(quiz)){if(quiz.complete)finish();else question();}};
 page.addEventListener('keydown',e=>{
  if(!active||!quiz||quiz.complete||e.altKey||e.ctrlKey||e.metaKey||e.repeat||$('picturePlay').hidden)return;
  if(/^[1-4]$/.test(e.key)&&quiz.answers.length===quiz.index){e.preventDefault();submit(quiz.questions[quiz.index].options[Number(e.key)-1].word);}
  else if(e.key==='Enter'&&!$('pictureNext').hidden&&e.target.tagName!=='BUTTON'){e.preventDefault();$('pictureNext').click();}
 });
 function open(){
  active=true;
  if(!engine){$('pictureIntro').hidden=false;$('pictureBest').textContent='Şəkillər bu brauzerdə yüklənmədi.';$('pictureStart').disabled=true;return;}
  if(quiz&&!quiz.complete){show('picturePlay');(quiz.answers.length>quiz.index?$('pictureNext'):$('picturePrompt')).focus({preventScroll:true});return;}
  if(quiz&&quiz.complete){show('pictureResults');$('pictureResultScore').focus({preventScroll:true});return;}
  renderIntro();show('pictureIntro');$('pictureQuizTitle').focus({preventScroll:true});
 }
 function close(){active=false;}
 return {open,close,get active(){return active;},engine};
}
root.PictureQuizUI={mount};
})(window);
