/* A local reading shelf and dictionary lookup for scanned or pasted pages. */
(function (root) {
'use strict';

const bookTitle = 'Qaranlıq günəş';
const shelfKey = 'soz-toxumasi:reader:v1';
const placeKey = 'soz-toxumasi:reader-place';
const idPattern = /^[a-z0-9-]{1,80}$/;
const maxPageLength = 20000;
const pageOrder = new Intl.Collator('az', {numeric:true});
function readingSpelling(value) {
 return value.toLocaleLowerCase('az').normalize('NFC').trim().replace(/\s+/g,' ').replace(/,\s*/g,', ').replace(/[‐‑]/g,'-');
}

function label(value, limit) {
 return typeof value === 'string' && value.length <= limit && !/[\u0000-\u001f\u007f]/u.test(value);
}
function validatePages(input) {
 if (!Array.isArray(input)) throw Error('The reading shelf in this backup is invalid.');
 return input.map(value => {
  if (!value || typeof value !== 'object') throw Error('This backup contains an invalid reading page.');
  const {id, title, page, text, updated, chapter} = value;
  if (typeof id !== 'string' || !idPattern.test(id) || !label(title, 140) || !title.trim() || !label(page, 20) ||
      typeof text !== 'string' || !text.trim() || text.length > maxPageLength || !Number.isSafeInteger(updated) || updated < 0 || updated > 253402300799999) {
   throw Error('This backup contains an invalid reading page.');
  }
  const record = {id,title,page,text,updated};
  if (chapter !== undefined) {
   if (!chapter || !label(chapter.number,16) || !chapter.number.trim() || !label(chapter.title,120) || !chapter.title.trim()) {
    throw Error('This reading page has an invalid chapter heading.');
   }
   record.chapter = {number:chapter.number,title:chapter.title};
  }
  return record;
 });
}
function readingFilePages(data) {
 if (data?.format!=='sozler-personal-study' || data.version!==1) throw Error('Choose a Sozler reading-pages file.');
 const records=validatePages(data.readingPages);
 if (!records.length) throw Error('This file contains no reading pages.');
 return records;
}
function mergePages(pages, records) {
 let added=0;
 for (const page of records) {
  const old=pages.get(page.id);
  if (!old || page.updated>old.updated) { pages.set(page.id,page);if (!old) added++; }
 }
 return added;
}
function storedPages(storage) {
 const raw=storage.getItem(shelfKey);
 return raw ? validatePages(JSON.parse(raw)) : [];
}
function firstPage(records) {
 return records.slice().sort((a,b)=>pageOrder.compare(a.page,b.page))[0];
}
async function openPrivateLink(status) {
 const link=root.location.hash.match(/^#([a-f0-9]{20})\.([A-Za-z0-9_-]{43})$/);
 root.history.replaceState(null,'',root.location.pathname);
 if (!link) { status.textContent='Open the original private book link to load the pages.';return; }
 try {
  const decode=value=>Uint8Array.from(root.atob(value.replace(/-/g,'+').replace(/_/g,'/')),ch=>ch.charCodeAt(0));
  const response=await root.fetch('/reader-bundles/'+link[1]+'.json');
  if (!response.ok) throw Error('Book request failed');
  const {sealed}=await response.json(), bytes=decode(sealed);
  const key=await root.crypto.subtle.importKey('raw',decode(link[2]),'AES-GCM',false,['decrypt']);
  const plaintext=await root.crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12)},key,bytes.subarray(12));
  const records=readingFilePages(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plaintext)));
  const storage=root.localStorage, pages=new Map(storedPages(storage).map(page=>[page.id,page]));
  mergePages(pages,records);
  storage.setItem(shelfKey,JSON.stringify([...pages.values()]));
  root.location.replace('/#study/read/'+firstPage(records).id);
 } catch { status.textContent='The book could not open. Try the original link again.'; }
}
function wordsOnPage(text, model) {
 const words = [...text.matchAll(/[\p{L}\p{M}]+(?:['’‐‑-][\p{L}\p{M}]+)*/gu)];
 const parts = [];
 let cursor = 0;
 for (let i = 0; i < words.length; i++) {
  const first = words[i], start = first.index;
  let last = first, matched = i;
  if (start > cursor) parts.push(text.slice(cursor,start));
  // Prefer attested multiword entries within a sentence. Keep the original spacing on the page.
  for (let j = i+1; j < Math.min(i+4,words.length); j++) {
   const previous = words[j-1], after = words[j];
   const gap = text.slice(previous.index+previous[0].length,after.index);
   if (!/^(?:\s+|,\s*)$/.test(gap) || /\n\s*\n/.test(gap)) break;
   const query = readingSpelling(text.slice(start,after.index+after[0].length));
   if (model.resolveWord(query)) { last = after;matched = j; }
  }
  const end = last.index + last[0].length;
  parts.push({text:text.slice(start,end), start, end});
  i = matched;cursor = end;
 }
 if (cursor < text.length) parts.push(text.slice(cursor));
 return parts;
}
function excerpt(text, start, end) {
 const breaks = /[.!?\n…]/u;
 let before = start, after = end;
 while (before > Math.max(0,start-275) && !breaks.test(text[before-1])) before--;
 while (after < Math.min(text.length,end+275) && !breaks.test(text[after])) after++;
 if (after < text.length && /[.!?…]/u.test(text[after])) after++;
 return text.slice(before,after).trim().slice(0,600);
}

function mount({host, study, model, analyze, navigate, openWord, onChange}) {
 const document = host.ownerDocument, levels = root.SozStudyLibrary.levels;
 const wide = root.matchMedia?.('(min-width: 900px)');
 const scroll=document.getElementById('studyPage');
 const positions=new Map(), passages=new WeakMap();
 let pages=new Map(), current=null, scanJob=null, bubble=null, draft=null, fields=null, shelfStatus='';
 let highlighted=[], selectionTimer, touch=null, quietUntil=0, practice=null;
 let fontSize=0;
 try { fontSize=Math.max(-2,Math.min(3,Number(root.localStorage.getItem('soz-toxumasi:reader-font'))||0)); } catch {}
 function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
 }
 function button(text, className, action) {
  const el = node('button', className, text);el.type = 'button';el.addEventListener('click',action);return el;
 }
 function readShelf() {
  try {
   mergePages(pages,storedPages(root.localStorage));
   return true;
  } catch {
   shelfStatus = 'The saved reading shelf could not be opened. A backup can keep a copy of new pages.';
   return false;
  }
 }
 function storeShelf() {
  if (!readShelf()) return false;
  try { root.localStorage.setItem(shelfKey,JSON.stringify([...pages.values()]));shelfStatus='';return true; }
  catch { shelfStatus='This browser could not save the page. It is available in this session and in a backup.';return false; }
 }
 function savedPages() { readShelf();return [...pages.values()].sort((a,b) => b.updated-a.updated); }
 function restore(records) { readShelf();const added=mergePages(pages,records);return {added,saved:!records.length || storeShelf()}; }
 function readerMode(active,controls=false) {
  document.documentElement.classList.toggle('book-reader-open',active);
  document.documentElement.classList.toggle('book-controls-open',active&&controls);
 }
 function closeLookup() {
  bubble?.remove();bubble=null;
  for (const word of highlighted) word.removeAttribute('data-reader-active');
  highlighted=[];
 }
 function mark(passage,start,end) {
  for (const word of highlighted) word.removeAttribute('data-reader-active');
  highlighted=[...passage.querySelectorAll('.reader-word')].filter(word=>Number(word.dataset.start)<end&&Number(word.dataset.end)>start);
  for (const word of highlighted) word.setAttribute('data-reader-active','');
 }
 function close() {
  if (fields && !current) draft = {title:fields.title.value,page:fields.page.value,text:fields.text.value};
  if (current&&!fields&&!practice&&scroll) positions.set(current.id,scroll.scrollTop);
  clearTimeout(selectionTimer);clearTimeout(touch?.timer);touch=null;practice=null;
  scanJob?.abort();scanJob=null;closeLookup();current=null;fields=null;readerMode(false);host.replaceChildren();
 }
 function bibliographicCard() {
  const card = node('section','study-section reader-book'), title = node('h2','',bookTitle);title.lang='az';
  const source = node('a','reader-source','Library record');source.href='https://www.preslib.az/az/book/8MbPRIFKDQlXWDF';source.target='_blank';source.rel='noopener noreferrer';
  card.append(title,node('p','study-note','Zaur Pənahov'),source);return card;
 }
 function importCard() {
  const card = node('section','study-section reader-import'), status = node('p','reader-status');
  status.setAttribute('role','status');
  const control = node('label','study-button reader-file','Import pages'), input = node('input');
  input.type='file';input.accept='.json,application/json';control.append(input);
  input.addEventListener('change',async () => {
   const file=input.files?.[0];input.value='';if (!file) return;
   try {
    const data=JSON.parse(await file.text());
    if (!host.contains(card)) return;
    const records=readingFilePages(data);
    restore(records);
    navigate('read/'+firstPage(records).id);
   } catch (error) { status.textContent=error.message; }
  });
  card.append(node('h2','','Book pages'),control,status);
  return card;
 }
 function pageLabel(page) { return page.page ? 'Page '+page.page : page.text.replace(/\s+/g,' ').slice(0,30)+'…'; }
 function shelf() {
  const entries = savedPages();
  if (!entries.length) return null;
  const wrap = node('section','study-section reader-shelf'), title = node('h2','','Saved pages');
  let last;
  try { last=entries.find(page=>page.id===root.localStorage.getItem(placeKey)); } catch {}
  const list = node('select','study-input');list.setAttribute('aria-label','Saved pages');
  const placeholder = node('option','','Choose a page');placeholder.value='';list.append(placeholder);
  for (const page of entries) {
   const option = node('option','',pageLabel(page)+' · '+page.title);option.value=page.id;
   if (page.id === current?.id) option.selected=true;
   list.append(option);
  }
  list.addEventListener('change',() => { if (list.value) navigate('read/'+list.value); });
  wrap.append(title);
  if (last) wrap.append(button('Continue reading · '+pageLabel(last),'study-button',()=>navigate('read/'+last.id)));
  wrap.append(list);return wrap;
 }
 function field(labelText, control) {
  const el = node('label','reader-field');el.append(node('span','',labelText),control);return el;
 }
 function filePicker(labelText, useCamera, onFile) {
  const input = node('input');input.type='file';input.accept='image/*';
  if (useCamera) input.setAttribute('capture','environment');
  input.addEventListener('change',() => { const file=input.files?.[0];input.value='';if (file) onFile(file); });
  const label = node('label','study-button reader-file');label.append(labelText,input);return label;
 }
 function editor(entry, notice = '') {
  const panel = node('section','study-section reader-editor'), title = node('input'), page = node('input');
  const text = node('textarea'), toolbar = node('div','reader-actions'), status = node('p','reader-status',notice || shelfStatus);
  status.setAttribute('role','status');
  title.maxLength=140;title.value=entry?.title || draft?.title || bookTitle;title.required=true;
  page.maxLength=20;page.value=entry?.page ?? draft?.page ?? '';page.inputMode='numeric';
  text.maxLength=maxPageLength;text.rows=7;text.lang='az';text.spellcheck=false;text.value=entry?.text ?? draft?.text ?? '';
  text.placeholder='Paste Azerbaijani text or scan a page.';
  fields = {title,page,text};
  const open = button('Open page','study-cta',save), cancel = button('Cancel scan','study-button',() => {
   scanJob?.abort();scanJob=null;setScanning(false);status.textContent='Scan canceled.';
  });
  cancel.hidden=true;
  function setScanning(value) { open.disabled=value;cancel.hidden=!value; }
  async function scan(file) {
   scanJob?.abort();const job = new AbortController();scanJob=job;
   setScanning(true);status.textContent='Reading the photo on this device…';
   try {
    const result = await root.SozReaderOCR.scan(file,{signal:job.signal,onProgress:progress => {
     if (scanJob===job) status.textContent='Reading text · '+Math.round(100*progress)+'%';
    }});
    if (scanJob!==job) return;
    if (!result) { status.textContent='No text was found. Try a closer photo of one page.';return; }
    text.value=result.slice(0,maxPageLength);status.textContent='Check the scan for typos, then open the page.';
   } catch (error) {
    if (scanJob===job) status.textContent=error.message || 'The scan could not finish.';
   } finally {
    if (scanJob===job) { scanJob=null;setScanning(false); }
   }
  }
  function save() {
   const titleText=title.value.trim(), pageNumber=page.value.trim(), body=text.value.replace(/\r\n?/g,'\n').normalize('NFC').trim();
   if (!label(titleText,140) || !titleText || !label(pageNumber,20)) { status.textContent='Enter a book title and optional page number.';return; }
   if (!body || body.length > maxPageLength) { status.textContent='Add text from one page to start reading.';text.focus();return; }
   const existing=entry || savedPages().find(item=>item.title===titleText && item.page===pageNumber && item.text===body);
   const id=existing?.id || root.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
   const updated=Math.max(Date.now(),(existing?.updated ?? 0)+1);
   pages.set(id,{...existing,id,title:titleText,page:pageNumber,text:body,updated});storeShelf();
   draft=null;fields=null;
   if (entry) showPage(pages.get(id));else navigate('read/'+id);
  }
  toolbar.append(filePicker('Take photo',true,scan),filePicker('Choose photo',false,scan),cancel);
  panel.append(node('h2','',entry?'Edit page':'Add a page'),node('p','study-note','Scan a page and check the text. Then tap words to look them up. Photos are processed on this device.'),
   field('Book title',title),field('Page number (optional)',page),toolbar,status,field('Page text',text),open);
  if (entry) panel.append(button('Back to page','study-text-link reader-back',()=>showPage(entry)));
  return panel;
 }
 function showPage(entry) {
  const all=savedPages();
  entry=pages.get(entry.id)||entry;
  fields=null;current=entry;practice=null;
  readerMode(true);
  try { root.localStorage.setItem(placeKey,entry.id); } catch {}
  const volume=all.filter(page=>page.title===entry.title).sort((a,b)=>pageOrder.compare(a.page,b.page));
  let start=volume.findIndex(page=>page.id===entry.id), end=start;
  const pair=(a,b)=>a?.page && b?.page && /^\d+$/.test(a.page) && /^\d+$/.test(b.page) &&
   Number(a.page)%2===0 && Number(b.page)===Number(a.page)+1;
  if (wide?.matches) {
   if (pair(volume[start-1],entry)) start--;
   if (pair(volume[start],volume[start+1])) end=start+1;
  }
  const frame=node('section','reader-volume'), header=node('header','reader-volume-header'), scene=node('div','reader-book-scene');
  frame.style.setProperty('--reader-font-step',String(fontSize));
  header.id='reader-toolbar';header.hidden=true;
  const toggle=button('','reader-top-target',()=>setControls(header.hidden));
  toggle.setAttribute('aria-controls',header.id);
  function setControls(show) {
   header.hidden=!show;toggle.setAttribute('aria-expanded',String(show));
   toggle.setAttribute('aria-label',show?'Hide reader controls':'Show reader controls');
   readerMode(true,show);
  }
  setControls(false);
  const heading=node('h2','reader-volume-title',entry.title);heading.lang='az';
  const tools=node('div','reader-actions reader-volume-tools');
  function resizeText(delta) {
   fontSize=Math.max(-2,Math.min(3,fontSize+delta));
   frame.style.setProperty('--reader-font-step',String(fontSize));
   try { root.localStorage.setItem('soz-toxumasi:reader-font',String(fontSize)); } catch {}
  }
  const smaller=button('A−','reader-tool',()=>resizeText(-1));smaller.setAttribute('aria-label','Smaller text');
  const larger=button('A+','reader-tool',()=>resizeText(1));larger.setAttribute('aria-label','Larger text');
  tools.append(button('Shelf','reader-tool',()=>navigate('read')),button('Practice','reader-tool',()=>startPractice(volume,entry)),smaller,larger,
   button('Edit','reader-tool',()=>{
   if (scroll) positions.set(entry.id,scroll.scrollTop);
   readerMode(false);closeLookup();
   frame.replaceChildren(editor(entry));
  }));
  const navigation=node('nav','reader-pager');navigation.setAttribute('aria-label','Book pages');
  const jump=node('select','study-input reader-page-jump');jump.setAttribute('aria-label','Go to page');
  for (const page of volume) {
   const option=node('option','',pageLabel(page));option.value=page.id;option.selected=page.id===entry.id;jump.append(option);
  }
  jump.addEventListener('change',()=>{ if(jump.value)navigate('read/'+jump.value); });
  function turn(label,target) {
   const control=button(label,'study-button reader-turn',()=>{ if(target)navigate('read/'+target.id); });
   control.disabled=!target;return control;
  }
  navigation.append(turn('← Previous',volume[start-1]),jump,turn('Next →',volume[end+1]));
  header.append(heading,tools,navigation);
  if (end>start) scene.classList.add('reader-spread');
  const visible=volume.slice(start,end+1);
  for (const page of visible) scene.append(leaf(page));
  if (shelfStatus) header.append(node('p','study-note',shelfStatus));
  const bottom=node('nav','reader-bottom');bottom.setAttribute('aria-label','Turn pages');
  if (volume[start-1]) bottom.append(turn('← Previous',volume[start-1]));
  if (volume[end+1]) bottom.append(turn('Next →',volume[end+1]));
  frame.append(toggle,header,scene,bottom);
  host.replaceChildren(frame);
  if (scroll) scroll.scrollTop=positions.get(entry.id)||0;
 }
 function leaf(page) {
  const paper=node('article','reader-paper reader-leaf'), passage=node('div','reader-passage');
  paper.lang='az';paper.setAttribute('aria-label',page.page?'Page '+page.page:page.title);
  if (page.chapter) {
   const chapter=node('header','reader-chapter');
   chapter.append(node('span','reader-chapter-number',page.chapter.number),node('h3','',page.chapter.title));
   paper.append(chapter);
  }
  let offset=0;
  for (const paragraph of page.text.split('\n\n')) {
   const block=node('p','reader-paragraph');
   for (const part of wordsOnPage(paragraph,model)) {
    if (typeof part==='string') { block.append(document.createTextNode(part));continue; }
    const word=node('span','reader-word',part.text);
    word.setAttribute('role','button');word.tabIndex=0;
    word.dataset.start=String(offset+part.start);word.dataset.end=String(offset+part.end);
    block.append(word);
   }
   passage.append(block,document.createTextNode('\n\n'));offset+=paragraph.length+2;
  }
  passages.set(passage,page);
  wireSelection(passage,page);
  paper.append(passage);
  if (page.page) paper.append(node('footer','reader-folio',page.page));
  return paper;
 }
 function position(word) {
  return {start:Number(word.dataset.start),end:Number(word.dataset.end),text:word.textContent};
 }
 function choose(page,passage,a,b,word=false) {
  const start=Math.min(a.start,b.start),end=Math.max(a.end,b.end),text=page.text.slice(start,end);
  if (!text.trim()) return;
  closeLookup();mark(passage,start,end);
  if (word || !/\s/u.test(text.trim())) lookup(page,{start,end,text});
  else translateSelection(page,start,end);
 }
 function wireSelection(passage,page) {
  const wordAt=event=>event.target.closest?.('.reader-word');
  passage.addEventListener('click',event=>{
   const word=wordAt(event);
   if (!word || Date.now()<quietUntil || document.getSelection?.()?.toString().trim()) return;
   const point=position(word);
   choose(page,passage,point,point,true);
  });
  passage.addEventListener('keydown',event=>{
   const word=wordAt(event);
   if (!word || !['Enter',' '].includes(event.key)) return;
   event.preventDefault();
   const point=position(word);
   choose(page,passage,point,point,true);
   bubble?.focus({preventScroll:true});
  });
  passage.addEventListener('contextmenu',event=>{ if(touch?.held||Date.now()<quietUntil)event.preventDefault(); });
  passage.addEventListener('touchstart',event=>{
   const word=wordAt(event), finger=event.touches[0];
   if (!word || event.touches.length!==1) return;
   clearTimeout(touch?.timer);
   const start=position(word);
   const press={passage,start,end:start,x:finger.clientX,y:finger.clientY,held:false};
   press.timer=setTimeout(()=>{
    if (touch!==press) return;
    press.held=true;closeLookup();document.getSelection?.()?.removeAllRanges();mark(passage,start.start,start.end);
   },330);
   touch=press;
  },{passive:true});
  passage.addEventListener('touchmove',event=>{
   if (touch?.passage!==passage) return;
   if (event.touches.length!==1) { clearTimeout(touch.timer);touch=null;closeLookup();return; }
   const finger=event.touches[0];
   if (!touch.held) {
    if (Math.hypot(finger.clientX-touch.x,finger.clientY-touch.y)>10) {
     clearTimeout(touch.timer);touch=null;
    }
    return;
   }
   event.preventDefault();
   const word=document.elementFromPoint(finger.clientX,finger.clientY)?.closest('.reader-word');
   if (word&&passage.contains(word)) touch.end=position(word);
   mark(passage,Math.min(touch.start.start,touch.end.start),Math.max(touch.start.end,touch.end.end));
  },{passive:false});
  passage.addEventListener('touchend',event=>{
   if (touch?.passage!==passage) return;
   const press=touch;clearTimeout(press.timer);touch=null;
   if (!press.held) return;
   event.preventDefault();quietUntil=Date.now()+360;
   document.getSelection?.()?.removeAllRanges();
   choose(page,passage,press.start,press.end,press.start.start===press.end.start);
  },{passive:false});
  passage.addEventListener('touchcancel',()=>{
   if (touch?.passage!==passage) return;
   clearTimeout(touch.timer);touch=null;closeLookup();
  });
 }
 document.addEventListener('selectionchange',()=>{
  if (!current || fields || practice || touch || Date.now()<quietUntil) return;
  clearTimeout(selectionTimer);
  selectionTimer=setTimeout(()=>{
   if (!current || fields || practice || touch) return;
   const selected=document.getSelection?.();
   if (!selected?.rangeCount || selected.isCollapsed) return;
   const range=selected.getRangeAt(0), first=range.startContainer;
   const passage=(first.nodeType===1?first:first.parentElement)?.closest('.reader-passage');
   const page=passages.get(passage);
   if (!page || !host.contains(passage) || !passage.contains(range.endContainer)) return;
   const prefix=document.createRange();prefix.selectNodeContents(passage);
   prefix.setEnd(first,range.startOffset);const start=prefix.toString().length;
   prefix.setEnd(range.endContainer,range.endOffset);const end=Math.min(prefix.toString().length,page.text.length);
   if (!page.text.slice(start,end).trim()) return;
   selected.removeAllRanges();
   choose(page,passage,{start,end},{start,end});
  },170);
 });
 document.addEventListener('keydown',event=>{
  if (event.key!=='Escape'||!current) return;
  if (bubble) closeLookup();
  else if (practice) showPage(current);
  else if (document.documentElement.classList.contains('book-controls-open')) host.querySelector('.reader-top-target')?.click();
 });
 host.addEventListener('click',event=>{
  if (bubble&&!bubble.contains(event.target)&&!event.target.closest?.('.reader-word')) closeLookup();
 });
 function makeBubble(label,title,lang) {
  const box=node('aside','reader-lookup');bubble=box;box.tabIndex=-1;
  box.setAttribute('role','dialog');box.setAttribute('aria-label',label);
  const head=node('header','reader-lookup-header'), heading=node('h2','',title);
  heading.lang=lang;
  const close=button('×','reader-close',()=>{
   const word=highlighted[0];closeLookup();word?.focus({preventScroll:true});
  });
  close.setAttribute('aria-label','Close');
  const result=node('div','reader-result');result.setAttribute('aria-live','polite');
  head.append(heading,close);box.append(head,result);host.append(box);
  return {box,result};
 }
 function keepSelectionVisible() {
  const selected=highlighted.at(-1)?.getBoundingClientRect(), panel=bubble?.getBoundingClientRect();
  if (selected?.height&&panel?.height&&selected.bottom>panel.top-14&&selected.top<root.innerHeight&&scroll) {
   scroll.scrollTop+=selected.bottom-panel.top+14;
  }
 }
 function translateSelection(page,start,end) {
  const {box,result}=makeBubble('Selected passage translation','English','en');
  result.append(node('p','reader-status','Translating selection…'));
  root.SozReaderStudy.translate(page,start,end).then(output=>{
   if (bubble!==box) return;
   if (output) {
    result.replaceChildren(node('p','reader-english',output.english));
    if (output.contextual) result.append(node('small','study-note','Includes the full sentence for context.'));
    if (output.machine) result.append(node('small','study-note','On-device translation'));
   } else result.replaceChildren(node('p','study-note','An English reference is unavailable for this passage. Tap individual words to look them up.'));
   keepSelectionVisible();
  },()=>{
   if (bubble===box) result.replaceChildren(node('p','study-note','A translation could not be opened.'));
  });
 }
 function lookup(page,part) {
  const quote=excerpt(page.text,part.start,part.end);
  const {box,result}=makeBubble('Reading dictionary',part.text,'az');
  const details=node('details','reader-lookup-more'), more=node('summary','','More');
  const extra=node('div','reader-lookup-extra');
  const form=node('form','reader-actions reader-search'), input=node('input','study-input');
  input.type='search';input.required=true;input.setAttribute('aria-label','Find a different headword');input.placeholder='Find another headword';
  const submit=node('button','study-button','Look up');submit.type='submit';form.append(input,submit);
  form.addEventListener('submit',event=>{event.preventDefault();find(input.value,true);});
  details.append(more,extra,form);box.append(details);
  function selectWord(candidate) {
   const word=candidate.node;
   const body=node('div','reader-result-entry'), definitions=node('div','reader-definitions');
   if (readingSpelling(part.text)!==word.w) {
    const lemma=node('h3','reader-lemma',word.w);lemma.lang='az';body.append(lemma);
   }
   body.append(definitions);
   const actions=node('div','reader-actions reader-quick-actions'), status=node('p','reader-status');status.setAttribute('role','status');
   const keep=button('Save to my words','reader-tool',()=>save(null));
   const see=node('a','reader-tool','Kainat');see.href='#w='+encodeURIComponent(word.w);
   see.addEventListener('click',event=>{
    if (event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
    event.preventDefault();if(scroll)positions.set(page.id,scroll.scrollTop);
    openWord(word.w,page.id);
   });
   actions.append(keep,see);body.append(actions,status);result.replaceChildren(body);
   function save(level) {
    study.setReading(word.w,{title:page.title,page:page.page,pageId:page.id,excerpt:quote});
    if (level!==null) study.rateWord(word.w,level);
    onChange();status.textContent=word.w+' saved'+(level===null?'.':' · '+levels[level]);
   }
   const ratings=node('div','vocab-ratings reader-ratings');
   for (const [level,label] of levels.entries()) {
    const control=button(label,'vocab-rate',()=>save(level));control.dataset.rating=String(level);ratings.append(control);
   }
   extra.replaceChildren(ratings);
   if (candidate.parts?.length) extra.prepend(node('p','study-note',candidate.parts.map(p=>p.az).join(' · ')));
   function paint() {
    if (!result.contains(body)) return;
    definitions.replaceChildren();
    if (word.en) { const meaning=node('p','reader-english',word.en);meaning.lang='en';definitions.append(meaning); }
    if (word.az) { const meaning=node('p','reader-az',word.az);meaning.lang='az';definitions.append(meaning); }
    if (!word.az&&!word.en) definitions.append(node('p','study-note','This headword has no published definition yet.'));
    keepSelectionVisible();
   }
   if (model.primaryReady(word)) paint();
   else {
    definitions.textContent='Loading definition…';
    Promise.resolve(model.ensurePrimary(word)).then(paint,()=>{ if (result.contains(body)) definitions.textContent='The definition could not load.'; });
   }
  }
  function find(query, allowSearch) {
   const spelling=readingSpelling(query), exact=model.resolveWord(spelling);
   if (exact) { selectWord({node:exact});return; }
   const variants=analyze(spelling).filter((item,index,items)=>item.node&&items.findIndex(x=>x.node===item.node)===index);
   const candidates=variants.length?variants:allowSearch?model.search(spelling,5).map(node=>({node})):[];
   if (!candidates.length) {
    result.replaceChildren(node('p','study-note','Headword unavailable. Look up a base form under More.'));
    return;
   }
   selectWord(candidates[0]);
   if (candidates.length>1) {
    const choices=node('div','reader-actions');
    for (const candidate of candidates) choices.append(button(candidate.node.w,'reader-tool',()=>selectWord(candidate)));
    extra.prepend(node('p','study-note','Other possible headwords'),choices);
   }
  }
  find(part.text,false);
 }
 async function startPractice(volume,entry) {
  closeLookup();
  if (scroll) positions.set(entry.id,scroll.scrollTop);
  const panel=node('section','reader-practice');
  practice=panel;readerMode(true);
  const back=button('← Back to reading','reader-tool',()=>showPage(entry));
  panel.append(back,node('h2','','Translate a passage'),node('p','reader-status','Finding passages…'));host.replaceChildren(panel);
  if (scroll) scroll.scrollTop=0;
  const tasks=await root.SozReaderStudy.exercises(volume);
  if (practice!==panel) return;
  if (!tasks.length) {
   panel.replaceChildren(back,node('h2','','Translate a passage'),node('p','reader-status','No English practice references are available for this book.'));
   return;
  }
  let i=Math.max(0,tasks.findIndex(task=>task.page.id===entry.id));
  function drill() {
   const task=tasks[i], label=node('p','reader-practice-location',task.page.title+' · '+pageLabel(task.page)+' · '+(i+1)+' / '+tasks.length);
   const source=node('blockquote','reader-practice-passage',task.text);source.lang='az';
   const form=node('form','reader-practice-form'), input=node('textarea','study-input');
   input.lang='en';input.rows=4;input.maxLength=2500;input.required=true;
   const compare=node('button','study-cta','Compare');compare.type='submit';compare.disabled=true;
   const result=node('section','reader-practice-result');result.hidden=true;result.setAttribute('aria-live','polite');
   const next=button('Next passage →','reader-tool',()=>{i=(i+1)%tasks.length;drill();});
   input.addEventListener('input',()=>{compare.disabled=!input.value.trim();});
   form.addEventListener('submit',event=>{
    event.preventDefault();if (!input.value.trim()) return;
    const answer=node('p','reader-english',task.english);answer.lang='en';
    const notes=node('ul','reader-practice-notes');
    for (const note of task.notes) notes.append(node('li','',note));
    result.replaceChildren(node('h3','','English reference'),answer,node('h3','','What to check in your version'),notes,next);result.hidden=false;
    result.scrollIntoView?.({block:'nearest'});
   });
   form.append(field('Your English translation',input),compare);
   panel.replaceChildren(back,node('h2','','Translate a passage'),label,source,form,result);
   if (scroll) scroll.scrollTop=0;
  }
  drill();
 }
 function open(id) {
  close();readShelf();
  const entry = id && pages.get(id);
  if (entry) { showPage(entry);return; }
  const frame = node('div','reader-layout reader-start'), create = editor(null,id?'This page is available after restoring its reading shelf.':'');
  const right = node('div','reader-sidebar');right.append(bibliographicCard(),importCard());const saved=shelf();if(saved)right.append(saved);
  frame.append(create,right);host.replaceChildren(frame);
 }
 wide?.addEventListener?.('change',()=>{
  if (!current||fields||practice) return;
  if(scroll)positions.set(current.id,scroll.scrollTop);
  closeLookup();showPage(current);
 });
 return {open,close,exportPages:savedPages,restore};
}

root.SozStudyReader = {mount,validatePages,wordsOnPage,openPrivateLink};
})(typeof window !== 'undefined' ? window : globalThis);
