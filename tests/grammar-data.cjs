const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),crypto=require('crypto');
const {createModel}=require('../dist/model.js'),{describeWord}=require('../dist/word-info.js');
const s={window:{}};for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','relations'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+f+'.js','utf8'),s);
const w=s.window,g=w.WORD_WEB_GRAMMAR,v=w.WORD_WEB_VOCABULARY,m=createModel(w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,g,v,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,w.WORD_WEB_NOMINAL,w.WORD_WEB_ADDITIONS,w.WORD_WEB_RELATIONS);
for(const [file,hash]of Object.entries(g.meta.preserved_files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(__dirname+'/../dist/'+file)).digest('hex'),hash,'Original data bytes must survive');
assert.equal(m.allNodes.length,32659+6744+w.WORD_WEB_REVIEW.nodes.length+w.WORD_WEB_EXPANSION.nodes.length+w.WORD_WEB_ADDITIONS.nodes.length);assert.equal(v.nodes.length,6744);assert.equal(new Set(m.allNodes.map(n=>n.w)).size,m.allNodes.length);
const originalWords=new Set([...w.WORD_WEB_DATA.nodes,...w.WORD_WEB_EXTRA.nodes].map(n=>n[0]));
for(const n of v.nodes){assert(!originalWords.has(n[0]));assert(!n[5]&&!n[6],'New vocabulary cannot be generated forms');if(n[3]==='verb')assert(/(maq|mək)$/.test(n[0]));}
for(const word of ['elədi','eləyir','eləyib','eləmişdi','yazdı','gedir','idi','istiir','alırsız','olmamaq']){
 assert(!m.byWord.has(word),word+' must not be a main bubble');assert(m.formsByWord.has(word),word+' must remain in Grammar');assert(!m.search(word,100).some(n=>n.w===word));
}
for(const word of ['eləmək','etmək','elətdirmək','etdirmək','alınmaq','qılınmaq'])assert.equal(m.byWord.get(word)?.pos,'verb',word+' remains a base verb');
for(const n of m.nodes)if(n.pos==='verb')assert(/(maq|mək)$/.test(n.w),n.w+' is not an infinitive');
for(const [word,pos,sense]of [['pozan','noun','eraser'],['yanacaq','noun','fuel'],['gələn','determiner','next'],['oturub-durub','adverb','always']]){
 const n=m.byWord.get(word);assert.equal(n.pos,pos);assert(n.en.toLowerCase().includes(sense));assert(!/participle of|converb of/.test(n.en));assert(m.formsByWord.has(word));
}
for(const word of ['kitablar','analar','atalar']){assert(!m.byWord.has(word));assert(m.nominalSearch(word).some(f=>f.w===word),'Nominal forms preserved in Forms: '+word);}
assert.equal(m.resolveWord('elədi').w,'eləmək');assert.equal(m.resolveWord('istiir').w,'istəmək');
assert(m.grammarSearch('eleyib').some(n=>n.w==='eləyib'));assert.equal(m.grammarSearch('eləmək')[0].base,'eləmək');assert(m.grammarSearch('eləmək').some(n=>n.w==='eləyib')); 
for(const e of m.edges)assert(m.byWord.has(e.a.w)&&m.byWord.has(e.b.w));
for(const n of m.nodes.filter(n=>n.pos==='verb'))assert(m.related(n).every(r=>!g.excluded.includes(r.node.w)));
for(const lang of ['tr','ru']){const n=m.nodes.find(n=>n.source?.language===lang);assert.equal(describeWord(n,m.byWord).definitionLanguage,'az');assert(n.source.edition===lang);}
const archive=JSON.parse(fs.readFileSync(__dirname+'/../dist/grammar-archive.json','utf8'));for(const word of g.excluded)assert(archive.originalNodes.some(n=>n[0]===word),word+' original record exported');assert(archive.originalEdges.length>0);assert.equal(archive.records.length,m.grammarRecords.length);
console.log(`PASS: ${m.nodes.length} main entries, ${m.grammarRecords.length} preserved verb–form records, ${g.excluded.length} moved entries, 6744 distinct new headwords; no finite verbs, no deleted data, homonyms/derived verbs/nominal forms preserved, aliases and archive export.`);
