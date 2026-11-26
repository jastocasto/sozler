const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),crypto=require('crypto');
const {createModel}=require('../dist/model.js'),s={window:{}};
for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','verification','galaxy-data'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+f+'.js','utf8'),s);
const w=s.window,args=[w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,w.WORD_WEB_NOMINAL],old=createModel(...args),m=createModel(...args,w.WORD_WEB_ADDITIONS),add=w.WORD_WEB_ADDITIONS;
const excluded=new Set(w.WORD_WEB_VERIFICATION.excluded);
assert.equal(old.nodes.length,19652);assert.equal(add.nodes.length,567);assert.equal(m.nodes.length,20219);assert.equal(new Set(m.nodes.map(n=>n.w)).size,20219);
const known=new Set(old.allNodes.map(n=>n.w.normalize('NFC').toLocaleLowerCase('az'))),newWords=new Set();
for(const row of add.nodes){const n=m.byWord.get(row[0]);assert(n);assert(!known.has(n.w.normalize('NFC').toLocaleLowerCase('az')),n.w);assert(/^[a-zəöüğşçı]+$/u.test(n.w));assert.equal(n.pos,'noun');assert(!n.form&&!n.base);assert(!old.formsByWord.has(n.w),n.w+' must not reintroduce an archived form');assert(n.az.length>18&&n.en.length>15);assert(!/[\u0400-\u04ff]/u.test(n.az+n.en));assert.equal(n.source.attribution,'additions-attribution.json');assert.equal(m.search(n.w,1)[0].w,n.w);assert(m.related(n).some(r=>r.edge.type==='topic'));newWords.add(n.w);}
for(const n of old.nodes)assert.deepEqual(m.byWord.get(n.w),n,'Existing record changed: '+n.w);
// Historical hashes cover source layers. The current learning data has dedicated checks in learning-data.cjs.
for(const [file,hash]of Object.entries(add.meta.preserved_files))if(file!=='learning-data.js')assert.equal(crypto.createHash('sha256').update(fs.readFileSync(__dirname+'/../dist/'+file)).digest('hex'),hash,file+' must remain intact');
const key=e=>[e.a.w,e.b.w,e.type,e.note].join('|'),oldEdges=new Set(old.edges.map(key)),newEdges=new Set(m.edges.map(key));for(const k of oldEdges)assert(newEdges.has(k));for(const e of m.edges)if(!oldEdges.has(key(e))){assert.equal(e.type,'topic');assert(newWords.has(e.a.w)||newWords.has(e.b.w));}
assert.equal(m.edges.length,old.edges.length+567);assert.deepEqual(m.grammarRecords,old.grammarRecords);assert.deepEqual(m.nominalRecords,old.nominalRecords);
const points=new Map(w.WORD_GALAXY_DATA.points.map(p=>[p[0],p])),baseline=JSON.parse(fs.readFileSync(__dirname+'/../scripts/galaxy/layout-base.json','utf8'));
const permanent=require('./atlas-baseline.cjs')(w.WORD_GALAXY_DATA);for(const p of baseline.points)if(!excluded.has(p[0]))assert.deepEqual(Array.from(points.get(p[0])),permanent(p),'Permanent position changed: '+p[0]);
for(const n of add.nodes)assert.equal(points.has(n[0]),!excluded.has(n[0]),n[0]);
const count=JSON.parse(fs.readFileSync(__dirname+'/../dist/word-count.json','utf8'));assert.equal(m.nodes.filter(n=>!n.w.includes(' ')).length,17707);assert.equal(m.nodes.filter(n=>n.w.includes(' ')).length,2512);assert.equal(count.headwords,w.WORD_GALAXY_DATA.points.length+count.orthography_entries);
console.log('PASS: 567 new distinct bilingual headwords, no archived forms or spelling duplicates, valid topic links, unchanged original records/edges/grammar/archives and all 19,652 earlier map coordinates preserved.');
