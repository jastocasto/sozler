#!/usr/bin/env python3
"""Extract explicit missing lexical links and dictionary-supported etymologies.
Inputs: offline Kaikki directory and the preserved pre-audit model export.
This creates research candidates, not a runtime fuzzy matching rule.
"""
import json,re,hashlib,collections,sys
from pathlib import Path
src=Path(sys.argv[1]);inp=json.loads(Path(sys.argv[2]).read_text());out=Path(__file__).resolve().parent/'content/relations'
by={n['w']:n for n in inp['nodes']};aliases=inp.get('aliases',{});existing={tuple(sorted(e[:2]))+(e[2],) for e in inp['edges']}
def k(a,b,t):return tuple(sorted((a,b)))+(t,)
def resolve(word):return aliases.get(word,word) if aliases.get(word,word) in by else None
def lexical(d):return [s for s in d.get('senses',[]) if not s.get('form_of') and not s.get('alt_of') and not set(s.get('tags',[]))&{'form-of','alt-of'}]
def gloss(senses):return list(dict.fromkeys(g for s in senses for g in s.get('glosses',[])))
def rootbase(term):
 if not term:return
 exact=resolve(term)
 if exact:return exact
 if term.endswith('-') and not term.startswith('-'):
  options=[x for x in [term[:-1]+'maq',term[:-1]+'mək'] if x in by and by[x]['pos']=='verb']
  if len(options)==1:return options[0]
facts={};explicit={};allrefs=[];stats=collections.Counter();unknown=[]
for ed in ['en','tr','ru','fr','de','ku']:
 file=src/f'az-{ed}wiktionary.jsonl'
 allrefs.append({'edition':ed,'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
 for line in file.open():
  d=json.loads(line);word=resolve(d.get('word',''))
  if d.get('lang_code')!='az' or not word:continue
  ss=lexical(d)
  if not ss:continue
  if d.get('pos')=='verb' and not word.endswith(('maq','mək')):continue
  stats[ed+'_lexical_entries']+=1
  for obj in [d]+ss:
   for field,t in [('synonyms','syn'),('antonyms','ant'),('derived','root'),('related','topic'),('hypernyms','topic'),('hyponyms','topic'),('meronyms','topic'),('holonyms','topic')]:
    for r in obj.get(field,[]):
     target=resolve(r.get('word',''))
     if not target or word==target or k(word,target,t) in existing:continue
     sense=r.get('sense') or '; '.join(gloss([obj])) if obj is not d else r.get('sense') or ('; '.join(gloss(ss)) if len(ss)==1 else '')
     explicit.setdefault(k(word,target,t),{'a':word,'b':target,'type':t,'field':field,'edition':ed,'head':d['word'],'pos':d.get('pos'),'sense':sense,'tags':obj.get('tags',[])+r.get('tags',[]),'source_id':obj.get('id','')})
  if ed!='en':continue
  ety=d.get('etymology_text','')
  if re.search(r'uncertain|unknown|possibly|perhaps|maybe|probably|likely|disputed',ety,re.I):continue
  for template in d.get('etymology_templates',[]):
   name=template.get('name');args=template.get('args',{})
   if name not in ['af','affix','suffix','suf','prefix','pre','compound','com','confix'] or args.get('1')!='az':continue
   for arg,term in args.items():
    if not arg.isdigit() or int(arg)<2:continue
    if name in ['suffix','suf'] and arg!='2':continue
    if name in ['prefix','pre'] and arg!='3':continue
    if term.startswith('-'):continue
    base=rootbase(term)
    if not base or base==word or k(word,base,'root') in existing:continue
    # A sourced base must be lexical; no inferred stripping or cross-language cognates.
    if word in by and base in by:
     row={'a':word,'b':base,'type':'root','edition':'en','head':d['word'],'pos':d.get('pos'),'template':name,'component':term,'etymology':ety,'expansion':template.get('expansion',''),'source_id':ss[0].get('id',''),'word_senses':gloss(ss),'base_senses':by[base]['en'],'kind':'compound' if name in ['compound','com'] else 'derivation'}
     facts.setdefault(k(word,base,'root'),row)
for name,rows in [('etymology-candidates',list(facts.values())),('explicit-candidates',list(explicit.values()))]:
 (out/(name+'.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
(out/'source-snapshots.json').write_text(json.dumps({'sources':allrefs,'stats':dict(stats)},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'etymology':len(facts),'explicit':len(explicit),'types':dict(collections.Counter(r['type'] for r in explicit.values())),'templates':dict(collections.Counter(r['template'] for r in facts.values())),'stats':dict(stats)},ensure_ascii=False,indent=2))
for r in list(facts.values())[:35]:print(r['a'],r['b'],r['etymology'])
