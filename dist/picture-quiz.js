/* Picture quiz: questions, answers and scoring, independent of rendering and storage. */
(function(root){
'use strict';
const STOP=new Set(['the','and','for','with','from','one','kind','type','small','large','little','used','person','thing','someone','something','that','which','who','its','his','her','their']);
function shuffle(items,random=Math.random){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function headWords(text){return new Set(String(text||'').toLowerCase().split(/[;:(]/)[0].split(/[^a-z]+/).filter(w=>w.length>2&&!STOP.has(w)).map(w=>w.replace(/(?:es|s)$/,'')));}
function createPictureQuiz(model,data){
 if(!data||!Array.isArray(data.pictures))throw new Error('Picture data missing');
 const items=data.pictures.map(([word,category,svg,source,group],index)=>({index,word,category,svg,source,group:group||null,node:model.byWord.get(word)})).filter(item=>item.node&&item.svg);
 const byWord=new Map(items.map(item=>[item.word,item]));
 // Two answers are confusable when the dictionary links them as synonyms or
 // root relatives, or when their English glosses share a content word
 // ("boat" / "motorboat", "bus" / "minibus"), or when both drawings share one base
 // (a bust with a pointer to the neck or the chin). Confusable pictures never share a question.
 const related=new Map(items.map(item=>[item.word,new Set()]));
 for(const edge of model.edges||[]){if(edge.type!=='syn'&&edge.type!=='root')continue;const a=edge.a?.w,b=edge.b?.w;if(related.has(a)&&related.has(b)){related.get(a).add(b);related.get(b).add(a);}}
 const gloss=new Map(items.map(item=>[item.word,headWords(item.node.en)]));
 function confusable(a,b){if(a===b||a.word===b.word||a.group&&a.group===b.group||related.get(a.word).has(b.word))return true;const ga=gloss.get(a.word),gb=gloss.get(b.word);for(const x of ga)for(const y of gb)if(x===y||x.endsWith(y)||y.endsWith(x))return true;return false;}
 const categories=(data.categories||[]).map(c=>({...c,count:items.filter(item=>item.category===c.id).length})).filter(c=>c.count>=4);
 function pool(category){return !category||category==='all'?items:items.filter(item=>item.category===category);}
 function options(answer,candidates,random){
  const picked=[];
  const tryAdd=list=>{for(const item of list){if(picked.length===3)return;if(confusable(answer,item)||picked.some(other=>confusable(other,item)))continue;picked.push(item);}};
  tryAdd(shuffle(candidates.filter(item=>item.category===answer.category),random));
  tryAdd(shuffle(items.filter(item=>item.category===answer.category),random));
  tryAdd(shuffle(items,random));
  if(picked.length<3)throw new Error('Not enough pictures for '+answer.word);
  return shuffle([answer,...picked],random);
 }
 function round({category='all',mode='picture',size=10,random=Math.random,words=null}={}){
  if(mode!=='picture'&&mode!=='word')throw new Error('Unknown mode');
  const candidates=words?words.map(word=>byWord.get(word)).filter(Boolean):pool(category);
  const chosen=shuffle(candidates,random).slice(0,Math.min(size,candidates.length));
  if(!chosen.length)throw new Error('No picture questions');
  return {mode,category,questions:chosen.map(answer=>({answer,options:options(answer,candidates,random)})),index:0,answers:[],complete:false};
 }
 function answer(state,word){
  if(state.complete||state.answers.length>state.index)return null;
  const q=state.questions[state.index];if(!q.options.some(option=>option.word===word))return null;
  const result={word:q.answer.word,chosen:word,correct:word===q.answer.word};state.answers.push(result);return result;
 }
 function next(state){
  if(state.complete||state.answers.length<=state.index)return false;
  if(state.index===state.questions.length-1)state.complete=true;else state.index++;
  return true;
 }
 return {items,categories,byWord,round,answer,next,confusable};
}
const api={createPictureQuiz,shuffle};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PictureQuiz=api;
})(typeof window!=='undefined'?window:globalThis);
