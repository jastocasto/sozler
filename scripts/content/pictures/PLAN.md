# Pictures for words: list and plan

Status: **proposal**. The list exists; no pictures are drawn yet and the app is unchanged.

## The list

`scripts/build_picture_candidates.py` read all 90,849 headwords and kept those whose primary English meaning is something you can see: an object, animal, plant, food, body part, person or occupation, natural feature, colour, shape, or a physical action (run, swim, cut, pour). It uses three public signals on the English gloss:

- the WordNet category of the gloss (noun.animal, noun.artifact, verb.motion, …),
- the Brysbaert et al. (2014) concreteness rating (1 = abstract, 5 = concrete),
- whether an open-licence emoji or pictogram already exists for the concept.

Rule-based formation notes ("verbal noun of …") and vulgar, slang and sexual glosses are left out. Synonyms share one picture, so the number of pictures to make is smaller than the number of words.

| | Words | Pictures to make |
|---|---:|---:|
| 1. Quiz words | 112 | 112 |
| 2. Core dictionary, clearly drawable (tier A) | 3,815 | 2,623 |
| 3. Core dictionary, probably drawable (tier B, check first) | 2,250 | 1,768 |
| 4. Orthography-dictionary headwords | 3,292 | 2,437 new (the rest reuse a picture from 1–3) |
| **Total** | **9,469** | **6,940** |

How each picture would be made (the `route` column in `concepts.tsv`):

| Route | Pictures | Meaning |
|---|---:|---|
| pictogram-set | 585 | An open-licence pictogram for the concept already exists (horse, book, key, volcano). |
| custom-icon | 5,208 | No suitable pictogram exists. We draw one. |
| photo | 1,120 | A specific species or regional item (pomegranate, thrush, wych elm). A photo or a careful drawing works better than a generic icon. |
| swatch | 26 | Colours, generated directly. |
| flag | 1 | |

Files:

- `candidates.tsv`: one row per word with its English head term, tier, kind, a `specific` flag (the word needs its own picture, not a shared generic one: `tar` and `saz` are both "instrument" in English but need different pictures), a `sensitive` flag (weapons, corpses, intimate anatomy: decide case by case), and the emoji hint.
- `concepts.tsv`: one row per picture, with every word that would use it.
- `summary.json`: the counts above.

### Known limits

- The list is built from the **English** gloss. It is a starting point to review, not a final decision. A random check of tier A found about 4 in 5 rows correct; tier B is lower.
- Homonyms get one picture for the sense the app shows first. `çay` shows "tea", while the quiz uses its "river" sense; `ay` is moon and month. These need a per-word choice.
- Some heads are generic or wrong: `meydan` → "square" got the shape emoji instead of a town square, `əlcək` → glove got "boxing glove", `ion` and `elektron` are diagrams at best. Review will catch these.

## Decisions for you

1. **Style.** Recommended: one monochrome line style drawn in `currentColor`, so icons take the sheet's cream-on-charcoal colours and sit well next to the serif type. The alternatives are colour emoji artwork, which is bright and mixed in style, and photos, which are clear but heavy and inconsistent. Photos can still be used for species even with a line style.
2. **Where pictures appear.** Recommended first step: a small picture beside the bilingual definition in the meaning sheet, plus the word-of-the-day dialog. Later: a quiz mode where you pick the word for a picture. Optional: a faint icon inside the selected bubble.
3. **First release scope.** Recommended: groups 1 and 2, about 2,700 pictures. Group 3 needs a keep/drop pass first, and group 4 is mostly rare words.

## Sources

| Route | Source | Licence | Notes |
|---|---|---|---|
| pictogram-set | [OpenMoji](https://openmoji.org) black line versions | CC BY-SA 4.0 | The whole emoji set in monochrome line art, covering animals, food, people, tools and weather. Same licence as the paraphrases. |
| pictogram-set, objects | [Tabler Icons](https://tabler.io/icons) | MIT | ~5,900 line icons on a 24 px grid. Good for tools, devices, household items and buildings. |
| custom-icon | Drawn for SÖZ as SVG in the house style | CC BY-SA 4.0, labelled as AI-assisted like the paraphrases | Batches of ~100, each with a brief and automated checks (see below). Starts from an OpenMoji or Tabler shape when a near match exists. |
| photo | Wikimedia Commons, found through Wikidata (image property P18, scientific names in glosses such as *Ulmus glabra*) | Per file: CC BY, CC BY-SA or public domain | Author, licence and file URL are stored for each image. Resized to 320 px WebP. |
| Azerbaijani cultural items | Drawn for SÖZ from Commons reference photos | CC BY-SA 4.0 | `tar`, `saz`, `kamança`, `kəlağayı`, `papaq`, `dolma`, `plov`, `səməni`, `xonça`, `buta` and similar. Checked by hand because no generic icon set has them. |

## Technical design

- **Data layer.** `dist/pictures.js` sets `window.WORD_WEB_PICTURES = {concepts: {id: {svg, route, source, licence, author, method}}, words: {word: id}}`. Line icons are stored as inline SVG path data in this one file, like the other data layers, so offline mode keeps working. Estimated size is ~2–3 MB for groups 1–2 and ~6 MB for everything, against the current 133 MB offline package. Photos go in `dist/pictures/photos/*.webp` and load only when shown. Whether the offline download includes them (~20 MB) is a separate choice.
- **Attribution.** `dist/pictures-attribution.json` follows the pattern of the other `*-attribution.json` files: method counts, sources and licences, and per-photo credits.
- **Build.** `scripts/build_pictures.py` merges pictogram picks, drawn SVGs (`scripts/content/pictures/drawn/batch-NN.json`) and photo records into `dist/pictures.js`. Then run `version_assets.py` and `build_offline.py`, as for every change to `dist/`.
- **UI.** A picture slot in `.meaning-main`, about 64 px on phones and 88 px on wider screens. It is hidden when a word has no picture, and the English gloss serves as alt text. The same slot goes in the daily-word dialog.
- **Checks** (`tests/pictures-data.cjs`):
  - every mapped word exists in the atlas;
  - every concept has a source and licence;
  - SVGs are sanitised: only `path`, `circle`, `ellipse`, `line`, `polyline`, `rect` and `g`, with no scripts, links, styles or text;
  - `viewBox="0 0 48 48"`, strokes only in `currentColor`, and a size limit per icon.

## House style for drawn icons (draft)

- 48 × 48 grid with 4 px padding, 2 px stroke, round caps and joins, no fills except small solid accents. This matches the OpenMoji line weight when scaled.
- One object per icon, seen from its most recognisable angle. No letters or words, so the picture works for Azerbaijani and English.
- People are neutral figures. An occupation is shown by its tool or clothing (a doctor has a stethoscope).
- Actions show a figure mid-action, with motion lines kept to a minimum.

## Phases

0. **Pilot.** Draw 30 quiz-word icons in two candidate styles: adapted OpenMoji, and drawn in the house style. Show them on a contact sheet in light and dark, and you pick one. Build the data layer, UI slot and tests with those 30.
1. **Quiz words**: 112 pictures. Fix the homonym senses (`çay` = river for the quiz).
2. **Core tier A**: 2,623 pictures (449 pictograms, 1,751 drawn, 399 photos, 23 swatches) in batches of ~100, each reviewed on a contact sheet before merging.
3. **Core tier B**: a keep/drop review of 2,250 words, recorded in `scripts/content/pictures/review.json`, then the survivors (at most 1,768 pictures).
4. **Orthography headwords**: 3,292 words. Most reuse pictures from earlier phases; 2,437 need new ones, mostly specialised items and species.

## Rebuild the list

    node scripts/export_print_definition_model.cjs model.json
    NLTK_DATA=/path/to/nltk_data python3 scripts/build_picture_candidates.py model.json \
        Concreteness_ratings_Brysbaert_et_al_BRM.txt emojibase-data-16.0.3-en.json

The download URLs for the three inputs are in the script header. None of them are committed.
