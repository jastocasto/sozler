(function(root) {
  'use strict';

  // The first 30 utterances are original interview and talk exercises in
  // standard Azerbaijan Azerbaijani. The last three reproduce CC0 transcripts
  // of the matching Azerbaijani recordings from Mozilla Common Voice 10.0.
  // All prompts, translations and explanations are original to this collection.
  const grammar = 'https://www.academia.edu/129901902/JALA_GARIBOVA_and_SABINA_ALIYEVA_2024_A_GRAMMAR_OF_CONTEMPORARY_AZERBAIJANI';
  const parentheticals = 'https://azleks.az/index.php/en/posts/ara-sozlerin-vergulle-ayrilmasi';
  const modals = 'https://azleks.az/dictionary/modal-sozler';

  const lessons = [
    {
      id: 'duz-basa-dusdumse', skill: 'Interview follow-ups', word: 'başa düşmək',
      gap: '___, bu qərarı siz yox, komandanız verib.',
      accept: ['Düz başa düşdümsə', 'Düzgün başa düşdümsə', 'Doğru başa düşdümsə'],
      cue: 'Use başa düşmək to open with “if I understood correctly.”',
      en: 'If I understood correctly, it was your team that made this decision.',
      meaning: 'What does the host invite the guest to clarify?',
      choices: ['Whether the team agrees with the guest now', 'Who actually made the decision', 'When the team will announce its decision'], answer: 1,
      explanation: 'The final -sə in düşdümsə leaves room for correction. Siz yox, komandanız singles out the decision-maker.',
      speak: 'Check one detail you remember from a talk. Give the speaker room to correct you.',
      source: grammar
    },
    {
      id: 'demek-isteyirsiniz', skill: 'Interview follow-ups', word: 'demək',
      gap: '___ ki, əsas çətinlik vaxt azlığı idi?',
      accept: ['Demək istəyirsiniz', 'Demək istəyirsinizmi'],
      cue: 'Use demək and istəmək to ask politely “do you mean…?”',
      en: 'Do you mean the main difficulty was a lack of time?',
      meaning: 'Why does the host bring up time pressure?',
      choices: ['To cut the guest’s answer short', 'To explain the host’s own delay', 'To check a possible reading of the guest’s answer'], answer: 2,
      explanation: 'Demək istəyirsiniz ki introduces the host’s paraphrase. In the version without -mi, the question is carried by intonation.',
      speak: 'Paraphrase a guest’s point as a question. Change the topic and the difficulty.',
      source: grammar
    },
    {
      id: 'nece-oldu-ki', skill: 'Interview follow-ups', word: 'dəyişmək',
      gap: '___, sonda fikrinizi dəyişdiniz?',
      accept: ['Necə oldu ki', 'Necə olub ki'],
      cue: 'Ask “how did it come about that…?” using necə, olmaq and ki.',
      en: 'How did you come to change your mind in the end?',
      meaning: 'What kind of answer is the host looking for?',
      choices: ['The events that led to the change of mind', 'A yes or no about whether the guest changed their mind', 'The date of the next decision'], answer: 0,
      explanation: 'Sonda gives away the outcome. Necə oldu ki asks the guest to tell the story leading up to it.',
      speak: 'Ask about a real change of career, opinion or plans. Then answer as the guest.',
      source: 'https://anl.az/el/Kitab/2014/Azf-278760.pdf'
    },
    {
      id: 'yeri-gelmisken', skill: 'Interview follow-ups', word: 'yeri gəlmişkən',
      gap: '___, həmin müsahibənin səs yazısı qalıbmı?',
      accept: ['Yeri gəlmişkən'],
      cue: 'Use the two-word expression beginning with yeri to bring up a related question.',
      en: 'By the way, does the recording of that interview still exist?',
      meaning: 'How does the host connect this question to the conversation?',
      choices: ['By returning to a question the guest refused to answer', 'By taking a brief, relevant detour', 'By signalling the final question'], answer: 1,
      explanation: 'Yeri gəlmişkən introduces an aside prompted by the preceding conversation. Həmin points back to the particular interview.',
      speak: 'Mention something you watched recently, then use an aside to ask a related question.',
      source: parentheticals
    },
    {
      id: 'deyesen', skill: 'Source and certainty', word: 'deyəsən',
      gap: '___, sualım sizi bir az təəccübləndirdi.',
      accept: ['Deyəsən', 'Görünür'],
      cue: 'Use one word meaning “it seems” to soften an impression of the guest’s reaction.',
      en: 'It seems my question surprised you a little.',
      meaning: 'How sure is the host about the guest’s reaction?',
      choices: ['The guest has explicitly confirmed it', 'Someone told the host before the interview', 'The host is tentatively interpreting the reaction'], answer: 2,
      explanation: 'Deyəsən presents the surprise as the host’s impression. Bir az softens the observation further.',
      speak: 'Describe a reaction you noticed, leaving open the possibility that you read it wrong.',
      source: modals
    },
    {
      id: 'esitdiyime-gore', skill: 'Source and certainty', word: 'eşitmək',
      gap: '___, köhnə kinoteatrı bu il bərpa edəcəklər.',
      accept: ['Eşitdiyimə görə'],
      cue: 'Begin “from what I’ve heard” using eşitmək and görə.',
      en: 'From what I’ve heard, they’ll restore the old cinema this year.',
      meaning: 'What does the speaker reveal about the information?',
      choices: ['They are passing on something they heard', 'They have personally inspected the works', 'They are proposing a restoration project'], answer: 0,
      explanation: 'Eşitdiyimə refers to what reached the speaker’s ears. Görə identifies that as the basis for the claim.',
      speak: 'Pass on a piece of local news and make clear how you came by it.',
      source: parentheticals
    },
    {
      id: 'sen-deme', skill: 'Source and certainty', word: 'sən demə',
      gap: '___, hər gün yanından keçdiyimiz o bina vaxtilə məktəb imiş.',
      accept: ['Sən demə', 'Demə'],
      cue: 'Use the expression with demə for a fact you discovered unexpectedly.',
      en: 'It turns out that building we walk past every day used to be a school.',
      meaning: 'What stance does the speaker take toward the building’s history?',
      choices: ['They doubt it ever housed a school', 'They present it as a discovery', 'They urge the listener to keep it secret'], answer: 1,
      explanation: 'Sən demə marks a realization. Məktəb imiş presents the former use as something the speaker has come to learn.',
      speak: 'Describe a surprising fact about a familiar place. Make the discovery audible in your wording.',
      source: grammar
    },
    {
      id: 'guya', skill: 'Source and certainty', word: 'guya',
      gap: '___ gənclər kitab oxumur. Bəs kitabxanadakı növbəni necə izah edək?',
      accept: ['Guya'],
      cue: 'Use the word meaning “supposedly” that signals doubt here.',
      en: 'Supposedly young people don’t read. How do we explain the queue at the library, then?',
      meaning: 'Whose attitude comes through in the second sentence?',
      choices: ['A librarian complaining about slow service', 'A speaker agreeing that reading has declined', 'A speaker challenging a generalization'], answer: 2,
      explanation: 'Guya introduces a claim at arm’s length. Bəs brings in the queue as evidence against it.',
      speak: 'Challenge a stereotype by following a supposed fact with a concrete counterexample.',
      source: 'https://azleks.az/dictionary/guya'
    },
    {
      id: 'iki-gorunur', skill: 'Source and certainty', word: 'görünür',
      gap: 'Uzaqdan yalnız bir divar görünür. ___, giriş o biri tərəfdədir.',
      accept: ['Görünür', 'Deyəsən'],
      cue: 'Fill the second opening with a one-word marker of inference.',
      en: 'Only a wall is visible from a distance. Apparently the entrance is on the other side.',
      meaning: 'Which statement does the speaker actually see evidence for with their own eyes?',
      choices: ['They see the wall and infer the entrance’s location', 'They see both the wall and the entrance', 'They see the entrance and infer the wall’s location'], answer: 0,
      explanation: 'At the end of the first sentence görünür describes visibility. As a separate opening in the second, it marks an inference.',
      speak: 'Describe something visible from where you are and then draw a tentative conclusion from it.',
      source: modals
    },
    {
      id: 'mehz', skill: 'Emphasis and contrast', word: 'məhz',
      gap: '___ o söhbətdən sonra məhəlləmizin tarixini yazmağa başladım.',
      accept: ['Məhz', 'Elə'],
      cue: 'Add a one-word focus marker meaning “it was precisely…”',
      en: 'It was after that particular conversation that I started writing the history of our neighbourhood.',
      meaning: 'What does the emphasis single out?',
      choices: ['The guest’s neighbourhood rather than the city', 'That conversation as the turning point', 'Writing as the guest’s only method'], answer: 1,
      explanation: 'Məhz gives prominence to the phrase directly after it. Here that phrase pins down when the writing began.',
      speak: 'Single out one event that made you start something. Put the focus marker immediately before it.',
      source: 'https://azleks.az/dictionary/mehz'
    },
    {
      id: 'hec-de', skill: 'Emphasis and contrast', word: 'heç',
      gap: 'Videoya çox baxılması ___ hamının bu fikirlə razılaşdığı demək deyil.',
      accept: ['heç də'],
      cue: 'Strengthen the negative conclusion with the two-word expression beginning with heç.',
      en: 'A video getting lots of views certainly doesn’t mean everyone agrees with the idea.',
      meaning: 'Which inference is the speaker disputing?',
      choices: ['That the video attracted viewers', 'That some people could agree with it', 'That a large audience proves agreement'], answer: 2,
      explanation: 'Heç də strengthens demək deyil at the far end of the sentence. The speaker accepts the view count and disputes what it proves.',
      speak: 'Name a number people take too seriously and explain one conclusion they cannot draw from it.',
      source: grammar
    },
    {
      id: 'halbuki', skill: 'Emphasis and contrast', word: 'halbuki',
      gap: 'O həyəti çoxları boş sahə sayırdı. ___ qonşular hər axşam orada yığışırdılar.',
      accept: ['Halbuki', 'Əslində isə'],
      cue: 'Introduce what was really happening, in contrast to the common assumption.',
      en: 'Many considered that courtyard an empty space. Yet the neighbours gathered there every evening.',
      meaning: 'What do the evening gatherings establish?',
      choices: ['They challenge the idea that the courtyard was unused', 'They explain why the courtyard was emptied', 'They show what happened after the courtyard closed'], answer: 0,
      explanation: 'Halbuki sets the neighbours’ routine against the earlier description of the courtyard.',
      speak: 'Name a common impression of a place in Baku and contrast it with something you have seen there.',
      source: 'https://azleks.az/dictionary/halbuki'
    },
    {
      id: 'ozu-de', skill: 'Emphasis and contrast', word: 'özü də',
      gap: 'İlk sərgini həyətimizdə açdıq, ___ bir qəpik xərcləmədən.',
      accept: ['özü də'],
      cue: 'Use the expression with özü that adds a striking extra detail.',
      en: 'We opened our first exhibition in our courtyard, and we pulled it off without spending a single qəpik.',
      meaning: 'What is the speaker doing with the second part?',
      choices: ['Correcting where the exhibition took place', 'Adding an especially striking detail about its cost', 'Questioning how the exhibition was funded'], answer: 1,
      explanation: 'Özü də draws attention to an extra fact. Bir qəpik xərcləmədən makes the achievement more striking.',
      speak: 'Report an achievement, then add one surprising detail about how it was done.',
      source: 'https://en.wiktionary.org/wiki/%C3%B6z%C3%BC_d%C9%99#Azerbaijani'
    },
    {
      id: 'neinki', skill: 'Emphasis and contrast', word: 'nəinki',
      gap: 'Sərgi ___ məhəllə sakinlərini, hətta başqa şəhərlərdən gələnləri də bir araya gətirdi.',
      accept: ['nəinki'],
      cue: 'Supply the single-word opener paired here with hətta … də.',
      en: 'The exhibition brought together not only local residents but even visitors from other cities.',
      meaning: 'What makes the attendance surprising?',
      choices: ['Only city officials attended', 'Visitors replaced the local audience', 'The audience extended beyond the neighbourhood'], answer: 2,
      explanation: 'Listen past nəinki for the second group. Hətta and də mark how far the exhibition’s reach extended.',
      speak: 'Describe an event that reached a second, less expected audience.',
      source: grammar
    },
    {
      id: 'sohbet-ondan-gedir', skill: 'Framing a point', word: 'söhbət',
      gap: '___ ki, məhəllənin sakinlərini heç kim dinləməyib.',
      accept: ['Söhbət ondan gedir', 'Məsələ ondadır'],
      cue: 'Refocus the discussion with an expression meaning “the point at issue is…”',
      en: 'The point is that nobody has heard the neighbourhood’s residents out.',
      meaning: 'What does the guest identify as the central problem?',
      choices: ['The lack of a hearing for residents’ views', 'Residents refusing to speak', 'Too many public meetings'], answer: 0,
      explanation: 'Söhbət ondan gedir ki points ahead to the essential claim. The listener has to wait for the words after ki.',
      speak: 'Bring a discussion about city life back to the issue you think has been overlooked.',
      source: 'https://photo.azertag.az/post/azerbaycan-prezidenti-ilham-eliyev-yerli-televiziya-kanallarina-musahibe-verib-48067'
    },
    {
      id: 'daha-dogrusu', skill: 'Framing a point', word: 'doğrusu',
      gap: 'O məhəllədə böyümüşəm, ___, uşaqlığımın yaylarını orada keçirmişəm.',
      accept: ['daha doğrusu', 'daha dəqiq desəm', 'daha dəqiq desək'],
      cue: 'Insert the phrase that tells a listener you are making your first statement more precise.',
      en: 'I grew up in that neighbourhood, or more precisely, I spent my childhood summers there.',
      meaning: 'How should you revise your picture of the guest’s childhood?',
      choices: ['They lived there only after childhood', 'Their connection was through summers spent there', 'They no longer remember which neighbourhood it was'], answer: 1,
      explanation: 'Daha doğrusu introduces a self-correction. The second account narrows the first one to a particular part of each year.',
      speak: 'Describe a place or habit from your past, then refine the first description.',
      source: parentheticals
    },
    {
      id: 'reaksiyasina-gelince', skill: 'Framing a point', word: 'reaksiya',
      gap: 'Tamaşaçıların reaksiyasına ___, ən çox köhnə fotolar maraq doğurdu.',
      accept: ['gəlincə', 'gəldikdə', 'gəldikdə isə', 'gəlincə isə'],
      cue: 'Complete the “as for the audience’s reaction” frame with a form of gəlmək.',
      en: 'As for the audience reaction, the old photos drew the most interest.',
      meaning: 'What does the opening of the sentence prepare you for?',
      choices: ['A listener’s physical arrival', 'A date when the exhibition will open', 'A shift to the subject of audience response'], answer: 2,
      explanation: 'Reaksiyasına carries the dative ending. The whole phrase ending in gəlincə sets the topic for the comment that follows.',
      speak: 'Shift from describing an event to discussing the audience, the cost, or its effect.',
      source: 'https://report.az/futbol-xeberleri/elnur-memmedov-saytda-reklamdansa-usaq-futboluna-sermaye-qoymaq-daha-yaxsidir-musahi-be-neftchi'
    },
    {
      id: 'bir-sozle', skill: 'Framing a point', word: 'bir sözlə',
      gap: '___, rəqəmlər dəyişib, amma adamların gündəlik qayğıları yerində qalıb.',
      accept: ['Bir sözlə', 'Qısası', 'Qısaca desək', 'Qısa desək'],
      cue: 'Give a spoken cue that the following sentence sums up a longer argument.',
      en: 'In short, the figures have changed, but people’s everyday concerns remain.',
      meaning: 'How does the guest want this sentence to be heard?',
      choices: ['As the takeaway from a longer discussion', 'As a request for new figures', 'As the opening of an unrelated story'], answer: 0,
      explanation: 'Bir sözlə signals a summary. Yerində qalıb gives the second half its sense of continuity.',
      speak: 'Sum up a talk you watched recently in one sentence with a clear takeaway.',
      source: parentheticals
    },
    {
      id: 'dediyinizden', skill: 'Unpacking long clauses', word: 'qorumaq',
      gap: '___ belə çıxır ki, binanı qorumaq hələ məhəlləni qorumaq demək deyil.',
      accept: ['Dediyinizdən', 'Dediklərinizdən', 'Sizin dediyinizdən', 'Sizin dediklərinizdən'],
      cue: 'Turn demək into “from what you said,” addressing the guest politely.',
      en: 'From what you’ve said, preserving the building doesn’t necessarily mean preserving the neighbourhood.',
      meaning: 'Whose inference is being voiced?',
      choices: ['A named outside expert’s conclusion', 'The interviewer’s interpretation of the guest’s words', 'A direct quotation from the residents'], answer: 1,
      explanation: 'The polite “you” is inside dediyinizdən. Its final -dən marks the starting point for the inference introduced by belə çıxır ki.',
      speak: 'Draw one inference from an interview and make clear that you are interpreting the guest.',
      source: grammar
    },
    {
      id: 'kesilib-kesilmediyini', skill: 'Unpacking long clauses', word: 'kəsilmək',
      gap: 'Səsin qəsdən ___ hələ bilmirik.',
      accept: ['kəsilib-kəsilmədiyini'],
      cue: 'Use both forms of kəsilmək to express the open question “whether it was cut.”',
      en: 'We still don’t know whether the sound was cut deliberately.',
      meaning: 'What remains open?',
      choices: ['Whether someone noticed the sound', 'Who has publicly admitted cutting it', 'Whether the interruption was intentional'], answer: 2,
      explanation: 'Kəsilib-kəsilmədiyini puts both possibilities inside one object of bilmirik. Qəsdən adds the question of intent.',
      speak: 'Use a paired positive and negative verb to describe one question a reporter still cannot answer.',
      source: grammar
    },
    {
      id: 'nezere-alsaq', skill: 'Unpacking long clauses', word: 'nəzərə almaq',
      gap: 'Görüşün iş vaxtı keçirildiyini ___, bu qədər adamın gəlməsi təəccüblüdür.',
      accept: ['nəzərə alsaq'],
      cue: 'Use nəzərə almaq in the form meaning “if we take into account.”',
      en: 'Considering the meeting was held during working hours, the turnout is surprising.',
      meaning: 'Why does the turnout surprise the speaker?',
      choices: ['The timing made such a big crowd unlikely', 'The meeting was announced twice', 'Nobody knew what the meeting was about'], answer: 0,
      explanation: 'Keçirildiyini packages the timing as a fact. Nəzərə alsaq tells the listener to weigh that fact when judging the turnout.',
      speak: 'Explain why a result surprised you once you took a particular circumstance into account.',
      source: grammar
    },
    {
      id: 'demeyim', skill: 'Unpacking long clauses', word: 'yenilik',
      gap: 'Şəhərin dəyişdiyini ___ o demək deyil ki, hər yenilik məni sevindirir.',
      accept: ['deməyim', 'söyləməyim'],
      cue: 'Complete the first clause with “my saying,” using demək or söyləmək.',
      en: 'My saying the city has changed doesn’t mean every new development makes me happy.',
      meaning: 'Which assumption does the speaker want to correct?',
      choices: ['That the city has been changing', 'That mentioning change amounts to welcoming all of it', 'That the speaker has spent time in the city'], answer: 1,
      explanation: 'Deməyim turns “I say” into the subject, “my saying.” The predicate o demək deyil ki then rejects an overinterpretation.',
      speak: 'State an observation and head off one mistaken inference someone might draw from it.',
      source: grammar
    },
    {
      id: 'geriye-baxanda', skill: 'Narrative timing', word: 'həyət',
      gap: 'İndi ___ anlayıram ki, bizi birləşdirən elə o kiçik həyət imiş.',
      accept: ['geriyə baxanda', 'geriyə baxdıqda', 'geriyə baxarkən', 'geriyə dönüb baxanda'],
      cue: 'Use geriyə and a form of baxmaq to frame a realization in hindsight.',
      en: 'Looking back now, I realize it was that little courtyard that brought us together.',
      meaning: 'When did the speaker recognize the courtyard’s importance?',
      choices: ['Before anyone used it', 'On the day it was built', 'In retrospect'], answer: 2,
      explanation: 'İndi geriyə baxanda places the realization in the present. İmiş at the end presents the courtyard’s role as something newly appreciated.',
      speak: 'Looking back on your time in Baku, name something whose importance you only came to appreciate later.',
      source: grammar
    },
    {
      id: 'bitirer-bitirmez', skill: 'Narrative timing', word: 'bitirmək',
      gap: 'Rəssam sözünü ___ dinləyicilərdən biri öz hekayəsini danışmağa başladı.',
      accept: ['bitirər-bitirməz', 'bitirən kimi'],
      cue: 'Use bitirmək to show that the listener started as soon as the artist finished.',
      en: 'As soon as the artist finished speaking, a listener began telling their own story.',
      meaning: 'What is distinctive about the timing?',
      choices: ['The listener responded immediately after the artist finished', 'The listener interrupted midway through', 'The listener waited until a later meeting'], answer: 0,
      explanation: 'The paired forms bitirər-bitirməz express immediate succession. Bitirən kimi also conveys “as soon as.”',
      speak: 'Describe two things that happened in quick succession during a conversation.',
      source: grammar
    },
    {
      id: 'esidene-qeder', skill: 'Narrative timing', word: 'sanmaq',
      gap: 'Nənəmin səsini yenidən ___ o mahnını unutduğumu sanırdım.',
      accept: ['eşidənə qədər', 'eşidənədək', 'eşidənəcən', 'eşidənə kimi'],
      cue: 'Use eşitmək to mark the endpoint of the belief, “until I heard.”',
      en: 'Until I heard my grandmother’s voice again, I thought I had forgotten that song.',
      meaning: 'What changed when the guest heard the voice?',
      choices: ['They learned a completely new song', 'They realized the song was still in their memory', 'They forgot who had sung the song'], answer: 1,
      explanation: 'Eşidənə qədər sets the boundary of the old belief. Sanırdım tells you to hear what came before it as what the speaker used to think.',
      speak: 'Describe a belief you held until a particular sight or sound made you reconsider it.',
      source: grammar
    },
    {
      id: 'danisdiqca', skill: 'Narrative timing', word: 'üzə çıxmaq',
      gap: 'Sakinlər ___ xəritədə görünməyən bir məhəllə üzə çıxırdı.',
      accept: ['danışdıqca'],
      cue: 'Use danışmaq with the ending that ties the unfolding picture to the residents’ continuing stories.',
      en: 'As the residents kept talking, a neighbourhood you couldn’t see on the map gradually emerged.',
      meaning: 'How did this second picture of the neighbourhood take shape?',
      choices: ['All at once before the interviews', 'After the streets were redrawn', 'Gradually through the residents’ accounts'], answer: 2,
      explanation: 'Danışdıqca makes the storytelling an unfolding process. Üzə çıxırdı describes the picture emerging alongside it.',
      speak: 'Describe something that became clearer to you the longer you listened.',
      source: grammar
    },
    {
      id: 'olsa-bele', skill: 'Concession and hypotheticals', word: 'nəticə',
      gap: 'Rəqəmlər düz ___, bu nəticəyə gəlmək üçün hələ tezdir.',
      accept: ['olsa belə', 'olsa da'],
      cue: 'Concede the possibility that the figures are right using olmaq and belə or da.',
      en: 'Even if the figures are right, it is still too early to draw that conclusion.',
      meaning: 'What is the guest prepared to concede for the sake of the argument?',
      choices: ['That the figures might be accurate', 'That the conclusion is established', 'That the figures have been independently verified'], answer: 0,
      explanation: 'Olsa belə lets the argument proceed on an assumption. Hələ tezdir keeps the guest’s judgment about the conclusion separate.',
      speak: 'Grant one point your conversation partner makes, then explain what remains unresolved.',
      source: grammar
    },
    {
      id: 'olmasaydi', skill: 'Concession and hypotheticals', word: 'bərpa etmək',
      gap: 'Köhnə fotolar əlimizdə ___, küçəni bu qədər dəqiq bərpa edə bilməzdik.',
      accept: ['olmasaydı'],
      cue: 'Use the negative past conditional of olmaq to imagine an alternative to what happened.',
      en: 'If we hadn’t had the old photos, we couldn’t have reconstructed the street so accurately.',
      meaning: 'What can you infer about the actual reconstruction?',
      choices: ['It was postponed until photos could be found', 'The team had old photos that helped them', 'The team rebuilt the street from memory alone'], answer: 1,
      explanation: 'Olmasaydı imagines a past without the photos. Bərpa edə bilməzdik states what would then have been impossible.',
      speak: 'Identify something that made a project possible and imagine how it would have gone without it.',
      source: grammar
    },
    {
      id: 'razilasmasam-da', skill: 'Concession and hypotheticals', word: 'razılaşmaq',
      gap: 'Bu yozumla tam ___, sualın özünü çox vacib sayıram.',
      accept: ['razılaşmasam da'],
      cue: 'Use razılaşmaq for “although I don’t agree,” retaining first person.',
      en: 'Although I don’t entirely agree with this interpretation, I think the question itself is very important.',
      meaning: 'Which distinction does the guest make?',
      choices: ['Agreement now and disagreement in the past', 'A private view and an official position', 'Reservations about the interpretation and respect for the question'], answer: 2,
      explanation: 'The ending in razılaşmasam carries “I.” The separate da makes the clause concessive. Tam limits the extent of the disagreement.',
      speak: 'Disagree with one part of an argument while acknowledging something valuable about it.',
      source: grammar
    },
    {
      id: 'kas-yazaydim', skill: 'Concession and hypotheticals', word: 'kaş',
      gap: 'Kaş o vaxt nənəmin səsini də ___.',
      accept: ['yazaydım', 'yazmış olaydım'],
      cue: 'Use yazmaq to express a first-person wish about a past opportunity.',
      en: 'If only I had recorded my grandmother’s voice back then, too.',
      meaning: 'What feeling does the guest express?',
      choices: ['Regret about a missed chance', 'A plan to record a voice later today', 'Certainty that a recording survives'], answer: 0,
      explanation: 'Kaş opens a wish. O vaxt and yazaydım place it back at a moment the speaker wishes they could revisit.',
      speak: 'Name something you wish you had asked, saved, or recorded during an earlier conversation.',
      source: grammar
    },
    {
      id: 'istese-de', audioId: 'cv10-29987089', skill: 'Concession and hypotheticals', word: 'mümkün',
      gap: 'Təhsilini davam etdirmək ___ mümkün olmayıb.',
      accept: ['istəsə də'],
      cue: 'Use istəmək with də to acknowledge the person’s wish before the outcome.',
      en: 'Although they wanted to continue their education, it wasn’t possible.',
      meaning: 'What contrast does the recording establish?',
      choices: ['The person wanted to study further but could not', 'The person had the opportunity but felt reluctant', 'The person gave up because they disliked studying'], answer: 0,
      explanation: 'İstəsə də grants the wish. Mümkün olmayıb supplies the outcome and leaves the reason open.',
      speak: 'Describe something you wanted to do but could not. Use the first-person form of the same construction.',
      source: grammar
    },
    {
      id: 'malik-imis', audioId: 'cv10-30416720', skill: 'Source and certainty', word: 'boyun',
      gap: 'Dinozavrlar arasında ən uzun boyuna malik ___.',
      accept: ['imiş'],
      cue: 'After malik, add the separate word that presents the fact as learned later or indirectly.',
      en: 'Apparently it had the longest neck of any dinosaur.',
      meaning: 'What does the final word add to the account?',
      choices: ['The speaker personally made the comparison', 'The speaker presents the fact as something learned', 'The speaker expects the neck measurement to change'], answer: 1,
      explanation: 'Malik expresses possession and takes a dative, here boyuna. İmiş adds the speaker’s perspective on learning this fact.',
      speak: 'Retell a surprising fact you learned from a talk and use imiş to frame that discovery.',
      source: grammar
    },
    {
      id: 'insasi-planlasdirilirdi', audioId: 'cv10-28841731', skill: 'Unpacking long clauses', word: 'qəsəbə',
      gap: 'Kəndin yerində müasir qəsəbənin inşası ___.',
      accept: ['planlaşdırılırdı', 'planlaşdırılır idi'],
      cue: 'Use planlaşdırmaq to say that construction was being planned at the time.',
      en: 'Construction of a modern settlement was being planned on the site of the village.',
      meaning: 'Which stage does the recording actually establish?',
      choices: ['Residents had moved into the new settlement', 'Construction had already been completed', 'Planning was under way'], answer: 2,
      explanation: 'Qəsəbənin inşası names the proposed construction. The passive planlaşdırılırdı reports the planning in progress and leaves its eventual outcome open.',
      speak: 'Describe a project once planned for a place you know. Then say separately what you know about its outcome.',
      source: grammar
    }
  ];

  for (const lesson of lessons) lesson.az = lesson.gap.replace('___', lesson.accept[0]);
  if (typeof module !== 'undefined' && module.exports) module.exports = lessons;
  else root.SozStudyContent = lessons;
})(typeof window !== 'undefined' ? window : globalThis);
