/* Flashcards and proficiency banks use the same records as the atlas and library. */
(function (root) {
'use strict';

const number = new Intl.NumberFormat('en');
const words = (total, noun) => number.format(total) + ' ' + noun + (total === 1 ? '' : 's');
const grades = ['Nope','Ehh','Almost','100%'];
const stages = ['Red','Orange','Yellow','Green'];

function mount({host, study, model, navigate, discover, onChange}) {
 const document = host.ownerDocument, levels = root.SozStudyLibrary.levels;
 const checker = root.SozStudyAnswer;
 let deck = null, deckDay = null, skipped = new Set(), recognition = null, speaking = null;

 function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
 }
 function button(text, className, action) {
  const control = element('button', className, text);
  control.type = 'button';
  control.addEventListener('click', action);
  return control;
 }
 function rating(level, label, action, className) {
  const control = button('', className, action);
  control.dataset.rating = String(level);
  const dot = element('span', 'rating-dot');
  dot.setAttribute('aria-hidden', 'true');
  control.append(dot, element('span', '', label));
  return control;
 }
 function status(summary = study.summary(model.nodes.length)) {
  const started = summary.today.newCards, target = Math.max(study.settings().newWords,started);
  return {target, started, completed:summary.today.newMastered, due:summary.dueCards};
 }
 function wordMeter(value, maximum, label) {
  const meter = element('progress');
  meter.max = Math.max(1, maximum);
  meter.value = value;
  meter.setAttribute('aria-label', label);
  return meter;
 }
 function coverage(summary) {
  const panel = element('section', 'study-section vocab-coverage');
  const heading = element('div', 'study-section-heading');
  heading.append(element('h2', '', 'Your atlas progress'),
   element('p', '', number.format(summary.assessed) + ' of ' + number.format(summary.totalWords) + ' words rated'));
  panel.append(heading, wordMeter(summary.assessed, summary.totalWords, 'Atlas words rated'));
  const bar = element('div', 'vocab-coverage-ratings');
  levels.forEach((label, level) => {
   const counter = rating(level, label, () => navigate('vocab/bank/' + level), 'vocab-count');
   counter.append(element('strong', '', number.format(summary.ratings[level])));
   bar.append(counter);
  });
  panel.append(bar, button('View progress', 'study-text-link', () => navigate('progress')));
  return panel;
 }
 function dailyDecks(summary) {
  const {target, started, completed, due} = status(summary), grid = element('div', 'vocab-decks');
  const fresh = element('section', 'study-section vocab-deck-tile');
  fresh.append(element('h2', '', 'New words'), element('p', '', completed + ' / ' + target + ' mastered today'),
   wordMeter(completed, target, 'New words mastered today'));
  const start = button(completed >= target ? 'Daily goal complete' : started ? 'Continue new words' : 'Learn ' + target + ' words',
   'study-cta', () => navigate('vocab/new'));
  start.disabled = completed >= target;
  fresh.append(start);
  const review = element('section', 'study-section vocab-deck-tile');
  review.append(element('h2', '', 'Review'), element('p', '', due ? words(due, 'word') + ' due today' : 'You’re caught up on reviews.'));
  const next = button('Review due words', 'study-button', () => navigate('vocab/review'));
  next.disabled = !due;
  review.append(next);grid.append(fresh, review);
  return grid;
 }
 function landing() {
  const summary = study.summary(model.nodes.length), content = element('div', 'vocab-landing');
  const banks = element('section', 'study-section vocab-banks');
  const heading = element('div', 'vocab-bank-heading');
  heading.append(element('h2', '', 'Word banks'), button('Find a word', 'study-text-link', () => navigate('words/find')));
  const grid = element('div', 'vocab-bank-grid');
  levels.forEach((label, level) => {
   const link = rating(level, label, () => navigate('vocab/bank/' + level), 'vocab-bank');
   link.append(element('strong', '', words(summary.ratings[level], 'word')));grid.append(link);
  });
  banks.append(heading, grid, button('All my words', 'study-text-link', () => navigate('words')));
  content.append(dailyDecks(summary), banks, coverage(summary));host.replaceChildren(content);
 }
 function landFromDeck() { navigate('vocab'); }
 function updateDay() {
  const day = study.day();
  if (day !== deckDay) { deckDay = day; skipped = new Set(); }
  return day;
 }
 function nextWord(day, {target, started}) {
  if (deck.mode === 'new') {
   if (started < target) {
    const fresh = discover(day,skipped);
    if (fresh) return fresh;
   }
   const word = study.newCardQueue().find(key => !skipped.has(key));
   return model.byWord.get(word) || null;
  }
  const word = study.reviewCards({level:deck.level, dueOnly:deck.level === undefined}).find(key => !skipped.has(key));
  return model.byWord.get(word) || null;
 }
 function finished(body, {target, completed, due}) {
  const title = deck.mode === 'new' ? (completed >= target ? 'Daily goal complete' : 'No more available cards') : 'Review complete';
  body.append(element('h2', '', title));
  if (deck.mode === 'new') body.append(element('p', '', completed + ' / ' + target + ' new words mastered today.'));
  const controls = element('div', 'vocab-card-actions');
  controls.append(button('Back to vocabulary', 'study-cta', landFromDeck));
  if (deck.mode === 'new' && due) controls.append(button('Review due words', 'study-button', () => navigate('vocab/review')));
  body.append(controls);
 }
 function stopVoice() {
  if (recognition) {
   const active = recognition;recognition = null;
   active.onresult = active.onerror = active.onend = null;
   active.abort?.();
  }
  if (speaking) { root.speechSynthesis?.cancel();speaking = null; }
 }
 function iconButton(name, kind, action) {
  const paths = {
   audio:'M3 9v6h4l5 4V5L7 9H3m12 1a3 3 0 0 1 0 4m2-7a7 7 0 0 1 0 10',
   mic:'M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3m6-4v1a6 6 0 0 1-12 0v-1m6 7v3m-3 0h6'
  };
  const control = button('', 'study-button vocab-icon', action);
  control.setAttribute('aria-label',name);control.title=name;
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns,'svg'), path = document.createElementNS(ns,'path');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  path.setAttribute('d',paths[kind]);svg.append(path);control.append(svg);
  return control;
 }
 function say(text, language, notice) {
  const synth = root.speechSynthesis, voice = synth?.getVoices().find(v => v.lang.toLowerCase().split(/[-_]/)[0] === language);
  if (!voice || !root.SpeechSynthesisUtterance) {
   notice.textContent = (language === 'az' ? 'Azerbaijani' : 'English') + ' audio is unavailable on this device.';return;
  }
  if (speaking) synth.cancel();
  const utterance = new root.SpeechSynthesisUtterance(text.replace(/___/g,'…'));
  utterance.lang = voice.lang;utterance.voice = voice;speaking = utterance;
  utterance.onend = () => { if (speaking === utterance) speaking = null; };
  synth.speak(utterance);
 }
 function dictate(control, input, language, notice) {
  if (recognition) { recognition.stop();return; }
  const Speech = root.SpeechRecognition || root.webkitSpeechRecognition;
  const fallback = 'Use the microphone on your keyboard to dictate, or type your guess.';
  if (!Speech) { input.focus();notice.textContent = fallback;return; }
  const active = new Speech();recognition = active;
  active.lang = language;active.interimResults = false;
  control.setAttribute('aria-pressed','true');notice.textContent = 'Listening…';
  function end() {
   if (recognition === active) recognition = null;
   control.setAttribute('aria-pressed','false');
   if (notice.textContent === 'Listening…') notice.textContent = '';
  }
  active.onresult = event => {
   if (recognition !== active) return;
   const text = Array.from(event.results).map(result => result[0].transcript).join(' ').trim();
   input.value = text.slice(0,360);input.dispatchEvent(new root.Event('input',{bubbles:true}));
   notice.textContent = '';input.focus();
  };
  active.onerror = () => { if (recognition === active) { notice.textContent = fallback;end(); } };
  active.onend = end;
  try { active.start(); } catch { notice.textContent = fallback;end(); }
 }
 function withDefinition(node, ready, fail) {
  if (model.primaryReady(node)) { ready();return; }
  try {
   const request = model.ensurePrimary(node);
   if (request === true) ready();
   else Promise.resolve(request).then(ready,fail);
  } catch { fail(); }
 }
 function withSenses(ready) {
  if (model.textLoaded()) { ready();return; }
  try {
   const request = model.ensureText();
   if (request === true) ready();
   else Promise.resolve(request).then(ready,ready);
  } catch { ready(); }
 }
 function definitionsFor(sense) {
  const definitions = element('div','vocab-definitions');
  for (const [label, lang] of [['Azərbaycan dilində','az'],['English','en']]) {
   if (!sense?.[lang]) continue;
   const line = element('div','vocab-definition'), meaning = element('p','',sense[lang]);
   meaning.lang = lang;line.append(element('span','',label),meaning);definitions.append(line);
  }
  return definitions;
 }
 function resultHeading(value, language) {
  const heading = element('h2','vocab-headword',value);heading.lang=language;heading.tabIndex=-1;
  return heading;
 }
 function explainGuess(body, node, prompt, guess) {
  const {kind,sense} = checker.assessMeaning(node,guess,model);
  const answer = element('div','vocab-answer'), title = resultHeading(node.w,'az');
  const label = {match:'Matches a dictionary sense',close:'Close to a dictionary sense',unmatched:'Compare your guess with the dictionary'}[kind];
  const callout = element('p','vocab-check-result',label);callout.dataset.result=kind;
  const entered = element('p','vocab-your-answer');
  entered.append(element('strong','','Your guess'),document.createTextNode(' ' + guess));
  answer.append(title,entered,callout,definitionsFor(sense));
  const extra = checker.sensePairs(node).filter(pair => pair.az !== sense?.az || pair.en !== sense?.en);
  if (extra.length) {
   const more = element('details','vocab-more-senses');more.append(element('summary','','Other dictionary senses'));
   for (const pair of extra) more.append(definitionsFor(pair));
   answer.append(more);
  }
  const legend = element('p','vocab-rating-question','Rate your recall');
  const actions = element('div','vocab-ratings vocab-compact-ratings');actions.setAttribute('role','group');actions.setAttribute('aria-label','Rate your recall');
  grades.forEach((label,level) => {
   const control = button(label,'vocab-rate',() => {
    if (!host.contains(control) || !deck) return;
    const checked = kind === 'match' ? true : null;
    if (!study.checkCard(prompt,deck.mode,checked,level)) { render(true,'This card was already updated.');return; }
    onChange();
    const updated = study.cardPrompt(node.w);
    const message = node.w + ' · ' + (updated.direction === 'headword' ? 'Green · English to Azerbaijani next' : stages[updated.rating]);
    render(true,message);
   });
   control.dataset.rating=String(level);actions.append(control);
  });
  answer.append(legend,actions);body.replaceChildren(answer);title.focus?.({preventScroll:true});
 }
 function checkHeadword(body, node, prompt, guess) {
  const right = checker.assessHeadword(node,guess,model);
  if (!study.checkCard(prompt,deck.mode,right)) { render(true,'This card was already updated.');return; }
  onChange();
  const tally = host.querySelector('.vocab-session-count');
  const {target,completed,due} = status();
  if (tally) tally.textContent = deck.mode === 'new' ? completed+' / '+target+' mastered' : words(due,'word')+' due';
  const answer = element('div','vocab-answer'), title = resultHeading(node.w,'az');
  const result = element('p','vocab-check-result',right ? 'Correct · Proficient' : 'Keep practising this word');
  result.dataset.result = right ? 'match' : 'unmatched';
  const entered = element('p','vocab-your-answer');
  entered.append(element('strong','','Your guess'),document.createTextNode(' ' + guess));
  answer.append(title,result,entered,definitionsFor({en:node.en,az:node.az}),
   button('Next card','study-cta',() => render(true)));
  body.replaceChildren(answer);title.focus?.({preventScroll:true});
 }
 function promptCard(body, node, prompt, cue) {
  const reverse = prompt.direction === 'headword', view = element('div','vocab-prompt');
  const promptLabel = element('p','vocab-question',reverse ? 'Recall the Azerbaijani word' : 'What does this word mean?');
  const stage = element('span','vocab-stage',reverse ? 'Final check' : prompt.rating === null ? 'New' : grades[prompt.rating]);
  if (reverse || prompt.rating !== null) stage.dataset.rating = String(reverse ? 3 : prompt.rating);
  const top = element('div','vocab-prompt-top');top.append(promptLabel,stage);
  const title = resultHeading(cue,reverse?'en':'az');
  if (reverse) title.classList.add('vocab-english-cue');
  const notice = element('p','vocab-voice-status');notice.setAttribute('role','status');
  const heading = element('div','vocab-prompt-heading');
  heading.append(title,iconButton('Read prompt aloud','audio',() => say(cue,reverse?'en':'az',notice)));
  const form = element('form','vocab-guess-form'), field = element('label','vocab-guess-field');
  const input = element('textarea','study-input');
  input.rows=2;input.maxLength=360;input.required=true;input.spellcheck=false;input.autocapitalize='none';input.autocomplete='off';
  input.lang=reverse?'az':'en';input.setAttribute('autocorrect','off');
  input.placeholder=reverse ? 'Type the Azerbaijani word' : 'In English or Azerbaijani';
  field.append(element('span','','Your guess'),input);
  const options = element('div','vocab-guess-options'), languages = element('select','study-input vocab-dictation-language');
  languages.setAttribute('aria-label','Dictation language');
  for (const [code,label] of [['en-US','EN'],['az-AZ','AZ']]) {
   const option = element('option','',label);option.value=code;languages.append(option);
  }
  const mic = iconButton('Dictate your guess','mic',() => dictate(mic,input,reverse?'az-AZ':languages.value||'en-US',notice));
  mic.setAttribute('aria-pressed','false');options.append(mic);
  if (!reverse) options.append(languages);
  const check = element('button','study-cta','Check guess');check.type='submit';check.disabled=true;options.append(check);
  input.addEventListener('input',() => { check.disabled=!input.value.trim(); });
  form.addEventListener('submit',event => {
   event.preventDefault();
   const guess = input.value.trim();
   if (!guess || check.disabled || !deck) return;
   stopVoice();mic.setAttribute('aria-pressed','false');
   if (reverse) { checkHeadword(body,node,prompt,guess);return; }
   check.disabled=true;notice.textContent='Checking dictionary senses…';
   withDefinition(node,() => withSenses(() => {
    if (!host.contains(form)) return;
    if (!checker.englishCue(node)) { unavailable(body,node,'This word needs an English definition for the final check.');return; }
    explainGuess(body,node,prompt,guess);
   }),() => { if (host.contains(form)) { notice.textContent='The definition couldn’t load. Try again.';check.disabled=false; } });
  });
  form.append(field,options,notice);view.append(top,heading,form);body.replaceChildren(view);
 }
 function unavailable(body, node, message) {
  const status = element('p','study-note',message);status.setAttribute('role','status');
  body.replaceChildren(status,button('Try another word','study-button',() => { skipped.add(node.w);render(true); }));
 }
 function reversePrompt(body, node, prompt, moveFocus) {
  body.replaceChildren(element('p','study-note','Loading the English meaning…'));
  function load() {
   withDefinition(node,() => {
    function show() {
     if (!host.contains(body)) return;
     const cue = checker.englishCue(node);
     if (!cue) { unavailable(body,node,'An English cue is unavailable for this word.');return; }
     promptCard(body,node,prompt,cue);
     if (moveFocus) body.querySelector('h2')?.focus?.({preventScroll:true});
    }
    if (checker.englishCue(node)) show();
    else withSenses(show);
   },() => {
    if (host.contains(body)) body.replaceChildren(element('p','study-note','The definition couldn’t load.'),button('Try again','study-button',load));
   });
  }
  load();
 }
 function render(moveFocus = false, message = '') {
  stopVoice();
  const day = updateDay(), counts = status(), node = nextWord(day, counts);
  const content = element('div','vocab-session');
  const toolbar = element('div','vocab-session-tools'), {target, completed, due} = counts;
  toolbar.append(button('Vocabulary','study-text-link',landFromDeck));
  if (deck.mode === 'new') toolbar.append(element('span','vocab-session-count',completed+' / '+target+' mastered'));
  else if (deck.level === undefined) toolbar.append(element('span','vocab-session-count',words(due,'word')+' due'));
  const body = element('section','study-section vocab-card');
  content.append(toolbar, body);
  const feedback = element('p','vocab-feedback',message);feedback.setAttribute('role','status');
  content.append(feedback);host.replaceChildren(content);
  if (!node) { finished(body,counts);if (moveFocus) body.querySelector('button')?.focus?.({preventScroll:true});return; }
  const prompt = study.cardPrompt(node.w);
  if (prompt.direction === 'headword') reversePrompt(body,node,prompt,moveFocus);
  else {
   promptCard(body,node,prompt,node.w);
   if (moveFocus) body.querySelector('h2')?.focus?.({preventScroll:true});
  }
 }
 function open(mode, level) {
  deck = {mode, level};skipped = new Set();render();
 }
 return {landing, open, status, coverage, close:() => { stopVoice();deck = null;host.replaceChildren(); }};
}

root.SozStudyVocab = {mount};
})(typeof window !== 'undefined' ? window : globalThis);
