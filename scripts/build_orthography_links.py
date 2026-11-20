#!/usr/bin/env python3
"""Build supported spelling-entry relations and verb evidence from local source snapshots."""
import argparse
import collections
import hashlib
import json
import re
import sqlite3
import unicodedata
from pathlib import Path
from urllib.parse import quote

from orthography_families import build as build_families

ROOT = Path(__file__).resolve().parent.parent
ORTHOGRAPHY_OUTPUT = ROOT / 'dist' / 'orthography-lexical.js'
EVIDENCE_OUTPUT = ORTHOGRAPHY_OUTPUT.with_name('orthography-lexical-evidence.js')
GRAMMAR = 'https://www.academia.edu/129901902/JALA_GARIBOVA_and_SABINA_ALIYEVA_2024_A_GRAMMAR_OF_CONTEMPORARY_AZERBAIJANI'
SPELLING_RULES = 'https://e-qanun.az/framework/47674'
ANTONYMS = 'https://urmu.eu/Azerbaycan_dilinin_antonimler_lugeti.pdf'
SPELLING = 'https://e-qanun.az/framework/42073'
SYNONYMS = 'https://kitabxana.nmi.edu.az/wp-content/uploads/2020/09/Az%C9%99rbaycan-dilind%C9%99n-siinoniml%C9%99r-lug%C9%99ti.-A-Z..pdf'
STEM_RULE = 'https://api.filologiya.az/uploads/Orfoqrafiya_v_orfoepiya_t_drisinin_metodik_saslari_eb40ac0ce5.pdf'
TOPIC_HEADS = {
    'anat.':'anatomiya', 'astr.':'astronomiya', 'bayt.':'baytarlıq',
    'biol.':'biologiya', 'bot.':'botanika', 'coğr.':'coğrafiya',
    'd.y.':'dəmiryolu', 'dəniz.':'dənizçilik', 'dilç.':'dilçilik',
    'din.':'dinşünaslıq', 'elek.':'elektrik', 'elektr.':'elektrik',
    'ekol.':'ekologiya', 'etn.':'etnoqrafiya',
    'ədəb.':'ədəbiyyat', 'əcz.':'əczaçılıq', 'fəls.':'fəlsəfə', 'fiz.':'fizika',
    'geod.':'geodeziya', 'geol.':'geologiya', 'hərb.':'hərb', 'hüq.':'hüquq', 'idm.':'idman',
    'inform.':'informatika', 'infor.':'informatika', 'inc.':'incəsənət',
    'iqt.':'iqtisadiyyat', 'k.t.':'kənd təsərrüfatı', 'kim.':'kimya',
    'kul.':'kulinariya', 'mal.':'maliyyə', 'memar.':'memarlıq',
    'miner.':'mineralogiya', 'müh.':'mühasibat', 'mus.':'musiqi', 'ped.':'pedaqogika',
    'poliq.':'poliqrafiya', 'psix.':'psixologiya', 'riyaz.':'riyaziyyat',
    'sığ.':'sığorta', 'şahm.':'şahmat', 'tar.':'tarix', 'tex.':'texnika',
    'tib.':'tibb', 'xalç.':'xalçaçılıq', 'zool.':'zoologiya',
}
SCRIPT = re.compile(r"^[a-zçğəıöşü]+(?:[- ][a-zçğəıöşü]+)*$")
INFINITIVE = re.compile(r'(?:maq|mək)$')
VERB_LABEL = re.compile(r'^(?:(?:bax|b a x)\s+|[^.]{0,32}\s+)?(?:f|icb|məch|qayıd|qarş)\.(?!\s*is\.)', re.I)
EXPLICIT_FROM = re.compile(r'^"([^"]+)"\s*-?\s*(?:dan|dən|ın|in|un|ün)?\s*(?:sözündən\s+)?(f\s*\.\s*(?:is|sif)\s*\.|icb\s*\.|məch\s*\.|qayıd\s*\.|qarş\s*\.|kiç\s*\.|oxş\s*\.)', re.I)
PRINT_LABELS = r'(?:is|sif|z|zərf|f|məh|dan|köhn|klas|vulq|şair|nida|zool|bot|tib|tex|dilç|riy|fiz|kim|coğ|iqt|hərb|hüq|zar|məc|tar|bayt|anat)'
SEE = re.compile(
    rf'^(?:(?:\[[^\]]{{1,100}}\]|{PRINT_LABELS}\s*\.|\d{{1,2}}\.)\s*)*'
    r'b\s*a\s*x\s+([a-zçğəıöşü]+(?:-?\d{1,2})?(?:[- ][a-zçğəıöşü]+(?:-?\d{1,2})?)*)\b',
    re.I,
)
SENSE_NUMBER = re.compile(r'\s+\d{1,2}(?:\s+və\s+\d{1,2})?(?:-c[ıiuü])?\s+m[əe]na(?:da|sında|larda)$', re.I)
HOMONYM_NUMBER = re.compile(r'[- ]?(\d{1,2})$')
ALIAS_ONLY = re.compile(r'b\s*a\s*x\s+([a-zçğəıöşü]+(?:[- ][a-zçğəıöşü]+)*)\.', re.I)
VOWELS = 'aıouəeiöü'
DERIVATIONAL_SUFFIXES = (
    ('laşdır', 'ləşdir'), ('laş', 'ləş'), ('lan', 'lən'), ('la', 'lə'),
)
NOMINAL_SUFFIXES = (
    ('lıq', 'lik', 'luq', 'lük'), ('lı', 'li', 'lu', 'lü'),
    ('sız', 'siz', 'suz', 'süz'), ('çı', 'çi', 'çu', 'çü'),
)

def key(word):
    return unicodedata.normalize('NFC', word).translate(str.maketrans('İI', 'iı')).lower()

def print_headword(text):
    return key(HOMONYM_NUMBER.sub('', SENSE_NUMBER.sub('', text)))

def wiki_source(word):
    return 'https://en.wiktionary.org/wiki/' + quote(word.replace(' ', '_')) + '#Azerbaijani'

def print_source(volume, page):
    return f'https://www.urmu.eu/Azerbaycan_dilinin_izahli_lugeti_{volume}.pdf#page={page}'

def harmony(stem):
    last = next((letter for letter in reversed(stem) if letter in VOWELS), '')
    if not last:
        return None
    return ('mək', 'i' if last in 'əei' else 'ü') if last in 'əeiöü' else ('maq', 'u' if last in 'ou' else 'ı')

def infinitive(stem):
    h = harmony(stem)
    return stem + h[0] if h else ''

def strip_tags(term):
    return term.split('<', 1)[0].removeprefix('az:').strip()

def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()

def write_orthography_assets(result, output=ORTHOGRAPHY_OUTPUT):
    assignment = 'window.WORD_WEB_ORTHOGRAPHY_LEXICAL'
    if output.resolve() == ORTHOGRAPHY_OUTPUT:
        # Keep the citation data in a separate static asset as coverage grows.
        evidence = json.dumps(result['evidence'], ensure_ascii=False, separators=(',', ':'))
        EVIDENCE_OUTPUT.write_text(f'{assignment}.evidence={evidence};\n')
        result = {key: value for key, value in result.items() if key != 'evidence'}
    data = json.dumps(result, ensure_ascii=False, separators=(',', ':'))
    output.write_text(f'{assignment}={data};\n')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model', type=Path, help='Current model JSON containing nodes or entries and edges')
    parser.add_argument('wiktionary', type=Path, help='Azerbaijani Kaikki JSONL')
    parser.add_argument('explanatory', type=Path, help='Azerbaijani explanatory dictionary SQLite')
    parser.add_argument('--spelling-pdf', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ORTHOGRAPHY_OUTPUT, help='Use an alternate path for a single combined file')
    parser.add_argument('--unclassified', type=Path)
    args = parser.parse_args()
    model = json.loads(args.model.read_text())
    orthography = json.loads((ROOT/'dist/orthography.js').read_text().split('=', 1)[1].strip().removesuffix(';'))
    spellings = dict(orthography['entries'])
    by_word = {key(row['w']): row for row in sorted(model.get('entries') or model['nodes'], key=lambda row: row['w'] != key(row['w']), reverse=True)}
    letter_labels = (('ç', 'Ç'), ('abc', 'A–C'), ('d', 'D'), ('e', 'E'), ('ə', 'Ə'), ('f', 'F'), ('g', 'G'), ('ğ', 'Ğ'), ('h', 'H'), ('x', 'X'), ('ı', 'I'), ('i', 'İ'), ('j', 'J'), ('k', 'K'), ('q', 'Q'), ('l', 'L'), ('m', 'M'), ('n', 'N'), ('o', 'O'), ('ö', 'Ö'), ('p', 'P'), ('r', 'R'), ('s', 'S'), ('ş', 'Ş'), ('t', 'T'), ('u', 'U'), ('ü', 'Ü'), ('v', 'V'), ('y', 'Y'), ('z', 'Z'))
    reviewed_letters = tuple(letter for letters, _ in letter_labels for letter in letters)
    scope = {key(w) for w in spellings if key(w).startswith(reviewed_letters)}
    letter_scope = {w for w in by_word if w.startswith(reviewed_letters)}
    review = json.loads((ROOT/'scripts/content/orthography-link-review.json').read_text())
    nonverbs = set(review['nonverb_exceptions'])
    original = {tuple(sorted((key(a), key(b)))) + (kind,) for a, b, kind, *_ in model['edges']}
    blocked = {tuple(sorted((key(a), key(b)))) + (kind,) for a, b, kind, *_ in model.get('blocked_edges', [])}
    entries = {}
    refs = {}
    verbs = {}
    known_verbs = {w for w, row in by_word.items() if row['pos'] == 'verb' and INFINITIVE.search(w)}
    used = collections.Counter()
    relations = {}
    claims = []
    homonyms=collections.Counter()

    def add(a, b, kind, az, en, url, title, extra=None, formation=None, priority=20):
        a,b = key(a),key(b)
        if a == b or a not in by_word or b not in by_word or not ({a,b} & letter_scope):
            return
        pair = tuple(sorted((a,b)))
        edge_key = pair + (kind,)
        if formation and edge_key not in blocked:
            claim_refs=[{'title':title,'url':url}]
            if extra:
                claim_refs.append(extra)
            claims.append((a,b,formation,priority,claim_refs))
        opposite = 'ant' if kind == 'syn' else 'syn'
        if edge_key in blocked or kind in ('syn','ant') and (pair+(opposite,) in original or pair+(opposite,) in relations):
            return
        if kind == 'topic' and any(pair+(t,) in original or pair+(t,) in relations for t in ('syn','ant','root')):
            return
        item = {'from':by_word[a]['w'],'senseAz':az,'senseEn':en,'refs':[{'title':title,'url':url}]}
        if extra:
            item['refs'].append(extra)
        facts = relations.setdefault(edge_key,[])
        if item not in facts and len(facts) < 3:
            facts.append(item)

    def mark_verb(word, url, citation, method, vowel_stem=None):
        if word not in by_word or word in nonverbs or not INFINITIVE.search(word):
            return
        known_verbs.add(word)
        if word in scope or method in ('print','wiktionary') or by_word[word]['pos'] == 'verb':
            target = by_word[word]['w']
            if target not in verbs:
                verbs[target] = {'source':url,'citation':citation,'method':method}
            if vowel_stem:
                verbs[target]['vowelStem'] = vowel_stem

    db = sqlite3.connect(f'file:{args.explanatory.resolve()}?mode=ro', uri=True)
    for raw,text,volume,page in db.execute('select headword,entry_text,volume,start_page from entries'):
        w = key(raw)
        if w in by_word:
            homonyms[w]+=1
        if w not in by_word or (w not in letter_scope and not INFINITIVE.search(w)):
            continue
        text = re.sub(r'-\s*\n\s*', '', text)
        text = ' '.join(text.split()).strip()
        url = print_source(volume,page)
        entries.setdefault(w,[]).append((text,url))
        match = EXPLICIT_FROM.match(text)
        if match:
            base = print_headword(match[1])
            homonym = HOMONYM_NUMBER.search(match[1])
            label=match[2].replace(' ','').lower()
            formation = {
                'f.is.':'action', 'f.sif.':'participle', 'icb.':'causative',
                'məch.':'passive', 'kiç.':'diminutive', 'oxş.':'diminutive',
            }.get(label, 'derivation')
            if formation == 'participle' and INFINITIVE.search(base) and w == base[:-1]:
                formation = 'action'
            az = f'«{base}» sözündən yaranıb.'
            en = f'Derived from {base}.'
            if homonym:
                number = homonym[1]
                az = f'İzahlı lüğətdə «{base}» sözünün {number}-ci omonimindən törəmə kimi göstərilir.'
                en = f'Derived from the {base} entry numbered {number} in the explanatory dictionary.'
            add(w,base,'root',az,en,url,'İzahlı lüğət (2006)',formation=formation if not homonym else None,priority=80)
            if INFINITIVE.search(w) and label in ('icb.', 'məch.', 'qayıd.', 'qarş.'):
                mark_verb(w,url,'İzahlı lüğət (2006)','print')
        if INFINITIVE.search(w) and VERB_LABEL.match(text):
            mark_verb(w,url,'İzahlı lüğət (2006)','print')
        match = SEE.match(text)
        if match and print_headword(match[1]) in by_word:
            target = print_headword(match[1])
            refs.setdefault(w,[]).append((target,url))
            add(w,target,'topic','İzahlı lüğətdə birbaşa söz istinadı.','Direct dictionary cross-reference.',url,'İzahlı lüğət (2006)')
        match = re.match(r'^(?:.*?\s)?(?:əksi|antonimi)\s*(?::|–|—)\s*([a-zçğəıöşü]+(?:-[a-zçğəıöşü]+)*)\b',text[:170],re.I)
        if match:
            add(w,match[1],'ant','İzahlı lüğətdə göstərilən qarşı məna.','An opposite sense identified in the explanatory dictionary.',url,'İzahlı lüğət (2006)')

    for line in args.wiktionary.open():
        record = json.loads(line)
        w = key(record['word'])
        senses = [sense for sense in record.get('senses',[]) if not (set(sense.get('tags',[])) & {'form-of','alt-of','nonstandard','misspelling','South-Azerbaijani','obsolete','Cyrillic'}) and not (sense.get('form_of') or sense.get('alt_of'))]
        if w not in by_word or record.get('lang_code') != 'az' or not senses:
            continue
        url = wiki_source(record['word'])
        if record.get('pos') == 'verb' and INFINITIVE.search(w):
            stem = w[:-3]
            variants = set()
            for f in record.get('forms',[]):
                word = f.get('form','')
                if set(f.get('tags',[])) == {'indicative','present','singular','third-person'} and word.endswith(('ır','ir','ur','ür')):
                    variant = word[:-2]
                    if variant == stem+'y' and stem[-1:] in VOWELS:
                        variant = stem
                    if variant in (stem,stem[:-1]+'d'):
                        variants.add(variant)
            mark_verb(w,url,'Wiktionary • Kaikki','wiktionary',next(iter(variants)) if len(variants)==1 else None)
        for sense in senses:
            gloss = next((g for g in sense.get('glosses',[]) if g), '')
            for field,kind,az_label,en_label in (('synonyms','syn','Göstərilən mənada sinonim.','Synonym in this sense.'),('antonyms','ant','Göstərilən mənada antonim.','Antonym in this sense.')):
                facts = sense.get(field,[]) + (record.get(field,[]) if len(senses)==1 else [])
                for fact in facts:
                    target = fact.get('word','')
                    if set(fact.get('tags',[])) & {'obsolete','misspelling','nonstandard','South-Azerbaijani','Cyrillic'}:
                        continue
                    sense_text = (fact.get('sense') or gloss).strip()
                    if sense_text:
                        add(w,target,kind,az_label,f'{en_label} {sense_text[:190]}',url,'Wiktionary • Kaikki (CC BY-SA 4.0)')
            for field, az_label, en_label in (
                ('derived', 'Lüğətdə bu mənaya bağlı törəmə və ya birləşmə kimi göstərilir.', 'A derivative or compound listed under this sense.'),
                ('related', 'Lüğətdə bu mənaya bağlı söz kimi göstərilir.', 'A related term listed under this sense.'),
                ('coordinate_terms', 'Lüğətdə eyni anlayış qrupuna aid söz kimi göstərilir.', 'A term in the same category listed under this sense.'),
            ):
                for fact in sense.get(field,[]):
                    if not (set(fact.get('tags',[])) & {'obsolete','misspelling','nonstandard','South-Azerbaijani','Cyrillic'}):
                        sense_text = (fact.get('sense') or gloss).strip()
                        english_note = f'{en_label} {sense_text[:190]}' if sense_text else en_label
                        add(w,fact.get('word',''),'topic',az_label,english_note,url,'Wiktionary • Kaikki (CC BY-SA 4.0)')
        for fact in record.get('derived',[]):
            target = fact.get('word','')
            add(target,w,'root',f'«{record["word"]}» sözündən törəmə.',f'Derived from {record["word"]}.',url,'Wiktionary • Kaikki (CC BY-SA 4.0)')
        for template in record.get('etymology_templates',[]):
            if template.get('name') not in {'affix','af','suffix','suf','prefix','pre','compound','com','surf','surface analysis'}:
                continue
            targs = template.get('args',{})
            if targs.get('1') != 'az':
                continue
            parts=[strip_tags(val) for arg,val in targs.items() if arg.isdecimal() and int(arg)>=2]
            roots=[part for part in parts if SCRIPT.fullmatch(key(part))]
            simple_affix=template.get('name') in {'affix','af','suffix','suf'} and len(roots)==1 and any(part.startswith('-') for part in parts)
            for root in roots:
                add(w,root,'root',f'«{root}» bu sözün quruluşunda göstərilir.',f'{root} is documented as a component of this word.',url,'Wiktionary • Kaikki (CC BY-SA 4.0)',formation='derivation' if simple_affix else None,priority=50)

    for w,b in review['synonyms']:
        matching = [url for base,url in refs.get(w,[]) if base==b]
        if matching:
            add(w,b,'syn','İzahlı lüğətdə bu mənada sinonim kimi göstərilir.','Shared sense cross-referenced in the explanatory dictionary.',matching[0],'İzahlı lüğət (2006)')
    for w,b,page in review['verified_synonym_dictionary_pairs']:
        add(w,b,'syn','Sinonimlər lüğətində göstərilən ortaq məna.','Shared sense documented by the synonym dictionary.',f'{SYNONYMS}#page={page}','Sinonimlər lüğəti (2007)')
    for w,b,page in review['printed_antonyms']:
        add(w,b,'ant','Antonimlər lüğətində göstərilən qarşı məna.','Opposed in the sense documented by the antonym dictionary.',f'{ANTONYMS}#page={page}','Antonimlər lüğəti (2007)')

    for w,targets in refs.items():
        if INFINITIVE.search(w) and w not in known_verbs and len({b for b,_ in targets}) == 1:
            base,url = targets[0]
            if base in known_verbs:
                mark_verb(w,url,'İzahlı lüğət (2006)','cross-reference')

    def cite_rule(w, b, url, relation, az, en, formation=None):
        raw = by_word[w]['w']
        source = orthography['url'] + '#page=' + str(spellings[raw])
        extra = {'title':'Orfoqrafiya lüğəti (2021)','url':source}
        add(w,b,relation,az,en,url,'Azərbaycan dilinin qrammatikası' if url==GRAMMAR else 'Azərbaycan dilinin orfoqrafiya normaları' if url==SPELLING else 'Azərbaycan dilinin orfoepiya normaları',extra,formation)
        return source

    # Both spellings must be actual headwords and the affix must agree with vowel harmony.
    # Only transparent productive derivations qualify; no similarity-based semantic inference.
    for w in sorted(scope):
        if not INFINITIVE.search(w) or ' ' in w or '-' in w:
            continue
        stem, suffix = w[:-3],w[-3:]
        if infinitive(stem) != w:
            continue
        for back,front in DERIVATIONAL_SUFFIXES:
            affix = front if suffix=='mək' else back
            base = stem.removesuffix(affix)
            if len(base)<3 or base==stem or base not in by_word or (harmony(base) or ('', ''))[0]!=suffix:
                continue
            # Avoid attributing an optional l to the same-family base when the
            # dictionary already documents a different derivational analysis.
            url = cite_rule(w,base,SPELLING_RULES,'root',f'«{base}» + -{affix} ilə düzələn fel.',f'Verb formed from {base} with -{affix}.',{'laş':'change','ləş':'change','laşdır':'change-cause','ləşdir':'change-cause'}.get(affix,'derivation'))
            mark_verb(w,url,'Orfoqrafiya lüğəti (2021)','productive derivative')
            break

    # Productive voice markers require a known/attested base infinitive.
    # Resolve from shorter to longer so chained voices use a confirmed base.
    for w in sorted(scope, key=lambda word:(len(word),word)):
        if not INFINITIVE.search(w):
            continue
        last = re.split(r'[- ]',w)[-1]
        if last != w and last in known_verbs:
            exact = w[-len(last)-1:-len(last)]
            point = by_word[w]['w']
            source = orthography['url']+'#page='+str(spellings[point])
            mark_verb(w,source,'Orfoqrafiya lüğəti (2021)','compound infinitive')
            if exact==' ' and len(last)>4:
                cite_rule(w,last,GRAMMAR,'root',f'«{last}» bu birləşmənin fel hissəsidir.',f'{last} is the verbal component of this expression.')
            continue
        if last!=w:
            continue
        stem = w[:-3]
        candidates = []
        for size in range(1,min(5,len(stem)-2)):
            base_stem, affix = stem[:-size],stem[-size:]
            base = infinitive(base_stem)
            if base not in known_verbs or not 0 < len(base_stem):
                continue
            end = base_stem[-1]
            ending,i = harmony(base_stem)
            if ending!=w[-3:]:
                continue
            passive = ('n' if end in VOWELS else i+('n' if end=='l' else 'l'))
            causative = ('t' if end in VOWELS or end=='r' else 'd'+i+'r')
            if affix in (passive,causative) and (len(base_stem)>=4 or w in entries):
                candidates.append((base,affix))
        if len(candidates)==1:
            base,affix=candidates[0]
            url=cite_rule(w,base,GRAMMAR,'root',f'«{base}» felinin -{affix} şəkilçili forması.',f'Verb related to {base} through the voice suffix -{affix}.','causative' if affix=='t' or affix.startswith('d') else 'passive' if any(t.startswith('məch.') for t,_ in entries.get(w,[])) or re.search(r'(?:dır|dir|dur|dür|t)[ıiuü]l$',stem) else 'derivation')
            if affix=='t' and not verbs.get(by_word[w]['w'],{}).get('vowelStem'):
                mark_verb(w,url,'Orfoqrafiya lüğəti (2021)','productive verb voice',stem[:-1]+'d')
                verbs[by_word[w]['w']]['stemSource']=STEM_RULE
            else:
                mark_verb(w,url,'Orfoqrafiya lüğəti (2021)','productive verb voice')

    for w in review['confirmed_infinitives']:
        if w not in scope:
            continue
        word=by_word[w]['w']
        url=orthography['url']+'#page='+str(spellings[word])
        mark_verb(w,url,'Orfoqrafiya lüğəti (2021)','reviewed infinitive')

    # Link attested deverbal nouns only where an explicit productive verb
    # marker identifies the base. Bare -ma/-mə often yields lexical homonyms.
    action_stem = re.compile(r'(?:laşdır|ləşdir|laş|ləş|landır|ləndir|lan|lən|dırıl|diril|durul|dürül|dır|dir|dur|dür|lat|lət|lama|ləmə)$')
    for w in sorted(scope):
        if w.endswith(('ma','mə')) and ' ' not in w and '-' not in w:
            stem=w[:-2]
            verb=infinitive(stem)
            if len(stem)>=5 and action_stem.search(stem) and verb in known_verbs and verb in by_word:
                cite_rule(w,verb,GRAMMAR,'root',f'«{verb}» felinin hərəkət adı.',f'Action noun corresponding to {verb}.','action')
        parts=w.split('-')
        if len(parts)==2 and parts[0]==parts[1] and len(parts[0])>=3 and parts[0] in by_word:
            base=parts[0]
            cite_rule(w,base,SPELLING,'root',f'«{base}» sözünün təkrarı ilə yaranıb.',f'Formed by repeating {base}.')

    # Transparent nominal derivatives. Avoid short stems, compounds and
    # deverbal -ma/-mə, where accidental matches are especially frequent.
    for w in sorted(scope):
        if ' ' in w or '-' in w or INFINITIVE.search(w):
            continue
        for forms in NOMINAL_SUFFIXES:
            matched = False
            for suffix in forms:
                if not w.endswith(suffix):
                    continue
                base = w[:-len(suffix)]
                h = harmony(base)
                if len(base)<4 or base not in by_word or not h:
                    continue
                if suffix[1:2] != h[1]:
                    continue
                cite_rule(w,base,SPELLING_RULES,'root',f'«{base}» + -{suffix} quruluşu.',f'Productive formation from {base} with -{suffix}.','derivation')
                matched = True
                break
            if matched:
                break

    # Domain abbreviations are explicit in the spelling dictionary. These
    # allow topical navigation for terms that have no verified lexical peer.
    import fitz
    if digest(args.spelling_pdf)!=orthography['source_sha256']:
        raise ValueError('Spelling PDF does not match the published headword source')
    spelling_pages = {p for w,p in orthography['entries'] if key(w) in scope}
    with fitz.open(args.spelling_pdf) as pdf:
        for page in sorted(spelling_pages):
            for line in pdf[page-1].get_text().splitlines():
                annotated = line.strip().replace('х','x')
                w = key(re.sub(r'\s*\([^)]*\)', '', annotated.split(',',1)[0]).strip())
                if w not in letter_scope:
                    continue
                url=orthography['url']+'#page='+str(page)
                for label in re.findall(r'\(([^)]*)\)',annotated):
                    topic=TOPIC_HEADS.get(label.strip())
                    if topic:
                        add(w,topic,'topic',f'Orfoqrafiya lüğətində «{topic}» sahəsinə aid edilir.',f'The spelling dictionary lists this under {topic}.',url,'Orfoqrafiya lüğəti (2021)')
                if ',' in annotated:
                    gloss=key(re.sub(r'\s*\([^)]*\)', '', annotated.split(',',1)[1]).strip())
                    if gloss in by_word:
                        add(w,gloss,'topic','Orfoqrafiya lüğətində bu sözlə izah edilir.','This spelling is glossed with this word in the spelling dictionary.',url,'Orfoqrafiya lüğəti (2021)')

    growth=json.loads((ROOT/'scripts/content/growth/families.json').read_text())
    for family in growth['families']:
        for fact in family.get('evidence',[]):
            refs=[{'title':'Wiktionary · törəmə','url':e['url']} for e in fact.get('evidence',[]) if e.get('url')]
            if refs:
                claims.append((key(fact['derived']),key(fact['base']),'derivation',60,refs))
    aliases = {}
    for word, records in entries.items():
        if word not in scope or len(records) != 1:
            continue
        text, url = records[0]
        match = ALIAS_ONLY.fullmatch(text)
        if match:
            base = key(match[1])
            if base in by_word and homonyms[base] <= 1 and base != word:
                aliases[word] = (base, {'title':'İzahlı lüğət (2006)', 'url':url})
    families,definitions=build_families(by_word,letter_scope,claims,{w for w,n in homonyms.items() if n>1},blocked,review.get('family_review',{}),aliases)

    # These links expose documented compound components without treating
    # the component words as synonyms or as a single derivational family.
    function_parts={'bir','hər','kimi','ilə','üçün','üzrə','ancaq','yəni','yaxud','yoxsa','qarşı'}
    for word in sorted(scope):
        pieces=re.split(r'[- ]',word)
        if len(pieces)<2 or any(piece not in by_word for piece in pieces):
            continue
        page=spellings[by_word[word]['w']]
        source={'title':'Orfoqrafiya lüğəti (2021)','url':orthography['url']+'#page='+str(page)}
        for part in sorted(set(pieces)):
            if len(part)>=3 and part not in function_parts and by_word[part].get('en'):
                add(word,part,'topic',f'«{part}» bu ifadənin tərkib hissəsidir.',f'{part} is a component of this expression.',SPELLING,'Azərbaycan dilinin orfoqrafiya normaları',source)

    for word,other,kind in review.get('family_review',{}).get('reviewed_links',[]):
        refs=review['family_review']['definitions'][word]['refs']
        if kind=='root':
            az,en='Törəmə və ya eyni söz kökü.','A documented derivational relationship.'
        elif kind=='syn':
            az,en='Lüğətdə göstərilən ortaq məna.','A shared dictionary sense.'
        else:
            az,en='İzahda göstərilən anlayış və ya tərkib hissəsi.','A concept or component identified in the definition.'
        add(word,other,kind,az,en,refs[0]['url'],refs[0]['title'],refs[1] if len(refs)>1 else None)

    for fact in review.get('family_review',{}).get('reference_links',[]):
        primary, *support = fact['refs']
        add(fact['from'], fact['to'], fact['kind'], fact['az'], fact['en'],
            primary['url'], primary['title'], support[0] if support else None)

    # Make output deterministic and use the site's existing bilingual evidence format.
    special = {}
    for word in sorted(letter_scope):
        node = by_word[word]
        meaning = definitions.get(node['w'], node)
        if not meaning.get('az', '').strip() or not meaning.get('en', '').strip():
            special[node['w']] = list(dict.fromkeys(url for _, url in entries.get(word, [])))[:2]

    result = {'verbs': verbs, 'edges': [], 'evidence': {},'families':families,'definitions':definitions,'special':special,'meta':{
        'explanatory_database_sha256':digest(args.explanatory),
        'wiktionary_sha256':digest(args.wiktionary),
        'wiktionary_license':'CC BY-SA 4.0',
        'grammar_source':GRAMMAR,
        'stem_alternation_source':STEM_RULE,
        'review_scope':'Map entries from A through Z checked for explicit dictionary evidence. Spelling additions also checked for documented productive derivation and domain labels.',
    }}
    for (a,b,kind),proof in sorted(relations.items()):
        edge_key = (a,b,kind)
        if kind=='topic' and any((a,b,t) in relations for t in ('syn','ant','root')):
            continue
        a,b = by_word[a]['w'],by_word[b]['w']
        result['evidence']['|'.join(sorted((a,b)))+'|'+kind]=proof
        if edge_key not in original:
            initials = {key(word)[0] for word in (a, b)}
            letters = next(label for group, label in letter_labels if initials.intersection(group))
            result['edges'].append([a,b,kind,f'{letters} · lüğət və qrammatika mənbələri'])
            used[kind]+=1
    write_orthography_assets(result, args.output)
    missing = sorted(w for w in scope if INFINITIVE.search(w) and w not in known_verbs and w not in nonverbs)
    if args.unclassified:
        args.unclassified.write_text('\n'.join(missing)+'\n')
    print('Lexical links:',dict(used),'families:',len(families),'bilingual additions:',len(definitions),'special:',len(special),'verb evidence:',len(verbs),'unclassified endings:',len(missing))

if __name__=='__main__':
    main()
