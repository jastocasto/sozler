// Navigation groups, not dictionary assertions or additional semantic edges.
const region=(id,label,en,color,groups)=>({id,label,en,color,groups});
const group=(id,label,en,keywords='',words='')=>({id,label,en,keywords:keywords.split('|').filter(Boolean),words:words.split('|').filter(Boolean)});
module.exports=[
region('descriptions','Təsvirlər','Descriptions','#bcb4cf',[
 group('beauty','Gözəllik','Beauty','beautiful|beauty|pretty|attractive|elegant|elegance|lovely|graceful|handsome|charming','gözəl|gözəllik|qəşəng|qəşənglik|yaraşıqlı|cazibədar|füsunkar|zərif|zəriflik|lətafətli|lətafət|dilbər|göyçək'),
 group('ugliness','Eybəcərlik','Ugliness','ugly|ugliness|unattractive|unsightly|hideous|grotesque','çirkin|çirkinlik|eybəcər|eybəcərlik|yaraşıqsız'),
 group('kindness','Xoş xasiyyət','Kindness','kindness|kind-hearted|generous|generosity|compassionate|merciful|polite|courteous|gentle|friendly|honest|honesty','mehriban|xeyirxah|xeyirxahlıq|səxavətli|nəzakətli|dürüst|mərhəmətli'),
 group('cruelty','Sərt xasiyyət','Harshness','cruel|cruelty|unkind|rude|arrogant|selfish|dishonest|malicious|merciless','qəddar|qəddarlıq|kobud|amansız|təkəbbürlü|xudpəsənd'),
 group('colours','Rəng və işıq','Colour & light','red|blue|yellow|green|white|black|colour|color|bright|brightness|dark|transparent|shiny','qırmızı|mavi|sarı|yaşıl|ağ|qara|rəng|rəngli|işıqlı|qaranlıq'),
 group('shape','Ölçü və forma','Size & shape','big|large|small|tiny|wide|narrow|tall|short|long|round|square|curved|flat|shape|size|thick|thin','böyük|kiçik|uzun|qısa|geniş|dar|yumru|qalın|nazik'),
 group('strength','Güc və sürət','Strength & speed','strong|weak|powerful|strength|fast|slow|quick|rapid|heavy|lightweight|powerless','güclü|gücsüz|zəif|sürətli|yavaş|cəld|ağır|yüngül'),
 group('condition','Hal və keyfiyyət','State & quality','hot|cold|warm|wet|dry|clean|dirty|fresh|old|new|soft|hard|rough|smooth|empty|full|healthy|broken','isti|soyuq|təzə|köhnə|yeni|yumşaq|bərk|təmiz|çirkli|boş|dolu'),
 group('qualities','Digər təsvirlər','Other descriptions')
]),
region('actions','Hərəkətlər','Actions','#c5b082',[
 group('create','Yaratmaq və işləmək','Create & work','make|create|build|construct|produce|manufacture|repair|work|write|draw|design|sew|cut|prepare','eləmək|etmək|yaratmaq|qurmaq|işləmək|hazırlamaq|düzəltmək|yazmaq|elətdirmək|etdirmək'),
 group('movement','Hərəkət və yol','Move & travel','go|come|walk|run|travel|move|climb|fly|jump|swim|leave|arrive|enter|exit|turn','getmək|gəlmək|qaçmaq|gəzmək|üzmək|uçmaq|tullanmaq'),
 group('speaking','Danışmaq və eşitmək','Speak & listen','say|speak|talk|tell|ask|answer|listen|hear|call|sing|shout|whisper','danışmaq|demək|söyləmək|dinləmək|eşitmək|soruşmaq'),
 group('thinking','Düşünmək və öyrənmək','Think & learn','think|know|learn|teach|understand|remember|forget|read|study|believe|imagine|decide|consider','düşünmək|bilmək|öyrənmək|öyrətmək|anlamaq|oxumaq'),
 group('living','Yaşamaq və hiss etmək','Live & feel','live|breathe|sleep|wake|eat|drink|feel|love|hate|laugh|cry|grow|die|see|smell','yaşamaq|sevmək|görmək|yatmaq|yemək|içmək|gülmək|ağlamaq'),
 group('interact','Vermək və bölüşmək','Give & share','give|take|help|share|buy|sell|pay|send|receive|meet|protect|fight|win|lose|carry|bring','vermək|almaq|gətirmək|aparmaq|göndərmək|bölüşmək|öpüş göndərmək|öpüş almaq|busə etmək'),
 group('other-actions','Başqa hərəkətlər','Other actions')
]),
region('nature','Təbiət','Nature','#99b19d',[
 group('animals','Heyvanlar','Animals','animal|bird|fish|mammal|insect|beetle|butterfly|snake|horse|cattle|dog|cat|sheep|goat|wolf|lion|rabbit|chicken|spider|worm|rodent','heyvan|quş|balıq|it|pişik|at|qoyun|keçi|arı|kəpənək'),
 group('plants','Bitkilər','Plants','plant|tree|flower|grass|shrub|herb|leaf|root|seed|vegetation|forest|woodland|botanical|fungus','bitki|ağac|çiçək|yarpaq|meşə|ot|toxum'),
 group('land','Yer və su','Land & water','mountain|river|sea|ocean|lake|rock|stone|soil|sand|valley|island|beach|coast|glacier|volcano|landscape','dağ|çay|dəniz|okean|göl|daş|torpaq|qum|ada'),
 group('sky','Göy və hava','Sky & weather','sky|star|sun|moon|planet|galaxy|universe|cosmos|rain|snow|wind|cloud|storm|weather|climate|thunder|atmosphere','səma|göy|ulduz|günəş|ay|yağış|qar|külək|bulud|kainat'),
 group('environment','Canlı aləm','Living world','nature|natural|ecology|ecological|environment|ecosystem|habitat|biodiversity|species|conservation|pollution','təbiət|ekologiya|ətraf mühit')
]),
region('people','İnsan','People','#bd9c98',[
 group('body','Bədən','Body','body|head|hand|finger|arm|leg|foot|eye|ear|nose|mouth|tooth|skin|bone|blood|heart|lung|brain|muscle|organ','bədən|baş|əl|ayaq|göz|qulaq|ürək|qan'),
 group('health','Sağlamlıq','Health','health|medical|medicine|disease|illness|patient|hospital|doctor|surgery|therapy|treatment|cancer|infection|syndrome|symptom|diagnosis|pain|drug|pharmaceutical','sağlamlıq|xəstəlik|xəstəxana|həkim|dərman|tibb'),
 group('family','Ailə və insanlar','Family & people','family|mother|father|sister|brother|daughter|son|child|parent|wife|husband|woman|man|person|people|human|friend|relative','ailə|ana|ata|bacı|qardaş|uşaq|insan|dost'),
 group('feelings','Hisslər','Feelings','feeling|emotion|happy|happiness|sad|sadness|love|affection|fear|anger|angry|joy|hope|grief|sorrow|anxiety|lonely|loneliness','sevgi|məhəbbət|qorxu|sevinc|kədər|ümid|hiss|naz-nəvaziş|sevdicik|həmağuş'),
 group('mind','Düşüncə və davranış','Mind & behaviour','mind|mental|psychology|psychological|thought|memory|intelligence|consciousness|behaviour|behavior|personality|motivation|attention|perception','psixologiya|düşüncə|yaddaş|şüur'),
 group('occupations','Peşələr','Occupations','worker|profession|occupation|specialist|engineer|teacher|driver|farmer|soldier|merchant|artist|writer|scientist|employee','müəllim|mühəndis|işçi|sürücü|yazıçı|alim')
]),
region('daily','Gündəlik həyat','Everyday life','#b8a18b',[
 group('home','Ev və məişət','Home & household','house|home|room|kitchen|bed|chair|table|door|window|floor|ceiling|wall|roof|furniture|lamp|bath|household','ev|otaq|qapı|pəncərə|masa|stul|yataq'),
 group('food','Yemək və içki','Food & drink','food|dish|meal|bread|meat|milk|cheese|butter|egg|soup|rice|fruit|vegetable|apple|grape|pear|peach|juice|tea|coffee|wine|beer|salt|sugar|spice|cook|cuisine','çörək|süd|ət|pendir|alma|armud|üzüm|qəhvə|şəkər'),
 group('clothes','Geyim','Clothing','cloth|clothes|clothing|dress|shirt|trousers|coat|jacket|shoe|hat|cap|fabric|textile|cotton|wool|silk|leather|jewellery|jewelry','geyim|paltar|köynək|ayaqqabı|şalvar|papaq'),
 group('travel','Yol və nəqliyyat','Travel & transport','travel|transport|vehicle|car|bus|train|railway|road|street|bridge|airport|aircraft|ship|boat|bicycle|wheel|engine|ticket|journey','yol|nəqliyyat|avtomobil|maşın|qatar|təyyarə|gəmi|səyahət'),
 group('objects','Əşyalar və alətlər','Objects & tools','object|tool|device|instrument|machine|equipment|container|box|bottle|bag|knife|hammer|needle|rope|wire|key|paper|material','əşya|alət|qutu|şüşə|bıçaq|açar'),
 group('play','Oyun və idman','Play & sport','game|play|sport|football|basketball|chess|athlete|competition|exercise|swimming|tennis|ball','oyun|idman|futbol|şahmat|top')
]),
region('culture','Mədəniyyət','Culture','#b5a0b9',[
 group('language','Dil və söz','Language & words','language|word|speech|grammar|linguistic|linguistics|sentence|letter|alphabet|vowel|consonant|suffix|prefix|translation|dialect','dil|söz|məna|lüğət|cümlə|hərf|dilçilik'),
 group('learning','Bilik və təhsil','Knowledge & education','knowledge|education|school|university|student|lesson|book|library|learning|teaching|research|exam|literacy','bilik|təhsil|məktəb|universitet|kitab|kitabxana|dərs'),
 group('arts','Sənət və ədəbiyyat','Art & literature','art|painting|drawing|sculpture|literature|poem|poetry|novel|story|author|theatre|theater|cinema|film|museum|culture|cultural','sənət|incəsənət|ədəbiyyat|şeir|roman|kino|teatr|rəsm|mədəniyyət'),
 group('music','Musiqi və səs','Music & sound','music|musical|song|melody|rhythm|dance|sound|tone|voice|guitar|piano|drum|orchestra','musiqi|mahnı|melodiya|səs|rəqs'),
 group('belief','İnam və ənənə','Belief & tradition','religion|religious|god|goddess|prayer|mosque|church|faith|belief|myth|legend|ritual|tradition|custom|festival|holy|sacred','din|inam|ənənə|bayram|dua')
]),
region('society','Cəmiyyət','Society','#a6afbd',[
 group('community','Birlik və münasibətlər','Community & relationships','society|social|community|association|organization|organisation|group|team|union|relationship|communication|public','cəmiyyət|icma|birlik|ünsiyyət|münasibət'),
 group('politics','Dövlət və tarix','State & history','state|government|political|politics|president|minister|parliament|king|queen|empire|war|army|military|history|historical|revolution','dövlət|hökumət|siyasət|tarix|müharibə'),
 group('law','Hüquq və qayda','Law & rules','law|legal|right|justice|court|judge|crime|criminal|prison|police|rule|regulation|contract','hüquq|qanun|ədalət|məhkəmə|qayda'),
 group('economy','Pul və iqtisadiyyat','Money & economy','money|economic|economy|finance|financial|bank|credit|investment|market|trade|business|company|price|cost|profit|income|tax|currency|payment|debt','pul|iqtisadiyyat|maliyyə|bank|bazar|qiymət|gəlir|vergi')
]),
region('science','Elm və texnologiya','Science & technology','#8faebc',[
 group('digital','Rəqəmsal dünya','Digital world','computer|computing|software|hardware|programming|data|algorithm|internet|network|digital|database|cyber|encryption|website','kompüter|proqram|alqoritm|internet|verilənlər|informatika'),
 group('engineering','Texnika və enerji','Technology & energy','technology|engineering|electronic|electric|electricity|energy|circuit|voltage|battery|robot|sensor|semiconductor|manufacturing','texnologiya|enerji|elektrik|elektronika|mühəndislik'),
 group('physical','Maddə və qüvvə','Matter & forces','physics|physical|chemical|chemistry|molecule|atom|element|compound|acid|metal|mineral|radiation|particle|quantum|force|gravity|magnetic','fizika|kimya|maddə|atom|molekul|qüvvə'),
 group('biology','Hüceyrə və həyat','Cells & life','biology|biological|cell|gene|genetic|dna|rna|protein|enzyme|bacteria|bacterium|microbe|organism|chromosome','biologiya|hüceyrə|gen|genetika|zülal'),
 group('math','Riyaziyyat','Mathematics','mathematics|mathematical|algebra|geometry|equation|function|integral|derivative|probability|statistic|matrix|vector|theorem','riyaziyyat|cəbr|həndəsə|tənlik|ehtimal')
]),
region('world','Məkan və zaman','Space & time','#b6b7a0',[
 group('places','Yerlər və adlar','Places & names','city|town|village|country|region|district|province|capital|republic|continent|azerbaijan|turkey|russia|iran|surname|given name|proper name','Bakı|Azərbaycan|şəhər|kənd|ölkə|yer'),
 group('time','Zaman','Time','time|day|night|morning|evening|year|month|week|hour|minute|second|century|today|tomorrow|yesterday|always|never|often|sometimes|eternal','vaxt|zaman|gün|gecə|il|saat|həmişə|daim|daima|hər vaxt|hər zaman|hər an'),
 group('space','Məkan və istiqamət','Space & direction','space|place|position|location|direction|distance|north|south|east|west|here|there|above|below|inside|outside|near|far','məkan|istiqamət|məsafə|burada|orada'),
 group('numbers','Say və miqdar','Number & quantity','number|quantity|amount|hundred|thousand|million|billion|percent|fraction|count','say|miqdar|bir|iki|üç|dörd|beş|altı|yeddi|səkkiz|doqquz|on|yüz|min')
]),
region('concepts','Anlayışlar','Concepts & expressions','#acaca6',[
 group('connections','Dilin bağları','Language connectors','','mən|sən|o|biz|siz|bu|və|amma|lakin|üçün|ilə|ki|çünki'),
 group('expressions','İfadələr','Expressions'),
 group('manner','Tərz və dərəcə','Manner & degree','','maçamaç'),
 group('abstract','Anlayışlar və mənalar','Concepts & meanings')
])];
