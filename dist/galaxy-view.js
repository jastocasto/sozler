/* A persistent canvas atlas with a bounded, accessible SVG physics layer. */
(function(root){
'use strict';
function mount({model,onSelect,onLocation,onView}){
 const G=root.WordGalaxy,P=root.WordPhysics,C=root.ConnectionLayout,types=root.WordWeb.types,$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
 const atlas=G.createAtlas(root.WORD_GALAXY_DATA,model),canvas=$('universeCanvas'),graph=$('graph'),labels=$('atlasLabels'),map=$('map');
 const countFormat=new Intl.NumberFormat('az'),zoomFormat=new Intl.NumberFormat('az',{maximumFractionDigits:1});
 $('universeTotal').textContent=countFormat.format(atlas.points.length)+' söz';
 const context=canvas.getContext('2d',{alpha:true});
 if(!context)throw Error('Canvas 2D is required for the word galaxy.');
 const media=matchMedia('(prefers-reduced-motion: reduce)');let reduced=media.matches;
 let width=map.clientWidth||innerWidth,height=map.clientHeight||innerHeight,camera=G.overview(atlas,width,height),selected=null,filters=new Set(Object.keys(types));
 let particles=[],surroundings=[],bodies=[],links=[],activeIds=new Set(),movingIds=new Set(),flight=null,raf=0,last=0,accumulator=0,clock=0,dirty=true,needsRefresh=true,view='universe',paused=false,pageHidden=false,drag=null,pinch=null,gesture=false,lastRefresh=0,hover=null,connectionPage=0,focusLayout=null,detailScale=1,detailPan={x:0,y:0},focusCamera=null,selectionTravel=null,settled=true,idleFrames=0,motionStarted=0,pauseTime=null,navigationLocked=false,raceRoute=null;
 const pointers=new Map(),related=new Map();let projected=[],hitDots=[],labelButtons=[],savedCamera=null,atlasLines=[],atlasControls=new Map(),allScreens=new Map(),sceneReady=false;
 const el=(name,attrs={},text)=>{const e=document.createElementNS(NS,name);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
 function resize(){
  width=map.clientWidth||innerWidth;height=map.clientHeight||innerHeight;
  const dpr=Math.min(root.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';context.setTransform(dpr,0,0,dpr,0,0);graph.setAttribute('viewBox',`0 0 ${width} ${height}`);
  if(flight)flight=null;releasePending();selectionTravel=null;
  if(view==='universe')camera=G.overview(atlas,width,height);
  sceneReady=false;dirty=needsRefresh=true;wake();
 }
 function isVisible(p,pad=40){return p.x>-pad&&p.x<width+pad&&p.y>74-pad&&p.y<height-96+pad;}
 function clearBubbles(){particles=[];surroundings=[];bodies=[];links=[];activeIds.clear();movingIds.clear();atlasControls.clear();$('bubbles').replaceChildren();$('links').replaceChildren();settled=true;}
 function projectScene(){const project=G.transform(camera,width,height);allScreens=new Map(atlas.points.map(p=>[p.word,project(p)]));projected=G.glyphs(atlas,camera,width,height,allScreens,(word,size)=>{context.font=size+'px Georgia, serif';return context.measureText(word).width;});sceneReady=true;}
 function kick(){settled=reduced;idleFrames=0;motionStarted=root.performance?.now?.()??clock;clock=motionStarted;last=0;accumulator=0;wake();}
 function refresh(reframe=false){
  needsRefresh=false;lastRefresh=clock;
  if(view!=='word'||!selected){if(bodies.length)clearBubbles();focusLayout=null;$('connectionPager').hidden=true;return;}
  const focusedWord=document.activeElement?.getAttribute('data-word'),old=new Map(bodies.map(p=>[p.node.id,p])),oldLayout=focusLayout;
  if(atlasControls.size)clearBubbles();
  projectScene();const glyphById=new Map(projected.map(v=>[v.point.node.id,v]));
  // Race navigation uses actual atlas words and does not create lexical edges.
  const neighbors=new Set(raceRoute?.(selected.word)||[]);
  const words=[...neighbors,...[...related.keys()].filter(word=>!neighbors.has(word))];
  focusLayout=C.collective(width,height,words.length,detailScale,detailPan);connectionPage=0;
  $('connectionPager').hidden=true;$('connectionsPrevious').disabled=$('connectionsNext').disabled=true;map.classList.remove('has-connection-pages');
  const candidates=[{point:selected,screen:focusLayout.center},...words.map((word,i)=>({point:atlas.byWord.get(word),screen:focusLayout.slots[i]}))],ratio=oldLayout?detailScale/oldLayout.scale:1;
  particles=candidates.map(({point,screen},i)=>{
   const previous=old.get(point.node.id),isSelected=point===selected,origin=allScreens.get(point.word),glyph=glyphById.get(point.node.id);
   const entry=C.arrival(origin,screen,focusLayout.center,focusLayout.bounds,screen.r,{width,height},i%7*9);
   const position=reduced?screen:isSelected&&!previous?origin:previous?(reframe&&previous.local?{x:screen.x+(previous.x-previous.homeX)*ratio,y:screen.y+(previous.y-previous.homeY)*ratio}:previous):entry;
   const radius=reduced?screen.r:reframe?screen.r:previous?.r??Math.min(screen.r,glyph?.r??3);
   return {node:point.node,point,type:isSelected?'selected':related.get(point.word)?.edge.type||'nearby',depth:isSelected?0:1,x:position.x,y:position.y,tx:previous?.waiting?position.x:screen.x,ty:previous?.waiting?position.y:screen.y,waiting:!isSelected&&!reduced&&!!previous?.waiting,releaseAt:previous?.releaseAt??Infinity,homeX:screen.x,homeY:screen.y,anchorX:origin.x,anchorY:origin.y,vx:reframe?0:previous?.vx||0,vy:reframe?0:previous?.vy||0,r:radius,skin:Math.min(2,radius*.12),contactGap:Math.min(3,radius*.15),homeR:screen.r,scale:previous?.scale||1,scaleV:previous?.scaleV||0,targetScale:1,spring:isSelected?.075:previous?.waiting?0:.045,damping:isSelected?.78:.90,maxSpeed:isSelected?26:22,repulsion:0,local:true,arrived:reduced||reframe&&!!previous?.arrived};
  });
  activeIds=new Set(particles.map(p=>p.node.id));
  const contextGlyphs=projected.filter(v=>!activeIds.has(v.point.node.id)&&v.r>8),contextIds=new Set(contextGlyphs.map(v=>v.point.node.id));
  surroundings=contextGlyphs.map(v=>{
   const previous=old.get(v.point.node.id),screen=v.screen,position=reduced?screen:previous?(reframe?{x:screen.x+(previous.x-previous.anchorX),y:screen.y+(previous.y-previous.anchorY)}:previous):screen;
   return {node:v.point.node,point:v.point,type:'nearby',depth:2,x:position.x,y:position.y,tx:screen.x,ty:screen.y,homeX:screen.x,homeY:screen.y,anchorX:screen.x,anchorY:screen.y,vx:previous?.vx||0,vy:previous?.vy||0,r:reduced||reframe?v.r:previous?.r??v.r,homeR:v.r,scale:previous?.scale||1,scaleV:0,targetScale:1,spring:.025,damping:.78,repulsion:0,inverseMass:2,local:false};
  });
  // Former neighbors travel back to the atlas instead of vanishing on selection.
  if(!reduced)for(const previous of old.values())if(!activeIds.has(previous.node.id)&&!contextIds.has(previous.node.id)&&(previous.local||isVisible(previous,90))&&!(previous.retiring&&previous.r<1.5)){
   const origin=allScreens.get(previous.node.w),target=C.arrival(origin,previous,focusLayout.center,focusLayout.bounds,previous.r,{width,height}),glyph=glyphById.get(previous.node.id);
   surroundings.push({...previous,type:'nearby',depth:2,tx:target.x,ty:target.y,homeX:target.x,homeY:target.y,anchorX:origin.x,anchorY:origin.y,homeR:glyph?.r??.65,spring:.045,damping:.84,maxSpeed:34,inverseMass:2,local:false,retiring:true,targetScale:1});
  }
  bodies=[...particles,...surroundings];movingIds=new Set(bodies.map(p=>p.node.id));const byId=new Map(bodies.map(p=>[p.node.id,p]));
  const network=G.connections(atlas,allScreens,filters,width,height,movingIds);
  links=network.dynamic.map(e=>({...e,a:byId.get(e.a.id)||{...allScreens.get(e.from.word),node:e.a,vx:0,vy:0},b:byId.get(e.b.id)||{...allScreens.get(e.to.word),node:e.b,vx:0,vy:0},highlighted:e.a.id===selected.node.id||e.b.id===selected.node.id}));
  $('links').replaceChildren();$('bubbles').replaceChildren();
  for(const e of links){e.el=el('path',{class:'edge'+(e.highlighted?' selected-edge':''),'data-edge-id':e.id,stroke:e.highlighted?types[e.type].color:'#bcbdb7','stroke-width':e.highlighted?4.05:.75,opacity:e.highlighted?.88:.23,...(e.highlighted&&e.type==='ending'?{'stroke-dasharray':'4 5'}:{})});e.el.append(el('title',{},`${e.a.node.w} ↔ ${e.b.node.w} · ${types[e.type].description}`));$('links').append(e.el);}
  // Context draws first, so the active family remains easy to read.
  for(const p of [...surroundings,...particles]){
   const chosen=p.depth===0,t=types[p.type],g=el('g',{class:'word-node'+(chosen?' selected':'')+(!p.local?' surrounding-word':''),tabindex:'0',role:'button','aria-label':[p.node.w,p.node.en].filter(Boolean).join(': ')+(chosen?' — seçilmiş söz':''),'data-word':p.node.w,'data-type':p.type});
   if(chosen)g.append(el('circle',{r:p.r+7,class:'selection-orbit',fill:'none',stroke:'#f4d1a4','stroke-width':1.15,'stroke-dasharray':'2 5'}));
   g.append(el('circle',{r:p.r,class:'bubble',fill:chosen?'#ecaa6b':t?t.fill:'#41423f',stroke:chosen?'#ffd8ad':t?t.border:'#77796e','stroke-width':chosen?.8:.55}));
   const label=G.fitLabel(p.node.w,p.homeR,G.clamp(p.homeR*.43,8.5,p.local?(chosen?48:40):12),(word,size)=>{context.font=size+'px Georgia, serif';return context.measureText(word).width;}),size=label.fontSize,lines=label.lines,text=el('text',{'text-anchor':'middle','font-size':size,fill:chosen?'#302f2c':t?.text||'#bdbdb3'});
   lines.forEach((line,i)=>text.append(el('tspan',{x:0,y:(i-(lines.length-1)/2)*(size+2)+size*.32},line)));g.append(text,el('title',{},[p.node.w,[p.node.az,p.node.en].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')));p.label=text;p.circle=g.querySelector('.bubble');p.orbit=g.querySelector('.selection-orbit');
   g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(p.node);}});g.addEventListener('pointerdown',e=>start(e,p));
   g.addEventListener('pointerenter',()=>{hover=p.node.id;if(!reduced){p.scaleV=.025;kick();}});g.addEventListener('pointerleave',()=>{hover=null;});p.el=g;$('bubbles').append(g);if(focusedWord===p.node.w)g.focus?.();
  }
  if(reduced||reframe)constrain();dirty=true;kick();
 }
 function renderAtlasControls(){
  // Canvas draws every word. These transparent controls add keyboard focus at
  // the identical coordinates, without a second visible bubble layer.
  if(view==='word')return;
  const candidates=projected.filter(v=>v.labelOpacity>.02&&isVisible(v.screen,0)).sort((a,b)=>Math.hypot(a.screen.x-width/2,a.screen.y-height/2)-Math.hypot(b.screen.x-width/2,b.screen.y-height/2)).slice(0,width<640?72:120),keep=new Set(candidates.map(v=>v.point.word));
  for(const [word,g]of atlasControls)if(!keep.has(word)){g.remove();atlasControls.delete(word);}
  for(const v of candidates){const {point,screen,r}=v;let g=atlasControls.get(point.word);
   if(!g){g=el('g',{class:'word-node atlas-word',tabindex:'0',role:'button','aria-label':[point.word,point.node.en].filter(Boolean).join(': '),'data-word':point.word,'data-type':'nearby'});g.append(el('circle',{class:'atlas-hit',fill:'transparent'}),el('title',{},[point.word,[point.node.az,point.node.en].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')));g.addEventListener('pointerdown',e=>start(e,null,point));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(point.node);}});atlasControls.set(point.word,g);$('bubbles').append(g);}
   g.setAttribute('transform',`translate(${screen.x} ${screen.y})`);g.firstElementChild.setAttribute('r',r);g.style.setProperty('--label-opacity',v.labelOpacity);
  }
 }
 function drawBackground(){
  dirty=false;if(!sceneReady)projectScene();context.clearRect(0,0,width,height);const project=G.transform(camera,width,height);atlasLines=[];
  for(const r of atlas.regions){const p=project(r),radius=r.radius*camera.zoom;if(p.x+radius<0||p.x-radius>width||p.y+radius<0||p.y-radius>height)continue;
   if(radius>12&&radius<Math.max(width,height)*3){const glow=context.createRadialGradient(p.x,p.y,0,p.x,p.y,radius*1.2);glow.addColorStop(0,r.color+'12');glow.addColorStop(.6,r.color+'08');glow.addColorStop(1,r.color+'00');context.fillStyle=glow;context.fillRect(p.x-radius*1.2,p.y-radius*1.2,radius*2.4,radius*2.4);}
  }
  const network=G.connections(atlas,allScreens,filters,width,height,movingIds);
  // Thousands of overlapping lines turn into a white haze, so each line fades as more of them are on screen.
  context.globalAlpha=(camera.zoom<.025?.12:.23)*G.clamp(Math.sqrt(3000/Math.max(network.stationary.length,1)),.18,1);context.lineWidth=.75;context.strokeStyle='#bcbdb7';context.beginPath();
  for(const {edge:e,a,b}of network.stationary){context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);atlasLines.push({id:e.id,a:e.from.word,b:e.to.word,x1:a.x,y1:a.y,x2:b.x,y2:b.y,color:'#bcbdb7'});}context.stroke();
  for(const region of atlas.regions){context.fillStyle=region.color;context.globalAlpha=.68;context.beginPath();for(const v of projected){if(v.point.region!==region.index||movingIds.has(v.point.node.id)||v.r>3)continue;context.moveTo(v.screen.x+v.r,v.screen.y);context.arc(v.screen.x,v.screen.y,v.r,0,Math.PI*2);}context.fill();}
  for(const v of projected){if(movingIds.has(v.point.node.id)||v.r<=3)continue;const {point,screen:p,r,body,labelOpacity}=v;
   context.globalAlpha=.68+.28*body;context.fillStyle=G.blendColor(atlas.regions[point.region].color,'#51514f',body);context.beginPath();context.arc(p.x,p.y,r,0,Math.PI*2);context.fill();context.globalAlpha=body*.7;context.lineWidth=.65;context.strokeStyle='#aaa697';context.stroke();
   if(labelOpacity>0){context.globalAlpha=labelOpacity;context.fillStyle='#f1ede4';context.font=v.fontSize+'px Georgia, serif';context.textAlign='center';v.lines.forEach((line,i)=>context.fillText(line,p.x,p.y+(i-(v.lines.length-1)/2)*(v.fontSize+2)+v.fontSize*.32));}
  }
  context.globalAlpha=1;hitDots=projected.filter(v=>!movingIds.has(v.point.node.id));
  if(view==='word')labels.replaceChildren();else {renderLabels(project);renderAtlasControls();}
 }
 function renderLabels(project){
  labels.replaceChildren();labelButtons=[];const labelFade=1-G.clamp((camera.zoom-.18)/.22,0,1);if(labelFade<=0)return;const boxes=width>1000?[{x:32,y:166,w:256,h:14}]:[],candidates=[];
  for(const r of atlas.regions){const screen=project(r),size=r.radius*camera.zoom;if(size<12||size>width*.8)continue;candidates.push({area:r,kind:'region',screen,size,priority:r===atlas.regions[selected?.region]?0:1});}
  for(const c of atlas.clusters){const screen=project(c),size=c.radius*camera.zoom;if(size<36||size>Math.max(width,height)*.8||camera.zoom<.015)continue;candidates.push({area:c,kind:'cluster',screen,size,priority:2});}
  candidates.sort((a,b)=>a.priority-b.priority||b.area.count-a.area.count);
  for(const v of candidates){if(!isVisible(v.screen,-30))continue;const wide=v.kind==='region'?140:120,h=44,lift=Math.min(v.size*.65,95),blocked=p=>p.y<(width<640?105:145)||p.y>height-165||p.x<8||p.x+wide>width-8||boxes.some(b=>p.x<b.x+b.w+10&&p.x+p.w>b.x-10&&p.y<b.y+b.h+10&&p.y+p.h>b.y-10);
   // Above the area first; where that is taken (or off screen), on its centre, then below it.
   const p=[-lift-23,-h/2,lift-21].map(dy=>({x:v.screen.x-wide/2,y:v.screen.y+dy,w:wide,h})).find(p=>!blocked(p));if(!p)continue;
   const button=document.createElement('button');button.className='atlas-label '+v.kind+'-label';button.style.opacity=labelFade;button.style.left=v.screen.x+'px';button.style.top=(p.y+h/2)+'px';button.dataset[v.kind]=v.area.id;button.setAttribute('aria-label',v.area.label+' — '+countFormat.format(v.area.count)+' söz, yaxınlaş');const title=document.createElement('span');title.textContent=v.area.label;const count=document.createElement('small');count.textContent=countFormat.format(v.area.count)+' söz';button.append(title,count);button.addEventListener('pointerdown',e=>start(e,null,null,{area:v.area,kind:v.kind}));button.onclick=e=>{if(!e.detail)visitArea(v.area,v.kind);};labels.append(button);boxes.push(p);labelButtons.push(button);if(boxes.length>=(width<640?8:15))break;
  }
 }
 function anchor(){return drag?.particle||particles.find(p=>p.depth===0)||null;}
 function constrain(){
  const fixed=anchor(),bounds=!selectionTravel&&focusLayout?.contained?focusLayout.bounds:null;
  for(let pass=0;pass<32;pass++){
   P.resolve(bodies,fixed,!reduced);if(!bounds)return;let outside=false;
   for(const p of particles){if(selectionTravel&&p===particles[0])continue;const r=P.radius(p);if(!p.arrived){p.arrived=Math.hypot(p.x-p.homeX,p.y-p.homeY)<Math.max(20,p.r*1.5)&&p.x-r>=bounds.left&&p.x+r<=bounds.right&&p.y-r>=bounds.top&&p.y+r<=bounds.bottom;if(!p.arrived)continue;}const x=G.clamp(p.x,bounds.left+r,bounds.right-r),y=G.clamp(p.y,bounds.top+r,bounds.bottom-r);if(x!==p.x||y!==p.y){outside=true;if(x!==p.x)p.vx*=-.45;if(y!==p.y)p.vy*=-.45;p.x=x;p.y=y;}}
   if(!outside)return;
  }
  P.resolve(bodies,fixed,!reduced);
 }
 function growRadii(){
  for(const p of bodies){
   if(selectionTravel&&p===particles[0])continue;
   let next=p.r+(p.homeR-p.r)*.13;if(Math.abs(p.homeR-next)<.005)next=p.homeR;
   if(next>p.r&&p!==particles[0]){const factor=Math.max(1,p.scale)+.09;for(const q of bodies){if(q===p)continue;const room=Math.hypot(p.x-q.x,p.y-q.y)-P.radius(q)-Math.min(p.contactGap??3,q.contactGap??3)-.02,limit=room<(factor+.12)*16.6667?room/(factor+.12):(room-2)/factor;next=Math.max(p.r,Math.min(next,limit));}}
   p.r=next;if(p.skin!==undefined){p.skin=Math.min(2,p.r*.12);p.contactGap=Math.min(3,p.r*.15);}
  }
 }
 function renderBubbles(dt){
  if(!bodies.length)return;
  const chosen=particles[0];
  if(!reduced&&!settled){for(const p of particles)if(p.waiting&&clock>=p.releaseAt){p.waiting=false;p.spring=.045;p.tx=p.homeX;p.ty=p.homeY;p.vx=p.vy=0;}accumulator+=dt;let steps=0,energy=0;while(accumulator>=16.66&&steps++<3){
   if(chosen&&!selectionTravel&&chosen!==drag?.particle){
    chosen.vx=G.clamp((chosen.vx+(chosen.homeX-chosen.x)*.075)*.78,-26,26);chosen.vy=G.clamp((chosen.vy+(chosen.homeY-chosen.y)*.075)*.78,-26,26);chosen.x+=chosen.vx;chosen.y+=chosen.vy;
    if(Math.hypot(chosen.homeX-chosen.x,chosen.homeY-chosen.y)<.01&&Math.hypot(chosen.vx,chosen.vy)<.01){chosen.x=chosen.homeX;chosen.y=chosen.homeY;chosen.vx=chosen.vy=0;}
   }
   const centerMotion=chosen?Math.abs(chosen.vx)+Math.abs(chosen.vy):0,centerVelocity=chosen?{x:chosen.vx,y:chosen.vy}:null;
   // Stillness counts only the selection's own motion (averaged over every body, as before): two background words
   // whose map spots sit closer than their circles can nudge each other indefinitely, and they freeze with everything
   // else once the selection rests.
   const bx=particles.map(p=>p.x),by=particles.map(p=>p.y);P.step(bodies,[],anchor());energy=particles.reduce((e,p,i)=>e+Math.abs(p.x-bx[i])+Math.abs(p.y-by[i])+Math.abs(p.scaleV||0)*30,0)+centerMotion;growRadii();if(chosen&&chosen!==drag?.particle){chosen.vx=centerVelocity.x;chosen.vy=centerVelocity.y;}accumulator-=16.66;
  }constrain();
   if(steps&&!drag){if(energy/Math.max(1,bodies.length)<.025&&clock-motionStarted>1000&&(!chosen||Math.hypot(chosen.x-chosen.homeX,chosen.y-chosen.homeY)<.01))idleFrames++;else idleFrames=0;
    // Rest once motion is idle, or at the latest 4.2 s after the last kick: bubbles that keep nudging one another
    // (which depends on where each started on the map) must not hold the selection open.
    if(!selectionTravel&&!particles.some(p=>p.waiting)&&(idleFrames>=20||clock-motionStarted>4200)){settled=true;for(const p of bodies){p.vx=p.vy=p.scaleV=0;p.scale=1;}constrain();}
   }
  }
  for(const p of bodies){p.el.setAttribute('transform',`translate(${p.x.toFixed(3)} ${p.y.toFixed(3)}) scale(${p.scale.toFixed(3)})`);p.circle.setAttribute('r',p.r);if(p.orbit){p.orbit.setAttribute('r',p.r+7);p.orbit.setAttribute('opacity',G.clamp(p.r/18,0,1));}p.label.setAttribute('transform','scale('+p.r/p.homeR+')');p.label.setAttribute('opacity',p.depth===0?G.clamp((p.r-2)/10,0,1):G.clamp((p.r-6)/10,0,1));}
  for(const e of links){const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,d=Math.hypot(dx,dy)||1,age=clock-motionStarted,shake=settled||reduced?0:Math.sin(age*.024+e.id*.6)*9*Math.exp(-age/270),velocity=settled?0:G.clamp(((e.b.vx-e.a.vx)*(-dy)+(e.b.vy-e.a.vy)*dx)/d*.65,-15,15),bow=(e.id%3-1)*3+shake+velocity;
   e.el.setAttribute('d',`M${e.a.x},${e.a.y} Q${(e.a.x+e.b.x)/2-dy/d*bow},${(e.a.y+e.b.y)/2+dx/d*bow} ${e.b.x},${e.b.y}`);e.el.style.display=G.crossesViewport(e.a,e.b,width,height,30)?'':'none';
  }
 }
 function updateHud(){
  $('zoomLabel').textContent=zoomFormat.format(view==='word'?detailScale:camera.zoom/G.overview(atlas,width,height).zoom)+'×';
  graph.setAttribute('aria-label',view==='word'?'Seçilmiş söz və əlaqələri':'Söz kainatı');
  map.classList.toggle('is-travelling',!!flight);map.classList.toggle('is-gathered',view==='word');
 }
 function releasePending(){for(const p of particles)if(p.waiting)p.releaseAt=(root.performance?.now?.()??clock)+100;}
 function advanceSelection(time){
  if(!selectionTravel)return;
  const travel=selectionTravel,t=G.clamp((time-travel.start)/travel.duration,0,1),ease=t*t*(3-2*t),before=G.transform(camera,width,height);
  const oldCamera=camera;camera={...travel.from,x:travel.from.x+(travel.to.x-travel.from.x)*ease,y:travel.from.y+(travel.to.y-travel.from.y)*ease,zoom:Math.exp(Math.log(travel.from.zoom)+(Math.log(travel.to.zoom)-Math.log(travel.from.zoom))*ease)};
  const desired={x:travel.sourceScreen.x+(travel.targetScreen.x-travel.sourceScreen.x)*ease,y:travel.sourceScreen.y+(travel.targetScreen.y-travel.sourceScreen.y)*ease},under=G.unproject(desired,camera,width,height,travel.anchor.z);camera.x+=travel.anchor.x-under.x;camera.y+=travel.anchor.y-under.y;
  const after=G.transform(camera,width,height);
  for(const p of bodies){
   const world=G.unproject(p,oldCamera,width,height,p.point.z),b=after(world),a=before(p.point),projected=after(p.point),ratio=camera.zoom*projected.depth/(oldCamera.zoom*a.depth),home=after(G.unproject({x:p.homeX,y:p.homeY},oldCamera,width,height,p.point.z));p.x=b.x;p.y=b.y;p.anchorX=projected.x;p.anchorY=projected.y;p.r*=ratio;if(p.skin!==undefined){p.skin=Math.min(2,p.r*.12);p.contactGap=Math.min(3,p.r*.15);}
   if(!p.local){p.tx=home.x;p.ty=home.y;p.homeX=home.x;p.homeY=home.y;}else if(p!==particles[0]){p.arrived=false;if(p.x< -width||p.x>width*2||p.y< -height||p.y>height*2)Object.assign(p,C.arrival(p,{x:p.homeX,y:p.homeY},focusLayout.center,focusLayout.bounds,p.r,{width,height}));}
  }
  for(const p of particles)if(p.waiting){p.tx=p.x;p.ty=p.y;p.vx=p.vy=0;}
  const chosen=particles[0],screen=after(travel.anchor);if(chosen){chosen.x=screen.x;chosen.y=screen.y;chosen.r=travel.sourceRadius*Math.exp(Math.log(travel.targetRadius/travel.sourceRadius)*ease);chosen.vx=chosen.vy=0;}
  sceneReady=false;projectScene();for(const e of links)for(const end of [e.a,e.b])if(!movingIds.has(end.node.id))Object.assign(end,allScreens.get(end.node.w));dirty=true;
  if(t===1){particles.slice(1).forEach((p,i)=>{if(p.waiting)p.releaseAt=time+100+(i%5)*25;});selectionTravel=null;focusCamera={...camera};needsRefresh=true;}
 }
 function tick(time){
  raf=0;if(document.hidden||paused||pinch?.preview)return;const now=Number.isFinite(time)?time:clock+16.67,dt=last?G.clamp(now-last,0,50):16.67;last=now;clock=now;
  if(selectionTravel)advanceSelection(now);
  if(flight){const next=G.sampleFlight(flight,now);camera={x:next.x,y:next.y,zoom:next.zoom,angle:next.angle,tilt:next.tilt};sceneReady=false;dirty=true;if(next.done){flight=null;needsRefresh=true;}}
  if(needsRefresh&&!selectionTravel&&(!drag||!drag.particle)&&(!flight||view==='word')&&(clock-lastRefresh>70||!particles.length))refresh();
  if(dirty)drawBackground();renderBubbles(dt);updateHud();
  if((flight||selectionTravel||(!reduced&&bodies.length&&!settled))&&!document.hidden&&!paused)raf=requestAnimationFrame(tick);
 }
 function wake(){if(!raf&&!document.hidden&&!paused)raf=requestAnimationFrame(tick);}
 function fly(to,kind){
  selectionTravel=null;flight=G.makeFlight(camera,to,width,height,root.performance?.now?.()??clock,reduced);view=kind;
  clearBubbles();focusLayout=null;$('connectionPager').hidden=true;$('connectionsPrevious').disabled=$('connectionsNext').disabled=true;map.classList.remove('has-connection-pages');sceneReady=false;dirty=true;onView?.(kind);
  if(reduced){camera={...to};sceneReady=false;flight=null;needsRefresh=true;refresh();drawBackground();renderBubbles(0);updateHud();}else wake();
 }
 function select(node,{initial=false}={}){
  cancelGestures();selectionTravel=null;flight=null;detailScale=1;detailPan={x:0,y:0};hover=null;accumulator=0;
  selected=atlas.byWord.get(node.w);related.clear();for(const r of C.relationships(model.related(node,filters)))related.set(r.node.w,r);
  const cluster=atlas.clusters[selected.cluster],region=atlas.regions[selected.region];onLocation?.({region,cluster,word:node});
  if(initial){view='universe';onLocation?.({region:null,cluster:null,word:null});sceneReady=false;dirty=needsRefresh=true;refresh();drawBackground();renderBubbles(0);updateHud();return;}
  focusCamera={...camera};view='word';sceneReady=false;onView?.('word');refresh();
  const chosen=particles[0],source=reduced?(allScreens.get(selected.word)):chosen,anchor=G.unproject(source,camera,width,height,selected.z),sourceDepth=G.transform(camera,width,height)(anchor).depth,sourceRadius=reduced?Math.max(.1,36*camera.zoom*sourceDepth):Math.max(.01,chosen.r),unitRadius=sourceRadius>3?sourceRadius/(camera.zoom*sourceDepth):36,denominator=unitRadius*1800-focusLayout.center.r*selected.z*.5,zoom=denominator>0?focusLayout.center.r*1800/denominator:.85,to={...camera,zoom:G.clamp(zoom,.0001,4)};
  const atCenter=G.unproject(focusLayout.center,to,width,height,selected.z);to.x+=anchor.x-atCenter.x;to.y+=anchor.y-atCenter.y;
  if(reduced){camera=to;sceneReady=false;refresh(true);}else selectionTravel={from:{...camera},to,anchor,sourceScreen:{x:chosen.x,y:chosen.y},targetScreen:{x:focusLayout.center.x,y:focusLayout.center.y},sourceRadius,sourceDepth,targetRadius:focusLayout.center.r,start:root.performance?.now?.()??clock,duration:1050};
  if(!reduced)for(const p of particles.slice(1)){p.waiting=true;p.releaseAt=Infinity;p.spring=0;p.tx=p.x;p.ty=p.y;p.vx=p.vy=0;}
  drawBackground();renderBubbles(0);updateHud();wake();
 }
 function visitArea(a,kind){
  if(navigationLocked)return;
  cancelGestures();const target=G.area(a,width,height);
  if(kind==='cluster'&&camera.zoom>=target.zoom*.9&&Math.hypot(camera.x-a.x,camera.y-a.y)<a.radius*.25){const word=a.featured[0];if(word)onSelect(model.byWord.get(word));return;}
  fly(target,kind);onLocation?.({region:kind==='region'?a:atlas.regions[a.region],cluster:kind==='cluster'?a:null,word:null});
 }
 function home(){if(navigationLocked)return;cancelGestures();fly(G.overview(atlas,width,height),'universe');onLocation?.({region:null,cluster:null,word:null});}
 function focusSelected(){if(navigationLocked)return;if(!selected)return;if(view!=='word'){select(selected.node);return;}detailPan={x:0,y:0};scaleDetail(1);}
 function setFilters(next){filters=new Set(next);related.clear();connectionPage=0;if(selected)for(const r of C.relationships(model.related(selected.node,filters)))related.set(r.node.w,r);needsRefresh=dirty=true;wake();}
 function manual(){if(view==='word')return;flight=null;view='explore';onView?.('explore');sceneReady=false;dirty=needsRefresh=true;wake();}
 function local(e){const r=graph.getBoundingClientRect();return {x:(e.clientX-r.left)*width/(r.width||width),y:(e.clientY-r.top)*height/(r.height||height)};}
 function cancelGestures(){clearPinchPreview();const ids=[...pointers.keys()];if(drag?.particle)drag.particle.targetScale=1;pointers.clear();drag=pinch=null;gesture=false;for(const id of ids)if(graph.hasPointerCapture?.(id))graph.releasePointerCapture(id);}
 function scaleDetail(value,anchorPoint=null){
  if(navigationLocked)return;
  releasePending();selectionTravel=null;
  if(drag?.particle){drag.particle.targetScale=1;drag=null;}
  if(value<1){leaveFocus(value/detailScale,anchorPoint||focusLayout.center);return;}
  const previous=detailScale,next=G.clamp(value,1,6),base=C.collective(width,height,related.size).baseCenter;
  if(anchorPoint){const ratio=next/previous;detailPan={x:anchorPoint.x-base.x-(anchorPoint.x-base.x-detailPan.x)*ratio,y:anchorPoint.y-base.y-(anchorPoint.y-base.y-detailPan.y)*ratio};}
  const focusPoint=anchorPoint||{x:base.x+detailPan.x,y:base.y+detailPan.y};camera=G.zoomAt(camera,focusPoint,camera.zoom*next/previous,width,height);detailScale=next;focusCamera={...camera,zoom:camera.zoom/detailScale};sceneReady=false;refresh(true);drawBackground();renderBubbles(0);updateHud();wake();
 }
 function panDetail(x,y){if(navigationLocked)return;releasePending();selectionTravel=null;detailPan={x:G.clamp(x,-width*detailScale,width*detailScale),y:G.clamp(y,-height*detailScale,height*detailScale)};sceneReady=false;refresh(true);drawBackground();renderBubbles(0);updateHud();wake();}
 function pair(){const[a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))};}
 function clearPinchPreview(){$('viewport').removeAttribute('transform');canvas.style.transform='';labels.style.transform='';}
 function cameraGesture(from,start,next,ratio){const zoom=G.clamp(from.zoom*ratio,G.overview(atlas,width,height).zoom*.7,Math.max(2.4,(focusCamera?.zoom||1)*6)),nextCamera=G.zoomAt(from,start,zoom,width,height),a=G.unproject(start,nextCamera,width,height),b=G.unproject(next,nextCamera,width,height);nextCamera.x+=a.x-b.x;nextCamera.y+=a.y-b.y;return nextCamera;}
 function leaveFocus(ratio,point,next=point){selectionTravel=null;camera=cameraGesture(camera,point,next,ratio);flight=null;view='explore';clearBubbles();focusLayout=null;sceneReady=false;dirty=needsRefresh=true;onView?.('explore');refresh();drawBackground();updateHud();wake();}
 function previewPinch(){const next=pair(),raw=next.distance/pinch.distance,ratio=G.clamp(raw,G.overview(atlas,width,height).zoom*.7/pinch.camera.zoom,(view==='word'?6/pinch.detailScale:2.4/pinch.camera.zoom)),x=next.x-pinch.x*ratio,y=next.y-pinch.y*ratio;
  pinch.preview={next,ratio,x,y};$('viewport').setAttribute('transform',`matrix(${ratio} 0 0 ${ratio} ${x} ${y})`);for(const layer of [canvas,labels]){layer.style.transformOrigin='0 0';layer.style.transform=`translate(${x}px,${y}px) scale(${ratio})`;}$('zoomLabel').textContent=zoomFormat.format(view==='word'?pinch.detailScale*ratio:pinch.camera.zoom*ratio/G.overview(atlas,width,height).zoom)+'×';
 }
 function commitPinch(){if(!pinch)return;const p=pinch;pinch=null;clearPinchPreview();if(!p.preview){wake();return;}const {next,ratio}=p.preview;camera=cameraGesture(p.camera,p,next,ratio);flight=null;last=0;
  if(view==='word'&&p.detailScale*ratio>=.999){const base=C.collective(width,height,related.size).baseCenter;detailScale=Math.max(1,p.detailScale*ratio);detailPan={x:next.x-base.x-(p.x-base.x-p.detailPan.x)*ratio,y:next.y-base.y-(p.y-base.y-p.detailPan.y)*ratio};focusCamera={...camera,zoom:camera.zoom/detailScale};sceneReady=false;refresh(true);drawBackground();renderBubbles(0);updateHud();}
  else {view='explore';clearBubbles();focusLayout=null;sceneReady=false;dirty=needsRefresh=true;onView?.('explore');refresh();drawBackground();updateHud();}wake();
 }
 function start(e,particle=null,tapPoint=null,tapArea=null){
  if((e.button!==0&&e.pointerType==='mouse')||pointers.size>=2)return;e.preventDefault();e.stopPropagation();const p=local(e);pointers.set(e.pointerId,p);graph.setPointerCapture?.(e.pointerId);
  if(navigationLocked){if(pointers.size>1){gesture=true;drag=null;return;}gesture=false;drag={id:e.pointerId,start:p,last:p,particle,tapPoint,tapArea:null,moved:false};return;}
  if(pointers.size===2){releasePending();selectionTravel=null;gesture=true;if(drag?.particle)drag.particle.targetScale=1;drag=null;pinch={...pair(),camera:{...camera},detailScale,detailPan:{...detailPan}};flight=null;cancelAnimationFrame(raf);raf=0;return;}
  if(pointers.size>2)return;
  gesture=false;drag={id:e.pointerId,start:p,last:p,camera:{...camera},detailPan:{...detailPan},particle,tapPoint,tapArea,startPX:particle?.x,startPY:particle?.y,moved:false,throwX:0,throwY:0};if(particle&&!reduced)particle.targetScale=.95;kick();
 }
 graph.addEventListener('pointerdown',e=>{if(!e.target.closest('.word-node'))start(e);});
 graph.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;const p=local(e);pointers.set(e.pointerId,p);
  if(navigationLocked){if(drag?.id===e.pointerId&&Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>6)drag.moved=true;e.preventDefault();return;}
  if(pinch&&pointers.size>=2){e.preventDefault();previewPinch();return;}
  if(!drag||drag.id!==e.pointerId)return;const dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(Math.hypot(dx,dy)>6)drag.moved=true;if(!drag.moved)return;releasePending();selectionTravel=null;
  if(drag.particle){P.moveDragged(bodies,drag.particle,drag.startPX+dx,drag.startPY+dy,!reduced);drag.throwX=G.clamp(p.x-drag.last.x,-12,12);drag.throwY=G.clamp(p.y-drag.last.y,-12,12);renderBubbles(0);wake();}
  else if(view==='word'){panDetail((drag.detailPan?.x||0)+dx,(drag.detailPan?.y||0)+dy);}
  else if(view!=='word'){const a=G.unproject(drag.start,drag.camera,width,height),b=G.unproject(p,drag.camera,width,height);camera={...drag.camera,x:drag.camera.x+a.x-b.x,y:drag.camera.y+a.y-b.y};manual();}
  drag.last=p;
 });
 function end(e,cancel=false){
  if(!pointers.has(e.pointerId))return;const p=pointers.get(e.pointerId);pointers.delete(e.pointerId);if(graph.hasPointerCapture?.(e.pointerId))graph.releasePointerCapture(e.pointerId);
  if(pinch){commitPinch();if(pointers.size===1){const[id,point]=[...pointers][0];drag={id,start:point,last:point,camera:{...camera},detailPan:{...detailPan},particle:null,moved:true};}else drag=null;return;}
  if(drag?.id===e.pointerId){const d=drag;drag=null;if(d.particle){d.particle.targetScale=1;if(!cancel&&d.moved&&!navigationLocked){d.particle.vx=d.throwX;d.particle.vy=d.throwY;}else if(!cancel&&!d.moved&&!gesture)onSelect(d.particle.node);}else if(!cancel&&!d.moved&&!gesture){if(d.tapArea){visitArea(d.tapArea.area,d.tapArea.kind);return;}const closest=d.tapPoint?{v:{point:d.tapPoint}}:hitDots.map(v=>({v,d:Math.hypot(v.screen.x-p.x,v.screen.y-p.y)})).filter(x=>x.d<Math.max(9,x.v.r)).sort((a,b)=>a.d-b.d)[0];if(closest)onSelect(closest.v.point.node);}
  }if(reduced){for(const body of bodies){body.x=body.homeX;body.y=body.homeY;body.vx=body.vy=0;body.scale=1;}constrain();renderBubbles(0);}kick();
 }
 graph.addEventListener('pointerup',e=>end(e));graph.addEventListener('pointercancel',e=>end(e,true));graph.addEventListener('lostpointercapture',e=>end(e,true));
 graph.addEventListener('wheel',e=>{e.preventDefault();if(navigationLocked)return;if(view==='word'){scaleDetail(detailScale*Math.exp(-e.deltaY*.0018),local(e));return;}const zoom=G.clamp(camera.zoom*Math.exp(-e.deltaY*.0018),G.overview(atlas,width,height).zoom*.7,2.4);camera=G.zoomAt(camera,local(e),zoom,width,height);manual();},{passive:false});
 graph.addEventListener('keydown',e=>{if(e.target!==graph)return;if(navigationLocked){if(['+','=','-','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();return;}if(['+','=','-','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='Home')home();else if(['+','=','-'].includes(e.key))zoom(e.key==='-'?1/1.8:1.8);else if(view==='word'){panDetail(detailPan.x+({'ArrowLeft':90,'ArrowRight':-90}[e.key]||0),detailPan.y+({'ArrowUp':90,'ArrowDown':-90}[e.key]||0));}else{camera.x+=({'ArrowLeft':-1,'ArrowRight':1}[e.key]||0)*90/camera.zoom;camera.y+=({'ArrowUp':-1,'ArrowDown':1}[e.key]||0)*90/camera.zoom;manual();}}});
 function zoom(mult){if(navigationLocked)return;if(view==='word'){scaleDetail(detailScale*mult);return;}fly({...camera,zoom:G.clamp(camera.zoom*mult,G.overview(atlas,width,height).zoom*.7,2.4)},'explore');}
 function suspend(value){const now=root.performance?.now?.()??clock;if(value&&pauseTime===null)pauseTime=now;if(!value&&pauseTime!==null){motionStarted+=now-pauseTime;if(selectionTravel)selectionTravel.start+=now-pauseTime;for(const p of particles)if(p.waiting&&Number.isFinite(p.releaseAt))p.releaseAt+=now-pauseTime;pauseTime=null;}paused=value;if(value){cancelGestures();cancelAnimationFrame(raf);raf=0;last=0;savedCamera=flight?{...flight.to}:null;flight=null;}else{if(savedCamera){camera=savedCamera;savedCamera=null;}sceneReady=false;dirty=true;wake();}}
 function setPageHidden(value){pageHidden=value;suspend(value||document.hidden);}
 document.addEventListener('visibilitychange',()=>suspend(document.hidden||pageHidden));
 media.addEventListener?.('change',e=>{reduced=e.matches;if(reduced){if(selectionTravel)advanceSelection(selectionTravel.start+selectionTravel.duration);if(flight){camera={...flight.to};flight=null;}for(const p of bodies){p.scale=1;p.scaleV=0;p.r=p.homeR;}settled=true;sceneReady=false;dirty=needsRefresh=true;}wake();});
 new ResizeObserver(()=>{if(map.clientWidth!==width||map.clientHeight!==height){cancelGestures();resize();}}).observe(map);
 resize();
 return {atlas,select,home,setRaceRoute:route=>{raceRoute=route;needsRefresh=dirty=true;wake();},setNavigationLocked:value=>{cancelGestures();navigationLocked=!!value;},isCenteredWord:word=>selected?.word===word&&view==='word'&&!selectionTravel&&!!particles[0]&&Math.hypot(particles[0].x-focusLayout.center.x,particles[0].y-focusLayout.center.y)<.1,visibleWords:()=>[...new Set([...bodies.filter(p=>p.r>=10&&p.x-p.r>=8&&p.x+p.r<=width-8&&p.y-p.r>100&&p.y+p.r<height-130).map(p=>p.node.w),...hitDots.filter(p=>p.labelOpacity>.2&&p.screen.x-p.r>=8&&p.screen.x+p.r<=width-8&&p.screen.y-p.r>100&&p.screen.y+p.r<height-130).map(p=>p.point.word)])],focus:focusSelected,zoom,visitRegion:id=>visitArea(atlas.regions.find(r=>r.id===id),'region'),visitCluster:id=>visitArea(atlas.clusters.find(c=>c.id===id),'cluster'),setFilters,suspend,setPageHidden,resize,
  inspect:()=>({navigationLocked,pinching:!!pinch,pinchPreview:pinch?.preview?{...pinch.preview}:null,camera:{...camera},view,flight:!!flight,cameraTravelling:!!selectionTravel,selectionAnchor:selectionTravel?{...selectionTravel.anchor}:null,gathering:!settled,detailScale,detailPan:{...detailPan},settled,focusCenter:focusLayout?{...focusLayout.center}:null,lines:links.map(e=>({id:e.id,a:e.a.node.w,b:e.b.node.w,path:e.el.getAttribute('d'),color:e.el.getAttribute('stroke'),highlighted:e.highlighted,visible:e.el.style.display!=='none'})),particles:particles.map(p=>({word:p.node.w,x:p.x,y:p.y,r:P.radius(p),visualRadius:p.r,waiting:p.waiting,releaseAt:p.releaseAt,targetX:p.homeX,targetY:p.homeY,arrived:p.arrived,vx:p.vx,vy:p.vy})),surroundings:surroundings.map(p=>({word:p.node.w,x:p.x,y:p.y,r:P.radius(p)})),points:atlas.points.length,visible:projected.length,atlasGlyphs:projected.filter(v=>!movingIds.has(v.point.node.id)).map(v=>({word:v.point.word,x:v.screen.x,y:v.screen.y,r:v.r,labelOpacity:v.labelOpacity})),atlasLines:atlasLines.map(e=>({...e})),screenPositions:[...allScreens].map(([word,p])=>({word,x:p.x,y:p.y})),reduced,paused,connectionPage:0,connectionPages:1,connectionCapacity:related.size,relatedWords:[...related.keys()],focusBounds:focusLayout?.bounds||null,contained:focusLayout?.contained||false})};

}
root.GalaxyView={mount};
})(window);
