// The data layers that scripts/build_runtime.cjs combines, in createModel order.
// The page loads soz-core.json instead; data tests load these files directly.
const fs = require('fs'), path = require('path'), vm = require('vm');
const dist = path.join(__dirname, '../dist');
const LAYER_FILES = ['data', 'lexicon', 'grammar', 'vocabulary', 'review', 'bilingual', 'expansion', 'nominal', 'additions', 'relations',
  'references', 'growth', 'orthography-lexical', 'orthography-lexical-evidence', 'orthography', 'verification', 'print-definitions'].map(f => f + '.js');
const MODEL_GLOBALS = ['WORD_WEB_DATA', 'WORD_WEB_EXTRA', 'WORD_WEB_GRAMMAR', 'WORD_WEB_VOCABULARY', 'WORD_WEB_REVIEW', 'WORD_WEB_BILINGUAL',
  'WORD_WEB_EXPANSION', 'WORD_WEB_NOMINAL', 'WORD_WEB_ADDITIONS', 'WORD_WEB_RELATIONS', 'WORD_WEB_REFERENCES', 'WORD_WEB_GROWTH',
  'WORD_WEB_VERIFICATION', 'WORD_WEB_ORTHOGRAPHY', 'WORD_WEB_ORTHOGRAPHY_LEXICAL', 'WORD_WEB_PRINT_DEFINITIONS'];
// Evaluate every layer file in a vm context (whose global object has a `window`).
function loadLayers(context) { for (const file of LAYER_FILES) vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), context, { filename: file }); }
// A synchronous stand-in for fetch, so tests see detail files and the forms archive at once.
const fetchJSON = file => JSON.parse(fs.readFileSync(path.join(dist, file.split('?')[0]), 'utf8'));
module.exports = { LAYER_FILES, MODEL_GLOBALS, loadLayers, fetchJSON };
