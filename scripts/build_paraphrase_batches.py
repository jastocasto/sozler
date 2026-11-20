#!/usr/bin/env python3
"""Write the evidence batches that AI-assisted paraphrasing works from.

Each batch is JSONL, one undefined spelling headword per line, with the first
sentence of up to three senses from the explanatory dictionary (izahli) and
Musayev's English entry.  The batches contain print excerpts, so they are
written to a local directory (default: a temporary folder), never committed.
Batch boundaries are deterministic: batch-NN.jsonl always holds the same words
as scripts/content/print-definitions/paraphrases/batch-NN.json.

    python3 scripts/build_paraphrase_batches.py izahli.sqlite musayev.sqlite --out /tmp/evidence
"""
import argparse
import collections
import json
import math
import re
import sqlite3
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCHES = 64


def load_js(path):
    text = path.read_text(encoding='utf-8')
    return json.loads(text[text.index('=') + 1:].rstrip().rstrip(';'))


def key(word):
    return unicodedata.normalize('NFC', word).translate(str.maketrans('İI', 'iı')).lower()


DERIV = re.compile(r'^"[^"]+"\s*-?\s*(?:dan|dən|ın|in|un|ün)?')
SEEONLY = re.compile(r'^(?:\S+\.\s*)*b\s*a\s*x\s+[^.;]+\.?$')
UP = 'A-ZÇĞIİÖŞÜƏ'

def senses(text, limit=3):
    text=text.split('◊')[0]
    head=re.match(r'^((?:\[[^\]]{0,120}\]\s*|[a-zçğıöşüə.]{1,8}\.\s*|və\s+)*)',text)
    labels=head[1].strip(); body=text[len(head[1]):]
    parts=re.split(r'(?:^|\s)(\d{1,2})\.\s',body)
    chunks=[parts[0]]+[parts[i+1] for i in range(1,len(parts)-1,2)]
    out=[]
    for c in chunks:
        c=c.strip()
        if not c: continue
        c=re.sub(r'^((?:[a-zçğıöşüə]{1,8}\.\s*)+)','',c)
        first=re.split(r'(?<=[.;?!])\s+(?=[%s–\[]|"\S)'%UP,c)[0]
        first=first[:220]
        if first: out.append(first)
        if len(out)>=limit: break
    return labels, out


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('explanatory', type=Path)
    parser.add_argument('bilingual', type=Path)
    parser.add_argument('--out', type=Path, default=Path('/tmp/soz-evidence'))
    args = parser.parse_args()
    spellings = load_js(ROOT / 'dist/orthography.js')['entries']
    lexical = load_js(ROOT / 'dist/orthography-lexical.js')
    undefined = [(w, p) for w, p in spellings if not (lexical['definitions'].get(w) or {}).get('en')]
    iz = collections.defaultdict(list)
    for h, k, hom, t, v, p in sqlite3.connect(args.explanatory).execute('select headword,key,homonym,entry_text,volume,start_page from entries'):
        iz[k].append((t, v, p, hom))
    mu = collections.defaultdict(list)
    for h, k, hom, t, p in sqlite3.connect(args.bilingual).execute('select headword,key,homonym,entry_text,start_page from entries'):
        mu[k].append((t, p, hom))
    rows = []
    for w, page in undefined:
        k = key(w)
        e = {'w': w, 'orth_page': page}
        if k in iz:
            texts = [t for t, v, p, h in iz[k]]
            if all(DERIV.match(t) or SEEONLY.match(t) for t in texts):
                continue
            ev = []
            for t, v, p, h in iz[k][:2]:
                if DERIV.match(t) or SEEONLY.match(t):
                    continue
                labels, found = senses(t)
                ev.append({'labels': labels, 'senses': found, 'vol': v, 'page': p})
            if not ev:
                continue
            e['izahli'] = ev
        if k in mu:
            e['musayev'] = [{'gloss': t[:240], 'page': p} for t, p, h in mu[k][:2]]
        if 'izahli' in e or 'musayev' in e:
            rows.append(e)
    args.out.mkdir(parents=True, exist_ok=True)
    size = math.ceil(len(rows) / BATCHES)
    for i in range(BATCHES):
        chunk = rows[i * size:(i + 1) * size]
        (args.out / f'batch-{i:02d}.jsonl').write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in chunk), encoding='utf-8')
    print(f'{len(rows)} words in {BATCHES} batches of {size} -> {args.out}')


if __name__ == '__main__':
    main()
