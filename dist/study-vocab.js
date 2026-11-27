/* Flashcards and proficiency banks use the same records as the atlas and library. */
(function (root) {
'use strict';

const number = new Intl.NumberFormat('en');
const words = (total, noun) => number.format(total) + ' ' + noun + (total === 1 ? '' : 's');

function mount({host, study, model, navigate, discover, onChange}) {
 const document = host.ownerDocument, levels = root.SozStudyLibrary.levels;
 let deck = null, deckDay = null, skipped = new Set();

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
  const target = study.settings().newWords;
  return {target, completed:summary.today.newCards, due:summary.dueCards};
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
  const {target, completed, due} = status(summary), grid = element('div', 'vocab-decks');
  const fresh = element('section', 'study-section vocab-deck-tile');
  fresh.append(element('h2', '', 'New words'), element('p', '', completed + ' / ' + target + ' rated today'),
   wordMeter(completed, target, 'New words rated today'));
  const start = button(completed >= target ? 'Daily goal complete' : completed ? 'Continue new words' : 'Learn ' + target + ' words',
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
 function nextWord(day, {target, completed}) {
  if (deck.mode === 'new') {
   if (completed >= target) return null;
   return discover(day, skipped);
  }
  const word = study.reviewCards({level:deck.level, dueOnly:deck.level === undefined}).find(key => !skipped.has(key));
  return model.byWord.get(word) || null;
 }
 function finished(body, {target, completed, due}) {
  const title = deck.mode === 'new' ? (completed >= target ? 'Daily goal complete' : 'End of this deck') : 'Review complete';
  body.append(element('h2', '', title));
  if (deck.mode === 'new') body.append(element('p', '', completed + ' / ' + target + ' new words rated today.'));
  const controls = element('div', 'vocab-card-actions');
  controls.append(button('Back to vocabulary', 'study-cta', landFromDeck));
  if (deck.mode === 'new' && due) controls.append(button('Review due words', 'study-button', () => navigate('vocab/review')));
  body.append(controls);
 }
 function reveal(body, node, session) {
  const answer = element('div', 'vocab-answer'), title = element('h2', 'vocab-headword', node.w);
  title.lang = 'az';title.tabIndex = -1;
  const definitions = element('div', 'vocab-definitions'), actions = element('div', 'vocab-ratings');
  actions.setAttribute('role', 'group');actions.setAttribute('aria-label', 'Rate your knowledge');
  const question = element('p', 'vocab-rating-question', 'How well did you know it?');
  answer.append(title, definitions, question, actions);body.replaceChildren(answer);
  const controls = levels.map((label, level) => {
   const control = rating(level, label, () => {
    if (deck !== session || !host.contains(control)) return;
    if (study.day() !== deckDay) { render(true);return; }
    const recorded = study.rateCard(node.w, level, deck.mode);
    if (recorded) onChange();
    render(true, recorded ? node.w + ' · ' + label : 'This card has already been updated.');
   }, 'vocab-rate');
   control.disabled = true;actions.append(control);
   return control;
  });
  function showDefinitions() {
   if (!host.contains(answer)) return;
   definitions.replaceChildren();
   for (const [label, lang, text] of [['Azərbaycan dilində','az',node.az],['English','en',node.en]]) {
    if (!text) continue;
    const line = element('div','vocab-definition');
    const meaning = element('p','',text);meaning.lang = lang;
    line.append(element('span','',label), meaning);definitions.append(line);
   }
   if (node.az || node.en) {
    for (const control of controls) control.disabled = false;
    return;
   }
   definitions.append(element('p','study-note','A definition is unavailable for this word. Use Skip to keep going.'));
  }
  function load() {
   if (model.primaryReady(node)) { showDefinitions();return; }
   definitions.replaceChildren(element('p','study-note','Loading the definition…'));
   function failed() {
    if (!host.contains(answer)) return;
    definitions.replaceChildren(element('p','study-note','The definition couldn’t load.'), button('Try again','study-button',load));
   }
   try {
    const request = model.ensurePrimary(node);
    if (request === true) showDefinitions();
    else Promise.resolve(request).then(showDefinitions, failed);
   } catch { failed(); }
  }
  load();title.focus?.({preventScroll:true});
 }
 function render(moveFocus = false, message = '') {
  const day = updateDay(), counts = status(), node = nextWord(day, counts), session = deck;
  const content = element('div','vocab-session');
  const toolbar = element('div','vocab-session-tools'), {target, completed, due} = counts;
  toolbar.append(button('Vocabulary','study-text-link',landFromDeck));
  if (deck.mode === 'new') toolbar.append(element('span','',''+completed+' / '+target+' rated'));
  else if (deck.level === undefined) toolbar.append(element('span','',words(due,'word')+' due'));
  const body = element('section','study-section vocab-card');
  content.append(toolbar, body);
  if (node) {
   const front = button('','vocab-front',() => reveal(body, node, session));
   front.setAttribute('aria-label','Reveal the meaning of '+node.w);
   const head = element('span','vocab-headword',node.w);head.lang = 'az';
   front.append(head, element('span','vocab-instruction','Tap to reveal meaning'));body.append(front);
   const skip = button('Skip','study-text-link',() => { skipped.add(node.w);render(true); });
   const controls = element('div','vocab-card-actions');controls.append(skip);content.append(controls);
  } else finished(body, counts);
  const feedback = element('p','vocab-feedback',message);feedback.setAttribute('role','status');
  content.append(feedback);host.replaceChildren(content);
  if (moveFocus) body.querySelector('button')?.focus?.({preventScroll:true});
 }
 function open(mode, level) {
  deck = {mode, level};skipped = new Set();render();
 }
 return {landing, open, status, coverage, close:() => { deck = null;host.replaceChildren(); }};
}

root.SozStudyVocab = {mount};
})(typeof window !== 'undefined' ? window : globalThis);
