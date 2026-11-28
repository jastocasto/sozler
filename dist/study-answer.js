/* Match an answer against the published dictionary, including secondary senses. */
(function (root) {
'use strict';

const {normalize} = root.WordWeb || (typeof module !== 'undefined' && require('./model.js'));
const commonAlternatives = [
 ['beautiful','pretty','lovely','good looking','attractive'],
 ['comment','remark'], ['hint','allusion','insinuation'],
 ['for a laugh','for fun','as a joke','in jest','jokingly'],
 ['rejoice','be happy','be glad'], ['repair','fix','mend'], ['begin','start'],
 ['inevitable','bound to happen'], ['sooner or later','eventually','at some point']
];
const filler = new Set('a an the of on in at for with to from by as or and that this it is be something someone bir bu və ya üçün birinə biri birisini'.split(' '));
const opposites = [
 ['before','after'], ['above','below'], ['increase','decrease'], ['more','less'],
 ['accept','reject'], ['start','finish'], ['include','exclude'], ['give','take']
];

function plain(value, language) {
 const lower = String(value ?? '').normalize('NFC').toLocaleLowerCase(language);
 return lower.replace(/[\p{P}\p{Z}\s]+/gu,' ').trim();
}

function meaningKey(value, language) {
 let text = String(value ?? '').trim();
 if (language === 'en') {
  text = text.toLowerCase().replace(/^(?:i think (?:it means|it is)|it means|it is|it['’]s|means)\s+/,'')
   .replace(/\bcan['’]t\b/g,'cannot').replace(/n['’]t\b/g,' not');
 }
 const key = plain(text,language);
 return language === 'en' ? key.replace(/^(?:to|an?|the)\s+/,'') : key;
}

function sensePairs(node) {
 const pairs = [{az:node.az,en:node.en}, ...(node.bilingualSenses || [])], seen = new Set();
 return pairs.filter(pair => {
  const key = (pair.az || '') + '\n' + (pair.en || '');
  if (!(pair.az || pair.en) || seen.has(key)) return false;
  seen.add(key);return true;
 });
}

function glossForms(text, language) {
 const brief = text.replace(/\([^()]*\)/g,' ').replace(/,\s*(?:depending on|especially|usually|often|as in)\b.*$/i,'').trim();
 const clauses = brief.split(/;|\s+\/\s+|\n/);
 const alternatives = clauses.flatMap(clause => {
  const parts = clause.split(/\s*,\s*|\s+(?:or|və ya)\s+/i)
   .map(part => part.trim().replace(/^(?:or|və ya)\s+/i,'')).filter(Boolean);
  const shortList = parts.every(part => meaningKey(part,language).split(' ').length === 1);
  const phraseList = language === 'en' && parts.every(part => /^(?:to|for|as)\s+\S/i.test(part));
  return parts.length > 1 && (shortList || phraseList) ? parts : [];
 });
 return [...new Set([text,brief,...clauses,...alternatives].map(form => meaningKey(form,language)).filter(Boolean))];
}

function keywords(value) {
 return [...new Set(value.split(' ').filter(word => !filler.has(word)))];
}

function closeMeaning(answer, gloss, language) {
 if (language === 'en' && commonAlternatives.some(group => group.includes(answer) && group.includes(gloss))) return true;
 const a = keywords(answer), b = keywords(gloss);
 if (a.length < 2 || b.length < 2) return false;
 const negated = tokens => tokens.some(token => /^(?:no|not|never|without|cannot|opposite|yox|deyil)$/.test(token));
 if (negated(a) !== negated(b) || opposites.some(([x,y]) => a.includes(x) && b.includes(y) || a.includes(y) && b.includes(x))) {
  return false;
 }
 const common = a.filter(token => b.includes(token)).length;
 return common >= 2 && common >= Math.min(a.length,b.length) * .8 && common >= Math.max(a.length,b.length) * .66;
}

function assessMeaning(node, value, model) {
 const senses = sensePairs(node);
 let possible = null;
 for (const language of ['en','az']) {
  const answer = meaningKey(value,language);
  if (!answer) continue;
  for (const sense of senses) {
   if (!sense[language]) continue;
   for (const gloss of glossForms(sense[language],language)) {
    if (answer === gloss) return {kind:'match',sense};
    if (!possible && closeMeaning(answer,gloss,language)) possible = sense;
   }
  }
 }
 const word = model.resolveWord(plain(value,'az'));
 if (!possible && word && word.w !== node.w &&
     model.related(node,new Set(['syn'])).some(relation => relation.node.w === word.w)) {
  possible = senses[0];
 }
 return {kind:possible ? 'close' : 'unmatched',sense:possible ?? senses[0]};
}

function spelling(value) {
 return String(value ?? '').normalize('NFC').toLocaleLowerCase('az')
  .replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim().replace(/[.!?]+$/,'').trim();
}

function assessHeadword(node, value, model) {
 const guess = spelling(value), target = spelling(node.w);
 if (guess === target) return true;
 if (!guess) return false;
 if (model.byWord.has(guess) || model.formsByWord?.has(guess) && !model.aliases?.[guess]) return false;
 const alternate = model.resolveWord(guess);
 if (alternate) return alternate.w === node.w;
 const keyboard = /^[a-z ,'-]+$/i.test(guess);
 return keyboard && normalize(guess) === normalize(target);
}

function englishCue(node) {
 const headword = node.w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const exposed = new RegExp('(^|[^\\p{L}\\p{M}])'+headword+'(?=$|[^\\p{L}\\p{M}])','giu');
 for (const text of sensePairs(node).map(pair => pair.en).concat(node.definitionExample?.[1] || [])) {
  const cue = text?.replace(exposed,'$1___').trim();
  if (cue && /\p{L}/u.test(cue)) return cue;
 }
 return '';
}

const api = {assessMeaning, assessHeadword, englishCue, sensePairs};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.SozStudyAnswer = api;
})(typeof window !== 'undefined' ? window : globalThis);
