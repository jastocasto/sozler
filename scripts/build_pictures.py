"""Build the picture-quiz data layer.

    python3 scripts/build_pictures.py

Reads scripts/content/pictures/{concepts.tsv, openmoji-picks.json, openmoji.json, drawn.json}
and writes dist/pictures.js and dist/pictures-attribution.json. Pictures are used only on
the picture-quiz page, never in the word map. Every SVG is checked against an allowlist
of drawing elements and attributes, so the page can insert it as markup.
"""
import collections
import csv
import hashlib
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(HERE, 'content', 'pictures')
DIST = os.path.join(HERE, '..', 'dist')

CATEGORIES = [
    ('animals', 'Heyvanlar', 'Animals'),
    ('food', 'Yemək və bitkilər', 'Food and plants'),
    ('things', 'Əşyalar', 'Things'),
    ('people', 'İnsan və bədən', 'People and body'),
    ('places', 'Təbiət və yerlər', 'Nature and places'),
    ('actions', 'Hərəkətlər', 'Actions'),
]
KIND_CATEGORY = {
    'animal': 'animals', 'food': 'food', 'plant': 'food', 'object': 'things', 'material': 'things', 'shape': 'things',
    'colour': 'things', 'person': 'people', 'body': 'people', 'appearance': 'people', 'nature': 'places',
    'weather & light': 'places', 'place': 'places', 'event': 'places', 'activity': 'actions', 'flag': 'things',
}
# Words whose WordNet kind files them in the wrong quiz group.
CATEGORY_OVERRIDES = {
    'animals': 'balina tısbağa qoç suiti porsuq krevet əqrəb qaban donuz delfin camış meduza kalmar omar səkkizayaq '
               'toyuq yumurta bəbir qunduz yenot çay samuru pələng əjdaha yuva',
    'food': 'dən ponçik yolka sümbül bitki',
    'things': 'tor robot aypara üzük qəbz coystik boşqab dron qayka şahmat lent zəncir mismar xətkeş printer bank',
    'people': 'bığ skelet',
    'places': 'günəş vulkan kəhkəşan quyruqlu ulduz dalğa su buz bağ yer kürəsi vahə',
    'actions': 'öpüş',
}
WORD_CATEGORY = {}
for _category, _words in CATEGORY_OVERRIDES.items():
    for _word in re.findall(r'quyruqlu ulduz|çay samuru|yer kürəsi|\S+', _words):
        WORD_CATEGORY[_word] = _category
ELEMENTS = {'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'g'}
ATTRIBUTES = {'d', 'points', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2',
              'transform', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'fill-rule'}
VALUE = re.compile(r'^[0-9a-zA-Z .,\-()#]*$')


def check_svg(markup, concept):
    """Allow only drawing elements with plain geometry values."""
    for tag, attrs in re.findall(r'<\s*/?\s*([a-zA-Z]+)([^>]*)>', markup):
        if tag not in ELEMENTS:
            raise ValueError(f'{concept}: element <{tag}> is not allowed')
        for name, value in re.findall(r'([a-zA-Z][a-zA-Z0-9:-]*)="([^"]*)"', attrs):
            if name not in ATTRIBUTES or not VALUE.match(value):
                raise ValueError(f'{concept}: attribute {name}="{value}" is not allowed')
            if name in ('fill', 'stroke') and value not in ('none', 'currentColor'):
                raise ValueError(f'{concept}: colour {value} must be currentColor or none')
        leftover = re.sub(r'([a-zA-Z][a-zA-Z0-9:-]*)="[^"]*"', '', attrs).replace('/', '').strip()
        if leftover:
            raise ValueError(f'{concept}: unexpected markup {leftover!r}')
    if re.sub(r'<[^>]*>', '', markup).strip():
        raise ValueError(f'{concept}: text content is not allowed')


def main():
    concepts = {row['concept']: row for row in csv.DictReader(open(os.path.join(CONTENT, 'concepts.tsv'), encoding='utf-8'),
                                                               delimiter='\t')}
    picks = json.load(open(os.path.join(CONTENT, 'openmoji-picks.json'), encoding='utf-8'))
    openmoji = json.load(open(os.path.join(CONTENT, 'openmoji.json'), encoding='utf-8'))
    drawn = json.load(open(os.path.join(CONTENT, 'drawn.json'), encoding='utf-8'))
    overlap = set(picks) & set(drawn)
    if overlap:
        raise ValueError(f'concepts drawn twice: {sorted(overlap)}')

    entries = []
    for concept, pick in picks.items():
        entries.append((concept, pick['word'], openmoji[concept], 'openmoji', pick))
    groups = {concept: item['group'] for concept, item in drawn.items() if item.get('group')}
    for concept, item in drawn.items():
        entries.append((concept, item['word'], item['svg'], 'soz', item.get('category')))

    pictures, credits, seen_words, seen_svgs = [], [], set(), {}
    for concept, word, svg, source, pick in sorted(entries, key=lambda e: e[1]):
        row = concepts.get(concept)
        explicit = pick if isinstance(pick, str) else (pick or {}).get('category')
        if row is None and explicit and concept == 'word:' + word:
            # A word-only drawing (an Azerbaijani item the English-based candidate list missed).
            row = {'kind': '', 'words': word}
        if row is None:
            raise ValueError(f'{concept}: not in concepts.tsv')
        if word not in row['words'].split(', '):
            raise ValueError(f'{concept}: {word} is not one of its words')
        if word in seen_words:
            raise ValueError(f'{word}: two pictures')
        seen_words.add(word)
        digest = hashlib.sha256(svg.encode()).hexdigest()
        if digest in seen_svgs:
            raise ValueError(f'{concept}: same drawing as {seen_svgs[digest]}')
        seen_svgs[digest] = concept
        check_svg(svg, concept)
        # Explicit end tags parse the same way in every HTML parser (no reliance on SVG self-closing rules).
        svg = re.sub(r'<([a-z]+)([^<>]*?)\s*/>', r'<\1\2></\1>', svg)
        verb = (row['kind'] not in KIND_CATEGORY and not explicit) or re.search(r'\.v\.\d+$', concept)
        category = explicit or WORD_CATEGORY.get(word) or ('actions' if verb else KIND_CATEGORY[row['kind']])
        pictures.append([word, category, svg, 0 if source == 'openmoji' else 1, *([groups[concept]] if concept in groups else [])])
        credit = {'word': word, 'concept': concept, 'source': source}
        if isinstance(pick, dict):
            credit.update({'openmoji': pick['openmoji'], 'annotation': pick['annotation'], 'author': pick['author']})
        credits.append(credit)

    data = {
        'version': 1,
        'viewBox': '0 0 72 72',
        'categories': [{'id': i, 'label': label, 'en': en} for i, label, en in CATEGORIES],
        'sources': ['OpenMoji', 'SÖZ'],
        'pictures': pictures,
    }
    with open(os.path.join(DIST, 'pictures.js'), 'w', encoding='utf-8') as fh:
        fh.write('window.WORD_WEB_PICTURES=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')

    by_source = collections.Counter(c['source'] for c in credits)
    by_category = collections.Counter(p[1] for p in pictures)
    attribution = {
        'title': 'Picture quiz drawings',
        'use': 'Shown only on the picture-quiz page (#sekil). The word map has no pictures.',
        'pictures': len(pictures),
        'by_source': dict(by_source),
        'by_category': dict(by_category),
        'sources': {
            'openmoji': {
                'name': 'OpenMoji 15.1.0, black (line) set',
                'url': 'https://openmoji.org',
                'license': 'CC BY-SA 4.0',
                'license_url': 'https://creativecommons.org/licenses/by-sa/4.0/',
                'changes': 'Recoloured to currentColor, stroke style moved to the wrapping element, decimals truncated.',
                'count': by_source['openmoji'],
            },
            'soz': {
                'name': 'Line drawings made for SÖZ (scripts/draw_pictures.py)',
                'license': 'CC BY-SA 4.0',
                'method': 'AI-assisted original drawings on the OpenMoji 72 x 72 grid, reviewed on contact sheets.',
                'count': by_source['soz'],
            },
        },
        'selection': ('Candidates come from scripts/build_picture_candidates.py (WordNet category, Brysbaert et al. 2014 '
                      'concreteness ratings, emoji matches). Each OpenMoji match was checked by eye; mismatched senses, '
                      'ambiguous drawings and duplicates were dropped. One word is shown per picture.'),
        'credits': sorted(credits, key=lambda c: c['word']),
    }
    with open(os.path.join(DIST, 'pictures-attribution.json'), 'w', encoding='utf-8') as fh:
        json.dump(attribution, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print(len(pictures), 'pictures', dict(by_source), dict(by_category))


if __name__ == '__main__':
    main()
