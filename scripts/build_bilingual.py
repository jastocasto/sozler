#!/usr/bin/env python3
"""Build a complete, offline AZ/EN display layer. Earlier datasets stay untouched."""
import datetime, hashlib, json, sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent
snapshot=json.loads(Path(sys.argv[1]).read_text());cache_path=Path(sys.argv[2]);cache={}
for line in cache_path.open():
    r=json.loads(line);cache[(r['source_language'],r['target_language'],r['text'])]=r['translation']
for r in json.loads((root/'scripts/translation-edits.json').read_text()):
    cache[(r['source_language'],r['target_language'],r['text'])]=r['translation']
texts=set();by_word={n['w']:n for n in snapshot['nodes']}
def add(lang,text):
    if text and text.strip():texts.add((lang,text))
for n in snapshot['main']:
    source=n.get('source') or {};lang=source.get('language','en')
    for text in source.get('senses') or ([] if n['az'] else [n['en']]):add(lang,text)
for records in snapshot['evidence'].values():
    for p in records:
        for key in ['sense','qualifier']:add(p.get('language','en'),p.get(key))
for f in snapshot['grammar']:
    for text in f['senses']:
        lang='az' if f['origin']=='original' and text==by_word.get(f['w'],{}).get('az') else 'en'
        add(lang,text)
values={};missing=[]
for lang,text in sorted(texts):
    pair=[]
    for target in ['az','en']:
        value=cache.get((lang,target,text),text if lang==target else None)
        if not value:missing.append([lang,target,text])
        pair.append(value)
    values[lang+'\t'+text]=pair
if missing:
    print(json.dumps({'missing_count':len(missing),'sample':missing[:12]},ensure_ascii=False));sys.exit(1)
overrides=json.loads((root/'scripts/definition-overrides.json').read_text())
meta={'display_languages':['az','en'],'main_entries':len(snapshot['main']),'grammar_records':len(snapshot['grammar']),'translated_text_pairs':len(values),'editorial_definitions':len(overrides),'translation_engines':['Google Translate','AI-assisted editorial translation'],'method':'Cached machine translations and AI-assisted editorial translations, with existing bilingual definitions and word-specific edits retained. These translations have not all been reviewed by a linguist. No translation service is contacted by visitors.','created_at':datetime.date.today().isoformat(),'cache_sha256':hashlib.sha256(cache_path.read_bytes()).hexdigest(),'edits_sha256':hashlib.sha256((root/'scripts/translation-edits.json').read_bytes()).hexdigest(),'source_data_preserved':True}
(root/'dist/bilingual.js').write_text('window.WORD_WEB_BILINGUAL='+json.dumps({'texts':values,'overrides':overrides,'meta':meta},ensure_ascii=False,separators=(',',':'))+';\n')
(root/'dist/bilingual-attribution.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(meta,ensure_ascii=False,indent=2))
