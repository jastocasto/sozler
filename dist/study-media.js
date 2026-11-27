(function(root){
'use strict';

let formCount = 0;

function safeURL(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}

function timeLabel(value) {
  if (value == null || !Number.isFinite(value) || value < 0) return '';
  const seconds = Math.floor(value), minutes = Math.floor(seconds / 60);
  const two = n => String(n).padStart(2, '0');
  return (minutes >= 60 ? Math.floor(minutes / 60) + ':' + two(minutes % 60) : minutes) + ':' + two(seconds % 60);
}

function timestamp(value) {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d{1,6}(?::[0-5]\d){0,2}$/.test(text)) return NaN;
  return text.split(':').reduce((total, group) => total * 60 + Number(group), 0);
}

function isYouTubeVideo(url) {
  if (url.hostname === 'youtu.be') return /^\/[\w-]+\/?$/.test(url.pathname);
  return ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) &&
    ((url.pathname === '/watch' && !!url.searchParams.get('v')) || /^\/(shorts|live)\/[\w-]+\/?$/.test(url.pathname));
}

function linkAtTime(value, seconds) {
  const url = safeURL(value);
  if (!url) return '';
  if (Number.isInteger(seconds) && seconds >= 0 && isYouTubeVideo(url)) {
    url.searchParams.set('t', seconds + 's');
    if (/^#t=/.test(url.hash)) url.hash = '';
  }
  return url.href;
}

function sourceTime(value) {
  const url = safeURL(value);
  if (!url || !isYouTubeVideo(url)) return null;
  const t = url.searchParams.get('t') ?? url.searchParams.get('start') ?? '';
  const match = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(\d+)s?$/);
  return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3]) : null;
}

function mount({host, study, model, sources = [], onChange = () => {}}) {
  const doc = host.ownerDocument, win = doc.defaultView || root;
  const trusted = sources.filter(s => s.id && s.name && safeURL(s.url));
  let guide = trusted[0], mode = guide ? 'guide' : 'file';
  let file = null, player = null, objectURL = '', position = 0, from = 0, to = 0, looping = false;
  let listen = null, heard = false, rate = 1, replacement = null, suggestionTimer = 0;
  let wordReview = null;
  const opened = new Set();
  const now = () => win.performance.now();
  const today = () => study.day();
  const savedHere = () => study.status().persistent ? '' : ' Browser storage is unavailable. Export a backup to keep it.';

  function element(tag, cls, text) {
    const item = doc.createElement(tag);
    if (cls) item.className = cls;
    if (text != null) item.textContent = text;
    return item;
  }
  function button(text, action, click, cls = 'study-button') {
    const result = element('button', cls, text);
    result.type = 'button';
    result.dataset.mediaAction = action;
    result.addEventListener('click', click);
    return result;
  }
  function field(label, control) {
    const container = element('label', 'study-media-field');
    container.append(element('span', '', label), control);
    return container;
  }
  function message() {
    const result = element('p', 'study-note study-media-status');
    result.setAttribute('role', 'status');
    return result;
  }
  function external(text) {
    const link = element('a', 'study-button study-media-link', text);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  const panel = element('section', 'study-section study-media');
  const heading = element('div', 'study-section-heading');
  heading.append(element('h2', '', 'Listening notebook'), element('p', '', 'Keep the exact words you want to catch next time.'));
  const tabs = element('div', 'study-segmented study-media-controls');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Listening material');
  const guideTab = button('Interview excerpts', 'guides', () => chooseMode('guide'));
  const fileTab = button('My recording', 'file', () => chooseMode('file'));
  tabs.append(guideTab, fileTab);
  guideTab.hidden = !trusted.length;
  panel.append(heading, tabs);

  const guideSection = element('section', 'study-media-guide');
  const guideSelect = element('select', 'study-input');
  for (const source of trusted) {
    const option = element('option', '', source.title ? source.name + ' · ' + source.title : source.name);
    option.value = source.id;
    guideSelect.append(option);
  }
  const guideTitle = element('h3');
  guideTitle.lang = 'az';
  const prompt = element('p'), sourceLink = external('Open excerpt'), guideStatus = message();
  const guideActions = element('div', 'study-media-controls');
  const gist = button('I could explain it unaided', 'gist', () => finishGuide(true));
  const replayed = button('I needed captions or a replay', 'supported', () => finishGuide(false));
  guideActions.append(gist, replayed);
  guideSection.append(field('Programme', guideSelect), guideTitle, prompt, sourceLink,
    element('p', 'study-note', 'Listen once at normal speed with captions off. Give the gist aloud before checking the speaker’s words.'),
    guideActions, guideStatus);
  guideSelect.addEventListener('change', () => { selectGuide(guideSelect.value); });
  sourceLink.addEventListener('click', () => {
    opened.add(guideAttempt());
    updateGuideCheck();
    saveDraft();
  });
  panel.append(guideSection);

  // A saved passage has its own view so opening a review never replaces the capture draft.
  const reviewSection = element('section', 'study-media-review');
  const reviewTitle = element('h3'), reviewPrompt = element('p');
  reviewTitle.lang = 'az';
  const reviewLink = external('Open saved passage'), reviewDetail = element('details');
  const reviewText = element('p');
  reviewText.lang = 'az';
  reviewDetail.append(element('summary', '', 'Reveal the saved phrase'), reviewText);
  const wordCheck = element('div', 'study-media-controls'), reviewStatus = message();
  const caught = button('I understood it at normal speed', 'word-heard', () => finishReview(true));
  const helped = button('I needed help with this word', 'word-supported', () => finishReview(false));
  wordCheck.append(caught, helped);
  reviewSection.append(reviewTitle, reviewPrompt, reviewLink, reviewDetail, wordCheck, reviewStatus);
  reviewSection.hidden = true;
  panel.append(reviewSection);
  reviewLink.addEventListener('click', () => {
    if (!wordReview) return;
    opened.add(reviewAttempt()); saveDraft(); updateReview();
  });
  reviewDetail.addEventListener('toggle', () => {
    if (wordReview && reviewDetail.open) { wordReview.hinted = true; updateReview(); }
  });

  const localSection = element('section', 'study-media-local');
  const fileInput = element('input', 'study-input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*,video/*,.aac,.m4a,.m4v,.mov,.mp3,.mp4,.ogg,.oga,.opus,.wav,.webm';
  const playerHost = element('div', 'study-media-player'), controls = element('div', 'study-media-controls');
  const passage = element('p', 'study-note'), playbackStatus = message();
  const markStart = button('Set start here', 'start', () => mark(true));
  const markEnd = button('Set end here', 'end', () => mark(false));
  const loop = button('Loop passage', 'loop', () => {
    looping = !looping;
    cancelListen();
    if (looping) { player.currentTime = from; play(); } else player.pause();
    updatePlayer();
  });
  const slower = button('0.8×', 'slower', () => setRate(.8));
  const normal = button('1×', 'normal', () => setRate(1));
  const clean = button('Listen once at normal speed', 'listen', startListen);
  const heardButton = button('I understood this word unaided', 'heard', logLocal);
  controls.append(markStart, markEnd, loop, slower, normal, clean);
  localSection.append(element('h3', '', 'Repeat a passage'), field('Audio or video from this device', fileInput),
    element('p', 'study-note', 'Your player opens the original file on this device. Your backup keeps the phrases and time marks you save.'),
    playerHost, passage, controls, playbackStatus, heardButton);
  panel.append(localSection);

  const form = element('form', 'study-media-form');
  form.noValidate = true;
  const word = element('input', 'study-input'), quote = element('textarea', 'study-input');
  word.type = 'text';
  word.maxLength = 160;
  word.lang = quote.lang = 'az';
  word.autocomplete = 'off';
  word.spellcheck = false;
  quote.rows = 3;
  quote.maxLength = 600;
  const choices = element('datalist');
  choices.id = 'study-media-words-' + ++formCount;
  word.setAttribute('list', choices.id);
  const sourceField = element('input', 'study-input'), at = element('input', 'study-input');
  sourceField.type = 'url';
  sourceField.maxLength = 2048;
  sourceField.placeholder = 'https://…';
  at.type = 'text';
  at.placeholder = '9:28';
  at.maxLength = 12;
  const attach = button('Use this passage', 'attach', () => populateSource(true));
  const revisit = external('Open saved position');
  const links = element('div', 'study-media-controls');
  links.append(attach, revisit);
  const save = element('button', 'study-button', 'Save phrase to my library');
  save.type = 'submit';
  save.dataset.mediaAction = 'save';
  const saveStatus = message(), confirm = element('div', 'study-media-confirm');
  confirm.hidden = true;
  form.append(element('h3', '', 'Keep a phrase'), field('Dictionary word', word), choices,
    field('Phrase in Azerbaijani', quote), field('Source link (optional)', sourceField),
    field('Time in the recording (optional)', at), links, save, saveStatus, confirm);
  panel.append(form);
  form.addEventListener('submit', e => { e.preventDefault(); savePhrase(false); });
  form.addEventListener('input', () => {
    replacement = null;
    confirm.hidden = true;
    saveStatus.textContent = '';
    updateCapture();
    saveDraft();
  });
  word.addEventListener('input', () => {
    clearTimeout(suggestionTimer);
    const term = word.value.trim();
    choices.replaceChildren();
    if (term.length < 2) return;
    suggestionTimer = setTimeout(() => {
      for (const node of model.search(term, 5)) {
        const option = element('option'); option.value = node.w; choices.append(option);
      }
    }, 180);
  });
  fileInput.addEventListener('change', () => {
    const next = fileInput.files?.[0];
    if (!next) return;
    if (!/^(audio|video)\//.test(next.type) && !/\.(aac|m4a|m4v|mov|mp3|mp4|oga|ogg|opus|wav|webm)$/i.test(next.name)) {
      playbackStatus.textContent = 'Choose an audio or video file.';
      return;
    }
    detachPlayer();
    file = next; position = from = wordReview?.seconds ?? 0; to = from + 10; rate = 1;
    attachPlayer();
  });

  function guideAttempt() { return 'media:' + today() + ':' + guide.id; }
  function selectGuide(id) {
    guide = trusted.find(s => s.id === id) || trusted[0];
    if (!guide) return;
    const option = Array.from(guideSelect.options).find(o => o.value === guide.id);
    if (option) option.selected = true;
    guideTitle.textContent = guide.title || guide.name;
    prompt.textContent = guide.prompt || '';
    sourceLink.textContent = 'Listen to ' + guide.name;
    sourceLink.href = guide.url;
    if (!quote.value.trim() && !word.value.trim()) populateSource(false);
    updateGuideCheck();
  }
  function updateGuideCheck() {
    if (!guide) return;
    const id = guideAttempt(), done = study.hasAttempt(id);
    gist.disabled = replayed.disabled = done || !opened.has(id);
    guideStatus.textContent = done ? 'Your listening self-check is recorded for today.' + savedHere()
      : opened.has(id) ? 'When you return from the excerpt, report how the first listen went.' : '';
  }
  function finishGuide(correct) {
    const id = guideAttempt();
    if (!opened.has(id) || study.hasAttempt(id)) return;
    study.record({id, kind:'lesson', key:guide.id, channel:'listen',
      correct, condition:correct ? 'normal' : 'replay', selfReported:true});
    updateGuideCheck();
    onChange();
  }
  function saveDraft() {
    try {
      win.sessionStorage.setItem('soz:media:draft', JSON.stringify({word:word.value, quote:quote.value,
        source:sourceField.value, at:at.value, opened:[...opened].slice(-8), guideId:guide?.id, mode}));
    } catch {}
  }
  function restoreDraft() {
    try {
      const data = JSON.parse(win.sessionStorage.getItem('soz:media:draft'));
      if (!data || typeof data !== 'object') return;
      for (const [input, key, cap] of [[word,'word',160],[quote,'quote',600],[sourceField,'source',2048],[at,'at',12]]) {
        if (typeof data[key] === 'string') input.value = data[key].slice(0, cap);
      }
      if (Array.isArray(data.opened)) for (const id of data.opened.slice(-8)) if (typeof id === 'string') opened.add(id);
      guide = trusted.find(s => s.id === data.guideId) || guide;
      if (data.mode === 'file') mode = 'file';
    } catch {}
  }
  function chooseMode(next) {
    mode = next === 'guide' && guide ? 'guide' : 'file';
    guideSection.hidden = mode !== 'guide';
    localSection.hidden = mode !== 'file';
    guideTab.setAttribute('aria-pressed', String(mode === 'guide'));
    fileTab.setAttribute('aria-pressed', String(mode === 'file'));
    if (mode === 'guide') { detachPlayer(); selectGuide(guide.id); }
    else {
      if (file && !player) attachPlayer();
      if (!quote.value.trim() && !word.value.trim()) populateSource(false);
    }
    updatePlayer(); updateCapture(); saveDraft();
  }
  function populateSource(explicit) {
    if (mode === 'guide' && guide) {
      sourceField.value = guide.url;
      at.value = timeLabel(sourceTime(guide.url));
    } else {
      if (!explicit) sourceField.value = '';
      at.value = file ? timeLabel(from) : '';
    }
    replacement = null; confirm.hidden = true;
    updateCapture(); saveDraft();
  }
  function updateCapture() {
    const seconds = timestamp(at.value);
    const href = linkAtTime(sourceField.value.trim(), seconds);
    revisit.hidden = !href || Number.isNaN(seconds);
    if (href) revisit.href = href; else revisit.removeAttribute('href');
    const url = href && safeURL(href);
    revisit.textContent = url && isYouTubeVideo(url) && seconds != null ? 'Open at ' + timeLabel(seconds)
      : seconds != null && Number.isFinite(seconds) ? 'Open source · ' + timeLabel(seconds) : 'Open source';
    attach.disabled = mode === 'file' && !file;
    heardButton.disabled = !heard || !word.value.trim();
    updateReview();
  }

  function reviewAttempt() { return 'media-word:' + today() + ':' + wordReview.word; }
  function updateReview() {
    if (!wordReview) return;
    const id = reviewAttempt(), done = study.hasAttempt(id);
    const listened = wordReview.source ? opened.has(id) : heard;
    caught.disabled = done || !listened || wordReview.hinted;
    helped.disabled = done || !listened;
    reviewStatus.textContent = done ? 'Your listening self-check for this word is recorded for today.' + savedHere()
      : wordReview.hinted ? 'You revealed the saved phrase. You can record this pass as supported.'
      : listened ? 'Say what the word meant in this passage, then record your self-check.' : '';
  }
  function finishReview(correct) {
    if (!wordReview) return;
    const id = reviewAttempt(), listened = wordReview.source ? opened.has(id) : heard;
    if (!listened || study.hasAttempt(id) || correct && (wordReview.hinted || reviewDetail.open)) return;
    study.record({id,kind:'word',key:wordReview.word,channel:'listen',condition:correct ? 'normal' : 'replay',
      correct,selfReported:true});
    updateReview(); onChange();
  }

  function savePhrase(approved) {
    const node = model.resolveWord(word.value.trim()), text = quote.value.trim();
    const address = sourceField.value.trim(), seconds = timestamp(at.value);
    function fail(msg, field) { saveStatus.textContent = msg; field.focus(); return false; }
    if (!node) return fail('Choose a dictionary word for this phrase.', word);
    if (!text || text.length > 600) return fail('Enter a phrase of up to 600 characters.', quote);
    const source = address ? safeURL(address)?.href : '';
    if (address && (!source || source.length > 2048)) return fail('Enter a full http or https source address.', sourceField);
    if (Number.isNaN(seconds) || seconds > 31536000) return fail('Use seconds, minutes:seconds, or hours:minutes:seconds.', at);
    study.refresh();
    const old = study.word(node.w)?.context;
    const before = JSON.stringify([old?.text || '',old?.source || '',old?.seconds ?? null]);
    const after = JSON.stringify([text,source,seconds]);
    if (old && (old.text || old.source || old.seconds != null) && before !== after) {
      if (!approved || replacement !== before) {
        replacement = before;
        confirm.hidden = false;
        const existing = element('p', '', 'Already saved for ' + node.w + ': ' + (old.text || old.source || timeLabel(old.seconds)));
        const replace = button('Replace saved phrase', 'replace', () => savePhrase(true));
        const keep = button('Keep existing phrase', 'keep', () => {
          confirm.hidden = true; replacement = null; saveStatus.textContent = 'Your original phrase is still saved.'; save.focus();
        });
        confirm.replaceChildren(existing, replace, keep);
        saveStatus.textContent = 'Choose which phrase to keep with this word.';
        replace.focus();
        return false;
      }
    }
    try {
      study.setContext(node.w, {text,source,seconds});
    } catch {
      return fail('This phrase could not be saved. Your draft is here to edit.', quote);
    }
    word.value = node.w;
    replacement = null; confirm.hidden = true;
    saveStatus.textContent = 'Saved in your library under ' + node.w + '.' + savedHere();
    saveDraft(); onChange();
    return true;
  }

  function cancelListen() { listen = null; heard = false; updateCapture(); }
  function usable() { return !!player && Number.isFinite(player.duration) && player.duration > 0; }
  function updatePlayer() {
    const loaded = usable(), bounded = loaded && to > from + .15;
    markStart.disabled = markEnd.disabled = slower.disabled = normal.disabled = !loaded;
    clean.disabled = loop.disabled = !bounded;
    loop.setAttribute('aria-pressed', String(looping));
    slower.setAttribute('aria-pressed', String(rate === .8));
    normal.setAttribute('aria-pressed', String(rate === 1));
    passage.textContent = bounded ? 'Passage · ' + timeLabel(from) + ' – ' + timeLabel(to) : '';
    heardButton.hidden = !file || !!wordReview; updateCapture();
  }
  function play() {
    const active = player;
    active?.play()?.catch(() => {
      if (active !== player) return;
      cancelListen(); looping = false; updatePlayer();
      playbackStatus.textContent = 'Press play in the player or choose another recording.';
    });
  }
  function setRate(value) {
    if (!player) return;
    cancelListen();
    rate = value; player.playbackRate = rate; updatePlayer();
  }
  function mark(start) {
    if (!usable()) return;
    const t = Math.min(player.duration, Math.max(0, player.currentTime));
    if (start && t >= player.duration - .15 || !start && t <= from + .15) {
      playbackStatus.textContent = start ? 'Set the start before the recording ends.' : 'Choose an end after the start.';
      return;
    }
    if (start) {
      from = t;
      if (to <= from + .15) to = Math.min(from + 10, player.duration);
    } else to = t;
    looping = false; cancelListen(); playbackStatus.textContent = ''; updatePlayer();
  }
  function startListen() {
    if (!usable() || to <= from + .15) return;
    if (player.muted || player.volume === 0) {
      playbackStatus.textContent = 'Turn on the player’s sound for the listening check.'; return;
    }
    if (Array.from(player.textTracks || []).some(track => track.mode === 'showing' && ['captions','subtitles'].includes(track.kind))) {
      playbackStatus.textContent = 'Turn off captions for this unaided listening check.'; return;
    }
    setRate(1); looping = false;
    listen = {last:from, wall:now(), travelled:0};
    player.currentTime = from;
    playbackStatus.textContent = 'Listen once and give the meaning aloud before checking your phrase.';
    play(); updatePlayer();
  }
  function updateTime() {
    if (!player) return;
    const t = player.currentTime, wall = now();
    if (listen && !player.seeking) {
      const advance = Math.min(t,to) - listen.last;
      if (player.muted || player.volume === 0 || player.playbackRate !== 1 || advance < -.08 ||
          advance > (wall - listen.wall) / 1000 + .4) {
        cancelListen();
      } else {
        listen.travelled += Math.max(0, advance);
        listen.last = Math.max(listen.last, Math.min(t,to)); listen.wall = wall;
      }
    }
    if (listen && t >= to - .045 && listen.travelled >= (to - from) * .93) {
      listen = null; heard = true; player.pause();
      playbackStatus.textContent = wordReview ? 'The normal-speed passage is complete. Record your listening self-check.'
        : 'Name the word below. If you understood it before checking, record your listening self-check.';
      updateCapture();
    } else if (looping && t >= to - .025) {
      player.currentTime = from;
      if (player.paused) play();
    }
  }
  function attachPlayer() {
    if (!file || player) return;
    const isVideo = file.type.startsWith('video/') || (!file.type && /\.(mov|mp4|m4v|webm)$/i.test(file.name));
    const active = element(isVideo ? 'video' : 'audio');
    try { objectURL = win.URL.createObjectURL(file); }
    catch { playbackStatus.textContent = 'Local playback is unavailable here. You can still save a phrase below.'; return; }
    player = active; active.controls = true; active.preload = 'metadata'; active.setAttribute('playsinline', '');
    active.setAttribute('aria-label', 'Your recording'); playerHost.replaceChildren(active);
    const current = callback => () => { if (player === active) callback(); };
    active.addEventListener('loadedmetadata', current(() => {
      if (!usable()) { playbackStatus.textContent = 'The recording has no playable duration.'; return; }
      if (from >= player.duration) playbackStatus.textContent = 'The bookmarked time is beyond this file. Choose the original recording or set a new start below.';
      from = Math.min(from, player.duration); to = Math.min(to || 10, player.duration);
      player.currentTime = Math.min(position, player.duration); player.playbackRate = rate;
      updatePlayer();
    }));
    active.addEventListener('timeupdate', current(updateTime));
    active.addEventListener('ended', current(updateTime));
    active.addEventListener('play', current(() => { if (heard) cancelListen(); }));
    active.addEventListener('seeking', current(() => {
      if (heard || listen && (listen.travelled > .05 || Math.abs(active.currentTime - from) > .15)) cancelListen();
    }));
    active.textTracks?.addEventListener?.('change', current(() => {
      if (Array.from(active.textTracks).some(t => t.mode === 'showing' && ['captions','subtitles'].includes(t.kind))) cancelListen();
    }));
    active.addEventListener('ratechange', current(() => {
      rate = active.playbackRate;
      if (rate !== 1) cancelListen();
      updatePlayer();
    }));
    active.addEventListener('volumechange', current(() => { if (active.muted || active.volume === 0) cancelListen(); }));
    active.addEventListener('error', current(() => {
      cancelListen(); looping = false; playbackStatus.textContent = 'This file could not be played. You can choose another recording.';
    }));
    active.src = objectURL; playbackStatus.textContent = ''; updatePlayer();
  }
  function detachPlayer() {
    const active = player;
    if (!active) return;
    position = active.currentTime || 0; player = null; looping = false; cancelListen();
    active.pause(); active.removeAttribute('src'); active.load(); playerHost.replaceChildren();
    win.URL.revokeObjectURL(objectURL); objectURL = '';
  }
  function logLocal() {
    if (!heard || !file) return;
    const node = model.resolveWord(word.value.trim());
    if (!node) { playbackStatus.textContent = 'Choose the dictionary word you understood in the passage.'; word.focus(); return; }
    // Retain a stable attempt ID without putting local filenames into the learning record.
    const detail = [file.name,file.size,file.lastModified,from.toFixed(1),to.toFixed(1),node.w].join('|');
    let hash = 2166136261;
    for (const char of detail) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
    const id = 'media-local:' + today() + ':' + (hash >>> 0).toString(36);
    study.record({id,kind:'word',key:node.w,channel:'listen',condition:'normal',correct:true,selfReported:true});
    heard = false; updateCapture();
    playbackStatus.textContent = 'Your normal-speed listening self-check for ' + node.w + ' is recorded.' + savedHere();
    onChange();
  }
  function leaveWordReview() {
    if (!wordReview) return;
    detachPlayer();
    ({file,position,from,to,rate} = wordReview.previous);
    wordReview = null; heard = false; reviewSection.hidden = true;
    tabs.hidden = form.hidden = false; playbackStatus.textContent = '';
    fileInput.value = '';
  }
  function open(sourceId, savedWord) {
    if (panel.parentNode !== host) host.replaceChildren(panel);
    const node = savedWord && model.resolveWord(savedWord);
    const record = node && study.word(node.w);
    if (wordReview && record?.key === wordReview.word) { updateReview(); return; }
    leaveWordReview();
    if (record) {
      const context = record.context, fallback = trusted.find(s => s.id === sourceId);
      const source = linkAtTime(context.source || fallback?.url || '', context.seconds);
      detachPlayer();
      wordReview = {word:node.w,source,seconds:context.seconds,hinted:false,previous:{file,position,from,to,rate}};
      file = null; position = from = context.seconds ?? 0; to = from + 10; rate = 1; fileInput.value = '';
      reviewSection.hidden = false; tabs.hidden = form.hidden = guideSection.hidden = true; localSection.hidden = !!source;
      reviewTitle.textContent = node.w;
      const atTime = context.seconds != null ? ' at ' + timeLabel(context.seconds) : '';
      reviewPrompt.textContent = source ? 'Open your source' + atTime + '. Listen once at normal speed before checking the saved phrase.'
        : 'Choose the original recording. Replay the passage' + atTime + ' at normal speed before checking the saved phrase.';
      reviewLink.hidden = !source;
      if (source) { reviewLink.href = source; reviewLink.textContent = 'Open saved passage' + atTime; } else reviewLink.removeAttribute('href');
      reviewDetail.hidden = !context.text; reviewDetail.open = false; reviewText.textContent = context.text;
      // Keep the two self-check buttons beside the local player when working from a file.
      if (source) reviewSection.append(wordCheck,reviewStatus); else localSection.append(wordCheck,reviewStatus);
      updatePlayer();
      return;
    }
    reviewSection.append(wordCheck,reviewStatus);
    if (sourceId && trusted.some(s => s.id === sourceId)) {
      guide = trusted.find(s => s.id === sourceId); mode = 'guide';
    }
    chooseMode(mode);
  }
  function close() {
    clearTimeout(suggestionTimer); detachPlayer(); leaveWordReview(); saveDraft();
  }
  restoreDraft();
  return {open, close};
}
const api = {mount, linkAtTime, timeLabel};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.SozStudyMedia = api;
})(typeof window !== 'undefined' ? window : globalThis);
