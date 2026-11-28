const assert=require('node:assert/strict');
require('../dist/reader-ocr.js');
const {parsePage}=global.SozReaderOCR;

assert.deepEqual(parsePage('ZAUR PƏNAHOV\n\nKülək dünənki kimi\nəsirdi.\n\nMüəllim qayıtdı.\n\n163'),{
 page:'163',text:'Külək dünənki kimi əsirdi.\n\nMüəllim qayıtdı.'
});
assert.deepEqual(parsePage('QARANLIQ GÜNƏŞ\n\n11\nQAÇIŞ\n\nGünəş artıq bat-\nmışdı.\n\n162'),{
 page:'162',chapter:{number:'11',title:'QAÇIŞ'},text:'Günəş artıq batmışdı.'
});
assert.deepEqual(parsePage('FƏSİL IV\nYeni başlanğıc\n\nUzaqda bir işıq göründü.'),{
 page:'',chapter:{number:'IV',title:'Yeni başlanğıc'},text:'Uzaqda bir işıq göründü.'
});
assert.deepEqual(parsePage('ZAUR PƏNAHOV\nSöhbət bununla bitdi.\n\n\n  161'),{
 page:'161',text:'Söhbət bununla bitdi.'
});
assert.deepEqual(parsePage('Bir şeir\nikinci sətir\n\n164',{reflow:false}),{
 page:'164',text:'Bir şeir\nikinci sətir'
});
