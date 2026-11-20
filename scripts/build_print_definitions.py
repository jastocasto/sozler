#!/usr/bin/env python3
"""Build dist/print-definitions.js: definitions and links for words that had none.

Inputs
  model      JSON from `node scripts/export_print_definition_model.cjs model.json --without-print`
  explanatory, bilingual
             SQLite caches from scripts/extract_print_dictionaries.py
  scripts/content/print-definitions/paraphrases/*.json
             AI-assisted bilingual paraphrases written from the cited print entries

Each new definition records its method:
  paraphrase       new wording of the explanatory and/or Musayev dictionary sense (AI-assisted)
  derivation       the explanatory dictionary states the word is formed from a base ("X"dan f.is.)
  cross-reference  the explanatory dictionary refers the word to another headword (bax X)
  rule             a transparent, productive suffix of a defined base word (qayda ilə qurulub)

Links (root for derivations, syn for cross-references) are added only between existing
headwords that are not already connected, each with its citation.  Print prose is used
as evidence only and is never copied into the output: a paraphrase that shares six or
more consecutive words with its print entry is rejected.
"""
import argparse
import collections
import hashlib
import json
import re
import sqlite3
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'scripts/content/print-definitions'
OUTPUT = ROOT / 'dist/print-definitions.js'
ATTRIBUTION = ROOT / 'dist/print-definitions-attribution.json'
ORTHOGRAPHY_URL = 'https://www.dilcilik.az/kitabxana/arasdirmalar/Orfoqrafiya_2021.pdf'
GRAMMAR = {'title': 'A Grammar of Contemporary Azerbaijani (Garibova, Aliyeva 2024)',
           'url': 'https://www.academia.edu/129901902/JALA_GARIBOVA_and_SABINA_ALIYEVA_2024_A_GRAMMAR_OF_CONTEMPORARY_AZERBAIJANI'}
POS = {'noun', 'verb', 'adjective', 'adverb', 'numeral', 'pronoun', 'interjection', 'postposition',
       'conjunction', 'particle', 'phrase'}
EXPLICIT_FROM = re.compile(r'^"([^"]+)"\s*-?\s*(?:dan|dən|ın|in|un|ün)?\s*(?:sözündən\s+)?'
                           r'(f\s*\.?\s*is\.|f\s*\.\s*sif\.|icb\.|məch\.|qayıd\.|qarş\.|kiç\.|oxş\.|mücər\.)', re.I)
SEE_ONLY = re.compile(r'^(?:(?:\[[^\]]{1,100}\]|[a-zçğıöşüə]{1,8}\.)\s*)*b\s*a\s*x\s+'
                      r'([a-zçğıöşüə]+(?:[- ][a-zçğıöşüə]+)*)(?:\s*\d{1,2})?\s*\.?$', re.I)
HOMONYM = re.compile(r'[- ]?\d{1,2}$')
BACK, FRONT = set('aıou'), set('əeiöü')
VOWELS = BACK | FRONT


def key(word):
    return unicodedata.normalize('NFC', word).translate(str.maketrans('İI', 'iı')).lower()


def print_source(volume, page):
    return {'title': f'Azərbaycan dilinin izahlı lüğəti (2006), cild {volume}, s. {page}',
            'url': f'https://www.urmu.eu/Azerbaycan_dilinin_izahli_lugeti_{volume}.pdf#page={page}'}


def bilingual_source(page):
    return {'title': f'Azərbaycanca–İngiliscə lüğət (Musayev), s. {page}',
            'url': f'https://urmu.eu/Azerbaycanca_Ingilisce_luget.pdf#page={page}'}


def spelling_source(page):
    return {'title': 'Orfoqrafiya lüğəti (2021)', 'url': f'{ORTHOGRAPHY_URL}#page={page}'}


def last_vowel(word):
    return next((ch for ch in reversed(word) if ch in VOWELS), '')


def h4(word):
    return {'a': 'ı', 'ı': 'ı', 'o': 'u', 'u': 'u', 'e': 'i', 'ə': 'i', 'i': 'i', 'ö': 'ü', 'ü': 'ü'}.get(last_vowel(word), '')


def h2(word):
    return 'a' if last_vowel(word) in BACK else 'ə'


def infinitive_ending(stem):
    return 'maq' if last_vowel(stem) in BACK else 'mək'


def gloss(node):
    text = re.sub(r'\([^)]*\)?', '', node['en'])
    parts = [part.strip() for part in re.split(r'[;,]', text) if part.strip()]
    if node.get('pos') == 'verb':
        parts = [part for part in parts if part.lower().startswith('to ')] or parts
    text = parts[0] if parts else node['en']
    text = re.sub(r'^(?:to|a|an|the)\s+', '', text, flags=re.I)
    return text.rstrip('.:').strip()


def clean_form(form):
    form = (form or '').strip()
    return '' if not form or re.search(r'\b(?:or|and|of|to|the|a|an)$|[,;:(]$', form) else form


def ngrams(text, size=6):
    words = re.findall(r'\w+', text.lower())
    return {tuple(words[i:i + size]) for i in range(len(words) - size + 1)}


class Builder:
    def __init__(self, model, explanatory, bilingual):
        self.nodes = {n['w']: n for n in model['nodes']}
        self.by_key = {}
        for node in model['nodes']:
            self.by_key.setdefault(key(node['w']), node['w'])
        self.connected = {tuple(sorted(e[:2])) for e in model['edges']}
        self.degree = collections.Counter({n['w']: n['degree'] for n in model['nodes']})
        self.print = collections.defaultdict(list)
        for k, text, volume, page in explanatory.execute('select key, entry_text, volume, start_page from entries'):
            self.print[k].append((text, volume, page))
        self.musayev = collections.defaultdict(list)
        for k, text, page in bilingual.execute('select key, entry_text, start_page from entries'):
            self.musayev[k].append((text, page))
        self.definitions = {}
        self.edges = []
        self.stats = collections.Counter()

    def defined(self, word):
        node = self.nodes.get(word)
        if node and node['az'].strip() and node['en'].strip():
            return node
        if word in self.definitions:
            d = self.definitions[word]
            return {'w': word, 'az': d['az'], 'en': d['en'], 'pos': d['pos'], 'verbForms': d.get('verbForms')}
        return None

    def undefined(self, word):
        return word in self.nodes and not self.defined(word)

    def link(self, a, b, kind, note, sense_az, sense_en, refs, source):
        pair = tuple(sorted((a, b)))
        if a == b or a not in self.nodes or b not in self.nodes or pair in self.connected:
            return
        self.connected.add(pair)
        self.degree[a] += 1
        self.degree[b] += 1
        self.edges.append([a, b, kind, note, None, [{'from': a, 'senseAz': sense_az, 'senseEn': sense_en, 'refs': refs}]])
        self.stats[f'links:{source}'] += 1

    def define(self, word, az, en, pos, refs, method, **extra):
        self.definitions[word] = {'az': az, 'en': en, 'pos': pos, 'refs': refs, 'method': method, **extra}
        self.stats[f'definitions:{method}'] += 1

    # Paraphrases ------------------------------------------------------------------
    def paraphrases(self):
        for path in sorted((CONTENT / 'paraphrases').glob('batch-[0-9][0-9].json')):
            for word, entry in json.loads(path.read_text()).items():
                if not self.undefined(word):
                    continue
                if 'skip' in entry:
                    self.stats['paraphrase:skipped'] += 1
                    continue
                az, en, pos = entry.get('az', '').strip(), entry.get('en', '').strip(), entry.get('pos')
                if not az.endswith('.') or not en or pos not in POS or len(az) > 260 or len(en) > 200:
                    self.stats['paraphrase:rejected-format'] += 1
                    continue
                k = key(word)
                printed = [row for row in self.print.get(k, []) if not EXPLICIT_FROM.match(row[0]) and not SEE_ONLY.match(row[0])]
                evidence = ngrams(' '.join(text for text, *_ in printed))
                if ngrams(az) & evidence:
                    self.stats['paraphrase:rejected-copy'] += 1
                    continue
                refs = []
                if entry.get('src') in ('izahli', 'both') and printed:
                    refs += [print_source(volume, page) for _, volume, page in printed[:2]]
                if entry.get('src') in ('musayev', 'both') and self.musayev.get(k):
                    refs += [bilingual_source(page) for _, page in self.musayev[k][:1]]
                if not refs:
                    refs = [print_source(v, p) for _, v, p in printed[:1]] + [bilingual_source(p) for _, p in self.musayev.get(k, [])[:1]]
                if not refs:
                    self.stats['paraphrase:rejected-unsourced'] += 1
                    continue
                extra = {'confidence': 'low'} if entry.get('conf') == 'low' else {}
                self.define(word, az[0].upper() + az[1:], en[0].lower() + en[1:] if en[:2] != 'I ' else en, pos, refs, 'paraphrase', **extra)

    # Templates --------------------------------------------------------------------
    def verbal_noun(self, verb, base):
        ing = clean_form((base.get('verbForms') or {}).get('ing'))
        en = f"the act of {ing}" if ing else f"verbal noun of {verb} ({gloss(base)})"
        return f'«{verb}» felindən düzələn feli isim; bu hərəkətin icrası.', en, 'noun'

    def passive(self, verb, base):
        participle = clean_form((base.get('verbForms') or {}).get('participle'))
        en = f"to be {participle}" if participle else f"passive of {verb} ({gloss(base)})"
        return f'«{verb}» felinin məchul növü.', en, 'verb'

    def causative(self, verb, base):
        plain = clean_form((base.get('verbForms') or {}).get('base'))
        en = f"to cause to {plain}" if plain else f"causative of {verb} ({gloss(base)})"
        return f'«{verb}» felinin icbar növü: bu hərəkəti başqasına etdirmək.', en, 'verb'

    TEMPLATES = {
        'f.is.': 'verbal_noun', 'məch.': 'passive', 'icb.': 'causative',
    }

    def from_note(self, word, label, base_word, base, refs):
        label = re.sub(r'\s+', '', label).lower()
        if label in ('f.is.', 'fis.'):
            return self.verbal_noun(base_word, base)
        if label == 'məch.':
            return self.passive(base_word, base)
        if label == 'icb.':
            return self.causative(base_word, base)
        g = gloss(base)
        if label == 'f.sif.':
            return f'«{base_word}» felindən düzələn feli sifət.', f'participle of {base_word} ({g})', 'adjective'
        if label in ('kiç.', 'oxş.'):
            return f'«{base_word}» sözünün kiçiltmə və ya oxşatma forması.', f'diminutive or endearing form of {base_word} ({g})', 'noun'
        if label == 'qayıd.':
            return f'«{base_word}» felinin qayıdış növü.', f'reflexive form of {base_word} ({g})', 'verb'
        if label == 'qarş.':
            return f'«{base_word}» felinin qarşılıq-birgəlik növü.', f'reciprocal form of {base_word} ({g})', 'verb'
        if label == 'mücər.':
            return f'«{base_word}» sözündən düzələn mücərrəd isim.', f'abstract noun from {base_word} ({g})', 'noun'
        return None

    # Print derivation notes and cross-references ---------------------------------------
    def print_notes(self):
        for word in list(self.nodes):
            for text, volume, page in self.print.get(key(word), []):
                refs = [print_source(volume, page)]
                match = EXPLICIT_FROM.match(text)
                if match:
                    base_word = self.by_key.get(key(HOMONYM.sub('', match[1].strip())))
                    if not base_word:
                        continue
                    self.link(word, base_word, 'root', 'İzahlı lüğət · törəmə',
                              f'İzahlı lüğətdə «{word}» sözü «{base_word}» sözündən törəmə kimi verilir.',
                              f'The explanatory dictionary lists {word} as derived from {base_word}.', refs, 'derivation')
                    base = self.defined(base_word)
                    if base and self.undefined(word):
                        made = self.from_note(word, match[2], base_word, base, refs)
                        if made:
                            self.define(word, *made, refs, 'derivation', base=base_word)
                    break
                match = SEE_ONLY.match(text)
                if match:
                    target = self.by_key.get(key(match[1]))
                    if not target or target == word:
                        continue
                    self.link(word, target, 'syn', 'İzahlı lüğət · bax',
                              f'İzahlı lüğət «{word}» sözü üçün «{target}» sözünə istinad edir.',
                              f'The explanatory dictionary refers {word} to {target}.', refs, 'cross-reference')
                    base = self.defined(target)
                    if base and self.undefined(word):
                        self.define(word, base['az'], base['en'], base['pos'] if base['pos'] in POS else 'phrase', refs,
                                    'cross-reference', see=target)
                    break

    # Productive suffixes ------------------------------------------------------------------
    def analyses(self, word):
        """Yield (base_word, kind, suffix) for transparent derivations of an existing headword."""
        if ' ' in word or len(word) < 5:
            return
        for size in range(2, min(len(word) - 2, 7) + 1):
            base_word, suffix = word[:-size], word[-size:]
            if len(base_word) < 3 or base_word not in self.nodes:
                continue
            v4, v2 = h4(base_word), h2(base_word)
            if not v4:
                continue
            kinds = {
                's' + v4 + 'z': 'privative',
                'l' + v4: 'possessive',
                'l' + v4 + ('q' if v4 in 'ıu' else 'k'): 'abstract',
                'ç' + v4: 'agent',
                'l' + v2 + 'ş' + infinitive_ending(base_word): 'become',
                'l' + v2 + 'şd' + h4(base_word + v2) + 'r' + infinitive_ending(base_word + v2): 'make',
            }
            if suffix in kinds:
                yield base_word, kinds[suffix], suffix
        # Verbal noun: yazma <- yazmaq
        if word.endswith(('ma', 'mə')):
            verb = word + ('q' if word.endswith('ma') else 'k')
            if verb in self.nodes:
                yield verb, 'verbal-noun', word[-2:]
        # Passive with -ıl after a consonant other than l, and causative with -dır.
        match = re.fullmatch(r'(.+[^aıoueəiöül])([ıiuü])l(maq|mək)', word)
        if match and h4(match[1]) == match[2]:
            verb = match[1] + infinitive_ending(match[1])
            if verb in self.nodes:
                yield verb, 'passive', match[2] + 'l'
        match = re.fullmatch(r'(.+[^aıoueəiöü])d([ıiuü])r(maq|mək)', word)
        if match and h4(match[1]) == match[2]:
            verb = match[1] + infinitive_ending(match[1])
            if verb in self.nodes:
                yield verb, 'causative', 'd' + match[2] + 'r'

    def rule_definition(self, base_word, kind, suffix, base):
        g, pos = gloss(base), base['pos']
        nominal = pos in ('noun', 'adjective', 'word', 'phrase')
        if kind == 'privative' and nominal:
            return (f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn sifət: {base_word} olmayan.',
                    f'without {g}', 'adjective')
        if kind == 'possessive' and pos in ('noun', 'word'):
            return (f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn sifət: {base_word} olan.',
                    f'having {g}', 'adjective')
        if kind == 'abstract' and pos == 'adjective':
            return f'{base_word.capitalize()} olma halı və ya keyfiyyəti.', f'the state or quality of being {g}', 'noun'
        if kind == 'abstract' and nominal:
            return (f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn isim.',
                    f'noun formed from {base_word} ({g}) with the suffix -{suffix}', 'noun')
        if kind == 'agent' and pos in ('noun', 'word'):
            return f'«{base_word}» ilə bağlı işlə məşğul olan şəxs.', f'a person who works with or deals in {g}', 'noun'
        if kind == 'become' and pos == 'adjective':
            return f'{base_word.capitalize()} hala gəlmək, getdikcə {base_word} olmaq.', f'to become {g}', 'verb'
        if kind == 'make' and pos == 'adjective':
            return f'Bir şeyi {base_word} hala gətirmək.', f'to make something {g}', 'verb'
        if pos == 'verb' and kind == 'verbal-noun':
            return self.verbal_noun(base_word, base)
        if pos == 'verb' and kind == 'passive':
            return self.passive(base_word, base)
        if pos == 'verb' and kind == 'causative':
            return self.causative(base_word, base)
        return None

    @staticmethod
    def mentions(own, base_word, base):
        text = (own['az'] + ' ' + own['en']).lower()
        g = gloss(base).lower()
        return base_word.lower() in text or (len(g) >= 3 and re.search(r'\b' + re.escape(g) + r'\b', text) is not None)

    def rules(self, define=True):
        for _ in range(4):
            before = len(self.definitions) + len(self.edges)
            for word in list(self.nodes):
                for base_word, kind, suffix in self.analyses(word):
                    base = self.defined(base_word)
                    page = self.nodes[word].get('page')
                    refs = ([spelling_source(page)] if page else []) + [GRAMMAR]
                    if not base:
                        continue
                    made = self.rule_definition(base_word, kind, suffix, base)
                    if not made:
                        continue
                    own = self.defined(word)
                    if own and self.definitions.get(word, {}).get('method') != 'rule' and not self.mentions(own, base_word, base):
                        self.stats['rule:unconfirmed-existing'] += 1
                        continue
                    self.link(word, base_word, 'root', 'Söz yaradıcılığı · -' + suffix,
                              f'«{word}» sözü «{base_word}» sözündən -{suffix} şəkilçisi ilə düzəlir.',
                              f'{word} is formed from {base_word} with the suffix -{suffix}.', refs, 'rule')
                    if define and self.undefined(word):
                        self.define(word, *made, refs, 'rule', base=base_word)
                    break
            if len(self.definitions) + len(self.edges) == before:
                break


LOADER = '''// Generated by scripts/build_print_definitions.py; see print-definitions-attribution.json.
window.WORD_WEB_PRINT_DEFINITIONS=(function(data){
 const [refs,rows,links]=data,ref=i=>({title:refs[i][0],url:refs[i][1]}),definitions={};
 for(const w in rows){const [az,en,pos,ids,method,extra]=rows[w];definitions[w]={az,en,pos,refs:ids.map(ref),method,...extra};}
 const edges=links.map(([a,b,kind,note,proofs])=>[a,b,kind,note,null,proofs.map(([from,senseAz,senseEn,ids])=>({from,senseAz,senseEn,refs:ids.map(ref)}))]);
 return {definitions,edges};
})(DATA);
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('model', type=Path)
    parser.add_argument('explanatory', type=Path)
    parser.add_argument('bilingual', type=Path)
    args = parser.parse_args()
    model = json.loads(args.model.read_text())
    builder = Builder(model, sqlite3.connect(f'file:{args.explanatory}?mode=ro', uri=True),
                      sqlite3.connect(f'file:{args.bilingual}?mode=ro', uri=True))
    before_undefined = sum(1 for n in model['nodes'] if not (n['az'].strip() and n['en'].strip()))
    before_isolated = sum(1 for n in model['nodes'] if not n['degree'])
    builder.paraphrases()
    for _ in range(6):
        size = len(builder.definitions) + len(builder.edges)
        builder.print_notes()
        builder.rules()
        if len(builder.definitions) + len(builder.edges) == size:
            break
    after_undefined = sum(1 for w in builder.nodes if not builder.defined(w))
    after_isolated = sum(1 for w in builder.nodes if not builder.degree[w])
    methods = collections.Counter(d['method'] for d in builder.definitions.values())
    summary = {
        'undefined_before': before_undefined, 'undefined_after': after_undefined,
        'isolated_before': before_isolated, 'isolated_after': after_isolated,
        'definitions': len(builder.definitions), 'definitions_by_method': dict(sorted(methods.items())),
        'low_confidence_paraphrases': sum(1 for d in builder.definitions.values() if d.get('confidence') == 'low'),
        'links': len(builder.edges), 'stats': dict(sorted(builder.stats.items())),
    }
    explanatory_hashes = [row for row in sqlite3.connect(f'file:{args.explanatory}?mode=ro', uri=True).execute('select volume, path, sha256 from sources')]
    bilingual_hashes = [row for row in sqlite3.connect(f'file:{args.bilingual}?mode=ro', uri=True).execute('select path, sha256 from sources')]
    meta = {
        'method': 'Definitions for headwords that had none. Paraphrases are AI-assisted new wording of the cited explanatory '
                  '(2006) and Musayev Azerbaijani–English dictionary senses; derivation and cross-reference definitions follow '
                  'explicit statements in the explanatory dictionary; rule-based definitions describe transparent productive '
                  'suffixes of defined base words. Print prose is cited, not republished. This is not native-speaker verification.',
        'license': 'New editorial text is shared under CC BY-SA 4.0.',
        'sources': {'explanatory': [{'volume': v, 'file': p, 'sha256': h} for v, p, h in explanatory_hashes],
                    'bilingual': [{'file': p, 'sha256': h} for p, h in bilingual_hashes],
                    'grammar': GRAMMAR},
        'summary': summary,
    }
    refs, index = [], {}
    def ref_ids(items):
        ids = []
        for item in items:
            token = (item['title'], item['url'])
            if token not in index:
                index[token] = len(refs)
                refs.append([item['title'], item['url']])
            ids.append(index[token])
        return ids
    definitions = {}
    for word, d in sorted(builder.definitions.items()):
        extra = {k: v for k, v in d.items() if k not in ('az', 'en', 'pos', 'refs', 'method')}
        definitions[word] = [d['az'], d['en'], d['pos'], ref_ids(d['refs']), d['method']] + ([extra] if extra else [])
    edges = [[a, b, kind, note, [[p['from'], p['senseAz'], p['senseEn'], ref_ids(p['refs'])] for p in proofs]]
             for a, b, kind, note, _, proofs in builder.edges]
    payload = json.dumps([refs, definitions, edges], ensure_ascii=False, separators=(',', ':'))
    OUTPUT.write_text(LOADER.replace('DATA', payload))
    meta['output_sha256'] = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    ATTRIBUTION.write_text(json.dumps(meta, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
