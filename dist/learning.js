/* Daily selection and quiz state are independent of rendering and storage. */
(function(root){
'use strict';
const mod=(n,m)=>((n%m)+m)%m;
function dayKey(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=type=>parts.find(p=>p.type===type).value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}
function shuffle(items,random=Math.random){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function createLearning(model,content){
 const dailyWords=content.dailyWords.filter(w=>{
  const node=model.byWord.get(w);
  return node?.az&&node.en&&!node.special&&!node.form;
 });
 const bank=content.questions.filter(q=>model.byWord.has(q.word)&&q.distractors.length===3&&new Set([q.word,...q.distractors]).size===4&&q.distractors.every(w=>model.byWord.has(w)));
 if(!dailyWords.length||bank.length<10)throw new Error('Incomplete learning content');
 const dayMs=86400000,cycleStart=Date.parse(content.meta.daily_start+'T00:00:00Z');
 function daily(now=new Date()){
  const date=dayKey(now),index=(Date.parse(date+'T00:00:00Z')-cycleStart)/dayMs;
  return {date,word:model.byWord.get(dailyWords[mod(index,dailyWords.length)])};
 }
 function round({words=null,random=Math.random,size=10}={}){
  const candidates=words?bank.filter(q=>words.includes(q.word)):bank;
  const questions=shuffle(candidates,random).slice(0,Math.min(size,candidates.length)).map(q=>({...q,options:shuffle([q.word,...q.distractors],random)}));
  if(!questions.length)throw new Error('No quiz questions');
  return {questions,index:0,answers:[],complete:false};
 }
 function answer(state,word){
  if(state.complete||state.answers.length>state.index)return null;
  const q=state.questions[state.index];if(!q.options.includes(word))return null;
  const result={word:q.word,chosen:word,correct:word===q.word};state.answers.push(result);return result;
 }
 function next(state){
  if(state.complete||state.answers.length<=state.index)return false;
  if(state.index===state.questions.length-1)state.complete=true;else state.index++;
  return true;
 }
 return {daily,round,answer,next,bank,dailyWords};
}
const api={dayKey,shuffle,createLearning};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WordLearning=api;
})(typeof window!=='undefined'?window:globalThis);
