const assert=require('node:assert/strict'),{boot}=require('./galaxy-harness.cjs'),geometry=require('./assert-web-geometry.cjs');
for(const[width,height]of[[320,568],[390,674],[844,390]]){
 const h=boot({width,height}),s=()=>h.window.SozApp.inspect(),word=[...h.window.WORD_CONJUGATIONS.order].filter(w=>!w.includes(' ')).sort((a,b)=>b.length-a.length)[0];
 h.window.SozApp.selectWord(word);assert.equal(s().selected,word);h.runFrames(250,()=>geometry(s()));assert(s().settled);assert.equal(s().focusCenter.r,width<640?30:height<500?27:36);const node=h.window.document.querySelector('.word-node.selected');assert.equal(node.querySelectorAll('tspan').length,1);assert.equal(node.querySelector('tspan').textContent,word);assert.equal(h.$('meaningWord').textContent,word);console.log(`PASS: ${width}×${height}: ${word} stays complete in a standard-sized selected circle and its definition title.`);
}
