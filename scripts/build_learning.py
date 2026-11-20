#!/usr/bin/env python3
"""Build the offline learning content; the daily sequence is frozen in daily-words.json."""
import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
def read(name):return json.loads((root/'dist'/f'{name}.js').read_text().split('=',1)[1].strip().rstrip(';'))
records=[n for name in ['data','lexicon','vocabulary','review','expansion'] for n in read(name)['nodes']]
known={n[0]:n for n in records};excluded=set(read('grammar')['excluded'])
questions=[]
for line in (root/'scripts/quiz-content.tsv').read_text().splitlines():
    word,others,az,en=line.split('\t');distractors=others.split(',')
    assert len(set([word]+distractors))==4,(word,'duplicates')
    for option in [word]+distractors:assert option in known and option not in excluded,(word,option)
    assert az.strip() and en.strip() and not any(c in az+en for c in '<>')
    questions.append({'word':word,'distractors':distractors,'az':az,'en':en})
assert len({q['word'] for q in questions})==len(questions)
daily=json.loads((root/'scripts/daily-words.json').read_text())
assert daily and len(daily)==len(set(daily))
daily_known={**known,**{n[0]:n for name in ['additions','references','growth'] for n in read(name)['nodes']}}
spelling_definitions=read('orthography-lexical')['definitions']
for word in daily:
    assert word not in excluded,word
    if word in daily_known:
        assert not daily_known[word][6],word
    else:
        assert word in spelling_definitions and all(spelling_definitions[word].get(lang) for lang in ('az','en')),word
payload={'dailyWords':daily,'questions':questions,'meta':{'daily_timezone':'Asia/Baku','daily_start':'2026-11-19','daily_sequence':'Frozen editorial cycle of advanced literary and academic vocabulary.','quiz_method':'Explicit bilingual definition clues with individually chosen distractors. AI-assisted editorial content.','question_count':len(questions)}}
(root/'dist/learning-data.js').write_text('window.WORD_WEB_LEARNING='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n')
print({'daily_words':len(daily),'questions':len(questions)})
