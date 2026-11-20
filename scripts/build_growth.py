#!/usr/bin/env python3
"""Rebuild the additive, source-reviewed vocabulary and connection layer."""
import itertools,json,re,subprocess,sys
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
INPUT=ROOT/'scripts/content/growth'; DIST=ROOT/'dist'
def read(p): return json.loads(Path(p).read_text())
def dump(p,x): Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
base_path=ROOT/'.growth-base.json'
subprocess.run(['node','scripts/export_current_model.cjs',str(base_path),'--base'],cwd=ROOT,check=True)
base=read(base_path);base_path.unlink()
known={n['w']:n for n in base['nodes']}; excluded=set(base['excluded'])|set(base['aliases'])
families=read(INPUT/'families.json'); semantic=read(INPUT/'semantics.json'); assertions=read(INPUT/'source-assertions.json')
cache={}
for line in Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/soz-sources/translation-cache.jsonl').read_text().splitlines():
 r=json.loads(line);cache[(r['source_language'],r['target_language'],r['text'])]=r['translation']
for r in read(ROOT/'scripts/translation-edits.json'):cache[(r['source_language'],r['target_language'],r['text'])]=r['translation']
def translate(lang,target,text):return text if lang==target else cache[(lang,target,text)]
def key(a,b,t):return '|'.join(sorted([a,b]))+'|'+t
def pair(a,b):return '|'.join(sorted([a,b]))
existing={key(*e[:3]) for e in base['edges']}; precise={pair(*e[:2]) for e in base['edges'] if e[2]!='topic'}
blocked=[]; held=[]; edges=[];evidence={}; added=set();nodes=[];node_records=[]
for row in semantic['decisions']:
 if row['decision']=='hold':
  blocked.append([row['a'],row['b'],row['source_type']]);held.append(row)
for row in read(INPUT/'blocked.json')['blocked_candidates']:blocked.append([row['a'],row['b'],row['type']]);held.append(row)
blocked_keys={key(*b[:3]) for b in blocked}
def add(a,b,t,note,proof):
 k=key(a,b,t)
 if a==b or a not in known or b not in known or k in blocked_keys:return
 if t=='topic' and pair(a,b) in precise:return
 if proof and proof not in evidence.setdefault(k,[]):evidence[k].append(proof)
 if k in existing or k in added:return
 if t in ['syn','ant'] and (key(a,b,'ant' if t=='syn' else 'syn') in existing|added):
  held.append({'a':a,'b':b,'type':t,'reason':'Conflicting semantic label requires sense review.'});return
 edges.append([a,b,t,note]);added.add(k)
 if t!='topic':precise.add(pair(a,b))
records=read(INPUT/'words.json') if (INPUT/'words.json').exists() else []
pos_map={'adj':'adjective','adv':'adverb','n':'noun','v':'verb','name':'proper noun','prep':'preposition','conj':'conjunction','intj':'interjection','num':'numeral'}
for r in records:
 word=r['word'];assert word not in known and word not in excluded,word
 source=dict(r['source']);source.pop('raw_path',None)
 for q in ['path','raw_path']:source.pop(q,None)
 text=r.get('en') or r['source_definition'];lang='en' if r.get('en') else r['source_language']
 en=r.get('en') or translate(lang,'en',text);az=r.get('az') or translate(lang,'az',text)
 assert en.strip() and az.strip() and not re.search('[\u0400-\u04ff]',en+az),word
 source.update({'translationMethod':'edited' if r.get('az') and r.get('en') else 'machine','sensePairs':[{'az':az,'en':en}]})
 source['kind']='wiktionary';source.setdefault('via','kaikki');source.setdefault('language',r.get('source_language','en'))
 pos=pos_map.get(r['pos'],r['pos']);assert pos!='verb' or re.search(r'maq$|mək$',word),word
 node=[word,en,az,pos,r.get('topic','anlayışlar'),'','','wiktionary',source];nodes.append(node);known[word]={'w':word,'en':en,'az':az,'pos':pos}
 node_records.append({'word':word,'az':az,'en':en,'pos':pos,'source':source,'definition_method':r.get('definition_method',r.get('definition_review','Machine-assisted bilingual translation of the source sense.'))})
# A documented lexical family is shared by its derivatives. Compounds attach as
# leaves independently to each base; family arrays are deliberately never unioned.
for f in families['families']:
 refs=[]
 for item in f['evidence']:
  for e in item['evidence']:
   ref={'edition':e['edition'],'head':e['head']}
   if ref not in refs:refs.append(ref)
 for a,b in itertools.combinations(f['members'],2):
  proof={'scope':'root-family','from':f['lemma'],'head':f['lemma'],'edition':refs[0]['edition'] if refs else 'en','family':f['id'],
    'senseAz':f['lemma']+' kökündən yaranmış sözlər; törəmə sözlər bir-birinin birbaşa əsası olmaya bilər.',
    'senseEn':'Words sharing the '+f['lemma']+' root; siblings need not derive directly from one another.','refs':refs[:3]}
  add(a,b,'root','Ortaq kök: '+f['lemma'],proof)
for d in semantic['decisions']:
 if d['decision'] not in ['syn','ant']:continue
 a=assertions[d['index']]
 add(d['a'],d['b'],d['decision'],'Məna üzrə yoxlanmış əlaqə',{'scope':'reviewed','from':d['a'],'edition':'en','head':d['a'],'field':a['field'],'senseAz':d['sense_az'],'senseEn':d['sense_en'],'tags':a.get('tags',[])})
# Explicit broader source relationships remain yellow; never upgrade to synonymy.
for a in assertions:
 if a['type']!='topic':continue
 add(a['a'],a['b'],'topic','Wiktionary: '+a['field'],{'scope':'source-related','from':a['a'],'head':a['a'],'edition':'en','field':a['field'],
  'senseAz':'Lüğətdə əlaqəli anlayış kimi göstərilir; sinonim demək deyil.','senseEn':'Listed as a related concept in the dictionary; this does not assert synonymy.'})
for r in records:
 for rel in r.get('relations',[]):
  add(r['word'],rel['word'],rel['type'],'Lüğətdə göstərilmiş əlaqə',{'scope':'reviewed','from':r['word'],'head':r['source']['head'],'edition':r['source']['edition'],'field':rel.get('source_field','related'),'senseAz':rel.get('sense_az',r.get('az') or known[r['word']]['az']),'senseEn':rel.get('sense_en',known[r['word']]['en'])})
if (INPUT/'new-relations.json').exists():
 for rel in read(INPUT/'new-relations.json'):
  add(rel['a'],rel['b'],rel['type'],'Məna üzrə yoxlanmış lüğət əlaqəsi',rel['proof'])
az='Az danışan, sakit, susqun.';en='Taciturn, quiet; habitually saying little.'
overrides={'dinməz-söyləməz':{'az':az,'en':en,'bilingualMethod':'edited','definitionReview':True,'definitionReviewAttribution':'growth-attribution.json','bilingualSenses':[{'az':az,'en':en}]}}
result={'nodes':nodes,'edges':edges,'evidence':evidence,'blocked':blocked,'overrides':overrides,'meta':{'added_entries':len(nodes),'added_edges':len(edges),'families':len(families['families'])}}
(DIST/'growth.js').write_text('window.WORD_WEB_GROWTH='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n')
# Full morphology provenance is available without loading it into the animation.
for source in families['sources'].values():
 if 'file' in source:source['file']=Path(source['file']).name
attribution={'method':'Additive dictionary expansion and reviewed sense relations. Root-family siblings share a documented lexical base; overlapping compound memberships never merge families. No spelling-prefix or transitive synonym inference.',
 'license':'Dictionary excerpts from Wiktionary contributors, CC BY-SA 4.0; source editions and URLs are retained per entry.',
 'translation':'AZ/EN glosses machine-assisted unless marked edited. Source research does not certify every possible lexical sense.',
 'previous_entries':len(base['nodes']),'added_entries':len(nodes),'added_edges':len(edges),'added_edges_by_type':dict(Counter(e[2] for e in edges)),
 'families':families,'semantic_review':semantic,'held':held,'new_relation_review':read(INPUT/'new-relation-review.json'),'words':node_records}
current_path=ROOT/'.growth-current.json'
subprocess.run(['node','scripts/export_current_model.cjs',str(current_path)],cwd=ROOT,check=True)
current=read(current_path);current_path.unlink()
connected={w for e in current['edges'] for w in e[:2]}
old_unresolved=set(read(ROOT/'scripts/content/reference-audit.json')['unresolved'])
attribution['coverage']={'total_entries':len(current['nodes']),'total_connections':len(current['edges']),'net_additional_connections':len(current['edges'])-len(base['edges']),'entries_without_a_documented_connection':len(set(known)-connected),'earlier_unresolved_references_now_defined':sorted(old_unresolved & set(known)),'scope':'The checks cover documented root families, explicit source relations and reviewed topic links. Remaining unlinked entries need sense research; graph completeness is not claimed.'}
dump(DIST/'growth-attribution.json',attribution)
print(json.dumps({k:v for k,v in attribution.items() if k in ['added_entries','added_edges','added_edges_by_type']}))
