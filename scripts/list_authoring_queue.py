#!/usr/bin/env python3
"""Print headwords that still need an AI-written definition, most useful first.

Usage: python3 scripts/list_authoring_queue.py model.json izahli.sqlite musayev.sqlite [N]

Only spellings with no entry in either print dictionary are listed (those get paraphrases instead) and words
already in scripts/content/print-definitions/authored/ are left out. Order: words whose definition would let the
suffix rules define undefined derivatives (kult -> kultlaşmaq, ...), then words with no connection, then the rest.
"""
import collections
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_print_definitions as b  # noqa: E402

model, explanatory, bilingual = sys.argv[1:4]
limit = int(sys.argv[4]) if len(sys.argv) > 4 else 250
B = b.Builder(json.loads(Path(model).read_text()), sqlite3.connect(f'file:{explanatory}?mode=ro', uri=True),
              sqlite3.connect(f'file:{bilingual}?mode=ro', uri=True))
B.paraphrases()
B.authored()
B.meanings(early=True)
for _ in range(6):
    size = len(B.definitions) + len(B.edges)
    B.print_notes(); B.rules(); B.quantified(); B.loan_families(); B.combining_heads(); B.compounds()
    if len(B.definitions) + len(B.edges) == size:
        break
done = set()
for path in (b.CONTENT / 'authored').glob('batch-*.json'):
    done |= set(json.loads(path.read_text()))
undefined = [w for w in B.nodes if not B.defined(w)]
candidates = [w for w in undefined if w not in done and B.nodes[w].get('page')
              and not B.print.get(b.key(w)) and not B.musayev.get(b.key(w))]
pending = set(undefined)
parent = {}
for word in undefined:
    for base, _, _ in B.analyses(word):
        if base in pending:
            parent[word] = base
            break
children = collections.defaultdict(list)
for word, base in parent.items():
    children[base].append(word)
sizes = {}
def size(word):
    if word not in sizes:
        sizes[word] = sum(1 + size(child) for child in children.get(word, []))
    return sizes[word]
roots = [w for w in candidates if w not in parent]
queue = (sorted((w for w in roots if size(w)), key=lambda w: -size(w))
         + [w for w in roots if not size(w) and not B.degree[w]] + [w for w in roots if not size(w) and B.degree[w]])
print(f'{len(undefined)} undefined, {len(candidates)} without print evidence; next {min(limit, len(queue))}:', file=sys.stderr)
print('\n'.join(queue[:limit]))
