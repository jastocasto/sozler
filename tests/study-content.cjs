const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = path.join(__dirname, '..', 'dist');
const contentPath = path.join(dist, 'study-content.js');
const lessons = require(contentPath);
const clips = require(path.join(dist, 'study-listening.js'));
const byAudioId = new Map(clips.map(clip => [clip.id, clip]));
const atlas = JSON.parse(fs.readFileSync(path.join(dist, 'soz-core.json'), 'utf8'));
const atlasWords = new Set(atlas.nodes.cols.w.values);
const page = {window:{}};
vm.runInNewContext(fs.readFileSync(contentPath, 'utf8'), page);
assert.deepEqual(JSON.parse(JSON.stringify(page.window.SozStudyContent)), lessons);

const normalize = text => text.trim().normalize('NFC').toLocaleLowerCase('az');
const ids = new Set(), sentences = new Set(), skills = new Set();
let recordings = 0;
for (const lesson of lessons) {
  const {id, az, word, gap, choices, answer, accept} = lesson;
  assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert(!ids.has(id), `Duplicate lesson ID ${id}`);
  ids.add(id);
  assert(!sentences.has(normalize(az)), `Repeated utterance in ${id}`);
  sentences.add(normalize(az));
  skills.add(lesson.skill);
  assert(atlasWords.has(word), `${id} links to a missing headword: ${word}`);
  for (const field of ['skill','az','en','meaning','cue','speak','explanation']) {
    assert.equal(typeof lesson[field], 'string', `${id} missing field ${field}`);
    assert(lesson[field].trim().length, `${id} empty field ${field}`);
    assert.equal(lesson[field], lesson[field].normalize('NFC'), `${id} has decomposed characters`);
  }
  assert(Array.isArray(choices) && choices.length >= 2 && choices.every(c => c.trim()));
  assert.equal(new Set(choices.map(normalize)).size, choices.length, `${id} repeats a choice`);
  assert(Number.isInteger(answer) && answer >= 0 && answer < choices.length, `${id} has an invalid answer`);
  assert(Array.isArray(accept) && accept.length && accept.every(v => v.trim()));
  assert.equal(new Set(accept.map(normalize)).size, accept.length, `${id} repeats an answer form`);
  assert.equal(gap.split('___').length, 2, `${id} needs exactly one reconstruction gap`);
  assert.equal(gap.replace('___', accept[0]), az, `${id} cannot reconstruct the original utterance`);
  if (lesson.audioId) {
    const clip = byAudioId.get(lesson.audioId);
    assert(clip, `${id} links to a missing recording`);
    assert.equal(az, clip.az, `${id} differs from the linked transcript`);
    recordings++;
  }
}
assert(lessons.length >= 24 && skills.size >= 6);
assert(recordings >= 3, 'Preserve the human-recorded listening-to-grammar lessons');
console.log(`PASS ${lessons.length} study lessons across ${skills.size} skills, with valid atlas headwords, reconstructions, and ${recordings} matching human recordings.`);
