/* Small dependency-free data layer, also usable by Node for verification. */
(function (root) {
'use strict';
const normalize = s => String(s || '').toLocaleLowerCase('az').replace(/ı/g,'i').replace(/ə/g,'e').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ğ/g,'g').replace(/ş/g,'s').replace(/ç/g,'c').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
const types = {
 root:{name:'eyni kök',description:'Eyni kök və törəmə sözlər',color:'#5072e3',fill:'#5072e3',border:'#5072e3',text:'#ffffff',order:0},
 syn:{name:'sinonimlər',description:'Yaxın və ya eyni məna',color:'#58c978',fill:'#58c978',border:'#58c978',text:'#ffffff',order:1},
 ant:{name:'antonimlər',description:'Əks məna',color:'#e65b61',fill:'#e65b61',border:'#e65b61',text:'#ffffff',order:2},
 ending:{name:'oxşar sonluqlar',description:'Ortaq sonluq; ortaq kök deyil',color:'#b69bd4',fill:'#b69bd4',border:'#b69bd4',text:'#2c2632',order:3},
 topic:{name:'məna yaxınlığı',description:'Mövzu və anlayış yaxınlığı',color:'#e5c64e',fill:'#e5c64e',border:'#e5c64e',text:'#302c20',order:4}
};
function createModel(raw,extra={nodes:[],edges:[],enrichment:{}},grammar={records:[],excluded:[],overrides:{}},vocabulary={nodes:[],edges:[]},review={nodes:[],edges:[],blocked:[],evidence:{},overrides:{}},bilingual=null,expansion={nodes:[],edges:[]},nominal={records:[],excluded:[],overrides:{},aliases:{}},additions={nodes:[],edges:[]},relations={edges:[],evidence:{},overrides:{},blocked:[]},references={nodes:[],edges:[],evidence:{}},growth={nodes:[],edges:[],evidence:{},blocked:[],overrides:{}},verification={edges:[],evidence:{},blocked:[],overrides:{},status:{}},orthography={entries:[]},lexical={verbs:{},edges:[],evidence:{}}){
 const collator=new Intl.Collator('az');
 function translationPair(language,text){const pair=verification.texts?.[language+'\t'+text]||bilingual?.texts?.[language+'\t'+text];if(!pair?.[0]||!pair?.[1])throw new Error('Missing bilingual text: '+language+' / '+text);return {az:pair[0],en:pair[1]};}
 function localize(n){
  if(!bilingual)return n;
  const language=n.source?.language||'en',senses=n.source?.sensePairs||(n.source?.senses||[]).map(t=>translationPair(language,t)),edited=bilingual.overrides?.[n.w];
  const pair=edited?{az:edited[0],en:edited[1]}:n.az?{az:n.az,en:n.en}:senses[0]||translationPair(language,n.en);
  return {...n,...pair,bilingualSenses:senses,bilingualMethod:edited?'edited':n.source?.translationMethod||(n.az?'existing':'machine'),english:normalize([pair.en,...senses.map(s=>s.en)].join('; ')),azerbaijani:normalize([pair.az,...senses.map(s=>s.az)].join('; '))};
 }
 const allNodes=[...raw.nodes,...(extra.nodes||[]),...(vocabulary.nodes||[]),...(review.nodes||[]),...(expansion.nodes||[]),...(additions.nodes||[]),...(references.nodes||[]),...(growth.nodes||[])].map((n,id)=>({id,w:n[0],en:n[1],az:n[2],pos:n[3],topic:n[4],base:n[5],form:n[6],quality:n[7],source:n[8]||extra.enrichment?.[n[0]]||null,lower:n[0].toLocaleLowerCase('az'),key:normalize(n[0]),english:normalize(n[1])}));
 const aliases=nominal.aliases||{},allByWord=new Map(allNodes.map(n=>[n.w,n])),excluded=new Set([...(grammar.excluded||[]),...(nominal.excluded||[]),...(verification.excluded||[]),...Object.keys(aliases)]);
 const nodes=allNodes.filter(n=>!excluded.has(n.w)).map(n=>{const override={...grammar.overrides?.[n.w],...review.overrides?.[n.w]},localized=localize({...n,...override,english:normalize(override.en??n.en)}),lexical=nominal.overrides?.[n.w];const correction={...relations.overrides?.[n.w],...growth.overrides?.[n.w],...verification.overrides?.[n.w],...(verification.status?.[n.w]?{definitionAuditStatus:verification.status[n.w]}:{})};if(!lexical&&!Object.keys(correction).length)return localized;const result={...localized,...lexical,...correction};return {...result,english:normalize([result.en,...(result.bilingualSenses||[]).map(s=>s.en)].join('; ')),azerbaijani:normalize([result.az,...(result.bilingualSenses||[]).map(s=>s.az)].join('; '))};});
 for(const node of nodes){
  const definition=lexical.definitions?.[node.w];
  if(!definition?.replaceExisting)continue;
  const {az,en,pos,refs,senses=[]}=definition;
  const bilingualSenses=[{az,en},...senses];
  Object.assign(node,{az,en,pos,bilingualSenses,bilingualMethod:'edited',definitionAuditStatus:'source-compared',definitionSources:refs,
   english:normalize(bilingualSenses.map(sense=>sense.en).join(' ')),azerbaijani:normalize(bilingualSenses.map(sense=>sense.az).join(' '))});
 }
 const byWord=new Map(nodes.map(n=>[n.w,n]));
 const byId=new Map(nodes.map(n=>[n.id,n]));
 // A spelling citation can add a headword even if an older source archived
 // the same spelling as a form. Keep the archived analysis and legacy edges.
 const activeSpellings=new Set(nodes.map(n=>n.lower.normalize('NFC')));
 const orthographyNodes=[];
 for(const [w,page] of orthography.entries){
  const lower=w.toLocaleLowerCase('az'),spelling=lower.normalize('NFC');
  if(activeSpellings.has(spelling))continue;
  const definition=lexical.definitions?.[w];
  const az=definition?.az||'',en=definition?.en||'';
  const node={id:allNodes.length+orthographyNodes.length,w,lower,key:normalize(w),az,en,english:normalize(en),azerbaijani:normalize(az),pos:lexical.verbs?.[w]?'verb':definition?.pos||'word',quality:'orthography',orthographyPage:page,verbEvidence:lexical.verbs?.[w],definitionSources:definition?.refs};
  activeSpellings.add(spelling);
  orthographyNodes.push(node);
  nodes.push(node);
  byWord.set(w,node);
  byId.set(node.id,node);
  if(!allByWord.has(w))allByWord.set(w,node);
 }
 for(const node of nodes){
  const references=lexical.special?.[node.w];
  if(!references||node.az?.trim()&&node.en?.trim())continue;
  node.special=references;
 }
 const allEdges=[...raw.edges,...(extra.edges||[]),...(vocabulary.edges||[]),...(review.edges||[]),...(expansion.edges||[]),...(additions.edges||[]),...(relations.edges||[]),...(references.edges||[]),...(growth.edges||[]),...(verification.edges||[])];
 const edgeKey=e=>[e[0],e[1]].sort().join('|')+'|'+e[2],blockedSemantic=new Set([...(review.blocked||[]),...(relations.blocked||[]),...(growth.blocked||[]),...(verification.blocked||[])].map(edgeKey));
 const blocked=new Set([...(grammar.blockedEdges||[]),...(nominal.blockedEdges||[]).map(e=>[e[0],e[1],e[3].replace(/ · Wiktionary.*$/,'')])].map(e=>[e[0],e[1]].sort().join('|')+'|'+e[2]));
 // A spelling entry must not restore legacy edges from an excluded form.
 const inherited=allEdges.map(e=>aliases[e[0]]||aliases[e[1]]?[aliases[e[0]]||e[0],aliases[e[1]]||e[1],e[2],e[3],edgeKey(e)]:e).filter(e=>!byWord.get(e[0])?.orthographyPage&&!byWord.get(e[1])?.orthographyPage);
 const candidates=[...inherited,...(lexical.edges||[])].filter(e=>byWord.has(e[0])&&byWord.has(e[1])&&!blockedSemantic.has(edgeKey(e))&&!blocked.has([e[0],e[1]].sort().join('|')+'|'+e[3].replace(/ · Wiktionary.*$/,'')));
 const edgePairs=new Set(candidates.filter(e=>e[2]!=='topic').map(e=>[e[0],e[1]].sort().join('|')));
 const unique=new Set();
 const retainedCandidates=candidates.filter(e=>!(e[2]==='topic'&&edgePairs.has([e[0],e[1]].sort().join('|'))));
 const knownRootLinks=new Set(retainedCandidates.filter(e=>e[2]==='root').map(edgeKey));
 for(const [rootWord,recordedMembers,refs] of lexical.families||[]){
  if(!byWord.has(rootWord))continue;
  const members=recordedMembers.filter(word=>byWord.has(word));
  const proof={family:'root:'+rootWord,scope:'root-family',from:rootWord,senseAz:'«'+rootWord+'» kökündən yaranmış sözlər.',senseEn:'Words from the same '+rootWord+' root.',refs};
  for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
   const edge=[members[i],members[j],'root','Ortaq kök · '+rootWord,null,[proof]],key=edgeKey(edge);
   if(blockedSemantic.has(key)||knownRootLinks.has(key))continue;
   knownRootLinks.add(key);
   retainedCandidates.push(edge);
  }
 }
 const edges=retainedCandidates.map((e,id)=>({id,a:byWord.get(e[0]),b:byWord.get(e[1]),type:e[2],note:e[3],evidence:[...(e[5]||[]),...(lexical.evidence?.[edgeKey(e)]||[]),...(verification.evidence?.[edgeKey(e)]||[]),...(growth.evidence?.[edgeKey(e)]||[]),...(references.evidence?.[edgeKey(e)]||[]),...(relations.evidence?.[edgeKey(e)]||[]),...(review.evidence?.[e[4]||edgeKey(e)]||[])]})).filter(e=>{const key=[e.a?.id,e.b?.id].sort().join('|')+'|'+e.type;if(!e.a||!e.b||!types[e.type]||e.a===e.b||unique.has(key))return false;unique.add(key);return true;});
 function connectionInfo(edge,word){
  const proof=[...edge.evidence].filter(e=>e.sense||e.senseAz).sort((a,b)=>Number(Boolean(b.auditReviewed))-Number(Boolean(a.auditReviewed))||Number(b.scope==='reviewed')-Number(a.scope==='reviewed')||Number(Boolean(b.senseAz))-Number(Boolean(a.senseAz))||Number(b.from===word)-Number(a.from===word)||Number(b.scope==='sense')-Number(a.scope==='sense'))[0]||null;
  if(!proof)return null;
  if(proof.senseAz&&proof.senseEn)return {...proof,language:'az',sense:proof.senseAz,senseEnglish:proof.senseEn,qualifier:proof.qualifierAz||'',qualifierEnglish:proof.qualifierEn||''};
  if(!bilingual)return proof;
  const pair=translationPair(proof.language||'en',proof.sense),qualifier=proof.qualifier?translationPair(proof.language||'en',proof.qualifier):null;
  return {...proof,sourceLanguage:proof.language,language:'az',sense:pair.az,senseEnglish:pair.en,qualifier:qualifier?.az||'',qualifierEnglish:qualifier?.en||''};
 }
 const adjacency=new Map(nodes.map(n=>[n.id,[]]));
 for(const e of edges){adjacency.get(e.a.id).push({node:e.b,edge:e});adjacency.get(e.b.id).push({node:e.a,edge:e});}
 for(const list of adjacency.values())list.sort((a,b)=>types[a.edge.type].order-types[b.edge.type].order||collator.compare(a.node.w,b.node.w));
 const related=(n,filters=new Set(Object.keys(types)))=>(adjacency.get(n.id)||[]).filter(x=>filters.has(x.edge.type));
 const alphabetical=[...nodes].sort((a,b)=>collator.compare(a.w,b.w));
 const specialNodes=alphabetical.filter(node=>node.special);
 const grammarRecords=(grammar.records||[]).map((n,id)=>{const pairs=bilingual?n.senses.map(t=>translationPair(n.origin==='original'&&t===allByWord.get(n.w)?.az?'az':'en',t)):[];return {...n,id,key:normalize(n.w),baseKey:normalize(n.base),definitions:pairs,az:pairs[0]?.az||'',en:pairs[0]?.en||''};}).sort((a,b)=>collator.compare(a.base,b.base)||collator.compare(a.w,b.w));
 const nominalRecords=(nominal.records||[]).map((n,id)=>({...n,id,key:normalize(n.w),baseKey:normalize(n.base),lemmaKey:normalize(n.lemma),meaningKey:normalize(n.az+' '+n.en),definitions:n.analyses.map(a=>({az:a.az,en:a.en}))})).sort((a,b)=>collator.compare(a.lemma||a.base,b.lemma||b.base)||collator.compare(a.w,b.w));
 const formsByWord=new Map();for(const n of [...nominalRecords,...grammarRecords]){if(!formsByWord.has(n.w))formsByWord.set(n.w,[]);formsByWord.get(n.w).push(n);}
 function grammarSearch(q=''){const s=normalize(q.trim());return grammarRecords.filter(n=>!s||n.key.includes(s)||n.baseKey.includes(s)||normalize(n.senses.join(' ')).includes(s)).sort((a,b)=>Number(b.key===s)-Number(a.key===s)||Number(b.baseKey===s)-Number(a.baseKey===s)||collator.compare(a.base,b.base)||collator.compare(a.w,b.w));}
 function nominalSearch(q=''){const s=normalize(q.trim());if(!s)return nominalRecords;return nominalRecords.filter(n=>n.key.includes(s)||n.baseKey.includes(s)||n.lemmaKey.includes(s)||n.meaningKey.includes(s)).sort((a,b)=>Number(b.key===s)-Number(a.key===s)||Number(b.baseKey===s)-Number(a.baseKey===s)||collator.compare(a.lemma||a.base,b.lemma||b.base)||collator.compare(a.w,b.w));}
 function resolveWord(w,seen=new Set()){if(seen.has(w))return;seen.add(w);return byWord.get(w)||byWord.get(aliases[w])||(formsByWord.get(w)||[]).map(n=>resolveWord(n.lemma||n.base,seen)).find(Boolean);}
 function archiveMode(w){return (formsByWord.get(w)||[]).some(n=>n.kind==='nominal')?'forms':'grammar';}
 function search(q,limit=10){
  const query=q.trim(),s=normalize(query),exact=query.toLocaleLowerCase('az');if(!s)return[];const buckets=[[],[],[],[],[],[]];
  for(const n of nodes){const az=n.azerbaijani||'';const score=n.lower===exact?0:n.key===s?1:n.key.startsWith(s)?2:n.key.includes(s)?3:n.english.startsWith(s)||az.startsWith(s)?4:n.english.includes(s)||az.includes(s)?5:9;if(score<9)buckets[score].push(n);}
  const results=[];for(const bucket of buckets){bucket.sort((a,b)=>Number(a.quality!=='curated')-Number(b.quality!=='curated')||Number(a.pos==='form')-Number(b.pos==='form')||a.w.length-b.w.length||collator.compare(a.w,b.w));results.push(...bucket.slice(0,limit-results.length));if(results.length>=limit)break;}return results;
 }
 function neighborhood(n,depth,filters){
  const items=[{node:n,depth:0,type:'root',parent:null}],seen=new Set([n.id]);
  const all=related(n,filters);let topicCount=0;
  for(const x of all){if(seen.has(x.node.id))continue;if(x.edge.type==='topic'&&topicCount++>=5)continue;if(items.length>=25)break;items.push({...x,depth:1,type:x.edge.type,parent:n.id});seen.add(x.node.id);}
  if(depth===2){const direct=items.slice(1);for(let round=0;round<4;round++){for(const parent of direct){const options=related(parent.node,filters).filter(x=>!seen.has(x.node.id));const next=options[0];if(next&&items.length<48){items.push({...next,depth:2,type:next.edge.type,parent:parent.node.id});seen.add(next.node.id);}}}}
  const shown=new Map();for(const id of seen)for(const {edge} of adjacency.get(id))if(seen.has(edge.a.id)&&seen.has(edge.b.id)&&filters.has(edge.type))shown.set(edge.id,edge);return {items,edges:[...shown.values()],total:all.length};
 }
 return {nodes,orthographyNodes,specialNodes,verbEvidence:lexical.verbs||{},byWord,byId,edges,adjacency,related,search,neighborhood,alphabetical,allNodes,allByWord,allEdges,grammarRecords,grammarSearch,nominalRecords,nominalSearch,formsByWord,resolveWord,archiveMode,aliases,connectionInfo,translationPair};
}
const api={normalize,types,createModel};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WordWeb=api;
})(typeof window!=='undefined'?window:globalThis);
