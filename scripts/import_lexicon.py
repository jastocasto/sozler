#!/usr/bin/env python3
"""Import a dated Kaikki/enwiktionary snapshot. No guessed roots or invented translations.
Usage: python scripts/import_lexicon.py SOURCE.jsonl ORIGINAL.words.json
Imported definitions and transformed structured data: CC BY-SA 4.0.
"""
import json,re,sys,hashlib,collections,datetime
from pathlib import Path
from etymology_components import lexical_components, complete_derived_target
src=Path(sys.argv[1]); original_text=Path(sys.argv[2]).read_text(); original=json.loads(original_text.split('=',1)[1].strip().rstrip(';') if original_text.lstrip().startswith('window.') else original_text); out=Path(__file__).resolve().parent.parent/'dist'
valid=re.compile(r"^[A-Za-zƏəÖöÜüĞğŞşÇçİı][A-Za-zƏəÖöÜüĞğŞşÇçİı '\-]{1,49}$")
allowed={'noun','verb','adj','adv','num','pron','phrase','intj','postp','det','conj','particle','prep_phrase','prep'}
pos={'adj':'adjective','adv':'adverb','num':'numeral','pron':'pronoun','intj':'interjection','postp':'postposition','det':'determiner','conj':'conjunction','prep_phrase':'phrase','prep':'preposition'}
def clean(s):return re.sub(r'\s+',' ',s or '').strip()
def acceptable(w):return bool(valid.fullmatch(w)) and not w.startswith('-') and not w.endswith('-')
records=collections.defaultdict(list)
for line in src.open():
 d=json.loads(line);w=clean(d.get('word'))
 if d.get('lang_code')=='az' and d.get('pos') in allowed and acceptable(w):records[w].append(d)
original_by={n[0]:n for n in original['nodes']};known=dict(original_by);nodes=[];enrichment={};pending=[];edges=[];seen=set()
def edge(a,b,t,note):
 if a==b:return
 key=tuple(sorted((a,b)))+(t,)
 if key in seen:return
 seen.add(key);pending.append([a,b,t,note+' · Wiktionary'])
for w,entries in records.items():
 senses=[s for d in entries for s in d.get('senses',[])];glosses=[];base=''
 for s in senses:
  for g in s.get('glosses',[]):
   g=clean(g)
   if g and len(g)<600 and not any(j in g for j in ['data-id=','<div','{{','}}','Lua error']) and g not in glosses:glosses.append(g)
  for f in s.get('form_of',[]):
   if acceptable(f.get('word','')):base=base or f['word'];edge(w,f['word'],'root','Lüğətdə göstərilmiş söz forması')
 if not glosses:continue
 glosses=glosses[:5];metadata={'head':w,'senses':glosses}
 if any(s.get('glosses') and not s.get('form_of') for s in senses):base=''
 if w in original_by:enrichment[w]=metadata
 else:
  node=[w,'; '.join(glosses[:2])[:350],'','form' if base else pos.get(entries[0]['pos'],entries[0]['pos']),'Wiktionary',base,'listed-form' if base else '','wiktionary',metadata]
  nodes.append(node);known[w]=node
 for d in entries:
  for obj in [d]+d.get('senses',[]):
   for field,t,label in [('synonyms','syn','Lüğətdə sinonim'),('antonyms','ant','Lüğətdə antonim'),('derived','root','Lüğətdə törəmə söz'),('related','topic','Lüğətdə əlaqəli söz')]:
    for r in obj.get(field,[]):
     if field=='derived' and not complete_derived_target(r):continue
     if acceptable(r.get('word','')):edge(w,r['word'],t,label)
  for template in d.get('etymology_templates',[]):
   for value in lexical_components(template):
    if acceptable(value):edge(w,value,'root','Lüğətdə göstərilmiş söz quruluşu')
forms_added=0
for w,entries in records.items():
 if w not in known:continue
 for d in entries:
  if d['pos']!='noun':continue
  for f in d.get('forms',[]):
   tags=set(f.get('tags',[]));word=clean(f.get('form'))
   form='plural' if tags in [{'plural'},{'nominative','plural'}] else 'locative' if tags=={'locative','singular'} else 'ablative' if tags=={'ablative','singular'} else None
   if not form or not acceptable(word) or word==w:continue
   # Restrict to explicitly listed forms. Do not auto-create the rest of a paradigm.
   if word not in known:
    label={'plural':'cəm forması','locative':'yerlik hal forması','ablative':'çıxışlıq hal forması'}[form]
    gloss={'plural':'plural of','locative':'in/at','ablative':'from'}[form]+' '+w+' — '+known[w][1]
    n=[word,gloss[:350],f'“{w}” sözünün {label}.','form','Wiktionary',w,form,'wiktionary-form',{'head':w}]
    nodes.append(n);known[word]=n;forms_added+=1
   # Only assert the morphological relation to an existing headword, never a synonym.
   edge(w,word,'root','Lüğətin hal/cəm cədvəlində göstərilmiş forma')
for e in pending:
 if e[0] in known and e[1] in known:edges.append(e)
# Some extracted form-of links point outside this filtered dictionary; retain the definition,
# but do not expose an unusable base-word navigation link.
for n in nodes:
 if n[5] not in known:n[5]=''
meta={'source':'Kaikki / English Wiktionary','source_url':'https://kaikki.org/dictionary/Azerbaijani/index.html','download_url':'https://kaikki.org/dictionary/Azerbaijani/kaikki.org-dictionary-Azerbaijani.jsonl','license':'CC BY-SA 4.0','license_url':'https://creativecommons.org/licenses/by-sa/4.0/','imported_at':datetime.date.today().isoformat(),'snapshot_dump':'2026-10-01','snapshot_extracted':'2026-10-30','sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'added_entries':len(nodes),'added_headwords':sum(n[3]!='form' for n in nodes),'source_entry_forms':sum(n[3]=='form' and n[7]=='wiktionary' for n in nodes),'listed_forms':forms_added,'added_links':len(edges),'total_entries':len(known),'definition_language':'en','note':'Filtered Latin-script entries, up to five senses, explicit relationships and selected nominal forms; some paradigms are generated by Wiktionary templates. No frequency ranking.'}
payload={'nodes':nodes,'edges':edges,'enrichment':enrichment,'meta':meta}
(out/'lexicon.js').write_text('window.WORD_WEB_EXTRA='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n')
(out/'lexicon-attribution.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(meta,ensure_ascii=False,indent=2))
print('JavaScript bytes', (out/'lexicon.js').stat().st_size)
