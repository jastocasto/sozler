/* Pure atlas and camera math, shared by the browser and verification. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
function createAtlas(data,model){
 const regions=[...data.regions],clusters=[...data.clusters];
 const points=data.points.map(([word,x,y,z,cluster])=>({word,x,y,z,cluster,node:model.byWord.get(word),region:clusters[cluster].region}));
 const spellingEntries=model.orthographyNodes||[],spelling=data.spelling;
 const goldenAngle=Math.PI*(3-Math.sqrt(5)),hash=t=>{let h=2166136261;for(const c of t){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;};
 if(spellingEntries.length&&spelling&&spelling.count===spellingEntries.length){
  // Each spelling-dictionary word joins the cluster its code names and continues that cluster's phyllotaxis
  // after its dictionary words (build_galaxy.cjs), so the map stays one connected set of topic groups.
  const next=clusters.map(c=>c.base||0),turn=clusters.map(c=>(hash(c.id)%628)/100);
  for(const [i,node] of spellingEntries.entries()){
   const cluster=spelling.alphabet.indexOf(spelling.codes[i]),c=clusters[cluster],k=next[cluster]++,angle=k*goldenAngle+turn[cluster],distance=Math.sqrt(k)*74;
   points.push({word:node.w,x:Math.round(c.x+Math.cos(angle)*distance),y:Math.round(c.y+Math.sin(angle)*distance),z:Math.round((c.z||0)+Math.sin(angle*2)*Math.min(distance*.08,100)+(hash(node.w)%90)-45),cluster,region:c.region,node});
  }
 }else if(spellingEntries.length){
  // Older data without spelling codes: one separate disk along the southeast diagonal.
  const region=regions.length,cluster=clusters.length,count=spellingEntries.length;
  const id='orthography',label='Orfoqrafiya',en='Spelling',radius=Math.ceil(Math.sqrt(count)*74+140);
  const southeastEdge=Math.max(...regions.map(r=>r.x+r.y+r.radius*Math.SQRT2));
  const centerSum=southeastEdge+(radius+300+3600)*Math.SQRT2;
  const x=Math.round((centerSum+2500)/2),y=Math.round(centerSum-x);
  regions.push({id,label,en,index:region,x,y,radius:radius+300,count,color:'#9aa9b5',clusters:[cluster]});
  clusters.push({id,label,en,index:cluster,region,x,y,z:0,radius,count,featured:[]});
  for(const [i,node] of spellingEntries.entries()){
   const angle=i*goldenAngle,distance=Math.sqrt(i)*74;
   points.push({word:node.w,x:Math.round(x+Math.cos(angle)*distance),y:Math.round(y+Math.sin(angle)*distance),z:0,cluster,region,node});
  }
 }
 // Counts describe the words actually on this map (a model without the spelling layer has fewer).
 const tally=new Map();for(const p of points)tally.set(p.cluster,(tally.get(p.cluster)||0)+1);
 for(const [i,c] of clusters.entries())clusters[i]={...c,count:tally.get(i)||0};
 for(const [i,r] of regions.entries())regions[i]={...r,count:r.clusters.reduce((n,c)=>n+(tally.get(c)||0),0)};
 const byWord=new Map(points.map(p=>[p.word,p]));
 if(points.some(p=>!p.node)||byWord.size!==model.nodes.length)throw Error('Galaxy and dictionary must have identical headwords.');
 const bounds=points.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minY:Math.min(b.minY,p.y),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity});
 const edges=model.edges.map(e=>({...e,from:byWord.get(e.a.w),to:byWord.get(e.b.w)}));
 return {points,byWord,regions,clusters,bounds,edges};
}
// Each camera row is a unit vector in world coordinates after vertical relief
// is applied. Their transpose converts a drag on the screen into a 3D pan.
const axialTilt=.18,axisCos=Math.cos(axialTilt),axisSin=Math.sin(axialTilt),overviewTilt=.52;
function cameraBasis(camera){
 const c=Math.cos(camera.angle||0),s=Math.sin(camera.angle||0),ct=Math.cos(camera.tilt||0),st=Math.sin(camera.tilt||0);
 const level=camera.zoom/.035,relief=1+15/(1+level*level);
 const basis={xx:c,xy:-s*axisCos,xz:s*axisSin,
  yx:s*ct,yy:c*axisCos*ct-axisSin*st,yz:-(c*axisSin*ct+axisCos*st),relief};
 if(!camera.roll)return basis;
 const cos=Math.cos(camera.roll),sin=Math.sin(camera.roll);
 return {xx:cos*basis.xx-sin*basis.yx,xy:cos*basis.xy-sin*basis.yy,xz:cos*basis.xz-sin*basis.yz,
  yx:sin*basis.xx+cos*basis.yx,yy:sin*basis.xy+cos*basis.yy,yz:sin*basis.xz+cos*basis.yz,relief};
}
function transform(camera,width,height){
 const m=cameraBasis(camera),zoom=camera.zoom;
 const xx=m.xx*zoom,xy=m.xy*zoom,xz=m.xz*m.relief*zoom,yx=m.yx*zoom,yy=m.yy*zoom,yz=m.yz*m.relief*zoom;
 const ox=width/2-camera.x*xx-camera.y*xy-(camera.z||0)*xz,oy=height/2-camera.x*yx-camera.y*yy-(camera.z||0)*yz;
 const facing=clamp((m.xx*m.yy-m.xy*m.yx)/Math.cos(overviewTilt+axialTilt),-1,1);
 function into(p,screen){
  const z=p.z||0;
  screen.x=ox+xx*p.x+xy*p.y+xz*z;
  screen.y=oy+yx*p.x+yy*p.y+yz*z;
  // The original elevation cue reverses when the atlas is seen from below.
  screen.depth=clamp(1+.0004*z*facing,.78,1.22);
  return screen;
 }
 const project=p=>into(p,{});
 project.into=into;
 return project;
}
function unproject(point,camera,width,height,z=0,reference=camera){
 const m=cameraBasis(camera);
 const x=reference.x-camera.x,y=reference.y-camera.y,heightFromEye=(z-(camera.z||0))*m.relief;
 const sx=(point.x-width/2)/camera.zoom-(m.xx*x+m.xy*y+m.xz*heightFromEye);
 const sy=(point.y-height/2)/camera.zoom-(m.yx*x+m.yy*y+m.yz*heightFromEye);
 const dx=m.xx*sx+m.yx*sy,dy=m.xy*sx+m.yy*sy,dz=m.xz*sx+m.yz*sy;
 const nx=m.xy*m.yz-m.xz*m.yy,ny=m.xz*m.yx-m.xx*m.yz,nz=m.xx*m.yy-m.xy*m.yx;
 // Intersect the screen ray with the named height. When the plane turns
 // edge-on, that intersection can be arbitrarily distant or absent. Stay on
 // the same ray and ease back toward the touched word's depth in that case.
 const along=Math.abs(nz)>1e-12?-dz/nz:0;
 const reach=Math.max(2048,3*Math.max(width,height)/camera.zoom);
 const distance=along*smooth(Math.min(1,reach/Math.max(1,Math.abs(along))));
 return {x:reference.x+dx+nx*distance,y:reference.y+dy+ny*distance,z:z+(dz+nz*distance)/m.relief};
}
function aimAt(camera,anchor,screen,width,height){
 const m=cameraBasis(camera),x=anchor.x-camera.x,y=anchor.y-camera.y,z=((anchor.z||0)-(camera.z||0))*m.relief;
 const dx=m.xx*x+m.xy*y+m.xz*z-(screen.x-width/2)/camera.zoom;
 const dy=m.yx*x+m.yy*y+m.yz*z-(screen.y-height/2)/camera.zoom;
 return {...camera,x:camera.x+m.xx*dx+m.yx*dy,y:camera.y+m.xy*dx+m.yy*dy,z:(camera.z||0)+(m.xz*dx+m.yz*dy)/m.relief};
}
// The stored angles describe Rz(roll) Rx(tilt) Rz(bearing). Compose a drag
// with the whole orientation so either screen axis can pass through both poles.
function quaternion(camera){
 const half=(camera.tilt||0)/2,s=Math.sin(half),c=Math.cos(half);
 const sum=((camera.roll||0)+(camera.angle||0))/2,diff=((camera.roll||0)-(camera.angle||0))/2;
 return {x:s*Math.cos(diff),y:s*Math.sin(diff),z:c*Math.sin(sum),w:c*Math.cos(sum)};
}
function orientation(q,previous){
 const s=Math.hypot(q.x,q.y),c=Math.hypot(q.z,q.w);
 const sum=c>1e-10?Math.atan2(q.z,q.w):((previous.roll||0)+(previous.angle||0))/2;
 const diff=s>1e-10?Math.atan2(q.y,q.x):((previous.roll||0)-(previous.angle||0))/2;
 return {angle:angleBetween(0,sum-diff,1),tilt:2*Math.atan2(s,c),roll:angleBetween(0,sum+diff,1)};
}
function interpolateOrientation(from,to,t){
 if(t===0||t===1){const pose=t===0?from:to;return {angle:pose.angle||0,tilt:pose.tilt||0,roll:pose.roll||0};}
 const a=quaternion(from),b=quaternion(to);
 const dot=a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w,alpha=Math.acos(clamp(Math.abs(dot),0,1));
 const divisor=Math.sin(alpha),weight=u=>alpha<1e-5?u:Math.sin(u*alpha)/divisor;
 const u=weight(1-t),v=(dot<0?-1:1)*weight(t);
 return orientation({x:u*a.x+v*b.x,y:u*a.y+v*b.y,z:u*a.z+v*b.z,w:u*a.w+v*b.w},from);
}
function orbit(camera,yaw,pitch){
 const angle=Math.hypot(yaw,pitch);
 if(!angle)return {...camera};
 const scale=Math.sin(angle/2)/angle,x=pitch*scale,y=yaw*scale,w=Math.cos(angle/2),q=quaternion(camera);
 const turned={x:w*q.x+x*q.w+y*q.z,y:w*q.y-x*q.z+y*q.w,z:w*q.z+x*q.y-y*q.x,w:w*q.w-x*q.x-y*q.y};
 return {...camera,...orientation(turned,camera)};
}
function dragOrbit(camera,dx,dy,width,height){
 const radians=Math.PI/Math.max(1,Math.min(width,height));
 return orbit(camera,dx*radians,-dy*radians);
}
function touchTurn(first,second){
 const span=Math.min(first.distance,second.distance);
 if(span<20)return 0;
 const turn=angleBetween(first.angle,second.angle,1)-first.angle;
 // A few pixels of fingertip jitter can turn a short chord appreciably.
 // Ease into rotation, then follow the fingers exactly as the turn grows.
 const slop=Math.max(Math.PI/60,3.5/span);
 return turn*smooth(clamp((Math.abs(turn)-slop)/slop,0,1));
}
const overviewCache=new WeakMap();
function overview(atlas,width,height){
 const cached=overviewCache.get(atlas);
 if(cached?.width===width&&cached.height===height)return {...cached.camera};
 const b=atlas.bounds,spanX=b.maxX-b.minX,spanY=b.maxY-b.minY;
 const camera={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2,zoom:Math.min(Math.max(160,width-64)/(spanX+800),Math.max(120,height-220)/(spanY*Math.cos(.70)+7200))*.93,angle:0,tilt:overviewTilt,roll:0,z:0};
 if(height>width*1.25){
  // Align the atlas's long axis with the phone. Fit its actual elevated points,
  // leaving space above and below for controls. This runs only upon resizing.
  camera.roll=Math.PI/2;
  const fitW=Math.max(100,width-48),fitH=Math.max(120,height-214);
  camera.zoom=Math.min(fitW/Math.max(1,spanY*.77),fitH/Math.max(1,spanX));
  const points=atlas.points||[b.minX,b.maxX].flatMap(x=>[b.minY,b.maxY].flatMap(y=>[-400,400].map(z=>({x,y,z}))));
  const pixel={};
  for(let step=0;step<3;step++){
   const project=transform(camera,width,height);let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
   for(const point of points){project.into(point,pixel);left=Math.min(left,pixel.x);right=Math.max(right,pixel.x);top=Math.min(top,pixel.y);bottom=Math.max(bottom,pixel.y);}
   if(step<2){camera.zoom*=Math.min(fitW/Math.max(1,right-left),fitH/Math.max(1,bottom-top));}
   else {const middle=unproject({x:(left+right)/2,y:(top+bottom)/2},camera,width,height);camera.x=middle.x;camera.y=middle.y;}
  }
 }
 overviewCache.set(atlas,{width,height,camera});return {...camera};
}
function focus(point,zoom=.88){return {x:point.x,y:point.y,z:point.z||0,zoom,angle:0,tilt:-.09,roll:0};}
function area(area,width,height){
 const zoom=Math.min(Math.max(160,width-72)/(area.radius*2.2),Math.max(120,height-250)/(area.radius*2.2));
 return {x:area.x,y:area.y,z:area.z||0,zoom,angle:0,tilt:.24,roll:0};
}
function angleBetween(from,to,t){const delta=to-from;return from+Math.atan2(Math.sin(delta),Math.cos(delta))*t;}
function makeFlight(from,to,width,height,now=0,reduced=false){
 const distance=Math.hypot(to.x-from.x,to.y-from.y),far=distance*Math.min(from.zoom,to.zoom)>Math.min(width,height)*.7;
 const valley=far?Math.min(from.zoom,to.zoom,Math.min(width,height)*.7/Math.max(distance,1)):Math.min(from.zoom,to.zoom);
 return {from:{...from},to:{...to},start:now,duration:reduced?0:far?1800:850,valley:Math.max(.0001,valley),far,turn:to.x>=from.x?1:-1};
}
function sampleFlight(flight,time){
 const t=flight.duration?clamp((time-flight.start)/flight.duration,0,1):1;
 if(t===1)return {...flight.to,done:true};
 const p=smooth(t),move=flight.far?smooth(clamp((t-.15)/.7,0,1)):p;
 let zoom;if(flight.far){zoom=t<.48?Math.exp(mix(Math.log(flight.from.zoom),Math.log(flight.valley),smooth(t/.48))):Math.exp(mix(Math.log(flight.valley),Math.log(flight.to.zoom),smooth((t-.48)/.52)));}else zoom=Math.exp(mix(Math.log(flight.from.zoom),Math.log(flight.to.zoom),p));
 const pose=interpolateOrientation(flight.from,flight.to,p),lift=flight.far?Math.sin(Math.PI*t):0;
 const turned=lift?orbit(pose,lift*.13*flight.turn,lift*.12):pose;
 return {...turned,x:mix(flight.from.x,flight.to.x,move),y:mix(flight.from.y,flight.to.y,move),z:mix(flight.from.z||0,flight.to.z||0,move),zoom,done:false};
}
function zoomAt(camera,screen,nextZoom,width,height,z=0,reference=camera){
 const anchor=unproject(screen,camera,width,height,z,reference);
 return aimAt({...camera,zoom:nextZoom},anchor,screen,width,height);
}
// One geometric glyph for every visible word, at every atlas zoom level.
// Density changes its radius, never its map position or identity.
const noLines=Object.freeze([]);
function glyphs(atlas,camera,width,height,screens=null,measure=null,buffer=null){
 const project=screens?p=>screens.get(p.word):transform(camera,width,height);
 const items=buffer?.visible||[];
 let maxR=0,count=0;
 for(let i=0;i<atlas.points.length;i++){
  const point=atlas.points[i],cached=buffer?.glyphs[i],screen=cached?cached.screen:project(point);
  if(screen.x< -110||screen.x>width+110||screen.y< -110||screen.y>height+110)continue;
  const glyph=cached||{point,screen};
  glyph.r=clamp(36*camera.zoom*screen.depth,.65,48);
  maxR=Math.max(maxR,glyph.r);items[count++]=glyph;
 }
 items.length=count;
 // Marks smaller than three pixels can share space without a collision pass.
 if(maxR<=3){for(const v of items){v.body=0;v.labelOpacity=0;v.fontSize=8.5;v.lines=noLines;}return items;}
 const cell=Math.max(4,maxR*2+6),grid=new Map(),key=(x,y)=>x+','+y;
 for(const v of items){v.cx=Math.floor(v.screen.x/cell);v.cy=Math.floor(v.screen.y/cell);const k=key(v.cx,v.cy);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(v);}
 for(const v of items){let nearest=Infinity;for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const q of grid.get(key(v.cx+dx,v.cy+dy))||[]){if(q===v)continue;nearest=Math.min(nearest,Math.hypot(v.screen.x-q.screen.x,v.screen.y-q.screen.y));}
  v.r=Math.min(v.r,nearest*.44);v.body=smooth(clamp((v.r-3)/12,0,1));v.labelOpacity=smooth(clamp((v.r-12)/10,0,1));
  if(v.labelOpacity>0){
   const label=fitLabel(v.point.word,v.r,clamp(v.r*.43,8.5,14),measure);
   v.fontSize=label.fontSize;v.lines=label.lines;
  }else{v.fontSize=8.5;v.lines=noLines;}
  if(!buffer){delete v.cx;delete v.cy;}
 }
 return items;
}
// Break phrases only at spaces. A lexical word is never chopped or ellipsized.
function fitLabel(word,r,preferred,measure=null){
 const tokens=word.trim().split(/\s+/),limit=Math.max(1,r*1.62),width=(text,size)=>measure?measure(text,size):[...text].reduce((n,c)=>n+(/[ilıjtfr]/.test(c)?.32:/[mwMWƏÖÜ]/.test(c)?.85:.58),0)*size;
 let best=null;
 for(let count=1;count<=Math.min(3,tokens.length);count++){
  const lines=[''];for(const [index,token]of tokens.entries()){const i=lines.length-1,rest=tokens.length-index,combined=lines[i]?lines[i]+' '+token:token;if(lines[i]&&lines.length<count&&(width(combined,preferred)>limit||rest===count-lines.length))lines.push(token);else lines[i]=combined;}
  const max=Math.max(...lines.map(t=>width(t,1))),size=Math.min(preferred,limit/max,(r*1.5)/Math.max(1,lines.length*1.22));
  if(!best||size>best.size+.1)best={lines,size};
 }
 return {lines:best.lines,fontSize:Math.max(.5,best.size)};
}
function labelLines(word,r,fontSize){return fitLabel(word,r,fontSize).lines;}
// Test the segment, not just its endpoints: a connection may cross the screen
// with one or both words outside it. No sampling or distance cutoff is applied.
function crossesViewport(a,b,width,height,pad=0){
 const left=-pad,top=-pad,right=width+pad,bottom=height+pad;
 if((a.x<left&&b.x<left)||(a.x>right&&b.x>right)||(a.y<top&&b.y<top)||(a.y>bottom&&b.y>bottom))return false;
 if((a.x>=left&&a.x<=right&&a.y>=top&&a.y<=bottom)||(b.x>=left&&b.x<=right&&b.y>=top&&b.y<=bottom))return true;
 let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;
 for(const [p,q]of [[-dx,a.x+pad],[dx,width+pad-a.x],[-dy,a.y+pad],[dy,height+pad-a.y]]){
  if(Math.abs(p)<1e-12){if(q<0)return false;continue;}
  const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;
 }
 return true;
}
function connections(atlas,screens,filters,width,height,moving=new Set()){
 const stationary=[],dynamic=[];
 for(const edge of atlas.edges){if(!filters.has(edge.type))continue;
  if(moving.has(edge.a.id)||moving.has(edge.b.id)){dynamic.push(edge);continue;}
  const a=screens.get(edge.from.word),b=screens.get(edge.to.word);
  if(a&&b&&crossesViewport(a,b,width,height,4))stationary.push({edge,a,b});
 }
 return {stationary,dynamic};
}
function blendColor(from,to,t){const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),a=rgb(from),b=rgb(to);return '#'+a.map((v,i)=>Math.round(mix(v,b[i],t)).toString(16).padStart(2,'0')).join('');}
const api={createAtlas,transform,unproject,aimAt,orbit,dragOrbit,touchOrbit:dragOrbit,touchTurn,angleBetween,interpolateOrientation,overview,focus,area,makeFlight,sampleFlight,zoomAt,clamp,glyphs,labelLines,fitLabel,blendColor,crossesViewport,connections};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WordGalaxy=api;
})(typeof window!=='undefined'?window:globalThis);
