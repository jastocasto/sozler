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
for(const c of clusters){
 const old=baseline.clusters[c.index];if(c.id!==old.id)throw Error('Baseline taxonomy mismatch');
 Object.assign(c,{x:old.x,y:old.y,z:old.z,featured:[...old.featured],count:c.members.length});
 const additions=c.members.filter(n=>!oldPoints.has(n.w)).sort((a,b)=>hash(a.w)-hash(b.w));
 for(const [offset,n]of additions.entries()){
  const i=old.count+offset,angle=i*golden+(hash(c.id)%628)/100,rad=Math.sqrt(i)*74;
  points.push([n.w,Math.round(c.x+Math.cos(angle)*rad),Math.round(c.y+Math.sin(angle)*rad),Math.round(c.z+Math.sin(angle*2)*Math.min(rad*.08,100)+(hash(n.w)%90)-45),c.index]);
 }
 c.radius=Math.max(old.radius,Math.sqrt(c.count)*74+140);
}
for(const r of regions){const old=baseline.regions[r.index];r.x=old.x;r.y=old.y;const cs=r.clusters.map(i=>clusters[i]);r.count=cs.reduce((n,c)=>n+c.count,0);r.radius=Math.max(old.radius,...cs.map(c=>Math.hypot(c.x-r.x,c.y-r.y)+c.radius+300));}
const extent=Math.max(baseline.extent,...regions.map(r=>Math.hypot(r.x,r.y)+r.radius));
const payload={version:1,regions:regions.map(({id,label,en,color,index,x,y,radius,count,clusters})=>({id,label,en,color,index,x:Math.round(x),y:Math.round(y),radius:Math.ceil(radius),count,clusters})),clusters:clusters.map(({id,label,en,index,region,x,y,z,radius,count,featured})=>({id,label,en,index,region,x:Math.round(x),y:Math.round(y),z,radius:Math.ceil(radius),count,featured})),points,extent:Math.ceil(extent),meta:{entries:points.length,policy:'Editorial navigation groups based on primary definitions, explicit anchors, parts of speech and documented neighbours. Proximity is not a synonym, root or etymology claim. Previous positions are preserved exactly; additions extend their topic clusters.',methods:Object.fromEntries([...new Set([...assigned.values()].map(a=>a.method))].map(method=>[method,[...assigned.values()].filter(a=>a.method===method).length]))}};
fs.writeFileSync(path.join(root,'dist/galaxy-data.js'),'window.WORD_GALAXY_DATA='+JSON.stringify(payload)+';\n');
const attribution={...payload.meta,regions:regions.length,clusters:clusters.length,source_sha256:crypto.createHash('sha256').update(model.nodes.map(n=>n.w+'\t'+n.en).join('\n')).digest('hex'),notes:'Grouping is approximate and can be revised. Polysemous words have one primary map location. All earlier headwords and their coordinates are retained. New editorial words carry topic links only; no inflections have been added. Coordinate depth is a visual treatment, not linguistic distance.'};
fs.writeFileSync(path.join(root,'dist/galaxy-attribution.json'),JSON.stringify(attribution,null,2)+'\n');
console.log(JSON.stringify({entries:points.length,extent:payload.extent,regions:payload.regions.map(r=>[r.label,r.count,Math.round(r.radius)]),methods:payload.meta.methods},null,2));
