#!/usr/bin/env python3
"""Build dist/print-definitions.js: definitions and links for words that had none.

Inputs
  model      JSON from `node scripts/export_print_definition_model.cjs model.json --without-print`
  explanatory, bilingual
             SQLite caches from scripts/extract_print_dictionaries.py
  scripts/content/print-definitions/paraphrases/*.json
             AI-assisted bilingual paraphrases written from the cited print entries
  scripts/content/print-definitions/authored/*.json
             AI-written definitions for spellings that neither print dictionary covers

Each new definition records its method:
  paraphrase       new wording of the explanatory and/or Musayev dictionary sense (AI-assisted)
  derivation       the explanatory dictionary states the word is formed from a base ("X"dan f.is.)
  cross-reference  the explanatory dictionary refers the word to another headword (bax X)
  rule             a transparent, productive suffix of a defined base word (qayda ilə qurulub)
  authored         AI-written, for a spelling with no entry in either print dictionary; it cites
                   only the orthography page that attests the spelling and is always marked for review

Links (root for derivations, syn for cross-references) are added only between existing
headwords that are not already connected, each with its citation.  A suffix or compound
link for a word that already has a definition needs evidence that the base is right: that
definition, or the definition sentences of the word's primary explanatory entry, names the
base (bare or inflected, never as part of another headword).  A closed compound is not split
where a longer headword plus a derivational suffix explains the word (kontur-lamaq is not
kont + urlamaq), nor at a short piece of an international loan.  Print prose is used
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
SPELLING_RULES = {'title': 'Azərbaycan dilinin orfoqrafiya qaydaları', 'url': 'https://e-qanun.az/framework/42073'}
# Learned prefixes written solidly with the following word, with their English combining forms.
PREFIXES = {
    'aero': 'aero', 'anti': 'anti', 'astro': 'astro', 'avto': 'auto', 'bio': 'bio', 'elektro': 'electro',
    'geo': 'geo', 'hidro': 'hydro', 'infra': 'infra', 'kiber': 'cyber', 'kino': 'film ', 'kontr': 'counter',
    'makro': 'macro', 'meqa': 'mega', 'mikro': 'micro', 'mini': 'mini', 'mono': 'mono', 'multi': 'multi',
    'neo': 'neo', 'poli': 'poly', 'psixo': 'psycho', 'radio': 'radio ', 'sosio': 'socio', 'super': 'super',
    'tele': 'tele', 'termo': 'thermo', 'ultra': 'ultra', 'video': 'video ', 'foto': 'photo', 'nano': 'nano',
    'kilo': 'kilo', 'santi': 'centi', 'milli': 'milli', 'vitse': 'vice-', 'eks': 'ex-', 'post': 'post-',
    'kvazi': 'quasi-', 'psevdo': 'pseudo-', 'krio': 'cryo', 'giqa': 'giga', 'ekstra': 'extra-',
}
# Endings that are dictionary headwords but act as suffixes at the end of a word.
SUFFIX_LIKE = {'dan', 'dən', 'lıq', 'lik', 'luq', 'lük', 'çılıq', 'çilik', 'ləmə', 'lama', 'lamaq', 'ləmək', 'lar', 'lər',
               'mış', 'miş', 'muş', 'müş', 'acaq', 'əcək', 'ası', 'əsi', 'daş', 'dar', 'kar', 'gar', 'xana', 'stan',
               'baz', 'keş', 'kəş', 'dan', 'çı', 'çi', 'ənək', 'anaq',
               # Pronoun forms that end privative -sız + -ca words (dinsizcə is dinsiz + -cə, not din + sizcə).
               'sizcə', 'bizcə', 'məncə', 'səncə', 'sızca', 'suzca', 'süzcə'}
# Endings that make a word read as one longer stem plus a suffix (kontur-lamaq, cığal-laşma), not as two words.
DERIVING = {front for back, front in (('lamaq', 'ləmək'), ('lanmaq', 'lənmək'), ('laşmaq', 'ləşmək'), ('lama', 'ləmə'),
                                      ('lanma', 'lənmə'), ('laşma', 'ləşmə'), ('laşdırmaq', 'ləşdirmək'), ('çılıq', 'çilik'),
                                      ('çuluq', 'çülük'), ('lıq', 'lik'), ('luq', 'lük'), ('sız', 'siz'), ('suz', 'süz'))
            for front in (back, front)}
# Quantity words that open a noun + -lı adjective (çoxbarmaqlı, ikimərtəbəli), with Azerbaijani and English wording.
QUANTIFIERS = {'çox': ('çoxlu', 'multi'), 'az': ('az', 'low'), 'bir': ('bir', 'one'), 'iki': ('iki', 'two'), 'üç': ('üç', 'three'),
               'dörd': ('dörd', 'four'), 'beş': ('beş', 'five'), 'altı': ('altı', 'six'), 'yeddi': ('yeddi', 'seven'),
               'səkkiz': ('səkkiz', 'eight'), 'doqquz': ('doqquz', 'nine'), 'on': ('on', 'ten'), 'yüz': ('yüz', 'hundred'),
               'min': ('min', 'thousand')}
# Borrowed derivational sets sharing one stem (psixologiya, psixoloji, psixoloq). Words of a set are linked; where the
# head is defined, a member whose sense follows from it gets a rule definition: (ending, head ending, az, en).
LOAN_FAMILIES = [('logiya', 'loji', 'loq'), ('qrafiya', 'qrafik', 'qraf'), ('metriya', 'metrik', 'metr'), ('izm', 'ist', 'istik'),
                 ('ika', 'ik')]
LOAN_SENSES = [('loq', 'logiya', '«{head}» üzrə mütəxəssis.', 'specialist in {g}', 'noun'),
               ('loji', 'logiya', '«{head}» ilə bağlı.', 'relating to {g}', 'adjective'),
               ('qrafik', 'qrafiya', '«{head}» ilə bağlı.', 'relating to {g}', 'adjective'),
               ('metrik', 'metriya', '«{head}» ilə bağlı.', 'relating to {g}', 'adjective'),
               ('ist', 'izm', '«{head}» tərəfdarı.', 'supporter of {g}', 'noun'),
               ('istik', 'izm', '«{head}» ilə bağlı.', 'relating to {g}', 'adjective')]
NOT_DOCTRINES = {'autizm', 'bilinqvizm', 'monolinqvizm', 'sadomazoxizm', 'eqosentrizm', 'seksualizm', 'latinizm'}
# Place words that close a compound (qarınüstü, çənəaltı, parkboyu): Azerbaijani locative and English preposition.
POSITIONS = {'üstü': ('üstündə', 'on or above'), 'altı': ('altında', 'under'), 'arası': ('arasında', 'between'),
             'içi': ('içində', 'inside'), 'yanı': ('yanında', 'beside'), 'önü': ('önündə', 'in front of'),
             'arxası': ('arxasında', 'behind'), 'ətrafı': ('ətrafında', 'around'), 'boyu': ('boyunca', 'along'),
             'kənarı': ('kənarında', 'at the edge of'), 'qırağı': ('qırağında', 'at the edge of'), 'ardı': ('ardında', 'behind')}
# Heads that a combining form only seems to end in: -qrafik and -metrik are not kinds of qrafik (chart) or metrik.
FALSE_HEADS = {'qrafik', 'metrik', 'metrlik', 'qramlıq', 'metraj', 'metr', 'qram', 'litr'}
VERBAL_KINDS = {'converb-repeat', 'verbal-noun', 'passive', 'passive-n', 'causative', 'become', 'make', 'acquire',
                'doer', 'action', 'result', 'never'}
# Words too general, or too grammatical, to head a definition usefully (a tool, a person, a place, doing, being).
GENERIC_HEADS = set('şəxs adam kəs insan yer şey hal vəziyyət iş hərəkət proses vasitə üsul qayda tərz zaman vaxt dövr ad '
                    'söz termin ifadə məna xüsusiyyət keyfiyyət hissə sahə elm növ cins forma şəkil cür məcmu toplu sistem '
                    'obyekt element biri birisi olan kimi üçün aid bağlı məxsus edən bilən olmayan və ya yaxud ilə qədər görə '
                    'tərəf şəkildə surətdə tərzdə vasitəsilə etmək olmaq eləmək olunmaq edilmək qılmaq halı adı tərəfdarı bir '
                    'az çox ən daha lap nümayəndə etmə eləmə olma olmama olunma edilmə gəlmə salma vermə düşmə sürmə qılma '
                    'tutma çəkmə getmə'.split())
# A head like "növ" (kind) passes the genus to the word before it: zəhərli baldırğan növü.
KIND_HEADS = {'növ', 'cins', 'çeşid', 'sort', 'forma', 'variant'}
# Endings a verb stem takes in running text (becər-ən, üfür-ücü, keçir-məz, aç-ma, düş-müş), so a definition that uses
# a participle or verbal noun names the verb.
VERB_ENDINGS = set('an ən yan yən maz məz ma mə maq mək ar ər araq ərək yaraq yərək malı məli mayan məyən'.split()) | {
    ending.replace('V', v) for v in 'ıiuü' for ending in 'Vb yVb mVş Vr dV Vş yVş VcV yVcV VntV ntV'.split()}
VERB_FORM_TAILS = {'', 'lar', 'lər', 'ı', 'i', 'u', 'ü', 'ın', 'in', 'un', 'ün', 'dır', 'dir', 'dur', 'dür'}
# Word-forming endings of a verb stem: (kind, after a consonant, after a vowel); V takes four-way and A two-way harmony.
VERB_SUFFIXES = [('doer', 'VcV', 'yVcV'), ('result', 'VntV', 'ntV'), ('action', 'Vş', 'yVş'), ('never', 'mAz', 'mAz'),
                 ('perfect', 'mVş', 'mVş'), ('participle', 'An', 'yAn'), ('verbal-noun', 'mA', 'mA')]
# Verb-derived nouns and adjectives that the suffix rules define (the others are inflections, used only inside compounds).
VERB_DERIVED = {'doer', 'action', 'result', 'never'}
# Invariant suffixes of Persian origin: çayxana, namazgah, torpaqşünas, qəpikpərəst, qanunpərvər, oyunbaz.
INVARIANT_SUFFIXES = {'xana': 'place', 'gah': 'place', 'şünas': 'expert', 'şünaslıq': 'study', 'pərəst': 'devotee',
                      'pərvər': 'devotee', 'baz': 'fond'}
# Suffixes with several senses (qeyrət-lə, sabah-dan, yapon-ca, büllur-i, oyun-baz): they only link a word whose own
# definition names the base, and never define one.
LINK_ONLY = {'with', 'from', 'ca', 'relational', 'fond'}
# Case endings on the first part of a compound whose second part governs it (göy-dən düşmüş, heyvan-a oxşar).
CASE_ENDINGS = ('dan', 'dən', 'da', 'də', 'ya', 'yə', 'nı', 'ni', 'nu', 'nü', 'sı', 'si', 'su', 'sü', 'a', 'ə', 'ı', 'i', 'u', 'ü')
# Adjectives and postpositions that govern the case of the word before them: heyvan-a oxşar, tərif-ə layiq, rinq-dən kənar.
GOVERNORS = {'dative': {'oxşar', 'bənzər', 'layiq', 'dözümlü', 'davamlı', 'məxsus', 'aid', 'uyğun', 'yaxın', 'bərabər', 'qarşı',
                        'həssas', 'sadiq', 'xas', 'müvafiq', 'tabe', 'yararlı', 'qadir', 'dəyər', 'doğru', 'tərəf'},
             'ablative': {'kənar', 'xaric', 'uzaq', 'asılı', 'ibarət', 'azad', 'başqa', 'savayı', 'əvvəl', 'sonra', 'yuxarı',
                          'aşağı', 'artıq', 'qabaq'}}
CASE_OF = {'a': 'dative', 'ə': 'dative', 'ya': 'dative', 'yə': 'dative', 'dan': 'ablative', 'dən': 'ablative',
           'da': 'locative', 'də': 'locative', 'nı': 'accusative', 'ni': 'accusative', 'nu': 'accusative', 'nü': 'accusative',
           'sı': 'possessive', 'si': 'possessive', 'su': 'possessive', 'sü': 'possessive'}
PAIRED_ENDINGS = {'sı', 'si', 'su', 'sü', 'nı', 'ni', 'nu', 'nü', 'lı', 'li', 'lu', 'lü'}
POS = {'noun', 'verb', 'adjective', 'adverb', 'numeral', 'pronoun', 'interjection', 'postposition',
       'conjunction', 'particle', 'phrase'}
EXPLICIT_FROM = re.compile(r'^"([^"]+)"\s*-?\s*(?:dan|dən|ın|in|un|ün)?\s*(?:sözündən\s+)?'
                           r'(f\s*\.?\s*is\.|f\s*\.\s*sif\.|icb\.|məch\.|qayıd\.|qarş\.|kiç\.|oxş\.|mücər\.)', re.I)
SEE_ONLY = re.compile(r'^(?:(?:\[[^\]]{1,100}\]|[a-zçğıöşüə]{1,8}\.)\s*)*b\s*a\s*x\s+'
                      r'([a-zçğıöşüə]+(?:[- ][a-zçğıöşüə]+)*)(?:\s*\d{1,2})?\s*\.?$', re.I)
# A Musayev entry that opens with a cross-reference, after part-of-speech labels or a sense number: «s. 1. bax qəbiz;».
# An unlabelled «bax X» is a phrase split off the previous entry by the PDF extraction (abad etmək bax ...), not a reference.
BILINGUAL_SEE = re.compile(r'^(?:(?:[a-zçğıöşüə]{1,5}\.|\d\.)\s*)+bax\s+([a-zçğıöşüə]+(?:[- ][a-zçğıöşüə]+)*)'
                           r'(?:\s+(?:I{1,3}|\d))?\s*(?:[;,.]|$)', re.I)
# An explanatory entry whose first sense is a cross-reference, followed by quotations or more senses.
LEADING_SEE = re.compile(r'^(?:(?:\[[^\]]{1,100}\]|[a-zçğıöşüə]{1,8}\.)\s*)*(?:1\.\s*)?b\s*a\s*x\s+'
                         r'([a-zçğıöşüə]+(?:[- ][a-zçğıöşüə]+)*)(?:\s*\d{1,2})?'
                         # a sense qualifier: «b a x ağıllı 1 və 3-cü mənalarda», «b a x son 3-cü mənada»
                         r'(?:\s+\d{1,2}(?:\s*(?:,|və)\s*\d{1,2})*\s*[-–]?\s*(?:c[ıiuü]|nc[ıiuü])?\s+məna(?:da|larda))?'
                         r'\s*(?:[.;,]|$)', re.I)
# Wiktionary's wording for a definition that only points at another headword: «alternative form of şivən».
FORM_OF = re.compile(r'^(?:[a-z]+\.\s*)?(?:(?:an?|the)\s+)?(?:(?:obsolete|archaic|dated|rare|nonstandard|non-standard|colloquial|'
                     r'dialectal|informal|historical|alternative|common|standard|eye dialect|pronunciation)\s+)*(?:form|spelling|'
                     r'misspelling|variant|plural|abbreviation|initialism|acronym|clipping|contraction|romanization)s?\s+of\s+'
                     r'([^\s,;:()“"]+(?:\s[^\s,;:()“"]+){0,2})', re.I)
# Lowercase labels ending in a period before the sense of an atlas definition: «kimya. », «biokimyəvi, genetik. ».
ORIGINAL_LABELS = re.compile(r'^(?:[a-zçğıöşüə]{2,14}(?:,\s*[a-zçğıöşüə]{2,14})*\.\s+)+(?=\S)')
# Light verbs head verb phrases without saying much (kömək vermək, narahatlıq keçirmək), so they make no class link.
LIGHT_VERBS = set('vermək keçirmək göstərmək gətirmək demək çıxmaq çıxarmaq itirmək qalmaq salmaq düşmək almaq tutmaq çəkmək '
                  'qoymaq yetirmək gəlmək getmək durmaq bilmək bilməz etdirmək olunmaq edilmək vermə keçirmə göstərmə '
                  'gətirmə çıxarma qoyma yetirmə'.split())
# Words that name a form, not a class, and so never head a definition: «şivənin alternativ forması», «… qısaltması».
FORM_HEADS = {'alternativ', 'yazılış', 'yazılma', 'çoxluq', 'abreviatura', 'qısaltma', 'variant', 'tələffüz', 'forma',
              'etdirmək', 'etmək', 'eləmək', 'olmaq', 'söz', 'anlayış'}
HOMONYM = re.compile(r'[- ]?\d{1,2}$')
BACK, FRONT = set('aıou'), set('əeiöü')
VOWELS = BACK | FRONT
# Case, possessive and plural endings (all harmony variants) that may follow a base word
# when a print definition names it: "Kədəri olmayan" names kədər, "Ata minmiş" names at.
INFLECTIONS = {''} | {pre + v + post for v in 'ıiuü' for pre in ('', 's', 'n', 'y') for post in ('', 'n', 'na', 'nə', 'nı', 'ni', 'nu', 'nü', 'nda', 'ndə', 'ndan', 'ndən')} \
    | {'a', 'ə', 'ya', 'yə', 'na', 'nə', 'da', 'də', 'ta', 'tə', 'dan', 'dən', 'tan', 'tən', 'nda', 'ndə', 'ndan', 'ndən',
       'la', 'lə', 'yla', 'ylə', 'lar', 'lər', 'ları', 'ləri', 'ların', 'lərin', 'lara', 'lərə', 'larda', 'lərdə',
       'lardan', 'lərdən', 'nın', 'nin', 'nun', 'nün', 'yın', 'yin', 'yun', 'yün', 'dır', 'dir', 'dur', 'dür'}


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


# Domain labels that some English glosses start with ("chem. methyl", "el.-tech. electrode").
DOMAIN_LABELS = ('chem biol zool physics mineral anat biochem math astron geol religious econ polit fin arts physical music comp '
                 'geometric psychol info geogr ling ornithol sexol philol genet legal philos physiol psychiatr ichthyol el.-tech '
                 'kulin tech gram geometer entomol architect cytol scientific min pharma chess linguist microbiol sport sports '
                 'text book vet publ paleont miner metal meteorol sociol archaeol eco hydrol special spec').split()


def article(phrase):
    return ('an ' if phrase[:1] in 'aeiou' else 'a ') + phrase


def english_plural(short, base_word):
    """Plural of a one-word English gloss; the Azerbaijani plural when only the base word is available."""
    if short == base_word:
        return base_word + 'l' + h2(base_word) + 'r'
    if ' ' in short or short.endswith('s'):
        return short
    if short.endswith('y') and short[-2:-1] not in 'aeiou':
        return short[:-1] + 'ies'
    return short + ('es' if short.endswith(('x', 'sh', 'ch')) else 's')


def english_verb(gloss_text, verb_forms):
    """Base form and -ing form of a verb's English gloss: ('blow', 'blowing') for "to blow", or the model's verb forms."""
    forms = verb_forms or {}
    model_plain, model_ing = clean_form(forms.get('base')), clean_form(forms.get('ing'))
    match = re.match(r'(?:to )?([a-z]+(?: [a-z]+){0,3})(?=$|[;,])', gloss_text)
    if not match or match[1].split()[0] in ('causative', 'passive', 'verbal', 'reflexive', 'reciprocal', 'negative', 'variant'):
        return (model_plain, model_ing) if model_plain and model_ing else ('', '')
    # Keep the first of several alternatives (peel or skin -> peel); a gloss that only points elsewhere has no verb.
    plain = match[1].split(' or ')[0]
    if re.search(r'\b(?:of|synonyms?|see)\b', plain):
        return (model_plain, model_ing) if model_plain and model_ing else ('', '')
    if plain == model_plain and model_ing:
        return plain, model_ing
    first, _, rest = plain.partition(' ')
    if first == 'be':
        ing = 'being'
    elif first.endswith('ie'):
        ing = first[:-2] + 'ying'
    elif first.endswith('e') and not first.endswith(('ee', 'ye', 'oe')):
        ing = first[:-1] + 'ing'
    elif re.fullmatch(r'[^aeiou]*[aeiou][bdgmnpt]', first):
        ing = first + first[-1] + 'ing'
    else:
        ing = first + 'ing'
    return plain, ing + (' ' + rest if rest else '')


def third_person(plain):
    first, _, rest = plain.partition(' ')
    special = {'be': 'is', 'have': 'has', 'do': 'does', 'go': 'goes'}
    if first in special:
        first = special[first]
    elif re.search(r'[^aeiou]y$', first):
        first = first[:-1] + 'ies'
    elif first.endswith(('s', 'x', 'z', 'ch', 'sh', 'o')):
        first += 'es'
    else:
        first += 's'
    return first + (' ' + rest if rest else '')


def verb_splits(form):
    """Candidate (stem, suffix, kind) splits of form into a verb stem and a word-forming or participle ending."""
    for kind, after_consonant, after_vowel in VERB_SUFFIXES:
        for pattern in dict.fromkeys((after_consonant, after_vowel)):
            stem = form[:-len(pattern)]
            if len(stem) < 2 or not last_vowel(stem):
                continue
            if after_consonant != after_vowel and (stem[-1] in VOWELS) != (pattern == after_vowel):
                continue
            if form[-len(pattern):] == pattern.replace('V', h4(stem)).replace('A', h2(stem)):
                yield stem, form[-len(pattern):], kind


def word_of(base_word, suffix):
    """The plural that a "between" adjective is built on: bank + lar|arası -> banklar."""
    return base_word + suffix[:3]


def gloss(node):
    labels = '|'.join(re.escape(label) for label in DOMAIN_LABELS)
    text = re.sub(rf'^(?:(?:{labels})\.\s+)+(?=\w)', '', re.sub(r'\([^)]*\)?', '', node['en']))
    # A usage note ("In classical usage, ashamed") is not the meaning.
    text = re.sub(r'^(?:in (?:classical|colloquial|poetic|dialectal|figurative|archaic|literary) (?:usage|use)|colloquial|obsolete|archaic|poetic)[,;:]\s*', '', text, flags=re.I)
    # A bare "special" label before a field name ("special chromatography") is not part of the meaning.
    text = re.sub(r'^special (?=\w+(?:logy|graphy|metry|nomy|ics)\b)', '', text)
    parts = [part.strip() for part in re.split(r'[;,:]|\.\s', text) if part.strip()]
    if node.get('pos') == 'verb':
        parts = [part for part in parts if part.lower().startswith('to ')] or parts
    text = parts[0] if parts else node['en']
    text = re.sub(r'\s+', ' ', re.sub(r'^(?:to|a|an|the)\s+', '', text, flags=re.I)).rstrip('.:').strip()
    # Lower-case a sentence-initial capital, but keep acronyms and proper names written in capitals.
    return text[:1].lower() + text[1:] if text[:1].isupper() and not text[1:2].isupper() and node.get('pos') != 'name' else text


def clean_form(form):
    form = (form or '').strip()
    return '' if not form or re.search(r'\b(?:or|and|of|to|the|a|an)$|[,;:(]$', form) else form


def nationality(node):
    """A nationality or language adjective is defined by one capitalised word on both sides: ibri, «İbrani», «Hebrew»."""
    az, en = node.get('az', '').strip(), node.get('en', '').strip()
    return bool(re.fullmatch(r'[A-ZÇĞIİÖŞÜƏ][\wçğıöşüə]+', az) and re.fullmatch(r'[A-Z][a-z]+', en))


def possessive_stem(word):
    """Undo a third-person possessive ending and the q/k voicing it triggers."""
    match = re.fullmatch(r'(.+?)(s?)([ıiuü])', word)
    if not match or h4(match[1]) != match[3]:
        return None
    stem, buffer = match[1], match[2]
    if buffer:
        return stem if stem[-1] in VOWELS else None
    if stem[-1] in VOWELS:
        return None
    return stem[:-1] + {'ğ': 'q', 'y': 'k'}.get(stem[-1], stem[-1]) if stem[-1] in 'ğy' else stem


def definition_sentences(text, limit=3):
    """First sentence of up to three numbered senses, without labels, examples or idioms."""
    text = text.split('◊')[0]
    head = re.match(r'^((?:\[[^\]]{0,120}\]\s*|[a-zçğıöşüə.]{1,8}\.\s*|və\s+)*)', text)
    body = text[len(head[1]):]
    parts = re.split(r'(?:^|\s)(\d{1,2})\.\s', body)
    out = []
    for chunk in [parts[0]] + [parts[i + 1] for i in range(1, len(parts) - 1, 2)]:
        chunk = re.sub(r'^((?:[a-zçğıöşüə]{1,8}\.\s*)+)', '', chunk.strip())
        first = re.split(r'(?<=[.;?!])\s+(?=[A-ZÇĞIİÖŞÜƏ–\[]|"\S)|\s\.\.', chunk)[0][:220]
        if first:
            out.append(first)
        if len(out) >= limit:
            break
    return out


def ngrams(text, size=6):
    words = re.findall(r'\w+', text.lower())
    return {tuple(words[i:i + size]) for i in range(len(words) - size + 1)}


class Builder:
    def __init__(self, model, explanatory, bilingual):
        self.nodes = {n['w']: n for n in model['nodes']}
        # Pairs that reviewers rejected (the model drops any link between them).
        self.blocked = {tuple(sorted(pair)) for pair in model.get('blocked', [])}
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
        self._senses = {}
        self.form_kind = {}

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
        if a == b or a not in self.nodes or b not in self.nodes or pair in self.connected or pair in self.blocked:
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

    # AI-written definitions for words no print source covers ----------------------------
    def authored(self):
        for path in sorted((CONTENT / 'authored').glob('batch-[0-9][0-9].json')):
            for word, entry in json.loads(path.read_text()).items():
                if not self.undefined(word) or 'skip' in entry:
                    continue
                k = key(word)
                # A word either print dictionary covers gets a cited paraphrase instead.
                if self.print.get(k) or self.musayev.get(k):
                    self.stats['authored:rejected-in-print'] += 1
                    continue
                az, en, pos = entry.get('az', '').strip(), entry.get('en', '').strip(), entry.get('pos')
                page = self.nodes.get(word, {}).get('page')
                if not az.endswith('.') or not en or pos not in POS or len(az) > 260 or len(en) > 200 or not page:
                    self.stats['authored:rejected-format'] += 1
                    continue
                self.define(word, az[0].upper() + az[1:], en[0].lower() + en[1:] if en[:2] != 'I ' else en, pos,
                            [spelling_source(page)], 'authored')

    # Templates --------------------------------------------------------------------
    def verbal_noun(self, verb, base):
        ing = clean_form((base.get('verbForms') or {}).get('ing'))
        en = f"the act of {ing}" if ing else f"verbal noun of {verb} ({gloss(base)})"
        return f'«{verb}» felindən düzələn feli isim; bu hərəkətin icrası.', en, 'noun'

    def passive(self, verb, base, reflexive=False):
        participle = clean_form((base.get('verbForms') or {}).get('participle'))
        en = f"to be {participle}" if participle else f"passive of {verb} ({gloss(base)})"
        # -n after a -la verb is passive or reflexive (bağlanmaq: to be tied, or to tie oneself up).
        return f'«{verb}» felinin {"məchul və ya qayıdış" if reflexive else "məchul"} növü.', en, 'verb'

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
        # Doubled converb (ağlaya-ağlaya, bilə-bilə) or doubled noun (mərhələ-mərhələ, parça-parça).
        match = re.fullmatch(r'([^- ]+)-\1', word)
        if match:
            piece = match[1]
            if piece[-1] in 'aə':
                stems = [piece[:-1]] + ([piece[:-2]] if piece[:-1].endswith('y') else [])
                # A stem-final t turns into d before the vowel: üyüdə-üyüdə is üyütmək, dağıda-dağıda is dağıtmaq.
                stems += [piece[:-2] + 't'] if piece[:-1].endswith('d') else []
                verb = next((s + infinitive_ending(s) for s in stems if (self.usable(s + infinitive_ending(s)) or {}).get('pos') == 'verb'), None)
                if verb:
                    yield verb, 'converb-repeat', piece[-1]
                    return
            # A doubled participle (görməmiş-görməmiş) is not "X by X".
            if piece in self.nodes and not re.search(r'm[ıiuü]ş$', piece):
                yield piece, 'repeat', ''
            return
        # Passive or reflexive -n of a -la verb comes first: açıqlanmaq is açıqlamaq + -n, not açıq + -lanmaq.
        match = re.fullmatch(r'(.+l[aə])n(maq|mək)', word)
        if match and match[1] + infinitive_ending(match[1]) in self.nodes:
            yield match[1] + infinitive_ending(match[1]), 'passive-n', 'n'
        for size in range(2, min(len(word) - 2, 9) + 1):
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
                'l' + v2 + 'n' + infinitive_ending(base_word): 'acquire',
                'c' + v4 + ('q' if v4 in 'ıu' else 'k'): 'diminutive',
                'ç' + v2: 'diminutive',
                'c' + v2 + ('sına' if v2 == 'a' else 'sinə'): 'manner',
                'vari': 'like',
                'l' + v2: 'with',
                'd' + v2 + 'n': 'from',
                'c' + v2: 'ca',
            }
            kinds.update(INVARIANT_SUFFIXES)
            # -anə after a consonant, -yanə after a vowel (aşiqanə, dahiyanə); relational -i only after a consonant.
            kinds['yanə' if base_word[-1] in VOWELS else 'anə'] = 'manner-ane'
            if base_word[-1] not in VOWELS:
                kinds['i'] = 'relational'
            if suffix in kinds:
                yield base_word, kinds[suffix], suffix
        # Place compounds: qarınüstü (qarın + üstü), and "between" adjectives: banklararası (bank + -lar + arası).
        for place in POSITIONS:
            base_word = word[:-len(place)]
            if word.endswith(place) and len(base_word) >= 3:
                plural = re.fullmatch(r'(.+)(lar|lər)', base_word) if place == 'arası' else None
                if plural and plural[1] in self.nodes and plural[2] == 'l' + h2(plural[1]) + 'r':
                    yield plural[1], 'between', plural[2] + place
                elif base_word in self.nodes:
                    yield base_word, 'position', place
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
        # Causative -t after a vowel-final verb stem (bankalamaq -> bankalatmaq, oxumaq -> oxutmaq) or a stem of two or
        # more syllables ending in -r or -l (aşdırmaq -> aşdırtmaq, darılmaq -> darıltmaq).
        match = re.fullmatch(r'(.+[aıoueəiöü])t(maq|mək)', word) or re.fullmatch(r'(.+[aıoueəiöü][rl])t(maq|mək)', word)
        if match and (match[1][-1] in VOWELS or len(re.findall(r'[aıoueəiöü]', match[1])) >= 2):
            verb = match[1] + infinitive_ending(match[1])
            if verb in self.nodes:
                yield verb, 'causative', 't'
        # Nouns and adjectives made from a verb: göndərici (göndərmək + -ici), baxış, kəsinti, qorxmaz.
        found = self.verb_of(word)
        if found and found[1] in VERB_DERIVED and word not in found[0]:
            yield found

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
        # A long descriptive gloss reads badly inside a verb gloss; name the base word instead.
        short = g if len(g.split()) <= 4 else base_word
        english = short != base_word  # the gloss is English, not the Azerbaijani base used as a fallback
        if g.startswith('having '):
            short = 'with ' + g[7:]
        if kind == 'become' and pos in ('noun', 'word'):
            return (f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn fel: {base_word} halına keçmək, {base_word} xarakteri almaq.',
                    f'to turn into or become like {short}', 'verb')
        if kind == 'make' and pos in ('noun', 'word'):
            return (f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn fel: bir şeyi {base_word} halına salmaq.',
                    f'to turn something into {short}', 'verb')
        if kind == 'converb-repeat' and pos == 'verb':
            ing = clean_form((base.get('verbForms') or {}).get('ing'))
            en = f'while {ing}, again and again' if ing else f'repeatedly, as in {base_word} ({g})'
            return f'«{base_word}» felindən düzələn təkrarlı feli bağlama: hərəkətin davamlı, təkrar-təkrar icrasını bildirir.', en, 'adverb'
        if kind == 'repeat' and pos in ('noun', 'word'):
            en = f'{short} by {short}' if english and ' ' not in short else f'one {base_word} after another'
            return f'«{base_word}» sözünün təkrarı ilə düzələn zərf: {base_word} ardınca {base_word}, bir-bir.', en, 'adverb'
        if kind == 'repeat' and pos == 'adjective':
            # A doubled adjective intensifies it or turns it into a manner adverb (küsülü-küsülü, durğun-durğun).
            return (f'«{base_word}» sözünün təkrarı ilə düzələn qoşa söz: çox {base_word}, {base_word} halda.',
                    f'{short} (doubled for emphasis or manner)', 'adverb')
        if kind == 'diminutive' and pos in ('noun', 'word'):
            return f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn kiçiltmə: kiçik {base_word}.', f'little {short}', 'noun'
        if kind == 'manner' and nominal:
            if pos in ('noun', 'word'):
                en = f'like {article(short)}' if english and ' ' not in short else f'like {short}'
            else:
                en = f'in {article(short)} manner' if ' ' not in short else f'as if {short}'
            return f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn zərf: {base_word} kimi.', en, 'adverb'
        if kind == 'position' and pos in ('noun', 'word'):
            locative, preposition = POSITIONS[suffix]
            target = english_plural(short, base_word) if suffix == 'arası' else (f'the {short}' if english else short)
            return (f'«{base_word}» və «{suffix}» sözlərindən düzələn sifət: {base_word} {locative} olan.',
                    f'{preposition} {target}', 'adjective')
        if kind == 'between' and pos in ('noun', 'word'):
            return (f'«{base_word}» sözündən düzələn sifət: {word_of(base_word, suffix)} arasında olan.',
                    f'between {english_plural(short, base_word)}', 'adjective')
        # -lan after a noun has too many senses to state by rule (çapaqlanmaq, çisəklənmək); after an adjective it is "become".
        if kind == 'acquire' and pos == 'adjective':
            return f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn fel: {base_word} olmaq.', f'to become {short}', 'verb'
        if kind == 'ca' and pos == 'adjective' and not nationality(base):
            # After an adjective -ca weakens it or makes a manner adverb (bozca, qızğınca); after a noun, or a nationality
            # adjective (ibri, Hebrew: ibricə, in Hebrew), it has more senses.
            return (f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn söz: bir qədər {base_word}, {base_word} şəkildə.',
                    f'somewhat {short}, in a {short} manner', 'adverb')
        if kind in LINK_ONLY and nominal:
            return f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn söz.', f'formed from {base_word} ({g}) with -{suffix}', pos
        if kind == 'place' and pos in ('noun', 'word'):
            return (f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn isim: {base_word} ilə bağlı yer.',
                    f'place for {short}' if english else f'place of {base_word}', 'noun')
        if kind == 'expert' and nominal:
            return f'«{base_word}» üzrə mütəxəssis.', f'specialist in {short}', 'noun'
        if kind == 'study' and nominal:
            return f'«{base_word}» sahəsini öyrənən elm.', f'study of {short}', 'noun'
        if kind == 'devotee' and nominal:
            return (f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn söz: {base_word} pərəstişkarı, ona hədsiz bağlı olan.',
                    f'devotee of {short}', 'noun')
        if kind == 'manner-ane' and nominal:
            if pos in ('noun', 'word'):
                en = f'like {article(short)}' if english and ' ' not in short else f'like {short}'
            else:
                en = f'in {article(short)} manner' if ' ' not in short else f'as if {short}'
            return f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn söz: {base_word} kimi, ona xas tərzdə.', en, 'adjective'
        if kind == 'like' and nominal:
            return (f'«{base_word}» sözündən -{suffix} şəkilçisi ilə düzələn sifət: {base_word} kimi, ona bənzəyən.',
                    f'{short}-like' if english and ' ' not in short else f'like {short}', 'adjective')
        if pos == 'verb' and kind in VERB_DERIVED:
            plain, ing = english_verb(g, base.get('verbForms'))
            if kind == 'doer':
                return (f'«{base_word}» felindən -{suffix} şəkilçisi ilə düzələn söz: bu işi görən şəxs və ya vasitə.',
                        f'one that {third_person(plain)}' if plain else f'agent noun of {base_word} ({g})', 'noun')
            if kind == 'action':
                return (f'«{base_word}» felindən -{suffix} şəkilçisi ilə düzələn isim: bu hərəkət və ya onun tərzi.',
                        f'the act or manner of {ing}' if ing else f'action noun of {base_word} ({g})', 'noun')
            if kind == 'result':
                return (f'«{base_word}» felindən -{suffix} şəkilçisi ilə düzələn isim: bu hərəkətin nəticəsi və ya qalığı.',
                        f'what results from {ing}' if ing else f'result noun of {base_word} ({g})', 'noun')
            negative = ('that is not ' + plain[3:]) if plain.startswith('be ') else f'that does not {plain}'
            return (f'«{base_word}» felindən -{suffix} şəkilçisi ilə düzələn sifət: bu hərəkəti etməyən və ya ona uğramayan.',
                    negative if plain else f'negative participle of {base_word} ({g})', 'adjective')
        if pos == 'verb' and kind == 'verbal-noun':
            return self.verbal_noun(base_word, base)
        if pos == 'verb' and kind == 'passive':
            return self.passive(base_word, base)
        if pos == 'verb' and kind == 'passive-n':
            return self.passive(base_word, base, reflexive=True)
        if pos == 'verb' and kind == 'causative':
            return self.causative(base_word, base)
        return None

    def print_senses(self, word):
        """Definition sentences (no examples) of the word's primary explanatory-dictionary entry."""
        if word not in self._senses:
            found = []
            for text, volume, page in self.print.get(key(word), []):
                if EXPLICIT_FROM.match(text) or SEE_ONLY.match(text):
                    continue
                # Only the first homonym: it carries the sense that the atlas definition describes.
                found.append((' '.join(definition_sentences(text)), volume, page))
                break
            self._senses[word] = found
        return self._senses[word]

    def names(self, text, word, base_word):
        """Azerbaijani text about word names base_word, bare or with a case, possessive or plural ending."""
        base = key(base_word)
        if len(base) < 3:
            return False
        stems = {base}
        if base[-1] in 'qk' and not base.endswith(('maq', 'mək')):
            stems.add(base[:-1] + {'q': 'ğ', 'k': 'y'}[base[-1]])
        own = key(word)
        # A verb is also named by its participles and verbal nouns (becərən, üfürücü, açma; edən for etmək).
        verb_stems = []
        if base.endswith(('maq', 'mək')) and len(base) >= 5:
            verb_stems = [base[:-3]] + ([base[:-4] + 'd'] if base[:-3].endswith('t') else [])
        for token in re.findall(r'\w+', key(text)):
            if token.startswith(own) and len(own) > len(base):
                continue
            # A token that is itself another headword (kirə for kir) is not evidence for the base.
            if token != base and token in self.by_key:
                continue
            if any(token.startswith(stem) and token[len(stem):] in INFLECTIONS
                   and (stem == base or token[len(stem):][:1] in VOWELS) for stem in stems):
                return True
            for stem in verb_stems:
                rest = token[len(stem):] if token.startswith(stem) else None
                if rest and (stem == verb_stems[0] or rest[0] in VOWELS) and any(
                        rest.startswith(ending) and rest[len(ending):] in VERB_FORM_TAILS for ending in VERB_ENDINGS):
                    return True
        return False

    def print_mentions(self, word, base_word):
        """The explanatory dictionary's definition of word names base_word (bare or inflected)."""
        for text, volume, page in self.print_senses(word):
            if self.names(text, word, base_word):
                return print_source(volume, page)
        return None

    def mentions(self, word, own, base_word, base):
        text = (own['az'] + ' ' + own['en']).lower()
        g = gloss(base).lower() if base else ''
        whole = lambda term: re.search(r'(?<!\w)' + re.escape(term) + r'(?!\w)', text) is not None
        return whole(base_word.lower()) or (len(g) >= 3 and whole(g)) or self.names(own['az'], word, base_word)

    def usable(self, word):
        node = self.defined(word)
        return node if node and node['pos'] not in ('function', 'form', 'particle') and not word.startswith('-') else None

    def converb_verb(self, piece):
        """The verb of a converb in -ıb (bölüb -> bölmək, döyüb -> döymək, eşidib -> eşitmək, bəzəyib -> bəzəmək)."""
        if not re.search(r'[ıiuü]b$', piece) or len(piece) < 4:
            return None
        stem = piece[:-2]
        stems = [stem]
        if stem.endswith('y') and stem[-2:-1] in VOWELS:
            stems.append(stem[:-1])
        if stem.endswith('d'):
            stems.append(stem[:-1] + 't')
        for candidate in stems:
            verb = candidate + infinitive_ending(candidate)
            node = self.usable(verb)
            if node and node['pos'] == 'verb':
                return verb
        return None

    def verb_of(self, form):
        """(verb, kind, suffix) when form is a verb stem plus an ending: becərən, üfürücü, keçirməz, gəmirinti, baxış."""
        for stem, suffix, kind in verb_splits(form):
            # A stem-final t turns into d before a vowel (edən is etmək + -ən, eşidiş is eşitmək + -iş).
            for candidate in [stem] + ([stem[:-1] + 't'] if stem.endswith('d') and suffix[0] in VOWELS else []):
                verb = candidate + infinitive_ending(candidate)
                if (self.usable(verb) or {}).get('pos') == 'verb':
                    return verb, kind, suffix
        return None

    def governed_noun(self, piece):
        """The headword of a compound's first part, bare or with the case its second part governs (göy-dən, heyvan-a)."""
        node = self.usable(piece)
        if node and node['pos'] != 'verb':
            return piece, None
        for ending in CASE_ENDINGS:
            stem = piece[:-len(ending)]
            if not piece.endswith(ending) or len(stem) < 3:
                continue
            vowel = next(ch for ch in ending if ch in VOWELS)
            if vowel != (h2(stem) if vowel in 'aə' else h4(stem)):
                continue
            # A buffer consonant (y, n) only follows a vowel; a bare vowel ending only follows a consonant.
            if ending[0] in 'yn' and stem[-1] not in VOWELS or ending[0] in VOWELS and stem[-1] in VOWELS:
                continue
            candidates = [stem] + ([stem[:-1] + {'ğ': 'q', 'y': 'k'}[stem[-1]]] if ending[0] in VOWELS and stem[-1] in 'ğy' else [])
            for candidate in candidates:
                node = self.usable(candidate)
                if node and node['pos'] != 'verb':
                    # After a consonant, -ı is either the accusative or the possessive (yal-ı gödək).
                    return candidate, CASE_OF.get(ending, 'accusative or possessive')
        return None, None

    def compound_parts(self, word):
        """Return (parts, kind) for a compound of existing headwords, or None."""
        if re.search(r'[- ]', word):
            parts = []
            for piece in re.split(r'[- ]', word):
                # A paired verb opens with a converb: bölüb-paylamaq is bölmək + paylamaq.
                verb = self.converb_verb(piece) if '-' in word and re.search(r'(?:maq|mək)$', word) else None
                if verb:
                    parts.append(verb)
                    continue
                # Strip a real ending before a lone vowel: babalı is baba + -lı (not babal), kirpisi is kirpi + -si.
                sizes = [2] if piece[-2:] in PAIRED_ENDINGS else []
                sizes += [1, 3] if piece[-1:] in 'ıiuü' else []
                candidates = [piece] + [piece[:-size] for size in sizes if len(piece) - size >= 3]
                found = next((c for c in candidates if len(c) >= 3 and self.usable(c)), None)
                if not found:
                    return None
                parts.append(found)
            return (parts, 'paired' if '-' in word else 'phrase') if len(set(parts)) == len(parts) >= 2 else None
        for prefix, english in PREFIXES.items():
            rest = word[len(prefix):]
            if word.startswith(prefix) and len(rest) >= 4 and self.usable(rest):
                return [prefix, rest], 'prefix'
        # A verb form of an existing headword is not split as a compound (turşulatma is turşulatmaq + -ma); adjective
        # compounds in -lı often are compounds (iri + başlı), so only verbal derivations block the split.
        if any(kind in VERBAL_KINDS for _, kind, _ in self.analyses(word)):
            return None
        # Plant names end in a short possessive head the general split rejects: ilan + ot-u, ayrıq + ot-u, ərik + ağac-ı.
        for ending, head in (('otu', 'ot'), ('ağacı', 'ağac')):
            first = word[:-len(ending)]
            if word.endswith(ending) and len(first) >= 3 and self.usable(head) and (self.usable(first) or {}).get('pos') in ('noun', 'word', 'adjective'):
                return [first, head], 'closed'
        best = None
        for i in range(3, len(word) - 3):
            a, b = word[:i], word[i:]
            if b in SUFFIX_LIKE or len(b) < 4 or (b[0] in VOWELS and len(b) < 6):
                continue
            # A longer headword plus a suffix explains the word better (kontur + -lamaq, not kont + urlamaq).
            if any(word[:j] in self.nodes and word[j:] in DERIVING for j in range(i + 1, len(word) - 2)):
                continue
            # International loans are not split at a short piece (futurologiya is not fut + urologiya).
            if b[0] in VOWELS and len(a) <= 4 and b.endswith(('iya', 'ika')):
                continue
            if self.usable(a) and self.usable(b):
                score = min(len(a), len(b))
                if not best or score > best[0]:
                    best = (score, [a, b])
            elif self.usable(a) and not best:
                # Izafet compounds: the second noun takes the possessive (dəvə + quş-u, yer + fındığ-ı).
                stem = possessive_stem(b)
                if stem and len(stem) >= 3 and len(a) + len(stem) >= 7 and stem not in SUFFIX_LIKE and self.usable(stem) and self.usable(stem)['pos'] in ('noun', 'word'):
                    best = (0, [a, stem])
        if best:
            return best[1], 'closed'
        # The first part is governed by a verb form or a postpositional adjective: gül + becər-ən, hava + üfür-ücü,
        # göy-dən + düşmüş, heyvan-a + oxşar.
        for i in range(3, len(word) - 3):
            a, b = word[:i], word[i:]
            if b in SUFFIX_LIKE or len(b) < 4:
                continue
            noun, case = self.governed_noun(a)
            if not noun:
                continue
            # A short noun with a case ending is too often a chance match in an undefined word (tabasaran is not tab-a saran).
            if case and len(noun) < 4 and self.undefined(word):
                continue
            verb = self.verb_of(b)
            node = self.usable(b)
            second = None
            if verb and len(verb[0]) >= 5:
                second = verb[0]
            elif case and node and node['pos'] != 'verb':
                # A case-marked noun needs a word that governs that case; a possessive one an adjective (yal-ı gödək).
                if b in GOVERNORS.get(case, ()) or 'possessive' in case and node['pos'] == 'adjective':
                    second = b
            if second and second != noun:
                score = min(len(noun), len(b))
                if not best or score > best[0]:
                    best = (score, [noun, second])
                    self.form_kind[word] = verb[1] if verb and second == verb[0] else None
        return (best[1], 'governed') if best else None

    def quantified(self):
        """Quantity word + noun + -lı: çoxbarmaqlı is having many fingers, ikimərtəbəli is having two storeys."""
        for word in list(self.nodes):
            if ' ' in word or '-' in word:
                continue
            own = None if self.undefined(word) else self.defined(word)
            for quantity in sorted(QUANTIFIERS, key=len, reverse=True):
                rest = word[len(quantity):]
                if not word.startswith(quantity) or len(rest) < 5:
                    continue
                # -lı (having: ikimərtəbəli) defines; -lıq (amounting to: dördtonluq) only links a defined word.
                if rest[-2] == 'l':
                    noun, suffix = rest[:-2], 'l' + rest[-1]
                elif own and rest[-3] == 'l' and rest[-1] in 'qk':
                    noun, suffix = rest[:-3], rest[-3:]
                else:
                    continue
                base = self.usable(noun)
                if len(noun) < 3 or not base or base['pos'] not in ('noun', 'word') or suffix[1] != h4(noun):
                    continue
                if own:
                    # A word that already has a definition is linked only when it names the noun (dördtonluq: «… dörd ton olan»).
                    if self.definitions.get(word, {}).get('method') != 'rule' and self.mentions(word, own, noun, base):
                        page = self.nodes[word].get('page')
                        refs = ([spelling_source(page)] if page else []) + [GRAMMAR]
                        self.link(word, noun, 'root', f'Söz yaradıcılığı · {quantity}- + -{suffix}',
                                  f'«{word}» sözü «{noun}» sözündən «{quantity}» sözü və -{suffix} şəkilçisi ilə düzəlir.',
                                  f'{word} is formed from {noun} with {quantity} and the suffix -{suffix}.', refs, 'quantity')
                    break
                az_quantity, en_quantity = QUANTIFIERS[quantity]
                g = gloss(base)
                # English compound adjectives keep the noun singular: two-leaf, ten-foot, multi-block, low-voltage.
                en = f'{en_quantity}-{g}' if re.fullmatch(r'[a-z]+', g) else f"with {dict(multi='many', low='few').get(en_quantity, en_quantity)} {g}"
                page = self.nodes[word].get('page')
                refs = ([spelling_source(page)] if page else []) + [GRAMMAR]
                self.link(word, noun, 'root', f'Söz yaradıcılığı · {quantity}- + -l{rest[-1]}',
                          f'«{word}» sözü «{noun}» sözündən «{quantity}» sözü və -l{rest[-1]} şəkilçisi ilə düzəlir.',
                          f'{word} is formed from {noun} with {quantity} and the suffix -l{rest[-1]}.', refs, 'quantity')
                self.define(word, f'«{quantity}» və «{noun}» sözlərindən düzələn sifət: {az_quantity} {noun} olan.',
                            en, 'adjective', refs, 'rule', base=noun)
                break

    def loan_families(self):
        """Link borrowed words built on one stem (gerontologiya, gerontoloq) and define members that follow from the head."""
        families = collections.defaultdict(set)
        for word in self.nodes:
            if ' ' in word or '-' in word:
                continue
            for index, endings in enumerate(LOAN_FAMILIES):
                ending = next((e for e in sorted(endings, key=len, reverse=True) if word.endswith(e) and len(word) - len(e) >= 3), None)
                if ending:
                    families[index, word[:-len(ending)]].add(word)
                    break
        for (index, stem), words in families.items():
            if len(words) < 2:
                continue
            for word in sorted(words):
                for ending, head_ending, az, en, pos in LOAN_SENSES:
                    head = stem + head_ending
                    if word == stem + ending and head in words and self.undefined(word) and self.usable(head):
                        # -ist is a supporter only of a doctrine; an autist or a bilinqvist has the condition, a latinist
                        # studies Latin.
                        if ending == 'ist' and (head in NOT_DOCTRINES or not gloss(self.defined(head)).endswith('ism')):
                            continue
                        page = self.nodes[word].get('page')
                        refs = ([spelling_source(page)] if page else []) + [GRAMMAR]
                        self.define(word, az.format(head=head), en.format(g=gloss(self.defined(head))), pos, refs, 'rule', base=head)
            ordered = sorted(words, key=lambda w: (not self.defined(w), len(w), w))
            for word in ordered[1:]:
                refs = [spelling_source(self.nodes[w]['page']) for w in (ordered[0], word) if self.nodes[w].get('page')] or [GRAMMAR]
                self.link(word, ordered[0], 'root', 'Alınma söz ailəsi · eyni kök',
                          f'«{word}» və «{ordered[0]}» eyni alınma kökdən düzəlib.',
                          f'{word} and {ordered[0]} are built on the same borrowed stem.', refs, 'loan-family')

    def combining_heads(self):
        """Link a learned compound to its head: dendrofobiya -> fobiya, aqroturizm -> turizm, kardioplastika -> plastika.

        The first part must end in the combining vowel -o- and recur as such before at least three headwords, so an
        accidental -o- (passionarlıq) does not count.
        """
        splits = []
        for word in self.nodes:
            if ' ' in word or '-' in word or len(word) < 9:
                continue
            for i in range(3, len(word) - 5):
                head = word[i:]
                node = self.usable(head) if word[i - 1] == 'o' and head not in FALSE_HEADS else None
                if node and node['pos'] in ('noun', 'word', 'adjective') and len(head) >= 5:
                    splits.append((word, word[:i], head))
                    break
        recurring = collections.Counter(combining for _, combining, _ in splits)
        for word, combining, head in splits:
            if recurring[combining] < 3 or not re.search(r'[aıoueəiöü].*o$', combining):
                continue
            refs = ([spelling_source(self.nodes[word]['page'])] if self.nodes[word].get('page') else []) + [GRAMMAR]
            self.link(word, head, 'topic', f'Mürəkkəb termin · {combining}- + {head}',
                      f'«{word}» sözü «{combining}-» ön hissəsi və «{head}» sözündən ibarətdir.',
                      f'{word} is {combining}- plus {head}.', refs, 'combining')

    def definition_head(self, word, definition):
        """Links a definition gives: the words of a synonym list (Kabus, xəyal) or the head of a descriptive phrase."""
        text = re.sub(r'\([^)]*\)', '', definition['az'])
        clause = re.split(r'(?<=[.!?])\s', text)[0].rstrip('.!?').split(';')[0]
        items = [item.strip() for item in clause.split(',') if item.strip()]
        if not items:
            return []
        if all(len(item.split()) <= 2 for item in items):
            found = [('syn', key(item)) for item in items
                     if key(item) != word and self.usable(key(item)) and key(item) not in GENERIC_HEADS]
            if found:
                return list(dict.fromkeys(found))
        # Azerbaijani phrases are head-final: the last word (possessive removed) of the first item names the class.
        tokens = re.findall(r'[\wçğıöşüə-]+', key(items[0]))
        for index in range(len(tokens) - 1, max(-1, len(tokens) - 3), -1):
            token = tokens[index]
            stem = possessive_stem(token)
            head = next((c for c in (token, stem) if c and self.usable(c)), None)
            if not head:
                # A plural class word: torpaq heyvan-lar-ı, bitişik əkiz-lər.
                head = next((c[:-3] for c in (token, stem) if c and re.search(r'.{3}(?:lar|lər)$', c) and self.usable(c[:-3])), None)
            if not head:
                return []
            # An izafet head carries the possessive even when the bare form is another word: rüşeym qat-ı (not qatı,
            # thick), çoban it-i (not iti, sharp). Not after a possessive form, where it is a predicate: ucu iti (sharp).
            nominal = lambda c: c and (self.usable(c) or {}).get('pos') in ('noun', 'word')
            if (head == token and definition['pos'] == 'noun' and not nominal(token) and index > 0 and stem != token
                    and not (possessive_stem(tokens[index - 1]) != tokens[index - 1] and not self.usable(tokens[index - 1]))):
                stems = [stem] + ([stem[:-1] + {'ğ': 'q', 'y': 'k'}[stem[-1]]] if stem and stem[-1] in 'ğy' else [])
                head = next((c for c in stems if nominal(c)), head)
            if head in KIND_HEADS and index > 0:
                continue
            if head in GENERIC_HEADS or head == word:
                return []
            pos = self.usable(head)['pos']
            if pos != definition['pos'] and not (definition['pos'] == 'noun' and pos == 'word'):
                return []
            return [('genus', head)]
        return []

    def bilingual_references(self):
        """Link a word to the headword its Musayev entry refers it to (qımıldanmaq: «f. bax qımıldamaq»)."""
        for word in list(self.nodes):
            for text, page in self.musayev.get(key(word), []):
                match = BILINGUAL_SEE.match(text.strip())
                if not match:
                    continue
                target = self.by_key.get(key(match[1]))
                if target and target != word:
                    self.link(word, target, 'syn', 'Musayev lüğəti · bax',
                              f'Musayevin lüğəti «{word}» sözü üçün «{target}» sözünə istinad edir.',
                              f'The Musayev dictionary refers {word} to {target}.', [bilingual_source(page)],
                              'bilingual-cross-reference')
                break

    def leading_references(self):
        """Link a word to the headword its only explanatory entry refers its first sense to (geyəcək: «b a x geyim. …»).
        A word with homonym entries is left out: köpük (foam) has a colloquial homonym that refers to qəpik."""
        for word in list(self.nodes):
            entries = self.print.get(key(word), [])
            if len(entries) != 1:
                continue
            text, volume, page = entries[0]
            match = LEADING_SEE.match(text.split('◊')[0].strip())
            target = self.by_key.get(key(match[1])) if match else None
            if target and target != word:
                self.link(word, target, 'syn', 'İzahlı lüğət · bax',
                          f'İzahlı lüğət «{word}» sözü üçün «{target}» sözünə istinad edir.',
                          f'The explanatory dictionary refers {word} to {target}.', [print_source(volume, page)],
                          'cross-reference-lead')

    def original_definition_links(self):
        """Link a still isolated word whose definition came with the atlas (not from this builder) the same way, citing
        that definition's own source: a form-of definition to its headword (şüvən: «alternative form of şivən»), else
        the synonym or class word, else the noun of a relational definition. Form words never head (alternativ, qısaltma)."""
        for word, node in list(self.nodes.items()):
            # A definition that review flagged as doubtful is no ground for a link.
            if (self.degree[word] or word in self.definitions or node.get('review') or not node.get('refs')
                    or not node.get('az', '').strip()):
                continue
            # Leading domain labels are not part of the sense: «kimya. ruterfordium», «biokimyəvi, genetik. nukleotid».
            az = ORIGINAL_LABELS.sub('', node['az'].strip())
            refs, definition = node['refs'], {'az': az, 'en': node.get('en', ''), 'pos': node.get('pos')}
            form = FORM_OF.match(definition['en'].strip())
            if form:
                pieces = form[1].rstrip('.').split()
                target = next((self.by_key[key(' '.join(pieces[:n]))] for n in range(len(pieces), 0, -1)
                               if key(' '.join(pieces[:n])) in self.by_key), None)
                if target and target != word:
                    self.link(word, target, 'syn', 'Tərif · forma', f'Tərifə görə «{word}» «{target}» sözünün başqa forması və ya yazılışıdır.',
                              f'By its definition, {word} is another form or spelling of {target}.', refs, 'original-form')
                continue
            # «Xalyarın Hamamlı və Qax forması»: the dialect form of another word, named after a place (capitalised), so
            # no class word; «idarə forması» (teokratiya) still names one.
            first = re.findall(r'[\wçğıöşüəÇĞIİÖŞÜƏ-]+', re.split(r'[,;.]', re.sub(r'\([^)]*\)', '', az))[0])
            if (len(first) >= 2 and possessive_stem(key(first[-1])) in ('forma', 'variant', 'yazılış', 'yazılma')
                    and first[-2][:1].isupper()):
                continue
            heads = [(kind, other) for kind, other in self.definition_head(word, definition) or self.later_synonyms(word, definition)
                     if other not in FORM_HEADS and not (kind == 'genus' and other in LIGHT_VERBS)]
            for kind, other in heads:
                if kind == 'syn':
                    self.link(word, other, 'syn', 'Tərif · sinonim', f'«{word}» tərifdə «{other}» sözü ilə izah olunur.',
                              f'{word} is defined by the word {other}.', refs, 'original-synonym')
                elif definition['pos'] == 'noun':
                    self.link(word, other, 'topic', 'Tərif · ümumi anlayış', f'Tərifə görə «{word}» bir {other} növüdür.',
                              f'By its definition, {word} is a kind of {other}.', refs, 'original-genus')
                else:
                    self.link(word, other, 'topic', 'Tərif · əsas söz', f'«{word}» tərifdə «{other}» sözü əsasında izah olunur.',
                              f'{word} is defined in terms of {other}.', refs, 'original-genus')
            if not heads:
                for other in self.relation_nouns(word, definition):
                    self.link(word, other, 'topic', 'Tərif · əsas söz', f'«{word}» tərifdə «{other}» sözü əsasında izah olunur.',
                              f'{word} is defined in terms of {other}.', refs, 'original-relation')

    def relation_nouns(self, word, definition):
        """Nouns a relational definition is built on: «Əlkimyaya aid.» -> əlkimya, «Üç sinifdən ibarət.» -> sinif,
        «Toxunma ilə bağlı.» -> toxunma, «Ödü olan.» -> öd, «Tarix və politologiyaya aid.» -> tarix, politologiya."""
        def noun(candidate):
            # A proper noun is written with a capital: Rusiya-ya qarşı.
            real = candidate if candidate in self.nodes else self.by_key.get(key(candidate))
            node = real and self.usable(real)
            ok = node and node['pos'] != 'verb' and real != word and real not in GENERIC_HEADS
            return real if ok else None

        def governed(token, case):
            found, found_case = self.governed_noun(token)
            if found and found_case == case and noun(found):
                return noun(found)
            cases = {'a': 'dative', 'ə': 'dative', 'dan': 'ablative', 'dən': 'ablative', 'da': 'locative', 'də': 'locative'}
            # A plural before the case (mikrolit-lər-ə, hərf-lər-dən), or a possessive with its n (müalicə-si-n-ə, qurşağ-ı-n-a).
            for pattern in (r'^(.{3,}?)(?:lar|lər)(a|ə|dan|dən|da|də)$', r'^(.{2,}?)(?:lar|lər)?(?:s[ıiuü]|[ıiuü])n(a|ə|dan|dən|da|də)$'):
                match = re.match(pattern, token)
                if match and cases[match.group(2)] == case:
                    stem = match.group(1)
                    for candidate in [stem] + ([stem[:-1] + {'ğ': 'q', 'y': 'k'}[stem[-1]]] if stem[-1] in 'ğy' else []):
                        if noun(candidate):
                            return noun(candidate)
            return None

        def possessed(token):
            # «X-ı olan» (having X); a token that is itself a headword (yaxşı olan) is not a possessive form.
            stem = possessive_stem(token)
            if self.usable(token) or not stem or stem == token:
                return None
            for candidate in [stem] + ([stem[:-1] + {'ğ': 'q', 'y': 'k'}[stem[-1]]] if stem[-1] in 'ğy' else []):
                if noun(candidate):
                    return candidate
            return None

        text = re.sub(r'\([^)]*\)', '', definition['az'])
        clause = re.split(r'(?<=[.!?])\s', text)[0].rstrip('.!?').split(';')[0]
        found = []
        for item in [item.strip() for item in clause.split(',') if item.strip()][:2]:
            tokens = re.findall(r'[\wçğıöşüə-]+', key(item))
            having = bool(tokens) and tokens[-1] in ('olan', 'olmayan')
            lacking = having and tokens[-1] == 'olmayan'
            if having:
                tokens = tokens[:-1]
            if having and len(tokens) == 1 and not lacking:
                # «Estoniyadan olan» (from Estonia), «Altda olan» (located below).
                head = governed(tokens[0], 'ablative') or governed(tokens[0], 'locative')
                if head and head not in found:
                    found.append(head)
                continue
            if len(tokens) < 2:
                continue
            if tokens[-1] == 'bağlı' and len(tokens) >= 3 and tokens[-2] == 'ilə':
                head, rest = noun(tokens[-3]), tokens[:-3]
            elif tokens[-1] in GOVERNORS['dative'] | {'bənzəyən', 'oxşayan', 'mənsub'}:
                head, rest = governed(tokens[-2], 'dative'), tokens[:-2]
            elif tokens[-1] in ('ibarət', 'kənar', 'xaric', 'asılı', 'azad'):
                head, rest = governed(tokens[-2], 'ablative'), tokens[:-2]
            elif having:
                head, rest = possessed(tokens[-1]), tokens[:-1]
                # «Mətni tam olan» (whose text is complete): the possessed noun before an adjective.
                if not head and not lacking and len(tokens) >= 2 and (self.usable(tokens[-1]) or {}).get('pos') == 'adjective':
                    head, rest = possessed(tokens[-2]), tokens[:-2]
            else:
                continue
            if not head:
                continue
            group = [head]
            # A case ending covers every noun joined by «və» before it: tarix və politologiya-ya aid.
            while len(rest) >= 2 and rest[-1] == 'və' and noun(rest[-2]):
                group.insert(0, rest[-2])
                rest = rest[:-2]
            found += [other for other in group if other not in found]
        return found

    def later_synonyms(self, word, definition):
        """Synonyms in a later clause of the first sentence: «Gözləri eyni istiqamətə baxmayan; çəpgöz.» -> çəpgöz."""
        text = re.sub(r'\([^)]*\)', '', definition['az'])
        clauses = re.split(r'(?<=[.!?])\s', text)[0].rstrip('.!?').split(';')[1:]
        for clause in clauses:
            items = [key(item.strip()) for item in clause.split(',') if item.strip()]
            if items and all(len(item.split()) <= 2 for item in items):
                found = [('syn', item) for item in items if item != word and self.usable(item) and item not in GENERIC_HEADS]
                if found:
                    return list(dict.fromkeys(found))
        return []

    def definition_links(self):
        """Link a still isolated word to the synonym or class word its own definition is built on (doker: Liman fəhləsi),
        or else to the noun a relational definition is built on (əlkimyəvi: Əlkimyaya aid -> əlkimya)."""
        for word, definition in list(self.definitions.items()):
            if definition.get('method') not in ('paraphrase', 'authored') or self.degree[word]:
                continue
            heads = self.definition_head(word, definition) or self.later_synonyms(word, definition)
            if not heads:
                for other in self.relation_nouns(word, definition):
                    self.link(word, other, 'topic', 'Tərif · əsas söz', f'«{word}» tərifdə «{other}» sözü əsasında izah olunur.',
                              f'{word} is defined in terms of {other}.', definition['refs'], 'definition-relation')
                continue
            for kind, other in heads:
                if kind == 'syn':
                    self.link(word, other, 'syn', 'Tərif · sinonim', f'«{word}» tərifdə «{other}» sözü ilə izah olunur.',
                              f'{word} is defined by the word {other}.', definition['refs'], 'definition-synonym')
                elif definition['pos'] == 'noun':
                    self.link(word, other, 'topic', 'Tərif · ümumi anlayış', f'Tərifə görə «{word}» bir {other} növüdür.',
                              f'By its definition, {word} is a kind of {other}.', definition['refs'], 'definition-genus')
                else:
                    self.link(word, other, 'topic', 'Tərif · əsas söz', f'«{word}» tərifdə «{other}» sözü əsasında izah olunur.',
                              f'{word} is defined in terms of {other}.', definition['refs'], 'definition-genus')

    def compounds(self):
        for word in list(self.nodes):
            # Connected words keep the links they have, except paraphrased ones: a paraphrase replaces the rule definition
            # that would have linked the parts, and each part still has to be named by the paraphrase or the print entry.
            if self.degree[word] and not self.undefined(word) and self.definitions.get(word, {}).get('method') != 'paraphrase':
                continue
            found = self.compound_parts(word)
            if not found:
                continue
            parts, kind = found
            page = self.nodes[word].get('page')
            refs = ([spelling_source(page)] if page else []) + [SPELLING_RULES]
            own = self.defined(word)
            linked = []
            for part in parts:
                if part not in self.nodes:
                    continue
                base = self.defined(part)
                confirmed = None
                if own and self.definitions.get(word, {}).get('method') != 'rule' and not self.mentions(word, own, part, base):
                    confirmed = self.print_mentions(word, part)
                    if not confirmed:
                        continue
                before = len(self.edges)
                self.link(word, part, 'topic', 'Mürəkkəb söz · tərkib hissəsi', f'«{part}» bu mürəkkəb sözün tərkib hissəsidir.',
                          f'{part} is a component of this compound.', refs + ([confirmed] if confirmed else []),
                          'compound-print' if confirmed else 'compound')
                linked.append(len(self.edges) > before)
            if self.undefined(word):
                if kind == 'prefix':
                    prefix, rest = parts
                    g = gloss(self.defined(rest))
                    az = f'«{rest}» sözünə {prefix}- ön hissəsi artırılmaqla düzələn söz.'
                    combining = PREFIXES[prefix]
                    # Glue the combining form only onto a one-word gloss (thermo + nuclear); a phrase gets the prefix named.
                    if ' ' in g and (not combining.endswith(' ') or re.match(r'(?:verbal noun|passive|causative|turn|become|make|be|relating|specialist|supporter|having|without|with)\b', g)):
                        en = ('to ' if self.defined(rest)['pos'] == 'verb' else '') + f"{g}, with the prefix {combining.strip().rstrip('-')}-"
                    else:
                        en = f'{combining}{g}'
                    self.define(word, az, en, self.defined(rest)['pos'] if self.defined(rest)['pos'] in POS else 'noun', refs, 'rule', base=rest)
                else:
                    glosses = [f'{part} ({gloss(self.defined(part))})' for part in parts]
                    names = ' və '.join(f'«{part}»' for part in parts)
                    az = {'paired': f'{names} sözlərindən düzələn qoşa söz.', 'phrase': f'{names} sözlərindən ibarət birləşmə.',
                          'closed': f'{names} sözlərindən düzələn mürəkkəb söz.', 'governed': f'{names} sözlərindən düzələn mürəkkəb söz.'}[kind]
                    en = {'paired': 'paired compound of ', 'phrase': 'phrase made of ', 'closed': 'compound of ',
                          'governed': 'compound of '}[kind] + ' and '.join(glosses)
                    last = self.defined(parts[-1])['pos']
                    pos = 'phrase' if kind == 'phrase' else last if last in POS else 'noun'
                    # A verb as the second part enters as a participle or verbal noun (gülbecərən, hesabaçma).
                    form = self.form_kind.get(word) if kind == 'governed' else None
                    if form:
                        pos = 'noun' if form in ('doer', 'action', 'result', 'verbal-noun') else 'adjective'
                    self.define(word, az, en, pos, refs, 'rule', base=parts[-1])

    def rules(self, define=True):
        for _ in range(4):
            before = len(self.definitions) + len(self.edges)
            for word in list(self.nodes):
                for base_word, kind, suffix in self.analyses(word):
                    # Show verb-forming suffixes without the infinitive ending: -laş, -laşdır, -lan.
                    suffix = suffix[:-3] if kind in ('become', 'make', 'acquire') else suffix
                    base = self.defined(base_word)
                    page = self.nodes[word].get('page')
                    refs = ([spelling_source(page)] if page else []) + [GRAMMAR]
                    if not base:
                        continue
                    made = self.rule_definition(base_word, kind, suffix, base)
                    if not made:
                        continue
                    own = self.defined(word)
                    # An ambiguous suffix needs a definition of the word itself (not a rule's) that names the base.
                    definable = kind not in LINK_ONLY or kind == 'ca' and base['pos'] == 'adjective' and not nationality(base)
                    if not definable and (not own or self.definitions.get(word, {}).get('method') == 'rule'):
                        continue
                    confirmed = None
                    if own and self.definitions.get(word, {}).get('method') != 'rule' and not self.mentions(word, own, base_word, base):
                        confirmed = self.print_mentions(word, base_word)
                        if not confirmed:
                            self.stats['rule:unconfirmed-existing'] += 1
                            continue
                    self.link(word, base_word, 'root', 'Söz yaradıcılığı · -' + suffix,
                              f'«{word}» sözü «{base_word}» sözündən -{suffix} şəkilçisi ilə düzəlir.',
                              f'{word} is formed from {base_word} with the suffix -{suffix}.',
                              refs + ([confirmed] if confirmed else []), 'rule-print' if confirmed else 'rule')
                    if define and self.undefined(word) and definable:
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
    builder.authored()
    for _ in range(6):
        size = len(builder.definitions) + len(builder.edges)
        builder.print_notes()
        builder.rules()
        builder.quantified()
        builder.loan_families()
        builder.combining_heads()
        builder.compounds()
        if len(builder.definitions) + len(builder.edges) == size:
            break
    builder.definition_links()
    builder.bilingual_references()
    builder.leading_references()
    builder.original_definition_links()
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
                  'suffixes of defined base words; authored definitions are AI-written for spellings that neither print '
                  'dictionary covers, cite only the orthography page and are marked for review. Print prose is cited, not republished. This is not native-speaker verification.',
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
