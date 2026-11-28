/* Recognize names and their Azerbaijani case forms within the book. */
(function (root) {
'use strict';

const kinds={Character:'Characters',Place:'Places',Route:'Routes',Group:'Groups','Story name':'Story names'};
const caseNotes={
 gen:'Genitive · possession',
 dat:'Dative · direction or recipient',
 acc:'Accusative · direct object',
 loc:'Locative · location',
 abl:'Ablative · origin or movement away',
 ins:'Comitative · accompaniment or means'
};
const locationWords={şəhər:'city',kənd:'village',qəsəbə:'town',vilayət:'province',rayon:'district',ölkə:'country'};
const nameShape=/^\p{Lu}[\p{L}\p{M}]{2,}(?:[-’'][\p{L}\p{M}]+)*$/u;

function inEnglish(base,caseId,kind) {
 switch (caseId) {
  case 'gen': return kind==='Character'?base+'’s':'of '+base;
  case 'dat': return 'to '+base;
  case 'loc': return (kind==='Character'?'with ':kind==='Route'?'on ':'in ')+base;
  case 'abl': return 'from '+base;
  case 'ins': return 'with '+base;
  default: return base;
 }
}

function create(entries,morphology,normalize) {
 const forms=new Map();
 const locations=new Map();
 for (const [lemma,kind] of Object.entries(locationWords)) {
  for (const row of morphology.declension(lemma)[3].rows) {
   locations.set(row.singular,{kind,caseId:row.id});
  }
 }
 for (const entry of entries) {
  const english=entry.english??entry.word;
  for (const alias of entry.aliases??[]) add(alias,false);
  add(entry.possessedStem??entry.word,Boolean(entry.possessedStem));
  for (const expression of entry.expressions??[]) {
   forms.set(normalize(expression.text),{entry,english:expression.english,note:expression.note});
  }
  function add(spelling,possessed) {
   const rows=morphology.declension(spelling,entry.stemChange)[possessed?3:0].rows;
   for (const {id,singular} of rows) {
    forms.set(normalize(singular),{
     entry,english:inEnglish(english,id,entry.kind),note:caseNotes[id],caseId:id
    });
   }
  }
 }
 function match(text) {
  const surface=text.trim().replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu,'');
  if (!/^\p{Lu}/u.test(surface)) return null;
  const key=normalize(surface).replace(/['’]/gu,'');
  return forms.get(key) ?? (/^\p{Lu}{2,}-/u.test(surface)?forms.get(key.replace('-','')):null);
 }
 function placePhrase(text) {
  const phrase=text.trim().match(/^(.+?)[ \t\n]+([\p{L}\p{M}]+)$/su);
  if (!phrase||/\n[ \t]*\n/u.test(text)) return null;
  const [,name,noun]=phrase,place=match(name);
  const location=locations.get(normalize(noun));
  if (!location||!(place?place.entry.kind==='Place'&&place.caseId==='nom':nameShape.test(name))) return null;
  return {english:inEnglish('the '+location.kind+' of '+(place?.english??name),location.caseId,'Place')};
 }
 function possible(text,source,start) {
  if (!nameShape.test(text)) return null;
  const sentenceInterior=index=>/[\p{L}\p{N},][ \t]*$/u.test(source.slice(0,index));
  if (sentenceInterior(start)) return true;
  let index=source.indexOf(text);
  while (index!==-1) {
   const end=index+text.length;
   if (!/[\p{L}\p{M}]/u.test((source[index-1]??'')+(source[end]??''))&&sentenceInterior(index)) return true;
   index=source.indexOf(text,end);
  }
  return null;
 }
 return {match,placePhrase,possible};
}

const api={create,kinds};
if (typeof module!=='undefined'&&module.exports) module.exports=api;
else root.SozReaderNames=api;
})(typeof window!=='undefined'?window:globalThis);
