/* Temporary close-up coordinates; the persistent atlas is never mutated. */
(function(root){
'use strict';
const priority={syn:0,ant:1,root:2,ending:3,topic:4};
function relationships(items){const unique=new Map();for(const r of items){const old=unique.get(r.node.w);if(!old||priority[r.edge.type]<priority[old.edge.type])unique.set(r.node.w,r);}return [...unique.values()].sort((a,b)=>priority[a.edge.type]-priority[b.edge.type]||a.node.w.localeCompare(b.node.w,'az'));}
function layout(width,height,count,page=0,scale=1){
 const narrow=width<640,compact=height<500,tiny=height<300,r=(tiny?15:compact?22:narrow?24:30)*scale,centerR=(tiny?21:compact?32:narrow?37:43)*scale,gap=(tiny?52:compact?70:narrow?75:94)*scale;
 let bounds={left:12,right:width-58,top:tiny?55:compact?104:narrow?108:148,bottom:height-(tiny?60:compact?100:132)};
 function available(bounds){
 const cx=width/2,cy=(bounds.top+bounds.bottom)/2,margin=r*1.09+8,slots=[];
 for(let row=-12;row<=12;row++)for(let col=-18;col<=18;col++){
  if(row===0&&col===0)continue;const dx=(col+(Math.abs(row)%2?.5:0))*gap,dy=row*gap*.8660254,x=cx+dx,y=cy+dy;
  if(x-margin<bounds.left||x+margin>bounds.right||y-margin<bounds.top||y+margin>bounds.bottom||Math.hypot(dx,dy)<centerR*1.09+r*1.09+7)continue;
  slots.push({x,y,d:Math.hypot(dx,dy),angle:Math.atan2(dy,dx)});
 }
 slots.sort((a,b)=>a.d-b.d||a.angle-b.angle);
 return {center:{x:cx,y:cy,r:centerR},slots};
 }
 let arrangement=available(bounds),capacity=Math.max(1,Math.min(narrow?24:36,arrangement.slots.length));
 // Keep the paging control outside the bubble area. Short landscape uses the
 // navigation strip for it, leaving the entire horizontal stage available.
 if(count>capacity&&!compact){bounds={...bounds,bottom:height-188};arrangement=available(bounds);capacity=Math.max(1,Math.min(narrow?24:36,arrangement.slots.length));}
 const pages=Math.max(1,Math.ceil(count/capacity)),index=Math.max(0,Math.min(page,pages-1));
 return {center:arrangement.center,slots:arrangement.slots.slice(0,capacity).map(p=>({...p,r})),capacity,page:index,pages,start:index*capacity,end:Math.min(count,(index+1)*capacity),bounds};
}
// Lay out equal-sized family circles once, then zoom/pan the arrangement.
// Dense families extend beyond the viewport instead of shrinking their bubbles.
function collective(width,height,count,scale=1,pan={x:0,y:0},preferredCenterRadius=0,stage=null){
 const narrow=width<640,compact=height<500,tiny=height<300,defaultCenter=tiny?19:compact?27:narrow?30:36;
 const bounds={left:12,right:width-58,top:tiny?55:compact?104:narrow?108:148,bottom:height-(tiny?60:compact?100:132)};
 if(stage){
  bounds.bottom=Math.max(0,Math.min(bounds.bottom,height-stage.bottomInset));
  bounds.top=Math.min(bounds.bottom,Math.max(bounds.top,stage.top));
 }
 const baseCenter={x:width/2,y:(bounds.top+bounds.bottom)/2};
 const fitCenter=Math.min(defaultCenter,Math.max(12,(bounds.bottom-bounds.top)/2-2));
 const centerR=Math.max(fitCenter,Math.min(preferredCenterRadius,narrow?44:52,(bounds.right-bounds.left)*.2,(bounds.bottom-bounds.top)*.2));
 function slots(r){
  const gap=Math.max(r*2.3+9,count<=6?centerR*1.09+r*1.09+11:0),margin=r*1.09+5,items=[],rows=Math.ceil(height/gap)+1,cols=Math.ceil(width/gap)+1;
  for(let row=-rows;row<=rows;row++)for(let col=-cols;col<=cols;col++){
   const dx=(col+(Math.abs(row)%2?.5:0))*gap,dy=row*gap*.8660254,x=baseCenter.x+dx,y=baseCenter.y+dy,d=Math.hypot(dx,dy);
   if(x-margin<bounds.left||x+margin>bounds.right||y-margin<bounds.top||y+margin>bounds.bottom||d<centerR*1.09+r*1.09+10)continue;
   items.push({x,y,d,angle:Math.atan2(dy,dx),r});
  }
  return items.sort((a,b)=>a.d-b.d||a.angle-b.angle);
 }
 let r=centerR,items=slots(r),fits=items.length>=count;
 // Keep every family bubble the same size. Dense families extend spatially
 // rather than shrinking their words to unreadable circles.
 if(!fits){items=[];const gap=r*2.3+9,reach=Math.ceil(Math.sqrt(count+1))+3;
  for(let row=-reach;row<=reach;row++)for(let col=-reach;col<=reach;col++){const dx=(col+(Math.abs(row)%2?.5:0))*gap,dy=row*gap*.8660254,d=Math.hypot(dx,dy);if(d<centerR*1.09+r*1.09+10)continue;items.push({x:baseCenter.x+dx,y:baseCenter.y+dy,d,angle:Math.atan2(dy,dx),r});}
  items.sort((a,b)=>a.d-b.d||a.angle-b.angle);
 }
 const center={x:baseCenter.x+pan.x,y:baseCenter.y+pan.y,r:centerR*scale},result=items.slice(0,count).map(p=>({x:center.x+(p.x-baseCenter.x)*scale,y:center.y+(p.y-baseCenter.y)*scale,r:p.r*scale}));
 return {center,slots:result,baseCenter,baseRadius:r,scale,pan:{...pan},capacity:count,page:0,pages:1,start:0,end:count,bounds,contained:fits&&scale<=1&&Math.abs(pan.x)<.01&&Math.abs(pan.y)<.01};
}
function arrival(origin,target,center,bounds,r=24,viewport=null,offset=0){
 const frame=viewport||{width:bounds.right+58,height:bounds.bottom+132},pad=r+64+offset;
 // Preserve real on-screen coordinates. Compress only invisible distance, along
 // the original direction, so a distant word enters through the correct edge.
 if(origin.x>=-pad&&origin.x<=frame.width+pad&&origin.y>=-pad&&origin.y<=frame.height+pad)return {x:origin.x,y:origin.y};
 let dx=origin.x-center.x,dy=origin.y-center.y;if(!Number.isFinite(dx+dy)||Math.hypot(dx,dy)<1){dx=target.x-center.x||1;dy=target.y-center.y;}
 const reachX=dx>0?(frame.width+pad-center.x)/dx:dx<0?(-pad-center.x)/dx:Infinity,reachY=dy>0?(frame.height+pad-center.y)/dy:dy<0?(-pad-center.y)/dy:Infinity,t=Math.min(1,reachX,reachY);
 return {x:center.x+dx*t,y:center.y+dy*t};
}
const api={priority,relationships,layout,collective,arrival};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ConnectionLayout=api;
})(typeof window!=='undefined'?window:globalThis);
