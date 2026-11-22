# SÖZ — Söz Toxuması

The active atlas lives in `dist/`, with data preparation scripts in `scripts/` and regression checks in `tests/`. This GitHub import is based on Sites version 57 (`fe0e3e5946c3d8b1006b8c9c50f14a0092f35927`).

The [original Söz Xəritəsi project](archive/sozler/) is preserved as it appeared in `jastocasto/sozler` at `67ac2835060e7bf94fa7fa43a8553ee8e64c02d4`. The archive includes its HTML, CSS, JavaScript, Flask backend, and dependency list. The legacy backend reads a Google Sheet and expects `SERVICE_ACCOUNT_JSON` at runtime. The current atlas runs from static files.

An Azerbaijani word galaxy following the supplied charcoal-and-serif concept. The persistent atlas fills the screen on desktop and mobile. Compact search floats above it; a shallow bilingual definition strip expands by tap or upward drag. Word of the day stays in a small shortcut, with the quiz, dictionary, saved words and grammar in the menu. Touch supports pinch zoom, pan, and bubble dragging. No cursor illustrations, EN/AZ switches or motion pause controls are included.

## Headword count and print-dictionary definitions

The atlas has **90,849 headwords** (`dist/word-count.json`): 22,207 dictionary entries with fixed atlas positions and 68,642 further spellings from the 2021 orthography dictionary (*Azərbaycan dilinin orfoqrafiya lüğəti*, 7th edition), placed in the separate Orfoqrafiya region. The orthography dictionary lists spellings only, so most of those entries started without a meaning, and many had no connection.

`dist/print-definitions.js` adds **52,067 definitions** to headwords that had none, and **31,867 cited links**. Headwords without any definition fell from 63,985 to 11,918; headwords without any connection fell from 30,802 to 11,287. Existing reviewed definitions, relations, block lists, identities and atlas positions are unchanged. Every new definition has a method label in the definition sheet:

- **17,587 paraphrases** (*Lüğət əsasında süni intellekt dəstəyi ilə yazılmış izah*): new Azerbaijani and English wording of the primary sense in *Azərbaycan dilinin izahlı lüğəti* (2006, four volumes) and/or Musayev's *Azərbaycanca–İngiliscə lüğət*, citing the PDF page. Paraphrases sharing six or more consecutive words with the print entry are rejected; print prose is cited, not republished. 737 paraphrases written from thin or garbled evidence are marked *yoxlanılmalıdır / needs review*.
- **3,591 derivation notes**: the explanatory dictionary states the formation (`"Abadlaşdırmaq"dan f.is.`), so the word gets a verbal-noun, passive, causative, participle or diminutive definition and a root link to its base.
- **410 cross-references**: the explanatory dictionary refers the word to another headword (`b a x`), whose definition it shares, with a synonym link.
- **26,119 rule-based definitions** (*Qayda ilə qurulub*): transparent productive suffixes (-sız, -lı, -lıq, -çı, -laşmaq and -laşdırmaq after a noun or adjective, -lanmaq after an adjective, -ma, passive -ıl, passive or reflexive -n of a -lamaq verb, causative -dır, and -t after a vowel or a polysyllabic -r/-l stem; from a verb, -ıcı for the doer (*göndərici*), -ış for the action (*baxış*), -ıntı for its result (*kəsinti*) and -maz for "that does not" (*qorxmaz*); -vari for "like" (*kisəvari*); Persian-origin -xana and -gah for a place (*silahxana*), -şünas and -şünaslıq for a specialist and the study (*torpaqşünas*), -pərəst and -pərvər for a devotee, -anə for manner (*məcnunanə*)) of a defined base; the instrumental -la, ablative -dan, -ca, -baz and relational -i have too many senses to define by rule, so they only link a word whose own definition names the base (*tatarca*: "Tatar dilində"); a quantity word with noun + -lı (*çoxbarmaqlı*, *ikimərtəbəli*), doubled converbs and nouns (*ağlaya-ağlaya*, *mərhələ-mərhələ*), diminutive -cıq/-ça, manner adverbs in -casına, place compounds (*qarınüstü*, *çənəaltı*, *relsboyu*) and "between" adjectives (*banklararası*), closed, paired and izafet compounds of defined words (including paired verbs opened by a converb, *bölüb-paylamaq*), compounds whose second part is a participle or verbal noun of a defined verb (*gülbecərən*: *gül* + *becərmək*; *hesabaçma*: *hesab* + *açmaq*) or a word governing the case of the first (*heyvanaoxşar*, *tərifəlayiq*, *rinqdənkənar*), borrowed words built on one stem (*psixologiya*, *psixoloji*, *psixoloq*; *-izm*, *-ist*, *-istik*; *-qrafiya*, *-qrafik*; *-metriya*, *-metrik*; *-ika*, *-ik*), which are linked, with the dependent member defined from its head where the sense follows, learned compounds linked to their head (*dendrofobiya* → *fobiya*, *aqroturizm* → *turizm*; the combining form must recur before at least three headwords), and learned prefixes (bio-, mikro-, kiber-, …). The definition describes the formation and links to its parts; it does not claim a lexicalised meaning. Closed compounds are not split where a longer headword plus a suffix explains the word (*konturlamaq* is *kontur* + -lamaq, not *kont* + *urlamaq*). Suffix and compound links are added to words that already had a definition only when that definition, or the primary sense of the word in the explanatory dictionary, names the base (bare or with a case, possessive or plural ending, as in *kədərsiz*: "Kədəri olmayan…"; a verb also by a participle or verbal noun, as in *gülbecərən*: "Gül becərən adam."); the 1,047 links confirmed by the print entry also cite that page.
- **4,360 AI-written definitions** (*Süni intellektlə yazılıb, çap lüğətlərində yoxdur*): spellings with no entry in either print dictionary, mostly international technical loanwords. They cite only the orthography page that attests the spelling, claim no print source, and are always marked *yoxlanılmalıdır / needs review*. They also serve as bases for the suffix rules.

2,788 further links join a paraphrased or AI-written word that is still unconnected to what its own definition is built on: the synonyms of a one-word or list definition (*eskalasiya*: "Kəskinləşmə, genişlənmə.", 635 links) or the class word that heads a descriptive one (*doker*: "Liman fəhləsi." → *fəhlə*; *angioma*: "Damar şişi." → *şiş*; 2,153 links). Words too general to help (*şəxs*, *yer*, *növ*, *etmə*) are skipped, and these links cite the definition's own sources.

The source PDFs use a legacy font that stores Azerbaijani Cyrillic in Windows-1251 byte positions; `scripts/extract_print_dictionaries.py` decodes them and rebuilds the local SQLite caches that `scripts/build_orthography_links.py` and `scripts/build_print_definitions.py` read. The caches are build inputs only and are not published. Rebuild:

    python3 scripts/extract_print_dictionaries.py --explanatory v1.pdf v2.pdf v3.pdf v4.pdf --explanatory-db izahli.sqlite --bilingual musayev.pdf --bilingual-db musayev.sqlite
    node scripts/export_print_definition_model.cjs model.json --without-print
    python3 scripts/build_print_definitions.py model.json izahli.sqlite musayev.sqlite
    python3 scripts/write_print_definitions_readme.py
    node tests/print-definitions-data.cjs

Paraphrases and AI-written definitions are editorial text under CC BY-SA 4.0, kept in `scripts/content/print-definitions/paraphrases/` and `scripts/content/print-definitions/authored/`; method, sources and hashes are in `dist/print-definitions-attribution.json`. This is not native-speaker verification.

## Run

Serve `dist` with any static HTTP server or open `dist/index.html`. No build/runtime dependencies or external fonts are required.

## Continuous magnetic selection and intact labels

Tapping a word fixes its currently displayed position to a world anchor, then pans the camera until that anchor reaches the usable center. The background and every displayed world point move with the camera; only related words move independently on their springs. Selecting another word mid-flight retains its position, radius and momentum. Selection preserves orientation while smoothly panning and zooming over 1,050 ms to the standard selected bubble size. Radius follows camera-travel progress, not an independent spring. New neighbors start at their actual projected coordinates; only invisible distances are compressed, keeping the source direction and a starting point beyond the viewport edge. Former neighbors shrink and return toward their atlas locations instead of disappearing on selection. Only tiny retired dots are removed on subsequent refreshes; the original atlas data remains fixed.

Springs move the family, contact impulses provide rebound, and space-aware radius growth prevents dense groups from expanding into a costly collision pile. Bounds engage as words approach their slots, so they do not clamp incoming offscreen words to the border. The selected word is fixed to its projected world anchor during camera travel and becomes the stable center after arrival. Lines follow those live positions throughout. Animation then sleeps. Reduced-motion preferences use the immediate accessible layout; hiding the page suspends and resumes the movement without consuming its remaining animation time.

Canvas and SVG labels fit whole lexical words without character splitting or ellipses; multiword expressions can break at spaces. The selected bubble has a consistent size for its screen layout; long words fit using type sizing. The selected definition title is measured to fit, forced mid-word CSS wrapping is removed, and narrow quiz/dictionary cards use one column. The conjugation wheel retains its one stationary stem and fitted suffixes, with compound prefixes fitted as whole text.

    node tests/whole-word-labels.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/whole-word-page.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/continuous-gathering.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/complete-web-interactions.cjs

## Full-page verb wheel

The conjugation page fits its primary controls and a live English meaning into the viewport. A compact navigation strip replaces the introductory heading, one thin pill outlines the selected suffix row, and the wheel fills the space between the controls and bottom meaning. Short landscape screens use two columns. Source notes and the preserved archive are available through the header's ellipsis menu, with their own scroll area. Very short portrait viewports (under 450 CSS pixels, including heavy accessibility zoom) retain a scroll fallback to avoid clipping controls.

The English line follows the visible tense/person during dragging and settling, as well as polarity, question and verb changes. It distinguishes, for example, `yazdım` → “I wrote”, `yazmışam` → “I have written” and `yazacağam` → “I will write”. All 2,638 dictionary verb profiles have an English teaching equivalent; the defective `imək` remains excluded from the ordinary conjugation UI. English morphology includes irregular principal forms, auxiliary agreement, stative verbs, phrasal verbs, negation and questions. Nonfinite forms show phrases, not fabricated sentences. The primary dictionary sense is selected; exact translations depend on context. `scripts/conjugation-english-review.json` records AI-assisted editorial normalizations for malformed/non-verbal source glosses without modifying the dictionary. These are learning equivalents, not a claim of native-speaker review of every generated sentence.

**Fel təsrifləri** opens a separate, reloadable page (`#grammar=qaçmaq`) with a back link to the existing map. The verb stem is drawn once, at a fixed anchor. Only the suffixes recede and fade vertically; sideways dragging moves adjacent person endings continuously through the same field. The six pronouns above the wheel highlight the current person. Clickable pronouns, category shortcuts, tense arrows and keyboard arrows provide alternatives. Nonpersonal forms explicitly explain why they do not change by person. A muted ∅ denotes an empty ending. Reduced motion preserves direct dragging and snaps programmatic changes.

Typed autocomplete searches **2,638 dictionary infinitives**, including compounds, by Azerbaijani word/stem or English meaning. The user must choose a dictionary entry; unknown words, non-verbs and prototype property names cannot reach the generator. The defective copula `imək` remains searchable but is excluded from ordinary generation, leaving **2,637 supported verb entries**. Invalid deep links remain inactive rather than silently showing a different verb. The current tense, person, polarity and question setting are reloadable in the URL.

The rule engine covers **39 form families**: the principal tenses and their past/reported forms, imperative, optative, necessity, conditional, analytic ability, participles, verbal adverbs, verbal nouns, possessed participles and all five oblique infinitive cases (the uninflected infinitive is the nominative). Positive/negative and personal question forms are available where appropriate. This is broad standard coverage, not a claim to include every voice, dialect, register or possible combination. Morphological voice derivatives remain separate dictionary infinitives.

`dist/conjugation-engine.js` applies vowel harmony, buffers, stem alternations, future and infinitive softening, person endings and negation. `scripts/build_conjugation_wheel.py` builds the dictionary gate, source-supported stems, inherited compound profiles and compact exact-form evidence masks from the existing English Wiktionary/Kaikki snapshot. Explicit additional t/d profiles are recorded in `scripts/conjugation-stem-review.json`. Forms matching the corresponding source table cell are labeled **mənbədə göstərilib**; all other forms are labeled **qayda ilə qurulub**, with provenance and limits in `conjugation-attribution.json`. Malformed table spellings are not blindly copied. New rules and profiles are AI-assisted editorial work, not comprehensive native-speaker verification.

All 991 original archive records remain accessible in an expandable section on the page, with their existing search, pagination and download. Opening a supported archived form selects its actual tense, person and polarity. Unsupported forms still open their preserved archive results. Page navigation suspends the map and cleans up active gestures; returning restores it.

Map pinch gestures transform the existing SVG/canvas drawing during movement and commit the layout once at release. They work when starting on a word or region label, retain the midpoint anchor, and do not rebuild the touched DOM on each pointer movement. Pinching inward beyond the fitted group enters the wider atlas instead of stopping at 1×. The original dictionary, grammar archives and permanent atlas coordinates are unchanged.

    node tests/conjugation-data.cjs
    node tests/conjugation-english.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/conjugation-meaning.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/conjugation-page.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/conjugation-suffixes.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/pinch-zoom.cjs

## Persistent word galaxy

All **20,219 dictionary entries** have fixed `(x, y, z)` coordinates in one navigable atlas, organized into **10 regions and 55 smaller groups**. The user can zoom from the whole vocabulary into a region, a cluster and individual words. Search, relationship chips, the daily word, quiz review and saved words all open the same centered magnetic view. Search and word taps pan the current background and gather words from their projected or currently animated positions. Both keep the current orientation; the camera pans and zooms to center the selected world anchor at a consistent bubble-to-screen ratio. Explicit region and universe navigation still uses the atlas camera transition. There are no global force-layout calculations in the browser.

`dist/galaxy-data.js` is generated offline by `scripts/build_galaxy.cjs` using `scripts/galaxy/taxonomy.cjs`. Explicit editorial anchors place beauty, ugliness, kindness and harshness in separate groups within Descriptions, and verbs in Actions. Other assignments use primary English definitions, part of speech, and documented root/synonym neighbours. Words without enough evidence remain in the broad Concepts area. Grouping is approximate: it is an aid to exploration, **not** a new synonym, etymology or linguistic-distance assertion. Polysemous words have one primary map location. Only documented relationships become coloured strings. Foreground strings use the actual displayed bubble positions; the canvas never draws a second selected-word fan from fixed atlas coordinates. See `dist/galaxy-attribution.json` for counts, method coverage and source hash.

The atlas renders every visible word as one Canvas 2D circle at its permanent projected coordinate. The circle grows continuously with zoom; its label fades in inside that same circle. There is no threshold swap to a different set of bubbles, no detached featured-word labels, and no limit on which visible words can become labeled. Camera depth and tilt remain geometric. At readable scales, a spatial grid limits circle radii to fit the projected spacing without moving words or allowing overlap. Tiny overview marks can share pixels; they avoid expensive collision work. Region headings withdraw as word labels become readable. Every atlas line uses the exact same projected endpoints as the word circles and represents an existing lexical relation.

Tapping any circle gathers every direct neighbor into a centered SVG magnetic group with hard collision constraints, dragging and damped rebound. The surrounding gray word circles remain visible and yield to the gathered family. All 19,855 documented edges are eligible for drawing: static edges use the canvas, edges incident to moving bubbles use SVG, and long lines crossing the viewport are retained even when both endpoints are offscreen. Only edges incident to the selected word become relationship-colored. The animation settles completely and the render loop sleeps; dragging or selection wakes it again. All other atlas navigation stays in the stable map. Transparent SVG controls give the nearest readable words keyboard focus (72 on narrow screens, 120 on wide screens); these draw no duplicate bubble. All visible circles remain pointer selectable through radius-aware hit testing. The complete relationship list remains available in the expanded definition sheet. The dictionary, relationship records, grammar archives and all 20,219 map positions are unchanged by this renderer update.

The distant canvas repaints during the camera pan and otherwise only when the view changes, rather than on every local physics frame. A sweep broad phase limits collision checks to nearby bodies; no whole-atlas physics simulation runs. Dense families retain their source positions and enlarge only as space opens around them, avoiding a costly pileup. Offscreen words are culled, pixel density is capped at 2, and background tabs suspend animation. OS reduced motion skips camera flights and spring animation while preserving navigation and non-overlap. Search and dictionary lists make all entries accessible without precision tapping on dots. Readable atlas circles and magnetic SVG bubbles support keyboard selection; the map supports arrow-key pan, +/− zoom and Home for the whole atlas. The definition strip has a keyboard-operable expand button as well as a swipe gesture.

`axtar` is now the search field itself. The ambiguous `nisbətən` toggle has been replaced by continuous zoom, clickable region labels and the universe/selected-word controls. All original definitions, source attribution, grammar archives, bookmarks, frozen daily words and quiz content are preserved.

Rebuild the current additions and atlas:

    python scripts/build_additions.py
    node scripts/build_galaxy.cjs
    python scripts/version_assets.py

The committed `scripts/galaxy/layout-base.json` preserves all 19,652 earlier coordinates. New entries extend their topic clusters without moving existing words.

## Gathering connections and 567 more words

Tapping a word gives it a warm amber fill and dashed halo. Its direct connections rapidly gather into a compact local arrangement, while the selected word travels from its current position into the center of the usable map area. Synonyms, antonyms and root-family words are placed before ending and topic connections. The stronger, damped spring attraction retains contact rebound and dragging, then settles to rest. Contact and screen-boundary constraints prevent bubbles from overlapping or escaping the usable stage. While a bubble is being dragged the group can respond; releasing it restores the selected center. Only close-up display coordinates change. Pinch, wheel and zoom controls enlarge that same arrangement; background dragging pans it. The fit control restores the entire family and recenters it. Background touch movement cannot exit this view. Use Kainat or an explicit region button to return to atlas exploration.

The arrangement measures available screen space and reserves the search, definition and map-control areas. All 19 connections of `gözəl`, including the opposite cluster's `çirkin`, fit a 390 × 844 phone. Larger families shrink to fit together as one zoomable group, with no paging or neighbor cap. For example, all 132 neighbors of `tibb` gather at once. Small circles gain labels as they are enlarged. Extremely short embedded windows can pan the complete group when it cannot physically fit. No documented relation is silently omitted; the expanded sheet also lists the complete set. Reduced motion places bubbles directly in their gathered slots. Pointer jitter below six map pixels is ignored, active gestures are cleaned up on selection/resize/backgrounding, and pointer coordinates are converted into SVG coordinates to support scaled displays.

`dist/additions.js` adds **567 single-word headwords**: 114 medicine, 121 biology, 120 earth science, 68 mathematics, 86 engineering and 58 arts/crafts entries. Every addition has an original Azerbaijani and English definition and an explicitly labelled topic link. Five variants already represented were excluded. No conjugations, cases, plurals or invented synonym/root links were added. The definitions are AI-assisted editorial material with limited terminology spot-checks, not a claim of comprehensive linguistic review or frequency ranking. Source records and exclusions are in `scripts/content/additions`; attribution is in `dist/additions-attribution.json`.

The prior data layers, both grammar archives, all earlier nodes and edges, daily-word schedule and quiz bank remain unchanged. `dist/word-count.json` gives current totals; `nominal.js` keeps its original historical separation counts.

## Vocabulary and sources

The main web now contains **20,219 distinct dictionary entries: 17,707 single words and 2,512 phrases or compound terms**. Case, plural and possessive inflections are excluded from this total. The earlier expansion added **6,744 distinct dictionary headwords**, without generating new conjugations or noun paradigms. Its source definitions come from Turkish and Russian Wiktionary through Kaikki; the displayed definitions are now Azerbaijani and English. This is a dictionary collection, not a frequency ranking.

The existing 32,659-row collection is preserved byte for byte in `dist/data.js` and `dist/lexicon.js`. The app moves 538 exclusively inflectional entries out of the main search, graph, random picker and dictionary. `dist/grammar.js` holds 991 verb–form records, including separately archived verbal senses of homonyms. Base verbs and derived infinitives such as `eləmək`, `etdirmək` and `alınmaq` remain in the main web. Negative infinitives belong in Grammar. Independent noun/adjective senses remain in the web. Nominal inflections are preserved separately in Forms.

The **qrammatika** tab searches by base or conjugated form, groups records by base verb, links back to the word web and offers `grammar-archive.json` for later development. That export includes the archived senses, tags, original associated rows and relationships. It is a preserved starting point, not a complete conjugator. Old bookmarks are retained; saved conjugations open Grammar. Old word links resolve to their base where available, or open the archive. A conjugation entered in main search offers its base and an explicit Grammar shortcut.

`dist/vocabulary.js` contains the additional headwords and documented connections, including links from older entries to newly available words. Imported material is CC BY-SA 4.0. Source editions and headwords are stored per entry. The main meaning card displays Azerbaijani and English together and links to the original source page. Original bilingual definitions and 52 authored examples remain intact.

Attribution, adaptations and dated source hashes are in `dist/LEXICON-LICENSE.txt`, `dist/lexicon-attribution.json` and `dist/vocabulary-attribution.json`. No roots or synonyms are inferred merely from shared spelling or glosses.

Rebuild the original import and subsequent non-destructive views with Python 3:

    python scripts/import_lexicon.py /path/to/az-enwiktionary.jsonl dist/data.js
    python scripts/separate_grammar.py /path/to/snapshot-directory

The latter directory must contain `az-enwiktionary.jsonl`, `az-trwiktionary.jsonl` and `az-ruwiktionary.jsonl`, from these Kaikki indexes:

- https://kaikki.org/dictionary/Azerbaijani/index.html
- https://kaikki.org/trwiktionary/Azerice/index.html
- https://kaikki.org/ruwiktionary/Азербайджанский/index.html

## Headwords and Forms

The **formalar / hal və cəm** tab preserves nominal inflections separately from the web. `otaqda`, `otaqdan` and `otaqlar` resolve to `otaq`; they are not separate headwords. This removes **21,092 inflection-only entries** from the previous 40,746-entry main view and merges **two capitalization aliases**, leaving **19,652 entries**. The single-word count is **17,140**; **2,512** entries contain spaces and are phrases or compound terms. This is a count of dictionary headwords, not word senses or a frequency-ranked vocabulary list.

The non-destructive `dist/nominal.js` overlay uses documented source analyses, not suffix stripping. It retains independent derived words such as `kitabça`, `müəllimə`, `gözlük` and `elətdirmək`, lexicalized adverbs, borrowed lexical plurals, and homonyms such as `ölüm` (death), `sənə` (year), `məni` (sperm) and `gəlir` (income). Their grammatical readings are kept only in the archives; obsolete form labels and form-only graph links are suppressed. Words such as `dollar` and `çalar` are not removed merely because they end in `-lar`.

Forms contains **21,145 word–base records across 21,141 spellings**, including separately archived senses of homonyms that remain in the web. Each analysis has Azerbaijani and English explanations; alternate analyses can be expanded. Search by a form, base or meaning, browse in pages, and open the base in the graph. Saved forms are retained and open the appropriate archive. Old form links resolve to the base when available. `dist/nominal-archive.json` exports these analyses together with their original rows and relationships. The existing 991-record verb archive is unchanged.

All original data layers, all 795 recent additions and the frozen daily/quiz data remain byte-for-byte intact. `dist/word-count.json` records the count policy, source hash and preservation hashes. The archive is a preserved dataset for future grammar development, not a complete case generator. The source dictionary and translation limitations described below still apply.

Rebuild from the same English Wiktionary snapshot:

    node scripts/export_nominal_input.cjs /path/to/pre-nominal-view.json
    python scripts/build_nominal.py /path/to/pre-nominal-view.json /path/to/az-enwiktionary.jsonl

`nominal-reviewed-forms.json` records explicit plural/pronoun corrections; `nominal-translations.json` supplies three missing lexical translations. The source export deliberately omits the nominal overlay so rebuilds always start from the preserved earlier view.

## Definition-to-relation audit

`dist/relations.js` adds a non-destructive layer of **763 connections**: **505 synonyms, 168 documented root/derivation links, six antonyms and 84 type/part/topic links**. Nineteen redundant yellow links are replaced by more specific relationships; three existing synonym links gain explicit sense context. The graph has **19,855 edges** across the same **20,219 headwords**. **417** previously isolated words now have a connection. `şallaq ↔ qamçı` is green in both directions, supported by the Turkish entries' shared `kırbaç` sense and the English `whip` gloss. Clicking through a relationship shows its Azerbaijani/English sense and actual source links.

All 20,219 definitions were scanned for references to existing headwords. Of 2,488 missing candidate synonym links, 860 had matching part of speech and an English gloss in common. Every one of those 860 received an AI-assisted editorial decision: 494 accepted for a specified sense and 366 held. The remaining 1,628 matches are not asserted as synonyms. Another 824 explicit dictionary/etymology candidates were screened; loose related-term metadata and erroneous source classifications are held. Source labels alone are insufficient: for example, a hippopotamus is a mammal, not a biological amphibian, and `titrləmə` (titration) is not derived from `titrəmək` (trembling).

Thirty-one explicit bilingual definition corrections resolve polysemy and translation failures, including `miz` (furniture table), `artikl` (grammatical article), `ban` (rooster's crowing), `küncüd` (sesame) and `xaya` (testicle). The original dictionary layers, grammar archives, frozen daily/quiz pool and every galaxy coordinate remain unchanged. This is an AI-assisted, candidate-based review, not professional validation of the entire lexicon. Synonymy is reciprocal and sense-specific; no transitive closure, blanket English-gloss matching or inferred suffix roots run in the browser.

The two definition review files, `scripts/content/relations/source-review.json` and `manual.json`, preserve explicit decisions and reasons. `dist/relations-attribution.json` includes source excerpts, hashes, accepted/held counts and limitations. Rebuild the reviewed overlay and cache keys without re-laying out the galaxy:

    node scripts/build_relations.cjs
    python scripts/version_assets.py

To repeat source extraction, use `scripts/audit_relation_sources.py` with the original six offline Kaikki snapshots and a nine-argument `createModel` export (nodes, word-pair edges and aliases), deliberately excluding the new relations overlay. Candidate extraction does not approve a relation.

## Earlier vocabulary and relationship review

`dist/review.js` adds **1,086 distinct words and expressions**: 545 additional headword entries from French, German and Kurdish Wiktionary, plus 541 explicitly glossed derived/related terms from English Wiktionary. Infinitive verbs remain eligible; conjugation-table forms and negative inflections are excluded. Original source-language text is preserved in the source data; the UI uses the bilingual display layer. Existing `data.js`, `lexicon.js`, `vocabulary.js` and the Grammar archive remain unchanged.

Semantic edges are reciprocal, never globally transitive. Their source sense, part of speech, register and source page are retained. Clicking a relationship displays this context in the meaning card. Different words can have different numbers of documented synonyms. A reviewed six-word temporal-sense family links `həmişə`, `daim`, `daima`, `hər vaxt`, `hər zaman` and `hər an`; this is an explicit editorial group, not graph-wide synonym closure.

The audit found eight pairs with contradictory synonym/antonym labels and three additional incorrect talkative/silent synonym links. Eleven targeted corrections resolve these. General conflict handling preserves but suppresses unresolved contradictory pairs for later review; none remain after this review. See `dist/relationship-audit.json` for the changes, references, source versions and hashes. It is a targeted audit, not a claim that every dictionary relationship has been reviewed by a linguist.

Reproduce with the three earlier snapshots plus `az-frwiktionary.jsonl`, `az-dewiktionary.jsonl`, `az-kuwiktionary.jsonl` and their `*-source.json` metadata files:

    python scripts/expand_and_review.py /path/to/snapshot-directory

## Azerbaijani and English definitions

Every one of the 20,219 main entries displays both Azerbaijani and English, together and without a language switch. Search previews, library rows, additional senses, grammar records and relationship explanations also use these two languages. The original source data remains byte-for-byte unchanged, including the Grammar archive.

`dist/bilingual.js` stores exact-source-text translation pairs and editorial definitions. The build fails if any required translation is missing. Existing bilingual entries remain intact. Missing definitions and additional senses use cached Google Translate results and 922 AI-assisted editorial translations (plus two source typography corrections); visitors never call a translation service. Machine-translated primary definitions carry a discreet label. Common selected entries have edited definitions; the full translation corpus has not received a linguist's review.

The model localizes the active word records before English/Azerbaijani meaning search and rendering. Original records and source citations remain accessible separately. Russian and other source-language glosses are never used as a display fallback. `dist/bilingual-attribution.json` records coverage, translation method and the cache hash. Translated dictionary material retains the source CC BY-SA 4.0 attribution.

Rebuild with the source snapshot and translation cache:

    node scripts/export_bilingual_snapshot.cjs /path/to/model.json
    python scripts/translate_definitions.py /path/to/model.json /path/to/translation-cache.jsonl
    python scripts/build_bilingual.py /path/to/model.json /path/to/translation-cache.jsonl

The translator numbers each batch and checks alignment before saving; results are reusable across retries. It stops on service rate limits and preserves completed work. Editorial definitions are maintained in `scripts/definition-overrides.json`; exact-source-text translation edits are maintained in `scripts/translation-edits.json` and applied by both scripts.

## New vocabulary, daily word and quiz

This update adds **795 distinct lexical entries**: 732 single words and 63 established multiword terms, covering science, medicine, technology, finance, arts, education and everyday social life. They have original Azerbaijani and English explanations, with AI-assisted editorial attribution. Duplicate headwords, overlapping additions and four spelling variants of existing words were excluded. No conjugations or generated nominal forms were added. Each entry has a topic connection to an existing word; these connections make no synonym or root claim.

Sources and spelling checks are documented in `dist/expansion-attribution.json`. The references support selected terminology and spelling, not a claim of full linguistic review. Earlier data, translation overlays and the Grammar archive remain byte-for-byte intact. The new data is separate in `dist/expansion.js`, built from the records in `scripts/content`.

**Günün sözü** shows the same daily word to everyone, changing at midnight in `Asia/Baku`. Its editorial rotation draws from advanced literary and academic headwords with both Azerbaijani and English meanings, without repetition during a cycle. The visible page checks for a date change every 30 seconds and when returning to the app. Opening the daily card refreshes it immediately. Both meanings, available examples, and a link into the word web are provided. This is a local calendar calculation; it needs no account, network request or scheduled automation.

**Özünü sına** gives ten-question rounds drawn from 75 explicitly written bilingual definition questions, including 15 on newly added vocabulary. Each question has three individually selected distractors and one answer. Choices are shuffled, questions do not repeat within a round, and feedback explains the answer in both languages. The result view links every word back to the graph and offers a missed-word-only retry. Closing the quiz keeps the current round in memory; reloading starts a fresh round. Best scores and the number of completed full rounds are saved in this browser, with a session-only fallback if storage is unavailable. Reviews do not inflate the best score. No timer or external tracking is used.

Build these additions:

    python scripts/build_expansion.py
    python scripts/build_learning.py

`daily-words.json` is deliberately frozen; ordinary rebuilds must not reshuffle it. `quiz-content.tsv` contains the authored clues and distractors.

## Interaction

Blue = root/family/derived word; green = synonym; red = antonym; dashed purple = spelling/ending similarity; gold = documented topic or semantic relationship. The persistent atlas shows the whole collection at overview scale; the selected-word layer gathers direct connections, and the definition sheet lists every direct connection. Main search covers the main collection; Grammar and Forms have their own searches. Azerbaijani, diacritic-free and English searches are supported. Exact Azerbaijani spelling takes priority. Bookmarks stay in the browser.

The pause/play button is removed. Spring interactions are always enabled, with damped rebound that settles to a stopped position. Hidden documents suspend work until visible again, and the OS reduced-motion preference is respected.

The fixed-step spring simulation uses scale-aware hard contact constraints and collision impulses. Separation runs at initialization, during physics, before rendering, and along pointer-drag paths, including while paused. Collision bounds include maximum bubble squash/stretch. Degenerate piles have a deterministic non-overlapping recovery path. Bubble labels and word-type labels stay inside their bubble. The selected-word control returns to its permanent map location and gathers its connections; the universe control shows the entire atlas.

## Verification

The complete-web checks cover every recorded edge (including long crossing lines), one rendering layer per connection, the 132-neighbor `tibb` family without paging, gray context, selected-edge colors, exact live endpoints, per-frame non-overlap, zoom/pan/fit, context selection, drag rebound and complete settling on phone, landscape and desktop.

    node tests/complete-web-data.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/complete-web-interactions.cjs

The atlas-continuity regressions follow specific words from dots through the former 0.20 zoom threshold into fully labeled circles, comparing every center against the permanent projection. DOM/canvas checks cover every intermediate zoom frame, actual drawn circles, line endpoints, transparent hit targets, touch selection, round-trip zoom, pinch/pan, reduced motion and idle rendering.

    node tests/atlas-continuity.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/atlas-zoom-interactions.cjs

The `zorakılıq` regression reproduced both exits from the magnetic view: zoom controls and one-pixel background touch jitter. Tests now cover its exact five connections, centered selection, line endpoints tied to rendered bubbles, viewport containment, and selection through search, bubble taps, history, URL hashes and overview points. They also check gesture continuity and rapid reselection.

Browser assets receive content-hashed query keys via `scripts/version_assets.py`. Re-run it after editing served JS, CSS or the icon. An already-open older tab still needs one refresh to load the corrected page.

Node tests cover all entries' definitions and provenance, exact/transliterated/English search, dictionary counts, source forms, unique valid edges, bounded neighborhoods, spring overshoot, contact rebound, and separation on every sampled frame. Collision tests include coincident starts, 48-body piles, maximum scale/stretch, dragging through neighbors, paused dragging and release. DOM tests cover automatic meaning cards, bookmarks, search, filtering, pagination, pinch, drag/cancel, resize and reduced motion.

The managed browser tool is unavailable in this environment. Browser CSS rendering has not been visually verified; DOM checks are not screenshot tests.

    NODE_PATH=/path/to/linkedom/node_modules node tests/selection-magnet.cjs
    node tests/additions-data.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/gathering-interactions.cjs
    node tests/galaxy-data.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/galaxy-interactions.cjs
    node tests/nominal-data.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/nominal-interactions.cjs
    node tests/learning-data.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/learning-interactions.cjs
    node tests/bilingual-data.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/bilingual-interactions.cjs
    node tests/relationships.cjs
    node tests/relation-audit-data.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/relation-audit-interactions.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/relationship-interactions.cjs
    node tests/grammar-data.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/grammar-interactions.cjs
    node tests/expanded-lexicon.cjs
    node tests/word-info-and-physics.cjs
    node tests/collision-constraints.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/interactions.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/responsive-interactions.cjs

## Explicit reference entries and selection sizing

The reference layer adds 1,372 headwords and expressions, bringing the map to 21,591 entries. Each has an Azerbaijani and English meaning and at least one reciprocal source-supported connection. The source records explicitly supply a standalone meaning, an inline gloss (such as `nazil etmək` and `nazil olmaq`), or a sense-level synonym. Synonym-derived entries carry a usage note limiting the imported definition to that source sense. Public gloss translations are machine-assisted; the two nazil expressions have editorial Azerbaijani definitions. Original dictionary, grammar archives, and definitions are preserved. The fixed atlas baseline now includes all 20,219 prior positions, so adding the reference layer does not shift existing words.

`references-attribution.json` records provenance per entry. `scripts/content/reference-audit.json` retains 5,609 unresolved references without enough evidence for an independent definition. These are research candidates, not invented meanings or synonym claims. Known inflections, archived forms, and capitalization duplicates are excluded. The audit covers explicit structured lexical references and linked inline glosses in the six existing Kaikki source snapshots; ordinary words appearing in definition prose are not automatically treated as lexical entries or synonyms.

The selected circle uses a consistent smaller default radius, with whole-word type sizing. Zoom commits use the new layout's target radius directly, rather than multiplying an unfinished growth radius; zooming in, out, and resetting stay consistent while ordinary selection retains continuous motion. A fresh real-time animation clock is started after idle periods, preventing newly selected words from immediately sleeping at unfinished positions and sizes.

    node scripts/export_reference_model.cjs /tmp/reference-model.json
    python scripts/audit_references.py /tmp/reference-model.json /path/to/kaikki-snapshots /tmp/reference-candidates.json
    python scripts/build_references.py /tmp/reference-model.json /tmp/reference-candidates.json scripts/content/reference-audit.json /path/to/translation-cache.jsonl
    node scripts/build_galaxy.cjs
    python scripts/version_assets.py
    node tests/reference-completion.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/selection-sizing.cjs

## Camera follows the selected anchor

Selection now moves the view rather than independently carrying the selected word across a stationary atlas. A word already gathered into the foreground uses its current displayed position as the new world anchor, preserving continuity on rapid retargeting. The background, surrounding bubbles, and static line endpoints share the camera transform. Incoming offscreen neighbors retain their approach direction while invisible distances are compressed, and collision constraints remain active. Related words approach from their displayed or offscreen positions instead of spawning in final slots. Selection from a distant dot zooms the view in; selection from an oversized close-up zooms the view out to the same standard radius. Reduced motion uses the same final camera position immediately; page suspension preserves the remaining travel time. No dictionary data or permanent atlas coordinates change.

    NODE_PATH=/path/to/linkedom/node_modules node tests/camera-selection.cjs

## Visible arrivals and equal family bubbles

Related words now remain at their current positions during the camera transition. After framing completes, a brief 100–200 ms stagger releases their springs, so the inward flight and contact rebound remain visible instead of finishing behind the camera movement. Offscreen distances are compressed along the source direction; there is no insertion into a final slot. Rapid selection clears waiting state on the new selected anchor. Pinch, pan, resize and drag interruptions release pending arrivals, and page suspension preserves their remaining delay. Reduced motion retains the immediate layout.

All circles in the gathered family use the same radius as the selected circle. Dense groups extend farther across the map rather than shrinking their neighbors; the caption invites panning when the group extends beyond the viewport. Highlighted strings increase from 1.35 to 4.05 px, with rounded ends and stronger opacity; background strings remain thin and subdued. Dictionary data and permanent atlas coordinates are unchanged.

    NODE_PATH=/path/to/linkedom/node_modules node tests/visible-arrivals.cjs

## Daily and practice word races, and offline installation

The menu's **Söz yarışı** offers **Gündəlik / Daily**, a shared challenge rotating at midnight in Asia/Baku, and **Məşq / Practice**, repeatable random challenges. **Yeni sözlərlə məşq** starts a fresh pair while keeping the daily challenge unchanged. Practice avoids repeating either word from the immediately preceding round and skips recently played pairs when alternatives exist. Daily and practice scores use separate IDs; a practice pair can also be explicitly replayed to improve its record. The committed bank contains 340 challenges with documented 3–5-edge routes. Players may tap any readable visible map word, including unrelated words, and find their own route across galaxy regions. Manual pan, zoom, bubble dragging, galaxy navigation and search are disabled during the race; automatic camera motion after a word selection remains enabled. Each word-selection tap (including selecting the same word again) and each valid Back action counts; pan/zoom gestures do not. Search, dictionary selection, quiz jumps, grammar routes and relationship chips cannot bypass the map during a race. Timing starts after the starting word reaches the center and ends after the selected target reaches the center. The timer continues while the app is in the background.

Fastest time and fewest taps are ranked independently in local storage, with routes recorded and results shareable as text. There is no online leaderboard or account synchronization. Screen size and device speed can affect scores. Challenge IDs include a hash of the bank so an updated bank cannot overwrite scores for a different route. Reloading abandons an unfinished run; completed results remain on the device. The engine checks documented graph reachability but prescribes no route or same-neighborhood restriction. There is no claim that its documented path is globally shortest under the rule allowing unrelated visible-word jumps.

**Oflayn istifadə üçün yüklə** downloads the full static application, dictionary, grammar archives, game data, attribution and icons (about 56 MiB). It is an explicit download, not an automatic large transfer. A service worker checks each file against its build-time SHA-256 before atomically marking a package ready. Login/error responses and partial downloads cannot replace the previous complete package. The current and previous completed versions are retained; older packages are pruned. Online navigation fetches the current page, with the completed package as an offline fallback. A versioned script or stylesheet is served from the package only when its requested content hash matches; a current page never silently receives an older same-name script. Older packages without hash metadata remain usable through digest validation. Updates reuse unchanged verified files from the previous package. An available service-worker update exposes a manual update prompt in the menu; refresh after downloading an update. Browser storage eviction or clearing site data requires another download.

On iPhone: Share → Add to Home Screen, then open that installed app and complete its offline download. Other supporting browsers expose an install button. The AZ network logo has 192/512 px maskable PNGs and a 180 px Apple touch icon. This Site retains its existing access permissions. An initial online visit and completed download are required; source links to external dictionaries still require internet. Installed browser behavior and airplane-mode reopening have not been visually tested because managed browser tooling is unavailable. Automated service-worker tests use a simulated cache/network, not a real phone.

Build order after any served-file changes:

    node scripts/build_race.cjs
    python scripts/version_assets.py
    python scripts/build_offline.py
    node tests/race.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/race-ui.cjs
    NODE_PATH=/path/to/linkedom/node_modules node tests/race-finish.cjs
    node tests/offline.cjs

Origins and frequency research are deferred under the user's race-then-offline priority. Unpublished research is saved outside `dist` in `/workspace/soz-sources`; the map, dictionary relations and word metadata have not been changed in this release.

Offline download compatibility: the host returns a 307 redirect for `/index.html`, so the package fetches the canonical scope root for that file and saves it under both cache aliases. SHA-256 validation still checks the original page bytes. The download button checks for an updated worker before starting; download timeouts reset with progress. The offline test reproduces the index redirect and confirms the downloader never requests that redirecting URL.

Race navigation lock: the renderer blocks drag, pinch, wheel and map-navigation keys during a race, as well as public galaxy/zoom actions. Disabled/hidden controls and the selection guard also block search and navigation shortcuts. A plain bubble tap and the existing counted Back action remain valid. Ending the race restores ordinary map navigation.

    NODE_PATH=/path/to/linkedom/node_modules node tests/race-navigation-lock.cjs

Update recovery: the original cache-first navigation and query-insensitive asset lookup could keep an installed app on old race rules. The worker now prefers live HTML when online and validates versioned asset matches. Old completed packages remain immutable offline snapshots. Reopening an already old controlled tab may still need one offline update and reload to migrate to this behavior; no reinstall is required.

    NODE_PATH=/path/to/linkedom/node_modules node tests/race-practice.cjs
