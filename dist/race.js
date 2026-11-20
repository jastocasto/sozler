/* Shared daily challenges, offline rules and independent local score rankings. */
(function(root){
'use strict';
function dayKey(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),v=t=>parts.find(p=>p.type===t).value;return `${v('year')}-${v('month')}-${v('day')}`;}
const mod=(n,m)=>((n%m)+m)%m;
function mapRoutes(bank,atlas){
 const order=[...atlas.points].sort((a,b)=>a.cluster-b.cluster||Math.floor(a.y/180)-Math.floor(b.y/180)||a.x-b.x||a.y-b.y).map(point=>point.word);
 const indices=new Map(order.map((word,i)=>[word,i]));
 const neighbors=word=>{
  const i=indices.get(word);
  return i===undefined?[]:[order[mod(i-1,order.length)],order[mod(i+1,order.length)]];
 };
 const dailyMap=order.length>3?order.map((start,i)=>({start,target:order[(i+3)%order.length],route:'map'})):[];
 const gcd=(a,b)=>b?gcd(b,a%b):a;
 let rotationStep=7907;
 while(dailyMap.length&&gcd(dailyMap.length,rotationStep)!==1)rotationStep+=2;
 return {...bank,dailyMap,rotationStep,neighbors};
}
function daily(bank,now=new Date()){
 const day=dayKey(now),index=Math.floor(Date.parse(day+'T00:00:00Z')/86400000);
 // The original and atlas challenges keep independent score identities.
 const atlasDay=bank.dailyMap?.length&&mod(index,2)===1;
 const c=atlasDay?bank.dailyMap[mod(Math.floor(index/2)*bank.rotationStep,bank.dailyMap.length)]:bank.challenges[mod(index,bank.challenges.length)];
 const prefix=atlasDay?bank.version+':atlas':bank.version;
 return {...c,mode:'daily',day,id:prefix+':'+day};
}
function practice(bank,previous=null,random=Math.random,now=new Date(),seen=[]){
 const id=c=>bank.version+(c.route==='map'?':atlas':'')+':practice:'+encodeURIComponent(c.start)+'>'+encodeURIComponent(c.target),recent=new Set(seen);
 const pools=[bank.challenges,bank.dailyMap||[]];
 const available=c=>!previous||c.start!==previous.start&&c.start!==previous.target&&c.target!==previous.start&&c.target!==previous.target;
 const unseen=pools.map(pool=>pool.filter(c=>available(c)&&!recent.has(id(c))));
 const choices=unseen.some(pool=>pool.length)?unseen:pools.map(pool=>pool.filter(available));
 const nonempty=choices.filter(pool=>pool.length);
 const options=(nonempty.length?nonempty[Math.min(nonempty.length-1,Math.floor(Math.max(0,random())*nonempty.length))]:bank.challenges);
 const c=options[Math.min(options.length-1,Math.floor(Math.max(0,random())*options.length))];
 return {...c,mode:'practice',day:dayKey(now),id:id(c)};
}
function begin(challenge,now){return {challenge,taps:0,path:[challenge.start],started:now,elapsed:0,active:true,complete:false};}
function tap(state,word,visible,now,back=false){if(!state?.active||!visible)return false;state.taps++;state.path.push(word);state.elapsed=Math.max(0,now-state.started);return true;}
function finish(state,selected,centered,now){if(!state?.active||selected!==state.challenge.target||!centered)return null;state.active=false;state.complete=true;state.elapsed=Math.max(0,now-state.started);return {id:state.challenge.id,mode:state.challenge.mode||'daily',day:state.challenge.day,start:state.challenge.start,target:state.challenge.target,taps:state.taps,ms:state.elapsed,path:[...state.path]};}
function rank(previous,score){const best=previous||{};return {time:!best.time||score.ms<best.time.ms||score.ms===best.time.ms&&score.taps<best.time.taps?score:best.time,taps:!best.taps||score.taps<best.taps.taps||score.taps===best.taps.taps&&score.ms<best.taps.ms?score:best.taps};}
const api={dayKey,daily,practice,mapRoutes,begin,tap,finish,rank};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WordRace=api;
})(typeof window!=='undefined'?window:globalThis);
