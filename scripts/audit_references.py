"""Audit explicit lexical references in offline Kaikki snapshots.
Usage: audit_references.py MODEL.json SOURCE_DIR OUTPUT.json
"""
import json,re,collections,sys
from pathlib import Path
m=json.loads(Path(sys.argv[1]).read_text());known={n['w'] for n in m['nodes']};excluded=set(m['excluded']);records=collections.defaultdict(list); refs=[]
for ed in ['en','tr','fr','de','ku','ru']:
 for line in (Path(sys.argv[2])/('az-'+ed+'wiktionary.jsonl')).open():
  d=json.loads(line)
  if d.get('lang_code')!='az':continue
  d['_edition']=ed;records[d['word']].append(d)
excluded_fold={x.casefold() for x in excluded}
valid=lambda w: bool(re.fullmatch(r"[a-zəöüğşçıİ][a-zəöüğşçıİ '\-]{1,75}",w)) and not w.endswith('-') and w not in excluded and w.casefold() not in excluded_fold
queue=sorted(known);seen=set();missing={};edges=[];unresolved=set()
while queue:
 w=queue.pop()
 if w in seen:continue
 seen.add(w)
 for d in records.get(w,[]):
  ss=[s for s in d.get('senses',[]) if not s.get('form_of') and not s.get('alt_of') and not set(s.get('tags',[]))&{'form-of','alt-of'}]
  for obj in [d]+ss:
   targets=[]
   for f,t in [('synonyms','syn'),('antonyms','ant'),('derived','root'),('related','topic'),('hypernyms','topic'),('hyponyms','topic'),('meronyms','topic'),('holonyms','topic')]:
    targets += [(r.get('word',''),t,f,None) for r in obj.get(f,[])]
   targets += [(label,'topic','links',None) for label,url in obj.get('links',[]) if '#Azerbaijani' in url]
   for g in obj.get('glosses',[]):
    for a,b in re.findall(r'([a-zəöüğşçı][a-zəöüğşçı \-]*?)\s*\(“([^”]+)”\)',g):
     labels=[label for label,url in obj.get('links',[]) if '#Azerbaijani' in url and (a.strip()==label or a.strip().endswith(' '+label))]
     for label in labels:targets.append((label,'topic','gloss',b))
   for target,t,f,gloss in sorted(targets,key=lambda row:row[3] is None):
    if target==w or not valid(target):continue
    if target not in known and target not in missing:
     lexical=[(r,s) for r in records.get(target,[]) for s in r.get('senses',[]) if not s.get('form_of') and not s.get('alt_of') and not set(s.get('tags',[]))&{'form-of','alt-of'} and s.get('glosses')]
     if records.get(target) and not lexical:continue
     if lexical:
      r,s=lexical[0]
      if r['pos']=='verb' and not target.endswith(('maq','mək')):continue
      meaning=s['glosses'][0];pos=r['pos']
     elif t=='syn' and obj is not d and d['_edition']=='en' and obj.get('glosses'):
      meaning=obj['glosses'][0];pos=d['pos'];gloss=meaning
     elif gloss and not re.search(r'plural of|singular.*of|possessed.*of|form of', ' '.join(obj.get('glosses',[]))):
      meaning=gloss;pos='verb' if target.endswith(('maq','mək')) else 'phrase'
     else:unresolved.add(target);continue
     missing[target]={'word':target,'en':meaning,'language':r['_edition'] if lexical else d['_edition'],'pos':pos,'from':w,'field':f,'source_head':w,'sense_id':obj.get('id',''),'method':'standalone' if lexical else 'synonym-sense' if t=='syn' else 'inline-gloss'};queue.append(target)
    if target in known or target in missing:edges.append([w,target,t,f])
Path(sys.argv[3]).write_text(json.dumps({'missing':missing,'edges':edges,'unresolved':sorted(unresolved)},ensure_ascii=False,indent=2))
print('missing',len(missing),'edges',len(edges),'unresolved',len(unresolved))
for w,r in list(missing.items())[:45]:print(w,r['en'])
print('nazil',[(w,r) for w,r in missing.items() if 'nazil' in w])
