// Reproducible, entirely local cartography. Source dictionary data is never edited.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.join(__dirname,'..'),s={window:{}},taxonomy=require('./galaxy/taxonomy.cjs');
for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','relations','references','growth','verification'])vm.runInNewContext(fs.readFileSync(path.join(root,'dist',f+'.js'),'utf8'),s);
const w=s.window,{createModel}=require('../dist/model.js'),model=createModel(w.WORD_WEB_DATA,w.WORD_WEB_EXTRA,w.WORD_WEB_GRAMMAR,w.WORD_WEB_VOCABULARY,w.WORD_WEB_REVIEW,w.WORD_WEB_BILINGUAL,w.WORD_WEB_EXPANSION,w.WORD_WEB_NOMINAL,w.WORD_WEB_ADDITIONS,w.WORD_WEB_RELATIONS,w.WORD_WEB_REFERENCES,w.WORD_WEB_GROWTH,w.WORD_WEB_VERIFICATION);
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'galaxy/layout-base.json'),'utf8')),oldPoints=new Map(baseline.points.map(p=>[p[0],p]));
const hash=t=>{let h=2166136261;for(const c of t){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const regions=taxonomy.map((r,i)=>({...r,index:i,groups:undefined,clusters:[]})),clusters=[],explicit=new Map();
for(const [ri,r]of taxonomy.entries())for(const g of r.groups){const c={...g,index:clusters.length,region:ri,members:[]};c.patterns=g.keywords.map(k=>new RegExp('\\b'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:s|es|ing|ed|al)?\\b','i'));clusters.push(c);regions[ri].clusters.push(c.index);for(const word of g.words)explicit.set(word,c);}
const byCluster=new Map(clusters.map(c=>[c.id,c])),byRegion=new Map(regions.map(r=>[r.id,r])),assigned=new Map();
function assign(n,c,method){assigned.set(n.w,{c,method});}
function classify(n){
 const old=oldPoints.get(n.w);if(old)return [clusters[old[4]],'preserved map location'];
 const editorial=byCluster.get(n.source?.navigationGroup);if(editorial)return [editorial,'editorial topic'];
 if(explicit.has(n.w))return [explicit.get(n.w),'editorial anchor'];
 const primary=n.en.split(/;|\n/)[0].slice(0,240),isVerb=n.pos==='verb',isAdj=n.pos==='adjective';let best=null,score=0;
 const candidates=isVerb?clusters.filter(c=>c.region===byRegion.get('actions').index):isAdj?clusters.filter(c=>c.region===byRegion.get('descriptions').index):clusters.filter(c=>!['actions','descriptions'].includes(regions[c.region].id));
 for(const c of candidates){const value=c.patterns.reduce((sum,re)=>{const match=re.exec(primary);return sum+(match?(match.index<25?3:1):0);},0);if(value>score){best=c;score=value;}}
 if(best)return [best,'primary meaning'];
 if(isVerb)return [byCluster.get('other-actions'),'part of speech'];
 if(isAdj)return [byCluster.get('qualities'),'part of speech'];
 if(n.pos==='numeral')return [byCluster.get('numbers'),'part of speech'];
 if(['function','postposition','preposition','pronoun','determiner','conjunction','particle'].includes(n.pos))return [byCluster.get('connections'),'part of speech'];
 if(n.pos==='interjection'||n.pos==='phrase')return [byCluster.get('expressions'),'part of speech'];
 if(n.pos==='adverb')return [byCluster.get('manner'),'part of speech'];
 return [byCluster.get('abstract'),'unclassified'];
}
for(const n of model.nodes){const[c,method]=classify(n);assign(n,c,method);}
// Only unclassified entries may borrow a navigation group from a documented
// root/synonym neighbour. This never creates or changes a relationship.
for(let round=0;round<2;round++){const updates=[];for(const n of model.nodes){if(assigned.get(n.w).method!=='unclassified')continue;const votes=new Map();for(const r of model.related(n)){if(!['root','syn'].includes(r.edge.type))continue;const a=assigned.get(r.node.w);if(!a||a.method==='unclassified'||['actions','concepts'].includes(regions[a.c.region].id))continue;votes.set(a.c,(votes.get(a.c)||0)+(r.edge.type==='root'?2:1));}const best=[...votes].sort((a,b)=>b[1]-a[1]||a[0].index-b[0].index)[0];if(best)updates.push([n,best[0]]);}for(const[n,c]of updates)assign(n,c,'documented neighbour');}
for(const n of model.nodes)assigned.get(n.w).c.members.push(n);
const golden=Math.PI*(3-Math.sqrt(5));
// Add new points outside each original cluster's existing phyllotaxis sequence.
// The baseline remains committed so rebuilding never shifts earlier words.
const points=baseline.points.filter(p=>model.byWord.has(p[0])).map(p=>[...p]);
// Earlier additions occupy slots ordered by their 32-bit hash. Later dictionary
// entries take consecutive slots after them, in the order they were published.
const reviewedSlots=new Map((w.WORD_WEB_VERIFICATION.dictionaryEdition?.entries||[]).map((entry,i)=>[entry.word,2**32+i]));
const placementOrder=node=>reviewedSlots.get(node.w)??hash(node.w);
for(const c of clusters){
 const old=baseline.clusters[c.index];if(c.id!==old.id)throw Error('Baseline taxonomy mismatch');
 Object.assign(c,{x:old.x,y:old.y,z:old.z,featured:[...old.featured],count:c.members.length});
 const additions=c.members.filter(n=>!oldPoints.has(n.w)).sort((a,b)=>placementOrder(a)-placementOrder(b));
 c.next=old.count+additions.length;
 for(const [offset,n]of additions.entries()){
  const i=old.count+offset,angle=i*golden+(hash(c.id)%628)/100,rad=Math.sqrt(i)*74;
  points.push([n.w,Math.round(c.x+Math.cos(angle)*rad),Math.round(c.y+Math.sin(angle)*rad),Math.round(c.z+Math.sin(angle*2)*Math.min(rad*.08,100)+(hash(n.w)%90)-45),c.index]);
 }
 c.radius=Math.max(old.radius,Math.sqrt(c.count)*74+140);
}
for(const r of regions){const old=baseline.regions[r.index];r.x=old.x;r.y=old.y;const cs=r.clusters.map(i=>clusters[i]);r.count=cs.reduce((n,c)=>n+c.count,0);r.radius=Math.max(old.radius,...cs.map(c=>Math.hypot(c.x-r.x,c.y-r.y)+c.radius+300));}
const spelling=placeSpellings();
const extent=Math.max(...regions.map(r=>Math.hypot(r.x,r.y)+r.radius));
const payload={version:1,regions:regions.map(({id,label,en,color,index,x,y,radius,count,clusters})=>({id,label,en,color,index,x:Math.round(x),y:Math.round(y),radius:Math.ceil(radius),count,clusters})),clusters:clusters.map(({id,label,en,index,region,x,y,z,radius,count,base,featured})=>({id,label,en,index,region,x:Math.round(x),y:Math.round(y),z,radius:Math.ceil(radius),count,base,featured})),points,spelling,extent:Math.ceil(extent),meta:{entries:points.length+spelling.count,policy:'Editorial navigation groups based on primary definitions, explicit anchors, parts of speech and documented neighbours. Proximity is not a synonym, root or etymology claim. Positions within each cluster are preserved; clusters and regions are packed apart. Spelling-dictionary words join the topic of their meaning or base word, else a word-formation group.',methods:Object.fromEntries([...new Set([...assigned.values()].map(a=>a.method))].map(method=>[method,[...assigned.values()].filter(a=>a.method===method).length])),spellingMethods:spelling.methods}};
fs.writeFileSync(path.join(root,'dist/galaxy-data.js'),'window.WORD_GALAXY_DATA='+JSON.stringify(payload)+';\n');
const attribution={...payload.meta,regions:regions.length,clusters:clusters.length,source_sha256:crypto.createHash('sha256').update(model.nodes.map(n=>n.w+'\t'+n.en).join('\n')).digest('hex'),notes:'Each word has one primary map location. Earlier dictionary words keep their depth and offset from the centre of their group as the groups move. Word cards give the documented relationship and its evidence. The map uses depth to help readers see the layers.'};
fs.writeFileSync(path.join(root,'dist/galaxy-attribution.json'),JSON.stringify(attribution,null,2)+'\n');
console.log(JSON.stringify({entries:points.length,extent:payload.extent,regions:payload.regions.map(r=>[r.label,r.count,Math.round(r.radius)]),methods:payload.meta.methods},null,2));

// Spelling-dictionary words (the 2021 orthography dictionary) used to sit in one separate disk. Each now joins a
// topic cluster: by its primary meaning, else by its base or documented neighbours, else a named word-formation
// group in the region of its word class. The browser places them on each cluster's phyllotaxis after its
// dictionary words (galaxy.js), from one cluster code per word, so the data file stays small.
function placeSpellings(){
 const full={window:{}};
 for(const f of ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','relations','references','growth','verification','orthography','orthography-lexical','print-definitions'])vm.runInNewContext(fs.readFileSync(path.join(root,'dist',f+'.js'),'utf8'),full);
 const W=full.window,all=createModel(W.WORD_WEB_DATA,W.WORD_WEB_EXTRA,W.WORD_WEB_GRAMMAR,W.WORD_WEB_VOCABULARY,W.WORD_WEB_REVIEW,W.WORD_WEB_BILINGUAL,W.WORD_WEB_EXPANSION,W.WORD_WEB_NOMINAL,W.WORD_WEB_ADDITIONS,W.WORD_WEB_RELATIONS,W.WORD_WEB_REFERENCES,W.WORD_WEB_GROWTH,W.WORD_WEB_VERIFICATION,W.WORD_WEB_ORTHOGRAPHY,W.WORD_WEB_ORTHOGRAPHY_LEXICAL,W.WORD_WEB_PRINT_DEFINITIONS);
 const spellings=all.orthographyNodes,methods={};
 const WEAK=new Set(['qualities','other-actions','manner','abstract','expressions','connections']);
 // An English gloss that only describes the formation says nothing about the topic (compound of X and Y).
 const FORMATION=/\b(compound of|formed from|with the suffix|verbal noun of|the act of|passive of|causative of|reflexive|reciprocal|diminutive|abstract noun|participle of|phrase made of|paired compound|doubled for|reduplication|the state or quality of being|without|having|with the prefix|relating to|like an?|to become|to make|one \S+ after another)\b/i;
 const strong=new Map(),result=new Map(),count=m=>methods[m]=(methods[m]||0)+1;
 for(const n of model.nodes){const c=assigned.get(n.w).c;if(!WEAK.has(c.id))strong.set(n.w,c);}
 for(const n of spellings){
  if(!n.en||FORMATION.test(n.en))continue;
  const primary=n.en.split(/;|\n/)[0].slice(0,240),region=n.pos==='verb'?'actions':n.pos==='adjective'?'descriptions':null;let best=null,score=0;
  for(const c of clusters){if(WEAK.has(c.id)||(region?regions[c.region].id!==region:['actions','descriptions'].includes(regions[c.region].id)))continue;const value=c.patterns.reduce((sum,re)=>{const match=re.exec(primary);return sum+(match?(match.index<25?3:1):0);},0);if(value>score){best=c;score=value;}}
  if(best){result.set(n.w,best);strong.set(n.w,best);count('primary meaning');}
 }
 // The base word of a derivation or compound, then documented neighbours; repeated so families settle together.
 for(let round=0;round<4;round++){
  const updates=[];
  for(const n of spellings){
   if(result.has(n.w))continue;
   const votes=new Map(),vote=(c,v)=>votes.set(c,(votes.get(c)||0)+v);
   if(n.definitionBase&&strong.has(n.definitionBase))vote(strong.get(n.definitionBase),5);
   for(const r of all.related(n)){const c=strong.get(r.node.w);if(c)vote(c,r.edge.type==='root'?3:r.edge.type==='syn'?2:1);}
   const best=[...votes].sort((a,b)=>b[1]-a[1]||a[0].index-b[0].index)[0];if(best)updates.push([n,best[0]]);
  }
  for(const [n,c] of updates){result.set(n.w,c);strong.set(n.w,c);count('base or neighbour');}
 }
 // Word-formation groups for the rest, in the region of their word class.
 const shapes={
  'a-having':['descriptions','-lı sözlər','Words in -lı (having)'],'a-without':['descriptions','-sız sözlər','Words in -sız (without)'],
  'a-other':['descriptions','Başqa sifətlər','More adjectives'],
  'v-become':['actions','-laş, -lan felləri','Verbs in -laş, -lan'],'v-causative':['actions','İcbar fellər','Causative verbs'],
  'v-passive':['actions','Məchul fellər','Passive verbs'],'v-reciprocal':['actions','Qarşılıq fellər','Reciprocal verbs'],
  'v-other':['actions','Başqa fellər','More verbs'],'terms':['science','Elmi terminlər','Scientific terms'],
  'n-action':['concepts','Feli isimlər (-ma)','Action nouns (-ma)'],'n-ness':['concepts','-lıq isimləri','Nouns in -lıq'],
  'n-doer':['concepts','İşi görənlər (-çı, -ıcı)','Doers (-çı, -ıcı)'],'paired':['concepts','Qoşa sözlər','Paired words'],
  'phrases':['concepts','Söz birləşmələri','Phrases'],'n-other':['concepts','Başqa isimlər','More nouns'],
  'undefined':['concepts','Tərifi gözlənilən sözlər','Words awaiting a definition']};
 const shape=n=>{
  const w=n.w;
  if(n.pos==='word'&&!n.en)return 'undefined';
  if(w.includes(' '))return 'phrases';
  if(w.includes('-'))return 'paired';
  if(n.pos==='verb'||/(maq|mək)$/.test(w)){
   if(/(laş|ləş|lan|lən)(maq|mək)$/.test(w))return 'v-become';
   if(/(dır|dir|dur|dür|t)(maq|mək)$/.test(w))return 'v-causative';
   if(/[ıiuü][ln](maq|mək)$/.test(w))return 'v-passive';
   if(/ş(maq|mək)$/.test(w))return 'v-reciprocal';
   return 'v-other';
  }
  if(n.pos==='adverb')return 'manner';
  if(/(sız|siz|suz|süz)$/.test(w))return 'a-without';
  if(/(lı|li|lu|lü)$/.test(w))return 'a-having';
  if(/(lıq|lik|luq|lük)$/.test(w))return 'n-ness';
  if(/(ma|mə)$/.test(w))return 'n-action';
  if(/(çı|çi|çu|çü|ıcı|ici|ucu|ücü)$/.test(w))return 'n-doer';
  if(!/[əğıöüç]/.test(w)&&/(logiya|qrafiya|metriya|terapiya|patiya|tomiya|iya|ika|izm|ist|oz|it|at|id|ol|ent|ant|ator|tor)$/.test(w))return 'terms';
  if(n.pos==='adjective')return 'a-other';
  if(['interjection','phrase'].includes(n.pos))return 'expressions';
  if(['function','postposition','pronoun','conjunction','particle','numeral'].includes(n.pos))return 'connections';
  return 'n-other';
 };
 const rest=new Map();
 for(const n of spellings){if(result.has(n.w))continue;const k=shape(n);if(byCluster.has(k)){result.set(n.w,byCluster.get(k));count('word class');continue;}if(!rest.has(k))rest.set(k,[]);rest.get(k).push(n);count('word formation');}
 // Large groups are split by alphabet so that no single cluster dwarfs the rest.
 const LIMIT=2500,collator=new Intl.Collator('az');
 for(const [k,members] of rest){
  members.sort((a,b)=>collator.compare(a.w,b.w));
  const parts=Math.ceil(members.length/LIMIT),size=members.length/parts,[regionId,label,en]=shapes[k],region=byRegion.get(regionId);
  // Cut only between initial letters, so each part covers whole letters (A–P, Q–Z).
  const initial=n=>n.w[0].toLocaleUpperCase('az'),cuts=[0];
  for(let part=1;part<parts;part++){let at=Math.round(part*size);while(at>cuts.at(-1)+1&&at<members.length&&initial(members[at])===initial(members[at-1]))at--;if(at<=cuts.at(-1)+1){at=Math.round(part*size);while(at<members.length&&initial(members[at])===initial(members[at-1]))at++;}cuts.push(at);}
  cuts.push(members.length);
  for(let part=0;part<parts;part++){
   const slice=members.slice(cuts[part],cuts[part+1]),first=initial(slice[0]),last=initial(slice.at(-1));
   const range=parts>1?(first===last?' · '+first:' · '+first+'–'+last):'';
   const c={id:k+(parts>1?'-'+(part+1):''),label:label+range,en:en+range,index:clusters.length,region:region.index,x:region.x,y:region.y,z:0,radius:0,count:0,featured:[],members:[],spelling:true};
   clusters.push(c);region.clusters.push(c.index);byCluster.set(c.id,c);
   for(const n of slice)result.set(n.w,c);
  }
 }
 // Cluster sizes: dictionary words first (their phyllotaxis index), then spelling words.
 const extra=new Map();for(const c of result.values())extra.set(c,(extra.get(c)||0)+1);
 for(const c of clusters){c.base=c.spelling?0:c.next;c.count=(c.spelling?0:c.members.length)+(extra.get(c)||0);c.radius=Math.sqrt(Math.max(c.base+(extra.get(c)||0),1))*74+140;}
 // Pack clusters within each region, keeping the earlier arrangement: scale offsets apart, then place new groups in gaps.
 const separate=(items,gap,centre)=>{
  for(let step=0;step<400;step++){let moved=false;
   for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);const need=a.radius+b.radius+gap;if(d>=need)continue;if(d<1){dx=Math.cos(i+j);dy=Math.sin(i+j);d=1;}const push=(need-d)/2;a.x-=dx/d*push;a.y-=dy/d*push;b.x+=dx/d*push;b.y+=dy/d*push;moved=true;}
   if(!moved)break;
  }
  // Pull every item back toward the centre as far as it can go without touching another.
  for(let step=0;step<200;step++){let moved=false;
   for(const a of [...items].sort((p,q)=>Math.hypot(p.x-centre.x,p.y-centre.y)-Math.hypot(q.x-centre.x,q.y-centre.y))){const dx=centre.x-a.x,dy=centre.y-a.y,d=Math.hypot(dx,dy);if(d<1)continue;
    // Straight in, else sliding around whatever blocks the way, as long as the item gets closer.
    search:for(const size of [a.radius*.2+50,40])for(const turn of [0,.5,-.5,1,-1]){const ux=(dx*Math.cos(turn)-dy*Math.sin(turn))/d,uy=(dx*Math.sin(turn)+dy*Math.cos(turn))/d,nx=a.x+ux*Math.min(d,size),ny=a.y+uy*Math.min(d,size);
     if(Math.hypot(centre.x-nx,centre.y-ny)<d-5&&items.every(b=>b===a||Math.hypot(b.x-nx,b.y-ny)>=a.radius+b.radius+gap)){a.x=nx;a.y=ny;moved=true;break search;}}}
   if(!moved)break;}
 };
 const moved=new Map();
 for(const r of regions){
  const cs=r.clusters.map(i=>clusters[i]);
  for(const c of cs){c.oldX=c.x;c.oldY=c.y;}
  // A new group starts on the region's rim, spread by the golden angle.
  for(const [i,c] of cs.filter(c=>c.spelling).entries()){const a=i*golden+r.index;c.x=r.x+Math.cos(a)*r.radius;c.y=r.y+Math.sin(a)*r.radius;}
  separate(cs,260,r);
  const cx=cs.reduce((s,c)=>s+c.x*c.count,0)/cs.reduce((s,c)=>s+c.count,0),cy=cs.reduce((s,c)=>s+c.y*c.count,0)/cs.reduce((s,c)=>s+c.count,0);
  r.x=cx;r.y=cy;r.radius=Math.max(...cs.map(c=>Math.hypot(c.x-cx,c.y-cy)+c.radius))+300;r.count=cs.reduce((s,c)=>s+c.count,0);
 }
 // Pack regions around the origin, keeping their compass directions.
 for(const r of regions){r.oldX=r.x;r.oldY=r.y;r.x*=.6;r.y*=1.25;}
 separate(regions,900,{x:0,y:0});
 for(const r of regions)for(const i of r.clusters){const c=clusters[i];c.x+=r.x-r.oldX;c.y+=r.y-r.oldY;}
 // Region circles leave empty corners, so pull each region in as a rigid group until its clusters (not its circle)
 // would come within the gap of another region's clusters. A compact map keeps the overview zoom close to the old one.
 const GAP=700,members=regions.map(r=>r.clusters.map(i=>clusters[i]));
 const fits=(r,dx,dy)=>members[r.index].every(a=>clusters.every(b=>b.region===r.index||Math.hypot(a.x+dx-b.x,a.y+dy-b.y)>=a.radius+b.radius+GAP));
 for(let step=0;step<300;step++){let moved=false;
  for(const r of [...regions].sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y))){
   const d=Math.hypot(r.x,r.y);if(d<1)continue;
   // Toward the centre, else sideways only, so the map ends up about as tall as it is wide (phones are portrait).
   const tries=[];for(const size of [Math.max(200,d*.04),60])tries.push([-r.x/d*size,-r.y/d*size],[-Math.sign(r.x)*Math.min(size,Math.abs(r.x)),0]);
   for(const [dx,dy] of tries){if((dx||dy)&&fits(r,dx,dy)){r.x+=dx;r.y+=dy;for(const c of members[r.index]){c.x+=dx;c.y+=dy;}moved=true;break;}}
  }
  if(!moved)break;
 }
 for(const r of regions){const cs=members[r.index];r.radius=Math.max(...cs.map(c=>Math.hypot(c.x-r.x,c.y-r.y)+c.radius))+300;}
 // Whole-number shifts, so every permanent word keeps its exact offset from its cluster centre.
 for(const c of clusters){if(c.spelling){c.x=Math.round(c.x);c.y=Math.round(c.y);continue;}const dx=Math.round(c.x-c.oldX),dy=Math.round(c.y-c.oldY);c.x=c.oldX+dx;c.y=c.oldY+dy;moved.set(c.index,[dx,dy]);}
 for(const p of points){const [dx,dy]=moved.get(p[4]);p[1]=Math.round(p[1]+dx);p[2]=Math.round(p[2]+dy);}
 // One printable character per spelling word, in the model's spelling order.
 const ALPHABET=' !#$%&()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~';
 if(clusters.length>ALPHABET.length)throw Error('Too many clusters for the spelling code');
 return {count:spellings.length,codes:spellings.map(n=>ALPHABET[result.get(n.w).index]).join(''),alphabet:ALPHABET,methods};
}
