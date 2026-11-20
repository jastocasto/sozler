# Brief: bilingual definitions from print-dictionary evidence

This is the exact brief used for every paraphrase batch. Evidence batches come from `scripts/build_paraphrase_batches.py` (see HANDOFF.md).

You are helping the Söz Toxuması Azerbaijani word atlas. Some of its words have no definition yet. For each word in your evidence batches, write a NEW short definition in Azerbaijani and in English, based on the evidence given.

## Input
Each evidence file is JSONL: one word per line, like
{"w": "müşavirəbaz", "orth_page": 460, "izahli": [{"labels": "is. [ər. müşavirə və fars. ...baz]", "senses": ["Tez-tez müşavirə (iclas) çağırmağı sevən adam; ..."], "vol": 3, "page": 433}], "musayev": [{"gloss": "i. ...", "page": 587}]}
- `izahli`: up to 2 entries from *Azərbaycan dilinin izahlı lüğəti* (2006). `labels` holds part of speech and usage labels (is.=noun, sif.=adjective, f.=verb, z./zərf=adverb, say=numeral, əvəz.=pronoun, nida=interjection, bağl.=conjunction, qoş.=postposition, ədat=particle; köhn.=archaic, məc.=figurative, dan.=colloquial, klas.=classical, tib., bot., zool. etc.=domain). `senses` holds the first sentence of up to 3 numbered senses. Text was machine-extracted from a PDF, so it can contain small errors or bleed from the next entry.
- `musayev`: Musayev's Azerbaijani–English dictionary entry (POS label i.=noun, s.=adjective, f.=verb, z.=adverb, then English equivalents; `~` stands for the headword; `bax X` means "see X").

## Output
For evidence file `batch-NN.jsonl`, write ``scripts/content/print-definitions/paraphrases/batch-NN.json` (in the repository)`: ONE JSON object keyed by the exact `w` value of every line (every word must appear exactly once):
{
  "müşavirəbaz": {"az": "Tez-tez iclas və müşavirə keçirməyi xoşlayan adam.", "en": "someone fond of calling meetings", "pos": "noun", "src": "izahli", "conf": "high"},
  "someword": {"skip": "evidence belongs to a different headword"}
}
Fields:
- `az`: ONE Azerbaijani sentence for the primary (first, most common) sense, in standard modern Azerbaijani Latin script, starting with a capital letter and ending with a period. Aim for 3–14 words. It must be your own wording: do NOT copy the print sense. Never reuse 5 or more consecutive words from the evidence; rephrase, reorder, use synonyms. Do not include example sentences, author names, etymology or the headword itself where avoidable.
- `en`: a concise English gloss of the same sense, lowercase start, no final period (e.g. "decay or rottenness", "bitterish", "to make something wide"). Verbs start with "to ". Do not copy long Musayev phrases verbatim when they are more than a few words; short equivalents (1–4 words) are fine as is.
- `pos`: one of noun, verb, adjective, adverb, numeral, pronoun, interjection, postposition, conjunction, particle, phrase. Use the evidence labels; words ending in -maq/-mək with a verb label are `verb`.
- `src`: "izahli", "musayev" or "both" — which evidence your definition relies on.
- `conf`: "high" when the evidence clearly states the sense; "low" when you had to resolve garbled, thin or conflicting evidence.
- Use `{"skip": "<short reason>"}` instead when the evidence is clearly about a different word, is unreadable, or you cannot tell what the word means. Do not invent meanings that the evidence does not support. Your own knowledge of Azerbaijani may help you interpret the evidence and choose the primary sense, but every definition must agree with the evidence.

Style examples already in the atlas:
- enliləşdirmək → az "Bir şeyi enli etmək və ya bu hala gətirmək." en "to make something wide"
- çürüklük → az "Bir şeyin çürüyüb yararsız hala gəlməsi." en "decay or rottenness"
- candərdi → az "İstəyi olmadan, məcbur qaldığına görə." en "reluctantly or against one's will"
- üçyaşlı → az "Üç yaşı olan." en "three years old"

## How to work
- Process your batches one at a time: Read the whole evidence file (each is ~277 lines; read with offset/limit if needed so you see every line), write the complete output file with the Write tool, then validate it with Bash:
  python3 -c "import json,sys; ev=[json.loads(l)['w'] for l in open(sys.argv[1])]; out=json.load(open(sys.argv[2])); missing=[w for w in ev if w not in out]; extra=[w for w in out if w not in ev]; bad=[w for w,v in out.items() if 'skip' not in v and not (v.get('az','').strip().endswith('.') and v.get('en','').strip() and v.get('pos'))]; print(len(ev),len(out),'missing',missing[:20],'extra',extra[:20],'bad',bad[:20])" EVIDENCE OUTPUT
  Fix any missing/extra/bad entries and re-validate before moving on.
- If an output is large, you may write it in two halves (batch-NN.part1.json and batch-NN.part2.json) then merge them into batch-NN.json with a short python command and delete the parts.
- Do not edit any other files while writing a batch.
- When finished, reply with one line per batch: file, number defined, number skipped, number low-confidence.
