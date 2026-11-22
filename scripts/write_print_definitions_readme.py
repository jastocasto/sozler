#!/usr/bin/env python3
"""Refresh the README section for the print-dictionary definition layer from its attribution file."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / 'README.md'
summary = json.loads((ROOT / 'dist/print-definitions-attribution.json').read_text())['summary']
methods = summary['definitions_by_method']
n = lambda value: f'{value:,}'
total = 90849
section = f'''## Headword count and print-dictionary definitions

The atlas has **{n(total)} headwords** (`dist/word-count.json`): {n(total - 68642)} dictionary entries with fixed atlas positions and 68,642 further spellings from the 2021 orthography dictionary (*Azərbaycan dilinin orfoqrafiya lüğəti*, 7th edition), placed in the separate Orfoqrafiya region. The orthography dictionary lists spellings only, so most of those entries started without a meaning, and many had no connection.

`dist/print-definitions.js` adds **{n(summary['definitions'])} definitions** to headwords that had none, and **{n(summary['links'])} cited links**. Headwords without any definition fell from {n(summary['undefined_before'])} to {n(summary['undefined_after'])}; headwords without any connection fell from {n(summary['isolated_before'])} to {n(summary['isolated_after'])}. Existing reviewed definitions, relations, block lists, identities and atlas positions are unchanged. Every new definition has a method label in the definition sheet:

- **{n(methods.get('paraphrase', 0))} paraphrases** (*Lüğət əsasında süni intellekt dəstəyi ilə yazılmış izah*): new Azerbaijani and English wording of the primary sense in *Azərbaycan dilinin izahlı lüğəti* (2006, four volumes) and/or Musayev's *Azərbaycanca–İngiliscə lüğət*, citing the PDF page. Paraphrases sharing six or more consecutive words with the print entry are rejected; print prose is cited, not republished. {n(summary['low_confidence_paraphrases'])} paraphrases written from thin or garbled evidence are marked *yoxlanılmalıdır / needs review*.
- **{n(methods.get('derivation', 0))} derivation notes**: the explanatory dictionary states the formation (`"Abadlaşdırmaq"dan f.is.`), so the word gets a verbal-noun, passive, causative, participle or diminutive definition and a root link to its base.
- **{n(methods.get('cross-reference', 0))} cross-references**: the explanatory dictionary refers the word to another headword (`b a x`), whose definition it shares, with a synonym link.
- **{n(methods.get('rule', 0))} rule-based definitions** (*Qayda ilə qurulub*): transparent productive suffixes (-sız, -lı, -lıq, -çı, -laşmaq and -laşdırmaq after a noun or adjective, -lanmaq after an adjective, -ma, passive -ıl, passive or reflexive -n of a -lamaq verb, causative -dır, and -t after a vowel or a polysyllabic -r/-l stem) of a defined base, a quantity word with noun + -lı (*çoxbarmaqlı*, *ikimərtəbəli*), diminutive -cıq/-ça, manner adverbs in -casına, place compounds (*qarınüstü*, *çənəaltı*, *çayboyu*) and "between" adjectives (*banklararası*), closed, paired and izafet compounds of defined words (including paired verbs opened by a converb, *bölüb-paylamaq*), borrowed words built on one stem (*psixologiya*, *psixoloji*, *psixoloq*; *-izm*, *-ist*, *-istik*; *-qrafiya*, *-qrafik*; *-metriya*, *-metrik*; *-ika*, *-ik*), which are linked, with the dependent member defined from its head where the sense follows, and learned prefixes (bio-, mikro-, kiber-, …). The definition describes the formation and links to its parts; it does not claim a lexicalised meaning. Closed compounds are not split where a longer headword plus a suffix explains the word (*konturlamaq* is *kontur* + -lamaq, not *kont* + *urlamaq*). Suffix and compound links are added to words that already had a definition only when that definition, or the primary sense of the word in the explanatory dictionary, names the base (bare or with a case, possessive or plural ending, as in *kədərsiz*: "Kədəri olmayan…"); the {n(summary['stats'].get('links:rule-print', 0) + summary['stats'].get('links:compound-print', 0))} links confirmed by the print entry also cite that page.
- **{n(methods.get('authored', 0))} AI-written definitions** (*Süni intellektlə yazılıb, çap lüğətlərində yoxdur*): spellings with no entry in either print dictionary, mostly international technical loanwords. They cite only the orthography page that attests the spelling, claim no print source, and are always marked *yoxlanılmalıdır / needs review*. They also serve as bases for the suffix rules.

The source PDFs use a legacy font that stores Azerbaijani Cyrillic in Windows-1251 byte positions; `scripts/extract_print_dictionaries.py` decodes them and rebuilds the local SQLite caches that `scripts/build_orthography_links.py` and `scripts/build_print_definitions.py` read. The caches are build inputs only and are not published. Rebuild:

    python3 scripts/extract_print_dictionaries.py --explanatory v1.pdf v2.pdf v3.pdf v4.pdf --explanatory-db izahli.sqlite --bilingual musayev.pdf --bilingual-db musayev.sqlite
    node scripts/export_print_definition_model.cjs model.json --without-print
    python3 scripts/build_print_definitions.py model.json izahli.sqlite musayev.sqlite
    python3 scripts/write_print_definitions_readme.py
    node tests/print-definitions-data.cjs

Paraphrases and AI-written definitions are editorial text under CC BY-SA 4.0, kept in `scripts/content/print-definitions/paraphrases/` and `scripts/content/print-definitions/authored/`; method, sources and hashes are in `dist/print-definitions-attribution.json`. This is not native-speaker verification.

'''
text = README.read_text()
pattern = re.compile(r'## Headword count and print-dictionary definitions\n.*?(?=\n## )', re.S)
if pattern.search(text):
    text = pattern.sub(section.rstrip('\n') + '\n', text)
else:
    text = text.replace('\n## Run\n', '\n' + section + '## Run\n', 1)
README.write_text(text)
print('README section updated')
