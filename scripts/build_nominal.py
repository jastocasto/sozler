#!/usr/bin/env python3
"""Archive grammatical forms without stripping endings or altering source datasets.
Usage: build_nominal.py VIEW.json ENWIKTIONARY.jsonl
The second argument may also be a word-keyed JSON cache of the same source entries.
"""
import collections,hashlib,json,re,sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent;out=root/'dist'
view=json.loads(Path(sys.argv[1]).read_text());nodes={n['w']:n for n in view['nodes']};raw={n['w']:n for n in view['raw']}
source_path=Path(sys.argv[2]);source=collections.defaultdict(list)
if source_path.suffix=='.json':source.update(json.loads(source_path.read_text()))
else:
    for line in source_path.open():
        d=json.loads(line)
        if d.get('lang_code')=='az' and d['word'] in nodes:source[d['word']].append(d)
bi=json.loads((out/'bilingual.js').read_text().split('=',1)[1].strip().rstrip(';'))
extra_translations=json.loads((root/'scripts/nominal-translations.json').read_text())
reviewed_forms=json.loads((root/'scripts/nominal-reviewed-forms.json').read_text())
posmap={'adj':'adjective','adv':'adverb','pron':'pronoun','num':'numeral','postp':'postposition','intj':'interjection','conj':'conjunction','det':'determiner'}
case_tags={'nominative','genitive','dative','accusative','locative','ablative','comitative','instrumental','possessive','plural','comparative','superlative'}
verb_tags={'participle','converb','imperative','conditional','indicative','past','present','future'}
derivation={'diminutive','feminine','emphatic','noun-from-verb'}
labels={'nominative':('adlıq hal','nominative'),'genitive':('yiyəlik hal','genitive'),'dative':('yönlük hal','dative'),'accusative':('təsirlik hal','accusative'),'locative':('yerlik hal','locative'),'ablative':('çıxışlıq hal','ablative'),'comitative':('birgəlik','comitative'),'instrumental':('vasitəlik','instrumental'),'possessive':('mənsubiyyət','possessive'),'plural':('cəm','plural'),'singular':('tək','singular'),'first-person':('I şəxs','first person'),'second-person':('II şəxs','second person'),'third-person':('III şəxs','third person'),'comparative':('müqayisə dərəcəsi','comparative'),'superlative':('üstünlük dərəcəsi','superlative'),'participle':('feli sifət','participle'),'negative':('inkar','negative'),'non-past':('keçmiş olmayan zaman','non-past'),'predicative':('xəbərlik','predicative')}
gram=re.compile(r'^(?!(?:Forms the|broken plural|nominative broken plural))(?:(?:[\w/-]+)\s+){0,9}(?:genitive|dative|accusative|locative|ablative|comitative|instrumental|possessive|plural|comparative|superlative)(?:\s+[\w/-]+){0,4}\s+of\s+(.+)$',re.I)
def grammatical(d,s):
    if d['pos']=='verb':return False
    tags=set(s.get('tags',[]));gs=s.get('glosses',[])
    if any('broken plural of ' in g for g in gs):return False # Borrowed lexical nouns, not Azerbaijani case endings.
    if s.get('form_of') and (tags&(case_tags|verb_tags|{'predicative'})):return True
    return any(gram.match(g) or g.startswith('inflection of ') for g in gs)
def base_of(s):
    if s.get('form_of'):return s['form_of'][0]['word']
    for target,link in s.get('links',[]):
        if '#Azerbaijani' in link:return target
    for g in s.get('glosses',[]):
        if ' of ' in g:return re.split(r'[(:;“]',g.split(' of ',1)[1])[0].strip()
    return ''
def describe(base,tags):
    az=[labels[t][0] for t in labels if t in tags];en=[labels[t][1] for t in labels if t in tags]
    return (f'“{base}” sözünün qrammatik forması'+(': '+', '.join(az) if az else '')+'.',f'Grammatical form of “{base}”'+(': '+', '.join(en) if en else '')+'.')
records={};excluded=set();overrides={};missing=[];kept=[]
def archive(word,base,tags,glosses,origin='dictionary'):
    if not base:raise ValueError('Missing base for '+word)
    k=(word,base);r=records.setdefault(k,{'w':word,'base':base,'tags':[],'analyses':[],'source':{'head':word,'edition':'en'},'origin':origin})
    if origin=='table':r['source']['head']=(nodes[word].get('source') or {}).get('head',base)
    tags=sorted(set(tags)-{'form-of'});r['tags']=sorted(set(r['tags']+tags));az,en=describe(base,tags)
    a={'tags':tags,'senses':glosses,'az':az,'en':en}
    if a not in r['analyses']:r['analyses'].append(a)
def retain(n,lexical):
    glosses=list(dict.fromkeys(g for d,s in lexical for g in s.get('glosses',[])))
    pairs=[]
    for g in glosses:
        p=extra_translations.get(g) or bi['texts'].get('en\t'+g)
        if not p:missing.append([n['w'],g]);continue
        pairs.append({'az':p[0],'en':p[1]})
    if not pairs:return
    old_is_lexical=n['quality'] in ['curated','editorial'] and not n['form'] and not gram.match(n['en'])
    primary={'az':n['az'],'en':n['en']} if old_is_lexical else pairs[0]
    p=posmap.get(lexical[0][0]['pos'],lexical[0][0]['pos'])
    overrides[n['w']]={**primary,'pos':p,'base':'','form':'','bilingualSenses':pairs,'retainedLexicalSense':True}
    kept.append(n['w'])
for word,n in nodes.items():
    if word=='onsuz':
        overrides[word]={'az':'O olmadan; həmin şəxsin və ya şeyin iştirakı olmadan.','en':'Without him, her, or it; in the absence of that person or thing.','pos':'postposition','base':'','form':'','bilingualSenses':[],'retainedLexicalSense':True}
        continue # The source's ablative label is erroneous; -suz is privative derivation.
    analyses=[(d,s) for d in source.get(word,[]) for s in d.get('senses',[]) if d['pos']!='verb']
    inflections=[(d,s) for d,s in analyses if grammatical(d,s)]
    lexical=[(d,s) for d,s in analyses if not grammatical(d,s) and s.get('glosses') and not s.get('alt_of') and 'alt-of' not in s.get('tags',[])]
    if word in reviewed_forms:
        review=reviewed_forms[word]
        if not inflections:inflections=[({'pos':n['pos']},{'form_of':[{'word':review['base']}],'tags':review['tags'],'glosses':[n['en']]})]
        lexical=[]
    for d,s in inflections:
        tags=set(s.get('tags',[]))
        if not tags&case_tags:
            for tag in case_tags:
                if any(tag in g for g in s.get('glosses',[])):tags.add(tag)
        archive(word,base_of(s),tags,s.get('glosses',[]))
    if n['form'] in ['plural','locative','ablative']:
        if not inflections:archive(word,n['base'],[n['form']]+([] if n['form']=='plural' else ['singular']),[n['en']],'original' if n['quality']=='generated' else 'table')
        if lexical:retain(n,lexical)
        else:excluded.add(word)
    elif inflections:
        if lexical:retain(n,lexical)
        else:excluded.add(word)
    elif n['pos']=='form' or n['form']=='listed-form':
        if lexical:retain(n,lexical) # Diminutives, feminine nouns, verbal nouns and lexical intensives.
        else:raise ValueError('Unclassified form: '+word+' / '+n['en'])
    elif n['form']=='verb-form' and lexical:
        retain(n,lexical) # The verbal reading is already in Grammar; clear stale form metadata on the noun.
if missing:
    (root/'scripts/nominal-missing-translations.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2)+'\n')
    raise ValueError('Untranslated retained lexical senses: '+str(len(missing)))
# These two pairs differ only in capitalization and have the same lexical meaning.
aliases={'zərdüştilik':'Zərdüştilik','pasxa':'Pasxa'}
for a,b in aliases.items():assert a in nodes and b in nodes and a not in excluded and b not in excluded
def lemma(word,seen=None):
    seen=set() if seen is None else seen
    if word in seen:return word
    seen.add(word)
    if word in aliases:return aliases[word]
    if word not in excluded:return word
    candidates=[r['base'] for r in records.values() if r['w']==word]
    return lemma(candidates[0],seen) if candidates else word
for r in records.values():
    r['lemma']=lemma(r['base']);r['az']=r['analyses'][0]['az'];r['en']=r['analyses'][0]['en']
    r['kind']='nominal'
survivors=[n for n in nodes.values() if n['w'] not in excluded and n['w'] not in aliases]
preserved={f:hashlib.sha256((out/f).read_bytes()).hexdigest() for f in ['data.js','lexicon.js','vocabulary.js','review.js','bilingual.js','grammar.js','grammar-archive.json','expansion.js','learning-data.js']}
meta={'before_main_entries':len(nodes),'moved_entries':len(excluded),'archived_spellings':len({r['w'] for r in records.values()}),'archived_records':len(records),'retained_homonyms_and_derivatives':len(kept),'merged_capitalization_variants':len(aliases),'headwords':len(survivors),'single_words':sum(' ' not in n['w'] for n in survivors),'multiword_entries':sum(' ' in n['w'] for n in survivors),'preserved_files':preserved,'policy':'Move documented case, plural, possessive and other grammatical inflections; retain independent lexical senses, derivations, lexicalized intensives and borrowed lexical nouns. No suffix stripping. Count distinct dictionary headwords, including compounds and expressions, not inflected spellings.','source':'English Wiktionary via Kaikki, the same dated snapshot as lexicon-attribution.json','source_input_sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),'corrections':[{'word':'onsuz','reason':'Privative derivation (without him/her/it), not the source-labelled ablative of o.'}]}
assert len(excluded)>20000 and len(survivors)>18000
inflected_pairs={tuple(sorted((r['w'],r['base']))) for r in records.values()}
blocked=[e for e in view['edges'] if e[2]=='root' and 'Lüğətdə göstərilmiş söz forması' in e[3] and tuple(sorted(e[:2])) in inflected_pairs]
payload={'records':list(records.values()),'excluded':sorted(excluded),'overrides':overrides,'aliases':aliases,'blockedEdges':blocked,'meta':meta}
(out/'nominal.js').write_text('window.WORD_WEB_NOMINAL='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n')
affected={r['w'] for r in records.values()}
(out/'nominal-archive.json').write_text(json.dumps({**payload,'originalNodes':[n for n in view['raw'] if n['w'] in affected],'originalEdges':[e for e in view['edges'] if e[0] in affected or e[1] in affected]},ensure_ascii=False,separators=(',',':'))+'\n')
(out/'word-count.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in meta.items() if k not in ['preserved_files','policy','source_input_sha256','corrections']},ensure_ascii=False,indent=2))
