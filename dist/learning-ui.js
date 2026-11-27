(function(root){
'use strict';
function mount({model,select,html,onStudyAnswer}){
 const $=id=>document.getElementById(id),learning=root.WordLearning.createLearning(model,root.WORD_WEB_LEARNING),storageKey='soz-toxumasi:quiz:v1';
 let quiz=null,today=null,stats={best:0,rounds:0},storageAvailable=true;
 try{const stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(stored&&Number.isInteger(stored.best)&&stored.best>=0&&stored.best<=10&&Number.isInteger(stored.rounds)&&stored.rounds>=0)stats=stored;}catch{}
 function best(){ $('quizBest').textContent=stats.rounds?`Ən yaxşı nəticə: ${stats.best}/10 · ${stats.rounds} sınaq`:'Hər sınaq yeni bir başlanğıcdır.'; }
 function refreshDaily(){
  const next=learning.daily();if(today?.date===next.date)return;today=next;
  $('dailyPreview').textContent=today.word.w;$('dailyButton').setAttribute('aria-label','Günün sözü: '+today.word.w);
  $('dailyWord').textContent=today.word.w;$('dailyDate').textContent=new Intl.DateTimeFormat('az',{timeZone:'Asia/Baku',day:'numeric',month:'long',year:'numeric'}).format(new Date(today.date+'T12:00:00+04:00'));
  const info=root.WordInfo.describeWord(today.word,model.byWord);$('dailyAz').textContent=info.definition;$('dailyEn').textContent=info.definitionEnglish;
  $('dailyPos').textContent=today.word.orthographyPage?'orfoqrafiya lüğətindən':today.word.topic==='Wiktionary'?'söz xəritəsindən':today.word.topic||'söz xəritəsindən';
  const example=$('dailyExample');example.replaceChildren();example.hidden=!info.example;
  if(info.example){const az=html('p','',info.example[0]),en=html('p','',info.example[1]);az.lang='az';en.lang='en';example.append(az,en);}
 }
 function openWord(word,dialog){dialog.close();select(model.byWord.get(word));$('meaningWord').setAttribute('tabindex','-1');$('meaningWord').focus({preventScroll:true});}
 $('dailyButton').onclick=()=>{refreshDaily();$('dailyDialog').showModal();};
 $('dailyExplore').onclick=()=>{refreshDaily();openWord(today.word.w,$('dailyDialog'));};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDaily();});
 root.addEventListener('focus',refreshDaily);
 root.setInterval(()=>{if(!document.hidden)refreshDaily();},30000);
 refreshDaily();best();
 function openQuiz(){best();$('quizDialog').showModal();if(quiz&&!quiz.complete){const answered=quiz.answers.length>quiz.index;(answered?$('quizNext'):$('quizPrompt')).focus();}}
 $('quizButton').onclick=openQuiz;
 function start(words=null){quiz=learning.round({words});quiz.review=!!words;$('quizIntro').hidden=true;$('quizResults').hidden=true;$('quizPlay').hidden=false;showQuestion();}
 $('quizStart').onclick=() =>start();$('quizAgain').onclick=()=>start();
 $('quizRetry').onclick=()=>start(quiz.answers.filter(a=>!a.correct).map(a=>a.word));
 function showQuestion(){
  const q=quiz.questions[quiz.index];$('quizTitle').textContent=quiz.review?'Bir daha yoxlayaq.':'Mənanı tanı, sözü tap.';
  $('quizProgress').textContent=`Sual ${quiz.index+1} / ${quiz.questions.length}`;$('quizScore').textContent=`${quiz.answers.filter(a=>a.correct).length} doğru`;
  $('quizMeter').max=quiz.questions.length;$('quizMeter').value=quiz.answers.length;
  $('quizClueAz').textContent=q.az;$('quizClueEn').textContent=q.en;$('quizFeedback').replaceChildren();$('quizFeedback').hidden=true;$('quizNext').hidden=true;
  const options=$('quizOptions');options.replaceChildren();
  q.options.forEach((word,index)=>{const button=html('button','quiz-option'),number=html('span','option-number',String(index+1)),label=html('span','option-word',word);number.setAttribute('aria-hidden','true');button.append(number,label);button.dataset.word=word;button.onclick=()=>submit(word);options.append(button);});
  $('quizPrompt').focus();
 }
 function submit(word){
  const result=learning.answer(quiz,word);if(!result)return;
  onStudyAnswer?.(result);
  const q=quiz.questions[quiz.index];for(const b of $('quizOptions').children){b.disabled=true;const correct=b.dataset.word===q.word;b.classList.toggle('correct',correct);b.classList.toggle('incorrect',!result.correct&&b.dataset.word===word);if(correct||b.dataset.word===word){const mark=html('span','answer-mark',correct?'✓':'×');mark.setAttribute('aria-hidden','true');b.append(mark);b.setAttribute('aria-label',b.dataset.word+(correct?' — düzgün cavab':' — seçdiyin cavab, səhv'));}}
  const feedback=$('quizFeedback');feedback.hidden=false;feedback.classList.toggle('is-correct',result.correct);feedback.append(html('strong','',result.correct?'Doğrudur.':'Bu dəfə alınmadı. Düzgün cavab: '+q.word));
  const az=html('p','',q.az),en=html('p','',q.en);az.lang='az';en.lang='en';feedback.append(az,en);
  $('quizScore').textContent=`${quiz.answers.filter(a=>a.correct).length} doğru`;$('quizMeter').value=quiz.answers.length;
  $('quizNext').textContent=quiz.index===quiz.questions.length-1?'Nəticəyə bax →':'Növbəti sual →';$('quizNext').hidden=false;$('quizNext').focus();
 }
 function finish(){
  $('quizPlay').hidden=true;$('quizResults').hidden=false;$('quizTitle').textContent='Hər söz bir addımdır.';
  const score=quiz.answers.filter(a=>a.correct).length,missed=quiz.answers.filter(a=>!a.correct);$('quizResultScore').textContent=`${score} / ${quiz.questions.length}`;
  if(!quiz.review){stats.best=Math.max(stats.best,score);stats.rounds++;try{localStorage.setItem(storageKey,JSON.stringify(stats));}catch{storageAvailable=false;}best();}
  $('quizResultText').textContent=(missed.length?`${missed.length} sözü bir daha nəzərdən keçir. İstədiyin sözü xəritədə aça bilərsən.`:'Hamısı doğru! Yeni sözlərlə davam edə bilərsən.')+(!storageAvailable?' Nəticə yalnız bu sessiyada saxlanır.':'');
  $('quizRetry').hidden=!missed.length;$('quizReview').replaceChildren();
  quiz.questions.forEach((q,i)=>{const a=quiz.answers[i],row=html('article','quiz-review-row'),heading=html('div','review-heading'),button=html('button','review-word',q.word+' ↗');button.onclick=()=>openWord(q.word,$('quizDialog'));heading.append(html('span',a.correct?'review-correct':'review-wrong',a.correct?'✓':'×'),button);row.append(heading);if(!a.correct)row.append(html('small','',`Seçimin: ${a.chosen}`));const az=html('p','',q.az),en=html('p','',q.en);az.lang='az';en.lang='en';row.append(az,en);$('quizReview').append(row);});
  $('quizTitle').setAttribute('tabindex','-1');$('quizTitle').focus();
 }
 $('quizNext').onclick=()=>{if(learning.next(quiz)){if(quiz.complete)finish();else showQuestion();}};
 $('quizDialog').addEventListener('keydown',e=>{
  if(e.altKey||e.ctrlKey||e.metaKey||e.repeat||!quiz||quiz.complete)return;
  if(/^[1-4]$/.test(e.key)&&quiz.answers.length===quiz.index){e.preventDefault();submit(quiz.questions[quiz.index].options[Number(e.key)-1]);}
  else if(e.key==='Enter'&&!$('quizNext').hidden){e.preventDefault();$('quizNext').click();}
 });
}
root.LearningUI={mount};
})(window);
