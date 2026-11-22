#!/usr/bin/env node
// Decide how each noun's stem changes before a vowel ending, for the noun tables.
//
//   node --max-old-space-size=6144 scripts/build_noun_stems.cjs counts.tsv
//
// counts.tsv is the corpus token count from scripts/count_corpus_words.py.
// Two changes are decided per noun:
//   k/q softening   çörək → çörəyi, otaq → otağı, but fabrik → fabriki
//   vowel loss      ağız → ağzı, burun → burnu, but qızıl → qızılı
// Evidence, strongest first: forms recorded in the forms archive; the corpus
// (the changed and unchanged stems are counted with several case and
// possessive endings, and one must be at least twice as frequent and found
// with at least three different endings); otherwise a rule (soften a
// polysyllabic native word, keep a Russian or European loan; vowel loss only
// for the analyser's documented list). Writes scripts/content/nouns/stems.json:
//   { noun: [shape, source] }  shape: "soft" | "hard" | "drop",
//   source: "archive" | "corpus" | "compound" (follows its last part) | "rule" | "uncertain"
'use strict';
const fs = require('fs'), path = require('path'), readline = require('readline');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist');
const W = require(path.join(dist, 'model.js'));
const VOWELS = 'aıouəeiöü', isVowel = c => VOWELS.includes(c), syllables = s => [...s].filter(isVowel).length;
function harmony(s) { let v = 'ə'; for (let i = s.length - 1; i >= 0; i--) if (isVowel(s[i])) { v = s[i]; break; } const front = 'əeiöü'.includes(v); return { A: front ? 'ə' : 'a', I: 'aı'.includes(v) ? 'ı' : 'ou'.includes(v) ? 'u' : 'öü'.includes(v) ? 'ü' : 'i' }; }
// Case and possessive endings that begin with a vowel, harmonised to the noun.
const endings = word => { const { A, I } = harmony(word); return [I, A, I + 'n', I + 'm', I + 'm' + I + 'z', I + 'n' + I + 'z', I + 'n' + I, I + 'nd' + A, I + 'nd' + A + 'n', I + 'n' + A]; };
const DOCUMENTED_DROP = new Set('burun beyin izin isim oğul əyin ağıl fikir nəsil ağız alın ömür şəkil sinif cisim ətir boyun qarın çiyin əsil fəsil zehin səbir sətir'.split(' '));
const NO_SOFTENING_ORIGINS = new Set(['russian', 'european', 'slavic']);

(async () => {
  const countsFile = process.argv[2];
  if (!countsFile) { console.error('usage: build_noun_stems.cjs counts.tsv'); process.exit(2); }
  const fetchJSON = file => JSON.parse(fs.readFileSync(path.join(dist, file.split('?')[0]), 'utf8'));
  const model = W.restoreModel(fetchJSON('soz-core.json'), { fetchJSON });
  model.ensureText();
  const counts = new Map();
  const lines = readline.createInterface({ input: fs.createReadStream(countsFile, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) { if (line.startsWith('#')) continue; const [token, ...cells] = line.split('\t'); counts.set(token, cells.reduce((a, c) => a + +c, 0)); }
  const etymology = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'etymology', 'etymology.json'), 'utf8'));
  const languages = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'etymology', 'languages.json'), 'utf8'));
  const loanFamily = word => { const o = etymology[word]?.o?.[0]; const donor = o?.chain.find(l => languages[l]?.[1] !== 'turkic'); return donor ? languages[donor][1] : null; };
  // Archived forms by base: which stem shape do they show before a vowel?
  const archived = new Map();
  for (const r of model.nominalRecords) { const base = (r.lemma || r.base || '').toLocaleLowerCase('az'); if (!archived.has(base)) archived.set(base, []); archived.get(base).push(r.w.toLocaleLowerCase('az')); }
  const shows = (forms, shape) => (forms || []).some(f => f.startsWith(shape) && isVowel(f[shape.length] || ''));
  const support = shape => { let total = 0, kinds = 0; for (const e of endings(shape)) { const c = counts.get(shape + e) || 0; total += c; if (c) kinds++; } return { total, kinds }; };
  const decide = (word, changed, plain) => {
    const forms = archived.get(word), a = shows(forms, changed), b = shows(forms, plain);
    if (a !== b) return [a ? 'changed' : 'plain', 'archive'];
    const x = support(changed), y = support(plain);
    if (x.kinds >= 3 && x.total >= 3 && x.total >= 2 * y.total) return ['changed', 'corpus'];
    if (y.kinds >= 3 && y.total >= 3 && y.total >= 2 * x.total) return ['plain', 'corpus'];
    return [null, 'rule'];
  };
  const out = {}, tally = {}, pending = [];
  const count = key => tally[key] = (tally[key] || 0) + 1;
  for (const n of model.nodes) {
    if (n.pos !== 'noun' || /[\s-]/.test(n.w) || n.w !== n.w.toLocaleLowerCase('az')) continue;
    const w = n.w;
    if (syllables(w) > 1 && /[aıouəeiöü][kq]$/.test(w)) {
      const soft = w.slice(0, -1) + (w.endsWith('k') ? 'y' : 'ğ');
      let [shape, source] = decide(w, soft, w);
      if (shape) { out[w] = [shape === 'changed' ? 'soft' : 'hard', source]; count('k/q ' + out[w].join(' ')); }
      else pending.push(w);
    } else if (syllables(w) === 2 && /[^aıouəeiöü][ıiuü][^aıouəeiöü]$/.test(w)) {
      const dropped = w.slice(0, -2) + w.slice(-1);
      let [shape, source] = decide(w, dropped, w);
      if (!shape) { if (!DOCUMENTED_DROP.has(w)) continue; shape = 'changed'; }
      if (shape === 'changed') { out[w] = ['drop', source]; count('vowel loss ' + source); }
    }
  }
  // No archive or corpus evidence: decide by the word's ending, its last
  // compound part, or its origin; otherwise mark the softening as unverified.
  const NATIVE_SUFFIX = /(l[ıiuü]|[cç][ıiuü])[qk]$/;              // dostluq, gözəllik, adamcıq
  const LOAN_ENDING = /([^aıouəeiöü]ik|oq|ok|ök|uk|ük)$/;           // fabrik, nevroloq, blok, feysbuk
  for (const w of pending) {
    let shape = null, source = 'rule';
    if (NATIVE_SUFFIX.test(w)) shape = 'soft';
    else {
      for (let i = 1; i <= w.length - 3 && !shape; i++) { const part = out[w.slice(i)]; if (part && part[1] !== 'uncertain' && part[1] !== 'rule') { shape = part[0]; source = 'compound'; } }
      if (!shape && (NO_SOFTENING_ORIGINS.has(loanFamily(w)) || LOAN_ENDING.test(w))) shape = 'hard';
      if (!shape) { shape = 'soft'; source = 'uncertain'; }
    }
    out[w] = [shape, source]; count('k/q ' + shape + ' ' + source);
  }
  const target = path.join(__dirname, 'content', 'nouns', 'stems.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(out, Object.keys(out).sort((a, b) => a.localeCompare(b, 'az')), 0).replace(/\],/g, '],\n') + '\n');
  console.log(JSON.stringify(tally, null, 1));
  for (const w of ['çörək', 'ürək', 'otaq', 'uşaq', 'fabrik', 'texnik', 'hüquq', 'ittifaq', 'maraq', 'ağız', 'burun', 'qızıl', 'oğul', 'şəkil', 'dostluq', 'kitabça']) console.log(w, JSON.stringify(out[w] || null));
})();
