const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const {createModel}=require('../dist/model.js'),s={window:{}},dir=path.join(__dirname,'../dist');
for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','relations'])vm.runInNewContext(fs.readFileSync(path.join(dir,f+'.js'),'utf8'),s);
const w=s.window,args=[w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,w.WORD_WEB_NOMINAL,w.WORD_WEB_ADDITIONS],old=createModel(...args),m=createModel(...args,w.WORD_WEB_RELATIONS),r=w.WORD_WEB_RELATIONS;
const edge=(a,b,t)=>m.related(m.byWord.get(a)).find(x=>x.node.w===b&&x.edge.type===t)?.edge;
for(const [a,b]of [['şallaq','qamçı'],['camal','gözəllik'],['dokument','sənəd']]){assert(edge(a,b,'syn'));assert.equal(edge(a,b,'syn'),edge(b,a,'syn'));}
assert(edge('dokument','sənəd','syn'));assert(edge('xürdəbin','mikroskop','syn'));
for(const [a,b]of [['şallaq','qamçı'],['miz','masa'],['çibin','milçək'],['sap','ip']]){const p=m.connectionInfo(edge(a,b,'syn'),a);assert(p.sense&&p.senseEnglish);assert.equal(p.language,'az');assert(p.refs.length);}
const whip=m.connectionInfo(edge('şallaq','qamçı','syn'),'şallaq');assert(whip.refs.some(p=>p.edition==='tr'&&p.head==='qamçı'));assert(whip.senseEnglish.includes('whip'));
// Same translated token does not imply the same thing. These were audited and withheld.
for(const [a,b]of [['miz','cədvəl'],['artikl','məqalə'],['çibin','uçmaq'],['general','ümumi'],['dəyənək','heyət'],['ban','qarğa'],['xatın','cücə'],['ağacqurdu','odunçu'],['fəndgir','kassir'],['küncüd','künc'],['xaya','kənd'],['quzğun','qarğa'],['buğa','öküz']])assert(!edge(a,b,'syn'),a+' / '+b+' false synonym');
assert(edge('etibarlı','etibarsız','ant'));assert(!edge('etibarlı','etibarsız','syn'));assert(edge('itaətli','itaətsiz','ant'));
assert(edge('yanacaq','yanmaq','root'));assert(edge('beysbolçu','beysbol','root'));assert(!edge('kəndirbaz','baz','root'));assert(!edge('süzgəc','gəc','root'));assert(!edge('titrəmək','titrləmə','root'));
assert(edge('begemot','məməli','topic'));assert(!edge('begemot','amfibiya','topic'));assert(!edge('begemot','məməli','syn'));
for(const n of ['şallaq','qamçı','general','sap','artikl','çibin','küncüd','xaya']){const a=m.byWord.get(n);assert(a.definitionReview);assert.equal(a.bilingualMethod,'edited');assert(a.az&&a.en);}
assert(m.byWord.get('general').en.includes('military'));assert(m.byWord.get('artikl').en.includes('grammatical'));assert(m.byWord.get('küncüd').en.includes('Sesame'));assert(m.byWord.get('xaya').en.includes('testicle'));
assert(m.search('wood-boring').some(n=>n.w==='ağacqurdu'));assert(!m.byWord.get('fəndgir').english.includes('cashier'));
for(const e of m.edges){assert(edge(e.a.w,e.b.w,e.type)===e);assert(edge(e.b.w,e.a.w,e.type)===e);if(['syn','ant'].includes(e.type))assert(!edge(e.a.w,e.b.w,e.type==='syn'?'ant':'syn'));}
for(const [a,b,t]of r.edges){const e=edge(a,b,t);if(!e){assert(t==='topic'&&m.related(m.byWord.get(a)).some(x=>x.node.w===b&&x.edge.type!=='topic'));continue;}const p=m.connectionInfo(e,a);assert(p.sense&&p.senseEnglish&&p.refs?.length);assert(!/[\u0400-\u04ff]/u.test(p.sense+p.senseEnglish));}
assert.deepEqual(m.nodes.map(n=>[n.id,n.w]),old.nodes.map(n=>[n.id,n.w]));assert.equal(m.grammarRecords.length,991);assert.equal(m.nominalRecords.length,21145);for(const x of ['elədi','eləyib','otaqda','otaqdan','otaqlar'])assert(!m.byWord.has(x));
// The expanded learning data and repacked atlas have separate tests for their current contents.
const audit=JSON.parse(fs.readFileSync(path.join(dir,'relations-attribution.json')));for(const [f,hash]of Object.entries(audit.preserved_sha256))if(f!=='learning-data.js'&&f!=='galaxy-data.js')assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,f))).digest('hex'),hash,f+' must be preserved');
assert.equal(audit.definitions_scanned,20219);assert.equal(audit.corroborated_candidates_reviewed,860);assert.equal(audit.isolated_before-audit.isolated_after,old.nodes.filter(n=>!old.related(n).length).length-m.nodes.filter(n=>!m.related(n).length).length);
console.log(`PASS: ${audit.added_relations} new source/sense-supported relations; reciprocal whip synonyms, polysemy traps held, explicit opposites, documented roots, correct topic classification, bilingual corrections, unchanged IDs/coordinates/archives and ${audit.isolated_before-audit.isolated_after} formerly isolated words connected.`);
