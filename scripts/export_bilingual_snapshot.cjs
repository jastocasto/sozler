// Export unlocalized source senses for the translation build, never the UI overlay.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),{createModel}=require('../dist/model.js'),s={window:{}};
for(const f of ['data','lexicon','grammar','vocabulary','review','expansion'])vm.runInNewContext(fs.readFileSync(path.join(root,'dist',f+'.js'),'utf8'),s);
const w=s.window,m=createModel(w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,null,w.WORD_WEB_EXPANSION);
if(!process.argv[2])throw new Error('Pass an output JSON path.');
fs.writeFileSync(process.argv[2],JSON.stringify({nodes:m.allNodes,main:m.nodes,grammar:m.grammarRecords,evidence:w.WORD_WEB_REVIEW.evidence}));
console.log(`Exported ${m.nodes.length} main entries and ${m.grammarRecords.length} grammar records.`);
