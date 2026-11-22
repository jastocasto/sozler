# Handoff: continuing Söz Toxuması

Read this first if you are an AI agent or developer picking up the work. Everything you need is in this repository. No local state from earlier sessions is required.

## November 2026 improvement round

The owner approved five improvements; they were published to `soz-toxumasi` at `744d79e` (22 Nov 2026) and the owner enabled Web Analytics. Later work continues on branch `claude/tender-davinci-qpimp0`; each merge into `soz-toxumasi` needs the owner's approval. After publishing: two-stage loading (`soz-text.json`, see README). README section "Fast loading, word forms, frequency and word origins" documents them and the rebuild order.

1. **Fast loading.** `scripts/build_runtime.cjs` runs `createModel` at build time and writes `dist/soz-core.json`, `dist/details/N.json` and `dist/forms-archive.json`; `restoreModel` in `dist/model.js` rebuilds the model API and the build fails unless it matches `createModel`. The 17 layer files stay in `dist/` as build inputs and for the data tests (`tests/layers.cjs` lists them); the page and the offline package no longer load them. `vercel.json` caches the data files and every script and stylesheet except `sw.js` for a year (the page requests them with content-hash `?v=` keys); it also sets `X-Content-Type-Options: nosniff`.
2. **Inflected forms in search**: `dist/morphology.js`, tested by `tests/morphology.cjs`.
3. **Frequency and levels**: `scripts/count_corpus_words.py` + `scripts/build_frequency.cjs` → `scripts/content/frequency/headword-frequency.tsv` (committed; corpora are not). Run `build_runtime.cjs` after changing the TSV.
4. **Word origins and homonyms**: `scripts/build_etymology.py` → `scripts/content/etymology/` (committed; the Kaikki file is not).
5. **Vercel Web Analytics**: loaded by `app.js` on the deployed site. The owner still has to enable Web Analytics in the Vercel project (Analytics tab); the API used here cannot switch it on.

After any change in `dist/`, run `python3 scripts/version_assets.py && python3 scripts/build_offline.py`. `scripts/run_tests.sh` runs the tests three at a time (installs linkedom into `.cache/` on first use). An hourly scheduled check-in (minute 41) resumed this work in the owner's Claude session while it was in progress.

## Where things are

- **Branch `soz-toxumasi`**: the current project (Söz Toxuması). Work here.
- **Branch `main`**: the original 2024 Söz Xəritəsi Flask app, also archived in `archive/sozler/`. Tag `legacy-sozler` marks its last commit.
- **`dist/`**: the complete static site. There is no build step at runtime; serve `dist/` with any static server or publish it as-is.
- **Hosting**: Vercel project `soz-toxumasi`, live at https://soz-toxumasi.vercel.app. It serves `dist/` as plain static files (no framework, no build command). Pushing to `soz-toxumasi` deploys production; other branches get preview deployments, which require a Vercel login. The production address is public.
- **`scripts/`**: data builders. **`tests/`**: regression checks (`node tests/<name>.cjs`; interaction tests need `NODE_PATH` pointing at a `linkedom` install).
- **`README.md`**: feature documentation. The section "Headword count and print-dictionary definitions" describes the newest data layer.

## Goal of the current work

Every headword should have a correct, cited definition (Azerbaijani + English) and real connections. The atlas has 90,849 headwords: 22,207 dictionary entries plus 68,642 spellings from the 2021 orthography dictionary, which lists spellings only. `dist/print-definitions.js` fills definitions and links for headwords that had none, using five labelled methods (paraphrase, derivation note, cross-reference, rule, and AI-written `authored` definitions for words no print source covers). Current counts are in `dist/print-definitions-attribution.json` → `summary`.

## What is left

All 64 paraphrase batches (`batch-00` … `batch-63`) are written, and none shares five consecutive words with its print entry. This work is on branch `claude/wonderful-davinci-g526vf` and has not been merged into `soz-toxumasi`. To confirm that no batch is missing:

    python3 -c "import os;have={f[6:8] for f in os.listdir('scripts/content/print-definitions/paraphrases') if f.endswith('.json') and 'part' not in f};print('missing:',[f'{i:02d}' for i in range(64) if f'{i:02d}' not in have])"

A `batch-NN.partK.json` file is a half-finished batch: keep it, write the remaining words, merge into `batch-NN.json`, delete the parts. Rebuild and test after any change to a batch (see "Rebuild" below).

Possible next steps:

1. Review the paraphrases marked `"conf": "low"` (shown in the app as *yoxlanılmalıdır / needs review*).
2. Keep writing AI-written definitions for spellings that no print source covers (about 13,800 remain, mostly international loanwords). They go in `scripts/content/print-definitions/authored/batch-NN.json` (`batch-00` … `batch-18` are done) with the same entry format as paraphrases but no `src`: `{"word": {"az": "...", "en": "...", "pos": "noun"}}`, or `{"skip": "reason"}` when unsure. The builder refuses a word that either print dictionary covers, cites only the orthography page, and the app always marks these *yoxlanılmalıdır / needs review*. `python3 scripts/list_authoring_queue.py model.json izahli.sqlite musayev.sqlite 250` prints the next words, most useful first: a base word lets the suffix rules define its derivatives, so those come first.
3. Links: a word that has a paraphrase gets its suffix or compound link only when the paraphrase (or its print entry) names the base word, bare or inflected. A word that is itself another headword (*yerin*, *ətrafında*) does not count as an inflected form. So a paraphrase that could link should name its base word (*Nəm yerlərdə bitən zəhərli baldırğan növü.*). About 100 paraphrased words remain isolated; most are wrong splits (*ayrıqotu* is not *ayrı* + *qot*) or have a base of a word class the suffix rules skip.

4. **Picture quiz**: a separate page (`#sekil`) with 715 line drawings (539 OpenMoji, 176 drawn for SÖZ). Pictures must stay off the word map. `scripts/content/pictures/PLAN.md` lists what is built, the house style, and the next words to draw; README "Picture quiz" has the rebuild steps.

## How to write a paraphrase batch

1. Get the source PDFs (public, cited throughout the data):
   - Explanatory dictionary, four volumes: `https://www.urmu.eu/Azerbaycan_dilinin_izahli_lugeti_1.pdf` … `_4.pdf`
   - Musayev Azerbaijani–English: `https://urmu.eu/Azerbaycanca_Ingilisce_luget.pdf`
2. Build the local caches (needs `pdftotext` from poppler):

       python3 scripts/extract_print_dictionaries.py --explanatory v1.pdf v2.pdf v3.pdf v4.pdf --explanatory-db izahli.sqlite --bilingual musayev.pdf --bilingual-db musayev.sqlite

3. Write the evidence batches (they contain print excerpts; keep them out of git):

       python3 scripts/build_paraphrase_batches.py izahli.sqlite musayev.sqlite --out /tmp/soz-evidence

4. For each missing `NN`, follow `scripts/content/print-definitions/BRIEF.md` exactly: read `/tmp/soz-evidence/batch-NN.jsonl`, write `scripts/content/print-definitions/paraphrases/batch-NN.json` with every word as a key, and run the validation command in the brief.

Rules that matter: write new wording, never copy the print definitions (the build rejects any paraphrase sharing six consecutive words with its print entry, and the brief asks for no five-word reuse); name the base word where the word is a transparent derivation or compound, so it can be linked; one sentence of Azerbaijani ending with a period plus a short lowercase English gloss; use `{"skip": "reason"}` rather than guessing.

## Rebuild

    node scripts/export_print_definition_model.cjs model.json --without-print
    python3 scripts/build_print_definitions.py model.json izahli.sqlite musayev.sqlite
    python3 scripts/write_print_definitions_readme.py
    node tests/print-definitions-data.cjs
    python3 scripts/version_assets.py
    python3 scripts/build_offline.py
    node tests/offline.cjs

`version_assets.py` refreshes the `?v=` cache keys in `dist/index.html`; `build_offline.py` regenerates `dist/sw.js` and `dist/offline-package.json`. Run both whenever any file in `dist/` changes, or offline installs break.

## Deploy

Commit the rebuilt `dist/` and push to `soz-toxumasi`. Vercel deploys it to https://soz-toxumasi.vercel.app. Before calling the work live, check in the Vercel dashboard that the deployment is Ready, then open the site and the picture quiz (`#sekil`).

Vercel settings: Git connection at https://vercel.com/jasons-projects-ec574315/soz-toxumasi/settings/git, production branch at https://vercel.com/jasons-projects-ec574315/soz-toxumasi/settings/environments.

## Known test status

`scripts/run_tests.sh` was run on the last imported commit (`a1cbd6b`) and on this round's final build. These 20 tests failed before this round and still fail at the same assertion: additions-data, atlas-zoom-interactions, bilingual-interactions, complete-web-interactions, continuous-gathering, galaxy-data, galaxy-interactions, gathering-interactions, grammar-interactions, interactions, nominal-data, nominal-interactions, pinch-zoom, reference-completion, relation-audit-data, relation-audit-interactions (times out at 900 s), responsive-interactions, selection-magnet, verification-data, word-info-and-physics. Several check hashes or counts of data files that later layers legitimately changed, so they need updated expectations rather than reverted data. camera-selection, conjugation-page and conjugation-suffixes, which earlier runs lost to memory limits, pass. All other tests pass, including the new morphology and frequency-and-origins tests and offline.cjs.

Run tests a few at a time: data tests load ~100 MB of layers, and many in parallel can run out of memory. Tests that build their own `createModel` load the layers through `tests/layers.cjs` (or `boot({layers:true})` in the harness); the page itself does not.
