const assert=require('node:assert/strict');
const {boot}=require('./galaxy-harness.cjs');

const h=boot({width:390,height:844,hash:'#w=g%C3%B6z%C9%99l',reduced:true,configureWindow(w){w.URL=URL;}});
const {$,window}=h,doc=window.document;
const screen=()=>window.SozApp.inspect().page;
function choose(id,value) {
 const control=$(id);control.value=String(value);
 control.dispatchEvent(new window.Event('change',{bubbles:true}));
}
function tab(id){doc.querySelector('[data-app-tab="'+id+'"]').click();}
function go(hash){window.location.hash=hash;window.dispatchEvent(new window.Event('hashchange'));}

assert.equal(screen(),'map');
$('sheetToggle').click();choose('mapStudyLevel','2');
assert.equal(doc.querySelector('.word-node.selected .proficiency-mark').getAttribute('data-rating'),'2');
$('mapStudyLibrary').click();
assert.equal(screen(),'study');assert.equal($('studyHeading').textContent,'My words');
const row=$('studyLibraryContent').querySelector('[data-word="gözəl"]');
assert.equal(row.querySelector('select').value,'2');
row.querySelector('[data-action="practice"]').click();
assert.equal($('studyHeading').textContent,'gözəl');
assert($('studyPracticeContent').textContent.includes('What does this word mean?'));

tab('home');
const cards=[...$('studyToday').querySelectorAll('[data-study-task]')].map(x=>x.dataset.studyTask);
assert.deepEqual(cards,['phrasing','media','clips','speaking']);
$('studyToday').querySelector('[data-study-task="media"]').click();
assert.equal($('studyMediaContent').querySelector('[target="_blank"]').rel,'noopener noreferrer');

go('#study/media/akinchi-heritage');
assert($('studyMediaContent').textContent.includes('Bakıda memarlıq irsinin taleyi'));
tab('settings');$('studyMinutes').value='15';$('studySpeaking').checked=false;
$('studyNewWords').value='6';$('studySaveSettings').click();
assert($('studySettingsStatus').textContent.includes('updated'));
tab('home');assert($('studyToday').textContent.includes('15 min planned'));
assert($('studyToday').textContent.includes('Learn 6 words'));
assert(!$('studyToday').querySelector('[data-study-task="speaking"]'));

const store=window.SozStudyUI.createStore(h.model);
store.setContext('gözəl',{text:'Nə gözəl sualdır!',source:'https://www.youtube.com/watch?v=Y93NbcHsmHI',seconds:568});
window.dispatchEvent(new window.Event('pageshow'));
go('#study/word/g%C3%B6z%C9%99l');assert(!$('studyWordSource').hidden);$('studyWordSource').click();
assert($('studyMediaContent').textContent.includes('Nə gözəl sualdır!'));
go('#study/progress');assert($('studyLibraryContent').textContent.includes((h.model.nodes.length-1).toLocaleString('en-US')));
tab('kainat');assert.equal(screen(),'map');
assert.equal($('meaningEnglish').textContent,'beautiful');assert.equal($('mapFilterKeys').querySelectorAll('button').length,5);

// The old word and picture games also contribute evidence to the same library.
$('quizButton').click();$('quizStart').click();
const choice=$('quizOptions').querySelector('button');choice.click();choice.click();store.refresh();
assert.equal(store.summary(h.model.nodes.length).today.attempts,1);
assert(store.words().some(w=>w.evidence.recognize.attempts));
$('quizDialog').close();
$('raceButton').click();$('raceStart').click();
assert($('appTabs').hasAttribute('inert'));tab('home');assert.equal(screen(),'map');
$('raceExit').click();go('#study');assert.equal(screen(),'study');
assert.equal(h.errors.length,0);

// The dashboard opens on a bare URL, including for an older backup that opened the atlas.
store.setSettings({startPage:'atlas'});
const restored=boot({width:390,height:844,reduced:true,hash:'',configureWindow(w){
 w.URL=URL;
 const key='soz-toxumasi:study:v1:records';
 w.localStorage.setItem(key,h.storage.get(key));
}});
assert.equal(restored.window.SozApp.inspect().page,'study');
assert(restored.$('studyToday').textContent.includes('15 min planned'));
const restoredDoc=restored.window.document;
assert.deepEqual([...restored.$('appTabs').querySelectorAll('a')].map(a=>a.textContent),['Kainat','Vocab','Home','Study','Settings']);
assert.equal(restored.$('appTabs').querySelector('[aria-current]').dataset.appTab,'home');
restored.$('studyToday').querySelector('.study-cta').click();
assert.equal(restoredDoc.querySelector('.vocab-new').textContent,'Yeni');
assert.deepEqual([...restoredDoc.querySelectorAll('.vocab-session-bank .vocab-session-label')].map(b=>b.textContent),['Nope','Ehh','Almost','100%']);
restored.model.ensureText();
function guess(text) {
 const form=restoredDoc.querySelector('.vocab-guess-form'),input=form.querySelector('textarea');
 assert(!restoredDoc.querySelector('.vocab-compact-ratings'),'The guess precedes the ratings');
 assert(form.querySelector('[type="submit"]').disabled);
 input.value=text;input.dispatchEvent(new restored.window.Event('input'));
 assert(!form.querySelector('[type="submit"]').disabled);
 form.dispatchEvent(new restored.window.Event('submit'));
}
const taught=[];
for(let i=0;i<6;i++){
 const newWord=restoredDoc.querySelector('.vocab-prompt-heading h2').textContent;
 taught.push(newWord);
 guess(restored.model.byWord.get(newWord).en);
 assert.equal(restoredDoc.querySelector('.vocab-check-result').dataset.result,'match');
 assert(restoredDoc.querySelector('.vocab-definition p[lang="az"]').textContent);
 assert.deepEqual([...restoredDoc.querySelectorAll('.vocab-rate')].map(b=>b.textContent),['Nope','Ehh','Almost','100%']);
 restoredDoc.querySelector('.vocab-rate[data-rating="3"]').click();
}
assert(restoredDoc.querySelector('.vocab-english-cue'));
assert(!restoredDoc.querySelector('.vocab-new'));
guess('wrong headword');
assert.equal(restoredDoc.querySelector('.vocab-check-result').dataset.result,'unmatched');
restoredDoc.querySelector('.vocab-answer .study-cta').click();
guess(taught[1]);
assert(restoredDoc.querySelector('.vocab-check-result').textContent.includes('Proficient'));
assert.equal(restoredDoc.querySelector('.vocab-session-bank[data-rating="3"] strong').textContent,'1');
restored.$('appTabs').querySelector('[data-app-tab="vocab"]').click();
assert(restored.$('studyVocab').textContent.includes('1 / 6 mastered today'));
restoredDoc.querySelector('.vocab-bank[data-rating="3"]').click();
assert(restoredDoc.querySelector(`[data-word="${taught[1]}"]`),'A successful final recall puts the word in the proficient bank');
assert(!restoredDoc.querySelector(`[data-word="${taught[0]}"]`),'A failed final recall keeps the word in the deck');
assert(!restoredDoc.querySelector('.study-word-row [data-action="practice"]'));
restored.window.location.hash='#w=g%C3%B6z%C9%99l';
restored.window.dispatchEvent(new restored.window.Event('hashchange'));
assert.equal(restored.window.SozApp.inspect().page,'map');
assert.equal(restored.window.document.querySelector('.galaxy-studio').dataset.mapView,'word');

go('#study/read');
const reader=$('studyReadingContent');
assert.equal(reader.querySelector('.reader-editor input').value,'Qaranlıq günəş');
assert(reader.querySelector('.reader-book').textContent.includes('Open your private book link'));
const pageNumber=[...reader.querySelectorAll('.reader-field')].find(field=>field.querySelector('span').textContent==='Page number (optional)');
pageNumber.querySelector('input').value='17';
reader.querySelector('textarea').value='Nə var, nə yox? Geci tezi görüşərik.';
[...reader.querySelectorAll('button')].find(button=>button.textContent==='Open page').click();
assert.equal(reader.querySelector('.reader-folio').textContent,'17');
assert.equal(reader.querySelector('.reader-leaf').getAttribute('aria-label'),'Page 17');
assert(doc.documentElement.classList.contains('book-reader-open'));
const controls=reader.querySelector('.reader-top-target');
assert(reader.querySelector('#reader-toolbar').hidden);
controls.click();assert(!reader.querySelector('#reader-toolbar').hidden);
controls.click();assert(reader.querySelector('#reader-toolbar').hidden);
assert([...reader.querySelectorAll('.reader-word')].some(button=>button.textContent==='Nə var, nə yox'));
const phrase=[...reader.querySelectorAll('.reader-word')].find(button=>button.textContent==='Geci tezi');
assert(phrase,'A familiar spelling can be looked up as one expression');
phrase.click();
assert.equal(reader.querySelector('.reader-result h3').textContent,'geci-tezi');
assert(phrase.hasAttribute('data-reader-active'));
assert.equal(reader.querySelector('dialog[open]'),null);
reader.querySelector('.reader-ratings [data-rating="1"]').click();
store.refresh();
assert.equal(store.word('geci-tezi').rating,1);
assert.equal(store.word('geci-tezi').reading.page,'17');
assert.equal(store.word('geci-tezi').reading.excerpt,'Geci tezi görüşərik.');
const backup=window.SozStudyModel.create({storage:null,validWord:w=>h.model.byWord.has(w)});
backup.importJSON(store.exportJSON());
assert.equal(backup.word('geci-tezi').reading.title,'Qaranlıq günəş');
assert.equal(backup.word('gözəl').context.seconds,568);
const example={id:'sample-12',title:'Example',page:'12',text:'Bir nümunə.',updated:0,chapter:{number:'2',title:'Nümunə'}};
const [validated]=window.SozStudyReader.validatePages([example]);
assert.equal(JSON.stringify(validated),JSON.stringify(example));
go('#study/read');
assert(reader.querySelector('.reader-book').textContent.includes('1 saved page'));
assert.equal(reader.querySelector('.reader-book .study-cta').textContent,'Open book · Page 17');
tab('home');
assert($('studyToday').textContent.includes('Continue Qaranlıq günəş'));
console.log('PASS five-tab navigation, Today by default, daily card and bank flow, map mastery, attached media and reading sources, restored settings, quiz evidence and race guard.');
