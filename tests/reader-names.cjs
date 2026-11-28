const assert=require('node:assert/strict');
const {create}=require('../dist/reader-names.js');
const morphology=require('../dist/morphology.js');
global.window={};
require('../dist/reader-book.js');
const {names}=window.SozReaderBook;
const pages=window.SozReaderBookPages;
delete global.window;
const fold=text=>text.normalize('NFC').trim().toLocaleLowerCase('az').replace(/\s+/g,' ');
const glossary=create(names,morphology,fold);

const examples={
 158:{Hatsul:'Hatsul',Elionun:'Elion’s',Zeldanı:'Zeldan',İpara:'to İpar'},
 159:{'Yeni Azara':'to New Azar','Yeni Azarla':'with New Azar','Kölgə Ovçuları':'the Shadow Hunters',
  Üçlüyün:'of the Three','AR yolu':'the AR road','Aris ir-Rvuna':'guarded road',Raqanı:'Raqa'},
 160:{Hufin:'Hufin',Zeldandısa:'if it was Zeldan'},
 161:{Draqzini:'Draqzin','Qara atəşlə':'with the Black Fire'},
 162:{Xarp:'Xarp'},
 163:{Eçso:'Eçso',Eçsoya:'to Eçso',Etrakın:'Etrak’s',Aqrenin:'Aqren’s',Zeldana:'to Zeldan'}
};
for(const [folio,forms] of Object.entries(examples)){
 const text=pages.find(page=>page.page===folio).text;
 for(const [surface,english] of Object.entries(forms)){
  assert(text.includes(surface),surface+' must occur on page '+folio);
  assert.equal(glossary.match(surface)?.english,english,surface);
 }
}
assert.equal(glossary.match('“Zeldana,”').english,'to Zeldan');
assert.equal(glossary.match('Aqrənin').entry.word,'Aqren');
assert.equal(glossary.match('Aqrənin').english,'Aqren’s');
assert.equal(glossary.match('AR yolunda').english,'on the AR road');
assert.equal(glossary.match('kölgə ovçuları'),null);
assert.equal(glossary.match('Günəş'),null);
assert.equal(glossary.placePhrase('Hufin kəndində').english,'in the village of Hufin');
assert.equal(glossary.placePhrase('Xarp şəhərinə').english,'to the city of Xarp');
assert.equal(glossary.placePhrase('Xarp\nşəhərinə').english,'to the city of Xarp');
assert.equal(glossary.placePhrase('Aqren şəhərinə'),null);
assert.equal(glossary.placePhrase('Zeravan qəsəbəsində').english,'in the town of Zeravan');
assert.equal(glossary.possible('Günəş','Günəş doğdu. Qapı açıldı.',0),null);
assert(glossary.possible('Zeravan','Onlar dünən Zeravan yaxınlığında qaldılar.',12));
