const fs=require('fs'),vm=require('vm'),path=require('path'),dist=path.join(__dirname,'../dist'),s={window:{}};for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','relations','references','growth','verification',...(process.argv.includes('--with-orthography')?['orthography']:[])])if(!(process.argv.includes('--base')&&['growth','verification'].includes(f))&&!(process.argv.includes('--without-verification')&&f==='verification')&&fs.existsSync(path.join(dist,f+'.js')))vm.runInNewContext(fs.readFileSync(path.join(dist,f+'.js'),'utf8'),s);const w=s.window,m=require('../dist/model.js').createModel(w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,w.WORD_WEB_NOMINAL,w.WORD_WEB_ADDITIONS,w.WORD_WEB_RELATIONS,w.WORD_WEB_REFERENCES,w.WORD_WEB_GROWTH,w.WORD_WEB_VERIFICATION,w.WORD_WEB_ORTHOGRAPHY);const withOrthography=process.argv.includes('--with-orthography');
const nodes=withOrthography?withVerbForms(m.nodes):m.nodes;
function withVerbForms(entries){
 const english={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(dist,'conjugation-english-data.js'),'utf8'),english);
 const profiles=english.window.CONJUGATION_ENGLISH_DATA;
 const {principal,baseFromGloss}=require('../dist/conjugation-english.js');
 const review=JSON.parse(fs.readFileSync(path.join(__dirname,'content/orthography-link-review.json'),'utf8')).family_review?.definitions||{};
 return entries.map(node=>{
  const reviewed=review[node.w];
  if(node.pos!=='verb'&&reviewed?.pos!=='verb')return node;
  const phrase=baseFromGloss(reviewed?.pos==='verb'?reviewed.en:node.en)||profiles[node.w]?.base;
  if(!phrase)return node;
  const verb=principal(phrase);
  return verb?{...node,verbForms:{base:verb.base,ing:verb.ing,participle:verb.participle}}:node;
 });
}
fs.writeFileSync(process.argv[2],JSON.stringify({nodes,edges:m.edges.map(e=>[e.a.w,e.b.w,e.type,e.note]),excluded:[...m.allByWord.keys()].filter(w=>!m.byWord.has(w)),aliases:m.aliases,...(process.argv.includes('--with-orthography')?{blocked_edges:[w.WORD_WEB_REVIEW,w.WORD_WEB_RELATIONS,w.WORD_WEB_GROWTH,w.WORD_WEB_VERIFICATION].flatMap(layer=>layer?.blocked||[])}:{})}));console.log(m.nodes.length,m.edges.length);
