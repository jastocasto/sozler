/* Compile reviewed facts only. No runtime gloss matching, synonym closure, or suffix guessing. */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist'),content=path.join(__dirname,'content'),s={window:{}};
const files=['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions'];
for(const f of files)vm.runInNewContext(fs.readFileSync(path.join(dist,f+'.js'),'utf8'),s);
const w=s.window,{createModel}=require('../dist/model.js');
const args=[w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,w.WORD_WEB_NOMINAL,w.WORD_WEB_ADDITIONS];
const before=createModel(...args),read=f=>JSON.parse(fs.readFileSync(path.join(content,f+'.json'),'utf8'));
const key=(a,b,t)=>[a,b].sort().join('|')+'|'+t,edgeKey=e=>key(e.a.w,e.b.w,e.type),pair=(a,b)=>[a,b].sort().join('|');
const blocked=new Set(w.WORD_WEB_REVIEW.blocked.map(e=>key(...e))),oldKeys=new Set(before.edges.map(edgeKey)),semantics=new Map(before.edges.filter(e=>['syn','ant'].includes(e.type)).map(e=>[pair(e.a.w,e.b.w),e.type]));
const overlay={edges:[],evidence:{},overrides:{},blocked:[],meta:{}},newKeys=new Set(),omitted=[];
const reviews=['relation-review-a','relation-review-b'].flatMap(f=>read(f).decisions),manual=read('relations/manual'),sourceReview=read('relations/source-review'),etym=read('relations/etymology-candidates'),explicit=read('relations/explicit-candidates');
const sourceRefs=(...words)=>[...new Map(words.flatMap(word=>{const source=before.byWord.get(word)?.source;return source?.head&&source.kind!=='editorial'?[{head:source.head,edition:source.edition||'en'}]:[];}).map(r=>[r.edition+'|'+r.head,r])).values()];
function add(a,b,t,proof){
 assert(before.byWord.has(a)&&before.byWord.has(b),a+' / '+b);assert.notEqual(a,b);assert(proof.senseAz?.trim()&&proof.senseEn?.trim());
 assert(!/[\u0400-\u04ff]/u.test(proof.senseAz+proof.senseEn),'Only AZ/EN relationship explanations');
 const k=key(a,b,t),opposite=semantics.get(pair(a,b));
 if(blocked.has(k)||(opposite&&['syn','ant'].includes(t)&&opposite!==t)){omitted.push({a,b,type:t,reason:'Conflicts with an existing reviewed semantic relation.'});return;}
 if(['syn','ant'].includes(t))semantics.set(pair(a,b),t);
 if(!newKeys.has(k)){overlay.edges.push([a,b,t,'Məna və mənbə üzrə yoxlanmış əlaqə']);newKeys.add(k);}
 (overlay.evidence[k]??=[]).push({...proof,from:proof.from||a,head:proof.head||a,edition:proof.edition||'en',scope:proof.scope||'sense-audit',language:'az',tags:proof.tags||[]});
}
function definitionProof(r){return {senseAz:r.sense_az,senseEn:r.sense_en,refs:sourceRefs(r.a,r.b),qualifierAz:'Bu mənada; başqa işlənmələrdə məna fərqlənə bilər.',qualifierEn:'For this sense; meanings can differ in other uses.',reviewReason:r.reason_en};}
// Exact definition references are research candidates, never sufficient evidence by themselves.
const definitionCandidates=[];
for(const n of before.nodes){const b=n.az.trim().replace(/\.+$/,'');if(b!==n.w&&before.byWord.has(b)&&!oldKeys.has(key(n.w,b,'syn')))definitionCandidates.push({a:n.w,b});}
const split=s=>s.toLowerCase().split(/[;,]/).map(x=>x.trim().replace(/\.+$/,'')).filter(Boolean);
const corroborated=definitionCandidates.filter(r=>{const a=before.byWord.get(r.a),b=before.byWord.get(r.b);return a.pos===b.pos&&split(a.en).some(x=>split(b.en).includes(x));});
const expected=new Set(corroborated.map(r=>r.a+'|'+r.b));assert.equal(expected.size,860);assert.equal(reviews.length,860);assert.equal(new Set(reviews.map(r=>r.a+'|'+r.b)).size,860);
for(const r of reviews){assert(expected.has(r.a+'|'+r.b));assert(['syn','hold'].includes(r.decision));if(r.decision==='syn')add(r.a,r.b,'syn',definitionProof(r));}
for(const r of sourceReview.decisions){
 const f=(r.dataset==='etymology'?etym:explicit)[r.index];assert.equal(r.a,f.a);assert.equal(r.b,f.b);if(r.decision==='hold')continue;
 const t=r.decision,from=r.dataset==='etymology'?f.b:f.a;
 let senseAz=r.sense_az,senseEn=r.sense_en;
 if(t==='root'){
  const base=r.dataset==='etymology'?f.b:f.a,derived=r.dataset==='etymology'?f.a:f.b;
  senseAz=`«${derived}» sözünün quruluşu «${base}» ilə bağlıdır; lüğətdə kök və ya tərkib hissəsi kimi göstərilir.`;
  senseEn=`The formation of “${derived}” is linked to “${base}”, documented as a lexical base or component.`;
 }
 add(f.a,f.b,t,{senseAz,senseEn,from,head:f.head,edition:f.edition,scope:'source-audit',refs:[{edition:f.edition,head:f.head}],sourceField:f.field||'etymology',sourceId:f.source_id,reviewReason:r.reason_en});
}
// Explicit, authored contrasts and corrections take precedence over generated candidate explanations.
for(const r of manual.relations){
 const k=key(r.a,r.b,r.type);add(r.a,r.b,r.type,{...definitionProof(r),scope:'reviewed'});
 if(r.a==='şallaq'&&r.b==='qamçı')overlay.evidence[k].at(-1).refs=[{edition:'tr',head:'şallaq'},{edition:'tr',head:'qamçı'},{edition:'en',head:'qamçı'}];
}
for(const r of manual.definitions){assert(before.byWord.has(r.word));overlay.overrides[r.word]={az:r.az,en:r.en,bilingualMethod:'edited',definitionReview:true,bilingualSenses:[{az:r.az,en:r.en},...(r.extra_senses||[])]};}
const after=createModel(...args,overlay),finalKeys=new Set(after.edges.map(edgeKey)),added=after.edges.filter(e=>!oldKeys.has(edgeKey(e))),removed=before.edges.filter(e=>!finalKeys.has(edgeKey(e)));
// The sole permissible removal is a redundant yellow topic link upgraded to a precise relation.
for(const e of removed)assert(e.type==='topic'&&after.edges.some(x=>pair(x.a.w,x.b.w)===pair(e.a.w,e.b.w)&&x.type!=='topic'));
assert.equal(after.nodes.length,before.nodes.length);assert.equal(after.nodes.map(n=>n.w).join('|'),before.nodes.map(n=>n.w).join('|'));
const isolated=m=>m.nodes.filter(n=>!m.related(n).length).length,counts={};for(const e of added)counts[e.type]=(counts[e.type]||0)+1;
const hashes={};for(const f of [...files,'galaxy-data','learning-data'])hashes[f+'.js']=crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,f+'.js'))).digest('hex');
overlay.meta={method:'AI-assisted, sense-specific editorial review of exact definition references and explicit dictionary evidence. Not a professional lexicographic review.',headwords:after.nodes.length,definitions_scanned:before.nodes.length,definition_reference_candidates:definitionCandidates.length,corroborated_candidates_reviewed:reviews.length,accepted_definition_pairs:reviews.filter(r=>r.decision==='syn').length,held_definition_pairs:reviews.filter(r=>r.decision==='hold').length,other_definition_candidates_held:definitionCandidates.length-reviews.length,source_candidates:sourceReview.decisions.length,source_candidates_accepted:sourceReview.decisions.filter(r=>r.decision!=='hold').length,added_relations:added.length,added_by_type:counts,enriched_existing_relations:overlay.edges.filter(e=>oldKeys.has(key(...e))).length,redundant_topic_links_replaced:removed.length,relations_before:before.edges.length,relations_after:after.edges.length,isolated_before:isolated(before),isolated_after:isolated(after),corrected_definitions:Object.keys(overlay.overrides).length,omitted_conflicts:omitted.length};
fs.writeFileSync(path.join(dist,'relations.js'),'/* Reviewed lexical relationships; originals and fixed atlas coordinates are preserved. */\nwindow.WORD_WEB_RELATIONS='+JSON.stringify(overlay)+';\n');
const attribution={...overlay.meta,policy:{symmetry:'Every accepted relation is reciprocal.',synonyms:'Words share the specified sense, not every meaning or every register.',antonyms:'Explicit contrasts in a shared semantic dimension; never propagated through synonym chains.',root:'Documented derivation or lexical component, not matching spelling.',topic:'Inspected type, part, material or subject relation, not synonymy.',closure:'No automatic synonym cliques, transitivity, or inference from a definition alone.',inflection:'No new nodes, conjugations, case forms or plural forms added.',definition_corrections:'31 explicit bilingual editorial overrides; original source records remain unchanged.',scope:'860 candidate pairs and 824 source-relation candidates evaluated; remaining definition matches and loose related-term fields are held, not asserted as synonyms.'},source_snapshots:read('relations/source-snapshots'),preserved_sha256:hashes,license:'Wiktionary / Kaikki source excerpts: CC BY-SA 4.0; generated explanations and decisions are identified as AI-assisted editorial work.',source_facts:{etymology:etym,explicit},definition_decisions:reviews,source_decisions:sourceReview.decisions,manual_review:manual,omitted_conflicts:omitted};
fs.writeFileSync(path.join(dist,'relations-attribution.json'),JSON.stringify(attribution,null,2)+'\n');
console.log(JSON.stringify(overlay.meta,null,2));
