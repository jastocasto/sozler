const assert=require('node:assert/strict'),{boot}=require('./galaxy-harness.cjs'),geometry=require('./assert-web-geometry.cjs');
for(const[width,height]of[[320,568],[390,674],[844,390],[1440,900]]){
 const h=boot({width,height}),s=()=>h.window.SozApp.inspect();h.window.SozApp.selectWord('nida');h.runFrames(320);geometry(s());assert(s().settled);const r=s().particles[0].visualRadius;assert(r<=(width<640?31:37));
 h.$('zoomIn').click();h.runFrames(320);geometry(s());const large=s().particles[0].visualRadius;assert(Math.abs(large/r-1.8)<.01);h.$('zoomOut').click();h.runFrames(320);geometry(s());assert(Math.abs(s().particles[0].visualRadius-r)<.01);h.$('fitButton').click();h.runFrames(320);geometry(s());assert(Math.abs(s().particles[0].visualRadius-r)<.01);
 h.window.SozApp.selectWord('nazil');h.runFrames(320);geometry(s());assert(s().relatedWords.includes('nazil etmək'));assert(s().relatedWords.includes('nazil olmaq'));
 h.window.SozApp.selectWord('nazil etmək');h.runFrames(320);geometry(s());assert(h.$('meaningEnglish').textContent.includes('reveal'));assert.equal(h.errors.length,0);console.log(`PASS: ${width}×${height}: compact selection, proportional zoom in/out/reset, no overlaps, and connected nazil expressions with their own definitions.`);
}
