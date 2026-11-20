const fs=require('fs'),vm=require('vm'),path=require('path'),root=path.join(__dirname,'../dist'),context={window:{}};
for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','relations','model'])vm.runInNewContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),context);
const w=context.window,m=w.WordWeb.createModel(w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,w.WORD_WEB_NOMINAL,w.WORD_WEB_ADDITIONS,w.WORD_WEB_RELATIONS);
const verbs=m.nodes.filter(n=>n.pos==='verb'&&/(maq|mək)$/.test(n.w)&&n.quality!=='generated').map(n=>({w:n.w,az:n.az,en:n.en,source:n.source}));
if(require.main===module)process.stdout.write(JSON.stringify(verbs));else module.exports=verbs;
