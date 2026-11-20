// Export the pre-separation view, retaining the earlier verb archive and all source rows.
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..'),s={window:{}},{createModel}=require('../dist/model.js');
for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion'])vm.runInNewContext(fs.readFileSync(path.join(root,'dist',f+'.js'),'utf8'),s);
const w=s.window,m=createModel(w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION);
if(!process.argv[2])throw Error('Pass an output file.');
fs.writeFileSync(process.argv[2],JSON.stringify({nodes:m.nodes,raw:m.allNodes,edges:m.allEdges}));
console.log(`Exported ${m.nodes.length} pre-separation entries.`);
