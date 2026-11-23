#!/usr/bin/env python3
"""Print headwords whose definition only says how they are built, with the evidence for writing a real meaning.

Usage: python3 scripts/list_meaning_queue.py model.json izahli.sqlite musayev.sqlite [N]

A rule definition such as «istək» və «arzulu» sözlərindən düzələn qoşa söz (or a prefix or -lıq formation) names
the parts, not the sense. Each line shows the word, its parts with their current definitions and any print-dictionary
text, for scripts/content/print-definitions/meanings/batch-NN.json. Frequent words come first, then paired words,
compounds, phrases, -lıq nouns and prefixed words. Words already in a meanings batch are left out.
"""
import json
import re
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_print_definitions as b  # noqa: E402

model, explanatory, bilingual = sys.argv[1:4]
limit = int(sys.argv[4]) if len(sys.argv) > 4 else 150
B = b.Builder(json.loads(Path(model).read_text()), sqlite3.connect(f'file:{explanatory}?mode=ro', uri=True),
              sqlite3.connect(f'file:{bilingual}?mode=ro', uri=True))
B.paraphrases()
B.authored()
for _ in range(6):
    size = len(B.definitions) + len(B.edges)
    B.print_notes(); B.rules(); B.quantified(); B.loan_families(); B.combining_heads(); B.compounds()
    if len(B.definitions) + len(B.edges) == size:
        break
KINDS = [('paired', 'qoşa söz.'), ('compound', 'mürəkkəb söz.'), ('phrase', 'ibarət birləşmə.'), ('lıq', 'şəkilçisi ilə düzələn isim.'),
         ('prefix', 'ön hissəsi artırılmaqla düzələn söz.')]
rank = {}
for line in (b.ROOT / 'scripts/content/frequency/headword-frequency.tsv').read_text().splitlines():
    if line and not line.startswith('#'):
        fields = line.split('\t')
        rank[fields[1]] = int(fields[0])
rows = []
for word, d in B.definitions.items():
    if d['method'] != 'rule' or word in B.meaning_entries or not b.FORMATION_ONLY.search(d['az']):
        continue
    kind = next(i for i, (_, ending) in enumerate(KINDS) if d['az'].endswith(ending))
    rows.append((rank.get(word, 10 ** 9), kind, word, d))
rows.sort()
def gloss(word):
    d = B.definitions.get(word) or B.nodes.get(word) or {}
    return f"{(d.get('az') or '')[:90]} / {(d.get('en') or '')[:60]}"
print(f'{len(rows)} formation-only definitions left; next {min(limit, len(rows))}:', file=sys.stderr)
for _, kind, word, d in rows[:limit]:
    k = b.key(word)
    line = f"{word} [{d['pos']}, {KINDS[kind][0]}] = " + ' + '.join(f'{p} ({gloss(p)})' for p in re.findall(r'«([^»]+)»', d['az']))
    izahli = ' '.join(t for t, *_ in B.print.get(k, []))[:220]
    musayev = ' '.join(t for t, *_ in B.musayev.get(k, []))[:160]
    print(line + (f' || IZAHLI: {izahli}' if izahli else '') + (f' || MUSAYEV: {musayev}' if musayev else ''))
