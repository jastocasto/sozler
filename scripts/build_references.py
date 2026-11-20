"""Compile an explicit-reference audit with bilingual gloss translations.
Usage: build_references.py MODEL.json CANDIDATES.json ACCEPTED.json CACHE.jsonl
Original dictionary and grammar files remain unchanged.
"""
import json,sys,re,collections
from pathlib import Path
root=Path(__file__).resolve().parent.parent;out=root/'dist'
m,candidates,accepted=[json.loads(Path(p).read_text()) for p in sys.argv[1:4]]
accepted=accepted.get('accepted',accepted)
cache={}
for line in Path(sys.argv[4]).open():
 r=json.loads(line);cache[(r['source_language'],r['target_language'],r['text'])]=r['translation']
for r in json.loads((root/'scripts/translation-edits.json').read_text()):cache[(r['source_language'],r['target_language'],r['text'])]=r['translation']
known={n['w'] for n in m['nodes']};nodes=[];edges=[];evidence={};seen=set();pos={'adj':'adjective','adv':'adverb','proverb':'phrase','num':'numeral','intj':'interjection'}
for w,r in sorted(accepted.items()):
 en=r['en'] if r['language']=='en' else cache[(r['language'],'en',r['en'])];az=r['en'] if r['language']=='az' else cache[(r['language'],'az',r['en'])]
 
 if w=='nazil etmək':az='Allah tərəfindən vəhy göndərmək; ilahi məzmunu bildirmək.'
 if w=='nazil olmaq':az='Vəhy kimi göndərilmək və ya endirilmək.'
 assert az.strip() and en.strip() and not re.search('[\u0400-\u04ff]',az+en),(w,az,en)
 source={'kind':'reference-audit','head':w if r['method']=='standalone' else r['source_head'],'edition':r['language'],'method':r['method'],'senseId':r['sense_id'],'attribution':'references-attribution.json','senseLimited':r['method']=='synonym-sense'}
 nodes.append([w,en,az,pos.get(r['pos'],r['pos']),'reference','','','reference',source])
lookup={r[0]:r for r in nodes};available=known|set(lookup)
for a,b,t,field in candidates['edges']:
 if a not in available or b not in available or a not in lookup and b not in lookup or a==b:continue
 # Only new-node edges; existing reviewed semantics are untouched.
 if t=='root' and field!='derived':t='topic'
 if t=='topic' and (a in lookup or b in lookup):
  new=lookup.get(b) or lookup.get(a);parent=a if b in lookup else b;term=new[0]
  if new[8]['method']=='inline-gloss' and term.startswith(parent+' '):t='root'
 key='|'.join(sorted([a,b]))+'|'+t
 if key in seen:continue
 seen.add(key);edges.append([a,b,t,'Lüğətdə açıq istinad · Wiktionary'])
 n=lookup.get(b) or lookup.get(a)
 evidence[key]=[{'from':a,'head':a,'edition':'en','scope':'source-reference','sourceField':field,'senseAz':n[2],'senseEn':n[1],'language':'az','qualifierAz':'Mənbədə göstərilən məna ilə məhdudlaşır.','qualifierEn':'Limited to the meaning documented in the source.'}]
meta={'added_entries':len(nodes),'added_edges':len(edges),'method':'Explicit dictionary references; standalone entries, inline glosses, and sense-level synonyms. Source sense is retained; no transitive synonym inference. Translations are machine-assisted.','methods':dict(collections.Counter(r['method'] for r in accepted.values())),'unresolved_references':len(set(candidates['unresolved'])-available),'display_languages':['az','en']}
payload={'nodes':nodes,'edges':edges,'evidence':evidence,'meta':meta}
(out/'references.js').write_text('window.WORD_WEB_REFERENCES='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n')
(root/'scripts/content/reference-audit.json').write_text(json.dumps({'accepted':accepted,'unresolved':sorted(set(candidates['unresolved'])-available),'policy':'Unresolved references have no supported standalone or sense-level definition. They are held for research, not given invented meanings. Inflection records and capitalization duplicates are excluded.'},ensure_ascii=False,indent=2)+'\n')
(out/'references-attribution.json').write_text(json.dumps({**meta,'license':'Dictionary source excerpts: Wiktionary via Kaikki, CC BY-SA 4.0.','scope':'A synonym entry represents the documented source sense, not necessarily every meaning of either word.','references':[{'word':w,**r} for w,r in accepted.items()]},ensure_ascii=False,indent=2)+'\n')
counts=json.loads((out/'word-count.json').read_text());counts.update(headwords=len(known)+len(nodes),single_words=sum(' ' not in w for w in available),multiword_entries=sum(' ' in w for w in available),reference_entries=len(nodes));(out/'word-count.json').write_text(json.dumps(counts,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(meta,ensure_ascii=False))
