/* English learning glosses for the selected Azerbaijani form, not sentence translation. */
(function(root){'use strict';
const irregular={backbite:['backbit','backbitten'],breastfeed:['breastfed','breastfed'],breed:['bred','bred'],broadcast:['broadcast','broadcast'],hew:['hewed','hewn'],oversleep:['overslept','overslept'],overtake:['overtook','overtaken'],overthrow:['overthrew','overthrown'],resell:['resold','resold'],undergo:['underwent','undergone'],unwind:['unwound','unwound'],shit:['shat','shat'],shoe:['shod','shod'],shed:['shed','shed'],speed:['sped','sped'],string:['strung','strung'],swell:['swelled','swollen'],wed:['wed','wed'],wet:['wet','wet'],arise:['arose','arisen'],awake:['awoke','awoken'],be:['was','been','being'],bear:['bore','borne'],beat:['beat','beaten'],become:['became','become'],begin:['began','begun'],bend:['bent','bent'],bet:['bet','bet'],bind:['bound','bound'],bite:['bit','bitten'],bleed:['bled','bled'],blow:['blew','blown'],break:['broke','broken'],breed:['bred','bred'],bring:['brought','brought'],build:['built','built'],burn:['burned','burned'],burst:['burst','burst'],buy:['bought','bought'],catch:['caught','caught'],choose:['chose','chosen'],cling:['clung','clung'],come:['came','come'],cost:['cost','cost'],creep:['crept','crept'],cut:['cut','cut'],deal:['dealt','dealt'],dig:['dug','dug'],do:['did','done'],draw:['drew','drawn'],dream:['dreamed','dreamed'],drink:['drank','drunk'],drive:['drove','driven'],eat:['ate','eaten'],fall:['fell','fallen'],feed:['fed','fed'],feel:['felt','felt'],fight:['fought','fought'],find:['found','found'],flee:['fled','fled'],fling:['flung','flung'],fly:['flew','flown'],forbid:['forbade','forbidden'],forget:['forgot','forgotten'],forgive:['forgave','forgiven'],freeze:['froze','frozen'],get:['got','gotten'],give:['gave','given'],go:['went','gone'],grind:['ground','ground'],grow:['grew','grown'],hang:['hung','hung'],have:['had','had'],hear:['heard','heard'],hide:['hid','hidden'],hit:['hit','hit'],hold:['held','held'],hurt:['hurt','hurt'],keep:['kept','kept'],kneel:['knelt','knelt'],know:['knew','known'],lay:['laid','laid'],lead:['led','led'],lean:['leaned','leaned'],leap:['leaped','leaped'],learn:['learned','learned'],leave:['left','left'],lend:['lent','lent'],let:['let','let'],lie:['lied','lied','lying'],light:['lit','lit'],lose:['lost','lost'],make:['made','made'],mean:['meant','meant'],meet:['met','met'],pay:['paid','paid'],prove:['proved','proven'],put:['put','put'],quit:['quit','quit'],read:['read','read'],ride:['rode','ridden'],ring:['rang','rung'],rise:['rose','risen'],run:['ran','run'],say:['said','said'],see:['saw','seen'],seek:['sought','sought'],sell:['sold','sold'],send:['sent','sent'],set:['set','set'],sew:['sewed','sewn'],shake:['shook','shaken'],shine:['shone','shone'],shoot:['shot','shot'],show:['showed','shown'],shrink:['shrank','shrunk'],shut:['shut','shut'],sing:['sang','sung'],sink:['sank','sunk'],sit:['sat','sat'],sleep:['slept','slept'],slide:['slid','slid'],smell:['smelled','smelled'],sow:['sowed','sown'],speak:['spoke','spoken'],spend:['spent','spent'],spill:['spilled','spilled'],spin:['spun','spun'],spit:['spat','spat'],split:['split','split'],spread:['spread','spread'],spring:['sprang','sprung'],stand:['stood','stood'],steal:['stole','stolen'],stick:['stuck','stuck'],sting:['stung','stung'],stink:['stank','stunk'],strike:['struck','struck'],swear:['swore','sworn'],sweep:['swept','swept'],swim:['swam','swum'],swing:['swung','swung'],take:['took','taken'],teach:['taught','taught'],tear:['tore','torn'],tell:['told','told'],think:['thought','thought'],throw:['threw','thrown'],tread:['trod','trodden'],understand:['understood','understood'],wake:['woke','woken'],wear:['wore','worn'],weave:['wove','woven'],weep:['wept','wept'],win:['won','won'],wind:['wound','wound'],withdraw:['withdrew','withdrawn'],withstand:['withstood','withstood'],wring:['wrung','wrung'],write:['wrote','written']};
const doubles=new Set('admit allot compel confer control defer deter emit equip excel expel incur infer occur omit permit prefer propel rebel recur refer regret repel submit transfer transmit'.split(' '));
const statives=new Set('be believe belong contain cost depend deserve dislike doubt equal exist hate have hear include know lack like love matter mean need owe own possess prefer realize recognize remember resemble see seem suppose understand want wish'.split(' '));
function principal(base){if(base.startsWith('self-')){const v=principal(base.slice(5));if(!v)return null;for(const key of ['base','past','participle','ing','third'])v[key]='self-'+v[key];return v;}const m=base.match(/^([a-z]+)(.*)$/i);if(!m)return null;const head=m[1].toLowerCase(),tail=m[2],short=(head.match(/[aeiouy]+/g)||[]).length===1,double=doubles.has(head)||short&&/[^aeiou][aeiou][bdfgklmnprstz]$/.test(head),d=double?head.slice(-1):'';let past=/[^aeiou]y$/.test(head)?head.slice(0,-1)+'ied':head.endsWith('e')?head+'d':head+d+'ed',ing=head.endsWith('ie')?head.slice(0,-2)+'ying':/[^eoy]e$/.test(head)?head.slice(0,-1)+'ing':head+d+'ing';if(head.endsWith('c')){past=head+'ked';ing=head+'king';}const special=head==='lie'&&/^ (?:down|on|in)/.test(tail)?['lay','lain','lying']:irregular[head];if(special){past=special[0];ing=special[2]||ing;}const third=head==='be'?'is':head==='have'?'has':/[^aeiou]y$/.test(head)?head.slice(0,-1)+'ies':/(?:s|sh|ch|x|z|o)$/.test(head)?head+'es':head+'s';return {head,tail,base:head+tail,past:past+tail,participle:(special?.[1]||past)+tail,ing:ing+tail,third:third+tail,stative:statives.has(head)};}
const subjects=['I','you','he / she / it','we','you','they'],objects=['me','you','him / her / it','us','you','them'],possessives=['my','your','his / her / its','our','your','their'],reflexives=['myself','yourself','himself / herself / itself','ourselves','yourselves','themselves'];
const cap=s=>s[0].toUpperCase()+s.slice(1);
function baseFromGloss(gloss){
 const cleaned=String(gloss||'').trim().replace(/^(?:figurative|colloquial|dialectal|vulgar|archaic|dated)\s*:\s*/i,'');
 if(!/^to\s+[a-z]/i.test(cleaned))return null;
 const base=cleaned.replace(/\([^()]*\)|\[[^\[\]]*\]/g,'').replace(/^to\s+/i,'')
  .split(/[;,.!?]|\s+or\s+|\s+and\s+/i)[0].replace(/\s+/g,' ').trim().toLowerCase();
 return /^[a-z]+(?:[ -][a-z][a-z'’-]*)*$/.test(base)?base:null;
}
function inflect(profile,id,p,negative,question){
 const v=principal(profile.base),sub=subjects[p],n=negative||id==='without',not=n?' not':'',am=p===0?'am':p===2?'is':'are',was=p===0||p===2?'was':'were',has=p===2?'has':'have',does=p===2?'does':'do',apply=s=>s.replace(/\boneself\b/g,reflexives[p]).replace(/\bone’s\b|\bone's\b/g,possessives[p]),base=apply(v.base),ing=apply(v.ing),part=apply(v.participle),past=apply(v.past),tail=apply(v.tail),third=apply(v.third);
 const clause=(aux,rest,s=sub,neg=n,q=question)=>q?`${aux} ${s}${neg?' not':''} ${rest}?`:`${s} ${aux}${neg?' not':''} ${rest}`;
 const simple=(pastTense=false,s=sub,thirdPerson=p===2,q=question,neg=n)=>{if(v.head==='be')return clause(pastTense?(s===sub?was:'was'):(s===sub?am:'is'),tail.trim(),s,neg,q);if(q||neg)return clause(pastTense?'did':thirdPerson?'does':'do',base,s,neg,q);return `${s} ${pastTense?past:thirdPerson?third:base}`;};
 const progressive=(pastTense=false)=>v.stative&&!profile.dynamic?simple(pastTense):clause(pastTense?was:am,ing);
 let text='',note=profile.note||'';
 switch(id){
 case 'infinitive':text=(n?'not ':'')+'to '+base;break;
 case 'present':text=progressive();break;
 case 'past':text=simple(true);break;
 case 'past_continuous':text=progressive(true);break;
 case 'past_perfect':text=clause('had',part);break;
 case 'perfect':text=clause(has,part);break;
 case 'future':text=clause('will',base);break;
 case 'aorist':text=clause('may',base);note='An uncertain or possible future action.';break;
 case 'necessity':text=clause('must',base);break;
 case 'past_necessity':text=n?clause(was,'supposed to '+base):question?clause('did','have to '+base):`${sub} had to ${base}`;break;
 case 'conditional':text='if '+simple(false,sub,p===2,false);if(question)text+='?';break;
 case 'past_conditional':text='if '+clause('had',part,sub,n,false);if(question)text+='?';break;
 case 'future_past':text=clause(was,'going to '+base);break;
 case 'aorist_past':text=clause('would',base);break;
 case 'evidential_present':text='apparently, '+progressive();note='Reported or inferred information.';break;
 case 'evidential_past':text='apparently, '+clause(has,part);note='Reported or inferred information.';break;
 case 'ability_present':text=question?clause('can',base):`${sub} ${n?'cannot':'can'} ${base}`;break;
 case 'ability_past':text=clause('could',base);break;
 case 'ability_future':text=clause('will','be able to '+base);break;
 case 'hortative':text=clause(am,'to '+base);note='An intended or expected action.';break;
 case 'optative':text=`may ${sub}${not} ${base}`+(question?'?':'');note='A wish or desired action.';break;
 case 'imperative':text=(p===1||p===4)?(n?'do not ':'')+base:`let ${objects[p]}${not} ${base}`;if(question)text+='?';break;
 case 'participle_present':text=simple(false,'one who',true,false);break;
 case 'participle_past':text=clause('has',part,'one who',n,false);break;
 case 'participle_future':text=clause('will',base,'one who',n,false);break;
 case 'converb_ip':text=(n?'not ':'')+'having '+part;break;
 case 'converb_araq':text=(n?'without ':'by ')+ing;break;
 case 'when':text='when '+(n?'not ':'')+ing;break;
 case 'while':text='while '+(n?'not ':'')+ing;break;
 case 'as':text='as '+simple(false,'one',true,false);break;
 case 'without':text='without '+ing;break;
 case 'verbal_noun':text=(n?'not ':'')+ing;break;
 case 'inf_genitive':text='of '+(n?'not ':'')+ing;break;
 case 'inf_dative':text=(n?'not ':'')+'to '+base;note='Dative: toward or for this action.';break;
 case 'inf_accusative':text='the act of '+(n?'not ':'')+ing;note='The action as a definite object.';break;
 case 'inf_locative':text='in '+(n?'not ':'')+ing;break;
 case 'inf_ablative':text='from '+(n?'not ':'')+ing;break;
 case 'possessive_past':text='what '+simple(true,sub,p===2,false);if(question)text+='?';note='A noun phrase; the noun comes from context.';break;
 case 'possessive_future':text='what '+clause('will',base,sub,n,false);if(question)text+='?';note='A noun phrase; the noun comes from context.';break;
 default:throw Error('Unknown English form: '+id);
 }
 return {text:cap(text.replace(/ +\?/g,'?').replace(/\s+/g,' ').trim()),note,pattern:false};
}
function describe(profile,id,p=0,negative=false,question=false){
 const base=profile?.base||baseFromGloss(profile?.gloss);
 if(!base)return {text:'English translation pending.',note:'',pattern:true};
 const result=inflect({...profile,base},id,p,negative,question);
 const alternatives=(profile?.alternatives||[]).map(item=>inflect({base:item,dynamic:profile.dynamic},id,p,negative,question).text);
 if(alternatives.length)result.note=[result.note,alternatives.join(' / ')].filter(Boolean).join(' ');
 return result;
}
const api={principal,baseFromGloss,describe,irregular};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ConjugationEnglish=api;
})(typeof window!=='undefined'?window:globalThis);
