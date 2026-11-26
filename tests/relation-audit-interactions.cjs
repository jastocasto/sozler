const assert=require('node:assert/strict'),{boot}=require('./galaxy-harness.cjs');
for(const [width,height]of [[390,844],[1440,900]]){
 // Relation evidence and both navigation directions must also work without animation.
 const h=boot({width,height,reduced:true,hash:'#w='+encodeURIComponent('şallaq')}),{$,window,pointer,input}=h,inspect=()=>window.SozApp.inspect();
 const map=JSON.stringify(window.WORD_GALAXY_DATA.points);
 function geometry(){require('./assert-web-geometry.cjs')(inspect());}
 function green(word){const g=window.document.querySelector('[data-word="'+word+'"]');assert(g,word+' visible');assert.equal(g.getAttribute('data-type'),'syn');assert.equal(g.querySelector('.bubble').getAttribute('fill'),'#58c978');return g;}
 function settle(){h.runUntilIdle(geometry);assert(inspect().atlasLines.length>0);}
 settle();assert.equal($('meaningWord').textContent,'şallaq');assert($('meaningDefinition').textContent.includes('qamçı'));assert($('meaningEnglish').textContent.includes('whip'));
 const target=green('qamçı'),p=inspect().particles.find(p=>p.word==='qamçı');pointer('pointerdown',1,p.x,p.y,target);pointer('pointerup',1,p.x,p.y);settle();assert.equal($('meaningWord').textContent,'qamçı');green('şallaq');assert.equal($('meaningContext').querySelector('.relation-sense').lang,'az');assert.equal($('meaningContext').querySelector('.relation-sense-en').lang,'en');assert($('meaningContext').textContent.includes('whip'));assert.equal($('meaningContext').querySelectorAll('.relation-source').length,3);
 // Returning via the sheet uses the same reciprocal edge and source sense.
 [...window.document.querySelectorAll('.connection-group[data-type="syn"] button')].find(b=>b.textContent==='şallaq').click();settle();green('qamçı');
 $('filters').querySelector('[data-type="syn"]').click();settle();assert(!inspect().particles.some(p=>p.word==='qamçı'));$('resetFilters').click();settle();green('qamçı');
 input('search','qamçı');$('searchResults').firstElementChild.click();settle();assert.equal(inspect().selected,'qamçı');green('şallaq');
 // A newly denser synonym family must retain all its neighbors, colors and collision separation.
 window.SozApp.selectWord('bədbəxt');settle();const expected=new Set(inspect().relatedWords),seen=new Set();assert(expected.has('başıküllü'));
 for(const p of inspect().particles)if(p.word!=='bədbəxt')seen.add(p.word);
 assert($('connectionPager').hidden);assert.equal(inspect().connectionPages,1);
 assert.deepEqual([...seen].sort(),[...expected].sort());
 window.SozApp.selectWord('general');assert($('meaningDefinition').textContent.includes('zabit'));assert($('meaningEnglish').textContent.includes('military'));assert($('meaningSource').textContent.includes('dəqiqləşdirilməsi'));
 assert.equal(JSON.stringify(window.WORD_GALAXY_DATA.points),map);assert.equal(h.errors.length,0);
 console.log(`PASS: ${width}×${height}: şallaq/qamçı green bubbles, reciprocal tap/chip/search navigation, AZ/EN sense and three source links, filters, whole-family gathering, corrections and fixed coordinates.`);
}
