"""Normalise the OpenMoji line drawings chosen for the picture quiz.

    python3 scripts/import_openmoji.py OPENMOJI_BLACK_SVG_DIR

OPENMOJI_BLACK_SVG_DIR holds <HEXCODE>.svg files from OpenMoji 15.1.0's black (line)
set, for example fetched with
    curl -o DIR/1F34E.svg https://cdn.jsdelivr.net/npm/openmoji@15.1.0/black/svg/1F34E.svg
for every `openmoji` code in scripts/content/pictures/openmoji-picks.json.

Each drawing keeps its geometry. Colours become currentColor, stroke style moves to the
wrapping <svg>, decimals are truncated to two places, and ids are dropped. Output:
scripts/content/pictures/openmoji.json {concept: inner SVG}. OpenMoji, CC BY-SA 4.0.
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
PICKS = os.path.join(HERE, 'content', 'pictures', 'openmoji-picks.json')
OUT = os.path.join(HERE, 'content', 'pictures', 'openmoji.json')
NS = '{http://www.w3.org/2000/svg}'
SHAPES = {'path', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'rect'}
GEOMETRY = ('d', 'points', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'transform')


def trunc(value):
    # Truncation only removes trailing digits, so token boundaries in path data
    # (including compact arc flags) are unchanged.
    return re.sub(r'(\d*\.\d{2})\d+', r'\1', value)


def normalise(text):
    root = ET.fromstring(text)
    out = []

    def walk(element, inherited):
        tag = element.tag.replace(NS, '')
        style = dict(inherited)
        for key in ('fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'fill-rule'):
            if key in element.attrib:
                style[key] = element.attrib[key]
        if tag in SHAPES:
            attrs = [f'{k}="{trunc(element.attrib[k])}"' for k in GEOMETRY if k in element.attrib]
            fill = style.get('fill', 'black' if tag != 'line' else 'none')
            stroke = style.get('stroke', 'none')
            if fill in ('none', 'transparent') and stroke in ('none', 'transparent'):
                return
            if fill not in ('none', 'transparent'):
                attrs.append('fill="currentColor"')
            if stroke in ('none', 'transparent'):
                attrs.append('stroke="none"')
            elif style.get('stroke-width', '2') not in ('2', '2.0'):
                attrs.append(f'stroke-width="{style["stroke-width"]}"')
            if 'stroke-dasharray' in style:
                attrs.append(f'stroke-dasharray="{style["stroke-dasharray"]}"')
            if 'fill-rule' in style and fill != 'none':
                attrs.append(f'fill-rule="{style["fill-rule"]}"')
            out.append(f'<{tag} ' + ' '.join(attrs) + '/>')
        for child in element:
            child_tag = child.tag.replace(NS, '')
            if child_tag == 'g' and 'transform' in child.attrib:
                start = len(out)
                walk(child, style)
                inner = ''.join(out[start:])
                del out[start:]
                if inner:
                    out.append(f'<g transform="{trunc(child.attrib["transform"])}">{inner}</g>')
            elif child_tag in SHAPES or child_tag == 'g':
                walk(child, style)

    walk(root, {})
    return ''.join(out)


def main(svg_dir):
    picks = json.load(open(PICKS, encoding='utf-8'))
    result = {}
    for concept, pick in sorted(picks.items()):
        with open(os.path.join(svg_dir, pick['openmoji'] + '.svg'), encoding='utf-8') as fh:
            result[concept] = normalise(fh.read())
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(result, fh, ensure_ascii=False, indent=0, sort_keys=True)
        fh.write('\n')
    print(len(result), 'drawings ->', OUT)


if __name__ == '__main__':
    main(sys.argv[1])
