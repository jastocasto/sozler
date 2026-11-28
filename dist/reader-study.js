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

async function translate(page,start,end) {
 const data=await reference(page);
 const rows=data?.sentences.filter(([a,b])=>a<end&&b>start) ?? [];
 if (rows.length) {
  const contextual=page.text.slice(rows[0][0],rows.at(-1)[1]).trim()!==page.text.slice(start,end).trim();
  return {english:rows.map(row=>row[2]).join(' '),contextual};
 }
 // Supported browsers may have a translator for other books on this device.
 const Translator=root.Translator;
 if (!Translator) return null;
 const languages={sourceLanguage:'az',targetLanguage:'en'};
 if (await Translator.availability(languages)!=='available') return null;
 const translator=await Translator.create(languages);
 try { return {english:await translator.translate(page.text.slice(start,end)),machine:true}; }
 finally { translator.destroy?.(); }
}

async function exercises(pages) {
 const lists=await Promise.all(pages.map(async page=>{
  const data=await reference(page);
  if (!data) return [];
  return data.practice.map(([at,count,notes])=>{
   const rows=data.sentences.slice(at,at+count);
   return {page,notes,text:page.text.slice(rows[0][0],rows.at(-1)[1]),english:rows.map(row=>row[2]).join(' ')};
  });
 }));
 return lists.flat();
}

root.SozReaderStudy={reference,translate,exercises};
})(typeof window!=='undefined'?window:globalThis);
