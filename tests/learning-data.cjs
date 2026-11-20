const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {createModel}=require('../dist/model.js'),{createLearning,dayKey}=require('../dist/learning.js');
const s={window:{}};for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','relations','learning-data'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+f+'.js','utf8'),s);
const w=s.window,m=createModel(w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,w.WORD_WEB_NOMINAL,w.WORD_WEB_ADDITIONS,w.WORD_WEB_RELATIONS),x=w.WORD_WEB_EXPANSION;
const previous=new Set([...w.WORD_WEB_DATA.nodes,...w.WORD_WEB_EXTRA.nodes,...w.WORD_WEB_VOCABULARY.nodes,...w.WORD_WEB_REVIEW.nodes].map(n=>n[0].normalize('NFC').toLocaleLowerCase('az')));
assert(x.nodes.length>=500);assert.equal(x.nodes.length,x.meta.added_entries);assert.equal(new Set(x.nodes.map(n=>n[0].normalize('NFC').toLocaleLowerCase('az'))).size,x.nodes.length);
for(const row of x.nodes){const n=m.byWord.get(row[0]);assert(n);assert(!previous.has(n.w.normalize('NFC').toLocaleLowerCase('az')),n.w+' is not new');assert(n.az.length>18&&n.en.length>15,n.w+' needs substantive definitions');assert(!/[\u0400-\u04ff]/u.test(n.az+n.en));assert.equal(n.source.kind,'editorial');assert(!n.form&&!n.base);if(n.pos==='verb')assert(/(maq|mək)$/.test(n.w)&&!/(mamaq|məmək)$/.test(n.w));assert(m.related(n).some(e=>e.edge.type==='topic'),n.w+' should connect to the web');assert(m.search(n.w,1)[0].w===n.w);}
for(const e of x.edges)assert.equal(e[2],'topic','Editorial topic links must not pretend to be synonyms or roots');
for(const f of ['references','growth','verification','orthography','orthography-lexical','orthography-lexical-evidence'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+f+'.js','utf8'),s);
const full=createModel(w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,w.WORD_WEB_NOMINAL,w.WORD_WEB_ADDITIONS,w.WORD_WEB_RELATIONS,w.WORD_WEB_REFERENCES,w.WORD_WEB_GROWTH,w.WORD_WEB_VERIFICATION,w.WORD_WEB_ORTHOGRAPHY,w.WORD_WEB_ORTHOGRAPHY_LEXICAL);
const learning=createLearning(full,w.WORD_WEB_LEARNING),cycleLength=learning.dailyWords.length;
assert.equal(cycleLength,w.WORD_WEB_LEARNING.dailyWords.length);assert(cycleLength>=200);assert.equal(new Set(learning.dailyWords).size,cycleLength);assert(learning.bank.length>=60);
assert.equal(dayKey(new Date('2026-11-14T19:59:59Z')),'2026-11-14');assert.equal(dayKey(new Date('2026-11-14T20:00:00Z')),'2026-11-15');
assert.equal(dayKey(new Date('2028-02-29T20:00:00Z')),'2028-03-01');
assert.equal(learning.daily(new Date('2026-11-14T01:00Z')).word,learning.daily(new Date('2026-11-14T19:59Z')).word);assert.notEqual(learning.daily(new Date('2026-11-14T19:59Z')).word,learning.daily(new Date('2026-11-14T20:00Z')).word);
const cycle=new Set();for(let day=0;day<cycleLength;day++){const {word}=learning.daily(new Date(Date.UTC(2026,0,1+day)));assert(!word.form&&!word.special&&word.az&&word.en);assert.equal(full.byWord.get(word.w),word);cycle.add(word.w);}
assert.equal(cycle.size,cycleLength);
assert(!['badəm','bədən','alma','ev','su'].some(word=>cycle.has(word)));
assert.equal(learning.daily(new Date('2026-11-19T00:00Z')).word.w,'bədahətən');
for(const q of learning.bank){assert(q.az&&q.en);assert.equal(new Set([q.word,...q.distractors]).size,4);assert(m.byWord.has(q.word));for(const word of q.distractors)assert(m.byWord.has(word));assert(!m.byWord.get(q.word).form);}
for(let i=0;i<50;i++){
 const r=learning.round();assert.equal(r.questions.length,10);assert.equal(new Set(r.questions.map(q=>q.word)).size,10);assert.equal(learning.next(r),false);
 for(let n=0;n<10;n++){const q=r.questions[n];assert.equal(new Set(q.options).size,4);assert(q.options.includes(q.word));assert.equal(learning.answer(r,'not an option'),null);const correct=n%2===0,choice=correct?q.word:q.distractors[0];assert.equal(learning.answer(r,choice).correct,correct);assert.equal(learning.answer(r,choice),null);assert(learning.next(r));}
 assert(r.complete);assert.equal(r.answers.filter(a=>a.correct).length,5);assert.equal(learning.answer(r,r.questions[0].word),null);assert.equal(learning.next(r),false);
 const missed=r.answers.filter(a=>!a.correct).map(a=>a.word),retry=learning.round({words:missed});assert.equal(retry.questions.length,5);assert(retry.questions.every(q=>missed.includes(q.word)));
}
console.log(`PASS: ${x.nodes.length} distinct new bilingual lexical entries with topic connections; ${cycleLength}-day advanced vocabulary rotation on the Baku calendar; ${learning.bank.length} quiz questions, unique options, one answer per question, scores and missed-word retries.`);
