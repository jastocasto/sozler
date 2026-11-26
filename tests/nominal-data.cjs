const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),crypto=require('crypto');
const {createModel}=require('../dist/model.js');
const s={window:{}};for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','relations'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+f+'.js','utf8'),s);
const w=s.window,x=w.WORD_WEB_NOMINAL,m=createModel(w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,x,w.WORD_WEB_ADDITIONS,w.WORD_WEB_RELATIONS);
assert.equal(m.nodes.length,20219);assert.equal(m.nodes.filter(n=>!n.w.includes(' ')).length,17707);assert.equal(m.nodes.filter(n=>n.w.includes(' ')).length,2512);
assert.equal(x.excluded.length,21092);assert.equal(m.nominalRecords.length,21145);assert.equal(new Set(m.nominalRecords.map(f=>f.w)).size,21141);
assert.equal(x.meta.before_main_entries-x.excluded.length-Object.keys(x.aliases).length+w.WORD_WEB_ADDITIONS.nodes.length,m.nodes.length);
assert.equal(m.allNodes.length,41851);assert.equal(m.grammarRecords.length,991);
const archived=new Set(m.nominalRecords.map(f=>f.w));
for(const word of x.excluded){assert(!m.byWord.has(word),word+' excluded from web');assert(m.allByWord.has(word),word+' source preserved');assert(archived.has(word),word+' archived');}
for(const f of m.nominalRecords){assert(f.base&&f.lemma);assert(f.az&&f.en);assert(f.analyses.length);for(const a of f.analyses){assert(a.az?.trim()&&a.en?.trim());assert(!/[\u0400-\u04ff]/u.test(a.az+a.en));}assert.equal(m.archiveMode(f.w),'forms');}
for(const n of m.nodes){assert.notEqual(n.pos,'form',n.w);assert(!n.form,n.w+' remaining grammatical form');}
for(const [word,base] of [['otaqda','otaq'],['otaqdan','otaq'],['otaqlar','otaq'],['bunun','bu'],['ona','o'],['nəyi','nə'],['onlar','o'],['bunlar','bu'],['özləri','öz'],['təbriklər','təbrik'],['ziyalılar','ziyalı']]){assert(!m.byWord.has(word),word);assert.equal(m.resolveWord(word)?.w,base,word);assert(m.nominalSearch(word).some(f=>f.w===word));assert(!m.search(word,100).some(n=>n.w===word));}
for(const word of ['kitabça','müəllimə','qapqara','gözlük','yaxşılıq','eləmək','elətdirmək','qılınmaq','dollar','çalar','ağlar','verilənlər'])assert(m.byWord.has(word),word+' is a lexical word, not suffix-stripped');
for(const [word,sense] of [['ölüm','death'],['sənə','year'],['məni','sperm'],['onda','then']]){const n=m.byWord.get(word);assert(n,n);assert(n.en.toLowerCase().includes(sense),word+' lexical sense retained');assert(!/dative of|genitive of|accusative of|locative of|possessive of/.test(n.en));assert(m.nominalRecords.some(f=>f.w===word));}
assert(!m.related(m.byWord.get('sənə')).some(r=>r.node.w==='sən'&&r.edge.note.startsWith('Lüğətdə göstərilmiş söz forması')),'The retained year sense must not inherit a case link to the pronoun');
assert.equal(m.byWord.get('onsuz').pos,'postposition');assert(m.byWord.get('onsuz').en.includes('Without'));assert(!m.nominalRecords.some(f=>f.w==='onsuz'));
for(const [alias,canonical]of Object.entries(x.aliases)){assert(m.allByWord.has(alias));assert(!m.byWord.has(alias));assert.equal(m.resolveWord(alias)?.w,canonical);}
for(const word of ['Çin','çin','Asi','asi','Sarvan','sarvan'])assert(m.byWord.has(word),'Case-distinct homonyms retained: '+word);
for(const e of m.edges)assert(m.byWord.has(e.a.w)&&m.byWord.has(e.b.w));
// Historical hashes cover source layers. The current learning data has dedicated checks in learning-data.cjs.
for(const [file,hash]of Object.entries(x.meta.preserved_files))if(file!=='learning-data.js')assert.equal(crypto.createHash('sha256').update(fs.readFileSync(__dirname+'/../dist/'+file)).digest('hex'),hash,file+' unchanged');
const archive=JSON.parse(fs.readFileSync(__dirname+'/../dist/nominal-archive.json','utf8')),original=new Set(archive.originalNodes.map(n=>n.w));
for(const word of archived)assert(original.has(word),word+' original exported');assert(archive.originalEdges.length>0);assert.equal(archive.records.length,m.nominalRecords.length);
const count=JSON.parse(fs.readFileSync(__dirname+'/../dist/word-count.json','utf8'));assert.equal(count.archived_records,m.nominalRecords.length);
console.log('PASS: 17,707 single words + 2,512 multiword entries; 21,092 removed forms preserved with bilingual analyses; no main inflections; lexical derivatives, homonyms, aliases, source hashes, archive, base routing and valid edges.');
