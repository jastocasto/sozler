const assert=require('node:assert/strict');
const {step,resolve,radius,moveDragged,penetration}=require('../dist/physics.js');
function node(i,overrides={}){return {id:i,x:0,y:0,tx:0,ty:0,r:24+i%5*4,depth:i?1:0,vx:0,vy:0,scale:1,scaleV:0,targetScale:1,...overrides};}
function separated(ps,label){for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){assert(penetration(ps[i],ps[j])<.001,`${label}: overlapping ${i}/${j}`);const visibleA=ps[i].r*(ps[i].scale+.09),visibleB=ps[j].r*(ps[j].scale+.09);assert(Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y)>=visibleA+visibleB,'Visible squash/stretch envelopes must be disjoint');}}
// A genuine impact reverses both bodies instead of merely pushing their positions apart.
const a=node(0,{r:30,x:-32,vx:8}),b=node(1,{r:30,x:32,vx:-8}),pair=[a,b];resolve(pair);separated(pair,'impact');assert(a.vx<0&&b.vx>0,'Bodies must bounce away after contact');
for(const count of [2,12,24,48]){
 const ps=Array.from({length:count},(_,i)=>node(i,{x:0,y:0,tx:Math.cos(i*2.399)*Math.sqrt(i)*100,ty:Math.sin(i*2.399)*Math.sqrt(i)*100,scale:.82,scaleV:.05}));
 resolve(ps);separated(ps,'coincident spawn');
 const edges=ps.slice(1).map(p=>({a:ps[0],b:p}));
 for(let frame=0;frame<360;frame++){step(ps,edges);separated(ps,'spring expansion');assert(ps.every(p=>Number.isFinite(p.x)&&Math.abs(p.x)<4000&&Number.isFinite(p.y)&&Math.abs(p.y)<4000));}
 const dragged=ps[0];for(const [x,y]of [[500,0],[-500,0],[0,500],[0,-500],[0,0]]){moveDragged(ps,dragged,x,y);assert.equal(dragged.x,x);assert.equal(dragged.y,y);separated(ps,'pointer sweep');}
 // Pause/reduced-motion rendering and resizes still enforce separation without a physics tick.
 ps.forEach((p,i)=>{p.x=i%2;p.y=i%3;p.scale=1.22;});resolve(ps,dragged,false);separated(ps,'paused maximum growth');
 for(let frame=0;frame<240;frame++){step(ps,edges);separated(ps,'release');}
}
// The gray map yields to the focused family, while a user-dragged context bubble stays pinned.
const focus=node(0,{local:true,x:0,y:0}),context=node(1,{local:false,inverseMass:2,x:30,y:0}),scene=[focus,context];
resolve(scene);assert.equal(focus.x,0);separated(scene,'context yield');moveDragged(scene,context,0,0);assert.equal(context.x,0);assert.equal(context.y,0);separated(scene,'dragged context');
// Fast magnetic arrivals still respect contact separation on every frame.
const fast=Array.from({length:40},(_,i)=>node(i,{local:true,maxSpeed:32,repulsion:0,spring:.14,damping:.77,x:i*75-1500,tx:Math.cos(i*2.399)*Math.sqrt(i)*90,ty:Math.sin(i*2.399)*Math.sqrt(i)*90}));
for(let frame=0;frame<180;frame++){step(fast,[]);separated(fast,'fast arrival');}
console.log('PASS: no overlap after cold spawn, every spring frame, maximum scale/stretch, pointer sweeps, paused dragging, release, and 48-body piles; impacts rebound.');
