/* Individually annotated readings by Mozilla Common Voice Azerbaijani contributors (CC0).
   Clip membership was verified against the July 2022 Common Voice 10.0 Azerbaijani splits:
   https://github.com/IS2AI/TurkicASR/tree/faeaa78f34ab4dc36c1eb5e9034ddeb7b6f877a8/training/conf/filelists
   https://github.com/common-voice/cv-dataset/blob/65ca2460d5e686ea03902a932bbca09b322dc4b0/datasets/scripted-speech/cv-corpus-10.0-2022-07-04.json
   Original recordings and text dedication: https://github.com/mozilla/legal-docs/blob/aa53f562cf4ce921f6397f159c251d2054e3e674/en/common_voice_terms.md
   Exact MP3 bytes and corresponding transcripts: FamilFG/Speech-Recognition-System-for-aze,
   commit 330aac76caf823098d02191b72acdd03d2112002, data/clips/common_voice_az_<number>.mp3
   and data/{train,dev,test}.tsv. No recording speed or words have been changed. */
(function(root){
'use strict';
const readings = [
 {
  number: 28841731,
  az: "Kəndin yerində müasir qəsəbənin inşası planlaşdırılırdı.",
  en: "A modern settlement was being planned on the site of the village.",
  word: "inşa",
  surface: "inşası",
  wordEn: "construction",
  question: "At what stage was the proposed settlement?",
  choices: [
   "Construction had already finished.",
   "Construction was being planned.",
   "The plan had been abandoned."
  ],
  answer: 1,
  note: "Kəndin yerində gives the location. Planlaşdırılırdı is a past ongoing passive: a plan was being made."
 },
 {
  number: 29987089,
  az: "Təhsilini davam etdirmək istəsə də mümkün olmayıb.",
  en: "They wanted to continue their education, but it proved impossible.",
  word: "davam etdirmək",
  surface: "davam etdirmək",
  wordEn: "to continue something",
  question: "How did the person’s wish turn out?",
  choices: [
   "They wanted to keep studying, but could not.",
   "They could keep studying, but chose to stop.",
   "They kept studying after a short interruption."
  ],
  answer: 0,
  note: "Listen across the pause: istəsə də introduces a wish, and mümkün olmayıb tells you the outcome."
 },
 {
  number: 27646635,
  az: "Qurultay müvafiq qətnamə qəbul etmişdir.",
  en: "The congress adopted the relevant resolution.",
  word: "qətnamə",
  surface: "qətnamə",
  wordEn: "a formal resolution",
  question: "What stage did the resolution reach?",
  choices: [
   "The congress drafted it for a later vote.",
   "The congress sent it back for revision.",
   "The congress adopted it."
  ],
  answer: 2,
  note: "Qətnamə qəbul etmək is the usual combination for formally adopting a resolution."
 },
 {
  number: 28316598,
  az: "Elə həmin vaxt Həmid Dönməz Azərbaycan Yazıçılar Birliyinin fəxri üzvü seçildi.",
  en: "It was at that very time that Həmid Dönməz was elected an honorary member of the Azerbaijan Writers’ Union.",
  word: "fəxri",
  surface: "fəxri",
  wordEn: "honorary",
  question: "What happened to Həmid Dönməz at that point?",
  choices: [
   "He was made head of the Writers’ Union.",
   "He was elected an honorary member.",
   "He nominated someone else for membership."
  ],
  answer: 1,
  note: "Elə həmin vaxt points back to a precise time in the account. Fəxri üzv is an honorary member."
 },
 {
  number: 30416720,
  az: "Dinozavrlar arasında ən uzun boyuna malik imiş.",
  en: "It reportedly had the longest neck among the dinosaurs.",
  word: "malik",
  surface: "malik",
  wordEn: "possessing",
  question: "How does the speaker present the claim?",
  choices: [
   "As something the speaker measured firsthand.",
   "As something the speaker expects to discover.",
   "As something the speaker has learned or heard."
  ],
  answer: 2,
  note: "Malik takes a dative complement. The final imiş presents the information as learned indirectly and can blend with the word before it."
 },
 {
  number: 27426027,
  az: "Film Türkiyə yazıçısı Nazim Hikmətin eyniadlı əsərinin motivləri əsasında yaradılmışdır.",
  en: "The film was based on a work of the same name by the Turkish writer Nazim Hikmət.",
  word: "eyniadlı",
  surface: "eyniadlı",
  wordEn: "of the same name",
  question: "What connects the film to the writer’s work?",
  choices: [
   "The film draws on his work and shares its title.",
   "The writer later adapted the film under a new title.",
   "Only the film’s main character shares the writer’s name."
  ],
  answer: 0,
  note: "Eyniadlı means “of the same name.” Listen for əsasında yaradılmışdır near the end to hear what the film was based on."
 },
 {
  number: 30416721,
  az: "Qurultayda Azərbaycanın bütün bölgələrini və tədris müəssisələrini təmsil edən nümayəndələr iştirak edirdilər.",
  en: "Delegates representing all regions of Azerbaijan and its educational institutions attended the congress.",
  word: "nümayəndə",
  surface: "nümayəndələr",
  wordEn: "delegates",
  question: "Who does the speaker say attended the congress?",
  choices: [
   "Delegates from the host region’s schools alone.",
   "Representatives of the regions and educational institutions.",
   "Regional leaders attending on behalf of foreign universities."
  ],
  answer: 1,
  note: "Təmsil edən describes nümayəndələr. Hold that phrase in mind until the verb iştirak edirdilər tells you what the delegates did."
 },
 {
  number: 30574004,
  az: "İngiltərədə nəşr edilmiş bu \"Divan\"da məhəbbət lirikası üstünlük təşkil edirdi.",
  en: "Love poetry predominated in this Divan published in England.",
  word: "üstünlük",
  surface: "üstünlük",
  wordEn: "predominance",
  question: "Which detail describes the collection’s contents?",
  choices: [
   "It included English translations of love poems exclusively.",
   "It was published in England after gaining popularity for love poetry.",
   "Love poetry formed the dominant part of the collection."
  ],
  answer: 2,
  note: "Nəşr edilmiş tells you about publication. The main claim about the poetry comes at the end: üstünlük təşkil edirdi."
 },
 {
  number: 30416719,
  az: "Bundan sonra isə körpü bərpa edilməmişdir.",
  en: "After that, however, the bridge was not restored.",
  word: "bərpa",
  surface: "bərpa",
  wordEn: "restoration",
  question: "What happened to the bridge after that?",
  choices: [
   "It remained unrestored.",
   "It was restored a second time.",
   "Restoration work had already begun."
  ],
  answer: 0,
  note: "Listen for the negative syllable in edilməmişdir. Bundan sonra isə moves the account to what happened next."
 },
 {
  number: 26658775,
  az: "Sovet mədəniyyət və incəsənət nümayəndə heyətinin tərkibində Amerika və Afrika ölkələrində olmuşdur.",
  en: "The person visited countries in the Americas and Africa as part of a Soviet culture and arts delegation.",
  word: "heyət",
  surface: "heyətinin",
  wordEn: "delegation",
  question: "In what capacity did the person travel?",
  choices: [
   "As the individual host of visiting delegations.",
   "As a member of a culture and arts delegation.",
   "As a representative sent by African countries."
  ],
  answer: 1,
  note: "Nümayəndə heyətinin tərkibində holds together as a phrase meaning “as part of the delegation.”"
 },
 {
  number: 30574007,
  az: "Hindistanla Rusiya arasındakı strateji tərəfdaşlıq beş sahəni əhatə edir.",
  en: "The strategic partnership between India and Russia covers five areas.",
  word: "tərəfdaşlıq",
  surface: "tərəfdaşlıq",
  wordEn: "partnership",
  question: "What does the number five refer to?",
  choices: [
   "Five countries in the partnership.",
   "Five years of strategic cooperation.",
   "Five fields covered by the partnership."
  ],
  answer: 2,
  note: "Arasındakı connects the two countries to tərəfdaşlıq. Əhatə edir introduces the scope of that partnership."
 },
 {
  number: 27646609,
  az: "Şimalında elə də böyük olmayan göl vardır.",
  en: "There is a lake of modest size to its north.",
  word: "şimal",
  surface: "Şimalında",
  wordEn: "north",
  question: "How does the speaker describe the lake?",
  choices: [
   "As being on the smaller side.",
   "As the largest lake in the area.",
   "As roughly as large as a nearby lake."
  ],
  answer: 0,
  note: "Elə də böyük olmayan is a restrained way to say “not particularly large.” The word göl comes after the whole description."
 },
 {
  number: 30644804,
  az: "Eşq şeirlərindən əlavə din və təsəvvüf ilə bağlı şeirləri də vardır.",
  en: "Alongside love poems, there are also poems about religion and Sufism.",
  word: "təsəvvüf",
  surface: "təsəvvüf",
  wordEn: "Sufism",
  question: "How are the two groups of poems related?",
  choices: [
   "The religious poems are translations of the love poems.",
   "The religious and Sufi poems are additional themes.",
   "The religious poems replaced all the love poems."
  ],
  answer: 1,
  note: "Şeirlərindən əlavə introduces the first theme. The later də adds another theme to it."
 },
 {
  number: 26658900,
  az: "Göldə mülayim iqlim şəraiti hökm sürür.",
  en: "A temperate climate prevails at the lake.",
  word: "hökm sürmək",
  surface: "hökm sürür",
  wordEn: "to prevail",
  question: "What does the description say about conditions at the lake?",
  choices: [
   "The climate is about to change.",
   "Temperatures swing between extremes.",
   "Temperate conditions prevail."
  ],
  answer: 2,
  note: "With weather or conditions, hökm sürür means “prevails.” The two words are often heard as a single phrase."
 },
 {
  number: 26658898,
  az: "Bəzi televiziya sənədli filmlərinin məsləhətçisi idi.",
  en: "The person was an adviser on some television documentaries.",
  word: "məsləhətçi",
  surface: "məsləhətçisi",
  wordEn: "adviser",
  question: "What was the person’s role in the documentaries?",
  choices: [
   "Advising on some of the films.",
   "Directing every documentary in the series.",
   "Presenting the films on television."
  ],
  answer: 0,
  note: "Listen for the ending of məsləhətçisi. The preceding sənədli filmlərinin tells you which productions the adviser worked on."
 },
 {
  number: 26658902,
  az: "Rəhbərlik öz siyasətində və iqtisadiyyatında dəyişikliklər tələb etdi.",
  en: "The leadership called for changes to its own policies and economy.",
  word: "dəyişiklik",
  surface: "dəyişikliklər",
  wordEn: "changes",
  question: "What does the account say about the changes?",
  choices: [
   "They were already in effect.",
   "The leadership demanded them.",
   "The leadership turned them down."
  ],
  answer: 1,
  note: "Öz connects the policies to the leadership. Tələb etdi names a demand and leaves its outcome open."
 }
];
const lessons = readings.map(({number, ...reading}) => ({
 ...reading,
 id: 'cv10-' + number,
 src: 'study-audio/cv10-' + number + '.mp3',
 source: 'https://commonvoice.mozilla.org/az',
 credit: 'Mozilla Common Voice 10.0 · CC0 1.0',
 license: 'https://creativecommons.org/publicdomain/zero/1.0/'
}));
if(typeof module!=='undefined' && module.exports)module.exports=lessons;
else root.SozStudyListening=lessons;
})(typeof window!=='undefined'?window:globalThis);
