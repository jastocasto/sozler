/* A reading shelf for built-in, scanned, and pasted pages. */
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
function bookmark() {
 try { return root.localStorage.getItem(placeKey); } catch { return null; }
}
function resumeFrom(records) {
 const last=bookmark();
 return records.find(page=>page.id===last) || firstPage(records);
}
async function openPrivateLink(status,retry) {
 const link=root.location.hash.match(/^#([a-f0-9]{20})\.([A-Za-z0-9_-]{43})$/);
 if (!link) { root.location.replace('/#study/read');return; }
 if (retry) retry.hidden=true;
 status.textContent='Opening your book…';
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
  root.location.replace('/#study/read/'+resumeFrom(records).id);
 } catch {
  status.textContent='The book could not open in this browser. Try again or open this link in your usual browser.';
  if (retry) retry.hidden=false;
 }
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
 const book=root.SozReaderBook;
 const bookPages=new Map(validatePages(root.SozReaderBookPages ?? []).map(page=>[page.id,page]));
 const lexicon=new Map();
 for (const entry of book?.glossary ?? []) {
  const spell=entry.word[0]===entry.word[0].toLocaleLowerCase('az')?readingSpelling:value=>value;
  for (const key of [entry.word,...entry.forms]) lexicon.set(spell(key),entry);
 }
 const pages=new Map();
 let current=null, scanJob=null, bubble=null, draft=null, fields=null, shelfStatus='';
 let highlighted=[], selectionTimer, touch=null, quietUntil=0;
 let fontSize=0;
 try { fontSize=Math.max(-2,Math.min(3,Number(root.localStorage.getItem('soz-toxumasi:reader-font'))||0)); } catch {}
 function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
 }
 function button(text, className, action) {
  const el = node('button', className, text);el.type = 'button';if (action) el.addEventListener('click',action);return el;
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
 function libraryPages() {
  readShelf();
  return [...new Map([...bookPages,...pages]).values()].sort((a,b)=>b.updated-a.updated||pageOrder.compare(a.page,b.page));
 }
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
  if (fields && !current) draft = {title:fields.title.value,page:fields.page.value,text:fields.text.value,chapter:readChapter(fields)};
  if (current&&!fields&&scroll) positions.set(current.id,scroll.scrollTop);
  clearTimeout(selectionTimer);clearTimeout(touch?.timer);touch=null;
  scanJob?.abort();scanJob=null;closeLookup();current=null;fields=null;readerMode(false);host.replaceChildren();
 }
 function coverArt() {
  const img=node('img','reader-jacket-art');
  img.src=book.cover;img.alt=[bookTitle,book.subtitle,book.author].join(' · ');
  return img;
 }
 function bookPagesIn(entries) { return entries.filter(page=>page.title===bookTitle); }
 function readingShortcut() {
  const entry=resumeFrom(libraryPages());
  if (!entry) return null;
  const continuing=bookmark()===entry.id;
  const route=book&&entry.title===bookTitle&&!continuing?'read/cover':'read/'+entry.id;
  return {route,label:(continuing?'Continue ':'Open ')+entry.title};
 }
 function showCover(entries) {
  const entry=resumeFrom(bookPagesIn(entries));
  if (!entry) return;
  readerMode(true);
  const frame=node('section','reader-front');
  const back=button('Shelf','reader-front-back',()=>navigate('read'));
  const action=button('','reader-cover-action',swingOpen);
  const board=node('span','reader-cover-board'),jacket=node('span','reader-jacket');
  const caption=node('span','reader-cover-caption','Open book · '+pageLabel(entry));
  jacket.append(coverArt());board.append(jacket);action.append(board,caption);
  action.setAttribute('aria-label',caption.textContent);
  const glossary=button('Book glossary','study-text-link',()=>navigate('read/glossary'));
  frame.append(back,root.SozTheme.button(document,'reader-theme-toggle'),action,glossary);
  host.replaceChildren(frame);
  if (scroll) scroll.scrollTop=0;
  function swingOpen() {
   if (action.disabled) return;
   const finish=()=>{if(host.contains(frame)) navigate('read/'+entry.id);};
   if (!jacket.animate || root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {finish();return;}
   action.disabled=true;
   jacket.animate([{transform:'rotateY(0deg)'},{transform:'rotateY(-102deg)'}],
    {duration:460,easing:'cubic-bezier(.38,.03,.25,1)',fill:'forwards'}).finished.then(finish,finish);
  }
 }
 function showGlossary(entries) {
  const panel=node('section','reader-glossary study-section');
  const backTo=resumeFrom(bookPagesIn(entries));
  const back=button(backTo?'Back to '+pageLabel(backTo).toLowerCase():'Reading desk','study-button',
   ()=>navigate(backTo?'read/'+backTo.id:'read'));
  const terms=node('dl','reader-glossary-terms');
  for (const term of book.glossary) {
   const heading=node('dt','',term.word);heading.lang='az';
   const senses=node('dd',''), az=node('p','',term.az);az.lang='az';
   senses.append(az,node('p','study-note',term.en));terms.append(heading,senses);
  }
  const stress=node('p','reader-glossary-stress',book.stress);stress.lang='az';
  panel.append(back,terms,stress,node('p','study-note','In most of the names in the book, the stress falls on the first syllable.'));
  host.replaceChildren(panel);
 }
 function bibliographicCard(entries) {
  const card = node('section','study-section reader-book'), title = node('h2','',bookTitle);title.lang='az';
  const source = node('a','reader-source','Library record');source.href='https://www.preslib.az/az/book/8MbPRIFKDQlXWDF';source.target='_blank';source.rel='noopener noreferrer';
  const details=node('div','reader-book-details');
  details.append(title,node('p','study-note',book?.author ?? 'Zaur Pənahov'));
  const volume=bookPagesIn(entries).sort((a,b)=>pageOrder.compare(a.page,b.page));
  const start=resumeFrom(volume);
  if (start) {
   const first=volume[0].page,last=volume.at(-1).page;
   const range=first&&last&&first!==last?' · '+first+'–'+last:'';
   details.append(node('p','reader-book-count',volume.length+(volume.length===1?' page':' pages')+range),
    button('Open book · '+pageLabel(start),'study-cta',()=>navigate('read/'+start.id)));
   if (book) {
    card.classList.add('reader-book-with-cover');
    const thumbnail=button('','reader-shelf-cover',()=>navigate('read/cover'));
    thumbnail.setAttribute('aria-label','View cover of '+bookTitle);
    thumbnail.append(coverArt());card.append(thumbnail);
    details.append(button('Book glossary','study-text-link',()=>navigate('read/glossary')));
   }
  } else details.append(node('p','study-note','The book pages are unavailable. Reopen Sozler while connected to load them.'));
  details.append(source);card.append(details);return card;
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
 function shelf(entries) {
  if (!entries.length) return null;
  const wrap = node('section','study-section reader-shelf'), title = node('h2','','Browse pages');
  const list = node('select','study-input');list.setAttribute('aria-label','Browse pages');
  const placeholder = node('option','','Choose a page');placeholder.value='';list.append(placeholder);
  for (const page of entries) {
   const option = node('option','',pageLabel(page)+' · '+page.title);option.value=page.id;
   if (page.id === current?.id) option.selected=true;
   list.append(option);
  }
  list.addEventListener('change',() => { if (list.value) navigate('read/'+list.value); });
  wrap.append(title,list);return wrap;
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
 function readChapter({chapterNumber,chapterTitle}) {
  const number=chapterNumber.value.trim(),title=chapterTitle.value.trim();
  return number||title?{number,title}:null;
 }
 function editor(entry, notice = '') {
  const panel=node('section','study-section reader-editor'), title=node('input'), page=node('input');
  const text=node('textarea'),toolbar=node('div','reader-actions'),status=node('p','reader-status',notice||shelfStatus);
  status.setAttribute('role','status');
  const chapterFields=node('details','reader-chapter-fields'),chapterNumber=node('input'),chapterTitle=node('input');
  chapterNumber.maxLength=16;chapterTitle.maxLength=120;
  function setChapter(chapter) {
   chapterNumber.value=chapter?.number||'';chapterTitle.value=chapter?.title||'';
   chapterFields.open=Boolean(chapter);
  }
  const chapterControls=node('div','reader-chapter-controls');
  chapterControls.append(field('Chapter number',chapterNumber),field('Chapter title',chapterTitle));
  chapterFields.append(node('summary','','Chapter heading'),chapterControls);
  setChapter(entry?.chapter ?? (!entry?draft?.chapter:null));

  title.maxLength=140;title.value=entry?.title||draft?.title||bookTitle;title.required=true;
  page.maxLength=20;page.value=entry?.page??draft?.page??'';page.inputMode='numeric';
  text.maxLength=maxPageLength;text.rows=7;text.lang='az';text.spellcheck=false;text.value=entry?.text??draft?.text??'';
  text.placeholder='Paste Azerbaijani text or scan a page.';
  fields={title,page,text,chapterNumber,chapterTitle};
  const photoOptions=node('details','reader-photo-options'), layout=node('select','study-input'),rotation=node('select','study-input');
  function option(label,value) {const item=node('option','',label);item.value=value;return item;}
  layout.append(option('One page','page'));
  if (!entry) layout.append(option('Two facing pages','spread'));
  rotation.append(option('As photographed','0'),option('Turn right','90'),option('Turn left','-90'),option('Turn upside down','180'));
  photoOptions.append(node('summary','','Photo options'),field('Photo layout',layout),field('Photo rotation',rotation));
  let queued=[],firstSaved=null,scanned=false;
  const open=button('Open page','study-cta',save),cancel=button('Cancel scan','study-button',()=>{
   scanJob?.abort();scanJob=null;setScanning(false);status.textContent='Scan canceled.';
  });
  cancel.hidden=true;
  function setScanning(active) { open.disabled=active;cancel.hidden=!active; }
  function review(result,next=false) {
   text.value=result.text.slice(0,maxPageLength);
   if (next||!page.value.trim()) page.value=result.page;
   if (result.chapter||next) setChapter(result.chapter);
   open.textContent=queued.length?'Save and review next page':'Open page';
   status.textContent=queued.length?'Review the left page first. The right page is next.':next?'Review the right page, then open the book.':'Check the scan for typos, then open the page.';
  }
  async function scan(file) {
   scanJob?.abort();const job=new AbortController(),spread=layout.value==='spread';scanJob=job;
   setScanning(true);status.textContent='Reading the photo on this device…';
   try {
    const results=await root.SozReaderOCR.scan(file,{title:title.value,spread,
     rotation:Number(rotation.value)||0,signal:job.signal,onProgress:progress=>{
      if (scanJob===job) status.textContent='Reading text · '+Math.round(100*progress)+'%';
     }});
    if (scanJob!==job) return;
    if (!results.length) {status.textContent='No text was found. Try a closer photo of one page.';return;}
    scanned=true;queued=results.slice(1);review(results[0]);
    if (spread&&results.length<2) status.textContent='One side was readable. Check its text before opening the page.';
   } catch (error) {
    if (scanJob===job) status.textContent=error.message||'The scan could not finish.';
   } finally {
    if (scanJob===job) {scanJob=null;setScanning(false);}
   }
  }
  function save() {
   const titleText=title.value.trim(),raw=text.value.replace(/\r\n?/g,'\n').normalize('NFC').trim();
   const parsed=entry||scanned?{text:raw}:root.SozReaderOCR.parsePage(raw,{title:titleText,reflow:false});
   const body=parsed.text,pageNumber=page.value.trim()||parsed.page||'';
   const chapter=readChapter(fields)||parsed.chapter;
   if (!label(titleText,140)||!titleText||!label(pageNumber,20)) {status.textContent='Enter a book title and optional page number.';return;}
   if (chapter&&(!label(chapter.number,16)||!chapter.number||!label(chapter.title,120)||!chapter.title)) {
    status.textContent='Enter both parts of the chapter heading, or clear them both.';chapterFields.open=true;return;
   }
   if (!body||body.length>maxPageLength) {status.textContent='Add text from one page to start reading.';text.focus();return;}
   const existing=entry||libraryPages().find(item=>item.title===titleText&&item.page===pageNumber&&(pageNumber||item.text===body));
   if (firstSaved&&existing?.id===firstSaved) {
    status.textContent='Enter a different page number for the right page.';page.focus();return;
   }
   const id=existing?.id||root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
   const updated=Math.max(Date.now(),(existing?.updated??0)+1);
   const record={id,title:titleText,page:pageNumber,text:body,updated};
   if (chapter) record.chapter=chapter;
   pages.set(id,record);storeShelf();
   if (queued.length) {
    firstSaved ||= id;
    review(queued.shift(),true);page.focus();return;
   }
   draft=null;fields=null;
   if (entry) showPage(record);else navigate('read/'+(firstSaved||id));
  }
  toolbar.append(filePicker('Take photo',true,scan),filePicker('Choose photo',false,scan),cancel);
  panel.append(node('h2','',entry?'Edit page':'Add a page'),
   node('p','study-note','Scan a book page or paste the text. Review the page number, chapter heading, and text before saving.'),
   field('Book title',title),toolbar,photoOptions,status,field('Page number (optional)',page),chapterFields,field('Page text',text),open);
  if (entry) panel.append(button('Back to page','study-text-link reader-back',()=>showPage(entry)));
  return panel;
 }
 function showPage(entry) {
  const all=libraryPages();
  entry=all.find(page=>page.id===entry.id)||entry;
  fields=null;current=entry;
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
  tools.append(button('Shelf','reader-tool',()=>navigate('read')),button('Practice','reader-tool',()=>navigate('reading-practice')),smaller,larger,
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
  if (book && entry.title===bookTitle) {
   tools.append(button('Book glossary','reader-tool',()=>navigate('read/glossary')),
    button('Cover','reader-tool',()=>navigate('read/cover')));
  }
  header.append(heading,tools,navigation);
  if (end>start) scene.classList.add('reader-spread');
  const visible=volume.slice(start,end+1);
  for (const page of visible) scene.append(leaf(page));
  if (shelfStatus) header.append(node('p','study-note',shelfStatus));
  const bottom=node('nav','reader-bottom');bottom.setAttribute('aria-label','Turn pages');
  if (volume[start-1]) bottom.append(turn('← Previous',volume[start-1]));
  if (volume[end+1]) bottom.append(turn('Next →',volume[end+1]));
  frame.append(toggle,root.SozTheme.button(document,'reader-theme-toggle'),header,scene,bottom);
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
  if (!current || fields || touch || Date.now()<quietUntil) return;
  clearTimeout(selectionTimer);
  selectionTimer=setTimeout(()=>{
   if (!current || fields || touch) return;
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
 function tryConstruction(spelling) {
  const match=spelling.match(/^([^ ]+m[aə][ğy][aə]) (çalış[^ ]+)$/u);
  if (!match) return null;
  const rows=root.ConjugationEngine.rows;
  const action=analyze(match[1]).find(form=>form.kind==='verb'&&!form.loose&&rows[form.grammar.tense].id==='inf_dative');
  const attempt=analyze(match[2]).find(form=>form.kind==='verb'&&!form.loose&&form.word==='çalışmaq');
  if (!action||!attempt) return null;
  const {tense,person,negative}=attempt.grammar,dative=action.english;
  if (!dative?.match(/^to /i)) return null;
  const english=root.ConjugationEnglish.describe({base:'try'},rows[tense].id,person,negative).text+' '+dative.replace(/^To /,'to ');
  return {english,note:'-mağa / -məyə çalışmaq means “to try to do something.”'};
 }
 async function dictionaryPhrase(query) {
  const spelling=readingSpelling(query);
  if (!spelling.includes(' ')) return null;
  let entry=model.resolveWord(spelling);
  if (entry?.w.split(' ').length!==spelling.split(' ').length) entry=null;
  if (!entry) {
   const construction=tryConstruction(spelling);
   if (construction) return construction;
   const inflected=analyze(spelling).find(form=>form.kind==='verb'&&!form.loose&&form.word.includes(' ')&&form.english);
   if (inflected) return {english:inflected.english,headword:inflected.word};
   const last=spelling.lastIndexOf(' ');
   for (const form of analyze(spelling.slice(last+1))) {
    if (form.loose||form.kind!=='verb') continue;
    const candidate=spelling.slice(0,last+1)+form.word;
    entry=model.byWord.get(candidate);
    if (entry) break;
   }
  }
  if (!entry) return null;
  try {
   await model.ensurePrimary(entry);
   return entry.en?{english:entry.en,headword:entry.w}:null;
  } catch { return null; }
 }
 function translateSelection(page,start,end) {
  const {box,result}=makeBubble('Selected text translation',page.text.slice(start,end).trim(),'az');
  result.append(node('p','reader-status','Looking up selection…'));
  root.SozReaderStudy.translate(page,start,end,{dictionary:dictionaryPhrase}).then(output=>{
   if (bubble!==box) return;
   const parts=[];
   if (output?.english) {
    const gloss=node('p','reader-english',output.english);gloss.lang='en';parts.push(gloss);
    if (output.note) parts.push(node('small','reader-selection-note',output.note));
    if (output.headword) parts.push(node('small','reader-selection-note','Dictionary form · '+output.headword));
    if (output.machine) parts.push(node('small','reader-selection-note','On-device translation'));
   } else {
    parts.push(node('p','study-note','No English gloss for this exact selection.'));
    if (output?.part) {
     const match=node('p','reader-selection-part'),label=node('strong','',output.part.text);label.lang='az';
     match.append(label,document.createTextNode(' · '+output.part.english));parts.push(match);
    }
   }
   if (output?.sentence) {
    const more=node('details','reader-lookup-more reader-sentence-context');
    const source=node('p','reader-az',output.sentence.text);source.lang='az';
    const english=node('p','reader-english',output.sentence.english);english.lang='en';
    more.append(node('summary','','Show sentence translation'),source,english);parts.push(more);
   }
   result.replaceChildren(...parts);keepSelectionVisible();
  },()=>{
   if (bubble===box) result.replaceChildren(node('p','study-note','A translation could not be opened.'));
  });
 }
 function lookup(page,part) {
  const quote=excerpt(page.text,part.start,part.end);
  if (page.title===bookTitle) {
   let term=lexicon.get(part.text)||lexicon.get(readingSpelling(part.text));
   if (!term&&page.page==='158'&&part.text==='kölgə'&&/sonuncu\s+$/u.test(page.text.slice(0,part.start))) term=lexicon.get('Kölgə');
   if (term) {
    const {result}=makeBubble('Book glossary entry',term.word,'az');
    const az=node('p','reader-az',term.az);az.lang='az';
    result.append(node('p','reader-english',term.en),az,
     button('Book glossary','reader-tool',()=>navigate('read/glossary')));
    keepSelectionVisible();return;
   }
  }
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
 async function openPractice() {
  const entries=libraryPages(),entry=resumeFrom(bookPagesIn(entries))||resumeFrom(entries);
  const panel=node('section','reader-practice study-section'),back=button('Back to Daily Study','study-text-link',()=>navigate('grammar'));
  const book=button('Open reading desk','study-button',()=>navigate('read'));
  host.replaceChildren(panel);
  panel.append(back,node('p','reader-status','Finding excerpts…'));
  const volume=entries.filter(page=>page.title===entry?.title).sort((a,b)=>pageOrder.compare(a.page,b.page));
  const tasks=await root.SozReaderStudy.exercises(volume,study.day());
  if (!host.contains(panel)) return;
  if (!tasks.length) {
   panel.replaceChildren(back,node('h2','','Practice with your book'),
    node('p','',volume.length?'Reviewed practice is unavailable for this book.':'Open your saved copy of Qaranlıq günəş to practice with its excerpts.'),book);
   return;
  }
  let i=0;
  function drill(focus=false) {
   if (i===tasks.length) {
    const complete=node('h2','','Reading practice complete');complete.tabIndex=-1;
    panel.replaceChildren(complete,node('p','','You compared '+tasks.length+' translations.'),back,
     button('Return to the book','study-button',()=>navigate('read/'+entry.id)));
    complete.focus();return;
   }
   const task=tasks[i],label=node('p','reader-practice-location',
    task.page.title+' · '+pageLabel(task.page)+' · '+(i+1)+' / '+tasks.length);
   const prompt=node('h2','','Translate the '+task.kind);prompt.tabIndex=-1;
   const source=node('blockquote','reader-practice-passage');source.lang='az';
   if (task.context) source.append(document.createTextNode(task.context.before),node('mark','',task.text),document.createTextNode(task.context.after));
   else source.textContent=task.text;
   const form=node('form','reader-practice-form'),input=node('textarea','study-input');
   input.lang='en';input.rows=3;input.maxLength=2500;input.required=true;
   const compare=button('Check my translation','study-cta');compare.type='submit';compare.disabled=true;
   const result=node('section','reader-practice-result');result.hidden=true;result.setAttribute('aria-live','polite');
   const next=button(i+1===tasks.length?'Finish practice':'Next excerpt','study-button',()=>{i++;drill(true);});
   input.addEventListener('input',()=>{compare.disabled=!input.value.trim();});
   form.addEventListener('submit',event=>{
    event.preventDefault();if (!input.value.trim()||!result.hidden) return;
    const heading=node('h3','','English reference');heading.tabIndex=-1;
    const answer=node('p','reader-english',task.english);answer.lang='en';
    const notes=node('ul','reader-practice-notes');
    const labels={matched:'Wording found',reversed:'Meaning reversed',check:'Check this detail'};
    for (const {note,state} of root.SozReaderStudy.compare(input.value,task.checks)) {
     const row=node('li','');
     row.append(node('strong','reader-feedback-tag',labels[state]),document.createTextNode(' '+note));
     row.dataset.feedback=state;notes.append(row);
    }
    result.append(heading,answer);
    if (task.note) result.append(node('p','study-note',task.note));
    result.append(node('h3','','Compare with your version'),notes,
     node('p','study-note','Other phrasings may be valid. Compare the meaning, tense, and tone with the reference.'),next);
    result.hidden=false;input.readOnly=true;compare.hidden=true;heading.focus();result.scrollIntoView?.({block:'nearest'});
   });
   form.append(field('Your English translation',input),compare);
   panel.replaceChildren(back,prompt,label,source,form,result);
   if (focus) {if (scroll) scroll.scrollTop=0;prompt.focus({preventScroll:true});}
  }
  drill();
 }
 function open(id) {
  close();const entries=libraryPages();
  const entry = id && entries.find(page=>page.id===id);
  if (entry) { showPage(entry);return; }
  if (book&&id==='glossary') { showGlossary(entries);return; }
  if (book&&id==='cover'&&bookPagesIn(entries).length) { showCover(entries);return; }
  const frame = node('div','reader-layout reader-start'), create = editor(null,id?'This page is available after restoring its reading shelf.':'');
  const sidebar=node('div','reader-sidebar');
  sidebar.append(bibliographicCard(entries));const saved=shelf(entries);if(saved)sidebar.append(saved);
  sidebar.append(importCard());frame.append(sidebar,create);host.replaceChildren(frame);
 }
 wide?.addEventListener?.('change',()=>{
  if (!current||fields) return;
  if(scroll)positions.set(current.id,scroll.scrollTop);
  closeLookup();showPage(current);
 });
 return {open,openPractice,close,exportPages:savedPages,restore,readingShortcut};
}

root.SozStudyReader = {mount,validatePages,wordsOnPage,openPrivateLink};
})(typeof window !== 'undefined' ? window : globalThis);
