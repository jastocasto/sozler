/* A local reading shelf and dictionary lookup for scanned or pasted pages. */
(function (root) {
'use strict';

const bookTitle = 'Qaranlıq günəş';
const shelfKey = 'soz-toxumasi:reader:v1';
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
 let pages = new Map(), current = null, scanJob = null, dialog = null, draft = null;
 let shelfStatus = '', fields = null;
 function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
 }
 function button(text, className, action) {
  const el = node('button', className, text);el.type = 'button';el.addEventListener('click',action);return el;
 }
 function absorb(records) {
  let added = 0;
  for (const page of records) {
   const old = pages.get(page.id);
   if (!old || page.updated > old.updated) { pages.set(page.id,page);if (!old) added++; }
  }
  return added;
 }
 function readShelf() {
  try {
   const raw = root.localStorage.getItem(shelfKey);
   if (raw) absorb(validatePages(JSON.parse(raw)));
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
 function restore(records) { readShelf();const added = absorb(records);return {added,saved:!records.length || storeShelf()}; }
 function closeLookup() { if (dialog?.hasAttribute('open') || dialog?.open) dialog.close(); }
 function close() {
  if (fields && !current) draft = {title:fields.title.value,page:fields.page.value,text:fields.text.value};
  scanJob?.abort();scanJob=null;closeLookup();current=null;dialog=null;fields=null;host.replaceChildren();
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
    if (data?.format!=='sozler-personal-study' || data.version!==1) throw Error('Choose a Sozler reading-pages file.');
    const records=validatePages(data.readingPages);
    if (!records.length) throw Error('This file contains no reading pages.');
    restore(records);
    const first=records.slice().sort((a,b)=>pageOrder.compare(a.page,b.page))[0];
    navigate('read/'+first.id);
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
  const list = node('select','study-input');list.setAttribute('aria-label','Saved pages');
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
  fields=null;current=entry;
  const volume=all.filter(page=>page.title===entry.title).sort((a,b)=>pageOrder.compare(a.page,b.page));
  let start=volume.findIndex(page=>page.id===entry.id), end=start;
  const pair=(a,b)=>a?.page && b?.page && /^\d+$/.test(a.page) && /^\d+$/.test(b.page) &&
   Number(a.page)%2===0 && Number(b.page)===Number(a.page)+1;
  if (wide?.matches) {
   if (pair(volume[start-1],entry)) start--;
   if (pair(volume[start],volume[start+1])) end=start+1;
  }
  const frame=node('section','reader-volume'), header=node('header','reader-volume-header'), scene=node('div','reader-book-scene');
  const heading=node('h2','reader-volume-title',entry.title);heading.lang='az';
  const tools=node('div','reader-actions reader-volume-tools');
  tools.append(button('Back to shelf','study-text-link',()=>navigate('read')),button('Edit text','study-text-link',()=>{
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
  frame.append(header,scene);
  if (volume[end+1]) {
   const bottom=node('div','reader-bottom');
   bottom.append(turn('Next →',volume[end+1]));frame.append(bottom);
  }
  host.replaceChildren(frame);
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
    const location={text:part.text,start:offset+part.start,end:offset+part.end};
    const word=button(part.text,'reader-word',()=>lookup(page,location,word));word.lang='az';block.append(word);
   }
   passage.append(block,document.createTextNode('\n\n'));offset+=paragraph.length+2;
  }
  paper.append(passage);
  if (page.page) paper.append(node('footer','reader-folio',page.page));
  return paper;
 }
 function lookup(entry, part, opener) {
  const quote = excerpt(entry.text,part.start,part.end);
  const box = node('dialog','reader-lookup');dialog=box;box.setAttribute('aria-label','Reading dictionary');host.append(box);
  box.addEventListener('close',()=>{ box.remove();if(dialog===box)dialog=null;if(opener?.isConnected)opener.focus({preventScroll:true}); },{once:true});
  const head = node('header','reader-lookup-header'), title = node('h2','',part.text);title.lang='az';
  const close = button('Close','study-button',closeLookup);head.append(title,close);
  const quoteBlock = node('blockquote','reader-quote',quote);quoteBlock.lang='az';
  const result = node('div','reader-result');dialog.append(head,quoteBlock,result);
  const form = node('form','reader-actions reader-search'), input = node('input','study-input');
  input.type='search';input.required=true;input.setAttribute('aria-label','Find a different headword');input.placeholder='Find a different headword';
  const submit = node('button','study-button','Look up');submit.type='submit';form.append(input,submit);
  form.addEventListener('submit',event=>{event.preventDefault();find(input.value,true);});dialog.append(form);
  function selectWord(candidate) {
   if (!candidate) return;
   const word = candidate.node, body = node('div','reader-result-entry'), heading = node('h3','',word.w);heading.lang='az';
   const definitions = node('div','reader-definitions');
   if (readingSpelling(part.text) !== word.w) body.append(heading);
   body.append(definitions);
   if (candidate.parts?.length) body.append(node('p','study-note',candidate.parts.map(p=>p.az).join(' · ')));
   const actions = node('div','vocab-ratings reader-ratings'), status = node('p','reader-status');status.setAttribute('role','status');
   const keep = button('Save to my words','study-cta',()=>save(null));
   const see = button('Open in Kainat','study-text-link',()=>{closeLookup();openWord(word.w);});
   for (const [level,label] of levels.entries()) {
    const control=button(label,'vocab-rate',()=>save(level));control.dataset.rating=String(level);actions.append(control);
   }
   body.append(node('div','reader-actions'),actions,status);body.querySelector('.reader-actions').append(keep,see);result.replaceChildren(body);
   function save(level) {
    study.setReading(word.w,{title:entry.title,page:entry.page,pageId:entry.id,excerpt:quote});
    if (level!==null) study.rateWord(word.w,level);
    onChange();status.textContent=word.w+' saved'+(level===null?'.':' · '+levels[level]);
   }
   function paint() {
    if (!result.contains(body)) return;
    definitions.replaceChildren();
    for (const [lang,label,text] of [['az','Azərbaycan dilində',word.az],['en','English',word.en]]) {
     if (!text) continue;
     const part=node('div','vocab-definition'), line=node('p','',text);line.lang=lang;part.append(node('span','',label),line);definitions.append(part);
    }
    if (!word.az && !word.en) definitions.append(node('p','study-note','There is no published definition for this headword yet.'));
   }
   if (model.primaryReady(word)) paint();
   else {
    definitions.textContent='Loading the definition…';
    Promise.resolve(model.ensurePrimary(word)).then(paint,()=>{ if (result.contains(body)) definitions.textContent='The definition could not load.'; });
   }
  }
  function find(query, allowSearch) {
   const spelling=readingSpelling(query);
   const exact=model.resolveWord(spelling);
   if (exact) { selectWord({node:exact});return; }
   const variants=analyze(spelling).filter((item,index,items)=>item.node && items.findIndex(x=>x.node===item.node)===index);
   const candidates=variants.length ? variants : allowSearch ? model.search(spelling,5).map(node=>({node})) : [];
   if (!candidates.length) { result.replaceChildren(node('p','study-note','No headword found. Try the base form or check the scan for a typo.'));return; }
   const choices = node('div','reader-actions');
   for (const candidate of candidates) choices.append(button(candidate.node.w,'study-button',()=>selectWord(candidate)));
   result.replaceChildren(node('p','study-note','Choose the headword that fits this sentence.'),choices);
  }
  find(part.text,false);dialog.showModal();
 }
 function open(id) {
  close();readShelf();
  const entry = id && pages.get(id);
  if (entry) { showPage(entry);return; }
  const frame = node('div','reader-layout reader-start'), create = editor(null,id?'This page is available after restoring its reading shelf.':'');
  const right = node('div','reader-sidebar');right.append(bibliographicCard(),importCard());const saved=shelf();if(saved)right.append(saved);
  frame.append(create,right);host.replaceChildren(frame);
 }
 wide?.addEventListener?.('change',()=>{ if (current&&!fields&&!dialog) showPage(current); });
 return {open,close,exportPages:savedPages,restore};
}

root.SozStudyReader = {mount,validatePages,wordsOnPage};
})(typeof window !== 'undefined' ? window : globalThis);
