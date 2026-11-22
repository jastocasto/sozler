#!/usr/bin/env python3
"""Count word tokens in public Azerbaijani corpora for the frequency layer.

    python3 -I scripts/count_corpus_words.py OUT.tsv wikipedia=WIKI.xml.bz2 web=WEB.txt.gz subtitles=SUBS.txt.gz

wikipedia  azwiki-latest-pages-articles.xml.bz2 from https://dumps.wikimedia.org/azwiki/
           (articles only; templates, references, tables, links and markup are removed)
web        az.txt.gz, the Azerbaijani monolingual CCAligned v1 file from OPUS
           (https://opus.nlpl.eu/CCAligned/corpus/version/CCAligned), a web crawl
subtitles  az.txt.gz, the Azerbaijani monolingual OpenSubtitles v2024 file from OPUS
           (https://opus.nlpl.eu/OpenSubtitles/corpus/version/OpenSubtitles)

A name ending in .bz2 is read as a MediaWiki XML dump, anything else as plain
text lines (gzip allowed). Writes token<TAB>count per corpus for every lowercase
token seen at least twice in some corpus, after a #totals line. Only counts are
kept; no corpus text is stored or published.
"""
import bz2, gzip, re, sys, xml.etree.ElementTree as ET
from collections import Counter

TOKEN = re.compile(r"[a-zəğıöüşç]+(?:-[a-zəğıöüşç]+)*")
TEMPLATE = re.compile(r"\{\{[^{}]*\}\}")
REF = re.compile(r"<ref[^>/]*/>|<ref[^>]*>.*?</ref>", re.S)
COMMENT = re.compile(r"<!--.*?-->", re.S)
TAG = re.compile(r"<[^>]+>")
FILE_LINK = re.compile(r"\[\[(?:Fayl|Şəkil|File|Image|Kateqoriya|Category):[^\]]*\]\]", re.I)
LINK = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]")
EXTERNAL = re.compile(r"\[https?://[^\s\]]+\s*([^\]]*)\]|https?://\S+")
TABLE_LINE = re.compile(r"^\s*(?:\{\||\|\}|\||!).*$", re.M)
HEADING = re.compile(r"^=+.*=+\s*$", re.M)  # İstinadlar, Xarici keçidlər … repeat in every article
AZ_LETTER = re.compile(r"[əğıöüşç]")  # lines without one are mostly English or other languages


def lower_az(text):
    """Azerbaijani lowercase: I is ı and İ is i."""
    return text.replace('I', 'ı').replace('İ', 'i').lower()


def clean_wikitext(text):
    text = COMMENT.sub(' ', text)
    text = REF.sub(' ', text)
    for _ in range(6):  # templates nest; remove the innermost a few times
        text, n = TEMPLATE.subn(' ', text)
        if not n:
            break
    text = FILE_LINK.sub(' ', text)
    text = LINK.sub(r'\1', text)
    text = EXTERNAL.sub(r'\1', text)
    text = TABLE_LINE.sub(' ', text)
    text = HEADING.sub(' ', text)
    text = TAG.sub(' ', text)
    return text.replace("'''", '').replace("''", '')


def count_wikipedia(path):
    counts, pages = Counter(), 0
    ns = None
    with bz2.open(path, 'rb') as stream:
        for event, element in ET.iterparse(stream, events=('end',)):
            tag = element.tag.rsplit('}', 1)[-1]
            if tag == 'ns':
                ns = element.text
            elif tag == 'text':
                body = element.text or ''
                if ns == '0' and not body.lstrip().lower().startswith('#redirect') and not body.lstrip().lower().startswith('#istiqamətləndirmə'):
                    counts.update(TOKEN.findall(lower_az(clean_wikitext(body))))
                    pages += 1
                    if pages % 20000 == 0:
                        print(f'wikipedia: {pages} articles, {sum(counts.values())} tokens', file=sys.stderr, flush=True)
            elif tag == 'page':
                element.clear()
                ns = None
    return counts


def count_text(path):
    counts = Counter()
    opener = gzip.open if path.endswith('.gz') else open
    with opener(path, 'rt', encoding='utf-8', errors='replace') as stream:
        for line in stream:
            line = lower_az(line)
            if AZ_LETTER.search(line):
                counts.update(TOKEN.findall(line))
    return counts


def main(out_path, *specs):
    names, tables = [], []
    for spec in specs:
        name, _, path = spec.partition('=')
        counts = count_wikipedia(path) if path.endswith('.bz2') else count_text(path)
        print(f'{name}: {sum(counts.values())} tokens, {len(counts)} types', file=sys.stderr, flush=True)
        names.append(name)
        tables.append(counts)
    with open(out_path, 'w', encoding='utf-8') as out:
        out.write('#corpora\t' + '\t'.join(names) + '\n')
        out.write('#totals\t' + '\t'.join(str(sum(t.values())) for t in tables) + '\n')
        for token in sorted(set().union(*tables)):
            row = [t.get(token, 0) for t in tables]
            if max(row) >= 2:
                out.write(token + '\t' + '\t'.join(map(str, row)) + '\n')


if __name__ == '__main__':
    if len(sys.argv) < 3 or not all('=' in a for a in sys.argv[2:]):
        sys.exit(__doc__)
    main(*sys.argv[1:])
