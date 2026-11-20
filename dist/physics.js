/* Fixed 60 Hz springs with hard, scale-aware contacts. */
(function(root){
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const GAP=3,EPS=1e-4,contactCache=new WeakMap();
const gap=(a,b)=>Math.min(a.contactGap??GAP,b.contactGap??GAP);
const inverseMass=p=>p.inverseMass??1/(p.r*p.r);
// Includes the largest possible velocity stretch used by the SVG renderer.
function radius(p){return p.r*(Math.max(1,p.scale||1)+.09)+(p.skin??2);}
function penetration(a,b){return radius(a)+radius(b)+gap(a,b)-Math.hypot(b.x-a.x,b.y-a.y);}
function resolve(particles,dragged=null,elastic=true,previousPositions=null,impactVelocities=null){
 const previousContacts=contactCache.get(particles)||new Set(),incoming=impactVelocities||particles.map(p=>({x:p.vx,y:p.vy}));
 const radii=particles.map(radius),weights=particles.map(p=>p===dragged?0:inverseMass(p));
 const nearby=()=>{const order=particles.map((p,i)=>({i,left:p.x-radii[i],right:p.x+radii[i]})).sort((a,b)=>a.left-b.left),pairs=[];for(let a=0;a<order.length;a++)for(let b=a+1;b<order.length&&order[b].left<=order[a].right+GAP+.3;b++){const i=Math.min(order[a].i,order[b].i),j=Math.max(order[a].i,order[b].i);if(Math.abs(particles[j].y-particles[i].y)<=radii[i]+radii[j]+GAP+.3)pairs.push([i,j]);}return pairs;};
 let solved=false;
 for(let iteration=0;iteration<80;iteration++){
  let worst=0;
  for(const [i,j]of nearby()){
   const a=particles[i],b=particles[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);const overlap=radii[i]+radii[j]+gap(a,b)-d;if(overlap<=EPS)continue;worst=Math.max(worst,overlap);
   if(d<1e-9){const angle=i*2.399+j*.71;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
   const nx=dx/d,ny=dy/d,wa=a.local&&!b.local&&b!==dragged?0:weights[i],wb=b.local&&!a.local&&a!==dragged?0:weights[j],sum=wa+wb;if(!sum)continue;
   const correction=(overlap+EPS)/sum;a.x-=nx*correction*wa;a.y-=ny*correction*wa;b.x+=nx*correction*wb;b.y+=ny*correction*wb;
  }
  if(worst<=EPS){solved=true;break;}
 }
 if(!solved){
  // Exact, deterministic recovery for cold starts and unusually dense piles.
  const ordered=dragged?[dragged,...particles.filter(p=>p!==dragged)]:particles,placed=[];
  for(const p of ordered){
   const blocked=(x,y)=>placed.some(q=>Math.hypot(x-q.x,y-q.y)<radius(p)+radius(q)+gap(p,q)-EPS);
   for(let attempt=0;attempt<160&&blocked(p.x,p.y);attempt++)for(const q of placed){const dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy)||1;const overlap=radius(p)+radius(q)+gap(p,q)-d;if(overlap>0){p.x+=dx/d*(overlap+EPS);p.y+=dy/d*(overlap+EPS);}}
   if(blocked(p.x,p.y)){
    const ox=p.x,oy=p.y,spacing=Math.max(12,radius(p)*.5);let found=false;
    for(let ring=1;ring<=32&&!found;ring++)for(let k=0;k<24;k++){const angle=k*Math.PI/12,x=ox+Math.cos(angle)*ring*spacing,y=oy+Math.sin(angle)*ring*spacing;if(!blocked(x,y)){p.x=x;p.y=y;found=true;break;}}
    if(!found)p.x=Math.max(...placed.map(q=>q.x+radius(q)))+radius(p)+GAP+1;
   }
   placed.push(p);
  }
 }
 // Position-based velocities remove the artificial energy of compressed springs.
 if(previousPositions)particles.forEach((p,i)=>{if(p!==dragged){const speed=p.maxSpeed??18;p.vx=clamp(p.x-previousPositions[i].x,-speed,speed);p.vy=clamp(p.y-previousPositions[i].y,-speed,speed);}});
 const contacts=new Set(),pairs=[];
 for(const[i,j]of nearby())if(penetration(particles[i],particles[j])>-.3){contacts.add(i*particles.length+j);pairs.push([i,j]);}
 for(let pass=0;pass<4;pass++)for(const[i,j]of pairs){
  const a=particles[i],b=particles[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d,wa=a.local&&!b.local&&b!==dragged?0:weights[i],wb=b.local&&!a.local&&a!==dragged?0:weights[j],sum=wa+wb;
  const incomingNormal=(incoming[j].x-incoming[i].x)*nx+(incoming[j].y-incoming[i].y)*ny;
  const target=elastic&&!previousContacts.has(i*particles.length+j)&&incomingNormal<-.8?-incomingNormal*.68:0;
  const normal=((b===dragged?0:b.vx)-(a===dragged?0:a.vx))*nx+((b===dragged?0:b.vy)-(a===dragged?0:a.vy))*ny;
  if(sum&&normal<target){const impulse=(target-normal)/sum;a.vx-=nx*impulse*wa;a.vy-=ny*impulse*wa;b.vx+=nx*impulse*wb;b.vy+=ny*impulse*wb;}
 }
 contactCache.set(particles,contacts);
}
function moveDragged(particles,p,x,y,elastic=true){
 const sx=p.x,sy=p.y,steps=Math.max(1,Math.ceil(Math.hypot(x-sx,y-sy)/16));
 for(let i=1;i<=steps;i++){p.x=sx+(x-sx)*i/steps;p.y=sy+(y-sy)*i/steps;resolve(particles,p,elastic);}
}
function step(particles,edges,dragged=null){
 // Restitution uses carried momentum, so spring compression cannot repeatedly
 // manufacture fresh impacts between resting neighbors.
 const before=particles.map(p=>({x:p.x,y:p.y})),impactVelocities=particles.map(p=>({x:p.vx,y:p.vy}));
 for(const p of particles){if(p===dragged)continue;const spring=p.spring??(p.depth===0?.04:.012);p.vx+=(p.tx-p.x)*spring;p.vy+=(p.ty-p.y)*spring;}
 const repelling=particles.filter(p=>p.repulsion!==0);
 for(let i=0;i<repelling.length;i++)for(let j=i+1;j<repelling.length;j++){
  const a=repelling[i],b=repelling[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy));const force=70/(d*d);a.vx-=dx/d*force;a.vy-=dy/d*force;b.vx+=dx/d*force;b.vy+=dy/d*force;
 }
 // A word with many documented relationships should not become an increasingly
 // stiff bundle of springs. Normalize link forces so dense webs can settle.
 const degree=new Map();for(const e of edges){degree.set(e.a,(degree.get(e.a)||0)+1);degree.set(e.b,(degree.get(e.b)||0)+1);}
 for(const e of edges){const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,d=Math.hypot(dx,dy)||1;const ideal=e.a.depth===0||e.b.depth===0?Math.hypot(e.a.tx-e.b.tx,e.a.ty-e.b.ty):105;const rest=Math.max(ideal,radius(e.a)+radius(e.b)+GAP+6);const force=(d-rest)*.007/Math.sqrt(Math.max(degree.get(e.a),degree.get(e.b),1));e.a.vx+=dx/d*force;e.a.vy+=dy/d*force;e.b.vx-=dx/d*force;e.b.vy-=dy/d*force;}
 for(const p of particles){
  if(p===dragged){p.vx=p.vy=0;}else{const damping=p.damping??.9,speed=p.maxSpeed??18;p.vx=clamp(p.vx*damping,-speed,speed);p.vy=clamp(p.vy*damping,-speed,speed);p.x+=p.vx;p.y+=p.vy;}
  p.scaleV=(p.scaleV+((p.targetScale??1)-p.scale)*.20)*.72;p.scale=clamp(p.scale+p.scaleV,.78,1.22);
 }
 resolve(particles,dragged,true,before,impactVelocities);
 // Contact impulses can cancel spring velocity without moving a bubble. Sleep on
 // actual rendered motion, not velocity that the contact solver has constrained.
 return particles.reduce((energy,p,i)=>energy+Math.abs(p.x-before[i].x)+Math.abs(p.y-before[i].y)+Math.abs(p.scaleV)*30,0);
}
const api={step,resolve,radius,penetration,moveDragged};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WordPhysics=api;
})(typeof window!=='undefined'?window:globalThis);
