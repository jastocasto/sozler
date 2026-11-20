#!/usr/bin/env python3
"""Non-destructive views over the existing dictionary. Requires dated Kaikki snapshots.
Never rewrites data.js or lexicon.js. Adds real headwords, not generated paradigms.
Usage: python scripts/separate_grammar.py /workspace/soz-sources
"""
import collections, hashlib, json, re, sys
from pathlib import Path

out = Path(__file__).resolve().parent.parent / 'dist'
src = Path(sys.argv[1])
def read_js(name):
    return json.loads((out/name).read_text().split('=', 1)[1].strip().rstrip(';'))
def write_js(name, global_name, value):
    (out/name).write_text('window.'+global_name+'='+json.dumps(value, ensure_ascii=False, separators=(',', ':'))+';\n')
original, imported = read_js('data.js'), read_js('lexicon.js')
existing = {n[0]: n for n in original['nodes']+imported['nodes']}
original_by = {n[0]: n for n in original['nodes']}
valid = re.compile(r"^[a-zəöüğşçı][a-zəöüğşçı '\-]{1,49}$")
pos_names = {'adj':'adjective','adv':'adverb','num':'numeral','pron':'pronoun','intj':'interjection','postp':'postposition','det':'determiner','conj':'conjunction'}
allowed = {'noun','verb','adj','adv','pron','num','intj','conj','postp','det','particle','phrase'}
def infinitive(w): return w.endswith(('maq','mək'))
def clean(s): return re.sub(r'\s+', ' ', s or '').strip()
def glosses(senses):
    return list(dict.fromkeys(clean(g) for s in senses for g in s.get('glosses',[]) if g and len(g)<600 and not any(x in g for x in ['<','>','{{','}}','Lua error'])))[:5]
records = collections.defaultdict(list)
for line in (src/'az-enwiktionary.jsonl').open():
    d = json.loads(line)
    if d.get('lang_code')=='az' and d.get('word') in existing: records[d['word']].append(d)

archive = {}; overrides = {}; excluded = set(); blocked = []
def source_base(word, seen=None):
    seen=set() if seen is None else seen
    if word in seen: return ''
    if infinitive(word): return word
    seen.add(word)
    for d in records.get(word,[]):
        if d.get('pos')!='verb': continue
        for s in d.get('senses',[]):
            targets=[f.get('word','') for f in s.get('form_of',[])+s.get('alt_of',[])]+[l[0] for l in s.get('links',[]) if infinitive(l[0])]
            for target in targets:
                base=source_base(target,seen)
                if base:return base
    return existing.get(word,['']*6)[5]
def nominal(w):
    n=existing[w]
    return n[6] in ['plural','locative','ablative'] or (n[3]=='form' and n[5] in existing and existing[n[5]][3] not in ['verb','form']) or any(d.get('pos')!='verb' for d in records.get(w,[]))
def archive_form(w, base, tags, meanings, head=None, origin='dictionary'):
    key = (w, base)
    item = archive.setdefault(key, {'w':w,'base':base,'tags':[],'senses':[],'source':{'head':head or w,'edition':'en','language':'en'},'origin':origin})
    item['tags'] = sorted(set(item['tags']+tags))
    item['senses'] = list(dict.fromkeys(item['senses']+meanings))

for w, node in existing.items():
    entries = records[w]; lexical = []; verb_forms = []
    for d in entries:
        for s in d.get('senses',[]):
            tags = s.get('tags',[])
            is_form = d.get('pos')=='verb' and (not infinitive(w) or ('negative' in tags and s.get('form_of')))
            if is_form:
                bases = [f['word'] for f in s.get('form_of',[]) if f.get('word')]
                if not bases: bases = [source_base(w)]
                for base in bases:
                    archive_form(w, base, tags, glosses([s]))
                    verb_forms.append(base)
                    blocked.append([w,base,'Lüğətdə göstərilmiş söz forması'])
            else: lexical.append((d,s))
    explicitly_finite = node[6]=='verb-form'
    if explicitly_finite:
        archive_form(w,node[5],['conjugated'],[node[2] or node[1]],origin='original')
        verb_forms.append(node[5])
    if not verb_forms: continue
    # Preserve independently meaningful nouns/adjectives/etc. with the same spelling.
    independent_original = w in original_by and (node[3] not in ['verb','form'] or nominal(w))
    if independent_original: continue
    if lexical:
        meanings = glosses([s for _,s in lexical])
        d = lexical[0][0]
        overrides[w] = {'pos':pos_names.get(d['pos'],d['pos']),'en':'; '.join(meanings[:2])[:350],'az':'','base':'','form':'','source':{'head':w,'senses':meanings,'language':'en','edition':'en'}}
    else: excluded.add(w)

# Resolve forms absent as separate entries against explicit conjugation tables.
for base, entries in records.items():
    if not infinitive(base): continue
    for d in entries:
        if d.get('pos')!='verb': continue
        for f in d.get('forms',[]):
            w=clean(f.get('form')); tags=f.get('tags',[])
            if w not in existing and w not in ['eləyib','eləmişdi']: continue
            if w==base or infinitive(w) or not valid.fullmatch(w) or 'table-tags' in tags or 'inflection-template' in tags: continue
            if w in existing and existing[w][3] not in ['verb','form'] and existing[w][6]!='verb-form': continue
            if w in overrides: continue
            archive_form(w,base,tags,[f'Conjugated form of {base}'],head=base,origin='conjugation-table')
            if w in existing and not nominal(w): excluded.add(w)

# Passive/causative infinitives are still base verbs, including form-of entries.
for w, entries in records.items():
    if w in excluded or not infinitive(w): continue
    if any(d.get('pos')=='verb' for d in entries) and existing[w][3]=='form':
        overrides.setdefault(w,{}).update({'pos':'verb','form':''})

grammar = {'records':sorted(archive.values(), key=lambda a:(a['base'],a['w'])),'excluded':sorted(excluded),'overrides':overrides,'blockedEdges':blocked,
 'meta':{'original_entries':len(existing),'moved_entries':len(excluded),'preserved_verb_forms':len(archive),'homonyms_preserved':len([w for w in overrides if w in {a['w'] for a in archive.values()}]),'policy':'Only verb inflections leave the main web. Independent lexical senses and derived infinitives remain. Original files are unchanged.','preserved_files':{f:hashlib.sha256((out/f).read_bytes()).hexdigest() for f in ['data.js','lexicon.js']}}}
write_js('grammar.js','WORD_WEB_GRAMMAR',grammar)
archive_words={a['w'] for a in archive.values()}
download={**grammar,'originalNodes':[n for n in original['nodes']+imported['nodes'] if n[0] in archive_words], 'originalEdges':[e for e in original['edges']+imported['edges'] if e[0] in archive_words or e[1] in archive_words], 'license':'Imported dictionary data: CC BY-SA 4.0; original user data retained unchanged. See LEXICON-LICENSE.txt.'}
(out/'grammar-archive.json').write_text(json.dumps(download,ensure_ascii=False,indent=2)+'\n')

known=set(existing); additions=[]; pending=[]; sources=[]
def collect_links(w, entries, edition):
    for d, senses in entries:
        for obj in [d]+senses:
            for field,t,label in [('synonyms','syn','Lüğətdə sinonim'),('antonyms','ant','Lüğətdə antonim'),('derived','root','Lüğətdə törəmə söz'),('related','topic','Lüğətdə əlaqəli söz')]:
                for r in obj.get(field,[]):
                    target=clean(r.get('word'))
                    if valid.fullmatch(target):pending.append([w,target,t,label+' · Wiktionary ('+edition+')'])
for edition, dump, extracted in [('tr','2026-09-01','2026-10-03'),('ru','2026-10-01','2026-10-24')]:
    path=src/f'az-{edition}wiktionary.jsonl'; grouped=collections.defaultdict(list)
    for line in path.open():
        d=json.loads(line); w=clean(d.get('word'))
        if d.get('lang_code')!='az' or d.get('pos') not in allowed or not valid.fullmatch(w): continue
        if d['pos']=='verb' and not infinitive(w): continue
        senses=[s for s in d.get('senses',[]) if not s.get('form_of') and not s.get('alt_of') and 'form-of' not in s.get('tags',[]) and 'archaic' not in s.get('tags',[]) and 'obsolete' not in s.get('tags',[])]
        if not glosses(senses): continue
        grouped[w].append((d,senses))
    count=0
    for w, entries in grouped.items():
        collect_links(w,entries,edition)
        if w in known: continue
        meanings=glosses([s for _,ss in entries for s in ss]); d=entries[0][0]
        metadata={'head':w,'senses':meanings,'language':edition,'edition':edition}
        additions.append([w,'; '.join(meanings[:2])[:350],'',pos_names.get(d['pos'],d['pos']),'Wiktionary','','','wiktionary',metadata]);known.add(w);count+=1
    sources.append({'edition':edition,'source':'Kaikki / '+edition+'.wiktionary.org','download_file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'snapshot_dump':dump,'snapshot_extracted':extracted,'added_headwords':count,'license':'CC BY-SA 4.0'})
for w, entries in records.items(): collect_links(w,[(d,d.get('senses',[])) for d in entries],'en')
edges=[];seen={tuple(sorted((e[0],e[1])))+(e[2],) for e in original['edges']+imported['edges']}
for a,b,t,note in pending:
    key=tuple(sorted((a,b)))+(t,)
    if a in known and b in known and a!=b and key not in seen: edges.append([a,b,t,note]);seen.add(key)
meta={'added_headwords':len(additions),'added_links':len(edges),'sources':sources,'note':'Distinct lowercase Latin-script Azerbaijani headwords only; no generated forms. Source-language definitions retained and labeled. No frequency ranking.'}
write_js('vocabulary.js','WORD_WEB_VOCABULARY',{'nodes':additions,'edges':edges,'meta':meta})
(out/'vocabulary-attribution.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'grammar':grammar['meta'],'vocabulary':meta},ensure_ascii=False,indent=2))
