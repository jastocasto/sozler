/* Short, authored learning examples; not corpus quotations or verified dictionary citations. */
(function(root){
const examples={
 'bədahətən':['Şair məclisdə bədahətən bir bənd söylədi.','The poet improvised a stanza at the gathering.'],
 'bəsirət':['Onun bəsirəti təhlükəni vaxtında görməyə kömək etdi.','Her insight helped her recognize the danger in time.'],
 'riqqət':['Uşağın məktubu onu riqqətə gətirdi.','The child’s letter moved her deeply.'],
 'təcəssüm':['Əsərin qəhrəmanı sədaqətin təcəssümüdür.','The protagonist embodies loyalty.'],
 'bəlağət':['Natiqin bəlağəti dinləyiciləri heyran qoydu.','The speaker’s eloquence impressed the audience.'],
 'ehkam':['Alim hamının ehkam kimi qəbul etdiyi fikri sual altına aldı.','The scholar questioned an idea everyone else accepted as dogma.'],
 'etmək':['Bu işi sabah etmək olar.','This work can be done tomorrow.'],
 'eləmək':['İndi nə eləmək istəyirsən?','What do you want to do now?'],
 'etdirmək':['Bu işi ustaya etdirmək istəyirəm.','I want to have a professional do this job.'],
 'elətdirmək':['Bu işi ustaya elətdirmək istəyirəm.','I want to have a professional do this job.'],
 'yazmaq':['Mən məktub yazmaq istəyirəm.','I want to write a letter.'],
 'yazı':['Bu yazı çox aydındır.','This writing is very clear.'],
 'yazıçı':['O, tanınmış yazıçıdır.','They are a well-known writer.'],
 'yazdı':['O, mənə məktub yazdı.','They wrote me a letter.'],
 'yazır':['O, hər gün yazır.','They write every day.'],
 'oxumaq':['Kitab oxumaq mənə xoşdur.','I enjoy reading books.'],
 'öyrənmək':['Azərbaycan dilini öyrənmək istəyirəm.','I want to learn Azerbaijani.'],
 'öyrətmək':['Uşaqlara oxumağı öyrətmək vacibdir.','It is important to teach children to read.'],
 'getmək':['Evə getmək vaxtıdır.','It is time to go home.'],
 'gəlmək':['Sabah gəlmək mümkündür?','Is it possible to come tomorrow?'],
 'görmək':['Səni görmək xoşdur.','It is nice to see you.'],
 'danışmaq':['Səninlə danışmaq istəyirəm.','I want to talk to you.'],
 'dinləmək':['Musiqi dinləmək xoşuma gəlir.','I like listening to music.'],
 'bilmək':['Cavabı bilmək istəyirəm.','I want to know the answer.'],
 'anlamaq':['Bu fikri anlamaq asandır.','This idea is easy to understand.'],
 'sevmək':['Sevmək gözəl hissdir.','Loving is a beautiful feeling.'],
 'sevgi':['Sevgi insanları birləşdirir.','Love brings people together.'],
 'məhəbbət':['Onun ailəsinə böyük məhəbbəti var.','They have great love for their family.'],
 'gözəl':['Bu, gözəl bir gündür.','This is a beautiful day.'],
 'gözəllik':['Təbiətin gözəlliyi məni heyran edir.','The beauty of nature amazes me.'],
 'qəşəng':['Bu çiçək çox qəşəngdir.','This flower is very pretty.'],
 'çirkin':['Bu, çirkin bir davranışdır.','This is ugly behavior.'],
 'xoşbəxt':['Bu gün özümü xoşbəxt hiss edirəm.','I feel happy today.'],
 'məlumat':['Bu barədə məlumat var?','Is there any information about this?'],
 'məlumatlı':['O, bu mövzuda məlumatlıdır.','They are knowledgeable about this topic.'],
 'məlumatsız':['Mən bu məsələdən məlumatsız idim.','I was unaware of this matter.'],
 'xəbər':['Bu gün yaxşı xəbər aldım.','I received good news today.'],
 'bilik':['Bilik təcrübə ilə artır.','Knowledge grows with experience.'],
 'söz':['Bu söz nə deməkdir?','What does this word mean?'],
 'məna':['Bu sözün iki mənası var.','This word has two meanings.'],
 'lüğət':['Sözün mənasını lüğətdə tapdım.','I found the meaning of the word in the dictionary.'],
 'dil':['Hər dil bir dünyadır.','Every language is a world.'],
 'kitab':['Bu kitab maraqlıdır.','This book is interesting.'],
 'kitablar':['Kitablar masanın üstündədir.','The books are on the table.'],
 'kitabda':['Bu kitabda çoxlu şəkil var.','There are many pictures in this book.'],
 'kitabdan':['Bu sözü kitabdan öyrəndim.','I learned this word from the book.'],
 'ev':['Bu ev bizimdir.','This house is ours.'],
 'su':['Bir stəkan su istəyirəm.','I would like a glass of water.'],
 'dost':['Yaxşı dost həmişə kömək edir.','A good friend always helps.'],
 'ailə':['Ailə mənim üçün vacibdir.','Family is important to me.'],
 'gün':['Bu gün hava yaxşıdır.','The weather is good today.'],
 'gecə':['Gecə şəhər sakit olur.','The city is quiet at night.'],
 'böyük':['Bu, böyük bir evdir.','This is a big house.'],
 'kiçik':['Mənim kiçik bir bağım var.','I have a small garden.'],
 'yaxşı':['Hər şey yaxşı olacaq.','Everything will be fine.'],
 'pis':['Bu, pis fikir deyil.','This is not a bad idea.'],
 'isti':['Çay hələ istidir.','The tea is still hot.'],
 'soyuq':['Bu gün hava soyuqdur.','The weather is cold today.']
};
const usage={
 'eləmək':'Danışıq dilində işlənir; “etmək” ilə yaxın mənalıdır.',
 'etmək':'Ümumi və ədəbi dildə işlənir; “kömək etmək” kimi birləşmələr yaradır.',
 'elətdirmək':'İcbar məna: işi özün görmək deyil, başqasına gördürmək.',
 'etdirmək':'İcbar məna: bir işi başqasına gördürmək.',
 'məlumat':'“Məlumat vermək”, “məlumat almaq” birləşmələrində işlənir.',
 'oxumaq':'Mətn oxumaq, təhsil almaq və mahnı ifa etmək mənalarında işlənə bilər.'
};
const forms={plural:{label:'cəm forması',question:'birdən çox'},locative:{label:'yerlik hal',question:'harada?'},ablative:{label:'çıxışlıq hal',question:'haradan?'},'verb-form':{label:'felin təsrif forması',question:''}};
const registers={colloquial:'danışıq dili',slang:'loru danışıq',regional:'bölgə danışığı',online:'onlayn danışıq',formal:'rəsmi dil'};
function describeWord(node,byWord){
 const base=node.base?byWord.get(node.base):null,form=forms[node.form];let definition=node.az||node.source?.senses?.[0]||node.en;
 if(base&&node.quality==='generated'&&!node.retainedLexicalSense){
  if(node.form==='plural')definition=`“${base.w}” sözünün cəm forması; birdən çox ${base.w} bildirir.`;
  if(node.form==='locative')definition=`“${base.w}” sözünün yerlik halı. Yeri və ya vəziyyəti bildirir; “harada?” sualına cavab verir.`;
  if(node.form==='ablative')definition=`“${base.w}” sözünün çıxışlıq halı. Çıxış nöqtəsini, mənbəni və ya ayrılmanı bildirir; “haradan?” sualına cavab verir.`;
 }
 const suffix=base&&node.form!=='verb-form'&&node.w.startsWith(base.w)?node.w.slice(base.w.length):'';
 return {definition,definitionEnglish:node.en,definitionLanguage:node.az?'az':node.source?.language||'en',translationMethod:node.bilingualMethod,source:node.source,extraSenses:(node.quality==='wiktionary'||node.retainedLexicalSense||node.definitionSources?.length)?(node.bilingualSenses||node.source?.senses||[]).slice(1):[],listedForm:node.quality==='wiktionary-form'&&!node.retainedLexicalSense,register:registers[node.definitionRegister],example:node.definitionExample||examples[node.w]||null,usage:node.definitionUsage||usage[node.w]||(node.source?.senseLimited?'Bu məna mənbədəki sinonim istinadına əsaslanır; sözün bütün işlənmələrini əhatə etmir.':''),base,form:form||null,suffix,generated:node.quality==='generated'&&!node.retainedLexicalSense};
}
const specialMeaning={
 az:'Xüsusi · İzah bütün hərflər tamamlandıqdan sonra araşdırılacaq.',
 en:'Special · Meaning set aside for review after all letters are covered.'
};
const api={examples,describeWord,specialMeaning};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WordInfo=api;
})(typeof window!=='undefined'?window:globalThis);
