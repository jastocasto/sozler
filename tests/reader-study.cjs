'use strict';

const assert=require('node:assert/strict');
const {createCipheriv,createHash,webcrypto}=require('node:crypto');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');

const page={id:'example',text:'Kitabı oxumağa çalışdı. O, mövzunu bilirdi.'};
const firstEnd=page.text.indexOf('.')+1;
const phrase=page.text.indexOf('oxumağa');
const secondStart=firstEnd+1,word=page.text.indexOf('mövzunu');
const sentences=[
 [0,firstEnd,'She tried to read the book.'],
 [secondStart,page.text.length,'She knew the topic.']
];
const references={
 sentences,
 phrases:[[phrase,firstEnd-1,'tried to read','A past attempt.']],
 practice:[
  [...sentences[0],[['The action was an attempt.',['tried']]]],
  [phrase,firstEnd-1,'tried to read',[['The action was an attempt.',['tried']]]],
  [word,word+7,'the topic',[['The subject under discussion.',['topic','subject']]]]
 ]
};
const digest=createHash('sha512').update('sozler:reader:reference:v1\0'+page.text).digest();
const iv=Buffer.alloc(12);
const cipher=createCipheriv('aes-256-gcm',digest.subarray(32),iv);
const envelope=Buffer.concat([iv,cipher.update(JSON.stringify(references)),cipher.final(),cipher.getAuthTag()]);
const app=vm.createContext({TextEncoder,TextDecoder,atob,crypto:webcrypto,
 SozReaderReferences:{[digest.subarray(0,16).toString('hex')]:envelope.toString('base64url')}});
vm.runInContext(readFileSync('dist/reader-study.js','utf8'),app);

(async()=>{
 const {translate,exercises,compare}=app.SozReaderStudy;
 const short=await translate(page,phrase,firstEnd-1);
 assert.equal(short.english,'tried to read');
 assert.equal(short.kind,'phrase');
 assert.equal(short.note,'A past attempt.');
 const complete=await translate(page,0,firstEnd-1);
 assert.equal(complete.english,sentences[0][2]);
 assert.equal(complete.kind,'sentence');
 const unknown=await translate(page,0,phrase+'oxumağa'.length);
 assert.equal(unknown.english,undefined);
 assert.equal(unknown.sentence.english,sentences[0][2]);
 const lexical=await translate(page,secondStart,word+7,{dictionary:async()=>({english:'some gloss',headword:'example'})});
 assert.equal(lexical.kind,'dictionary');
 const daily=await exercises([page],'2026-11-28');
 assert.deepEqual(Array.from(daily,x=>x.kind),['sentence','phrase','word']);
 assert.equal(daily[1].context.before,'Kitabı ');
 assert.equal(daily[1].context.after,'.');
 const checks=[['She was still cautious.',['kept her guard up'],['dropped her guard']]];
 assert.equal(compare('She kept her guard up.',checks)[0].state,'matched');
 assert.equal(compare('She dropped her guard.',checks)[0].state,'reversed');
 assert.equal(compare('She went home.',checks)[0].state,'check');
})().catch(err=>{console.error(err);process.exitCode=1;});
