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
go('#study/progress');assert($('studyLibraryContent').textContent.includes('90,855'));
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
const front=restoredDoc.querySelector('.vocab-front'),newWord=front.querySelector('.vocab-headword').textContent;
assert(!restoredDoc.querySelector('.vocab-ratings'));
front.click();assert(restoredDoc.querySelector('.vocab-definition p[lang="az"]').textContent);
restoredDoc.querySelector('.vocab-rate[data-rating="3"]').click();
restored.$('appTabs').querySelector('[data-app-tab="vocab"]').click();
assert(restored.$('studyVocab').textContent.includes('1 / 6 rated today'));
restoredDoc.querySelector('.vocab-bank[data-rating="3"]').click();
assert(restoredDoc.querySelector(`[data-word="${newWord}"]`),'A new card goes straight to its bank');
assert(!restoredDoc.querySelector('.study-word-row [data-action="practice"]'));
restored.window.location.hash='#w=g%C3%B6z%C9%99l';
restored.window.dispatchEvent(new restored.window.Event('hashchange'));
assert.equal(restored.window.SozApp.inspect().page,'map');
assert.equal(restored.window.document.querySelector('.galaxy-studio').dataset.mapView,'word');
console.log('PASS five-tab navigation, Today by default, daily card and bank flow, map mastery, attached sources, restored settings, quiz evidence and race guard.');
