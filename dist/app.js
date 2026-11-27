(() => {
'use strict';
const $=id=>document.getElementById(id),{types,normalize,restoreModel}=window.WordWeb;
// The model is precomputed at build time (scripts/build_runtime.cjs). Link
// evidence and the full forms archive are fetched when first needed.
const fetchJSON=window.SOZ_FETCH_JSON||((file,options)=>fetch(file,options).then(r=>{if(!r.ok)throw new Error(file+': '+r.status);return r.json();}));
const coreFile=document.getElementById('sozCore')?.getAttribute('href')||'soz-core.json';
let core;try{core=fetchJSON(coreFile);}catch(error){core=Promise.reject(error);}
if(core&&typeof core.then==='function')core.then(start,failed);else start(core);
function failed(error){console.error(error);const message=document.createElement('p');message.textContent='Sözlər yüklənmədi. İnternet bağlantısını yoxlayıb səhifəni yeniləyin.';$('mapLoading').replaceChildren(message);}
function start(core){
const model=restoreModel(core,{fetchJSON});
let textStatus='idle',appStarted=false,retriedText=false,textRetryTimer,wordRequest=null;
// Full-text search, sources and games share this download. Word cards can
// already show the core's starter words or fetch a small group of meanings.
function loadText(){
 if(textStatus==='loading'||model.textLoaded())return;
 clearTimeout(textRetryTimer);textStatus='loading';
 if(appStarted&&state.selected)renderDefinitionPair(state.selected);
 const request=model.ensureText();
 if(request===true){textReady();return;}
 request.then(textReady,error=>{
  textStatus='failed';console.warn('Could not load dictionary text',error);
  if(state.selected)renderDefinitionPair(state.selected);
  if(!retriedText&&navigator.onLine!==false){
   retriedText=true;textRetryTimer=setTimeout(loadText,1800);
  }
 });
}
loadText();
const posNames={word:'söz',noun:'isim',verb:'fel',adjective:'sifət',function:'qrammatik söz',form:'söz forması',adverb:'zərf',numeral:'say',pronoun:'əvəzlik',interjection:'nida',postposition:'qoşma',determiner:'təyinedici',conjunction:'bağlayıcı',particle:'ədat',preposition:'ön qoşma',phrase:'ifadə'};
let saved;try{saved=new Set(JSON.parse(localStorage.getItem('soz-toxumasi:saved')||'[]').filter(w=>model.allByWord.has(w)).map(w=>model.aliases[w]||w));}catch{saved=new Set();}
const state={selected:null,filters:new Set(Object.keys(types)),history:[],arrival:null,searchItems:[],searchIndex:0,libraryMode:'all',libraryLimit:60};
let conjugation=null,pictureQuiz=null,activePage='map',returnHash='',routeOpening=false;
let race=null,morphology=null,personalStudy=null,studyDesk=null;
let galaxy=null,sheetOpen=false,sheetGesture=null,suppressSheetClick=false,currentRegion=null,currentCluster=null;
const motionKey='soz-toxumasi:motion',motionControl=$('motionPreference');
function motionChoice(value){
 const mode=typeof value==='string'?value.trim().toLowerCase():'';
 return mode==='full'||mode==='reduced'||mode==='system'?mode:null;
}
function initialMotion(){
 // A shared link controls this visit. Opening it leaves the visitor's saved preference in place.
 if(location.search){
  const fromLink=motionChoice(new URLSearchParams(location.search).get('motion'));
  if(fromLink)return fromLink;
 }
 try{return motionChoice(localStorage.getItem(motionKey))||'system';}catch{return 'system';}
}
motionControl.querySelector('option[value="'+initialMotion()+'"]').selected=true;
motionControl.addEventListener('change',()=>{
 const choice=motionChoice(motionControl.value)||'system';
 galaxy?.setMotionPreference(choice);
 let stored=true;
 try{localStorage.setItem(motionKey,choice);}catch{stored=false;}
 if(location.search||!stored){
  try{
   const url=new URL(location.href);
   if(stored&&!url.searchParams.has('motion'))return;
   if(stored)url.searchParams.delete('motion');else url.searchParams.set('motion',choice);
   history.replaceState(history.state,'',url.href);
  }catch{} // Restricted history still allows the selection to take effect for this page.
 }
});
const titleMeasure=document.createElement('canvas').getContext('2d');
function fitMeaningTitle(){const title=document.getElementById('meaningWord'),holder=document.getElementById('sheetToggle');if(!title||!holder||!titleMeasure)return;const max=innerWidth<640?21:23,available=Math.max(80,holder.clientWidth-16);titleMeasure.font=max+'px Georgia, serif';const needed=Math.max(1,...title.textContent.split(/\s+/).map(word=>titleMeasure.measureText(word).width));title.style.fontSize=Math.min(max,max*available/needed)+'px';}
window.addEventListener('resize',fitMeaningTitle);
function html(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
const retryDefinition=html('button','meaning-base','İzahı yenidən yüklə');
retryDefinition.id='retryDefinition';retryDefinition.type='button';retryDefinition.hidden=true;
$('meaningCard').querySelector('.meaning-main').append(retryDefinition);
function loadWordMeaning(n,retry=false){
 if(model.primaryReady(n)||navigator.onLine===false){wordRequest=null;return;}
 if(wordRequest?.node===n&&!retry&&!wordRequest.failed)return;
 const request=model.ensurePrimary(n);
 if(request===true){wordRequest=null;return;}
 const attempt={node:n,failed:false};wordRequest=attempt;
 function repaint(){if(state.selected===n&&wordRequest===attempt)renderDefinitionPair(n);}
 request.then(repaint,()=>{attempt.failed=true;repaint();});
}
function retryMeanings(){
 loadText();
 if(state.selected){loadWordMeaning(state.selected,true);renderDefinitionPair(state.selected);}
}
retryDefinition.onclick=retryMeanings;
window.addEventListener('online',retryMeanings);
function preview(n){
 const waiting=!model.textLoaded();
 const az=html('small','preview-az',n.az||(waiting?'…':n.special?'Xüsusi':'İzah hələ əlavə edilməyib.'));
 const en=html('small','preview-en',n.en||(waiting?'…':n.special?'Special':'Definition pending.'));
 az.lang='az';en.lang='en';return [az,en];
}
let toastTimeout;function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),2600);}
function closeMenu(){if($('menuDialog').open||$('menuDialog').hasAttribute('open'))$('menuDialog').close();}
function openDialog(id){closeMenu();$(id).showModal();}
function setSheet(open){if(open&&state.selected)showStudyRating();if(!open&&$('sheetExtra').contains(document.activeElement))$('sheetToggle').focus({preventScroll:true});sheetOpen=open;$('meaningCard').dataset.expanded=String(open);$('sheetToggle').setAttribute('aria-expanded',String(open));$('sheetExtra').hidden=!open;$('sheetToggle').setAttribute('aria-label',state.selected?.w+(open?' — tam izahı bağla':' — tam izahı aç'));}
$('sheetToggle').onclick=()=>{if(suppressSheetClick){suppressSheetClick=false;return;}setSheet(!sheetOpen);};
$('sheetToggle').addEventListener('pointerdown',e=>{sheetGesture={id:e.pointerId,y:e.clientY,open:sheetOpen};suppressSheetClick=false;$('sheetToggle').setPointerCapture?.(e.pointerId);});
$('sheetToggle').addEventListener('pointermove',e=>{if(!sheetGesture||sheetGesture.id!==e.pointerId)return;const delta=e.clientY-sheetGesture.y;if(Math.abs(delta)>24){suppressSheetClick=true;setSheet(delta<0);}});
for(const type of ['pointerup','pointercancel'])$('sheetToggle').addEventListener(type,e=>{if(sheetGesture?.id===e.pointerId){sheetGesture=null;if($('sheetToggle').hasPointerCapture?.(e.pointerId))$('sheetToggle').releasePointerCapture(e.pointerId);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheetOpen&&!document.querySelector('dialog[open]'))setSheet(false);});
$('menuButton').onclick=()=>{closeSearch();$('search').blur();$('menuDialog').showModal();};
$('menuDialog').addEventListener('click',e=>{if(e.target.closest('.menu-actions button,.region-directory button,.menu-footer button'))closeMenu();},true);
function updateSaved(){ $('savedCount').textContent=saved.size;const yes=saved.has(state.selected?.w);$('bookmarkButton').classList.toggle('saved',yes);$('bookmarkButton').setAttribute('aria-pressed',yes);$('bookmarkButton').setAttribute('aria-label',yes?'Yaddaşdan sil':'Sözü yadda saxla');}
function toggleSave(){const word=state.selected.w;if(saved.has(word)){saved.delete(word);toast('Söz yaddaşdan silindi.');}else{saved.add(word);toast('Söz yadda saxlanıldı.');}try{localStorage.setItem('soz-toxumasi:saved',JSON.stringify([...saved]));}catch{toast('Brauzer yaddaşı əlçatan deyil; siyahı yalnız bu sessiyada qalacaq.');}updateSaved();}
function detail(){
 const n=state.selected;
 const details=model.ensureDetails(n.w);if(details!==true)details.then(()=>{if(state.selected===n)refreshEvidence(n);},()=>{});
 renderMeaning(n);
 const linked=model.related(n,state.filters);$('connectionCount').textContent=linked.length;$('connections').replaceChildren();
 for(const type of ['syn','ant','root','topic','ending']){
  const t=types[type],group=linked.filter(x=>x.edge.type===type);if(!group.length&&(!state.filters.has(type)||!['syn','ant'].includes(type)))continue;
  const section=html('section','connection-group');section.dataset.type=type;section.style.setProperty('--color',t.color);
  const heading=html('h4');heading.textContent=t.name;heading.append(html('small','relation-count',group.length));const chips=html('div','word-chips');
  for(const x of group){const chip=html('button','word-chip',x.node.w);chip.style.cssText=`--chip-border:${t.border};--chip-bg:${t.fill};--chip-text:${t.text}`;chip.linkInfo={edge:x.edge,description:t.description};chipTitle(chip,n);chip.onclick=()=>select(x.node,true,true,x.edge);chips.append(chip);}
  if(!group.length){const empty=html('span','no-relation','—');empty.title='Bu söz üçün bu növ əlaqə qeyd edilməyib.';empty.setAttribute('aria-label',empty.title);chips.append(empty);}section.append(heading,chips);$('connections').append(section);
 }
 if(!linked.length)$('connections').append(html('p','empty-results',state.filters.size?'Bu söz üçün əlaqə qeyd edilməyib. Başqa bir söz axtarın.':'Əlaqələri göstərmək üçün rəng süzgəclərini aktiv edin.'));
 updateSaved();
}
function chipTitle(chip,n){const {edge,description}=chip.linkInfo,proof=model.connectionInfo(edge,n.w);chip.title=description+' · '+(proof?proof.from+': '+proof.sense:edge.note);}
// Link evidence arrived: update chip titles and the arrival sense without redrawing the sheet.
function refreshEvidence(n){for(const chip of $('connections').querySelectorAll('.word-chip'))if(chip.linkInfo)chipTitle(chip,n);renderContext(n);renderDeclension(n);renderOrigin(n);}
// Noun table: every case, singular and plural, for the chosen possessor. Forms
// follow the rules in morphology.js; the stem change (çörək → çörəy-, ağız → ağz-)
// comes from the word's detail file (scripts/build_noun_stems.cjs).
let declensionOwner=0;
const OWNER_LABEL=['adi','mənim','sənin','onun','bizim','sizin','onların'];
const STEM_SOURCE={archive:'formalar arxivinə görə',corpus:'mətnlərdəki işlənməyə görə',compound:'sözün son hissəsinə görə',rule:'qayda ilə',uncertain:'mənbədə yoxlanılmayıb'};
function renderDeclension(n){
 const box=$('meaningDeclension'),M=window.SozMorphology;box.replaceChildren();
 const show=!!M?.declension&&n.pos==='noun'&&!/[\s-]/.test(n.w);box.hidden=!show;if(!show)return;
 box.append(html('div','section-label','HAL VƏ CƏM'));
 if(!model.detailsLoaded(n.w)){box.append(html('p','declension-note','…'));return;}
 const stem=model.wordDetails(n.w)?.s,tables=M.declension(n.w,stem?.[0]),lower=n.w.toLocaleLowerCase('az');
 const documented=new Set(model.nominalRecords.filter(r=>(r.lemma||r.base)===n.w).map(r=>r.w.toLocaleLowerCase('az')));
 const owners=html('div','owner-filters');owners.setAttribute('role','group');owners.setAttribute('aria-label','Mənsubiyyət');
 OWNER_LABEL.forEach((label,i)=>{const b=html('button','',label);b.setAttribute('aria-pressed',String(i===declensionOwner));b.onclick=()=>{declensionOwner=i;renderDeclension(n);};owners.append(b);});
 const {owner,rows}=tables[declensionOwner],table=html('table','declension-table'),head=html('tr');
 head.append(html('th'),html('th','','tək'),html('th','','cəm'));table.append(html('thead'));table.firstChild.append(head);
 const body=html('tbody');let marked=false,changed=false;
 for(const row of rows){
  const tr=html('tr'),th=html('th');th.scope='row';th.append(html('span','case-name',row.az),html('small','case-question',row.question));tr.append(th);
  for(const form of [row.singular,row.plural]){
   const td=html('td'),altered=!form.startsWith(lower);changed||=altered;
   td.textContent=form;td.title=[row.en,owner.en].filter(Boolean).join(' · ');
   if(documented.has(form)){td.classList.add('documented');td.title+=' · lüğət arxivində qeyd olunub';}
   if(altered&&stem?.[1]==='uncertain'){td.append(html('span','unverified','*'));marked=true;}
   tr.append(td);
  }
  body.append(tr);
 }
 table.append(body);const scroll=html('div','declension-scroll');scroll.append(table);box.append(owners,scroll);
 const notes=[];
 if(stem&&(changed||stem[0]==='hard'))notes.push(stem[0]==='hard'?`k/q dəyişmir: ${lower}${M.declension(n.w,'hard')[3].rows[0].singular.slice(lower.length)} (${STEM_SOURCE[stem[1]]})`:`Saitlə başlayan şəkilçidən əvvəl kök dəyişir: ${lower} → ${stem[0]==='drop'?lower.slice(0,-2)+lower.slice(-1):lower.slice(0,-1)+(lower.endsWith('k')?'y':'ğ')}- (${STEM_SOURCE[stem[1]]}${marked?' *':''})`);
 if(documented.size)notes.push('● lüğətin formalar arxivində qeyd olunan formalar');
 notes.push('Formalar qayda ilə qurulub. Onların: onların kitabı / kitabları.');
 const p=html('p','declension-note',notes.join(' · '));box.append(p);
}
// Word origin and homonyms (English Wiktionary), shown in the expanded sheet.
const KAIKKI_POS={adj:'adjective',adv:'adverb',num:'numeral',pron:'pronoun',intj:'interjection',postp:'postposition',conj:'conjunction',name:'name',suffix:'suffix',prefix:'prefix'},EXTRA_POS={name:'xüsusi ad',suffix:'şəkilçi',prefix:'önşəkilçi'};
const FAMILY_AZ={turkic:'türk',arabic:'ərəb',persian:'fars',russian:'rus'},FAMILY_EN={turkic:'Turkic',arabic:'Arabic',persian:'Persian',russian:'Russian'},ROMAN=['I','II','III','IV','V','VI'];
function originLabel(o){
 const languages=model.meta.etymologyLanguages||{};
 if(o.kind==='formed'||!o.chain.length)return {az:'Azərbaycan dilində düzəlmiş söz',en:'formed in Azerbaijani'};
 const donor=o.chain.find(l=>languages[l]?.[1]!=='turkic');
 if(!donor)return {az:'türk mənşəli söz',en:'Turkic origin'};
 const [name,family]=languages[donor]||[donor,''];
 return {az:(FAMILY_AZ[family]||name.replace(/ dili$| dilləri$/,''))+' mənşəli söz',en:(FAMILY_EN[family]||donor)+' origin'};
}
function originLine(o){
 const languages=model.meta.etymologyLanguages||{},label=originLabel(o),line=html('p','origin-line'),chip=html('span','origin-chip',label.az),en=html('span','origin-chip-en',label.en);
 en.lang='en';line.append(chip,en);
 if(o.chain.length)line.append(html('span','origin-chain',o.chain.map(l=>languages[l]?.[0]||l).join(' ← ')));
 const text=html('span','origin-text',o.text);text.lang='en';line.append(text);return line;
}
function renderOrigin(n){
 const box=$('meaningOrigin'),found=model.wordDetails(n.w),details=found?.o||found?.h?found:null;box.replaceChildren();box.hidden=!details;if(!details)return;
 box.append(html('div','section-label',details.h?'OMONİMLƏR VƏ MƏNŞƏ':'MƏNŞƏYİ'));
 if(details.h){
  const note=html('p','homonym-note','Eyni yazılan, lakin mənşəcə fərqli sözlər. ');const en=html('span','',' Words spelled alike, with different origins.');en.lang='en';note.append(en);
  const list=html('ol','homonym-list');
  details.h.forEach((h,i)=>{const li=html('li'),pos=KAIKKI_POS[h.pos]||h.pos,gloss=html('span','homonym-gloss',h.glosses.join('; '));gloss.lang='en';li.append(html('span','homonym-number',n.w+' '+ROMAN[i]),html('span','homonym-pos',EXTRA_POS[pos]||posNames[pos]||pos),gloss);if(h.origin!==null&&details.o?.[h.origin])li.append(originLine(details.o[h.origin]));list.append(li);});
  box.append(note,list);
 }else for(const o of details.o||[])box.append(originLine(o));
 const link=html('a','relation-source','Wiktionary (en) ↗');link.href='https://en.wiktionary.org/wiki/'+encodeURIComponent(n.w)+'#Azerbaijani';link.target='_blank';link.rel='noopener';
 box.append(html('span','origin-source','Mənbə: '),link,html('span','origin-source',' · CC BY-SA 4.0'));
}
function renderContext(n){
 const context=$('meaningContext');context.replaceChildren();context.hidden=!state.arrival;if(state.arrival){const t=types[state.arrival.type],proof=model.connectionInfo(state.arrival.edge,n.w);context.append(document.createTextNode(`${state.arrival.from} — ${n.w} · ${t.description}`));context.style.setProperty('--relation-color',t.color);if(proof){const line=html('span','relation-sense',`əlaqənin mənası · ${proof.from}: ${proof.sense}`);line.lang=proof.language;context.append(line);if(proof.senseEnglish){const english=html('span','relation-sense-en',proof.senseEnglish);english.lang='en';context.append(english);}const labels={'South-Azerbaijani':'Cənubi Azərbaycan işlənməsi',euphemistic:'evfemizm',poetic:'poetik',informal:'qeyri-rəsmi',obsolete:'köhnəlmiş',broadly:'geniş mənada',offensive:'təhqiramiz',slur:'təhqiramiz ad',derogatory:'alçaldıcı',ethnic:'etnik',dated:'köhnəlmiş',slang:'jarqon',rare:'az işlənən',archaic:'köhnəlmiş',dialectal:'şivə',colloquial:'danışıq dili',Classical:'klassik dil',figuratively:'məcazi',vulgar:'kobud ifadə'};const tags=(proof.tags||[]).map(x=>labels[x]).filter(Boolean);if(proof.qualifier||tags.length)context.append(html('span','relation-register',[proof.qualifier,...tags].filter(Boolean).join(' · ')));for(const ref of proof.refs||[{edition:proof.edition,head:proof.head}]){const a=html('a','relation-source','mənbə · '+(ref.title||ref.head||'lüğət')+' ↗');a.href=ref.url||'https://'+ref.edition+'.wiktionary.org/wiki/'+encodeURIComponent(ref.head);a.target='_blank';a.rel='noopener';context.append(a);}}}
}
// Commonness from corpus frequency: five dots and an approximate learner level.
const BAND_LABEL={5:['çox işlənən','very common'],4:['geniş işlənən','common'],3:['orta tezlikli','moderately common'],2:['az işlənən','less common'],1:['nadir','rare']};
function renderFrequency(n){
 const meter=$('meaningFrequency'),f=model.frequency(n);meter.hidden=!f;if(!f)return;
 const [az,en]=BAND_LABEL[f.band];meter.replaceChildren(html('span','frequency-dots','●'.repeat(f.band)+'○'.repeat(5-f.band)),html('span','frequency-level',f.level));
 meter.title=`${az} · tezlik sırası ${f.rank.toLocaleString('az')} · təxmini səviyyə ${f.level}\n${en} · frequency rank ${f.rank} · approximate level ${f.level}\nVikipediya, veb mətnləri və film altyazıları əsasında / from Wikipedia, web text and film subtitles`;
 meter.setAttribute('aria-label',`${az}, təxmini səviyyə ${f.level}`);
}
function renderDefinitionPair(n,info=window.WordInfo.describeWord(n,model.byWord)){
 const ready=model.primaryReady(n),current=wordRequest?.node===n?wordRequest:null;
 const unavailable=!ready&&textStatus==='failed'&&(!current||current.failed);
 const az=$('meaningDefinition'),en=$('meaningEnglish');
 az.textContent=ready?info.definition||(n.special?window.WordInfo.specialMeaning.az:'İzah hələ əlavə edilməyib.')
                     :unavailable?'İzah yüklənmədi.':'İzah yüklənir…';
 en.textContent=ready?info.definitionEnglish||(n.special?window.WordInfo.specialMeaning.en:'Definition pending.')
                     :unavailable?'Couldn’t load the definition.':'Loading definition…';
 az.lang='az';en.lang='en';en.hidden=false;$('definitionLanguage').hidden=false;
 retryDefinition.hidden=ready||(!unavailable&&!current?.failed);
}
function renderMeaning(n){
 const info=window.WordInfo.describeWord(n,model.byWord);$('meaningCard').querySelector('.sheet-scroll').scrollTop=0;
 $('meaningWord').textContent=n.w;fitMeaningTitle();renderFrequency(n);$('meaningPos').textContent=(n.orthographyPage&&n.pos==='word'?'orfoqrafiya':posNames[n.pos]||n.pos)+(model.isHomonym(n.w)?' · omonim':'');renderDefinitionPair(n,info);
 const grammar=$('meaningGrammar');grammar.replaceChildren();
 if(state.searchedForm){const f=state.searchedForm,line=html('span','searched-form');line.append(html('strong','',f.form),document.createTextNode(' — '+f.parts.map(x=>x.az).join(' · ')));if(f.english){const en=html('span','searched-form-en',' · '+f.english);en.lang='en';line.append(en);}grammar.append(line);}
 if(info.base){const label=html('span','',info.form?info.form.label+' · əsas söz: ':'əsas söz: '),base=html('button','meaning-base',info.base.w);base.onclick=()=>select(info.base);grammar.append(label,base);if(info.suffix)grammar.append(html('span','suffix-note',` + -${info.suffix}`));grammar.append(html('span','base-gloss',` (${info.base.en})`));}
 // How the word is built (istək + arzulu), kept apart from its meaning.
 if(n.definitionFormation){const line=html('span','formation-note');line.append(html('span','formation-label','quruluş: '),document.createTextNode(n.definitionFormation.az));const en=html('span','base-gloss',' · '+n.definitionFormation.en);en.lang='en';line.append(en);grammar.append(line);}
 if(info.listedForm)grammar.append(html('span','form-notice','lüğət cədvəlindən forma'));
 if(info.generated){grammar.append(html('span','form-notice','qayda ilə yaradılmış forma'));}
 if(conjugation?.hasVerb(n.w)||n.pos==='verb'&&model.grammarRecords.some(f=>f.base===n.w)){const b=html('button','meaning-base','təsrif formaları ↗');b.onclick=()=>library('grammar',n.w);grammar.append(b);}if(model.nominalRecords.some(f=>f.lemma===n.w||f.w===n.w)){const b=html('button','meaning-base','hal və cəm formaları ↗');b.onclick=()=>library('forms',n.w);grammar.append(b);}grammar.hidden=!grammar.childNodes.length;
 renderContext(n);renderDeclension(n);renderOrigin(n);
 const example=$('meaningExample');example.replaceChildren();example.hidden=!info.example;
 if(info.example){example.append(html('span','example-label','məsələn'),html('q','example-az',info.example[0]));const en=html('span','example-en',info.example[1]);en.lang='en';example.append(en);}
 $('meaningUsage').textContent=info.usage;$('meaningUsage').hidden=!info.usage;
 const sources=$('meaningSource');sources.replaceChildren();sources.hidden=!n.orthographyPage&&!info.source&&!n.definitionSources?.length&&!n.special?.length&&n.definitionAuditStatus!=='needs-review';
 if(n.orthographyPage){
  const source=model.meta.orthography;
  const link=html('a','relation-source',source.title+' ('+source.year+'), s. '+n.orthographyPage+' ↗');
  link.href=source.url+'#page='+n.orthographyPage;link.target='_blank';link.rel='noopener';
  sources.append(document.createTextNode('yazılış üçün mənbə: '),link);
 }
 if(n.definitionSources?.length){sources.append(document.createTextNode(sources.childNodes.length?' · izah mənbələri: ':'izah üçün mənbələr: '));for(const ref of n.definitionSources){const a=html('a','relation-source',(ref.title||'lüğət')+' ↗');a.href=ref.url;a.target='_blank';a.rel='noopener';sources.append(a);}}
 else if(info.source?.kind==='editorial'){const link=html('a','','SÖZ · izah qeydləri ↗');link.href=info.source.attribution||'expansion-attribution.json';link.target='_blank';link.rel='noopener';sources.append(link,html('span','translation-notice','Süni intellekt dəstəyi ilə hazırlanmış izah · AI-assisted definition'));}
 else if(info.source){const edition=info.source.edition||'en',link=html('a','','Wiktionary ('+edition+')');link.href=info.source.url||'https://'+edition+'.wiktionary.org/wiki/'+encodeURIComponent(info.source.head)+'#'+(({es:'Azerí',pl:'azerbejdżański',nl:'Azerbeidzjaans',fi:'Azeri',sv:'Azerbajdzjanska',it:'Azero',ja:'アゼルバイジャン語',pt:'Azerbaijano',en:'Azerbaijani',tr:'Azerice',ru:'Азербайджанский',fr:'Azéri',de:'Aserbaidschanisch',ku:'Azerî',az:'Azərbaycan_dili'})[edition]||'');link.target='_blank';link.rel='noopener';sources.append(document.createTextNode('mənbə: '),link,document.createTextNode((info.source.via==='mediawiki'?'':' · Kaikki')+' · CC BY-SA 4.0'));}
 const methodNotice={paraphrase:'Lüğət əsasında süni intellekt dəstəyi ilə yazılmış izah · AI-assisted paraphrase of the cited dictionary',derivation:'İzahlı lüğətin törəmə qeydi əsasında · from the dictionary’s derivation note',['cross-reference']:'İzahlı lüğətin istinadı əsasında · from the dictionary’s cross-reference',rule:'Qayda ilə qurulub · rule-based definition from the base word',authored:'Süni intellektlə yazılıb · AI-written · yoxlanılmalıdır / needs review',meaning:'Mənası süni intellektlə yazılıb · AI-written meaning · yoxlanılmalıdır / needs review'}[n.definitionMethod];
 if(methodNotice){if(sources.childNodes.length)sources.append(document.createTextNode(' · '));sources.append(html('span','translation-notice',methodNotice+(n.definitionConfidence==='low'?' · yoxlanılmalıdır / needs review':'')));if(n.definitionBase&&model.byWord.has(n.definitionBase)){const b=html('button','meaning-base',n.definitionBase);b.onclick=()=>select(model.byWord.get(n.definitionBase));sources.append(document.createTextNode(n.definitionMethod==='cross-reference'?' bax: ':' əsas söz: '),b);}}
 if(n.special?.length){
  sources.append(document.createTextNode(sources.childNodes.length?' · məna araşdırması: ':'Məna araşdırması: '));
  for(const [index,url] of n.special.entries()){
   const link=html('a','relation-source','İzahlı lüğət'+(n.special.length>1?' '+(index+1):'')+' ↗');
   link.href=url;link.target='_blank';link.rel='noopener';sources.append(link);
  }
 }
 if(n.definitionReview){const a=html('a','translation-notice','SÖZ · izahın dəqiqləşdirilməsi ↗');a.href=n.definitionReviewAttribution||'relations-attribution.json';a.target='_blank';a.rel='noopener';sources.append(a);}
 if(n.definitionAuditStatus==='needs-review')sources.append(html('span','translation-notice','Bu sözün bəzi mənaları hələ dəqiqləşdirilir · Some senses still need review'));
 if(info.translationMethod==='machine')sources.append(html('span','translation-notice','Avtomatik tərcümə · Machine translated'));
 const senses=$('otherSenses');senses.hidden=!info.extraSenses.length;senses.open=false;$('senseList').replaceChildren();for(const sense of info.extraSenses){const li=html('li'),az=html('span','sense-az',sense.az),en=html('span','sense-en',sense.en);az.lang='az';en.lang='en';li.append(az,en);$('senseList').append(li);}

}

function select(n,record=true,writeHash=true,viaEdge=null,initial=false,source='ordinary'){
 if(!n)return;const note=state.pendingForm;state.pendingForm=null;state.searchedForm=note&&note.node===n?note:null;if(race?.blocking&&!race.allow(n.w,source))return;if(activePage==='grammar'||activePage==='study')showMap(false);const previous=state.selected;state.arrival=null;
 if(previous&&previous.id!==n.id){const relation=viaEdge?{edge:viaEdge}:model.related(previous).find(x=>x.node.id===n.id);if(relation)state.arrival={from:previous.w,type:relation.edge.type,edge:relation.edge};if(record)state.history.push(previous.id);}
 state.selected=n;if(!initial)document.querySelector('.galaxy-studio').dataset.hasWord='true';if(writeHash)history.replaceState(null,'','#w='+encodeURIComponent(n.w));
 if(textStatus==='failed'&&navigator.onLine!==false)loadText();
 loadWordMeaning(n);
 $('backButton').hidden=!state.history.length;closeSearch();closeMenu();$('search').value='';if(document.activeElement===$('search'))$('search').blur();setSheet(false);detail();galaxy?.select(n,{initial});
}
function visibleFilters(){
 for(const b of document.querySelectorAll('#filters button, #mapFilterKeys button')){
  const enabled=state.filters.has(b.dataset.type);
  b.setAttribute('aria-pressed',String(enabled));
  const check=b.querySelector('.check');if(check)check.textContent=enabled?'✓':'−';
 }
}
function toggleRelation(type){
 if(race?.blocking)return;
 if(state.filters.has(type))state.filters.delete(type);else state.filters.add(type);
 visibleFilters();detail();galaxy?.setFilters(state.filters);
}
const keyNames={root:'Kök',syn:'Sinonim',ant:'Antonim',topic:'Mövzu',ending:'Sonluq'};
for(const[type,t]of Object.entries(types)){
 const button=html('button','filter');
 button.dataset.type=type;button.style.setProperty('--color',t.color);button.title=t.description;
 button.append(html('span','line-swatch'),document.createTextNode(t.name),html('span','check','✓'));
 button.setAttribute('aria-pressed','true');button.onclick=()=>toggleRelation(type);$('filters').append(button);
}
for(const[type,name]of Object.entries(keyNames)){
 const button=html('button','map-key',name);
 button.dataset.type=type;button.style.setProperty('--key',types[type].color);
 button.setAttribute('aria-pressed','true');button.title=types[type].description;
 button.onclick=()=>toggleRelation(type);$('mapFilterKeys').append(button);
}
$('resetFilters').onclick=()=>{state.filters=new Set(Object.keys(types));visibleFilters();detail();galaxy?.setFilters(state.filters);};
$('zoomIn').onclick=()=>galaxy?.zoom(1.8);$('zoomOut').onclick=()=>galaxy?.zoom(1/1.8);$('fitButton').onclick=()=>{setSheet(false);galaxy?.focus();};
for(const id of ['universeButton','brandHome','breadcrumbHome'])$(id).onclick=()=>{setSheet(false);closeSearch();galaxy?.home();};
// A browser can suppress the click on the tap immediately following a map drag.
// Handle one stationary finger on Home and keep its normal click for other inputs.
const homeControl=$('universeButton');
let homeContact=null;
document.addEventListener('touchstart',event=>{
 const finger=event.touches[0];
 homeContact=event.touches.length===1&&homeControl.contains(event.target)?{id:finger.identifier,x:finger.clientX,y:finger.clientY}:null;
},{passive:true});
function isHomeTap(finger){
 return homeContact&&finger&&finger.identifier===homeContact.id&&Math.hypot(finger.clientX-homeContact.x,finger.clientY-homeContact.y)<=10;
}
homeControl.addEventListener('touchmove',event=>{if(!isHomeTap(event.touches[0]))homeContact=null;},{passive:true});
homeControl.addEventListener('touchcancel',()=>{homeContact=null;},{passive:true});
homeControl.addEventListener('touchend',event=>{
 const finger=event.changedTouches[0];
 const activate=isHomeTap(finger)&&!event.touches.length&&homeControl.contains(document.elementFromPoint(finger.clientX,finger.clientY));
 homeContact=null;
 if(!event.cancelable)return;
 event.preventDefault();
 if(activate)homeControl.click();
},{passive:false});
$('breadcrumbRegion').onclick=()=>{if(currentRegion)galaxy?.visitRegion(currentRegion.id);};
$('backButton').onclick=()=>{const id=state.history.pop();if(id!==undefined)select(model.byId.get(id),false,true,null,false,'back');};
let interesting=null;
$('randomButton').onclick=()=>{interesting??=model.nodes.filter(n=>['curated','wiktionary','editorial'].includes(n.quality)&&model.degree(n)>0);const options=interesting.filter(n=>n.id!==state.selected.id);select(options[Math.floor(Math.random()*options.length)]);};$('bookmarkButton').onclick=toggleSave;
// One search row for an analysed form (kitab·lar·ımız·dan), or the verb-wheel shortcut after it.
function analysisOption(item,i){
 const a=item.analysis||item.conjugationOf,b=html('button',item.analysis?'search-option form-analysis':'wheel-shortcut');b.id='search-option-'+i;b.dataset.word=a.word;b.setAttribute('role','option');b.setAttribute('aria-selected',i===0);b.onpointerdown=e=>e.preventDefault();
 if(item.conjugationOf){b.textContent='«'+a.form+'» təsrif cədvəlində · '+a.word+' ↗';b.onclick=()=>openAnalysisForm(a);return b;}
 const form=html('span','analysis-form');a.segments.forEach((part,k)=>{if(k)form.append(html('span','analysis-joint','·'));form.append(html(k?'span':'b','',part));});
 const az=html('small','preview-az',a.word+' · '+a.parts.map(x=>x.az).join(' · '));az.lang='az';b.append(form,az);
 if(a.english){const en=html('small','preview-en',a.english);en.lang='en';b.append(en);}
 b.onclick=()=>chooseAnalysis(a);return b;
}
function chooseAnalysis(a){state.pendingForm=a;select(a.node);}
function openAnalysisForm(a){closeSearch();openGrammar(a.word,true,a.grammar);}
function closeSearch(){$('searchResults').hidden=true;$('search').setAttribute('aria-expanded','false');$('search').removeAttribute('aria-activedescendant');}
function showSearch(){const query=$('search').value;const result=$('searchResults');result.replaceChildren();if(!query.trim()){closeSearch();return;}state.searchItems=model.search(query,9);const forms=[...model.grammarSearch(query),...model.nominalSearch(query)].filter(n=>n.key===normalize(query.trim()));
 if(forms.length&&!model.byWord.has(query.trim())){const bases=[...new Set(forms.map(f=>model.resolveWord(f.lemma||f.base)).filter(Boolean))];state.searchItems=[...bases,...state.searchItems.filter(n=>!bases.includes(n))].slice(0,9);}
 const analyses=(morphology?.analyze(query)||[]).filter(a=>a.node),exact=state.searchItems[0]?.lower===query.trim().toLocaleLowerCase('az');
 const analysisItems=analyses.flatMap(a=>a.kind==='verb'?[{analysis:a},{conjugationOf:a}]:[{analysis:a}]);
 state.searchItems=exact?[state.searchItems[0],...analysisItems,...state.searchItems.slice(1)]:[...analysisItems,...state.searchItems];
 state.searchIndex=0;result.hidden=false;$('search').setAttribute('aria-expanded','true');
 for(const [i,n]of state.searchItems.entries()){
  if(n.analysis||n.conjugationOf){result.append(analysisOption(n,i));continue;}
  const b=html('button','search-option');b.dataset.word=n.w;b.id='search-option-'+i;b.setAttribute('role','option');b.setAttribute('aria-selected',i===0);b.append(html('span','',n.w),...preview(n));b.onpointerdown=e=>e.preventDefault();b.onclick=()=>select(n);result.append(b);}
 for(const mode of ['forms','grammar']){if(!forms.some(f=>(f.kind==='nominal'?'forms':'grammar')===mode))continue;const i=state.searchItems.length;state.searchItems.push({grammarQuery:query,archiveMode:mode});const b=html('button','grammar-shortcut',mode==='forms'?'hal / cəm forması · formalarda aç ↗':'təsrif forması · qrammatikada aç ↗');b.id='search-option-'+i;b.setAttribute('role','option');b.setAttribute('aria-selected',i===0);b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{closeSearch();library(mode,query);};result.append(b);}
 if(!state.searchItems.length&&!forms.length)result.append(html('div','empty-results','Söz tapılmadı. “melumat”, “etmək” və ya “beautiful” ilə axtarın.'));
 if(state.searchItems.length)$('search').setAttribute('aria-activedescendant','search-option-0');else $('search').removeAttribute('aria-activedescendant');}
$('search').addEventListener('input',showSearch);$('search').addEventListener('focus',()=>{if($('search').value)showSearch();});
$('search').addEventListener('keydown',e=>{if(e.key==='Escape'){closeSearch();return;}if($('searchResults').hidden)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const count=state.searchItems.length;if(!count)return;state.searchIndex=(state.searchIndex+(e.key==='ArrowDown'?1:-1)+count)%count;for(const[b,i]of [...$('searchResults').children].map((b,i)=>[b,i]))b.setAttribute('aria-selected',i===state.searchIndex);$('search').setAttribute('aria-activedescendant','search-option-'+state.searchIndex);$('search-option-'+state.searchIndex).scrollIntoView({block:'nearest'});}if(e.key==='Enter'&&state.searchItems.length){e.preventDefault();const item=state.searchItems[state.searchIndex];if(item.analysis){chooseAnalysis(item.analysis);return;}if(item.conjugationOf){openAnalysisForm(item.conjugationOf);return;}if(item.grammarQuery){closeSearch();library(item.archiveMode||'grammar',item.grammarQuery);}else select(item);}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.search-wrap'))closeSearch();});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(activePage==='grammar')showMap(true);const open=document.querySelector('dialog[open]');if(open)open.close();$('search').focus();$('search').select();}});
function library(mode,query=''){if(mode==='grammar'){openGrammar(query);return;}if(activePage==='grammar')showMap(true);restoreLibrary();closeMenu();state.libraryMode=mode;state.libraryLimit=60;$('libraryTitle').textContent=mode==='common'?'Ən çox işlənən sözlər':mode==='saved'?'Yadda saxlananlar':mode==='grammar'?'Qrammatika':mode==='forms'?'Hal və cəm formaları':mode==='special'?'Xüsusi sözlər · Special':'Sözlük';$('librarySearch').value=query;$('librarySearch').placeholder=mode==='grammar'?'Fel və ya təsrif forması ilə axtar…':mode==='forms'?'Əsas söz və ya forma ilə axtar…':'Söz və ya məna ilə axtar…';$('librarySearch').setAttribute('aria-label',mode==='grammar'?'Qrammatika arxivində axtar':mode==='forms'?'Formalar arxivində axtar':'Sözlükdə axtar');$('grammarIntro').hidden=mode!=='grammar';$('formsIntro').hidden=mode!=='forms';for(const b of document.querySelectorAll('[data-library-mode]'))b.setAttribute('aria-pressed',b.dataset.libraryMode===mode);renderLibrary();if(!$('libraryDialog').open&&!$('libraryDialog').hasAttribute('open'))$('libraryDialog').showModal();}
const grammarLabels={past:'keçmiş zaman',present:'indiki zaman',future:'gələcək zaman',negative:'inkar',positive:'təsdiq',singular:'tək',plural:'cəm','first-person':'I şəxs','second-person':'II şəxs','third-person':'III şəxs',participle:'feli sifət',imperative:'əmr şəkli',conditional:'şərt şəkli',indicative:'xəbər şəkli',converb:'feli bağlama',conjugated:'təsrif forması','non-past':'keçmiş olmayan zaman',definite:'müəyyən',indefinite:'qeyri-müəyyən',perfect:'bitmiş',imperfect:'bitməmiş',nominative:'adlıq hal',genitive:'yiyəlik hal',dative:'yönlük hal',accusative:'təsirlik hal',locative:'yerlik hal',ablative:'çıxışlıq hal',possessive:'mənsubiyyət',comitative:'birgəlik',comparative:'müqayisə',predicative:'xəbərlik',misspelling:'yazılış variantı'};
const LEVEL_NAMES=['A1','A2','B1','B2','C1','C2'];
function commonList(query){let list=model.commonWords();if(state.libraryLevel)list=list.filter(n=>model.frequency(n).level===state.libraryLevel);if(query){const q=normalize(query.trim());model.prepareSearch();list=list.filter(n=>n.key.includes(q)||(n.english||'').includes(q)||(n.azerbaijani||'').includes(q));}return list;}
function levelFilters(){const bar=html('div','level-filters');bar.setAttribute('role','group');bar.setAttribute('aria-label','Səviyyə');for(const level of [null,...LEVEL_NAMES]){const b=html('button','',level||'hamısı');b.setAttribute('aria-pressed',String((state.libraryLevel||null)===level));b.onclick=()=>{state.libraryLevel=level;state.libraryLimit=60;renderLibrary();};bar.append(b);}return bar;}
function renderLibrary(){const query=$('librarySearch').value,mode=state.libraryMode;
 if(mode==='forms'&&!model.formsLoaded()){const pending=model.ensureForms();if(pending!==true){$('libraryList').replaceChildren(html('p','empty-results','Formalar arxivi yüklənir…'));$('libraryMeta').textContent='';$('loadMore').hidden=true;pending.then(()=>{if(state.libraryMode==='forms')renderLibrary();},()=>{if(state.libraryMode==='forms')$('libraryList').replaceChildren(html('p','empty-results','Formalar arxivi yüklənmədi. İnternet bağlantısını yoxlayıb yenidən açın.'));});return;}}let list=mode==='grammar'?model.grammarSearch(query):mode==='forms'?model.nominalSearch(query):mode==='common'?commonList(query):query?model.search(query,model.nodes.length):model.alphabetical;
 if(mode==='special')list=query?list.filter(node=>node.special):model.specialNodes;
 if(mode==='saved'){list=list.filter(n=>saved.has(n.w));for(const w of saved){if(!model.byWord.has(w)&&(!query||normalize(w).includes(normalize(query))))list.push(model.allByWord.get(w));}}
 const container=$('libraryList');container.replaceChildren();container.classList.toggle('grammar-list',mode==='grammar'||mode==='forms');$('libraryMeta').textContent=mode==='grammar'?`${list.length.toLocaleString('az')} təsrif forması · ${new Set(list.map(n=>n.base)).size.toLocaleString('az')} fel`:mode==='forms'?`${list.length.toLocaleString('az')} forma · ${new Set(list.map(n=>n.lemma||n.base)).size.toLocaleString('az')} əsas söz`:mode==='common'?`${list.length.toLocaleString('az')} söz · işlənmə tezliyinə görə`:`${list.length.toLocaleString('az')} söz və ifadə`;
 if(mode==='common'){const note=html('p','frequency-note','Sıra Vikipediya, veb mətnləri və film altyazılarında sözün və onun formalarının işlənmə tezliyinə əsaslanır. Səviyyələr təxminidir.');$('libraryMeta').append(levelFilters(),note);}
 if(!list.length)container.append(html('p','empty-results',mode==='saved'&&!saved.size?'Hələ yadda saxlanmış söz yoxdur. Xəritədə söz seçin və əlfəcin işarəsinə toxunun.':(mode==='grammar'||mode==='forms')?'Bu axtarışa uyğun saxlanmış forma yoxdur.':'Bu axtarışa uyğun söz tapılmadı.'));
 if(mode==='grammar'||mode==='forms'){
  const groups=new Map();for(const form of list.slice(0,state.libraryLimit)){if(!groups.has(form.base))groups.set(form.base,[]);groups.get(form.base).push(form);}
  for(const[base,forms]of groups){const section=html('section','grammar-group'),heading=html('h3');const lemma=model.resolveWord(base),button=html(lemma?'button':'span','grammar-lemma',base||'əsas söz qeyd edilməyib');if(lemma){button.title='Əsas sözü xəritədə aç';button.onclick=()=>{$('libraryDialog').close();select(lemma);};}heading.append(button,html('small','',base?(mode==='forms'?'əsas söz':'məsdər'):'arxiv'));section.append(heading);
   for(const f of forms){const row=html('div','grammar-row');row.dataset.grammarWord=f.w;if(mode==='forms')row.dataset.nominalWord=f.w;row.append(html('strong','',f.w));const tags=(f.analyses?.[0]?.tags||f.tags).map(t=>grammarLabels[t]).filter(Boolean);if(tags.length)row.append(html('small','grammar-tags',[...new Set(tags)].join(' · ')));const meaning=html('p','grammar-az',f.az),english=html('p','grammar-en',f.en);meaning.lang='az';english.lang='en';row.append(meaning,english);if(mode==='forms'&&f.definitions.length>1){const more=html('details','form-analyses');more.append(html('summary','','digər qrammatik mənalar'));for(const d of f.definitions.slice(1)){const az=html('p','grammar-az',d.az),en=html('p','grammar-en',d.en);az.lang='az';en.lang='en';more.append(az,en);}row.append(more);}const sourceLine=html('small','grammar-source','AZ · EN · ');if(f.origin==='original')sourceLine.append(document.createTextNode('ilkin kolleksiya'));else{const source=html('a','','Wiktionary ↗');source.href='https://en.wiktionary.org/wiki/'+encodeURIComponent(f.source.head)+'#Azerbaijani';source.target='_blank';source.rel='noopener';sourceLine.append(source);}row.append(sourceLine);if(saved.has(f.w))row.append(html('small','grammar-tags','yadda saxlanılıb'));section.append(row);}container.append(section);}
 }else for(const n of list.slice(0,state.libraryLimit)){const archived=!model.byWord.has(n.w),b=html('button','library-row'),label=html('span');label.append(html('strong','',n.w));if(archived)label.append(html('small','',model.archiveMode(n.w)==='forms'?'formalar · saxlanmış hal / cəm forması':'qrammatika · saxlanmış təsrif forması'));else label.append(...preview(n));if(mode==='common'){const f=model.frequency(n);label.prepend(html('small','frequency-rank',f.rank+' · '+f.level));}b.append(label,html('span','','↗'));b.onclick=()=>{if(archived)library(model.archiveMode(n.w),n.w);else{$('libraryDialog').close();select(n);}};container.append(b);}
 $('loadMore').hidden=state.libraryLimit>=list.length;}
$('librarySearch').oninput=()=>{state.libraryLimit=60;renderLibrary();};$('loadMore').onclick=()=>{state.libraryLimit+=60;renderLibrary();};$('dictionaryTab').onclick=()=>library('all');$('commonWordsButton').onclick=()=>library('common');$('savedTab').onclick=()=>library('saved');
$('grammarTab').onclick=()=>library('grammar');$('formsTab').onclick=()=>library('forms');for(const b of document.querySelectorAll('[data-library-mode]'))b.onclick=()=>library(b.dataset.libraryMode);
$('relationshipRulesButton').onclick=()=>openDialog('relationshipDialog');$('helpButton').onclick=()=>openDialog('helpDialog');$('dataInfoButton').onclick=()=>openDialog('dataDialog');
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});

const archiveNodes=['grammarIntro','librarySearch','libraryMeta','libraryList','loadMore'];
function restoreLibrary(){for(const id of archiveNodes)if($(id).parentElement!==$('libraryDialog'))$('libraryDialog').append($(id));}
function showMap(writeRoute=true){const fromStudy=activePage==='study';if(fromStudy){studyDesk?.close();$('studyPage').hidden=true;}const restoreFocus=$('conjugationPage').contains(document.activeElement)||$('pictureQuizPage').contains(document.activeElement);conjugation?.close();pictureQuiz?.close();activePage='map';$('conjugationPage').hidden=true;$('pictureQuizPage').hidden=true;document.querySelector('.galaxy-studio').hidden=false;document.title='SÖZ — Söz kainatı';restoreLibrary();galaxy?.setPageHidden(false);if(fromStudy)$('studyButton').focus?.({preventScroll:true});else if(restoreFocus)$('menuButton').focus?.({preventScroll:true});if(writeRoute)history.replaceState(null,'',returnHash||'#w='+encodeURIComponent(state.selected?.w||'gözəl'));}
function studyStore(){return personalStudy||(personalStudy=window.SozStudyUI.createStore(model));}
function showStudyRating(){
 const r=studyStore().word(state.selected.w),control=$('mapStudyLevel');
 const value=r?.rating==null?'':String(r.rating);
 control.querySelectorAll('option').forEach(o=>{o.selected=o.getAttribute('value')===value;});
}
$('mapStudyLevel').addEventListener('change',()=>{
 if(race?.blocking||!state.selected)return;
 const value=$('mapStudyLevel').value;
 studyStore().rateWord(state.selected.w,value===''?null:Number(value));
 toast(studyStore().status().persistent?'Şəxsi qiymətləndirmə saxlanıldı.':'Dəyişiklik bu sessiyadadır. Şəxsi məşqdən ehtiyat nüsxə yüklə.');
});
function mapFromStudy(word){
 const node=model.resolveWord(word);if(!node)return;
 const hash='#w='+encodeURIComponent(node.w);
 (history.pushState||history.replaceState).call(history,null,'',hash);
 showMap(false);select(node,true,false);
}
function openStudy(screen='today',writeRoute=true,replace=false){
 if(race?.blocking){toast('Yarışı bitirdikdən sonra şəxsi məşqi aça bilərsiniz.');return;}
 if(!studyDesk)studyDesk=window.SozStudyUI.mount({study:studyStore(),model,savedWords:()=>saved,openWord:mapFromStudy,navigate:(next,replace=false)=>openStudy(next,true,replace)});
 if(activePage!=='study'){
  if(activePage==='map')returnHash=window.SozStudyUI.readRoute(location.hash)?'#':location.hash||'#';
  closeMenu();closeSearch();for(const d of document.querySelectorAll('dialog[open]'))d.close();
  if(activePage==='pictures'){pictureQuiz?.close();$('pictureQuizPage').hidden=true;}
  if(activePage==='grammar'){conjugation?.close();$('conjugationPage').hidden=true;restoreLibrary();}
  activePage='study';galaxy?.setPageHidden(true);document.querySelector('.galaxy-studio').hidden=true;$('studyPage').hidden=false;
 }
 const hash=window.SozStudyUI.routeHash(screen);
 if(writeRoute&&location.hash!==hash)(replace?history.replaceState:history.pushState||history.replaceState).call(history,{page:'study'},'',hash);
 studyDesk.open(screen);
}
for(const [id,screen] of [['studyButton','today'],['menuStudyButton','today'],['mapStudyLibrary','words']]){
 $(id).addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();openStudy(screen);});
}
$('studyBack').addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();showMap(true);});
function openGrammar(query='',writeRoute=true,config={}){
 if(race?.blocking){toast('Yarışı bitirdikdən sonra qrammatikanı aça bilərsiniz.');return;}
 if(activePage==='study')showMap(false);
 closeMenu();closeSearch();if($('libraryDialog').hasAttribute('open'))$('libraryDialog').close();
 if(activePage==='pictures'){pictureQuiz?.close();$('pictureQuizPage').hidden=true;}
 if(activePage==='map'){returnHash=location.hash.startsWith('#grammar=')?'#w='+encodeURIComponent(state.selected?.w||'gözəl'):location.hash;if(writeRoute)(history.pushState||history.replaceState).call(history,{page:'grammar'},'','#grammar='+encodeURIComponent(query||'qaçmaq'));}
 activePage='grammar';galaxy?.setPageHidden(true);document.querySelector('.galaxy-studio').hidden=true;$('conjugationPage').hidden=false;document.title='Fel təsrifləri — SÖZ';
 for(const id of archiveNodes)$('conjugationArchiveBody').append($(id));
 state.libraryMode='grammar';state.libraryLimit=60;$('libraryTitle').textContent='Qrammatika';$('grammarIntro').hidden=false;$('librarySearch').value=query;$('librarySearch').placeholder='Fel və ya saxlanmış forma ilə axtar…';$('librarySearch').setAttribute('aria-label','Qrammatika arxivində axtar');$('conjugationArchiveCount').textContent=model.grammarRecords.length+' forma';renderLibrary();
 routeOpening=true;const supported=conjugation.open(query,config);routeOpening=false;$('conjugationArchive').open=!!query&&!supported;
 if(writeRoute)writeGrammarRoute(conjugation.inspect());$('conjugationPage').scrollTop=0;
}
function writeGrammarRoute(c){if(activePage==='grammar'&&!routeOpening&&c.verb&&!c.pending)history.replaceState({page:'grammar'},'','#grammar='+encodeURIComponent(c.verb)+'&t='+c.tense+'&p='+c.person+'&n='+(c.negative?1:0)+'&q='+(c.question?1:0));}
function readGrammarRoute(){if(!location.hash.startsWith('#grammar='))return null;try{const [word,...parts]=location.hash.slice(9).split('&'),params=Object.fromEntries(parts.map(p=>p.split('=')));return {word:decodeURIComponent(word),tense:params.t,person:params.p,negative:params.n===undefined?undefined:params.n==='1',question:params.q==='1'};}catch{return {word:'qaçmaq'};}}
for(const id of ['conjugationBack','conjugationBrand'])$(id).onclick=e=>{e.preventDefault();showMap(true);$('menuButton').focus?.({preventScroll:true});};
// The picture quiz is its own page (#sekil). Pictures never appear in the word map.
function openPictures(writeRoute=true){
 if(!pictureQuiz){if(textStatus==='failed')loadText();if(writeRoute)toast('Şəkillər hazırlanır, bir anlıq gözləyin…');return;}
 if(race?.blocking){toast('Yarışı bitirdikdən sonra şəkilli sınağı aça bilərsiniz.');if(location.hash==='#sekil')history.replaceState(null,'','#w='+encodeURIComponent(state.selected.w));return;}
 if(activePage==='study')showMap(false);
 closeMenu();closeSearch();for(const d of document.querySelectorAll('dialog[open]'))d.close();
 if(activePage==='grammar'){conjugation?.close();$('conjugationPage').hidden=true;restoreLibrary();}
 if(activePage==='map')returnHash=location.hash.startsWith('#sekil')?'#w='+encodeURIComponent(state.selected?.w||'gözəl'):location.hash;
 if(writeRoute&&location.hash!=='#sekil')(history.pushState||history.replaceState).call(history,{page:'pictures'},'','#sekil');
 activePage='pictures';galaxy?.setPageHidden(true);document.querySelector('.galaxy-studio').hidden=true;$('pictureQuizPage').hidden=false;document.title='Şəkilli sınaq — SÖZ';
 pictureQuiz.open();
}
for(const id of ['pictureBack','pictureBrand'])$(id).onclick=e=>{e.preventDefault();showMap(true);$('menuButton').focus?.({preventScroll:true});};
function route(){
 if(race?.blocking){history.replaceState(null,'','#w='+encodeURIComponent(state.selected.w));return;}
 const studyRoute=window.SozStudyUI.readRoute(location.hash);
 if(studyRoute){openStudy(studyRoute,false);return;}
 if(location.hash==='#sekil'){openPictures(false);return;}
 const g=readGrammarRoute();if(g){openGrammar(g.word,false,g);return;}
 if(activePage!=='map')showMap(false);
 const n=fromHash();
 if(n){
  // An overview can already have this word selected without showing its card.
  if(n!==state.selected||document.querySelector('.galaxy-studio').dataset.mapView!=='word')select(n,false,false);
 }else if(model.formsByWord.has(hashWord()))library(model.archiveMode(hashWord()),hashWord());
}
function hashWord(){try{return decodeURIComponent(location.hash.replace(/^#w=/,''));}catch{return '';}}
function fromHash(){return model.resolveWord(hashWord());}
window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
function updateLocation({region,cluster}){currentRegion=region;currentCluster=cluster;$('breadcrumbRegion').hidden=!region;$('breadcrumbSeparator').hidden=!region;$('breadcrumbCluster').hidden=!cluster;$('breadcrumbRegion').textContent=region?.label||'';$('breadcrumbCluster').textContent=cluster?.label||'';}
try{galaxy=window.GalaxyView.mount({model,motionPreference:motionControl.value,onSelect:n=>select(n,true,true,null,false,'map'),onLocation:updateLocation,
 onView:view=>{document.querySelector('.galaxy-studio').dataset.mapView=view;}
 });$('mapLoading').hidden=true;}catch(error){console.error(error);$('mapLoading').replaceChildren(html('p','','Xəritə bu brauzerdə açıla bilmədi. Sözlük və axtarışdan istifadə edə bilərsiniz.'));}
for(const r of (galaxy?.atlas.regions||window.WORD_GALAXY_DATA.regions)){const b=html('button','',r.label);b.style.setProperty('--region-color',r.color);b.dataset.region=r.id;b.append(html('span','',r.count.toLocaleString('az')));b.onclick=()=>{closeMenu();setSheet(false);galaxy?.visitRegion(r.id);};$('regionDirectory').append(b);}
function renderCounts(){
 const defined=model.meta.orthography.defined??(model.textLoaded()?model.orthographyNodes.filter(n=>n.az&&n.en).length:null);
 $('collectionSize').textContent=model.nodes.length.toLocaleString('az')+' söz və ifadə';$('sourceCounts').textContent=`Xəritədə ${model.nodes.length.toLocaleString('az')} ayrı lüğət girişi: ${model.nodes.filter(n=>!n.w.includes(' ')).length.toLocaleString('az')} tək söz və ${model.nodes.filter(n=>n.w.includes(' ')).length.toLocaleString('az')} söz birləşməsi / ifadə. ${model.meta.nominal.moved_entries.toLocaleString('az')} qrammatik forma ayrıca formalar bölməsinə keçirilib. Fel təsrifləri ayrıca qrammatika arxivindədir (${model.grammarRecords.length.toLocaleString('az')} qeyd). İki böyük-kiçik hərf variantı birləşdirilib. İlkin məlumatlar saxlanılıb. ${model.orthographyNodes.length.toLocaleString('az')} yazılış orfoqrafiya lüğətinə əsasən əlavə edilib. Onlardan ${defined?.toLocaleString('az')??'…'} sözün izahı Azərbaycan və ingilis dillərində göstərilir. ${model.meta.growth.added_entries} söz və ifadədən ibarət genişlənmədən sonra tam məna yoxlaması aparılıb: ${model.meta.verification.assessed_entries.toLocaleString('az')} girişə baxılıb, ${model.meta.verification.corrected_entries.toLocaleString('az')} girişin izahı və ya əlavə mənaları dəqiqləşdirilib. Düzəlişlərin mənbələri söz kartında və yoxlama hesabatında göstərilir. Azərbaycan əlifbasının bütün hərfləri üzrə yeni söz əlaqələrində lüğət və qrammatika mənbələri göstərilir.`;}
renderCounts();
conjugation=window.ConjugationUI.mount({model,onChange:writeGrammarRoute,onMap:word=>select(model.byWord.get(word))});
try{morphology=window.SozMorphology.create({model,normalize,engine:conjugation.engine,verbs:conjugation.dictionary.verbs,english:window.ConjugationEnglish,englishData:window.CONJUGATION_ENGLISH_DATA});}catch(error){console.warn('Word-form analysis is unavailable',error);}
// The picture quiz and the daily word/quiz read definitions when they start,
// so they start once soz-text.json has arrived (at once in tests).
function recordQuizRecognition(answer){
 // Both existing games score one visible multiple-choice response per question.
 const head=model.resolveWord(answer.word);
 if(head)studyStore().record({kind:'word',key:head.w,channel:'recognize',correct:answer.correct});
}
function mountTextModules(){
 pictureQuiz=window.PictureQuizUI.mount({model,html,onStudyAnswer:recordQuizRecognition,onMap:word=>{history.replaceState(null,'','#w='+encodeURIComponent(word));showMap(false);select(model.byWord.get(word));}});
 window.LearningUI.mount({model,select,html,onStudyAnswer:recordQuizRecognition});
 if(location.hash==='#sekil')openPictures(false);
}
$('pictureQuizButton').onclick=()=>openPictures(true);
const initialGrammar=readGrammarRoute();
const initialWord=hashWord(),initialNode=fromHash();select(initialNode||model.byWord.get('gözəl'),false,!!initialNode,null,!initialNode);if(!initialNode&&model.formsByWord.has(initialWord))library(model.archiveMode(initialWord),initialWord);
if(initialGrammar)openGrammar(initialGrammar.word,false,initialGrammar);
const initialStudy=window.SozStudyUI.readRoute(location.hash);
if(initialStudy)openStudy(initialStudy,false);
else if(!location.hash&&!location.href?.endsWith('#')&&studyStore().settings().startPage==='today')openStudy('today',true,true);
if(model.textLoaded())mountTextModules();
race=window.RaceUI.mount({model,galaxy,select,resetHistory:()=>{state.history=[];},prepareMap:()=>{const previous=new Set(state.filters);state.filters=new Set(Object.keys(types));visibleFilters();galaxy?.setFilters(state.filters);return ()=>{state.filters=previous;visibleFilters();detail();galaxy?.setFilters(state.filters);};},selected:()=>state.selected?.w,toast,html});
// Vercel Web Analytics: anonymous page-view counts, no cookies. Only on the deployed site.
try{if(location.protocol==='https:'&&!/^(localhost|127\.|\[)/.test(location.hostname)){window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};const script=document.createElement('script');script.defer=true;script.src='/_vercel/insights/script.js';document.head.append(script);}}catch{}
// Prepare search text in small slices while the visitor looks at the map.
const idle=window.requestIdleCallback||(fn=>setTimeout(()=>{const start=performance.now();fn({timeRemaining:()=>Math.max(0,12-(performance.now()-start))});},40));
function prepareSearchWhenIdle(){idle(deadline=>{let done=false;while(!done&&deadline.timeRemaining()>4)done=model.prepareSearch(1500);if(!done)prepareSearchWhenIdle();else idle(()=>morphology?.warm());});}
prepareSearchWhenIdle();
// Definitions arrive in soz-text.json after the map: fill in what is on screen.
function textReady(){
 textStatus='ready';if(!appStarted)return;
 if(state.selected){const scroll=$('meaningCard').querySelector('.sheet-scroll'),top=scroll.scrollTop,senses=$('otherSenses').open;detail();scroll.scrollTop=top;$('otherSenses').open=senses;}
 renderCounts();galaxy?.refreshText();
 if(!$('searchResults').hidden)showSearch();
 if($('libraryDialog').open||$('libraryDialog').hasAttribute('open'))renderLibrary();
 prepareSearchWhenIdle();mountTextModules();
}
appStarted=true;
window.SozApp={selectWord:word=>select(model.resolveWord(word)),inspect:()=>({selected:state.selected?.w,sheetOpen,page:activePage,race:race?.inspect(),conjugation:conjugation?.inspect(),...galaxy?.inspect()})};
}
})();
