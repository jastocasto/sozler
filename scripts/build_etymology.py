#!/usr/bin/env python3
"""Word origins and homonyms from English Wiktionary (Kaikki extract).

    python3 -I scripts/build_etymology.py kaikki.org-dictionary-Azerbaijani.jsonl

Input: https://kaikki.org/dictionary/Azerbaijani/kaikki.org-dictionary-Azerbaijani.jsonl
(English Wiktionary, CC BY-SA 4.0). Writes scripts/content/etymology/etymology.json:

  { headword: { "o": [origin, ...], "h": [homonym, ...] } }

origin  {"text": English etymology sentence, "chain": [language, ...], "kind": "borrowed" |
        "inherited" | "derived" | "formed", "pos": part of speech}
        chain lists the source languages in the order the sentence names them
        (immediate source first). kind "formed" means a word built inside
        Azerbaijani (gəl- + -ir) with no source language named.
homonym {"pos", "glosses": [English], "origin": index into "o" or null}
        listed only when the headword has two or more Wiktionary etymology
        sections with meanings of their own (çay: tea / river); sections that
        only hold inflected forms (at "throw!") do not count.

Only words whose sentence names a known language or a formation are kept.
"""
import json, re, sys
from collections import defaultdict
from pathlib import Path

# English Wiktionary language names -> (Azerbaijani name, family). Longest names first when matching.
LANGUAGES = {
    'Proto-Turkic': ('Ulu Türk dili', 'turkic'), 'Proto-Common Turkic': ('Ulu Ümumtürk dili', 'turkic'),
    'Proto-Oghuz': ('Ulu Oğuz dili', 'turkic'), 'Old Turkic': ('Qədim türk dili', 'turkic'),
    'Old Anatolian Turkish': ('Qədim Anadolu türkcəsi', 'turkic'), 'Ottoman Turkish': ('Osmanlı türkcəsi', 'turkic'),
    'Turkish': ('türk dili', 'turkic'), 'Chagatai': ('Çağatay dili', 'turkic'), 'Karakhanid': ('Qaraxanlı türkcəsi', 'turkic'),
    'Tatar': ('tatar dili', 'turkic'), 'Kazakh': ('qazax dili', 'turkic'), 'Uzbek': ('özbək dili', 'turkic'),
    'Turkmen': ('türkmən dili', 'turkic'), 'Kipchak': ('qıpçaq dili', 'turkic'), 'Middle Kipchak': ('orta qıpçaq dili', 'turkic'),
    'Arabic': ('ərəb dili', 'arabic'), 'Classical Arabic': ('klassik ərəb dili', 'arabic'),
    'Persian': ('fars dili', 'persian'), 'Classical Persian': ('klassik fars dili', 'persian'),
    'Middle Persian': ('orta fars (pəhləvi) dili', 'persian'), 'Old Persian': ('qədim fars dili', 'persian'),
    'Parthian': ('parfiya dili', 'iranian'), 'Sogdian': ('soğd dili', 'iranian'), 'Avestan': ('avesta dili', 'iranian'),
    'Proto-Iranian': ('Ulu İran dili', 'iranian'), 'Kurdish': ('kürd dili', 'iranian'), 'Talysh': ('talış dili', 'iranian'),
    'Russian': ('rus dili', 'russian'), 'Ukrainian': ('ukrayna dili', 'slavic'), 'Polish': ('polyak dili', 'slavic'),
    'Czech': ('çex dili', 'slavic'), 'Bulgarian': ('bolqar dili', 'slavic'),
    'French': ('fransız dili', 'european'), 'Middle French': ('orta fransız dili', 'european'), 'Old French': ('qədim fransız dili', 'european'),
    'Latin': ('latın dili', 'european'), 'Late Latin': ('son latın dili', 'european'), 'Medieval Latin': ('orta əsr latın dili', 'european'),
    'New Latin': ('yeni latın dili', 'european'), 'Ancient Greek': ('qədim yunan dili', 'european'), 'Byzantine Greek': ('Bizans yunancası', 'european'),
    'Greek': ('yunan dili', 'european'), 'English': ('ingilis dili', 'european'), 'German': ('alman dili', 'european'),
    'Italian': ('italyan dili', 'european'), 'Venetian': ('venesiya dili', 'european'), 'Spanish': ('ispan dili', 'european'),
    'Portuguese': ('portuqal dili', 'european'), 'Dutch': ('niderland dili', 'european'), 'Swedish': ('isveç dili', 'european'),
    'Hungarian': ('macar dili', 'european'), 'Romanian': ('rumın dili', 'european'),
    'Armenian': ('erməni dili', 'caucasian'), 'Old Armenian': ('qədim erməni dili', 'caucasian'), 'Georgian': ('gürcü dili', 'caucasian'),
    'Lezgi': ('ləzgi dili', 'caucasian'), 'Lezgian': ('ləzgi dili', 'caucasian'),
    'Mongolian': ('monqol dili', 'mongolic'), 'Middle Mongol': ('orta monqol dili', 'mongolic'), 'Middle Mongolian': ('orta monqol dili', 'mongolic'),
    'Proto-Mongolic': ('Ulu Monqol dili', 'mongolic'),
    'Sinitic': ('Çin dilləri', 'asian'), 'Chinese': ('Çin dili', 'asian'), 'Middle Chinese': ('orta Çin dili', 'asian'),
    'Japanese': ('yapon dili', 'asian'), 'Hindi': ('hind dili', 'asian'), 'Sanskrit': ('sanskrit', 'asian'),
    'Hebrew': ('ivrit', 'semitic'), 'Aramaic': ('arami dili', 'semitic'), 'Syriac': ('süryani dili', 'semitic'), 'Akkadian': ('akkad dili', 'semitic'),
}
NAMES = sorted(LANGUAGES, key=len, reverse=True)
LANG_RE = '|'.join(re.escape(n) for n in NAMES)
SOURCE = re.compile(r'(?:\b(?:[Ff]rom|[Bb]orrowed from|[Ii]nherited from|[Ll]earned borrowing from|[Ss]emi-learned borrowing from|[Uu]ltimately from|[Cc]alque of|via)\s+(?:the\s+)?)(' + LANG_RE + r')\b')
STOP = re.compile(r'\b(?:Cognate with|Cognates? include|Compare|Doublet of|See also|Related to)\b')
FORMED = re.compile(r'\+\s*-|\bBy surface analysis\b|-\s*\(“')
FORM_GLOSS = re.compile(r'\b(?:singular|plural|imperative|present|past|future|participle|converb|possessive|genitive|dative|accusative|locative|ablative|person) .*\bof\b', re.I)


def is_form(sense):
    tags = set(sense.get('tags') or [])
    return 'form_of' in sense or 'alt_of' in sense or 'form-of' in tags or 'alt-of' in tags or bool(FORM_GLOSS.search((sense.get('glosses') or [''])[0]))


def origin_of(text):
    head = STOP.split(text or '')[0]
    chain = []
    for m in SOURCE.finditer(head):
        if m.group(1) not in chain:
            chain.append(m.group(1))
    lower = head.lower()
    if chain:
        kind = 'borrowed' if 'borrow' in lower or 'calque' in lower else 'inherited' if 'inherited' in lower else 'derived'
        if kind == 'derived' and LANGUAGES[chain[0]][1] == 'turkic':
            kind = 'inherited'  # "From Proto-Turkic *at" describes the native line of descent
        return chain, kind
    if FORMED.search(head):
        return [], 'formed'
    return None, None


def main(path):
    sections = defaultdict(dict)  # word -> etymology number -> {text, pos, glosses}
    with open(path, encoding='utf-8') as stream:
        for line in stream:
            entry = json.loads(line)
            if entry.get('lang_code') != 'az':
                continue
            word, number = entry['word'], entry.get('etymology_number') or 0
            section = sections[word].setdefault(number, {'text': '', 'pos': [], 'glosses': []})
            section['text'] = section['text'] or (entry.get('etymology_text') or '').strip()
            lexical = [s for s in entry.get('senses') or [] if not is_form(s) and s.get('glosses')]
            if lexical:
                if entry.get('pos') not in section['pos']:
                    section['pos'].append(entry.get('pos'))
                for sense in lexical:
                    gloss = sense['glosses'][-1].strip()
                    if gloss and gloss not in section['glosses']:
                        section['glosses'].append(gloss)
    out, homonym_count = {}, 0
    for word, by_number in sections.items():
        origins, homonyms = [], []
        for number in sorted(by_number):
            s = by_number[number]
            chain, kind = origin_of(s['text'])
            index = None
            if kind:
                origins.append({'text': s['text'], 'chain': chain, 'kind': kind, 'pos': s['pos'][0] if s['pos'] else ''})
                index = len(origins) - 1
            if s['glosses']:
                homonyms.append({'pos': s['pos'][0] if s['pos'] else '', 'glosses': s['glosses'][:4], 'origin': index})
        record = {}
        if origins:
            record['o'] = origins
        if len(homonyms) >= 2 and len([n for n in by_number if n]) >= 2:
            record['h'] = homonyms
            homonym_count += 1
        if record:
            out[word] = record
    target = Path(__file__).resolve().parent / 'content' / 'etymology' / 'etymology.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(out, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n', encoding='utf-8')
    used = sorted({l for r in out.values() for o in r.get('o', []) for l in o['chain']})
    (target.parent / 'languages.json').write_text(json.dumps({l: list(LANGUAGES[l]) for l in used}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    languages = {}
    for record in out.values():
        for o in record.get('o', []):
            first = next((l for l in o['chain'] if LANGUAGES[l][1] != 'turkic'), o['chain'][0] if o['chain'] else 'formed')
            languages[first] = languages.get(first, 0) + 1
    summary = {'words': len(out), 'with_origin': sum('o' in r for r in out.values()), 'homonyms': homonym_count,
               'origin_by_first_non_turkic_source': dict(sorted(languages.items(), key=lambda x: -x[1]))}
    import hashlib
    attribution = {
        'source': 'English Wiktionary, Azerbaijani entries, via the Kaikki.org machine-readable extract',
        'source_url': 'https://kaikki.org/dictionary/Azerbaijani/index.html',
        'license': 'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)',
        'input_sha256': hashlib.sha256(Path(path).read_bytes()).hexdigest(),
        'method': 'The English etymology sentence of each Wiktionary etymology section is shown as written. The chain of source '
                  'languages is read from that sentence (Borrowed from / Inherited from / From …); the origin label names the '
                  'first non-Turkic language in the chain, or "Turkic origin" when every language named is Turkic, or '
                  '"formed in Azerbaijani" for a word built from Azerbaijani parts. Homonyms are headwords with two or more '
                  'etymology sections that each have meanings of their own; sections holding only inflected forms are ignored.',
        'limitations': 'Wiktionary covers about 15,500 Azerbaijani entries; most headwords have no etymology here. Labels are '
                       'derived from the sentence and inherit its accuracy. Not reviewed by an etymologist.',
        'summary': summary,
    }
    (Path(__file__).resolve().parent.parent / 'dist' / 'etymology-attribution.json').write_text(json.dumps(attribution, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
