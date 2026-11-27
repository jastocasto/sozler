/* Small dependency-free data layer, also usable by Node for verification. */
(function (root) {
'use strict';
// Fold to plain lowercase letters for search. Azerbaijani-specific lowercasing
// only differs for I/İ, and both end as "i" after folding, so the faster
// toLowerCase gives the same result (scripts/build_runtime.cjs checks this).
const FOLD={'ı':'i','ə':'e','ö':'o','ü':'u','ğ':'g','ş':'s','ç':'c'};
const normalize = s => {const folded=String(s || '').toLowerCase().replace(/[ıəöüğşç]/g,c=>FOLD[c]);return /[^\x00-\x7f]/.test(folded)?folded.normalize('NFKD').replace(/[\u0300-\u036f]/g,''):folded;};
// A lookup spelling points to an existing word without adding a dictionary entry or connection.
const lookupSpellings=new Map([['guzel','gözəl'],['gozel','gözəl']]);
const types = {
 root:{name:'eyni kök',description:'Eyni kök və törəmə sözlər',color:'#5072e3',fill:'#5072e3',border:'#5072e3',text:'#ffffff',order:0},
 syn:{name:'sinonimlər',description:'Yaxın və ya eyni məna',color:'#58c978',fill:'#58c978',border:'#58c978',text:'#ffffff',order:1},
 ant:{name:'antonimlər',description:'Əks məna',color:'#e65b61',fill:'#e65b61',border:'#e65b61',text:'#ffffff',order:2},
 ending:{name:'oxşar sonluqlar',description:'Ortaq sonluq; ortaq kök deyil',color:'#b69bd4',fill:'#b69bd4',border:'#b69bd4',text:'#2c2632',order:3},
 topic:{name:'məna yaxınlığı',description:'Mövzu və anlayış yaxınlığı',color:'#e5c64e',fill:'#e5c64e',border:'#e5c64e',text:'#302c20',order:4}
};
function createModel(raw,extra={nodes:[],edges:[],enrichment:{}},grammar={records:[],excluded:[],overrides:{}},vocabulary={nodes:[],edges:[]},review={nodes:[],edges:[],blocked:[],evidence:{},overrides:{}},bilingual=null,expansion={nodes:[],edges:[]},nominal={records:[],excluded:[],overrides:{},aliases:{}},additions={nodes:[],edges:[]},relations={edges:[],evidence:{},overrides:{},blocked:[]},references={nodes:[],edges:[],evidence:{}},growth={nodes:[],edges:[],evidence:{},blocked:[],overrides:{}},verification={edges:[],evidence:{},blocked:[],overrides:{},status:{}},orthography={entries:[]},lexical={verbs:{},edges:[],evidence:{}},printDefinitions=null){
 // Print-dictionary definitions fill headwords that have none; existing reviewed text always wins.
 if(printDefinitions)lexical={...lexical,definitions:{...printDefinitions.definitions,...lexical.definitions},edges:[...(lexical.edges||[]),...(printDefinitions.edges||[])]};
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
  const node={id:allNodes.length+orthographyNodes.length,w,lower,key:normalize(w),az,en,english:normalize(en),azerbaijani:normalize(az),pos:lexical.verbs?.[w]?'verb':definition?.pos||'word',quality:'orthography',orthographyPage:page,verbEvidence:lexical.verbs?.[w],definitionSources:definition?.refs,...(definition?.method?{definitionMethod:definition.method}:{}),...(definition?.confidence?{definitionConfidence:definition.confidence}:{}),...(definition?.base||definition?.see?{definitionBase:definition.base||definition.see}:{}),...(definition?.formation?{definitionFormation:definition.formation}:{})};
  activeSpellings.add(spelling);
  orthographyNodes.push(node);
  nodes.push(node);
  byWord.set(w,node);
  byId.set(node.id,node);
  if(!allByWord.has(w))allByWord.set(w,node);
 }
 // The later print review can add attested expressions as well as correct existing senses.
 // Allocate fresh IDs after the spelling entries, but keep that layer contiguous for serialization.
 const edition=verification.dictionaryEdition,commonReview=verification.commonWordReview;
 if(edition){
  const additions=[];
  for(const entry of edition.entries){
   const w=entry.word,lower=w.toLocaleLowerCase('az');
   if(activeSpellings.has(lower.normalize('NFC')))throw Error('Duplicate reviewed headword: '+w);
   const node={id:allNodes.length+orthographyNodes.length+additions.length,w,lower,key:normalize(w),quality:'reference'};
   activeSpellings.add(lower.normalize('NFC'));
   additions.push(node);byWord.set(w,node);byId.set(node.id,node);allByWord.set(w,node);
  }
  nodes.splice(nodes.length-orthographyNodes.length,0,...additions);
 }
 const revisedEntries=[...(edition?.entries||[]),...(edition?.revisions||[]),...(commonReview?.revisions||[])];
 for(const entry of revisedEntries){
  const node=byWord.get(entry.word);
  // Historical builds can omit the spelling dictionary that supplies a revised entry.
  if(!node)continue;
  const {az,en,pos,senses,sources}=entry,bilingualSenses=[{az,en},...senses];
  Object.assign(node,{az,en,pos,bilingualSenses,bilingualMethod:'edited',definitionMethod:'paraphrase',
   definitionAuditStatus:'source-compared',definitionSources:sources,
   english:normalize(bilingualSenses.map(s=>s.en).join('; ')),azerbaijani:normalize(bilingualSenses.map(s=>s.az).join('; '))});
  delete node.definitionConfidence;
 }
 for(const node of nodes){
  const references=lexical.special?.[node.w];
  if(!references||node.az?.trim()&&node.en?.trim())continue;
  node.special=references;
 }
 const allEdges=[...raw.edges,...(extra.edges||[]),...(vocabulary.edges||[]),...(review.edges||[]),...(expansion.edges||[]),...(additions.edges||[]),...(relations.edges||[]),...(references.edges||[]),...(growth.edges||[]),...(verification.edges||[])];
 const edgeKey=e=>[e[0],e[1]].sort().join('|')+'|'+e[2],blockedSemantic=new Set([...(review.blocked||[]),...(relations.blocked||[]),...(growth.blocked||[]),...(verification.blocked||[]),...(commonReview?.blocked||[]),...(printDefinitions?.blocked||[])].map(edgeKey));
 const blocked=new Set([...(grammar.blockedEdges||[]),...(nominal.blockedEdges||[]).map(e=>[e[0],e[1],e[3].replace(/ · Wiktionary.*$/,'')])].map(e=>[e[0],e[1]].sort().join('|')+'|'+e[2]));
 // A spelling entry must not restore legacy edges from an excluded form.
 const inherited=allEdges.map(e=>aliases[e[0]]||aliases[e[1]]?[aliases[e[0]]||e[0],aliases[e[1]]||e[1],e[2],e[3],edgeKey(e)]:e).filter(e=>!byWord.get(e[0])?.orthographyPage&&!byWord.get(e[1])?.orthographyPage);
 const candidates=[...inherited,...(lexical.edges||[]),...(edition?.edges||[]),...(commonReview?.edges||[])].filter(e=>byWord.has(e[0])&&byWord.has(e[1])&&!blockedSemantic.has(edgeKey(e))&&!blocked.has([e[0],e[1]].sort().join('|')+'|'+e[3].replace(/ · Wiktionary.*$/,'')));
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
 const edges=retainedCandidates.map((e,id)=>({id,a:byWord.get(e[0]),b:byWord.get(e[1]),type:e[2],note:e[3],evidence:[...(commonReview?.evidence?.[edgeKey(e)]||[]),...(e[5]||[]),...(lexical.evidence?.[edgeKey(e)]||[]),...(verification.evidence?.[edgeKey(e)]||[]),...(growth.evidence?.[edgeKey(e)]||[]),...(references.evidence?.[edgeKey(e)]||[]),...(relations.evidence?.[edgeKey(e)]||[]),...(review.evidence?.[e[4]||edgeKey(e)]||[])]})).filter(e=>{const key=[e.a?.id,e.b?.id].sort().join('|')+'|'+e.type;if(!e.a||!e.b||!types[e.type]||e.a===e.b||unique.has(key))return false;unique.add(key);return true;});
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
 function resolveWord(w,seen=new Set()){if(seen.has(w))return;seen.add(w);return byWord.get(w)||byWord.get(aliases[w])||(formsByWord.get(w)||[]).map(n=>resolveWord(n.lemma||n.base,seen)).find(Boolean)||byWord.get(lookupSpellings.get(normalize(w)));}
 function archiveMode(w){return (formsByWord.get(w)||[]).some(n=>n.kind==='nominal')?'forms':'grammar';}
 function search(q,limit=10){
  const query=q.trim(),s=normalize(query),exact=query.toLocaleLowerCase('az');if(!s)return[];const alternate=byWord.get(lookupSpellings.get(s)),buckets=[[],[],[],[],[],[]];
  for(const n of nodes){const az=n.azerbaijani||'';const score=n.lower===exact?0:n.key===s||n===alternate?1:n.key.startsWith(s)?2:n.key.includes(s)?3:n.english.startsWith(s)||az.startsWith(s)?4:n.english.includes(s)||az.includes(s)?5:9;if(score<9)buckets[score].push(n);}
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
// The browser does not run createModel. scripts/build_runtime.cjs runs it once,
// writes the result to soz-core.js plus on-demand files, and restoreModel
// rebuilds the same model API from them. The build checks both agree.
function shardOf(word,count){let h=0x811c9dc5;for(let i=0;i<word.length;i++){h^=word.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0)%count;}
const searchText=(first,senses,side)=>normalize([first,...(senses||[]).map(s=>s[side])].join('; '));
const NO_EVIDENCE=Object.freeze([]);
function restoreModel(core,{fetchJSON}={}){
 const collator=new Intl.Collator('az');
 const {count,cols,sparse,orthographyStart,rank,excluded}=core.nodes;
 // Definitions and senses arrive separately (core.text, soz-text.json); older
 // snapshots keep them in the core itself.
 let englishExceptions=core.nodes.english||{},azerbaijaniExceptions=core.nodes.azerbaijani||{},textLoaded=!core.text;
 const value=(columns,field,i)=>{const col=columns[field];if(!col)return undefined;const v=col.values[i];return v===null?undefined:col.dict?col.dict[v]:v;};
 const nodes=new Array(count);
 for(let i=0;i<count;i++)nodes[i]={id:value(cols,'id',i),w:value(cols,'w',i),en:value(cols,'en',i),az:value(cols,'az',i),pos:value(cols,'pos',i),quality:value(cols,'quality',i)};
 function assign(columns,sparseFields,refs,skip){
  for(const field in columns){
   if(skip.includes(field))continue;
   const {values,dict,refList}=columns[field];
   for(let i=0;i<count;i++){const v=values[i];if(v===null)continue;nodes[i][field]=refList?v.map(j=>refs[j]):dict?dict[v]:v;}
  }
  for(const field in sparseFields){const map=sparseFields[field];for(const i in map)nodes[i][field]=map[i];}
 }
 assign(cols,sparse,core.refs||[],['id','w','en','az','pos','quality']);
 const verbEvidence=core.verbEvidence;
 for(let i=orthographyStart;i<count;i++){const n=nodes[i];if(verbEvidence[n.w])n.verbEvidence=verbEvidence[n.w];}
 // Search fields are not needed to draw the map. prepareSearch(limit) fills
 // them a slice at a time; search fills the rest. Word keys (lower, key) need
 // only the headword; meaning text (english, azerbaijani) waits for the text.
 let preparedKeys=0,preparedText=0;
 function prepareSearch(limit=Infinity){
  let budget=limit;
  for(;preparedKeys<count&&budget>0;budget--){const n=nodes[preparedKeys++];n.lower=n.w.toLocaleLowerCase('az');n.key=normalize(n.w);}
  if(textLoaded)for(;preparedText<count&&budget>0;budget--){const i=preparedText++,n=nodes[i];n.english=englishExceptions[i]??searchText(n.en,n.bilingualSenses,'en');n.azerbaijani=azerbaijaniExceptions[i]??searchText(n.az,n.bilingualSenses,'az');}
  return preparedKeys===count&&(!textLoaded||preparedText===count);
 }
 const byWord=new Map(),byId=new Map();let maxId=0;
 for(const n of nodes){byWord.set(n.w,n);byId.set(n.id,n);if(n.id>maxId)maxId=n.id;}
 const meaningHashes=core.text?.meaningHashes||[],loadedMeanings=new Set(),pendingMeanings=new Map();
 function applyPrimary(rows){
  for(const [id,az,en] of rows){
   const n=byId.get(id);if(!n)continue;
   if(az){n.az=az;n.azerbaijani=normalize(az);}
   if(en){n.en=en;n.english=normalize(en);}
  }
 }
 applyPrimary(core.text?.starterMeanings||[]);
 function primaryReady(n){
  return textLoaded||Boolean(n.az&&n.en)||Boolean(meaningHashes.length&&loadedMeanings.has(shardOf(n.w,meaningHashes.length)));
 }
 function ensurePrimary(n){
  if(primaryReady(n)||!meaningHashes.length)return true;
  const i=shardOf(n.w,meaningHashes.length);
  return load('meanings/'+meaningHashes[i]+'.json',rows=>{applyPrimary(rows);loadedMeanings.add(i);},()=>textLoaded||loadedMeanings.has(i),pendingMeanings,i);
 }
 const rankById=new Int32Array(maxId+1);for(let i=0;i<count;i++)rankById[nodes[i].id]=rank[i];
 // Corpus frequency rank (1 = most common); 0 means the word was not found often enough to rank.
 const frequencyById=new Int32Array(maxId+1);if(core.frequency)for(let i=0;i<count;i++)frequencyById[nodes[i].id]=core.frequency[i];
 const commonness=n=>frequencyById[n.id]||Infinity;
 const allByWord=new Map(byWord);for(const [w,id] of excluded)if(!allByWord.has(w))allByWord.set(w,{id,w});
 const orthographyNodes=nodes.slice(orthographyStart);
 const alphabetical=nodes.map((n,i)=>i).sort((a,b)=>rank[a]-rank[b]||a-b).map(i=>nodes[i]);
 const specialNodes=alphabetical.filter(node=>node.special);
 // Link evidence arrives with a word's detail file; until then an edge has none.
 const evidenceById=new Map();
 // Older snapshots identify evidence by the edge's position. New snapshots
 // record the start of each consecutive run of permanent evidence IDs.
 const evidenceRuns = core.edges.evidenceIdRuns;
 const evidenceIds = evidenceRuns?.length ? new Uint32Array(core.edges.flat.length / 4) : null;
 if (evidenceIds) {
  let run = 0, next = 0;
  for (let i = 0; i < evidenceIds.length; i++) {
   if (run < evidenceRuns.length && evidenceRuns[run][0] === i) next = evidenceRuns[run++][1];
   evidenceIds[i] = next++;
  }
 }
 class Edge{constructor(id,a,b,type,note){this.id=id;this.a=a;this.b=b;this.type=type;this.note=note;}get evidence(){return evidenceById.get(evidenceIds ? evidenceIds[this.id] : this.id)||NO_EVIDENCE;}}
 const {flat,types:typeList,notes}=core.edges,edges=new Array(flat.length/4);
 for(let i=0,k=0;k<flat.length;i++,k+=4)edges[i]=new Edge(i,nodes[flat[k]],nodes[flat[k+1]],typeList[flat[k+2]],notes[flat[k+3]]);
 // Each word's links are sorted and wrapped on first use; edgesOf holds edge indexes per word.
 const position=new Map();nodes.forEach((n,i)=>position.set(n.id,i));
 const degree=new Int32Array(count+1);
 for(let k=0;k<flat.length;k+=4){degree[flat[k]+1]++;degree[flat[k+1]+1]++;}
 for(let i=0;i<count;i++)degree[i+1]+=degree[i];
 const edgesOf=new Int32Array(degree[count]),fill=degree.slice(0,count);
 for(let k=0,e=0;k<flat.length;k+=4,e++){edgesOf[fill[flat[k]]++]=e;edgesOf[fill[flat[k+1]]++]=e;}
 const linkLists=new Map();
 const adjacency={get(id){
  if(linkLists.has(id))return linkLists.get(id);
  const i=position.get(id);if(i===undefined)return undefined;
  const list=[];for(let k=degree[i];k<degree[i+1];k++){const e=edges[edgesOf[k]];list.push({node:e.a.id===id?e.b:e.a,edge:e});}
  if(list.length>1)list.sort((a,b)=>types[a.edge.type].order-types[b.edge.type].order||rankById[a.node.id]-rankById[b.node.id]);
  linkLists.set(id,list);return list;
 },has:id=>position.has(id)};
 const related=(n,filters=new Set(Object.keys(types)))=>(adjacency.get(n.id)||[]).filter(x=>filters.has(x.edge.type));
 const grammarRecords=core.grammarRecords;
 const nominalRecords=core.nominal.map(([w,base,lemma,kind,id])=>({w,base,lemma,kind,id,key:normalize(w),baseKey:normalize(base),lemmaKey:normalize(lemma)}));
 const formsByWord=new Map();for(const n of [...nominalRecords,...grammarRecords]){if(!formsByWord.has(n.w))formsByWord.set(n.w,[]);formsByWord.get(n.w).push(n);}
 const aliases=core.aliases;
 function grammarSearch(q=''){const s=normalize(q.trim());return grammarRecords.filter(n=>!s||n.key.includes(s)||n.baseKey.includes(s)||normalize(n.senses.join(' ')).includes(s)).sort((a,b)=>Number(b.key===s)-Number(a.key===s)||Number(b.baseKey===s)-Number(a.baseKey===s)||collator.compare(a.base,b.base)||collator.compare(a.w,b.w));}
 // Until the forms archive loads, records carry spellings and bases but not meanings.
 function nominalSearch(q=''){const s=normalize(q.trim());if(!s)return nominalRecords;return nominalRecords.filter(n=>n.key.includes(s)||n.baseKey.includes(s)||n.lemmaKey.includes(s)||(n.meaningKey||'').includes(s)).sort((a,b)=>Number(b.key===s)-Number(a.key===s)||Number(b.baseKey===s)-Number(a.baseKey===s)||collator.compare(a.lemma||a.base,b.lemma||b.base)||collator.compare(a.w,b.w));}
 function resolveWord(w,seen=new Set()){if(seen.has(w))return;seen.add(w);return byWord.get(w)||byWord.get(aliases[w])||(formsByWord.get(w)||[]).map(n=>resolveWord(n.lemma||n.base,seen)).find(Boolean)||byWord.get(lookupSpellings.get(normalize(w)));}
 function archiveMode(w){return (formsByWord.get(w)||[]).some(n=>n.kind==='nominal')?'forms':'grammar';}
 function search(q,limit=10){
  prepareSearch();const query=q.trim(),s=normalize(query),exact=query.toLocaleLowerCase('az');if(!s)return[];const alternate=byWord.get(lookupSpellings.get(s)),buckets=[[],[],[],[],[],[]];
  for(const n of nodes){const az=n.azerbaijani||'',en=n.english||'';const score=n.lower===exact?0:n.key===s||n===alternate?1:n.key.startsWith(s)?2:n.key.includes(s)?3:en.startsWith(s)||az.startsWith(s)?4:en.includes(s)||az.includes(s)?5:9;if(score<9)buckets[score].push(n);}
  const results=[];for(const bucket of buckets){bucket.sort((a,b)=>Number(a.quality!=='curated')-Number(b.quality!=='curated')||Number(a.pos==='form')-Number(b.pos==='form')||(core.frequency?commonness(a)-commonness(b)||0:0)||a.w.length-b.w.length||rankById[a.id]-rankById[b.id]);results.push(...bucket.slice(0,limit-results.length));if(results.length>=limit)break;}return results;
 }
 function neighborhood(n,depth,filters){
  const items=[{node:n,depth:0,type:'root',parent:null}],seen=new Set([n.id]);
  const all=related(n,filters);let topicCount=0;
  for(const x of all){if(seen.has(x.node.id))continue;if(x.edge.type==='topic'&&topicCount++>=5)continue;if(items.length>=25)break;items.push({...x,depth:1,type:x.edge.type,parent:n.id});seen.add(x.node.id);}
  if(depth===2){const direct=items.slice(1);for(let round=0;round<4;round++){for(const parent of direct){const options=related(parent.node,filters).filter(x=>!seen.has(x.node.id));const next=options[0];if(next&&items.length<48){items.push({...next,depth:2,type:next.edge.type,parent:parent.node.id});seen.add(next.node.id);}}}}
  const shown=new Map();for(const id of seen)for(const {edge} of adjacency.get(id))if(seen.has(edge.a.id)&&seen.has(edge.b.id)&&filters.has(edge.type))shown.set(edge.id,edge);return {items,edges:[...shown.values()],total:all.length};
 }
 function connectionInfo(edge,word){
  const proof=[...edge.evidence].filter(e=>e.sense||e.senseAz).sort((a,b)=>Number(Boolean(b.auditReviewed))-Number(Boolean(a.auditReviewed))||Number(b.scope==='reviewed')-Number(a.scope==='reviewed')||Number(Boolean(b.senseAz))-Number(Boolean(a.senseAz))||Number(b.from===word)-Number(a.from===word)||Number(b.scope==='sense')-Number(a.scope==='sense'))[0]||null;
  if(!proof)return null;
  if(proof.senseAz&&proof.senseEn)return {...proof,language:'az',sense:proof.senseAz,senseEnglish:proof.senseEn,qualifier:proof.qualifierAz||'',qualifierEnglish:proof.qualifierEn||''};
  // The build stores the Azerbaijani/English pair of a source-language sense as $t.
  const {$t:pair,...rest}=proof;if(!pair)return rest;
  return {...rest,sourceLanguage:rest.language,language:'az',sense:pair[0],senseEnglish:pair[1],qualifier:pair[2]||'',qualifierEnglish:pair[3]||''};
 }
 // Detail files: link evidence for every word in one hash shard.
 const wordDetails=new Map(),homonyms=new Set(core.homonyms||[]),loadedShards=new Set(),pendingShards=new Map(),{count:shardCount,hashes:shardHashes}=core.details;
 function applyShard(data){if(data.w)for(const word in data.w)wordDetails.set(word,data.w[word]);const refs=data.refs||[];for(const proof of data.ev)if(proof.refs)proof.refs=proof.refs.map(j=>refs[j]);for(const [id,list] of data.e)evidenceById.set(id,list.map(j=>data.ev[j]));}
 function load(path,apply,done,pending,key,options){
  if(done())return true;if(pending.has(key))return pending.get(key);if(!fetchJSON)return true;
  try{
   const result=fetchJSON(path,options);
   if(result&&typeof result.then==='function'){
    const promise=result.then(data=>{if(!done())apply(data);return true;}).finally(()=>pending.delete(key));
    pending.set(key,promise);return promise;
   }
   apply(result);return true;
  }catch(error){return Promise.reject(error);}
 }
 // Returns true when the word's details are present, otherwise a promise.
 function ensureDetails(word){const i=shardOf(word,shardCount);return load('details/'+i+'.json?v='+shardHashes[i],data=>{applyShard(data);loadedShards.add(i);},()=>loadedShards.has(i),pendingShards,i);}
 let formsLoaded=false;const pendingForms=new Map(),pendingText=new Map();
 // Definitions, senses and citations (soz-text.json). Returns true or a promise.
 function ensureText(){return load(core.text?core.text.file+'?v='+core.text.hash:'',data=>{
  if(data.cols?.az?.values.length!==count||data.cols?.en?.values.length!==count)throw new Error('Dictionary text does not match the loaded map.');
  assign(data.cols,data.sparse,data.refs||[],[]);englishExceptions=data.english||{};azerbaijaniExceptions=data.azerbaijani||{};textLoaded=true;
 },()=>textLoaded,pendingText,'text',core.text?.integrity?{integrity:core.text.integrity}:undefined);}
 function ensureForms(){return load('forms-archive.json?v='+core.formsArchive,data=>{for(let i=0;i<data.length;i++){const record=nominalRecords[i];Object.assign(record,data[i],{meaningKey:normalize(data[i].az+' '+data[i].en),definitions:data[i].analyses.map(a=>({az:a.az,en:a.en}))});}formsLoaded=true;},()=>formsLoaded,pendingForms,'forms');}
 // Approximate learner level from frequency rank (an estimate, not an official CEFR list).
 const LEVELS=[[500,'A1'],[1500,'A2'],[3500,'B1'],[7000,'B2'],[15000,'C1'],[Infinity,'C2']],BANDS=[[1000,5],[3000,4],[10000,3],[25000,2],[Infinity,1]];
 function frequency(n){const rank=n&&frequencyById[n.id];if(!rank)return null;return {rank,level:LEVELS.find(([max])=>rank<=max)[1],band:BANDS.find(([max])=>rank<=max)[1]};}
 let byFrequency=null;const commonWords=()=>byFrequency??=nodes.filter(n=>frequencyById[n.id]).sort((a,b)=>frequencyById[a.id]-frequencyById[b.id]);
 return {meta:core.meta,ensureText,textLoaded:()=>textLoaded,ensurePrimary,primaryReady,frequency,commonWords,wordDetails:word=>wordDetails.get(word)||null,isHomonym:word=>homonyms.has(word),prepareSearch,degree:n=>{const i=position.get(n.id);return i===undefined?0:degree[i+1]-degree[i];},nodes,orthographyNodes,specialNodes,verbEvidence,byWord,byId,edges,adjacency,related,search,neighborhood,alphabetical,allByWord,grammarRecords,grammarSearch,nominalRecords,nominalSearch,formsByWord,resolveWord,archiveMode,aliases,connectionInfo,ensureDetails,ensureForms,formsLoaded:()=>formsLoaded,detailsLoaded:word=>loadedShards.has(shardOf(word,shardCount))};
}
const api={normalize,types,createModel,restoreModel,shardOf};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WordWeb=api;
})(typeof window!=='undefined'?window:globalThis);
