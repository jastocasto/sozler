/* English references are unlocked locally by the matching saved page text. */
(function (root) {
'use strict';
const pending=new Map();

async function unlock(text) {
 if (!root.crypto?.subtle || !root.SozReaderReferences) return null;
 const input=new TextEncoder().encode('sozler:reader:reference:v1\0'+text);
 const digest=new Uint8Array(await root.crypto.subtle.digest('SHA-512',input));
 const index=Array.from(digest.subarray(0,16),byte=>byte.toString(16).padStart(2,'0')).join('');
 const envelope=root.SozReaderReferences[index];
 if (!envelope) return null;
 const packed=Uint8Array.from(root.atob(envelope.replace(/-/g,'+').replace(/_/g,'/')),ch=>ch.charCodeAt(0));
 const key=await root.crypto.subtle.importKey('raw',digest.subarray(32),'AES-GCM',false,['decrypt']);
 const plain=await root.crypto.subtle.decrypt({name:'AES-GCM',iv:packed.subarray(0,12)},key,packed.subarray(12));
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));
}

function reference(page) {
 const cached=pending.get(page.id);
 if (cached?.text===page.text) return cached.ref;
 const ref=unlock(page.text).catch(()=>null);
 pending.set(page.id,{text:page.text,ref});
 return ref;
}

function textRange(text,start,end) {
 const raw=text.slice(start,end);
 const leading=raw.match(/^[\s\p{P}]*/u)[0].length;
 const content=raw.slice(leading).replace(/[\s\p{P}]+$/u,'');
 return [start+leading,start+leading+content.length];
}

function sameText(text,start,end,a,b) {
 const left=textRange(text,start,end),right=textRange(text,a,b);
 return left[0]===right[0]&&left[1]===right[1];
}

function sentenceRows(data,start,end) {
 return data?.sentences.filter(([a,b])=>a<end&&b>start) ?? [];
}

function fromSentences(page,rows) {
 return {
  english:rows.map(row=>row[2]).join(' '),
  text:page.text.slice(rows[0][0],rows.at(-1)[1])
 };
}

async function onDevice(text) {
 const Translator=root.Translator;
 if (!Translator) return null;
 const languages={sourceLanguage:'az',targetLanguage:'en'};
 let translator;
 try {
  if (await Translator.availability(languages)!=='available') return null;
  translator=await Translator.create(languages);
  return await translator.translate(text);
 } catch { return null; }
 finally { translator?.destroy?.(); }
}

async function translate(page,start,end,{dictionary}={}) {
 const data=await reference(page),rows=sentenceRows(data,start,end);
 const [a,b]=textRange(page.text,start,end),source=page.text.slice(a,b);
 if (!source) return null;
 let sentence=null;
 if (rows.length) {
  sentence=fromSentences(page,rows);
  if (sameText(page.text,start,end,rows[0][0],rows.at(-1)[1])) {
   return {english:sentence.english,kind:'sentence'};
  }
 }
 const exact=data?.phrases?.find(([p,q])=>sameText(page.text,start,end,p,q));
 if (exact) return {english:exact[2],note:exact[3],kind:'phrase'};

 const headword=await dictionary?.(source);
 if (headword) return {...headword,sentence,kind:'dictionary'};
 const english=await onDevice(page.text.slice(start,end));
 if (english) return {english,sentence,machine:true,kind:'phrase'};

 const related=(data?.phrases ?? []).filter(([p,q])=>a<=p&&q<=b)
  .sort((left,right)=>(right[1]-right[0])-(left[1]-left[0]))
  .find(([p,q])=>/\s/u.test(page.text.slice(p,q)));
 const part=related && {text:page.text.slice(related[0],related[1]),english:related[2]};
 return {part,sentence};
}

async function exercises(pages,day) {
 const lists=await Promise.all(pages.map(async page=>{
  const data=await reference(page);
  if (!data) return [];
  return data.practice.map(([start,end,english,checks,note])=>{
   const text=page.text.slice(start,end);
   const rows=sentenceRows(data,start,end);
   const [a,b]=rows[0];
   const sentence=sameText(page.text,start,end,a,b);
   return {page,text,english,checks,note,start,end,
    kind:sentence?'sentence':/\s/u.test(text)?'phrase':'word',
    context:sentence?null:{before:page.text.slice(a,start),after:page.text.slice(end,b)}};
  });
 }));
 const all=lists.flat();
 const groups=['sentence','phrase','word'].map(kind=>all.filter(item=>item.kind===kind));
 const ordinal=Math.floor(Date.parse(day+'T00:00:00Z')/86400000);
 return [0,1].flatMap(round=>groups.filter(group=>round<group.length)
  .map(group=>group[(ordinal*2+round)%group.length]));
}

function compare(answer,checks) {
 const plain=value=>' '+value.toLowerCase().replace(/[’'‘]/gu,'').replace(/[^a-z0-9]+/g,' ').trim()+' ';
 const typed=plain(answer);
 const includes=alias=>typed.includes(plain(alias));
 return checks.map(([note,aliases,opposites=[]])=>({
  note,
  state:opposites.some(includes)?'reversed':aliases.some(includes)?'matched':'check'
 }));
}

root.SozReaderStudy={reference,translate,exercises,compare};
})(typeof window!=='undefined'?window:globalThis);
