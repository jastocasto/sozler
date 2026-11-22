// Export the atlas as build_print_definitions.py sees it: every headword with
// its current bilingual definition, English verb forms and connection count.
//   node scripts/export_print_definition_model.cjs model.json [--without-print]
const fs = require('fs'), vm = require('vm'), path = require('path');
const dist = path.join(__dirname, '../dist');
const files = ['data', 'lexicon', 'grammar', 'vocabulary', 'review', 'bilingual', 'expansion', 'nominal', 'additions',
  'relations', 'references', 'growth', 'orthography-lexical', 'orthography-lexical-evidence', 'orthography', 'verification',
  ...(process.argv.includes('--without-print') ? [] : ['print-definitions'])];
const sandbox = { window: {} };
for (const file of files) {
  const source = path.join(dist, file + '.js');
  if (fs.existsSync(source)) vm.runInNewContext(fs.readFileSync(source, 'utf8'), sandbox);
}
const w = sandbox.window;
const model = require('../dist/model.js').createModel(w.WORD_WEB_DATA, w.WORD_WEB_EXTRA, w.WORD_WEB_GRAMMAR, w.WORD_WEB_VOCABULARY,
  w.WORD_WEB_REVIEW, w.WORD_WEB_BILINGUAL, w.WORD_WEB_EXPANSION, w.WORD_WEB_NOMINAL, w.WORD_WEB_ADDITIONS, w.WORD_WEB_RELATIONS,
  w.WORD_WEB_REFERENCES, w.WORD_WEB_GROWTH, w.WORD_WEB_VERIFICATION, w.WORD_WEB_ORTHOGRAPHY, w.WORD_WEB_ORTHOGRAPHY_LEXICAL,
  w.WORD_WEB_PRINT_DEFINITIONS);
const { principal, baseFromGloss } = require('../dist/conjugation-english.js');
const degree = new Map();
const pairs = [];
for (const edge of model.edges) {
  degree.set(edge.a.w, (degree.get(edge.a.w) || 0) + 1);
  degree.set(edge.b.w, (degree.get(edge.b.w) || 0) + 1);
  pairs.push([edge.a.w, edge.b.w, edge.type]);
}
const nodes = model.nodes.map(node => {
  const row = { w: node.w, az: node.az || '', en: node.en || '', pos: node.pos, degree: degree.get(node.w) || 0 };
  if (node.orthographyPage) row.page = node.orthographyPage;
  if (node.definitionMethod) row.method = node.definitionMethod;
  // Where the current definition comes from, so links built on it can cite the same source.
  const refs = (node.definitionSources || []).filter(ref => ref.url && /^https:\/\//.test(ref.url)).map(ref => ({ title: ref.title || 'lüğət', url: ref.url }));
  if (!refs.length && node.source?.head) {
    const edition = node.source.edition || 'en';
    refs.push({ title: `Wiktionary (${edition})`, url: node.source.url || `https://${edition}.wiktionary.org/wiki/${encodeURIComponent(node.source.head)}` });
  }
  if (refs.length && row.az) row.refs = refs.slice(0, 2);
  if (node.definitionAuditStatus === 'needs-review') row.review = true;
  if (node.pos === 'verb') {
    const phrase = baseFromGloss(node.en);
    const verb = phrase && principal(phrase);
    if (verb) row.verbForms = { base: verb.base, ing: verb.ing, participle: verb.participle };
  }
  return row;
});
// Word pairs that reviewers rejected; the model drops any link between them, so the builder must not make one.
const blocked = [];
for (const layer of Object.values(w)) for (const [a, b] of (layer && layer.blocked) || []) blocked.push([a, b]);
fs.writeFileSync(process.argv[2], JSON.stringify({ nodes, edges: pairs, blocked }));
console.log(nodes.length, 'nodes', pairs.length, 'edges');
