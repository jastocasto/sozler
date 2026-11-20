"""Build a dictionary gate, source-supported stem profiles and compact evidence masks."""
import json,hashlib,subprocess,sys
from pathlib import Path
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/workspace/soz-sources/az-enwiktionary.jsonl')
verbs={x['w']:x for x in json.loads(subprocess.check_output(['node','scripts/export_conjugation_verbs.cjs']))}
entries={};stems={}
for line in source.open():
 d=json.loads(line);word=d.get('word','')
 if word not in verbs or d.get('pos')!='verb' or not d.get('forms'):continue
 if word not in entries or len(d['forms'])>len(entries[word]['forms']):entries[word]=d
for word,entry in entries.items():
 base=word[:-3]
 for f in entry['forms']:
  if set(f.get('tags',[]))=={'indicative','present','singular','third-person'} and f.get('form','').endswith(('ır','ir','ur','ür')):
   candidate=f['form'][:-2]
   if candidate==base+'y' and base[-1:] in 'aəeıioöuü':candidate=base
   if candidate in [base,base[:-1]+'d']:stems[word]=candidate
   break
profiles={};inherited=0;unknown=[]
for word,item in verbs.items():
 base=word[:-3];profile={'stem':base};tail=word.split(' ')[-1];prefix=word[:-len(tail)]
 if ' ' in word and tail in stems:profile['vowelStem']=prefix+stems[tail];inherited+=1
 elif word in stems:profile['vowelStem']=stems[word]
 elif '-' in tail and tail.split('-')[-1] in stems:profile['vowelStem']=base[:base.rfind('-')+1]+stems[tail.split('-')[-1]];inherited+=1
 else:
  profile['vowelStem']=base
  if base.endswith('t'):unknown.append(word)
 if word in entries:profile['source']='https://en.wiktionary.org/wiki/'+word+'#Azerbaijani'
 else:
  src=item.get('source') or {};profile['source']='https://'+src.get('edition','en')+'.wiktionary.org/wiki/'+src.get('head',word)
 if word=='imək':profile['blocked']='Bu köməkçi fel adi məsdər kimi təsriflənmir. Mövcud formalar üçün arxivə baxın.'
 profiles[word]=profile
# Explicitly reviewed productive causatives and lexical t/d alternations absent
# from this snapshot's tables. No blanket 'all final t becomes d' substitution.
review=json.loads(Path('scripts/conjugation-stem-review.json').read_text())
reviewed=review['vowel_stems']
for word,stem in reviewed.items():
 if word in profiles and word not in stems:profiles[word]['vowelStem']=stem
rows=json.loads(subprocess.check_output(['node','-e',"process.stdout.write(JSON.stringify(require('./dist/conjugation-engine.js').rows))"]))
persons=[('first-person','singular'),('second-person','singular'),('third-person','singular'),('first-person','plural'),('second-person','plural'),('third-person','plural')]
evidence={}
for word,entry in entries.items():
 forms={}
 for f in entry['forms']:
  if f.get('form') not in ['-','—'] and 'error-unrecognized-form' not in f.get('tags',[]):forms.setdefault(','.join(sorted(f.get('tags',[]))),set()).add(f['form'])
 evidence[word]=[[[sorted(forms.get(','.join(sorted(t['tags']+(['negative'] if n else [])+(list(person) if t['personal'] else []))),set())) if t['tags'] else [] for person in persons] for n in [False,True]] for t in rows]
payload={'verbs':profiles,'order':sorted(profiles),'tenses':rows,'persons':[{'az':a,'en':e} for a,e in [('mən','I'),('sən','you'),('o','he / she / it'),('biz','we'),('siz','you (plural / polite)'),('onlar','they')]]}
# Only bitmasks are shipped: source-table strings are compared offline, not
# duplicated into a large client-side conjugation dictionary.
proc=subprocess.run(['node','scripts/verify_conjugation_evidence.cjs'],input=json.dumps({'data':payload,'evidence':evidence},ensure_ascii=False),text=True,stdout=subprocess.PIPE,check=True)
payload=json.loads(proc.stdout)
payload['stemReview']={'vowelStems':reviewed,'source':review.get('stem_source'),'wordSources':review.get('dictionary_sources',{})}
Path('dist/conjugation-data.js').write_text('window.WORD_CONJUGATIONS='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n')
Path('dist/conjugation-attribution.json').write_text(json.dumps({'source':'Dictionary headwords plus English Wiktionary tables via Kaikki','license':'CC BY-SA 4.0','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'verb_count':len(profiles),'table_profiles':len(stems),'inherited_compound_profiles':inherited,'form_categories':len(rows),'remaining_unconfirmed_t_stems':[w for w in unknown if w not in reviewed],'policy':'Only existing dictionary infinitives marked as verbs are admitted. Forms are generated using explicit vowel-harmony and inflection rules, with source-supported stem alternations and compound auxiliary profiles. A cell is marked documented only when its exact string matches the corresponding source-table tags; all other cells are labeled rule-generated. These are standard form families, not a claim to exhaust every voice, dialect, register or possible combination. Original headwords and grammar archives are untouched.','editorial_notes':['The defective copula imək is kept searchable but excluded from ordinary rule generation. Compound stems follow their lexical auxiliary profile, avoiding malformed whole-phrase source tables.','Standard negative indefinite future uses -maz/-məz in second/third persons and -mar/-mər in first persons; incorrect source-template r in second-person forms is not copied.','Source future-participle spellings ending in back-vowel -acak are not copied; standard Azerbaijani uses -acaq.','Analytic ability uses -a/-ə bilmək, including its negative forms.','Additional dictionary-listed causative t/d profiles are recorded in scripts/conjugation-stem-review.json. Their cells remain labeled generated unless independently found in the source table.']},ensure_ascii=False,indent=2)+'\n')
print(len(profiles),'dictionary verbs;',len(stems),'table stems;',len(rows),'form categories; unconfirmed t stems:',[w for w in unknown if w not in reviewed])
