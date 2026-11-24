#!/usr/bin/env python3
"""Count bilingual definition coverage and export outstanding entries from the built atlas."""
import argparse
import csv
import gzip
import hashlib
import json
import re
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

from build_print_definitions import FORMATION_ONLY, ROOT, key, print_source

STATES = ('missing', 'formation-only', 'needs-review', 'other-bilingual')


def print_candidates(archive):
    """Headword matches are leads for a reader to check against the intended sense."""
    source = json.loads((ROOT / 'scripts/content/verification/print-source-summary.json').read_text())
    raw = archive.read_bytes()
    if hashlib.sha256(raw).hexdigest() != source['extraction_sha256']:
        raise ValueError('Dictionary archive does not match the recorded edition')
    db = sqlite3.connect(':memory:')
    try:
        db.deserialize(gzip.decompress(raw))
        pages = defaultdict(list)
        for head, volume, page in db.execute('SELECT headword, volume, start_page FROM entries ORDER BY id'):
            url = print_source(volume, page)['url']
            for spelling in head.split(', '):
                matches = pages[key(spelling)]
                if url not in matches:
                    matches.append(url)
        return pages
    finally:
        db.close()


def audit(dist, output=None, candidates=None):
    core = json.loads((dist / 'soz-core.json').read_text())
    raw = (dist / core['text']['file']).read_bytes()
    if hashlib.sha256(raw).hexdigest()[:16] != core['text']['hash']:
        raise ValueError('The headword index and definition text are from different builds')
    text = json.loads(raw)
    nodes, cols = core['nodes'], text['cols']
    words = nodes['cols']['w']['values']
    methods = nodes['cols']['definitionMethod']
    az, en = cols['az']['values'], cols['en']['values']
    flags, confidence = (nodes['sparse'][field] for field in ('definitionAuditStatus', 'definitionConfidence'))
    ranks = core['frequency'] or [0] * len(words)
    if any(len(c) != nodes['count'] for c in (words, az, en, methods['values'], ranks, cols['definitionSources']['values'])):
        raise ValueError('Incomplete headword or definition column')

    counts, queue = Counter(), []
    for i, word in enumerate(words):
        code = methods['values'][i]
        method = methods['dict'][code] if code is not None else ''
        status, reason = 'other-bilingual', ''
        if not (az[i] or '').strip() or not (en[i] or '').strip():
            status, reason = 'missing', 'Azerbaijani or English text missing'
        elif method == 'rule' and FORMATION_ONLY.search(az[i]):
            status, reason = 'formation-only', 'rule explains how the word is formed'
        elif method in ('meaning', 'authored'):
            status, reason = 'needs-review', 'AI-written meaning pending review'
        elif confidence.get(str(i)) == 'low' or flags.get(str(i)) == 'needs-review':
            status, reason = 'needs-review', 'low confidence or flagged sense'
        counts[status] += 1
        if output and status != 'other-bilingual':
            refs = [text['refs'][j]['url'] for j in (cols['definitionSources']['values'][i] or [])]
            row = (status, word, reason, az[i], en[i], method, ranks[i] or '', ' '.join(refs))
            if candidates is not None:
                row += (' '.join(candidates.get(key(word), ())),)
            queue.append(row)
    if output:
        queue.sort(key=lambda row: (STATES.index(row[0]), row[6] or float('inf'), row[1]))
        with output.open('w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            header = ['status', 'headword', 'reason', 'Azerbaijani', 'English', 'method', 'frequency_rank', 'source_urls']
            if candidates is not None:
                header.append('unverified_dictionary_headword_matches')
            writer.writerow(header)
            writer.writerows(queue)
    return {'headwords': len(words), **{state: counts[state] for state in STATES}}


def update_report(dist, counts):
    report = dist / 'verification-report.html'
    html = report.read_text()
    for state in ('headwords', 'missing', 'formation-only', 'needs-review'):
        pattern = rf'(<strong data-coverage="{state}">)[^<]*(</strong>)'
        html, matches = re.subn(pattern, lambda m: m[1] + f'{counts[state]:,}'.replace(',', ' ') + m[2], html)
        if matches != 1:
            raise ValueError(f'Missing or duplicate report field: {state}')
    report.write_text(html)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, default=ROOT / 'dist')
    parser.add_argument('--csv', type=Path, help='write all missing, formation-only and flagged entries')
    parser.add_argument('--update-report', action='store_true', help='refresh coverage shown on the verification page')
    parser.add_argument('--dictionary-gzip', type=Path, help='include candidate print pages from the recorded dict-1.sqlite.gz extraction in the CSV')
    args = parser.parse_args()
    if args.dictionary_gzip and not args.csv:
        parser.error('--dictionary-gzip requires --csv')
    counts = audit(args.dist, args.csv, print_candidates(args.dictionary_gzip) if args.dictionary_gzip else None)
    if args.update_report:
        update_report(args.dist, counts)
    print(json.dumps(counts, indent=2))
