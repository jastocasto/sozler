const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),s={window:{}};
for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','relations','references','verification','galaxy-data'])vm.runInNewContext(fs.readFileSync('dist/'+f+'.js','utf8'),s);
const w=s.window,args=[w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,w.WORD_WEB_NOMINAL,w.WORD_WEB_ADDITIONS,w.WORD_WEB_RELATIONS],{createModel}=require('../dist/model.js'),before=createModel(...args),m=createModel(...args,w.WORD_WEB_REFERENCES),positions=new Map(w.WORD_GALAXY_DATA.points.map(p=>[p[0],p]));
const excluded=new Set(w.WORD_WEB_VERIFICATION.excluded);
assert.equal(m.nodes.length,before.nodes.length+1372);for(const word of m.byWord.keys())assert.equal(positions.has(word),!excluded.has(word),word);
for(const row of w.WORD_WEB_REFERENCES.nodes){const n=m.byWord.get(row[0]);assert(n&&n.az&&n.en);assert(!/[\u0400-\u04ff]/.test(n.az+n.en));assert(m.related(n).length,n.w);assert.equal(positions.has(n.w),!excluded.has(n.w),n.w);assert(!m.formsByWord.has(n.w));if(n.pos==='verb')assert(/m[əa]k$|maq$/.test(n.w));}
for(const term of ['nazil etmək','nazil olmaq']){const n=m.byWord.get(term);assert(n);assert(m.related(n).some(r=>r.node.w==='nazil'));assert(m.search(term,1)[0].w===term);}
const old=JSON.parse(fs.readFileSync('scripts/galaxy/layout-base.json','utf8'));const permanent=require('./atlas-baseline.cjs')(w.WORD_GALAXY_DATA);for(const p of old.points)if(!excluded.has(p[0]))assert.deepEqual(Array.from(positions.get(p[0])),permanent(p));
for(const n of before.nodes)assert.deepEqual(m.byWord.get(n.w),n);
console.log('PASS: 1,372 bilingual referenced entries, reciprocal connections, exact search, no archived inflections, all old definitions and 20,219 coordinates preserved.');
