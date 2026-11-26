/* Real dictionary connections grouped by the atlas regions of their endpoints. */
(function(root){
'use strict';
const sampleCapacity=8;
const compare=(a,b)=>a<b?-1:a>b?1:0;

function bilingual(point){
 return Boolean(point.node.az?.trim()&&point.node.en?.trim());
}

// The core has editorial metadata before its text shard arrives. Keep edge
// references so example queries can read the current definitions after loading.
function pointQuality(point){
 const node=point.node;
 if(!bilingual(point)&&!node.bilingualMethod&&!node.definitionMethod)return 0;
 if(node.definitionAuditStatus==='source-compared'||node.quality==='curated')return 4;
 if(node.definitionMethod==='meaning'||node.definitionMethod==='paraphrase')return 3;
 return node.definitionMethod==='rule'?1:2;
}

function compareSamples(a,b){
 return b.quality-a.quality||a.length-b.length||compare(a.first,b.first)||compare(a.last,b.last)||compare(a.edge.type,b.edge.type);
}

function addSample(samples,edge){
 const quality=Math.min(pointQuality(edge.from),pointQuality(edge.to));
 const a=edge.from.word,b=edge.to.word;
 const length=a.length+b.length;
 const last=samples[samples.length-1];
 if(samples.length===sampleCapacity&&(quality<last.quality||(quality===last.quality&&length>last.length)))return;
 const candidate={edge,quality,length,first:a<b?a:b,last:a<b?b:a};
 const at=samples.findIndex(item=>compareSamples(candidate,item)<0);
 if(at<0){if(samples.length<sampleCapacity)samples.push(candidate);return;}
 samples.splice(at,0,candidate);
 if(samples.length>sampleCapacity)samples.pop();
}

// Repeated or reversed copies of the same typed lexical edge contribute once.
// Distinct relations between the same words are counted independently. Numeric
// node IDs allow the temporary duplicate sets to hold numbers, not edge copies.
function wordPairKey(a,b){
 const lo=Math.min(a.node.id,b.node.id),hi=Math.max(a.node.id,b.node.id);
 const numeric=hi*(hi+1)/2+lo;
 if(lo>=0&&Number.isSafeInteger(numeric))return numeric;
 return JSON.stringify(a.word<b.word?[a.word,b.word]:[b.word,a.word]);
}

function createIndex(atlas){
 const n=atlas.regions.length,table=new Map(),incident=Array.from({length:n},()=>[]);
 const visited=new Map();
 for(const edge of atlas.edges){
  const {from,to,type}=edge;
  if(from.word===to.word)continue;
  let seen=visited.get(type);
  if(!seen){seen=new Set();visited.set(type,seen);}
  const words=wordPairKey(from,to);
  if(seen.has(words))continue;
  seen.add(words);
  const a=Math.min(from.region,to.region),b=Math.max(from.region,to.region),key=a*n+b;
  let pair=table.get(key);
  if(!pair){
   pair={from:a,to:b,types:new Map()};table.set(key,pair);
   incident[a].push(pair);
   if(a!==b)incident[b].push(pair);
  }
  let group=pair.types.get(type);
  if(!group){group={count:0,samples:[]};pair.types.set(type,group);}
  group.count++;
  addSample(group.samples,edge);
 }
 visited.clear();

 function groups(region,otherRegion){
  if(!Number.isInteger(region)||region<0||region>=n)return [];
  if(otherRegion==null)return incident[region];
  if(!Number.isInteger(otherRegion)||otherRegion<0||otherRegion>=n)return [];
  const pair=table.get(Math.min(region,otherRegion)*n+Math.max(region,otherRegion));
  return pair?[pair]:[];
 }

 function totals(pairs,filters){
  const counts={};let count=0;
  for(const pair of pairs)for(const [type,group] of pair.types){
   if(filters&&!filters.has(type))continue;
   counts[type]=(counts[type]||0)+group.count;count+=group.count;
  }
  return {count,counts};
 }

 function summary(region,otherRegion,filters){
  return totals(groups(region,otherRegion),filters==null?null:new Set(filters));
 }

 function examples(region,otherRegion,filters,limit=4){
  const active=filters==null?null:new Set(filters),samples=[];
  for(const pair of groups(region,otherRegion))for(const [type,group] of pair.types){
   if(active&&!active.has(type))continue;
   for(const item of group.samples)if(bilingual(item.edge.from)&&bilingual(item.edge.to))samples.push(item);
  }
  samples.sort(compareSamples);
  const chosen=[],types=new Set(),used=new Set();
  // Show each selected relation once before filling remaining slots by quality.
  for(const item of samples){
   if(chosen.length>=limit)break;
   if(types.has(item.edge.type))continue;
   types.add(item.edge.type);used.add(item);chosen.push(item.edge);
  }
  for(const item of samples){
   if(chosen.length>=limit)break;
   if(!used.has(item))chosen.push(item.edge);
  }
  return chosen;
 }

 function lanes(filters,maxPerRegion=2){
  if(!(maxPerRegion>=1))return [];
  const ranked=[],active=filters==null?null:new Set(filters);
  for(const pair of table.values()){
   if(pair.from===pair.to)continue;
   const values=totals([pair],active);
   if(values.count)ranked.push({from:pair.from,to:pair.to,...values});
  }
  ranked.sort((a,b)=>b.count-a.count||a.from-b.from||a.to-b.to);
  if(maxPerRegion>=n-1)return ranked;
  const degree=Array(n).fill(0),options=Array.from({length:n},()=>[]),chosen=new Set();
  for(const lane of ranked){options[lane.from].push(lane);options[lane.to].push(lane);}
  function add(lane){chosen.add(lane);degree[lane.from]++;degree[lane.to]++;}
  // Give regions with few alternatives first choice of a real neighbour. Under
  // a hard cap a star can only show as many satellites as its hub permits.
  const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>options[a].length-options[b].length
   ||(options[b][0]?.count||0)-(options[a][0]?.count||0)||a-b);
  for(const region of order){
   if(degree[region])continue;
   const available=options[region].filter(lane=>degree[lane.from]<maxPerRegion&&degree[lane.to]<maxPerRegion);
   const lane=available.find(lane=>!degree[lane.from]&&!degree[lane.to])||available[0];
   if(lane)add(lane);
  }
  for(const lane of ranked)if(!chosen.has(lane)&&degree[lane.from]<maxPerRegion&&degree[lane.to]<maxPerRegion)add(lane);
  return ranked.filter(lane=>chosen.has(lane));
 }
 return {summary,examples,lanes};
}
const api={createIndex};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasRoutes=api;
})(typeof window!=='undefined'?window:globalThis);
