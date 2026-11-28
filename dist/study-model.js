/* Personal study records. The event journal can be merged across backups without adding the same practice twice. */
(function (root) {
'use strict';

const format = 'sozler-personal-study';
const prefix = 'soz-toxumasi:study:v1:';
const channels = ['recognize', 'listen', 'recall', 'use'];
const conditions = ['normal', 'slower', 'replay', 'transcript', 'independent', 'supported'];
const intervals = [1, 3, 7, 14, 30, 60, 120, 180];
const cardIntervals = [1, 3, 7];
const cardDecks = ['new', 'review'];
const dayMs = 86400000;
const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone:'Asia/Baku', year:'numeric', month:'2-digit', day:'2-digit'
});
let lastMinute = null, lastDay = null;

function dayKey(time = Date.now()) {
  const date = new Date(time), minute = Math.floor(date.getTime() / 60000);
  if (minute === lastMinute) return lastDay;
  const parts = calendar.formatToParts(date);
  const value = type => parts.find(part => part.type === type).value;
  lastMinute = minute;
  lastDay = value('year') + '-' + value('month') + '-' + value('day');
  return lastDay;
}

function plusDays(day, amount) {
  return new Date(Date.parse(day + 'T00:00:00Z') + amount * dayMs).toISOString().slice(0, 10);
}

function freshId() {
  return root.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function checkedLabel(value, maximum, name) {
  if (typeof value !== 'string') throw new Error('Invalid ' + name);
  const label = value.trim().normalize('NFC');
  if (!label || label.length > maximum || /[\u0000-\u001f\u007f]/u.test(label)) throw new Error('Invalid ' + name);
  return label;
}

function checkedRating(rating) {
  if (rating !== null && (!Number.isInteger(rating) || rating < 0 || rating > 3)) throw new Error('Invalid word rating');
  return rating;
}

function checkedSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid study settings');
  const result = {};
  if ('minutes' in value) {
    if (!Number.isInteger(value.minutes) || value.minutes < 5 || value.minutes > 90) throw new Error('Daily minutes must be between 5 and 90');
    result.minutes = value.minutes;
  }
  if ('speaking' in value) {
    if (typeof value.speaking !== 'boolean') throw new Error('Invalid speaking preference');
    result.speaking = value.speaking;
  }
  if ('newWords' in value) {
    if (!Number.isInteger(value.newWords) || value.newWords < 1 || value.newWords > 30) throw new Error('Choose from 1 to 30 new words per day');
    result.newWords = value.newWords;
  }
  if ('startPage' in value) {
    if (value.startPage !== 'atlas' && value.startPage !== 'today') throw new Error('Choose the atlas or today’s practice');
    result.startPage = value.startPage;
  }
  if (!Object.keys(result).length || Object.keys(value).some(key => !Object.hasOwn(result, key))) throw new Error('Unknown study setting');
  return result;
}

function checkedContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid word context');
  const {text = '', source = '', seconds = null} = value;
  if (typeof text !== 'string' || text.length > 600 || /[\u0000-\u0008\u000e-\u001f\u007f]/u.test(text)) throw new Error('An excerpt can contain up to 600 characters');
  if (typeof source !== 'string' || source.length > 2048) throw new Error('Invalid source URL');
  let address = source.trim();
  if (address) {
    const url = new URL(address);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('Use an http or https source URL');
    address = url.href;
    if (address.length > 2048) throw new Error('Source URL too long');
  }
  if (seconds !== null && (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 31536000)) throw new Error('Invalid time in recording');
  return {text:text.trim().normalize('NFC'), source:address, seconds};
}

function checkedReading(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid reading note');
  const {title, page = '', pageId, excerpt} = value;
  const note = checkedContext({text:excerpt}).text;
  if (!note || typeof pageId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(pageId)) throw new Error('Invalid reading excerpt');
  return {title:checkedLabel(title, 140, 'book title'), page:page === '' ? '' : checkedLabel(page, 20, 'page number'), pageId, excerpt:note};
}

function compareEvents(a, b) {
  return a.at - b.at || a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function eventKey(event) {
  return (event.op === 'answer' ? 'answer:' : 'edit:') + event.id;
}

function newEvidence() {
  return {attempts:0, correct:0, days:0, last:null, lastCorrect:null, due:null, step:0,
    unaided:0, unaidedDays:0, lastUnaided:null, selfReported:0, selfReportedCorrect:0, conditions:{}};
}

function newItem(kind, key, day) {
  return {kind, key, rating:null, added:day, last:null, updated:day, due:day, nextChannel:null,
    context:{text:'', source:'', seconds:null}, reading:null, cardRecall:false,
    evidence:Object.fromEntries(channels.map(channel => [channel, newEvidence()]))};
}

function updateEvidence(stat, event, day) {
  const differentDay = stat.last !== day;
  stat.attempts++;
  if (differentDay) stat.days++;
  if (event.correct) stat.correct++;
  if (event.selfReported) {
    stat.selfReported++;
    if (event.correct) stat.selfReportedCorrect++;
  }
  if (event.condition) {
    const count = stat.conditions[event.condition] || (stat.conditions[event.condition] = {attempts:0, correct:0});
    count.attempts++;
    if (event.correct) count.correct++;
  }
  const firstPass = event.channel === 'listen' && event.condition === 'normal' && !event.selfReported;
  const independent = (event.channel === 'use' || event.channel === 'recall') && event.condition === 'independent';
  if (event.correct && (firstPass || independent)) {
    stat.unaided++;
    if (stat.lastUnaided !== day) stat.unaidedDays++;
    stat.lastUnaided = day;
  }
  // Immediate retries give feedback. A later correctly retrieved answer earns a longer gap.
  const assisted = event.condition === 'supported' ||
    event.channel === 'listen' && (event.selfReported || ['slower', 'replay', 'transcript'].includes(event.condition));
  if (!event.correct) {
    stat.step = 0;
    stat.due = plusDays(day, 1);
  } else if (assisted) {
    if (!stat.due || day >= stat.due) stat.due = plusDays(day, 1);
  } else if (!stat.due || (differentDay && day >= stat.due)) {
    stat.step = Math.min(intervals.length, stat.step + 1);
    stat.due = plusDays(day, intervals[stat.step - 1]);
  }
  stat.last = day;
  stat.lastCorrect = event.correct;
}

function newDay(day) {
  return {day, attempts:0, correct:0, words:new Set(), lessons:new Set(), ratings:new Set(), added:0, firstWords:new Set(), firstLessons:new Set(),
    newCards:new Set(), reviewCards:new Set(), cardTurns:new Map(),
    firstListen:0, firstUse:0, proficientChange:0,
    byChannel:Object.fromEntries(channels.map(channel => [channel, 0]))};
}

function dailyTotals(row) {
  return {day:row.day, attempts:row.attempts, correct:row.correct, words:row.words.size, lessons:row.lessons.size,
    ratings:row.ratings.size, added:row.added, firstListen:row.firstListen, firstUse:row.firstUse,
    newCards:row.newCards.size, reviewCards:row.reviewCards.size,
    proficientChange:row.proficientChange, byChannel:{...row.byChannel}};
}

function snapshot() {
  return {words:new Map(), lessons:new Map(), days:new Map(), settings:{minutes:20, speaking:true, newWords:10, startPage:'today'}};
}

function applyRating(item, event, day, stats, awaitingRecall = false) {
  const before = item.rating, rating = event.value;
  stats.proficientChange += Number(rating === 3) - Number(before === 3);
  item.rating = rating;
  item.cardRecall = awaitingRecall;
  if (rating !== null) stats.ratings.add(event.key);
  if (event.deck === 'new') stats.newCards.add(event.key);
  if (event.deck === 'review' && !awaitingRecall) stats.reviewCards.add(event.key);

  if (rating === 3) {
    item.due = null;
    item.nextChannel = null;
  } else if (event.deck || before === 3) {
    item.due = plusDays(day, awaitingRecall ? 1 : event.deck ? cardIntervals[rating] : 0);
    item.nextChannel = null;
  } else if (rating === 0 || !item.last) {
    item.due = plusDays(day, rating === 2 ? 3 : 0);
    if (rating === 0) item.nextChannel = null;
  }
}

function applyAnswer(item, event, day, stats, schedule = true) {
  if (!item.last) (event.kind === 'lesson' ? stats.firstLessons : stats.firstWords).add(event.key);
  item.last = day;
  stats.attempts++;
  if (event.correct) stats.correct++;
  stats.byChannel[event.channel]++;
  (event.kind === 'lesson' ? stats.lessons : stats.words).add(event.key);
  const evidence = item.evidence[event.channel], previousUnaided = evidence.unaided;
  updateEvidence(evidence, event, day);
  if (event.kind === 'word' && !previousUnaided && evidence.unaided) {
    if (event.channel === 'listen') stats.firstListen++;
    if (event.channel === 'use') stats.firstUse++;
  }
  // Optional exercises can still record evidence after a learner retires a word.
  if (!schedule || item.rating === 3) return;
  // An easy recognition prompt must not postpone a previously missed listening or recall prompt.
  item.nextChannel = channels.filter(channel => item.evidence[channel].due)
    .sort((a,b) => item.evidence[a].due.localeCompare(item.evidence[b].due))[0];
  item.due = item.evidence[item.nextChannel].due;
}

function inNewDrill(work, key) {
  return work?.cardTurns.get(key)?.deck === 'new';
}

function canCheckCard(state, work, event) {
  const {key, deck, value} = event, word = state.words.get(key), rating = word?.rating;
  if ((work?.cardTurns.get(key)?.id ?? null) !== value.previous || rating === 3 ||
      Boolean(word?.cardRecall) !== (value.direction === 'headword')) return false;
  if (deck === 'review') return rating != null && !work?.reviewCards.has(key) && !inNewDrill(work, key);
  return work?.newCards.has(key) || rating == null && (work?.newCards.size ?? 0) < state.settings.newWords;
}

function applyFlashcard(item, event, day, stats) {
  const {key, deck, value} = event, last = stats.cardTurns.get(key);
  stats.cardTurns.delete(key);
  stats.cardTurns.set(key, {id:event.id, deck, level:last?.deck === deck ? last.level : item.rating});
  if (value.direction === 'meaning') {
    const grade = item.rating === null ? value.grade : Math.min(value.grade, item.rating + 1);
    applyRating(item, {...event, value:Math.min(grade,2)}, day, stats, grade === 3);
  } else if (value.correct) {
    applyRating(item, {...event, value:3}, day, stats);
  }
  if (value.correct !== null) {
    const channel = value.direction === 'headword' ? 'recall' : 'recognize';
    applyAnswer(item, {...event, channel, correct:value.correct, condition:'independent', selfReported:false}, day, stats, false);
  }
}

function apply(state, event) {
  if (event.op === 'settings') { Object.assign(state.settings, event.value); return; }
  const day = dayKey(event.at);
  let stats = state.days.get(day);
  if (event.op === 'flashcard' && !canCheckCard(state, stats, event)) return;
  if (!stats) { stats = newDay(day); state.days.set(day, stats); }
  const list = event.kind === 'lesson' ? state.lessons : state.words;
  let item = list.get(event.key);
  if (!item) {
    item = newItem(event.kind, event.key, day);
    list.set(event.key, item);
    if (event.kind === 'word') stats.added++;
  }
  item.updated = day;
  if (event.op === 'context') item.context = event.value;
  if (event.op === 'reading') item.reading = event.value;
  if (event.op === 'rating') applyRating(item, event, day, stats);
  if (event.op === 'answer') applyAnswer(item, event, day, stats);
  if (event.op === 'flashcard') applyFlashcard(item, event, day, stats);
}

function checkedFlashcard(raw) {
  const {direction,correct,previous,grade} = raw ?? {};
  const value = {direction, correct, previous:previous === null ? null : checkedLabel(previous,400,'flashcard turn')};
  if (direction === 'meaning' && (typeof correct === 'boolean' || correct === null) && checkedRating(grade) !== null) {
    return {...value, grade};
  }
  if (direction === 'headword' && typeof correct === 'boolean' && grade === undefined) return value;
  throw new Error('Invalid flashcard result');
}

function copyItem(item) {
  if (!item) return null;
  const evidence = {};
  for (const channel of channels) {
    const {step, lastUnaided, ...stat} = item.evidence[channel];
    const counts = Object.entries(stat.conditions).map(([key, count]) => [key, {...count}]);
    evidence[channel] = {...stat, conditions:Object.fromEntries(counts)};
  }
  return {...item, context:{...item.context}, reading:item.reading ? {...item.reading} : null, evidence};
}

function create(options = {}) {
  const now = options.now || Date.now;
  const writer = freshId();
  const events = new Map(), pending = new Map(), loaded = new Map(), invalidShards = new Set();
  let storage = options.storage, state = null, lastEvent = null, issue = null;
  let lastLocalTime = -1, localOrder = 0;
  if (!('storage' in options)) { try { storage = root.localStorage; } catch {} }
  if (!storage) issue = 'unavailable';
  const enumerable = !!storage && typeof storage.key === 'function';
  const today = () => dayKey(now());
  const clock = () => {
    const time = new Date(now()).getTime();
    if (!Number.isFinite(time)) throw new Error('Invalid study clock');
    return time;
  };
  function available(kind, key) {
    const valid = kind === 'word' ? options.validWord : options.validLesson;
    return !valid || valid(key);
  }
  function itemKey(kind, value, checkCatalog = true) {
    if (kind !== 'word' && kind !== 'lesson') throw new Error('Invalid study item kind');
    const key = checkedLabel(value, 300, 'study item');
    if (checkCatalog && !available(kind, key)) throw new Error('Unknown ' + kind + ': ' + key);
    return key;
  }
  function checkedEvent(raw, checkCatalog) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid study event');
    const {at, op, order = 0} = raw, id = checkedLabel(raw.id, 400, 'event id');
    if (!Number.isSafeInteger(at) || at < 0 || at > 253402300799999) throw new Error('Invalid study event date');
    if (!Number.isSafeInteger(order) || order < 0) throw new Error('Invalid study event order');
    const header = {id, at, order, op};
    if (op === 'settings') return {...header, value:checkedSettings(raw.value)};
    const kind = raw.kind, key = itemKey(kind, raw.key, checkCatalog);
    if (op === 'answer') {
      const {channel, correct, condition = null, selfReported = channel === 'use'} = raw;
      if (!channels.includes(channel) || typeof correct !== 'boolean' || typeof selfReported !== 'boolean' ||
          (condition !== null && !conditions.includes(condition))) throw new Error('Invalid study answer');
      return {...header, kind, key, channel, correct, condition, selfReported};
    }
    if (kind !== 'word') throw new Error('Only words can be added or rated manually');
    if (op === 'track') return {...header, kind, key};
    if (op === 'rating') {
      const value = checkedRating(raw.value);
      if (raw.deck === undefined) return {...header, kind, key, value};
      if (!cardDecks.includes(raw.deck) || value === null) throw new Error('Invalid flashcard rating');
      return {...header, kind, key, value, deck:raw.deck};
    }
    if (op === 'flashcard' && cardDecks.includes(raw.deck)) {
      return {...header, kind, key, value:checkedFlashcard(raw.value), deck:raw.deck};
    }
    if (op === 'context') return {...header, kind, key, value:checkedContext(raw.value)};
    if (op === 'reading') return {...header, kind, key, value:checkedReading(raw.value)};
    throw new Error('Invalid study change');
  }
  function orderedEvents() { return [...events.values()].sort(compareEvents); }
  function current() {
    if (!state) {
      state = snapshot();
      const ordered = orderedEvents();
      for (const event of ordered) apply(state, event);
      lastEvent = ordered[ordered.length - 1] || null;
    }
    return state;
  }
  function include(event) {
    const key = eventKey(event), old = events.get(key);
    // Concurrent tabs may answer the same identified question. The first response is authoritative.
    if (old === event || old && (compareEvents(old, event) < 0 ||
      (compareEvents(old, event) === 0 && JSON.stringify(old) <= JSON.stringify(event)))) return false;
    events.set(key, event);
    if (!old && state && (!lastEvent || compareEvents(lastEvent, event) <= 0)) {
      apply(state, event); lastEvent = event;
    } else state = null;
    if (event.at >= lastLocalTime) {
      localOrder = event.at === lastLocalTime ? Math.max(localOrder, event.order) : event.order;
      lastLocalTime = event.at;
    }
    return true;
  }
  function decode(text) {
    const data = JSON.parse(text);
    if (!data || data.format !== format || data.version !== 1 || !Array.isArray(data.events)) throw new Error('Unsupported Sozler study backup');
    // A retired exercise or a newer headword in a backup must never invalidate its other records.
    return data.events.map(event => checkedEvent(event, false));
  }
  function encode(values) { return JSON.stringify({format, version:1, events:values}); }
  function loadShard(key, raw) {
    if (typeof raw !== 'string') { invalidShards.delete(key); return; }
    if (loaded.get(key) === raw) { invalidShards.delete(key); return; }
    let parsed;
    try { parsed = decode(raw); }
    catch { invalidShards.add(key); return; }
    invalidShards.delete(key);
    for (const event of parsed) include(event);
    loaded.set(key, raw);
  }
  function storageIssue(error) {
    issue = /quota/i.test(error?.name || '') ? 'quota' : 'unavailable';
  }
  function refresh() {
    if (!storage) return;
    try {
      if (enumerable) {
        for (let i=0; i<storage.length; i++) {
          const key = storage.key(i);
          if (key?.startsWith(prefix)) loadShard(key, storage.getItem(key));
        }
      } else {
        const key = prefix + 'records';
        loadShard(key, storage.getItem(key));
      }
      if (!pending.size) issue = null;
    } catch (error) { storageIssue(error); }
  }
  function persist(importing = false) {
    if (!pending.size || !storage) return;
    // Each browser tab owns its day's journal. Concurrent tabs never replace each other's writes.
    const key = enumerable ? prefix + (importing ? 'import:' + freshId() : today() + ':' + writer) : prefix + 'records';
    let raw, previous;
    try { raw = storage.getItem(key); } catch (error) { storageIssue(error); return; }
    try { previous = raw ? decode(raw) : []; }
    catch { invalidShards.add(key); return; }
    for (const event of previous) include(event);
    const merged = new Map(previous.map(event => [eventKey(event), event]));
    for (const [id] of pending) merged.set(id, events.get(id));
    const data = encode([...merged.values()]);
    try {
      storage.setItem(key, data);
      loaded.set(key, data); pending.clear(); invalidShards.delete(key); issue = null;
    } catch (error) { storageIssue(error); }
  }
  function commit(data, at = clock()) {
    const order = at === lastLocalTime ? localOrder + 1 : 0;
    const event = checkedEvent({...data, id:data.id ?? freshId(), at, order}, true);
    if (events.has(eventKey(event))) { persist(); return false; }
    include(event);
    pending.set(eventKey(event), event);
    persist();
    return true;
  }
  function editable(kind, key, op, value) {
    const checked = itemKey(kind, key);
    const item = current().words.get(checked);
    if (op === 'track' && item || op === 'rating' && item?.rating === value ||
        (op === 'context' || op === 'reading') && item && JSON.stringify(item[op]) === JSON.stringify(value)) {
      persist(); return false;
    }
    return commit({op, kind, key:checked, value});
  }
  function rateCard(key, value, deck) {
    if (!cardDecks.includes(deck) || checkedRating(value) === null) throw new Error('Invalid flashcard rating');
    refresh();
    const data = current(), day = today(), daily = data.days.get(day);
    const word = itemKey('word', key), rating = data.words.get(word)?.rating;
    if (deck === 'new') {
      if (rating != null || (daily?.newCards.size ?? 0) >= data.settings.newWords) return false;
    } else if (rating == null || rating === 3 || daily?.reviewCards.has(word)) return false;
    return commit({op:'rating', kind:'word', key:word, value, deck});
  }
  function availableCard(item, work) {
    return item.rating !== null && item.rating < 3 && !work?.reviewCards.has(item.key) && !inNewDrill(work, item.key);
  }
  function newCardQueue() {
    const data = current(), work = data.days.get(today());
    if (!work) return [];
    return [...work.newCards].filter(key => !work.cardTurns.has(key))
      .concat([...work.cardTurns.keys()].filter(key => work.newCards.has(key)))
      .filter(key => available('word',key) && data.words.get(key)?.rating !== 3);
  }
  function cardPrompt(key) {
    const data = current(), day = today(), item = data.words.get(key);
    return {key, day, rating:item?.rating ?? null, direction:item?.cardRecall ? 'headword' : 'meaning',
      previous:data.days.get(day)?.cardTurns.get(key)?.id ?? null};
  }
  function checkCard(prompt, deck, correct, grade) {
    if (!cardDecks.includes(deck)) throw new Error('Invalid flashcard deck');
    const key = itemKey('word', prompt.key);
    const event = {op:'flashcard',kind:'word',key,deck,value:checkedFlashcard({...prompt,correct,grade})};
    refresh();
    const data = current(), at = clock(), day = dayKey(at);
    if (prompt.day !== day || !canCheckCard(data,data.days.get(day),event)) return false;
    return commit(event,at);
  }
  function reviewCards({level, dueOnly = true} = {}) {
    const data = current(), day = today(), work = data.days.get(day);
    const order = new Map([...work?.cardTurns.keys() ?? []].map((key,index)=>[key,index]));
    return [...data.words.values()].filter(item => available('word', item.key) && availableCard(item, work) &&
      (level === undefined || (item.cardRecall ? work?.cardTurns.get(item.key)?.level ?? item.rating : item.rating) === level) &&
      (!dueOnly || item.cardRecall || item.due && item.due <= day))
      .sort((a,b) => (order.get(a.key) ?? -1) - (order.get(b.key) ?? -1) ||
        (a.due || '').localeCompare(b.due || '') || a.rating - b.rating || a.key.localeCompare(b.key, 'az'))
      .map(item => item.key);
  }
  function importJSON(text) {
    if (typeof text !== 'string') throw new Error('Provide a Sozler study backup file');
    // Validate the entire input before changing the existing library.
    const incoming = decode(text), identities = new Map(events);
    for (const event of incoming) {
      const key = eventKey(event), old = identities.get(key);
      if (old && (old.op !== event.op || old.kind !== event.kind || old.key !== event.key ||
          old.channel !== event.channel || old.deck !== undefined && event.deck !== undefined && old.deck !== event.deck ||
          (event.op !== 'answer' && JSON.stringify(old.value) !== JSON.stringify(event.value)))) {
        throw new Error('A backup event ID identifies different study items');
      }
      identities.set(key, event);
    }
    let added = 0, reconciled = 0;
    for (const event of incoming) {
      const key = eventKey(event), existed = events.has(key);
      if (!include(event)) continue;
      pending.set(key, event);
      if (existed) reconciled++; else added++;
    }
    persist(true);
    return {added, duplicates:incoming.length - added, reconciled, total:events.size};
  }
  function summary(totalWords) {
    const data = current(), day = today(), work = data.days.get(day), ratings = [0, 0, 0, 0];
    let dueWords=0, dueCards=0, dueLessons=0, tracked=0, lessonCount=0;
    for (const item of data.words.values()) {
      if (!available('word', item.key)) continue;
      tracked++;
      if (item.rating !== null) ratings[item.rating]++;
      if (item.due && item.due <= day) dueWords++;
      if ((item.cardRecall || item.due && item.due <= day) && availableCard(item, work)) dueCards++;
    }
    for (const item of data.lessons.values()) {
      if (!available('lesson', item.key)) continue;
      lessonCount++;
      if (item.due <= day) dueLessons++;
    }
    const assessed = ratings.reduce((sum, n) => sum + n, 0);
    const total = Number.isSafeInteger(totalWords) && totalWords >= 0 ? totalWords : tracked;
    return {day, totalWords:total, tracked, assessed, unassessed:Math.max(0, total - assessed), inLibraryUnrated:tracked - assessed,
      ratings, due:dueWords + dueLessons, dueWords, dueCards, dueLessons, lessonCount,
      today:{...dailyTotals(work || newDay(day)),
        newMastered:[...work?.newCards ?? []].filter(key => available('word',key) && data.words.get(key)?.rating === 3).length},
      history:[...data.days.values()].map(dailyTotals).sort((a,b) => a.day.localeCompare(b.day))};
  }
  function plan({words = [], lessons = [], kind = null, accept = null, limit, newLimit, extra = false} = {}) {
    if (kind !== null && kind !== 'word' && kind !== 'lesson') throw new Error('Invalid study plan kind');
    if (accept !== null && typeof accept !== 'function') throw new Error('Invalid study plan filter');
    const inScope = (itemKind, key) => (!kind || itemKind === kind) && (!accept || accept(itemKind, key)) && available(itemKind, key);
    const completed = (wordSet, lessonSet) => {
      if (!kind && !accept) return wordSet.size + lessonSet.size;
      let count = 0;
      for (const key of wordSet) if (inScope('word', key)) count++;
      for (const key of lessonSet) if (inScope('lesson', key)) count++;
      return count;
    };
    const data = current(), day = today(), work = data.days.get(day) || newDay(day);
    const bound = (value, fallback) => Number.isFinite(value) ? Math.max(0, Math.min(100, Math.floor(value))) : fallback;
    const budget = bound(limit, Math.min(30, Math.max(3, Math.round(data.settings.minutes / 2))));
    const remaining = Math.max(0, budget - (extra ? 0 : completed(work.words, work.lessons)));
    const fresh = Math.max(0, bound(newLimit, Math.max(2, Math.ceil(data.settings.minutes / 4))) - (extra ? 0 : completed(work.firstWords, work.firstLessons)));
    const overdue = [...data.words.values(), ...data.lessons.values()]
      .filter(item => inScope(item.kind, item.key) && item.due && item.due <= day && (!(item.kind === 'word' ? work.words : work.lessons).has(item.key) ||
        item.nextChannel && item.evidence[item.nextChannel].last !== day))
      .sort((a,b) => a.due.localeCompare(b.due) || a.added.localeCompare(b.added) || a.key.localeCompare(b.key, 'az'));
    const result = overdue.slice(0, remaining).map(item => ({kind:item.kind, key:item.key, reason:'due', channel:item.nextChannel}));
    const space = Math.min(remaining - result.length, fresh);
    if (!space) return result;
    const pools = [[words, data.words, 'word'], [lessons, data.lessons, 'lesson']];
    const queues = pools.map(([values, seen, itemKind]) => {
      const pool = [...new Set(values)].filter(key => typeof key === 'string' && key.trim() && inScope(itemKind, key));
      const offset = pool.length ? Math.floor(Date.parse(day + 'T00:00:00Z') / dayMs) % pool.length : 0;
      return [...pool.slice(offset), ...pool.slice(0, offset)].filter(key => !seen.has(key)).slice(0, space).map(key => ({kind:itemKind, key, reason:'new', channel:null}));
    });
    for (let i=0, added=0; added<space && i<Math.max(queues[0].length, queues[1].length); i++) {
      for (const queue of queues) if (queue[i] && added<space) { result.push(queue[i]); added++; }
    }
    return result;
  }
  const onStorage = event => {
    if (event.key?.startsWith(prefix) && event.newValue) loadShard(event.key, event.newValue);
  };
  refresh();
  root.addEventListener?.('storage', onStorage);
  return {
    day:today, plan, summary, reviewCards, rateCard, newCardQueue, cardPrompt, checkCard,
    refresh:() => {refresh(); persist();},
    wordRatings:() => new Map([...current().words.values()].filter(item => item.rating !== null && available('word', item.key)).map(item => [item.key,item.rating])),
    status:() => ({persistent:!issue && !invalidShards.size, reason:invalidShards.size ? 'invalid-data' : issue, pending:pending.size}),
    settings:() => ({...current().settings}),
    setSettings(value) {
      const next = checkedSettings(value), previous = current().settings;
      if (Object.entries(next).every(([key, val]) => previous[key] === val)) { persist(); return false; }
      return commit({op:'settings', value:next});
    },
    word:key => copyItem(current().words.get(key)), lesson:key => copyItem(current().lessons.get(key)),
    words:() => [...current().words.values()].filter(item => available('word', item.key)).map(copyItem),
    lessons:() => [...current().lessons.values()].filter(item => available('lesson', item.key)).map(copyItem),
    trackWord:key => editable('word', key, 'track'), rateWord:(key, value) => editable('word', key, 'rating', checkedRating(value)),
    setContext:(key, value) => editable('word', key, 'context', checkedContext(value)),
    setReading:(key, value) => editable('word', key, 'reading', checkedReading(value)),
    record:answer => commit({...answer, op:'answer'}), hasAttempt:id => events.has('answer:' + id),
    attempt(id) { const answer = events.get('answer:' + id); return answer ? {...answer} : null; },
    exportJSON:() => encode(orderedEvents()), importJSON,
    destroy:() => root.removeEventListener?.('storage', onStorage)
  };
}

const api = {create, dayKey, channels:[...channels]};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.SozStudyModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
