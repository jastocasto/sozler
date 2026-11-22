(() => {
'use strict';
const $=id=>document.getElementById(id),{types,normalize,createModel}=window.WordWeb;
const model=createModel(window.WORD_WEB_DATA,window.WORD_WEB_EXTRA,window.WORD_WEB_GRAMMAR,window.WORD_WEB_VOCABULARY,window.WORD_WEB_REVIEW,window.WORD_WEB_BILINGUAL,window.WORD_WEB_EXPANSION,window.WORD_WEB_NOMINAL,window.WORD_WEB_ADDITIONS,window.WORD_WEB_RELATIONS,window.WORD_WEB_REFERENCES,window.WORD_WEB_GROWTH,window.WORD_WEB_VERIFICATION,window.WORD_WEB_ORTHOGRAPHY,window.WORD_WEB_ORTHOGRAPHY_LEXICAL,window.WORD_WEB_PRINT_DEFINITIONS);
const posNames={word:'söz',noun:'isim',verb:'fel',adjective:'sifət',function:'qrammatik söz',form:'söz forması',adverb:'zərf',numeral:'say',pronoun:'əvəzlik',interjection:'nida',postposition:'qoşma',determiner:'təyinedici',conjunction:'bağlayıcı',particle:'ədat',preposition:'ön qoşma',phrase:'ifadə'};
let saved;try{saved=new Set(JSON.parse(localStorage.getItem('soz-toxumasi:saved')||'[]').filter(w=>model.allByWord.has(w)).map(w=>model.aliases[w]||w));}catch{saved=new Set();}
const state={selected:null,filters:new Set(Object.keys(types)),history:[],arrival:null,searchItems:[],searchIndex:0,libraryMode:'all',libraryLimit:60};
let conjugation=null,pictureQuiz=null,activePage='map',returnHash='',routeOpening=false;
let race=null;
let galaxy=null,sheetOpen=false,sheetGesture=null,suppressSheetClick=false,currentRegion=null,currentCluster=null;
const titleMeasure=document.createElement('canvas').getContext('2d');
function fitMeaningTitle(){const title=document.getElementById('meaningWord'),holder=document.getElementById('sheetToggle');if(!title||!holder||!titleMeasure)return;const max=innerWidth<640?21:23,available=Math.max(80,holder.clientWidth-16);titleMeasure.font=max+'px Georgia, serif';const needed=Math.max(1,...title.textContent.split(/\s+/).map(word=>titleMeasure.measureText(word).width));title.style.fontSize=Math.min(max,max*available/needed)+'px';}
window.addEventListener('resize',fitMeaningTitle);
function html(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function preview(n){
 const az=html('small','preview-az',n.az||(n.special?'Xüsusi':'İzah hələ əlavə edilməyib.'));
 const en=html('small','preview-en',n.en||(n.special?'Special':'Definition pending.'));
 az.lang='az';en.lang='en';return [az,en];
}
let toastTimeout;function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),2600);}
function closeMenu(){if($('menuDialog').open||$('menuDialog').hasAttribute('open'))$('menuDialog').close();}
function openDialog(id){closeMenu();$(id).showModal();}
function setSheet(open){if(!open&&$('sheetExtra').contains(document.activeElement))$('sheetToggle').focus({preventScroll:true});sheetOpen=open;$('meaningCard').dataset.expanded=String(open);$('sheetToggle').setAttribute('aria-expanded',String(open));$('sheetExtra').hidden=!open;$('sheetToggle').setAttribute('aria-label',state.selected?.w+(open?' — tam izahı bağla':' — tam izahı aç'));}
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
 renderMeaning(n);
 const linked=model.related(n,state.filters);$('connectionCount').textContent=linked.length;$('connections').replaceChildren();
 for(const type of ['syn','ant','root','topic','ending']){
  const t=types[type],group=linked.filter(x=>x.edge.type===type);if(!group.length&&(!state.filters.has(type)||!['syn','ant'].includes(type)))continue;
  const section=html('section','connection-group');section.dataset.type=type;section.style.setProperty('--color',t.color);
  const heading=html('h4');heading.textContent=t.name;heading.append(html('small','relation-count',group.length));const chips=html('div','word-chips');
  for(const x of group){const chip=html('button','word-chip',x.node.w);chip.style.cssText=`--chip-border:${t.border};--chip-bg:${t.fill};--chip-text:${t.text}`;const proof=model.connectionInfo(x.edge,n.w);chip.title=t.description+' · '+(proof?proof.from+': '+proof.sense:x.edge.note);chip.onclick=()=>select(x.node,true,true,x.edge);chips.append(chip);}
  if(!group.length){const empty=html('span','no-relation','—');empty.title='Bu söz üçün bu növ əlaqə qeyd edilməyib.';empty.setAttribute('aria-label',empty.title);chips.append(empty);}section.append(heading,chips);$('connections').append(section);
 }
 if(!linked.length)$('connections').append(html('p','empty-results',state.filters.size?'Bu söz üçün əlaqə qeyd edilməyib. Başqa bir söz axtarın.':'Əlaqələri göstərmək üçün rəng süzgəclərini aktiv edin.'));
 updateSaved();
}
function renderMeaning(n){
 const info=window.WordInfo.describeWord(n,model.byWord);$('meaningCard').querySelector('.sheet-scroll').scrollTop=0;
 $('meaningWord').textContent=n.w;fitMeaningTitle();$('meaningPos').textContent=n.orthographyPage&&n.pos==='word'?'orfoqrafiya':posNames[n.pos]||n.pos;$('meaningDefinition').textContent=info.definition||(n.special?window.WordInfo.specialMeaning.az:'İzah hələ əlavə edilməyib.');$('meaningDefinition').lang='az';$('meaningEnglish').textContent=info.definitionEnglish||(n.special?window.WordInfo.specialMeaning.en:'Definition pending.');$('meaningEnglish').lang='en';$('meaningEnglish').hidden=false;$('definitionLanguage').hidden=false;
 const grammar=$('meaningGrammar');grammar.replaceChildren();
 if(info.base){const label=html('span','',info.form?info.form.label+' · əsas söz: ':'əsas söz: '),base=html('button','meaning-base',info.base.w);base.onclick=()=>select(info.base);grammar.append(label,base);if(info.suffix)grammar.append(html('span','suffix-note',` + -${info.suffix}`));grammar.append(html('span','base-gloss',` (${info.base.en})`));}
 if(info.listedForm)grammar.append(html('span','form-notice','lüğət cədvəlindən forma'));
 if(info.generated){grammar.append(html('span','form-notice','qayda ilə yaradılmış forma'));}
 if(conjugation?.hasVerb(n.w)||n.pos==='verb'&&model.grammarRecords.some(f=>f.base===n.w)){const b=html('button','meaning-base','təsrif formaları ↗');b.onclick=()=>library('grammar',n.w);grammar.append(b);}if(model.nominalRecords.some(f=>f.lemma===n.w||f.w===n.w)){const b=html('button','meaning-base','hal və cəm formaları ↗');b.onclick=()=>library('forms',n.w);grammar.append(b);}grammar.hidden=!grammar.childNodes.length;
 const context=$('meaningContext');context.replaceChildren();context.hidden=!state.arrival;if(state.arrival){const t=types[state.arrival.type],proof=model.connectionInfo(state.arrival.edge,n.w);context.append(document.createTextNode(`${state.arrival.from} — ${n.w} · ${t.description}`));context.style.setProperty('--relation-color',t.color);if(proof){const line=html('span','relation-sense',`əlaqənin mənası · ${proof.from}: ${proof.sense}`);line.lang=proof.language;context.append(line);if(proof.senseEnglish){const english=html('span','relation-sense-en',proof.senseEnglish);english.lang='en';context.append(english);}const labels={'South-Azerbaijani':'Cənubi Azərbaycan işlənməsi',euphemistic:'evfemizm',poetic:'poetik',informal:'qeyri-rəsmi',obsolete:'köhnəlmiş',broadly:'geniş mənada',offensive:'təhqiramiz',slur:'təhqiramiz ad',derogatory:'alçaldıcı',ethnic:'etnik',dated:'köhnəlmiş',slang:'jarqon',rare:'az işlənən',archaic:'köhnəlmiş',dialectal:'şivə',colloquial:'danışıq dili',Classical:'klassik dil',figuratively:'məcazi',vulgar:'kobud ifadə'};const tags=(proof.tags||[]).map(x=>labels[x]).filter(Boolean);if(proof.qualifier||tags.length)context.append(html('span','relation-register',[proof.qualifier,...tags].filter(Boolean).join(' · ')));for(const ref of proof.refs||[{edition:proof.edition,head:proof.head}]){const a=html('a','relation-source','mənbə · '+(ref.title||ref.head||'lüğət')+' ↗');a.href=ref.url||'https://'+ref.edition+'.wiktionary.org/wiki/'+encodeURIComponent(ref.head);a.target='_blank';a.rel='noopener';context.append(a);}}}
 const example=$('meaningExample');example.replaceChildren();example.hidden=!info.example;
 if(info.example){example.append(html('span','example-label','məsələn'),html('q','example-az',info.example[0]));const en=html('span','example-en',info.example[1]);en.lang='en';example.append(en);}
 $('meaningUsage').textContent=info.usage;$('meaningUsage').hidden=!info.usage;
 const sources=$('meaningSource');sources.replaceChildren();sources.hidden=!n.orthographyPage&&!info.source&&!n.definitionSources?.length&&!n.special?.length&&n.definitionAuditStatus!=='needs-review';
 if(n.orthographyPage){
  const source=window.WORD_WEB_ORTHOGRAPHY;
  const link=html('a','relation-source',source.title+' ('+source.year+'), s. '+n.orthographyPage+' ↗');
  link.href=source.url+'#page='+n.orthographyPage;link.target='_blank';link.rel='noopener';
  sources.append(document.createTextNode('yazılış üçün mənbə: '),link);
 }
 if(n.definitionSources?.length){sources.append(document.createTextNode(sources.childNodes.length?' · izah mənbələri: ':'izah üçün mənbələr: '));for(const ref of n.definitionSources){const a=html('a','relation-source',(ref.title||'lüğət')+' ↗');a.href=ref.url;a.target='_blank';a.rel='noopener';sources.append(a);}}
 else if(info.source?.kind==='editorial'){const link=html('a','','SÖZ · izah qeydləri ↗');link.href=info.source.attribution||'expansion-attribution.json';link.target='_blank';link.rel='noopener';sources.append(link,html('span','translation-notice','Süni intellekt dəstəyi ilə hazırlanmış izah · AI-assisted definition'));}
 else if(info.source){const edition=info.source.edition||'en',link=html('a','','Wiktionary ('+edition+')');link.href=info.source.url||'https://'+edition+'.wiktionary.org/wiki/'+encodeURIComponent(info.source.head)+'#'+(({es:'Azerí',pl:'azerbejdżański',nl:'Azerbeidzjaans',fi:'Azeri',sv:'Azerbajdzjanska',it:'Azero',ja:'アゼルバイジャン語',pt:'Azerbaijano',en:'Azerbaijani',tr:'Azerice',ru:'Азербайджанский',fr:'Azéri',de:'Aserbaidschanisch',ku:'Azerî',az:'Azərbaycan_dili'})[edition]||'');link.target='_blank';link.rel='noopener';sources.append(document.createTextNode('mənbə: '),link,document.createTextNode((info.source.via==='mediawiki'?'':' · Kaikki')+' · CC BY-SA 4.0'));}
 const methodNotice={paraphrase:'Lüğət əsasında süni intellekt dəstəyi ilə yazılmış izah · AI-assisted paraphrase of the cited dictionary',derivation:'İzahlı lüğətin törəmə qeydi əsasında · from the dictionary’s derivation note',['cross-reference']:'İzahlı lüğətin istinadı əsasında · from the dictionary’s cross-reference',rule:'Qayda ilə qurulub · rule-based definition from the base word',authored:'Süni intellektlə yazılıb, çap lüğətlərində yoxdur · AI-written, not in the print dictionaries · yoxlanılmalıdır / needs review'}[n.definitionMethod];
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
 if(!n)return;if(race?.blocking&&!race.allow(n.w,source))return;if(activePage==='grammar')showMap(false);const previous=state.selected;state.arrival=null;
 if(previous&&previous.id!==n.id){const relation=viaEdge?{edge:viaEdge}:model.related(previous).find(x=>x.node.id===n.id);if(relation)state.arrival={from:previous.w,type:relation.edge.type,edge:relation.edge};if(record)state.history.push(previous.id);}
 state.selected=n;if(writeHash)history.replaceState(null,'','#w='+encodeURIComponent(n.w));
 $('backButton').hidden=!state.history.length;closeSearch();closeMenu();$('search').value='';if(document.activeElement===$('search'))$('search').blur();setSheet(false);detail();galaxy?.select(n,{initial});
}
function visibleFilters(){for(const b of $('filters').children){b.setAttribute('aria-pressed',state.filters.has(b.dataset.type));b.querySelector('.check').textContent=state.filters.has(b.dataset.type)?'✓':'−';}}
for(const[type,t]of Object.entries(types)){const b=html('button','filter');b.dataset.type=type;b.style.setProperty('--color',t.color);b.title=t.description;b.append(html('span','line-swatch'),document.createTextNode(t.name),html('span','check','✓'));b.setAttribute('aria-pressed','true');b.onclick=()=>{state.filters.has(type)?state.filters.delete(type):state.filters.add(type);visibleFilters();detail();galaxy?.setFilters(state.filters);};$('filters').append(b);}
$('resetFilters').onclick=()=>{state.filters=new Set(Object.keys(types));visibleFilters();detail();galaxy?.setFilters(state.filters);};
$('zoomIn').onclick=()=>galaxy?.zoom(1.8);$('zoomOut').onclick=()=>galaxy?.zoom(1/1.8);$('fitButton').onclick=()=>{setSheet(false);galaxy?.focus();};
for(const id of ['universeButton','brandHome','breadcrumbHome'])$(id).onclick=()=>{setSheet(false);closeSearch();galaxy?.home();};
$('breadcrumbRegion').onclick=()=>{if(currentRegion)galaxy?.visitRegion(currentRegion.id);};
$('backButton').onclick=()=>{const id=state.history.pop();if(id!==undefined)select(model.byId.get(id),false,true,null,false,'back');};
const interesting=model.nodes.filter(n=>['curated','wiktionary','editorial'].includes(n.quality)&&model.related(n).length>0);
$('randomButton').onclick=()=>{const options=interesting.filter(n=>n.id!==state.selected.id);select(options[Math.floor(Math.random()*options.length)]);};$('bookmarkButton').onclick=toggleSave;
function closeSearch(){$('searchResults').hidden=true;$('search').setAttribute('aria-expanded','false');$('search').removeAttribute('aria-activedescendant');}
function showSearch(){const query=$('search').value;const result=$('searchResults');result.replaceChildren();if(!query.trim()){closeSearch();return;}state.searchItems=model.search(query,9);const forms=[...model.grammarSearch(query),...model.nominalSearch(query)].filter(n=>n.key===normalize(query.trim()));
 if(forms.length&&!model.byWord.has(query.trim())){const bases=[...new Set(forms.map(f=>model.resolveWord(f.lemma||f.base)).filter(Boolean))];state.searchItems=[...bases,...state.searchItems.filter(n=>!bases.includes(n))].slice(0,9);}
 state.searchIndex=0;result.hidden=false;$('search').setAttribute('aria-expanded','true');
 for(const [i,n]of state.searchItems.entries()){const b=html('button','search-option');b.id='search-option-'+i;b.setAttribute('role','option');b.setAttribute('aria-selected',i===0);b.append(html('span','',n.w),...preview(n));b.onpointerdown=e=>e.preventDefault();b.onclick=()=>select(n);result.append(b);}
 for(const mode of ['forms','grammar']){if(!forms.some(f=>(f.kind==='nominal'?'forms':'grammar')===mode))continue;const i=state.searchItems.length;state.searchItems.push({grammarQuery:query,archiveMode:mode});const b=html('button','grammar-shortcut',mode==='forms'?'hal / cəm forması · formalarda aç ↗':'təsrif forması · qrammatikada aç ↗');b.id='search-option-'+i;b.setAttribute('role','option');b.setAttribute('aria-selected',i===0);b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{closeSearch();library(mode,query);};result.append(b);}
 if(!state.searchItems.length&&!forms.length)result.append(html('div','empty-results','Söz tapılmadı. “melumat”, “etmək” və ya “beautiful” ilə axtarın.'));
 if(state.searchItems.length)$('search').setAttribute('aria-activedescendant','search-option-0');else $('search').removeAttribute('aria-activedescendant');}
$('search').addEventListener('input',showSearch);$('search').addEventListener('focus',()=>{if($('search').value)showSearch();});
$('search').addEventListener('keydown',e=>{if(e.key==='Escape'){closeSearch();return;}if($('searchResults').hidden)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const count=state.searchItems.length;if(!count)return;state.searchIndex=(state.searchIndex+(e.key==='ArrowDown'?1:-1)+count)%count;for(const[b,i]of [...$('searchResults').children].map((b,i)=>[b,i]))b.setAttribute('aria-selected',i===state.searchIndex);$('search').setAttribute('aria-activedescendant','search-option-'+state.searchIndex);$('search-option-'+state.searchIndex).scrollIntoView({block:'nearest'});}if(e.key==='Enter'&&state.searchItems.length){e.preventDefault();const item=state.searchItems[state.searchIndex];if(item.grammarQuery){closeSearch();library(item.archiveMode||'grammar',item.grammarQuery);}else select(item);}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.search-wrap'))closeSearch();});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(activePage==='grammar')showMap(true);const open=document.querySelector('dialog[open]');if(open)open.close();$('search').focus();$('search').select();}});
function library(mode,query=''){if(mode==='grammar'){openGrammar(query);return;}if(activePage==='grammar')showMap(true);restoreLibrary();closeMenu();state.libraryMode=mode;state.libraryLimit=60;$('libraryTitle').textContent=mode==='saved'?'Yadda saxlananlar':mode==='grammar'?'Qrammatika':mode==='forms'?'Hal və cəm formaları':mode==='special'?'Xüsusi sözlər · Special':'Sözlük';$('librarySearch').value=query;$('librarySearch').placeholder=mode==='grammar'?'Fel və ya təsrif forması ilə axtar…':mode==='forms'?'Əsas söz və ya forma ilə axtar…':'Söz və ya məna ilə axtar…';$('librarySearch').setAttribute('aria-label',mode==='grammar'?'Qrammatika arxivində axtar':mode==='forms'?'Formalar arxivində axtar':'Sözlükdə axtar');$('grammarIntro').hidden=mode!=='grammar';$('formsIntro').hidden=mode!=='forms';for(const b of document.querySelectorAll('[data-library-mode]'))b.setAttribute('aria-pressed',b.dataset.libraryMode===mode);renderLibrary();if(!$('libraryDialog').open&&!$('libraryDialog').hasAttribute('open'))$('libraryDialog').showModal();}
const grammarLabels={past:'keçmiş zaman',present:'indiki zaman',future:'gələcək zaman',negative:'inkar',positive:'təsdiq',singular:'tək',plural:'cəm','first-person':'I şəxs','second-person':'II şəxs','third-person':'III şəxs',participle:'feli sifət',imperative:'əmr şəkli',conditional:'şərt şəkli',indicative:'xəbər şəkli',converb:'feli bağlama',conjugated:'təsrif forması','non-past':'keçmiş olmayan zaman',definite:'müəyyən',indefinite:'qeyri-müəyyən',perfect:'bitmiş',imperfect:'bitməmiş',nominative:'adlıq hal',genitive:'yiyəlik hal',dative:'yönlük hal',accusative:'təsirlik hal',locative:'yerlik hal',ablative:'çıxışlıq hal',possessive:'mənsubiyyət',comitative:'birgəlik',comparative:'müqayisə',predicative:'xəbərlik',misspelling:'yazılış variantı'};
function renderLibrary(){const query=$('librarySearch').value,mode=state.libraryMode;let list=mode==='grammar'?model.grammarSearch(query):mode==='forms'?model.nominalSearch(query):query?model.search(query,model.nodes.length):model.alphabetical;
 if(mode==='special')list=query?list.filter(node=>node.special):model.specialNodes;
 if(mode==='saved'){list=list.filter(n=>saved.has(n.w));for(const w of saved){if(!model.byWord.has(w)&&(!query||normalize(w).includes(normalize(query))))list.push(model.allByWord.get(w));}}
 const container=$('libraryList');container.replaceChildren();container.classList.toggle('grammar-list',mode==='grammar'||mode==='forms');$('libraryMeta').textContent=mode==='grammar'?`${list.length.toLocaleString('az')} təsrif forması · ${new Set(list.map(n=>n.base)).size.toLocaleString('az')} fel`:mode==='forms'?`${list.length.toLocaleString('az')} forma · ${new Set(list.map(n=>n.lemma||n.base)).size.toLocaleString('az')} əsas söz`:`${list.length.toLocaleString('az')} söz və ifadə`;
 if(!list.length)container.append(html('p','empty-results',mode==='saved'&&!saved.size?'Hələ yadda saxlanmış söz yoxdur. Xəritədə söz seçin və əlfəcin işarəsinə toxunun.':(mode==='grammar'||mode==='forms')?'Bu axtarışa uyğun saxlanmış forma yoxdur.':'Bu axtarışa uyğun söz tapılmadı.'));
 if(mode==='grammar'||mode==='forms'){
  const groups=new Map();for(const form of list.slice(0,state.libraryLimit)){if(!groups.has(form.base))groups.set(form.base,[]);groups.get(form.base).push(form);}
  for(const[base,forms]of groups){const section=html('section','grammar-group'),heading=html('h3');const lemma=model.resolveWord(base),button=html(lemma?'button':'span','grammar-lemma',base||'əsas söz qeyd edilməyib');if(lemma){button.title='Əsas sözü xəritədə aç';button.onclick=()=>{$('libraryDialog').close();select(lemma);};}heading.append(button,html('small','',base?(mode==='forms'?'əsas söz':'məsdər'):'arxiv'));section.append(heading);
   for(const f of forms){const row=html('div','grammar-row');row.dataset.grammarWord=f.w;if(mode==='forms')row.dataset.nominalWord=f.w;row.append(html('strong','',f.w));const tags=(f.analyses?.[0]?.tags||f.tags).map(t=>grammarLabels[t]).filter(Boolean);if(tags.length)row.append(html('small','grammar-tags',[...new Set(tags)].join(' · ')));const meaning=html('p','grammar-az',f.az),english=html('p','grammar-en',f.en);meaning.lang='az';english.lang='en';row.append(meaning,english);if(mode==='forms'&&f.definitions.length>1){const more=html('details','form-analyses');more.append(html('summary','','digər qrammatik mənalar'));for(const d of f.definitions.slice(1)){const az=html('p','grammar-az',d.az),en=html('p','grammar-en',d.en);az.lang='az';en.lang='en';more.append(az,en);}row.append(more);}const sourceLine=html('small','grammar-source','AZ · EN · ');if(f.origin==='original')sourceLine.append(document.createTextNode('ilkin kolleksiya'));else{const source=html('a','','Wiktionary ↗');source.href='https://en.wiktionary.org/wiki/'+encodeURIComponent(f.source.head)+'#Azerbaijani';source.target='_blank';source.rel='noopener';sourceLine.append(source);}row.append(sourceLine);if(saved.has(f.w))row.append(html('small','grammar-tags','yadda saxlanılıb'));section.append(row);}container.append(section);}
 }else for(const n of list.slice(0,state.libraryLimit)){const archived=!model.byWord.has(n.w),b=html('button','library-row'),label=html('span');label.append(html('strong','',n.w));if(archived)label.append(html('small','',model.archiveMode(n.w)==='forms'?'formalar · saxlanmış hal / cəm forması':'qrammatika · saxlanmış təsrif forması'));else label.append(...preview(n));b.append(label,html('span','','↗'));b.onclick=()=>{if(archived)library(model.archiveMode(n.w),n.w);else{$('libraryDialog').close();select(n);}};container.append(b);}
 $('loadMore').hidden=state.libraryLimit>=list.length;}
$('librarySearch').oninput=()=>{state.libraryLimit=60;renderLibrary();};$('loadMore').onclick=()=>{state.libraryLimit+=60;renderLibrary();};$('dictionaryTab').onclick=()=>library('all');$('savedTab').onclick=()=>library('saved');
$('grammarTab').onclick=()=>library('grammar');$('formsTab').onclick=()=>library('forms');for(const b of document.querySelectorAll('[data-library-mode]'))b.onclick=()=>library(b.dataset.libraryMode);
$('relationshipRulesButton').onclick=()=>openDialog('relationshipDialog');$('helpButton').onclick=()=>openDialog('helpDialog');$('dataInfoButton').onclick=()=>openDialog('dataDialog');
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});

const archiveNodes=['grammarIntro','librarySearch','libraryMeta','libraryList','loadMore'];
function restoreLibrary(){for(const id of archiveNodes)if($(id).parentElement!==$('libraryDialog'))$('libraryDialog').append($(id));}
function showMap(writeRoute=true){const restoreFocus=$('conjugationPage').contains(document.activeElement)||$('pictureQuizPage').contains(document.activeElement);conjugation?.close();pictureQuiz?.close();activePage='map';$('conjugationPage').hidden=true;$('pictureQuizPage').hidden=true;document.querySelector('.galaxy-studio').hidden=false;document.title='SÖZ — Söz kainatı';restoreLibrary();galaxy?.setPageHidden(false);if(restoreFocus)$('menuButton').focus?.({preventScroll:true});if(writeRoute)history.replaceState(null,'',returnHash||'#w='+encodeURIComponent(state.selected?.w||'gözəl'));}
function openGrammar(query='',writeRoute=true,config={}){
 if(race?.blocking){toast('Yarışı bitirdikdən sonra qrammatikanı aça bilərsiniz.');return;}
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
 if(race?.blocking){toast('Yarışı bitirdikdən sonra şəkilli sınağı aça bilərsiniz.');if(location.hash==='#sekil')history.replaceState(null,'','#w='+encodeURIComponent(state.selected.w));return;}
 closeMenu();closeSearch();for(const d of document.querySelectorAll('dialog[open]'))d.close();
 if(activePage==='grammar'){conjugation?.close();$('conjugationPage').hidden=true;restoreLibrary();}
 if(activePage==='map')returnHash=location.hash.startsWith('#sekil')?'#w='+encodeURIComponent(state.selected?.w||'gözəl'):location.hash;
 if(writeRoute&&location.hash!=='#sekil')(history.pushState||history.replaceState).call(history,{page:'pictures'},'','#sekil');
 activePage='pictures';galaxy?.setPageHidden(true);document.querySelector('.galaxy-studio').hidden=true;$('pictureQuizPage').hidden=false;document.title='Şəkilli sınaq — SÖZ';
 pictureQuiz.open();
}
for(const id of ['pictureBack','pictureBrand'])$(id).onclick=e=>{e.preventDefault();showMap(true);$('menuButton').focus?.({preventScroll:true});};
function route(){if(race?.blocking){history.replaceState(null,'','#w='+encodeURIComponent(state.selected.w));return;}if(location.hash==='#sekil'){openPictures(false);return;}const g=readGrammarRoute();if(g){openGrammar(g.word,false,g);return;}if(activePage!=='map')showMap(false);const n=fromHash();if(n){if(n!==state.selected)select(n,false,false);}else if(model.formsByWord.has(hashWord()))library(model.archiveMode(hashWord()),hashWord());}
function hashWord(){try{return decodeURIComponent(location.hash.replace(/^#w=/,''));}catch{return '';}}
function fromHash(){return model.resolveWord(hashWord());}
window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
function updateLocation({region,cluster}){currentRegion=region;currentCluster=cluster;$('breadcrumbRegion').hidden=!region;$('breadcrumbSeparator').hidden=!region;$('breadcrumbCluster').hidden=!cluster;$('breadcrumbRegion').textContent=region?.label||'';$('breadcrumbCluster').textContent=cluster?.label||'';}
try{galaxy=window.GalaxyView.mount({model,onSelect:n=>select(n,true,true,null,false,'map'),onLocation:updateLocation});$('mapLoading').hidden=true;}catch(error){console.error(error);$('mapLoading').replaceChildren(html('p','','Xəritə bu brauzerdə açıla bilmədi. Sözlük və axtarışdan istifadə edə bilərsiniz.'));}
for(const r of (galaxy?.atlas.regions||window.WORD_GALAXY_DATA.regions)){const b=html('button','',r.label);b.style.setProperty('--region-color',r.color);b.dataset.region=r.id;b.append(html('span','',r.count.toLocaleString('az')));b.onclick=()=>{closeMenu();setSheet(false);galaxy?.visitRegion(r.id);};$('regionDirectory').append(b);}
$('collectionSize').textContent=model.nodes.length.toLocaleString('az')+' söz və ifadə';$('sourceCounts').textContent=`Xəritədə ${model.nodes.length.toLocaleString('az')} ayrı lüğət girişi: ${model.nodes.filter(n=>!n.w.includes(' ')).length.toLocaleString('az')} tək söz və ${model.nodes.filter(n=>n.w.includes(' ')).length.toLocaleString('az')} söz birləşməsi / ifadə. ${window.WORD_WEB_NOMINAL.meta.moved_entries.toLocaleString('az')} qrammatik forma ayrıca formalar bölməsinə keçirilib. Fel təsrifləri ayrıca qrammatika arxivindədir (${model.grammarRecords.length.toLocaleString('az')} qeyd). İki böyük-kiçik hərf variantı birləşdirilib. İlkin məlumatlar saxlanılıb. ${model.orthographyNodes.length.toLocaleString('az')} yazılış orfoqrafiya lüğətinə əsasən əlavə edilib. Onlardan ${model.orthographyNodes.filter(n=>n.az&&n.en).length.toLocaleString('az')} sözün izahı Azərbaycan və ingilis dillərində göstərilir. ${window.WORD_WEB_GROWTH.meta.added_entries} söz və ifadədən ibarət genişlənmədən sonra tam məna yoxlaması aparılıb: ${window.WORD_WEB_VERIFICATION.meta.assessed_entries.toLocaleString('az')} girişə baxılıb, ${window.WORD_WEB_VERIFICATION.meta.corrected_entries.toLocaleString('az')} girişin izahı və ya əlavə mənaları dəqiqləşdirilib. Düzəlişlərin mənbələri söz kartında və yoxlama hesabatında göstərilir. Azərbaycan əlifbasının bütün hərfləri üzrə yeni söz əlaqələrində lüğət və qrammatika mənbələri göstərilir.`;
conjugation=window.ConjugationUI.mount({model,onChange:writeGrammarRoute,onMap:word=>select(model.byWord.get(word))});
pictureQuiz=window.PictureQuizUI.mount({model,html,onMap:word=>{history.replaceState(null,'','#w='+encodeURIComponent(word));showMap(false);select(model.byWord.get(word));}});
$('pictureQuizButton').onclick=()=>openPictures(true);
const initialGrammar=readGrammarRoute();
const initialWord=hashWord(),initialNode=fromHash();select(initialNode||model.byWord.get('gözəl'),false,!!initialNode,null,!initialNode);if(!initialNode&&model.formsByWord.has(initialWord))library(model.archiveMode(initialWord),initialWord);
if(initialGrammar)openGrammar(initialGrammar.word,false,initialGrammar);
if(location.hash==='#sekil')openPictures(false);
window.LearningUI.mount({model,select,html});
race=window.RaceUI.mount({model,galaxy,select,resetHistory:()=>{state.history=[];},prepareMap:()=>{const previous=new Set(state.filters);state.filters=new Set(Object.keys(types));visibleFilters();galaxy?.setFilters(state.filters);return ()=>{state.filters=previous;visibleFilters();detail();galaxy?.setFilters(state.filters);};},selected:()=>state.selected?.w,toast,html});
window.SozApp={selectWord:word=>select(model.resolveWord(word)),inspect:()=>({selected:state.selected?.w,sheetOpen,page:activePage,race:race?.inspect(),conjugation:conjugation?.inspect(),...galaxy?.inspect()})};
})();
