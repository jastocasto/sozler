"""List headwords whose meaning can be shown with a picture or icon.

    node scripts/export_print_definition_model.cjs model.json
    NLTK_DATA=/path/to/nltk_data python3 scripts/build_picture_candidates.py model.json \
        Concreteness_ratings_Brysbaert_et_al_BRM.txt emojibase-data-16.0.3-en.json

Inputs (none are committed; all are public). Fetch with curl, e.g.:
  https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip  (unzip into nltk_data/corpora)
  https://raw.githubusercontent.com/ArtsEngine/concreteness/master/Concreteness_ratings_Brysbaert_et_al_BRM.txt
  https://cdn.jsdelivr.net/npm/emojibase-data@16.0.3/en/data.json

  - model.json: the atlas export above (every headword with its bilingual definition).
  - WordNet 3.0 through NLTK (`wordnet` corpus): the lexicographer file of the English
    sense (noun.animal, noun.artifact, verb.motion, ...).
  - Brysbaert, Warriner & Kuperman (2014), "Concreteness ratings for 40 thousand
    generally known English word lemmas", Behavior Research Methods 46: 904-911.
    1 = abstract, 5 = concrete (experienced through the senses).
  - emojibase-data 16.0.3 (MIT), English labels and tags, to show which concepts
    already have an open-licence pictogram.

The English gloss is reduced to one head term (articles, the infinitive "to" and
relative clauses removed). The term's WordNet category and concreteness decide the
tier. When the head was cut out of a longer description ("a plucked string
instrument" -> instrument), the word is marked `specific`: it needs its own
picture rather than a shared generic one. This is a candidate list for human
review, not a claim about every sense of the Azerbaijani word.

Outputs in scripts/content/pictures/:
  candidates.tsv   one row per headword in tier A or B
  concepts.tsv     one row per picture to make; synonyms share a picture
  summary.json     counts
"""
import collections
import csv
import json
import os
import re
import sys

from nltk.corpus import wordnet as wn

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'content', 'pictures')

NOUN_KIND = {
    'noun.animal': 'animal', 'noun.plant': 'plant', 'noun.food': 'food', 'noun.body': 'body',
    'noun.artifact': 'object', 'noun.object': 'nature', 'noun.substance': 'material',
    'noun.person': 'person', 'noun.phenomenon': 'weather & light', 'noun.shape': 'shape',
    'noun.location': 'place', 'noun.event': 'event', 'noun.act': 'activity',
}
VERB_KIND = {
    'verb.motion': 'movement', 'verb.contact': 'handling', 'verb.consumption': 'eating & drinking',
    'verb.body': 'body action', 'verb.weather': 'weather', 'verb.creation': 'making',
    'verb.competition': 'sport & fight', 'verb.perception': 'senses', 'verb.communication': 'speaking & writing',
    'verb.social': 'social action', 'verb.change': 'change', 'verb.possession': 'giving & taking',
    'verb.stative': 'position', 'verb.cognition': 'learning', 'verb.emotion': 'feeling',
}
# Categories where one clear picture is the norm.
STRONG_NOUN = {'noun.animal', 'noun.plant', 'noun.food', 'noun.body', 'noun.artifact', 'noun.object',
               'noun.person', 'noun.phenomenon', 'noun.shape', 'noun.substance'}
TANGIBLE_NOUN = {'noun.animal', 'noun.plant', 'noun.food', 'noun.body', 'noun.artifact', 'noun.object'}
STRONG_VERB = {'verb.motion', 'verb.contact', 'verb.consumption', 'verb.body', 'verb.weather',
               'verb.creation', 'verb.competition', 'verb.perception'}
SECONDARY_VERB = {'verb.communication', 'verb.possession', 'verb.change', 'verb.social', 'verb.stative'}
# Everyday actions that pictogram sets routinely draw although the norms rate them
# below the cut-off (read 3.56, open 3.21, ...). Editorial, kept short.
ACTION_ALLOW = {'read', 'open', 'close', 'shut', 'give', 'take', 'buy', 'sell', 'pay', 'call', 'teach', 'learn',
                'study', 'wait', 'help', 'count', 'greet', 'wave', 'point', 'search', 'meet', 'win', 'pray',
                'listen', 'look', 'watch', 'send', 'lock', 'unlock', 'pour', 'fill', 'empty', 'grow', 'plant'}
COLOURS = {'red', 'blue', 'green', 'yellow', 'black', 'white', 'grey', 'gray', 'brown', 'orange', 'purple',
           'pink', 'violet', 'golden', 'gold', 'silver', 'crimson', 'scarlet', 'turquoise', 'beige', 'navy',
           'azure', 'lilac', 'maroon', 'emerald', 'indigo', 'dark blue', 'light blue', 'sky-blue', 'sky blue',
           'dark red', 'light green', 'dark green', 'cherry red', 'reddish', 'bluish', 'greenish', 'yellowish',
           'blackish', 'whitish', 'greyish', 'brownish', 'rosy', 'ginger', 'chestnut', 'auburn', 'olive'}
SHAPES = {'round', 'square', 'triangular', 'oval', 'circular', 'rectangular', 'spherical', 'curved', 'straight',
          'crooked', 'spiral', 'cubic', 'conical', 'cylindrical', 'striped', 'spotted', 'zigzag', 'pointed', 'hollow'}
# Clusters of the atlas that hold mostly concrete words (dist/galaxy-data.js).
CONCRETE_CLUSTERS = {'animals', 'plants', 'land', 'sky', 'body', 'health', 'family', 'occupations', 'home', 'food',
                     'clothes', 'travel', 'objects', 'play', 'music', 'colours', 'shape', 'movement', 'create',
                     'engineering', 'digital', 'places'}
SKIP_METHODS = {'rule', 'derivation'}  # formation notes, not lexical meanings
SKIP_GLOSS = re.compile(r'^(?:verbal noun|passive of|causative of|diminutive of|participle of|alternative|obsolete|'
                        r'archaic|dialectal|plural of|form of|the name of the|abbreviation|initialism|in |of )')
LEADING = re.compile(r'^(?:(?:to be|to|an?|the|one who|someone who|something that|a kind of|a type of|kind of|'
                     r'type of|sort of|species of|genus of|any of several|any of various|any|also|small|large|'
                     r'little|big|old|traditional|common|ordinary|certain|various|piece of)\s+)+')
CLAUSE = re.compile(r'\b(?:that|which|who|whose|where|when|how|what|is|are|was|used|made|consisting|having|with|for|'
                    r'of|in|on|from|by|as|at|into|to|without|between|after|before|about|under|over|through|against|'
                    r'than|via|along|around|during|within|like|such|suited|known|called|found|growing|living|'
                    r'belonging|related|relating|resembling|esp|especially|usually|typically|often|etc|e\.g|i\.e)\b')
# Glosses a learner's picture should not illustrate.
UNSUITABLE = re.compile(r'\b(?:vulgar|obscene|slang|abusive|offensive|derogatory|pejorative|euphemism|taboo|insult|'
                        r'masturbat\w*|jerk off|genital\w*|penis|vagina|vulva|testic\w*|scrotum|clitoris|copulat\w*|'
                        r'sexual|intercourse|prostitut\w*|dick|pussy|erection|semen|sperm|orgasm|brothel|condom)\b')
# Adjectives whose concrete-sounding English head is a different, abstract sense here.
ADJ_STOP = {'human', 'civilian', 'joint', 'material', 'decimal', 'net', 'chief', 'mercenary', 'uniform', 'thyroid',
            'adult', 'fluid', 'plane', 'surface', 'cross', 'solid', 'concrete', 'light', 'fundamental', 'male',
            'female', 'hermaphrodite', 'marsupial', 'submarine', 'antarctic', 'arctic'}


def clean(text):
    text = re.sub(r'\([^)]*\)', ' ', text.lower())
    text = re.sub(r'\[[^\]]*\]', ' ', text)
    text = re.sub(r'\b(?:chem|bot|zool|med|anat|tech|mil|mus|dial|colloq|fig|hist|obs|arch)\.\s*', ' ', text)
    return re.sub(r'\s+', ' ', text).strip(' .;:!?"\'')


def lemma(term, pos):
    if ' ' in term:
        return term
    return wn.morphy(term, pos) or term


def head_terms(sense, pos):
    """(term, specific) pairs for one sense, most literal first."""
    out = []

    def add(term, specific):
        term = term.strip(' -')
        if len(term) > 2 and term not in [t for t, _ in out]:
            out.append((term, specific))

    parts = sense.split(':', 1) if ':' in sense else [sense]
    for p_index, part in enumerate(parts):
        described = p_index > 0  # "Extrusion: shaping material ..." -> the label is the translation
        for alt in part.split(',')[:3]:
            alt = LEADING.sub('', alt.strip()).strip()
            cut = (CLAUSE.split(alt)[0].strip() or alt).strip()
            words = cut.split()
            # "a person traveling into space" -> person; keep "sewing machine", "ice skating rink".
            for i, word in enumerate(words[1:], 1):
                if re.search(r'(?:ing|ed)$', word) and len(words) - i >= 3 - (i > 1):
                    words = words[:i]
                    cut = ' '.join(words)
                    break
            if not words:
                continue
            long_gloss = described or cut != alt or len(alt.split()) > 4
            pieces = [p.strip() for p in re.split(r' or | and |/', cut) if p.strip()]
            coordinated = len(pieces) > 1 and len({len(p.split()) for p in pieces}) == 1
            if coordinated:  # "table or desk", "run or dash"
                for piece in pieces:
                    add(lemma(piece, pos), long_gloss)
                    if len(piece.split()) > 1:
                        add(lemma(piece.split()[0 if pos == 'v' else -1], pos), True)
                continue
            add(lemma(cut, pos), long_gloss)
            if len(words) > 1:
                add(lemma(words[0] if pos == 'v' else words[-1], pos), True)
    return out


def senses(en):
    """The first sense, plus later senses that are short translations (\"hour; clock\")."""
    out = [clean(s) for s in en.split(';') if clean(s)]
    return out[:1] + [s for s in out[1:3] if len(LEADING.sub('', s).split()) <= 3]


def pick_synset(term, pos, strong, specific=False):
    """The most frequent WordNet sense; for a literal gloss, a tangible sense among the first
    three wins (book: written work -> bound object). Named individuals are ignored."""
    synsets = [s for s in wn.synsets(term.replace(' ', '_'), pos=pos) if not s.instance_hypernyms()]
    if not synsets:
        return None
    if specific or synsets[0].lexname() in strong:
        return synsets[0]
    tangible = TANGIBLE_NOUN if pos == 'n' else strong
    for syn in synsets[1:3]:
        if syn.lexname() in tangible:
            return syn
    return synsets[0]


def load_concreteness(path):
    table = {}
    with open(path, encoding='utf-8') as fh:
        for row in csv.DictReader(fh, delimiter='\t'):
            try:
                table[row['Word'].lower()] = (float(row['Conc.M']), int(float(row['SUBTLEX'] or 0)))
            except (KeyError, ValueError):
                continue
    return table


# Canonical pictogram for very common heads, where label matching picks an odd one
# ("car" -> "tram car"). Only a hint for the drawing step.
EMOJI_PREFER = {'car': 'automobile', 'tree': 'deciduous tree', 'tea': 'teacup without handle', 'moon': 'crescent moon',
                'water': 'droplet', 'hand': 'raised hand', 'ball': 'soccer ball', 'sea': 'water wave',
                'drink': 'cup with straw', 'light': 'light bulb', 'rice': 'cooked rice', 'juice': 'beverage box',
                'flower': 'blossom', 'clock': 'mantelpiece clock', 'book': 'closed book', 'fish': 'fish',
                'bird': 'bird', 'boat': 'sailboat', 'bus': 'bus', 'train': 'locomotive', 'shoe': "man's shoe",
                'hat': 'billed cap', 'key': 'key', 'phone': 'mobile phone', 'star': 'star', 'cloud': 'cloud'}
# Words to look at before drawing: anatomy and bodily functions a learner's app may
# show differently or not at all.
SENSITIVE = {'anus', 'buttock', 'buttocks', 'breast', 'nipple', 'groin', 'fart', 'urinate', 'defecate', 'excrement',
             'feces', 'urine', 'bra', 'menstruation', 'pubis', 'naked', 'nude', 'pregnant', 'piss', 'shit', 'poop',
             'gallows', 'corpse', 'coffin', 'gun', 'pistol', 'rifle', 'bullet', 'bomb', 'grenade', 'knife'}


class EmojiIndex:
    def __init__(self, path):
        self.by_word = collections.defaultdict(list)
        self.by_tag = collections.defaultdict(list)
        self.flags = {}
        for item in json.load(open(path, encoding='utf-8')):
            group = item.get('group')
            if group in (2, None):
                continue
            label = item['label'].lower()
            entry = (item['emoji'], item['label'], item['hexcode'], group, item.get('order', 9999))
            if label.startswith('flag: '):
                self.flags[label[6:]] = entry
                continue
            for word in re.findall(r"[a-z'-]+", label):
                self.by_word[word].append(entry)
            for tag in item.get('tags', []):
                self.by_tag[tag.lower()].append(entry)

    @staticmethod
    def _rank(entry, term):
        label = entry[1].lower()
        words = label.split()
        gendered = words[0] in ('man', 'woman', 'men', 'women', 'boy', 'girl') and term not in words[:1]
        return (0 if label == term else 1 if words[-1] == term else 2, gendered, len(words), entry[4])

    def match(self, terms):
        for term in terms:
            prefer = EMOJI_PREFER.get(term)
            hit = prefer and next((e for e in self.by_word.get(prefer.split()[-1], []) if e[1].lower() == prefer), None)
            if hit:
                return hit, 'exact'
        best = None
        for term in terms:
            if not term or ' ' in term:
                hits = [e for e in self.by_word.get(term.split()[-1], []) if e[1].lower() == term] if term else []
            else:
                hits = self.by_word.get(term, [])
            for entry in hits:
                rank = self._rank(entry, term)
                if rank[0] < 2 and (best is None or rank < best[0]):
                    best = (rank, entry, 'exact' if rank[0] == 0 else 'head')
        if best:
            return best[1], best[2]
        return None, ''  # tag-only matches ("table" -> ping pong) mislead more than they help


def classify(node, wpos, conc):
    """Return (term, synset, lexname, kind, tier, specific) or None."""
    pos = node['pos']
    for s_index, sense in enumerate(senses(node['en'])):
        for term, specific in head_terms(sense, 'v' if wpos == 'v' else 'n'):
            c = conc.get(term)
            score = c[0] if c else None
            if wpos == 'a':
                if term in COLOURS:
                    return term, None, 'adj.colour', 'colour', 'A', False, score
                if term in SHAPES:
                    return term, None, 'adj.shape', 'shape', 'B', False, score
                if (score is not None and score >= 4.2 and wn.synsets(term, pos='a') and not specific
                        and term not in ADJ_STOP):
                    return term, None, 'adj.quality', 'appearance', 'B', False, score
                continue
            if wpos == 'n':
                syn = pick_synset(term, 'n', STRONG_NOUN, specific)
                if syn is None and pos == 'word':
                    syn = pick_synset(term, 'v', STRONG_VERB, specific)
                    if syn is not None:
                        wpos = 'v'
                if syn is None:
                    continue
            else:
                syn = pick_synset(term, 'v', STRONG_VERB, specific)
                if syn is None:
                    continue
            lex = syn.lexname()
            if lex.startswith('noun.'):
                kind = NOUN_KIND.get(lex)
                tier = None
                if kind and lex in STRONG_NOUN and score is not None and score >= 4.3:
                    tier = 'A'
                elif kind and lex in STRONG_NOUN and score is not None and score >= 3.7:
                    tier = 'B'
                elif kind and score is None and lex in TANGIBLE_NOUN:
                    tier = 'B'  # specialised item outside the norms: photo or diagram
                elif kind and score is not None and score >= 4.5:
                    tier = 'B'  # concrete place, event or activity
            else:
                kind = VERB_KIND.get(lex, lex.split('.')[1])
                base = term.split()[0]
                tier = None
                if lex in STRONG_VERB and score is not None and score >= 4.0:
                    tier = 'A'
                elif base in ACTION_ALLOW:
                    tier = 'A' if s_index == 0 else 'B'
                elif score is not None and (score >= 4.2 or score >= 3.6 and lex in STRONG_VERB
                                            or score >= 3.9 and lex in SECONDARY_VERB):
                    tier = 'B'
            if tier:
                if tier == 'A' and (s_index > 0 or specific and lex.startswith('verb.')):
                    # Only a secondary sense is drawable, or the verb heads a longer phrase
                    # ("strike a bargain"): check the picture fits the meaning.
                    tier = 'B'
                return term, syn, lex, kind, tier, specific, score
            # The first literal term resolved but is not drawable: stop on this sense
            # rather than reach for a concrete-sounding modifier.
            if not specific:
                break
    return None


def main(model_path, conc_path, emoji_path):
    model = json.load(open(model_path, encoding='utf-8'))
    conc = load_concreteness(conc_path)
    emoji = EmojiIndex(emoji_path)

    galaxy_src = open(os.path.join(HERE, '..', 'dist', 'galaxy-data.js'), encoding='utf-8').read()
    galaxy = json.loads(galaxy_src[galaxy_src.index('{'):galaxy_src.rindex('}') + 1])
    clusters = {p[0]: galaxy['clusters'][p[4]]['id'] for p in galaxy['points']}
    quiz = set()
    with open(os.path.join(HERE, 'quiz-content.tsv'), encoding='utf-8') as fh:
        for row in csv.reader(fh, delimiter='\t'):
            if row:
                quiz.add(row[0])
                if len(row) > 1:
                    quiz.update(w.strip() for w in row[1].split(','))

    rows = []
    for node in model['nodes']:
        en, pos = (node.get('en') or '').strip(), node['pos']
        if (not en or node.get('method') in SKIP_METHODS or SKIP_GLOSS.match(en.lower())
                or UNSUITABLE.search(en.lower())):
            continue
        wpos = {'noun': 'n', 'word': 'n', 'verb': 'v', 'adjective': 'a'}.get(pos)
        if not wpos:
            continue
        cluster = clusters.get(node['w'], '')
        core = 'page' not in node
        flag = None
        if wpos == 'n' and cluster == 'places':
            for term, _ in head_terms(senses(en)[0], 'n') if senses(en) else []:
                flag = emoji.flags.get(term)
                if flag:
                    break
        if flag:
            term, syn, lex, kind, tier, specific, score = term, None, 'flag', 'flag', 'A', False, None
            glyph, how = flag, 'exact'
        else:
            found = classify(node, wpos, conc)
            if not found:
                continue
            term, syn, lex, kind, tier, specific, score = found
            if tier == 'B' and cluster in CONCRETE_CLUSTERS and score is not None and score >= 4.2:
                tier = 'A'
            emoji_terms = [term]
            if lex.startswith('verb.') and node.get('verbForms', {}).get('base', '').split()[:1] == term.split()[:1]:
                emoji_terms.append(node['verbForms']['ing'].split()[0])
            # A described, specific item ("a plucked string instrument") has no generic pictogram.
            glyph, how = (None, '') if specific else emoji.match(emoji_terms)
        c = conc.get(term)
        priority = 1 if node['w'] in quiz else 2 if core and tier == 'A' else 3 if core else 4
        rows.append({
            'word': node['w'], 'pos': pos, 'en': en, 'term': term, 'specific': 'yes' if specific else '',
            'tier': tier, 'kind': kind, 'sensitive': 'yes' if term in SENSITIVE or term.split()[-1] in SENSITIVE else '',
            'wordnet': syn.name() if syn else '', 'lexname': lex,
            'concreteness': f'{score:.2f}' if score is not None else '', 'english_frequency': c[1] if c else 0,
            'cluster': cluster, 'source': 'core' if core else 'orthography', 'degree': node.get('degree', 0),
            'emoji': glyph[0] if glyph else '', 'emoji_name': glyph[1] if glyph else '',
            'emoji_hex': glyph[2] if glyph else '', 'emoji_match': how, 'priority': priority,
        })

    rows.sort(key=lambda r: (r['priority'], r['tier'], -r['english_frequency'], -r['degree'], r['word']))
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'candidates.tsv'), 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, list(rows[0].keys()), delimiter='\t', lineterminator='\n')
        w.writeheader()
        w.writerows(rows)

    # One picture per concept. Specific items (a described head) get their own picture.
    concepts = collections.OrderedDict()
    for r in rows:
        key = ('word:' + r['word']) if r['specific'] else (r['wordnet'] or f"{r['kind']}:{r['term']}")
        c = concepts.setdefault(key, {'concept': key, 'term': r['term'] if not r['specific'] else r['en'][:80],
                                      'kind': r['kind'], 'tier': r['tier'], 'priority': r['priority'],
                                      'emoji': r['emoji'], 'emoji_name': r['emoji_name'], 'match': r['emoji_match'],
                                      'freq': r['english_frequency'], 'words': []})
        c['words'].append(r['word'])
        c['tier'] = min(c['tier'], r['tier'])
        c['priority'] = min(c['priority'], r['priority'])

    def route(c):
        if c['kind'] == 'colour':
            return 'swatch'
        if c['kind'] == 'flag':
            return 'flag'
        if c['match'] in ('exact', 'head') and not c['concept'].startswith('word:'):
            return 'pictogram-set'
        if c['kind'] in ('animal', 'plant') or c['concept'].startswith('word:') and c['kind'] in ('food', 'nature'):
            return 'photo'
        return 'custom-icon'

    for c in concepts.values():
        c['route'] = route(c)
    ordered = sorted(concepts.values(), key=lambda c: (c['priority'], c['tier'], -c['freq'], c['concept']))
    with open(os.path.join(OUT, 'concepts.tsv'), 'w', encoding='utf-8', newline='') as fh:
        w = csv.writer(fh, delimiter='\t', lineterminator='\n')
        w.writerow(['concept', 'term', 'kind', 'tier', 'priority', 'route', 'emoji', 'emoji_name', 'emoji_match',
                    'word_count', 'words'])
        for c in ordered:
            w.writerow([c['concept'], c['term'], c['kind'], c['tier'], c['priority'], c['route'], c['emoji'],
                        c['emoji_name'], c['match'], len(c['words']), ', '.join(c['words'])])

    def count(items, key):
        return dict(collections.Counter(key(x) for x in items).most_common())
    summary = {
        'headwords_considered': len(model['nodes']),
        'candidates': len(rows),
        'by_tier': count(rows, lambda r: r['tier']),
        'by_priority': count(rows, lambda r: r['priority']),
        'by_source': count(rows, lambda r: r['source']),
        'by_kind': count(rows, lambda r: r['kind']),
        'concepts': len(concepts),
        'concepts_by_tier': count(concepts.values(), lambda c: c['tier']),
        'concepts_by_route': count(concepts.values(), lambda c: c['route']),
        'concepts_by_priority': count(concepts.values(), lambda c: c['priority']),
        'priority_key': {'1': 'word in the quiz', '2': 'core dictionary, tier A', '3': 'core dictionary, tier B',
                         '4': 'orthography-dictionary headword'},
        'tier_key': {'A': 'clearly drawable', 'B': 'probably drawable; check before drawing'},
    }
    with open(os.path.join(OUT, 'summary.json'), 'w', encoding='utf-8') as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main(*sys.argv[1:4])
