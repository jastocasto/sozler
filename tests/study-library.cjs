const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');
const {fetchJSON}=require('./layers.cjs');
const WordWeb=require('../dist/model.js');
const Study=require('../dist/study-model.js');

const model=WordWeb.restoreModel(fetchJSON('soz-core.json'),{fetchJSON});
const {window}=parseHTML('<main id="view"></main>');
window.WordWeb=WordWeb;
window.SozStudyContent=[{id:'why-it-happened',skill:'Giving a reason'}];
const host=window.document.getElementById('view');
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/study-library.js'),'utf8'),{window,clearTimeout,setTimeout,URL});
const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
let when=Date.parse('2026-11-26T19:59:00Z');
const createStudy=()=>Study.create({storage,now:()=>when,validWord:w=>model.byWord.has(w)});
const study=createStudy(),actions=[];
const mount=store=>window.SozStudyLibrary.mount({host,study:store,model,
 openWord:w=>actions.push(['map',w]),practiceWord:w=>actions.push(['practice',w]),
 savedWords:()=>new Set(['gözəl','eşitmək']),onChange:()=>actions.push(['change'])});
const ui=mount(study);
const one=s=>host.querySelector(s),all=s=>[...host.querySelectorAll(s)];
const click=(label,scope=host)=>{const b=[...scope.querySelectorAll('button')].find(b=>b.textContent===label);assert(b,label);b.click();};
function select(control,value){
 for(const o of control.querySelectorAll('option'))if(o.value!==String(value))o.selected=false;
 control.querySelector('option[value="'+value+'"]').selected=true;
 control.dispatchEvent(new window.Event('change',{bubbles:true}));
}
function search(text){
 const input=one('input[type="search"]');
 input.value=text;input.dispatchEvent(new window.Event('input'));
 const key=new window.Event('keydown');key.key='Enter';input.dispatchEvent(key);
}
const row=w=>all('.study-word-row').find(el=>el.dataset.word===w);

ui.library();
assert.equal(study.words().length,0);
click('Find a word');
assert.equal(all('.study-word-row').length,2);
click('Add to library',row('gözəl'));
assert.equal(study.word('gözəl').rating,null,'A bookmark can be collected without assigning knowledge');
search('guzel');
assert.equal(all('.study-word-row')[0].dataset.word,'gözəl','The same atlas alias resolves to the canonical headword');
select(row('gözəl').querySelector('select'),'3');
assert.equal(study.word('gözəl').rating,3);
click('Practice',row('gözəl'));click('gözəl',row('gözəl'));
assert.deepEqual(actions.slice(-2),[['practice','gözəl'],['map','gözəl']]);
click('My words');
assert(row('gözəl'));select(row('gözəl').querySelector('select'),'');
assert.equal(study.word('gözəl').rating,null);
select(one('[aria-label="Filter your library"]'),'unrated');assert(row('gözəl'));
select(row('gözəl').querySelector('select'),'0');assert.equal(study.word('gözəl').rating,0);assert(!row('gözəl'));
select(one('[aria-label="Filter your library"]'),'0');assert(row('gözəl'));
click('Find words');search('');click('Rate common words');
const placement=one('.study-placement-word').textContent;
click('Know well');assert.equal(study.word(placement).rating,2);assert.notEqual(one('.study-placement-word').textContent,placement);
const skipped=one('.study-placement-word').textContent;
click('Skip this word');assert.equal(study.word(skipped),null);
click('Finish rating');assert(!one('.study-placement-word'));

study.setContext('gözəl',{text:'Hava necə də gözəldir! <img src=x>',source:'https://example.com/talk',seconds:0});
study.record({id:'rec-1',kind:'word',key:'gözəl',channel:'recognize',correct:true});
study.record({id:'listen-slow',kind:'word',key:'eşitmək',channel:'listen',condition:'slower',correct:true});
study.record({id:'use-model',kind:'word',key:'eşitmək',channel:'use',condition:'supported',correct:true});
study.record({id:'listen-first',kind:'word',key:'gözəl',channel:'listen',condition:'normal',correct:true});
when=Date.parse('2026-11-26T20:01:00Z');
study.record({id:'use-alone',kind:'word',key:'gözəl',channel:'use',condition:'independent',correct:true});
study.record({id:'use-again',kind:'word',key:'gözəl',channel:'use',condition:'independent',correct:true});
study.record({id:'grammar-cloze',kind:'lesson',key:'why-it-happened',channel:'recall',correct:true});
study.record({id:'clip-gist',kind:'lesson',key:'radio-clip',channel:'listen',condition:'normal',correct:true});
study.rateWord('gözəl',3);
const common=model.commonWords().slice(0,27);
for(const n of common)study.trackWord(n.w);
const restored=mount(createStudy());
restored.library();assert.equal(all('.study-word-row').length,15);
const names=all('.study-word-row').map(el=>el.dataset.word);
click('Next');assert(all('.study-word-row').every(el=>!names.includes(el.dataset.word)));
select(one('[aria-label="Filter your library"]'),'both');assert.deepEqual(all('.study-word-row').map(r=>r.dataset.word),['gözəl']);
assert(row('gözəl').querySelector('.study-word-phrase').textContent.includes('<img'));
assert.equal(row('gözəl').querySelector('.study-word-phrase img'),null);
assert.equal(row('gözəl').querySelector('.study-word-source a').getAttribute('rel'),'noopener noreferrer');
assert(row('gözəl').querySelector('.study-word-source').textContent.includes('0:00'));
assert(row('gözəl').querySelector('.study-word-evidence').textContent.includes('2 independent uses'));
restored.progress();
assert.deepEqual(all('.study-metric strong').map(n=>n.textContent),['1','1','1'],'Only independent first-pass evidence contributes to the personal proficiency criterion');
assert(all('.study-coverage-count')[0].textContent.endsWith('90,856'));
assert.equal(all('.study-week-day').length,7);
assert.deepEqual(all('.study-week-day').slice(-2).map(n=>n.querySelector('time').getAttribute('datetime')),['2026-11-26','2026-11-27']);
assert.equal(all('.study-week-day').at(-1).querySelector('strong').textContent,'4');
assert(one('.study-week-gains').textContent.includes('1 new word understood on the first listen'));
assert(one('.study-week-gains').textContent.includes('1 new word used independently in a sentence'));
assert(one('.study-week-gains').textContent.includes('1 more in your self-rated proficient group'));
assert.deepEqual(all('.study-grammar-skills dt').map(n=>n.textContent),['Giving a reason']);
assert(all('.study-grammar-skills dd')[0].textContent.includes('1 production'));
assert(!host.textContent.includes('radio-clip'));
console.log('PASS personal library enrollment, editable four-level placement, search, pagination, safe notes, date-based progress, and independent listening/use evidence.');
