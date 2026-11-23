(function(root){
'use strict';
function mount({model,galaxy,select,resetHistory,prepareMap,selected,toast}){
 const $=id=>document.getElementById(id),E=root.WordRace,bank=galaxy?E.mapRoutes(root.WORD_RACE_DATA,galaxy.atlas):root.WORD_RACE_DATA;
 let state=null,preparing=false,timer=0,restoreMap=null,records={},mode='daily',preview=null,recent=[];
 try{records=JSON.parse(localStorage.getItem('soz:race:scores')||'{}');if(!records||typeof records!=='object')records={};records=Object.fromEntries(Object.entries(records).filter(([k,v])=>typeof v?.time?.ms==='number'&&typeof v?.taps?.taps==='number'));recent=JSON.parse(localStorage.getItem('soz:race:practice-recent')||'[]');if(!Array.isArray(recent))recent=[];}catch{}
 const blocked=['search','atlasGuideButton','dictionaryTab','savedTab','quizButton','randomButton','grammarTab','formsTab','dailyButton','resetFilters','zoomIn','zoomOut','fitButton','universeButton','brandHome','breadcrumbHome','breadcrumbRegion'];
 function lock(value){galaxy?.setNavigationLocked(value);document.body.classList.toggle('race-active',value);for(const id of blocked)$(id).disabled=value;for(const b of document.querySelectorAll('#filters button,#regionDirectory button'))b.disabled=value;}
 function time(ms){const sec=Math.floor(ms/1000);return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')+'.'+Math.floor(ms%1000/100);}
 function stop(){clearInterval(timer);timer=0;preparing=false;if(state)state.active=false;lock(false);galaxy?.setRaceRoute(null);restoreMap?.();restoreMap=null;$('raceHud').hidden=true;$('racePreparing').hidden=true;}
 function showBest(id){const best=records[id];$('raceBest').textContent=best?'Bu cihazda ən yaxşı: '+time(best.time.ms)+' · ən az '+best.taps.taps+' toxunuş':'Bu cütlük üçün bu cihazda hələ nəticə yoxdur.';}
 function draw(){
  const c=preview||E.daily(bank);mode=c.mode||mode;
  $('raceDailyTab').setAttribute('aria-pressed',String(mode==='daily'));$('racePracticeTab').setAttribute('aria-pressed',String(mode==='practice'));
  $('raceModeTitle').textContent=mode==='daily'?'GÜNÜN YARIŞI':'SƏRBƏST MƏŞQ';$('raceDate').textContent=mode==='daily'?c.day+' · Bakı vaxtı':'İstədiyin qədər oyna. Hər yeni məşqdə başqa sözlər.';
  $('raceFrom').textContent=c.start;$('raceTo').textContent=c.target;$('raceMapNote').hidden=c.route!=='map';
  const resume=(state?.active||preparing)&&state.challenge.id===c.id;
  $('raceStart').textContent=resume?'Yarışa qayıt →':mode==='practice'?'Məşqə başla →':'Gündəlik yarışa başla →';
  $('raceAgain').textContent=mode==='practice'?'Bu məşqi təkrar et':'Gündəlik yarışı təkrar et';$('raceNewPractice').hidden=false;showBest(c.id);$('raceResult').hidden=!(state?.complete&&state.challenge.id===c.id);
 }
 function show(){preview=state?.active||preparing||state?.complete?state.challenge:mode==='daily'?E.daily(bank):preview||newPair();draw();$('raceDialog').showModal();}
 function newPair(){return E.practice(bank,state?.challenge||preview,Math.random,new Date(),recent);}
 function pickMode(next){mode=next;preview=next==='daily'?E.daily(bank):(state?.challenge.mode==='practice'?state.challenge:newPair());draw();}
 function result(score){
  stop();records[score.id]=E.rank(records[score.id],score);records=Object.fromEntries(Object.entries(records).sort((a,b)=>(a[1].time.day||'').localeCompare(b[1].time.day||'')).slice(-500));let saved=true;try{localStorage.setItem('soz:race:scores',JSON.stringify(records));}catch{saved=false;}
  preview=state.challenge;draw();$('raceResultScore').textContent=score.taps+' toxunuş · '+time(score.ms);$('raceResultPath').textContent=score.path.join(' → ');$('raceRecordNotice').textContent=saved?'Nəticə bu cihazda saxlanıldı.':'Brauzer yaddaşı əlçatan deyil; nəticə bu sessiyada qalır.';$('raceDialog').showModal();
 }
 function tick(){if(preparing){if(!galaxy.isCenteredWord(state.challenge.start))return;state=E.begin(state.challenge,Date.now());preparing=false;$('racePreparing').hidden=true;}if(!state?.active)return;$('raceTime').textContent=time(Math.max(0,Date.now()-state.started));$('raceTaps').textContent=state.taps+' toxunuş';const score=E.finish(state,selected(),galaxy.isCenteredWord(state.challenge.target),Date.now());if(score)result(score);}
 function start(challenge=null,restart=false){
  if(!galaxy){toast('Yarış üçün xəritə açıq olmalıdır.');return;}
  const c=challenge||preview||(mode==='daily'?E.daily(bank):newPair());
  if(!restart&&(state?.active||preparing)&&state.challenge.id===c.id){$('raceDialog').close();return;}
  stop();state={challenge:c,active:false};preview=c;mode=c.mode||'daily';preparing=true;resetHistory();restoreMap=prepareMap?.();lock(true);galaxy.setRaceRoute(c.route==='map'?bank.neighbors:null);
  if(mode==='practice'){recent=[...recent.filter(id=>id!==c.id),c.id].slice(-1000);try{localStorage.setItem('soz:race:practice-recent',JSON.stringify(recent));}catch{}}
  $('raceDialog').close();$('raceResult').hidden=true;$('raceHud').hidden=false;$('racePreparing').hidden=false;$('raceHudMode').textContent=mode==='practice'?'MƏŞQ · HƏDƏF':'GÜNDƏLİK · HƏDƏF';$('raceTarget').textContent=c.target;
  const measure=document.createElement('canvas').getContext('2d');if(measure){measure.font='16px Georgia';const available=Math.min(240,Math.max(80,innerWidth-220)),width=Math.max(...c.target.split(/\s+/).map(t=>measure.measureText(t).width));$('raceTarget').style.fontSize=Math.min(16,16*available/Math.max(1,width))+'px';}
  $('raceTime').textContent='0:00.0';$('raceTaps').textContent='0 toxunuş';select(model.byWord.get(c.start),false,true,null,false,'race-start');timer=setInterval(tick,100);tick();
 }
 function allow(word,source){if(!preparing&&!state?.active)return true;if(source==='race-start')return true;if(preparing){toast('Başlanğıc sözün yerləşməsini gözləyin.');return false;}const visible=source==='back'||source==='map'&&galaxy.visibleWords().includes(word);if(!visible){toast('Yarışda yalnız xəritədə görünən sözlərə toxunun.');return false;}E.tap(state,word,true,Date.now(),source==='back');$('raceTaps').textContent=state.taps+' toxunuş';return true;}
 $('raceButton').onclick=show;$('raceStart').onclick=()=>start();$('raceRules').onclick=show;$('raceDailyTab').onclick=()=>pickMode('daily');$('racePracticeTab').onclick=()=>pickMode('practice');
 $('raceExit').onclick=()=>{stop();$('raceDialog').close();toast('Yarış dayandırıldı.');};$('raceAgain').onclick=()=>start(state?.challenge||preview,true);$('raceNewPractice').onclick=()=>start(newPair(),true);
 $('raceShare').onclick=async()=>{if(!state?.complete)return;const message='SÖZ · '+(state.challenge.mode==='practice'?'Məşq':state.challenge.day)+'\n'+state.challenge.start+' → '+state.challenge.target+'\n'+state.taps+' toxunuş · '+time(state.elapsed)+'\n'+location.origin+location.pathname;try{if(navigator.share)await navigator.share({title:'SÖZ — Söz yarışı',text:message});else if(navigator.clipboard){await navigator.clipboard.writeText(message);toast('Nəticə kopyalandı.');}else toast(message);}catch{toast('Paylaşma tamamlanmadı.');}};
 return {allow,get blocking(){return preparing||!!state?.active;},inspect:()=>({mode,preparing,active:!!state?.active,complete:!!state?.complete,taps:state?.taps||0,challenge:state?.challenge,path:state?.path||[],records}),tick,stop};
}
root.RaceUI={mount};
})(window);
