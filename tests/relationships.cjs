const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {createModel}=require('../dist/model.js');
const s={window:{}};for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','relations'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+f+'.js','utf8'),s);
const w=s.window,r=w.WORD_WEB_REVIEW,m=createModel(w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,r,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,w.WORD_WEB_NOMINAL,w.WORD_WEB_ADDITIONS,w.WORD_WEB_RELATIONS);
const relation=(a,b,t)=>m.related(m.byWord.get(a)).find(x=>x.node.w===b&&x.edge.type===t);
for(const e of m.edges){assert(m.related(e.a).some(x=>x.node===e.b&&x.edge===e));assert(m.related(e.b).some(x=>x.node===e.a&&x.edge===e),'Each direct edge must be reciprocal');}
const types=new Map();for(const e of m.edges.filter(e=>['syn','ant'].includes(e.type))){const k=[e.a.w,e.b.w].sort().join('|');assert(!types.has(k)||types.get(k)===e.type,'No unreviewed synonym/antonym contradiction: '+k);types.set(k,e.type);}
for(const a of r.meta.reviewed_time_group)for(const b of r.meta.reviewed_time_group)if(a!==b){assert(relation(a,b,'syn'),a+'/'+b);assert.equal(m.connectionInfo(relation(a,b,'syn').edge,a).scope,'reviewed');}
for(const a of r.meta.reviewed_time_group){assert(relation(a,'heç vaxt','ant'));assert(relation(a,'heç zaman','ant'));}
for(const [a,b,t]of [['nazik','qalın','ant'],['səadət','bədbəxtlik','ant'],['dar','enli','ant'],['izah etmək','açıqlamaq','syn'],['çoxdanışan','dinməz','ant']]){assert(relation(a,b,t));assert(!relation(a,b,t==='syn'?'ant':'syn'));}
assert.equal(m.byWord.get('həmişə').pos,'adverb');assert.equal(m.byWord.get('daima').pos,'adverb');
const contextual=relation('kök','dolğun','syn');assert(contextual);const proof=m.connectionInfo(contextual.edge,'kök');assert(proof&&proof.sense);assert(!/root \(of/.test(proof.sense),'The fat/thick sense must not be mislabeled as the plant root');
// Synonym symmetry is required; transitive and antonym propagation are forbidden.
const small=createModel({nodes:['a','b','c','d'].map(w=>[w,w,'','noun','','','','curated']),edges:[['a','b','syn','sense 1'],['b','c','syn','sense 2'],['a','d','ant','opposite in sense 1']]});
assert(small.related(small.byWord.get('b')).some(x=>x.node.w==='a'));
assert(!small.related(small.byWord.get('a')).some(x=>x.node.w==='c'));
assert(!small.related(small.byWord.get('b')).some(x=>x.node.w==='d'));
assert.equal(r.nodes.length,1086);const oldWords=new Set(m.allNodes.slice(0,39403).map(n=>n.w));
for(const n of r.nodes){assert(!oldWords.has(n[0]));assert(!n[6]);assert(n[8].head&&n[8].senses.length);if(n[3]==='verb')assert(/(maq|mək)$/.test(n[0])&&!/(mamaq|məmək)$/.test(n[0]));}
for(const n of m.nodes)if(n.pos==='verb')assert(/(maq|mək)$/.test(n.w));
assert(m.byWord.has('verilənlər bazası'));assert(m.byWord.has('bel bağlamaq'));assert(!m.byWord.has('elədi'));assert(m.formsByWord.has('elədi'));
console.log(`PASS: ${m.edges.length} reciprocal links; no contradictory synonym/antonym pairs, 11 reviewed corrections, consistent temporal-sense family, sense provenance, no inferred transitivity, 1086 new lexical entries and intact grammar separation.`);
