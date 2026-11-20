#!/usr/bin/env python3
"""Rebuild the local print-dictionary databases from the cited PDF files.

The explanatory dictionary (Azərbaycan dilinin izahlı lüğəti, 2006, four
volumes) and Musayev's Azerbaijani–English dictionary were typeset with a
legacy font that stores Azerbaijani Cyrillic letters in Windows-1251 byte
positions.  `pdftotext` therefore returns Latin-1 look-alike characters
(`À×ÛÃ ñèô.`).  This script maps those code points back to Azerbaijani Latin
(`AÇIQ sif.`), splits the text into headword entries and records the PDF page
on which each entry starts.

The output SQLite files are local caches for the build scripts.  They are not
web assets and must not be republished: the dictionaries are cited evidence,
and the site's displayed definitions are separate editorial text.

    python3 scripts/extract_print_dictionaries.py \
        --explanatory v1.pdf v2.pdf v3.pdf v4.pdf --explanatory-db izahli.sqlite \
        --bilingual musayev.pdf --bilingual-db musayev.sqlite

`build_orthography_links.py` reads the explanatory database
(`entries(headword, entry_text, volume, start_page)`).
"""
import argparse
import hashlib
import re
import sqlite3
import subprocess
import unicodedata
from pathlib import Path

# Windows-1251 positions of А..Я, in order, mapped to the Azerbaijani Latin
# letters the legacy font draws in those slots.
CYRILLIC_SLOTS = ['A', 'B', 'V', 'Q', 'D', 'E', 'J', 'Z', 'İ', 'Y', 'K', 'L', 'M', 'N', 'O', 'P',
                  'R', 'S', 'T', 'U', 'F', 'X', 'Ü', 'Ç', 'Ş', 'H', 'C', 'I', 'Ğ', 'G', 'Ö', 'Ə']
LEGACY = {}
for offset, letter in enumerate(CYRILLIC_SLOTS):
    LEGACY[chr(0xC0 + offset)] = letter
    LEGACY[chr(0xE0 + offset)] = {'İ': 'i', 'I': 'ı'}.get(letter, letter.lower())
LEGACY.update({'“': '"', '”': '"', '„': '"', '«': '"', '»': '"'})

UPPER = 'A-ZÇĞIİÖŞÜƏ'
LOWER = 'a-zçğıiöşüə'
# An explanatory headword is printed in capitals and followed by a label,
# an etymology bracket, a sense number, a derivation note or a cross-reference.
EXPLANATORY_HEAD = re.compile(
    rf'^([{UPPER}][{UPPER}\-]*(?:[ ,]+[{UPPER}][{UPPER}\-]*)*)(?:\s*(\d{{1,2}}))?\s+'
    rf'(?=[{LOWER}"\[(]|\d{{1,2}}\.|b a x)(.*)$')
# A bilingual headword is printed in lower case and followed by a part-of-speech label.
BILINGUAL_POS = r'(?:f|s|i|z|əv|bağl|əd|ədat|nida|qoş|say|modal|mod|xüs|söz-cümlə)\.'
BILINGUAL_HEAD = re.compile(
    rf'^([{LOWER}][{LOWER}\-]*(?: [{LOWER}][{LOWER}\-]*){{0,3}})(?:\s+(I{{1,3}}|IV|V)\.?)?\s+'
    rf'((?:{BILINGUAL_POS}|bax\s).*)$')


def decode(text):
    return unicodedata.normalize('NFC', ''.join(LEGACY.get(ch, ch) for ch in text))


def key(word):
    return unicodedata.normalize('NFC', word).translate(str.maketrans('İI', 'iı')).lower()


def pdf_pages(path):
    raw = subprocess.run(['pdftotext', '-enc', 'UTF-8', str(path), '-'], check=True,
                         capture_output=True).stdout.decode('utf-8')
    return [decode(page) for page in raw.split('\f')]


def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def clean(lines):
    text = '\n'.join(lines)
    text = re.sub(r'(\w)-\n(?=[a-zçğıöşüə])', r'\1', text)
    return ' '.join(text.split())


def explanatory_entries(volume, path):
    current = None
    for page_number, page in enumerate(pdf_pages(path), 1):
        for line in page.splitlines():
            line = line.strip()
            if not line or re.fullmatch(r'\d{1,4}', line):
                continue
            match = EXPLANATORY_HEAD.match(line)
            # Running heads repeat a capitalised headword alone on a line; they have no body.
            if match and len(re.sub(r'[^A-ZÇĞIİÖŞÜƏ]', '', match[1])) >= 1 and match[3].strip():
                if current:
                    yield current
                head = match[1].strip().rstrip(',')
                current = {'headword': head, 'homonym': int(match[2]) if match[2] else None,
                           'lines': [match[3]], 'volume': volume, 'page': page_number}
            elif current and not re.fullmatch(rf'[{UPPER}\- ,]+', line):
                current['lines'].append(line)
    if current:
        yield current


def bilingual_entries(path):
    current = None
    for page_number, page in enumerate(pdf_pages(path), 1):
        for line in page.splitlines():
            line = line.strip()
            if not line or re.fullmatch(r'\d{1,4}', line):
                continue
            match = BILINGUAL_HEAD.match(line)
            if match:
                if current:
                    yield current
                current = {'headword': match[1], 'homonym': match[2], 'lines': [match[3]], 'page': page_number}
            elif current and not re.fullmatch(rf'[{LOWER}\-]+', line):
                current['lines'].append(line)
    if current:
        yield current


def build_explanatory(paths, output):
    output.unlink(missing_ok=True)
    db = sqlite3.connect(output)
    db.execute('create table entries(headword text, key text, homonym integer, entry_text text, volume integer, start_page integer)')
    db.execute('create table sources(volume integer, path text, sha256 text)')
    for volume, path in enumerate(paths, 1):
        db.execute('insert into sources values(?,?,?)', (volume, path.name, digest(path)))
        rows = []
        for entry in explanatory_entries(volume, path):
            for head in re.split(r',\s+', entry['headword']):
                head = head.strip()
                if head:
                    rows.append((head, key(head), entry['homonym'], clean(entry['lines']), volume, entry['page']))
        db.executemany('insert into entries values(?,?,?,?,?,?)', rows)
        print(f'volume {volume}: {len(rows)} headwords')
    db.execute('create index entries_key on entries(key)')
    db.commit()


def build_bilingual(path, output):
    output.unlink(missing_ok=True)
    db = sqlite3.connect(output)
    db.execute('create table entries(headword text, key text, homonym text, entry_text text, start_page integer)')
    db.execute('create table sources(path text, sha256 text)')
    db.execute('insert into sources values(?,?)', (path.name, digest(path)))
    rows = [(e['headword'], key(e['headword']), e['homonym'], clean(e['lines']), e['page']) for e in bilingual_entries(path)]
    db.executemany('insert into entries values(?,?,?,?,?)', rows)
    db.execute('create index entries_key on entries(key)')
    db.commit()
    print(f'bilingual: {len(rows)} headwords')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--explanatory', type=Path, nargs=4, metavar='VOLUME_PDF')
    parser.add_argument('--explanatory-db', type=Path)
    parser.add_argument('--bilingual', type=Path, metavar='MUSAYEV_PDF')
    parser.add_argument('--bilingual-db', type=Path)
    args = parser.parse_args()
    if args.explanatory:
        build_explanatory(args.explanatory, args.explanatory_db)
    if args.bilingual:
        build_bilingual(args.bilingual, args.bilingual_db)


if __name__ == '__main__':
    main()
