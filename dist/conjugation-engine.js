/* Azerbaijani inflection rules, gated by dictionary infinitive entries. */
(function(root){'use strict';
const definitions=[
 ['infinitive','Məsdər','Infinitive','form',false,['infinitive']],
 ['present','İndiki zaman','Present','tense',true,['indicative','present']],
 ['past','Şühudi keçmiş','Definite past','tense',true,['indicative','past']],
 ['past_continuous','İndiki zamanın hekayəsi','Past continuous','tense',true,['continuative','indicative','past']],
 ['past_perfect','Nəqli keçmişin hekayəsi','Past perfect','tense',true,['indicative','past','perfect']],
 ['perfect','Nəqli keçmiş','Reported / perfect past','tense',true,['indicative','perfect','perfect-i','present']],
 ['future','Qəti gələcək','Definite future','tense',true,['definite','future','indicative']],
 ['aorist','Qeyri-qəti gələcək','Indefinite future','tense',true,['future','indefinite','indicative']],
 ['necessity','Vacib şəkli','Necessity','mood',true,['obligative','present']],
 ['past_necessity','Vacib şəklinin hekayəsi','Past necessity','mood',true,['obligative','past']],
 ['conditional','Şərt şəkli','Conditional','mood',true,['conditional','present']],
 ['imperative','Əmr şəkli','Imperative','mood',true,['imperative']],
 ['optative','Arzu şəkli','Optative','mood',true,['subjunctive']],
 ['hortative','Lazım şəkli','Obligation / intended action','mood',true,['hortative']],
 ['past_conditional','Şərt şəklinin hekayəsi','Past conditional','mood',true,['conditional','past']],
 ['future_past','Qəti gələcəyin hekayəsi','Definite future in the past','tense',true,['definite','indicative','past-future']],
 ['aorist_past','Qeyri-qəti gələcəyin hekayəsi','Indefinite future in the past','tense',true,['indefinite','indicative','past-future']],
 ['evidential_present','İndiki zamanın rəvayəti','Reported present','tense',true,['evidential','present']],
 ['evidential_past','Keçmiş zamanın rəvayəti','Reported past','tense',true,['evidential','past']],
 ['ability_present','Bacarıq · indiki zaman','Ability · present','mood',true,[]],
 ['ability_past','Bacarıq · keçmiş zaman','Ability · past','mood',true,[]],
 ['ability_future','Bacarıq · gələcək zaman','Ability · future','mood',true,[]],
 ['participle_present','Feli sifət · indiki','Present participle','form',false,['non-past','participle','subjective']],
 ['participle_past','Feli sifət · keçmiş','Past participle','form',false,['participle','past','subjective']],
 ['participle_future','Feli sifət · gələcək','Future participle','form',false,['definite','future','participle','subjective']],
 ['converb_ip','Feli bağlama · -ıb','Converb · -ıb / -ib / -ub / -üb','form',false,['converb']],
 ['converb_araq','Feli bağlama · -araq','Converb · manner','form',false,['modal','participle']],
 ['when','Feli bağlama · -anda','When / on doing','form',false,['general','participle','temporal']],
 ['while','Feli bağlama · -arkən','While doing','form',false,['participle','specific','temporal']],
 ['as','Feli bağlama · -dıqca','As / the more one does','form',false,['intensifier','participle']],
 ['without','Feli bağlama · -madan','Without doing','form',false,[],true],
 ['verbal_noun','Hərəkət adı · -ma','Verbal noun','form',false,['noun-from-verb']],
 ['inf_genitive','Məsdər · yiyəlik hal','Infinitive · genitive','case',false,[]],
 ['inf_dative','Məsdər · yönlük hal','Infinitive · dative','case',false,[]],
 ['inf_accusative','Məsdər · təsirlik hal','Infinitive · accusative','case',false,[]],
 ['inf_locative','Məsdər · yerlik hal','Infinitive · locative','case',false,[]],
 ['inf_ablative','Məsdər · çıxışlıq hal','Infinitive · ablative','case',false,[]],
 ['possessive_past','Feli sifət · -dığım','Possessed past participle','form',true,[]],
 ['possessive_future','Feli sifət · -acağım','Possessed future participle','form',true,[]]
];
const rows=definitions.map(([id,az,en,group,personal,tags,negativeOnly])=>({id,az,en,group,personal,tags,negativeOnly:!!negativeOnly}));
const vowels='aıouəeiöü',lastVowel=s=>[...s].reverse().find(c=>vowels.includes(c))||'ə',endsVowel=s=>vowels.includes(s.slice(-1));
function harmony(s){const v=lastVowel(s),front='əeiöü'.includes(v);return {A:front?'ə':'a',I:'aı'.includes(v)?'ı':'ou'.includes(v)?'u':'öü'.includes(v)?'ü':'i',Q:front?'k':'q',front};}
function pred(s,p,copula=false){const h=harmony(s);return s+[ (endsVowel(s)?'y':'')+h.A+'m','s'+h.A+'n',copula?'d'+h.I+'r':'',(endsVowel(s)?'y':'')+h.I+h.Q,'s'+h.I+'n'+h.I+'z',(copula?'d'+h.I+'r':'')+'l'+h.A+'r'][p];}
function past(s,p){const h=harmony(s);return s+['m','n','',h.Q,'n'+h.I+'z','l'+h.A+'r'][p];}
const soften=s=>s.endsWith('q')?s.slice(0,-1)+'ğ':s.endsWith('k')?s.slice(0,-1)+'y':s;
function futurePersonal(s,p){return pred(p===0||p===3?soften(s):s,p);}
function make(profile,id,p,n){
 const s=profile.stem,v=profile.vowelStem||s,h=harmony(s),neg=s+'m'+h.A,b=n?neg:s,alt=n?neg:v,join=t=>alt+(endsVowel(alt)?'y':'')+t,H=harmony(b),inf=b+'m'+H.A+H.Q;
 const present=n?s+'m'+h.I+'r':join(h.I+'r'),perfect=b+'m'+H.I+'ş',future=join(H.A+'c'+H.A+H.Q),aorist=n?neg+((p===0||p===3)?'r':'z'):join(h.A+'r'),conditional=b+'s'+H.A,necessity=b+'m'+H.A+'l'+H.I,hortative=join(H.A+'s'+H.I),converb=join(H.I+'b');
 switch(id){
 case 'infinitive':return inf;
 case 'present':return pred(present,p);
 case 'past':return past(b+'d'+H.I,p);
 case 'past_continuous':return past(present+'d'+harmony(present).I,p);
 case 'past_perfect':return past(perfect+'d'+harmony(perfect).I,p);
 case 'perfect':return pred((p===1||p===4)?perfect.slice(0,-1):perfect,p,p===2);
 case 'future':return futurePersonal(future,p);
 case 'aorist':return pred(aorist,p);
 case 'necessity':return pred(necessity,p,true);
 case 'past_necessity':return past(necessity+'yd'+harmony(necessity).I,p);
 case 'conditional':return past(conditional,p);
 case 'past_conditional':return past(conditional+'yd'+harmony(conditional).I,p);
 case 'future_past':return past(future+'d'+harmony(future).I,p);
 case 'aorist_past':{const a=n?neg+'z':join(h.A+'r');return past(a+'d'+harmony(a).I,p);}
 case 'evidential_present':return pred(present+'m'+harmony(present).I+'ş',p);
 case 'evidential_past':return pred(converb+'m'+harmony(converb).I+'ş',p);
 case 'hortative':return pred(hortative,p,true);
 case 'optative':{const a=join(H.A);return a+['m','s'+H.A+'n','',H.Q,'s'+H.I+'n'+H.I+'z','l'+H.A+'r'][p];}
 case 'imperative':return [join(H.I+'m'),b,b+'s'+H.I+'n',join(H.A+H.Q),join(H.I+'n'),b+'s'+H.I+'nl'+H.A+'r'][p];
 case 'ability_present':case 'ability_past':case 'ability_future':{const a=v+(endsVowel(v)?'y':'')+h.A;return a+' '+make({stem:'bil'},id.replace('ability_',''),p,n);}
 case 'participle_present':return join(H.A+'n');
 case 'participle_past':return perfect;
 case 'participle_future':return future;
 case 'converb_ip':return converb;
 case 'converb_araq':return join(H.A+'r'+H.A+H.Q);
 case 'when':return join(H.A+'nd'+H.A);
 case 'while':return join(H.A+'r')+'kən';
 case 'as':return b+'d'+H.I+H.Q+'c'+H.A;
 case 'without':return neg+'d'+h.A+'n';
 case 'verbal_noun':return b+'m'+H.A;
 case 'inf_genitive':return soften(inf)+harmony(inf).I+'n';
 case 'inf_dative':return soften(inf)+harmony(inf).A;
 case 'inf_accusative':return soften(inf)+harmony(inf).I;
 case 'inf_locative':return inf+'d'+harmony(inf).A;
 case 'inf_ablative':return inf+'d'+harmony(inf).A+'n';
 case 'possessive_past':case 'possessive_future':{const a=id==='possessive_past'?b+'d'+H.I+H.Q:future,z=soften(a),hh=harmony(a);return p===5?a+'l'+hh.A+'r'+hh.I:z+[hh.I+'m',hh.I+'n',hh.I,hh.I+'m'+hh.I+'z',hh.I+'n'+hh.I+'z'][p];}
 default:throw Error('Unknown conjugation row');
 }
}
function create(data){const cache=new Map();function get(word){if(typeof word!=='string'||!Object.prototype.hasOwnProperty.call(data.verbs,word))return null;const profile=data.verbs[word];if(profile.blocked)return profile;if(!cache.has(word))cache.set(word,{...profile,forms:rows.map(t=>[false,true].map(n=>Array.from({length:6},(_,p)=>make(profile,t.id,p,t.negativeOnly||n))))});return cache.get(word);}
 function form(word,index,person,negative,question=false){const entry=get(word),row=rows[index];if(!entry||entry.blocked||!row||person<0||person>5)return null;const n=row.negativeOnly||negative;let full=entry.forms[index][n?1:0][person];if(question&&row.personal)full+='m'+harmony(full).I+'?';const base=entry.vowelStem&&full.startsWith(entry.vowelStem)?entry.vowelStem:entry.stem;const space=base.lastIndexOf(' ');return {full,stem:base.slice(space+1),prefix:base.slice(0,space+1).trim(),suffix:full.slice(base.length),documented:!question&&!!((entry.verified?.[index]?.[n?1:0]||0)&(1<<person)),source:entry.source,stemSource:entry.stemSource,altered:base!==entry.stem};}
 return {get,form,rows};
}
function withDictionary(data,model){
 const evidence=model.verbEvidence||{},stemReview=data.stemReview,vowelStems=stemReview?.vowelStems||{};
 const nodes=model.nodes.filter(node=>(node.pos==='verb'||Object.hasOwn(evidence,node.w))&&/(maq|mək)$/.test(node.w));
 const order=nodes.map(node=>node.w).sort((a,b)=>a.localeCompare(b,'az'));
 const verbs=Object.create(null);
 for(const node of nodes){
  const word=node.w;
  if(data.verbs[word]){verbs[word]=data.verbs[word];continue;}
  const stem=word.slice(0,-3),tail=word.split(/[- ]/).at(-1);
  const tailVowelStem=data.verbs[tail]?.vowelStem||vowelStems[tail]||evidence[tail]?.vowelStem;
  const inherited=tailVowelStem&&tail!==word?word.slice(0,-tail.length)+tailVowelStem:stem;
  const reviewed=vowelStems[word];
  const source=node.source;
  const citation=stemReview?.wordSources?.[word]||evidence[word]?.source||source?.url||(source?.head?'https://'+(source.edition||'en')+'.wiktionary.org/wiki/'+encodeURIComponent(source.head)+'#Azerbaijani':null);
  verbs[word]={stem,vowelStem:reviewed||evidence[word]?.vowelStem||inherited,source:citation,stemSource:reviewed?stemReview.source:evidence[word]?.stemSource};
 }
 return {...data,order,verbs};
}
const api={create,make,rows,harmony,withDictionary};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ConjugationEngine=api;
})(typeof window!=='undefined'?window:globalThis);
