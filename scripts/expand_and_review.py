#!/usr/bin/env python3
"""Add sourced lemmas and audit semantic links without rewriting earlier datasets.
Usage: python scripts/expand_and_review.py /workspace/soz-sources
"""
import collections, hashlib, itertools, json, re, sys
from pathlib import Path
from etymology_components import complete_derived_target
root=Path(__file__).resolve().parent.parent; out=root/'dist'; src=Path(sys.argv[1])
def read(name):return json.loads((out/(name+'.js')).read_text().split('=',1)[1].strip().rstrip(';'))
old=[read(f) for f in ['data','lexicon','vocabulary']]; grammar=read('grammar')
known={n[0]:n for payload in old for n in payload['nodes']}; initial=set(known)
valid=re.compile(r"[a-zəöüğşçı][a-zəöüğşçı '\-]{1,49}")
posmap={'adj':'adjective','adv':'adverb','pron':'pronoun','num':'numeral','postp':'postposition','intj':'interjection','conj':'conjunction','det':'determiner'}
allowed={'noun','adj','adv','verb','pron','num','postp','intj','conj','det','particle','phrase'}
def clean(s):return re.sub(r'\s+',' ',s or '').strip()
def inf(w):return w.endswith(('maq','mək'))
def lexical(d,s):return not s.get('form_of') and not s.get('alt_of') and not set(s.get('tags',[]))&{'form-of','alt-of','misspelling','obsolete','archaic'} and (d.get('pos')!='verb' or inf(d['word']))
def glosses(senses):return list(dict.fromkeys(clean(g) for s in senses for g in s.get('glosses',[]) if 0<len(g)<600 and not any(x in g for x in ['<','>','{{','}}'])))[:5]
records={}; sources=[]; new=[]; pending=[]; evidence=collections.defaultdict(list)
for ed in ['en','tr','ru','fr','de','ku']:
    path=src/f'az-{ed}wiktionary.jsonl'; entries=[]
    for line in path.open():
        d=json.loads(line)
        if d.get('lang_code')=='az' and d.get('pos') in allowed and valid.fullmatch(d['word']):
            d.pop('forms',None);d.pop('sounds',None);entries.append(d)
    records[ed]=entries
    if ed in ['fr','de','ku']:
        metadata_path=src/f'az-{ed}wiktionary-source.json'
        meta=json.loads(metadata_path.read_text()) if metadata_path.exists() else next(dict(s) for s in json.loads((out/'relationship-audit.json').read_text())['meta']['sources'] if s['edition']==ed)
        meta.update(sha256=hashlib.sha256(path.read_bytes()).hexdigest(),license='CC BY-SA 4.0');sources.append(meta)

# Prefer actual headword entries before glossed derived-term listings.
for ed in ['fr','de','ku']:
    grouped=collections.defaultdict(list)
    for d in records[ed]:
        if d['word'] in known or (d['pos']=='verb' and (not inf(d['word']) or d['word'].endswith(('mamaq','məmək')))):continue
        senses=[s for s in d.get('senses',[]) if lexical(d,s)]
        if glosses(senses):grouped[d['word']].append((d,senses))
    count=0
    for w,group in grouped.items():
        g=glosses([s for d,ss in group for s in ss]);p=posmap.get(group[0][0]['pos'],group[0][0]['pos']);metadata={'head':w,'senses':g,'language':ed,'edition':ed}
        n=[w,'; '.join(g[:2])[:350],'',p,'Wiktionary','','','wiktionary',metadata];new.append(n);known[w]=n;count+=1
    next(s for s in sources if s['edition']==ed)['added_headwords']=count

listed=collections.defaultdict(list)
for d in records['en']:
    if d['word'] not in known:continue
    for obj in [d]+d.get('senses',[]):
        for field in ['derived','related']:
            for r in obj.get(field,[]):
                w=r.get('word','');g=clean(r.get('english') or r.get('translation'))
                if w in known or not valid.fullmatch(w) or not g or len(g)>350:continue
                if w.endswith(('mamaq','məmək')) or set(r.get('tags',[]))&{'form-of','obsolete','archaic'}:continue
                if g.startswith('to ') and not inf(w):continue
                listed[w].append((d['word'],g,field))
# Reject unverified participles/conjugations even when a derived-term list has a gloss.
inflected=set()
for line in (src/'az-enwiktionary.jsonl').open():
    d=json.loads(line)
    if d.get('pos')!='verb':continue
    for f in d.get('forms',[]):
        w=f.get('form','')
        if w in listed and not inf(w):inflected.add(w)
for w,items in listed.items():
    if w in inflected:continue
    g=list(dict.fromkeys(i[1] for i in items))[:5];head=items[0][0]
    n=[w,'; '.join(g[:2])[:350],'','verb' if inf(w) else 'phrase' if ' ' in w else 'word','Wiktionary','','','wiktionary',{'head':head,'senses':g,'language':'en','edition':'en','entryKind':'glossed-derived-term'}]
    new.append(n);known[w]=n

def key(a,b,t):return '|'.join(sorted((a,b)))+'|'+t
def add(a,b,t,note,proof):
    if a==b or a not in known or b not in known:return
    k=key(a,b,t)
    if proof not in evidence[k]:evidence[k].append(proof)
    pending.append([a,b,t,note])
for ed,entries in records.items():
    for d in entries:
        w=d['word']
        if w not in known:continue
        senses=d.get('senses',[])
        # Explicit links retain their source sense and register; do not form cliques.
        for obj in [d]+senses:
            if d['pos']=='verb' and not inf(w):continue
            for field,t,label in [('synonyms','syn','Lüğətdə sinonim'),('antonyms','ant','Lüğətdə antonim'),('derived','root','Lüğətdə törəmə söz'),('related','topic','Lüğətdə əlaqəli söz')]:
                for r in obj.get(field,[]):
                    if field=='derived' and not complete_derived_target(r):continue
                    sense=clean(r.get('sense')) or ('; '.join(glosses([obj])) if obj is not d else '; '.join(glosses(senses)) if len(senses)==1 else '')
                    proof={'from':w,'head':w,'edition':ed,'language':ed,'sense':sense,'pos':posmap.get(d['pos'],d['pos']),'scope':'sense' if obj is not d or r.get('sense') or len(senses)==1 else 'entry','tags':list(dict.fromkeys(obj.get('tags',[])+r.get('tags',[]))),'qualifier':clean(r.get('qualifier') or obj.get('qualifier'))}
                    add(w,r.get('word',''),t,label+' · Wiktionary ('+ed+')',proof)

corrections=[]; blocked=[]
def correct(a,b,kind,context,reason):
    wrong='ant' if kind=='syn' else 'syn';blocked.append([a,b,wrong]);corrections.append({'a':a,'b':b,'keep':kind,'remove':wrong,'context':context,'reason':reason})
    add(a,b,kind,context,{'from':a,'head':a,'edition':'en','language':'az','sense':context,'scope':'reviewed','tags':[],'qualifier':'Məna üzrə yoxlanmış əlaqə'})
for a,b in [('nazik','qalın'),('incə','qalın'),('səadət','bədbəxtlik'),('xoşbəxtlik','bədbəxtlik'),('azdanışan','çoxdanışan'),('qaradinməz','çoxdanışan'),('dinməz','çoxdanışan'),('dinməz-söyləməz','çoxdanışan'),('səssiz','çoxdanışan'),('dar','enli')]:
    context='qalınlıq / incəlik' if a in ['nazik','incə'] else 'xoşbəxtlik / bədbəxtlik' if a in ['səadət','xoşbəxtlik'] else 'danışqanlıq / az danışmaq' if b=='çoxdanışan' else 'en: dar / enli'
    correct(a,b,'ant',context,'The source glosses describe opposing values; a synonym label in the imported listing contradicts those meanings.')
correct('izah etmək','açıqlamaq','syn','bir şeyi başa salmaq, izahını vermək','Both source senses mean explain/account for; the imported antonym label is inconsistent.')

# A deliberately reviewed, single-sense family. This is not transitive closure.
family=['həmişə','daim','daima','hər vaxt','hər zaman','hər an']
context='zaman zərfi: hər zaman, davamlı olaraq; işlənmə üslubu fərqlənə bilər'
for a,b in itertools.combinations(family,2):
    add(a,b,'syn',context,{'from':a,'head':'həmişə','edition':'az','language':'az','sense':context,'scope':'reviewed','tags':[],'qualifier':'Eyni zaman mənası üzrə yoxlanmış qrup'})
for a in family:
    for b in ['heç vaxt','heç zaman']:
        add(a,b,'ant','zaman tezliyi: həmişə / heç vaxt',{'from':a,'head':'həmişə','edition':'az','language':'az','sense':'zaman tezliyi: həmişə / heç vaxt','scope':'reviewed','tags':[],'qualifier':'Zaman mənası üzrə əkslik'})

oldedges=[e for p in old for e in p['edges']]; seen=set();edges=[]
for e in pending:
    k=key(*e[:3])
    if k not in seen:edges.append(e);seen.add(k)
blocked_keys={key(*e) for e in blocked};pair_types=collections.defaultdict(set)
for e in oldedges+edges:
    if e[2] in ['syn','ant'] and key(*e[:3]) not in blocked_keys and e[0] not in grammar['excluded'] and e[1] not in grammar['excluded']:pair_types[tuple(sorted(e[:2]))].add(e[2])
quarantined=[]
for pair,ts in pair_types.items():
    if len(ts)>1:
        quarantined.append(list(pair))
        for t in ['syn','ant']:blocked.append([*pair,t])
overrides={'həmişə':{'pos':'adverb'},'daima':{'pos':'adverb'}}
meta={'added_headwords':len(new),'headword_entries':sum(s['added_headwords'] for s in sources),'glossed_derived_terms':len(new)-sum(s['added_headwords'] for s in sources),'reviewed_corrections':len(corrections),'quarantined_conflicts':len(quarantined),'reviewed_time_group':family,'sources':sources,'policy':'Explicit bidirectional links, sense and register retained, no global transitive closure. Known conflicts corrected; unresolved contradictions hidden pending review. Earlier data files are preserved.'}
payload={'nodes':new,'edges':edges,'evidence':dict(evidence),'blocked':blocked,'overrides':overrides,'meta':meta}
(out/'review.js').write_text('window.WORD_WEB_REVIEW='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n')
(out/'relationship-audit.json').write_text(json.dumps({'meta':meta,'corrections':corrections,'quarantined':quarantined,'references':['https://az.wiktionary.org/wiki/həmişə','https://en.wiktionary.org/wiki/daim','https://en.wiktionary.org/wiki/hər_an','https://azleks.az/en/dictionary/hemise','https://azleks.az/en/dictionary/daim-1']},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(meta,ensure_ascii=False,indent=2));print('Quarantined:',quarantined)
