# Pictures for words: list, plan and progress

Status: **first release built.** The picture quiz (`#sekil`) has 715 line drawings: 539 from OpenMoji and 176 drawn for SÖZ. Pictures appear only on that page, never in the word map. See README, "Picture quiz".

## Decisions made

- **Style:** monochrome line drawings in `currentColor`, using OpenMoji's 72 × 72 grid and 2 px round stroke. As many line drawings as possible; no photos so far.
- **Where:** only on a separate picture-quiz page, opened from the menu. There are no images or icons in the universe map, the meaning sheet or the daily word.
- **Quiz:** two modes (*Şəkil → söz*, *Söz → şəkil*), six topics, 10 questions per round, bilingual definition after each answer, and a missed-only retry.

## The list

`scripts/build_picture_candidates.py` read all 90,849 headwords and kept those whose primary English meaning is something you can see: an object, animal, plant, food, body part, person or occupation, natural feature, colour, shape, or a physical action (run, swim, cut, pour). It uses three public signals on the English gloss:

- the WordNet category of the gloss (noun.animal, noun.artifact, verb.motion, …),
- the Brysbaert et al. (2014) concreteness rating (1 = abstract, 5 = concrete),
- whether an open-licence emoji or pictogram already exists for the concept.

Rule-based formation notes ("verbal noun of …") and vulgar, slang and sexual glosses are left out. Synonyms share one concept, so the number of pictures needed is smaller than the number of words.

| | Words | Concepts |
|---|---:|---:|
| 1. Quiz words | 112 | 112 |
| 2. Core dictionary, clearly drawable (tier A) | 3,815 | 2,623 |
| 3. Core dictionary, probably drawable (tier B, check first) | 2,250 | 1,768 |
| 4. Orthography-dictionary headwords | 3,292 | 2,437 new (the rest reuse a concept from 1–3) |
| **Total** | **9,469** | **6,940** |

Files:

- `candidates.tsv`: one row per word with its English head term, tier and kind. It also has a `specific` flag (the word needs its own picture, not a shared generic one: `tar` and `saz` are both "instrument" in English), a `sensitive` flag (weapons, corpses, intimate anatomy) and an emoji hint.
- `concepts.tsv`: one row per concept, with every word that would use it.
- `summary.json`: the counts above.

Known limits: the list is built from the English gloss (a random check of tier A found about 4 in 5 rows correct). Homonyms get the sense the app shows first, and some heads are generic or wrong (`meydan` → "square").

## What is built

| File | Contents |
|---|---|
| `openmoji-picks.json` | 539 concepts → OpenMoji code, annotation, author and the one word the quiz shows. Each was checked by eye on contact sheets: 1,069 automatic matches were reviewed and about half kept, and a second pass matched English glosses to OpenMoji names (`ailə`, `toy`, `sikkə`, `bilet`, `təqvim`). |
| `openmoji.json` | The picked drawings, normalised by `scripts/import_openmoji.py` (OpenMoji 15.1.0 black set). |
| `scripts/draw_pictures.py` → `drawn.json` | 176 drawings made for SÖZ, each with its quiz word. These include Azerbaijani items the English-based list missed (`tar`, `saz`, `kamança`, `kəlağayı`, `papaq`, `səməni`, `buta`, `qaval`), stored as word-only concepts (`word:tar`) with an explicit topic. |
| `scripts/build_pictures.py` → `dist/pictures.js`, `dist/pictures-attribution.json` | Merges both sources, assigns the six quiz topics, checks words and SVG markup, and writes credits. |
| `dist/picture-quiz.js`, `dist/picture-quiz-ui.js`, `dist/picture-quiz.css` | Quiz logic (Node-testable), page UI and styles. |
| `tests/picture-quiz-data.cjs`, `tests/picture-quiz-page.cjs` | Data and page checks. |

The rules applied when picking:

- **One word per picture.** The concept's most common word is used, and secondary words are never shown. For example, the clock picture is `saat` and the kite is `çərpələng`, not `çalağan` (which is the bird).
- **No two concepts share a drawing.** Where two concepts competed for one drawing, only the better fit kept it: `lampoçka` has the light bulb and `işıq` has none.
- **Near-identical answers never appear in the same question.** This is checked at run time from the dictionary's synonym and root links and the English glosses.

## House style for drawn pictures

- 72 × 72 grid, content within about 4–68, 2 px stroke, round caps and joins. Fills are used only for small solid accents (pupils, a cave mouth, a moustache).
- One object per picture, seen from its most recognisable angle. No letters or words.
- Actions use a pictogram figure: a filled head and 4.5 px limbs.
- Each drawing is reviewed at 96 px on a dark contact sheet. Drawings that could be mistaken for another word are dropped (chisel looked like a pen, fig like a water drop, cabbage like a ball).

## Next batches

Words with no picture yet, in order:

1. **Quiz words still missing** (42 of 112), for example `döşəmə`, `vəkil`, `boğaz`, `mühasib`, `qitə`, `roman`, `toxum`, `bulaq`. Many are hard to draw unambiguously, so expect several to be skipped.
2. **Core tier A**: 2,039 of 2,623 concepts left. The most useful remaining groups are:
   - everyday objects: `şəkər`, `cib`, `dam`, `gödəkçə`, `kəndir`, `döşək`;
   - more body parts with a pointer: `alın`, `daban`, `bel`;
   - more action figures: `açmaq`, `kəsmək`, `uçmaq`, `ütüləmək`;
   - regional items: `xonça`, `şəkərbura`, `nağara`, `təndir`, `çuxa`.
3. **Tier B and orthography words**: review each first, then draw.

To add a drawing, add a `draw(concept, word, ...)` call in `scripts/draw_pictures.py` and review it on a contact sheet. To add an OpenMoji drawing, add a row to `openmoji-picks.json` and run `import_openmoji.py`. Then run `build_pictures.py`, `version_assets.py`, `build_offline.py` and the two tests.

## Rebuild the list

    node scripts/export_print_definition_model.cjs model.json
    NLTK_DATA=/path/to/nltk_data python3 scripts/build_picture_candidates.py model.json \
        Concreteness_ratings_Brysbaert_et_al_BRM.txt emojibase-data-16.0.3-en.json

The download URLs for the three inputs are in the script header. None of them are committed.
