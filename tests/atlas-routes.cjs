const assert=require('node:assert/strict');
const {createIndex}=require('../dist/atlas-routes.js');

let next=0;
function point(word,region,extra={}){
 return {word,region,node:{id:next++,w:word,az:word+' izahı',en:word+' definition',...extra}};
}
const a=point('buz',0),b=point('su',1),c=point('çay',1),d=point('daş',2),e=point('duz',3);
function edge(from,to,type){return {id:next++,from,to,a:from.node,b:to.node,type};}
const ab=edge(a,b,'root'),ba=edge(b,a,'root'),also=edge(b,a,'syn'),bc=edge(b,c,'syn');
const atlas={regions:[{},{},{},{}],edges:[ab,ba,ab,also,bc,edge(c,d,'ant'),edge(b,e,'topic'),edge(b,b,'ant')]};
const index=createIndex(atlas);
assert.deepEqual(index.summary(0,1),{count:2,counts:{root:1,syn:1}});
assert.deepEqual(index.summary(1,null),{count:5,counts:{root:1,syn:2,ant:1,topic:1}});
assert.deepEqual(index.summary(1,1),{count:1,counts:{syn:1}});
assert.deepEqual(index.summary(0,3),{count:0,counts:{}});
assert.deepEqual(index.summary(1,0,new Set(['syn'])),{count:1,counts:{syn:1}});
assert.deepEqual(index.summary(0,null,new Set()),{count:0,counts:{}});
assert.deepEqual(index.examples(1,1),[bc]);
assert.deepEqual(index.examples(0,1,new Set(['root'])),[ab]);
assert.deepEqual(index.examples(0,1,new Set(['syn'])),[also]);
assert.equal(index.examples(1,null,null,3).length,3);
assert.equal(new Set(index.examples(1,null,null,3).map(e=>e.type)).size,3);
assert.deepEqual(index.examples(1,1,[],5),[]);
assert.deepEqual(index.examples(1,1,null,0),[]);
assert.deepEqual(index.lanes(new Set()),[]);
assert.deepEqual(index.lanes(null,0),[]);
assert.deepEqual(index.lanes(null,Infinity).map(r=>[r.from,r.to,r.count]),[[0,1,2],[1,2,1],[1,3,1]]);
assert.deepEqual(index.lanes(['ant'],Infinity),[{from:1,to:2,count:1,counts:{ant:1}}]);
const full=index.lanes(null,Infinity);
atlas.edges.length=0;
assert.deepEqual(index.lanes(null,Infinity),full,'filtering and lookups never scan the original edges again');

function fixture(count,links){
 const regions=Array.from({length:count},()=>({}));
 const edges=[];
 for(const [a,b,size] of links)for(let k=0;k<size;k++)edges.push(edge(point('a'+a+'-'+b+'-'+k,a),point('b'+a+'-'+b+'-'+k,b),'topic'));
 return {regions,edges};
}
const star=fixture(5,[[0,1,2],[0,2,5],[0,3,1],[0,4,7]]);
assert.deepEqual(createIndex(star).lanes(null,2).map(r=>[r.from,r.to,r.count]),[[0,4,7],[0,2,5]]);
const chain=fixture(6,[[0,1,20],[0,2,10],[1,2,9],[2,3,2],[3,4,4],[4,5,1]]);
const lanes=createIndex(chain).lanes(null,2);
assert.equal(new Set(lanes.flatMap(route=>[route.from,route.to])).size,6);
for(let r=0;r<6;r++)assert(lanes.filter(lane=>lane.from===r||lane.to===r).length<=2);
const tied=fixture(4,[[3,0,2],[1,3,2],[0,2,2],[2,1,2],[1,0,2],[2,3,2]]);
assert.deepEqual(createIndex(tied).lanes(null,2),createIndex({...tied,edges:[...tied.edges].reverse()}).lanes(null,2));

const pending=point('yanvar',1,{az:undefined,en:undefined,definitionMethod:'meaning'});
const ready=point('qış',0),remaining=point('boş',1,{az:'',en:''});
const live=edge(pending,ready,'topic'),untranslated=edge(remaining,ready,'topic');
const deferred=createIndex({regions:[{},{}],edges:[live,untranslated]});
assert.equal(deferred.summary(0,1).count,2);
assert.deepEqual(deferred.examples(0,1),[]);
pending.node.az='İlin ilk ayı.';pending.node.en='January';
assert.deepEqual(deferred.examples(0,1),[live],'loaded bilingual fields become available without rebuilding the index');

console.log('PASS: typed route counts, distinct word pairs, caps and coverage, deterministic ties, active filters and bilingual examples after text hydration.');
