#!/usr/bin/env python3
"""Build the additive dictionary-quality corrections from recorded source reviews.
No source layer or archived grammar record is modified. This script does not
infer correctness from automatic graph checks or from matching gloss strings.
"""
import argparse,collections,hashlib,json,re,subprocess
from pathlib import Path
from urllib.parse import urlparse,quote
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,default=ROOT/'scripts/content/verification');parser.add_argument('--draft',action='store_true');args=parser.parse_args();IN=args.input;DIST=ROOT/'dist'
def read(p):return json.loads(Path(p).read_text())
def write(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def normalized_sources(refs):
 result=[]
 for ref in refs:
  if isinstance(ref,str):ref={'url':ref,'title':urlparse(ref).netloc}
  assert isinstance(ref,dict) and urlparse(ref['url']).scheme=='https'
  ref=dict(ref)
  # Use exact original PDFs where their hashes were matched to the extraction.
  if ref.get('volume') in [1,3] and 'azerbaijan-mcp' in ref['url']:
   volume=ref['volume'];page=ref.get('pdf_page');ref['research_url']=ref['url']
   ref['url']=f'https://www.urmu.eu/Azerbaycan_dilinin_izahli_lugeti_{volume}.pdf'+(f'#page={page}' if page else '')
  if ref not in result:result.append(ref)
 return result

def compile_dictionary_edition(source):
 """Compile later, individually sourced entries without altering the original review evidence."""
 words=set()
 for entry in source['entries']+source['revisions']:
  word=entry['word']
  if word in words or not all(entry[field].strip() for field in ('word','pos','az','en')):
   raise ValueError(f'Invalid or duplicate dictionary entry: {word}')
  words.add(word)
  for sense in entry['senses']:
   if not sense['az'].strip() or not sense['en'].strip():
    raise ValueError(f'Missing bilingual sense: {word}')
  entry['sources']=normalized_sources(entry['sources'])
  if not entry['sources']:
   raise ValueError(f'Missing dictionary evidence: {word}')
 edges=[];pairs=set()
 for edge in source['connections']:
  a,b,kind=edge['a'],edge['b'],edge['type']
  pair=(*sorted((a,b)),kind)
  if a==b or pair in pairs or kind not in ('syn','ant','root','topic','ending'):
   raise ValueError(f'Invalid dictionary connection: {pair}')
  refs=normalized_sources(edge['sources'])
  if not refs or not edge['sense_az'].strip() or not edge['sense_en'].strip():
   raise ValueError(f'Missing bilingual connection evidence: {pair}')
  pairs.add(pair)
  proof={'from':a,'scope':'reviewed','auditReviewed':True,'senseAz':edge['sense_az'],'senseEn':edge['sense_en'],'refs':refs}
  edges.append([a,b,kind,'Lüğətdə göstərilən məna',None,[proof]])
 return {'entries':source['entries'],'revisions':source['revisions'],'edges':edges}

edition_path=IN/'dictionary-edition.json'
dictionary_edition=compile_dictionary_edition(read(edition_path)) if edition_path.exists() else None
common_path=IN/'common-words.json'
common_review=None
if common_path.exists():
 source=read(common_path)
 existing=source['connection_evidence']
 retyped=source['retyped_connections']
 compiled=compile_dictionary_edition({'entries':[],'revisions':source['revisions'],'connections':existing+retyped})
 for row in retyped:
  if row['old_type']==row['type'] or row['old_type'] not in ('syn','ant','root','topic','ending'):
   raise ValueError(f'Invalid previous relationship for {row["a"]} and {row["b"]}')
 common_review={
  'revisions':compiled['revisions'],
  'evidence':{'|'.join([*sorted((a,b)),kind]):proofs for a,b,kind,_,_,proofs in compiled['edges'][:len(existing)]},
  'edges':compiled['edges'][len(existing):],
  'blocked':[[row['a'],row['b'],row['old_type']] for row in retyped],
 }
# Export the exact preserved baseline, excluding only this verification layer.
snapshot=ROOT/'.verification-base.json'
subprocess.run(['node','scripts/export_current_model.cjs',str(snapshot),'--without-verification'],cwd=ROOT,check=True)
base=read(snapshot);snapshot.unlink();by={n['w']:n for n in base['nodes']}
reviews=[read(IN/f'review-{i}.json') for i in range(5)]
reviewed=set();compared=set();holds={};corrections={};reviewcounts=[]
for i,r in enumerate(reviews):
 rw=set(r.get('reviewed_words',[]));sv=set(r.get('source_verified_words',[]));assert rw<=by.keys() and sv<=rw,(i,'unknown coverage word')
 reviewed|=rw;compared|=sv
 for h in r.get('holds',[]):
  word=h['word'];assert word in by;holds.setdefault(word,[]).append(h)
 for c in r.get('corrections',[]):
  word=c['word'];assert word in by and word in rw,word
  assert c['az'].strip() and c['en'].strip() and c.get('reason'),word
  if not c.get('sources') and args.draft:
   holds.setdefault(word,[]).append({'word':word,'reason':'Proposed edit awaits a source citation.'})
   continue
  assert c.get('sources'),word+' needs source provenance'
  c['sources']=normalized_sources(c['sources'])
  assert word not in corrections or corrections[word]==c,word+' conflicting edits'
  corrections[word]=c
 reviewcounts.append({'shard':i,'assessed':len(rw),'source_compared':len(sv),'corrections':len(r.get('corrections',[])),'holds':len(r.get('holds',[])),'method':r.get('coverage',{})})
if not args.draft:assert reviewed==by.keys(),f'Incomplete review: {len(reviewed)}/{len(by)}'
entry_exclusions=read(IN/'entry-exclusions.json') if (IN/'entry-exclusions.json').exists() else []
excluded=[r['word'] for r in entry_exclusions]
for word in excluded:
 assert word in by
 holds.pop(word,None)
status={w:'quarantined' if w in excluded else 'needs-review' if w in holds else 'source-compared' if w in compared else 'ai-screened' for w in sorted(reviewed)}
# Never turn a count of source pages into a source verification claim.
overrides={};deferred=[]
for word,c in corrections.items():
 if c.get('confidence','high') not in ['high','confirmed','source-supported']:
  deferred.append(c);status[word]='needs-review';continue
 original=by[word];c['before']={k:original[k] for k in ['az','en','pos']};sources=c['sources'];senses=c.get('sensePairs') or c.get('sense_pairs')
 if senses is None:senses=[{'az':c['az'],'en':c['en']}]+original.get('bilingualSenses',[])[1:]
 else:senses=[{'az':c['az'],'en':c['en']}]+[{'az':p['az'],'en':p['en']} for p in senses if p['az']!=c['az'] or p['en']!=c['en']]
 assert not re.search('[\u0400-\u04ff]',c['az']+c['en']),word
 for p in senses:assert p['az'] and p['en'] and not re.search('[\u0400-\u04ff]',p['az']+p['en']),word
 override={'az':c['az'],'en':c['en'],'bilingualMethod':'edited','bilingualSenses':senses,'definitionReview':True,'definitionReviewAttribution':'verification-report.html#w='+quote(word,safe=''),'definitionSources':sources}
 if c.get('pos'):override['pos']={'adj':'adjective','adv':'adverb','n':'noun','v':'verb'}.get(c['pos'],c['pos'])
 overrides[word]=override
relation=read(IN/'relation-audit.json');blocked=[];newedges=[];evidence={};seen=set()
def key(a,b,t):return '|'.join(sorted([a,b]))+'|'+t
for r in relation.get('blocked',[])+relation.get('holds',[]):
 a,b,t=r['a'],r['b'],r['type'];assert a in by and b in by and a!=b
 k=key(a,b,t)
 if k not in seen:blocked.append([a,b,t]);seen.add(k)
for r in relation.get('corrections',[])+relation.get('added',[]):
 a,b,t=r['a'],r['b'],r['type'];assert a in by and b in by and a!=b and t in ['root','syn','ant','topic','ending']
 if r.get('old_type') and r['old_type']!=t:
  k=key(a,b,r['old_type'])
  if k not in seen:blocked.append([a,b,r['old_type']]);seen.add(k)
 az=r.get('sense_az') or overrides.get(a,by[a])['az'];en=r.get('sense_en') or overrides.get(a,by[a])['en'];assert az and en
 refs=normalized_sources(r.get('sources',[]))
 proof={'auditReviewed':True,'scope':'reviewed','from':a,'head':a,'edition':'az','senseAz':az,'senseEn':en,'refs':refs,'qualifierAz':r.get('qualifier_az',''),'qualifierEn':r.get('qualifier_en','')}
 newedges.append([a,b,t,'Məna üzrə lüğət yoxlaması']);evidence.setdefault(key(a,b,t),[]).append(proof)
# Repair a demonstrated translation failure in registered domain labels. These
# exact-source replacements cover secondary senses and relation explanations too.
# A reviewed headword definition wins when it corresponds to that primary gloss.
bilingual=read_texts=json.loads((DIST/'bilingual.js').read_text().split('=',1)[1].strip().rstrip(';'))
translations={};translation_reviews=[]
for source,pair in bilingual['texts'].items():
 if not source.startswith('ru\t'):continue
 raw=source.split('\t',1)[1]
 if not re.match(r'^(мед\.|ботан\.)\s',raw,re.I) or not re.match(r'^(honey|nerd)\b',pair[1],re.I):continue
 candidates=[]
 for word,n in by.items():
  ns=n.get('source') or {};ss=ns.get('senses',[])
  if word in overrides and ns.get('language')=='ru' and ss and ss[0]==raw:candidates.append((word,overrides[word]))
 if candidates:
  word,c=min(candidates,key=lambda x:(by[x[0]].get('source',{}).get('head')!=x[0],len(x[0]),x[0]));new=[c['az'],c['en']];method='reviewed primary headword'
 else:
  medical=raw.lower().startswith('мед.')
  en=re.sub(r'^(?:honey|nerd)\.?\s*','',pair[1],flags=re.I)
  az=re.sub(r'^(?:balın|bal|nərd|əclaf)\.?\s*','',pair[0],flags=re.I)
  new=[('tibb: ' if medical else 'botanika: ')+az,('medicine: ' if medical else 'botany: ')+en];method='correct subject label mistranslation'
 translations[source]=new;translation_reviews.append({'source':source,'before':pair,'after':new,'method':method})
meta={'entries':len(by),'active_entries':len(by)-len(excluded),'quarantined_entries':len(excluded),'assessed_entries':len(reviewed),'source_compared_entries':len(compared),'corrected_entries':len(overrides),'uncertain_entries':sum(s=='needs-review' for s in status.values()),'blocked_connections':len(blocked),'added_or_retyped_connections':len(newedges),'repaired_registered_translations':len(translations)}
runtime={'excluded':excluded,'overrides':overrides,'status':status,'blocked':blocked,'edges':newedges,'evidence':evidence,'texts':translations,'meta':meta}
(DIST/'verification.js').write_text('window.WORD_WEB_VERIFICATION='+json.dumps(runtime,ensure_ascii=False,separators=(',',':'))+';\n')
# Measure the actual active graph after deduplication, exclusion and precedence.
after_path=ROOT/'.verification-after.json'
subprocess.run(['node','scripts/export_current_model.cjs',str(after_path)],cwd=ROOT,check=True)
after=read(after_path);after_path.unlink()
old_keys={key(*e[:3]) for e in base['edges']};new_keys={key(*e[:3]) for e in after['edges']}
meta.update({'connections_before':len(base['edges']),'connections_after':len(after['edges']),'removed_active_connections':len(old_keys-new_keys),'new_active_connections':len(new_keys-old_keys)})
# These corrections and additions follow the historical verification and print passes.
if dictionary_edition:
 runtime['dictionaryEdition']=dictionary_edition
if common_review:
 runtime['commonWordReview']=common_review
(DIST/'verification.js').write_text('window.WORD_WEB_VERIFICATION='+json.dumps(runtime,ensure_ascii=False,separators=(',',':'))+';\n')
attribution={'method':'AI-assisted entry-by-entry review against cached multilingual dictionary glosses, native Azerbaijani Wiktionary revisions, and targeted dictionary research. Correctness is sense-specific. Automatic graph checks do not constitute linguistic verification. This is not a professional linguistic certification.',
 'display_languages':['az','en'],'policy':'Source-compared means the displayed sense was compared with cited dictionary evidence, not that every possible sense is certified. Unresolved disputes remain labelled. Original dictionary layers and grammatical archives remain intact.',
 'license':'New editorial paraphrases and adaptations are shared under CC BY-SA 4.0. Wiktionary excerpts retain contributor attribution. Other dictionary sites are referenced for factual sense verification; their prose is not republished.',
 'summary':meta,'entry_exclusions':[{**r,'original':{k:by[r['word']][k] for k in ['w','az','en','pos','source']}} for r in entry_exclusions],'translation_repairs':translation_reviews,'reviews':reviewcounts,'corrections':list(corrections.values()),'deferred_corrections':deferred,'uncertain_definitions':holds,'relation_audit':relation,'entry_review_status':status,
 'native_bulk_source':read(IN/'native-bulk-summary.json') if (IN/'native-bulk-summary.json').exists() else None,'print_dictionary_source':read(IN/'print-source-summary.json') if (IN/'print-source-summary.json').exists() else None}
if dictionary_edition:
 attribution['dictionary_edition']={'entries':len(dictionary_edition['entries']),'revisions':len(dictionary_edition['revisions']),
                                    'connections':len(dictionary_edition['edges']),'source_sha256':hashlib.sha256(edition_path.read_bytes()).hexdigest()}
if common_review:
 attribution['common_words']={'revisions':len(common_review['revisions']),'explained_connections':len(common_review['evidence']),
                              'retyped_connections':len(common_review['edges']),'source_sha256':hashlib.sha256(common_path.read_bytes()).hexdigest()}
write(DIST/'verification-attribution.json',attribution);print(json.dumps(meta),flush=True)
