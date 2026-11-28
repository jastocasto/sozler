/* A persistent canvas atlas with a bounded, accessible SVG physics layer. */
(function(root){
'use strict';
const proficiencyColours=['#b83235','#bc541c','#9b760b','#28754c'];
function mount({model,onSelect,onLocation,onView,motionPreference='system'}){
 const G=root.WordGalaxy,P=root.WordPhysics,C=root.ConnectionLayout,types=root.WordWeb.types,$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
 const atlas=G.createAtlas(root.WORD_GALAXY_DATA,model),canvas=$('universeCanvas'),graph=$('graph'),labels=$('atlasLabels'),map=$('map');
 const countFormat=new Intl.NumberFormat('az'),zoomFormat=new Intl.NumberFormat('az',{maximumFractionDigits:1});
 $('universeTotal').textContent=countFormat.format(atlas.points.length)+' söz';
 const context=canvas.getContext('2d',{alpha:true});
 if(!context)throw Error('Canvas 2D is required for the word galaxy.');
 const media=root.matchMedia?.('(prefers-reduced-motion: reduce)');
 let reduced;
 setMotionPreference(motionPreference);
 const wordFooter=map.querySelector('.map-footer'),wordCard=$('meaningCard'),navigation=document.querySelector('.navigation-strip');
 let wordStage=null;
 let landingSteps=0,landingFrom=null;
 let width=map.clientWidth||innerWidth,height=map.clientHeight||innerHeight,camera=G.overview(atlas,width,height),selected=null,filters=new Set(Object.keys(types));
 let particles=[],surroundings=[],bodies=[],links=[],activeIds=new Set(),movingIds=new Set(),flight=null,raf=0,last=0,accumulator=0,clock=0,dirty=true,needsRefresh=true,view='universe',paused=false,pageHidden=false,drag=null,pinch=null,gesture=false,lastRefresh=0,hover=null,connectionPage=0,focusLayout=null,detailScale=1,detailPan={x:0,y:0},focusCamera=null,selectionTravel=null,settled=true,idleFrames=0,motionStarted=0,pauseTime=null,navigationLocked=false,raceRoute=null;
 const routeIndex=root.AtlasRoutes.createIndex(atlas);
 let routeLanes=routeIndex.lanes(filters),selectedLane=null;
 const panel=root.AtlasRoutePanel.mount({
  container:$('atlasRoutesPanel'),toggle:$('routesToggle'),atlas,index:routeIndex,types,filters,onSelect,
  onRegion:index=>visitArea(atlas.regions[index],'region'),
  onRoute(from,to){
   const route=from===null?null:{from,to,...routeIndex.summary(from,to,filters)};
   selectedLane=route?.count?route:null;
   if(selectedLane&&view!=='universe'){
    const project=G.transform(camera,width,height);
    if(![from,to].every(i=>isVisible(project(atlas.regions[i]),0)))home();
   }
   dirty=true;wake();
  }
 });
 $('universeEdges').textContent=countFormat.format(atlas.edges.length)+' əlaqə';
 const orbitToggle=$('orbitToggle');
 let orbitMode=false,lastOrbitState=null;
 const pointers=new Map(),related=new Map();let projected=[],hitDots=[],savedCamera=null,atlasLines=[],atlasControls=new Map(),sceneReady=false;
 const screens=atlas.points.map(()=>({x:0,y:0,depth:1}));
 const allScreens=new Map(atlas.points.map((point,i)=>[point.word,screens[i]]));
 const connectionView=G.connectionView(atlas,allScreens);
 const glyphBuffer={glyphs:atlas.points.map((point,i)=>({point,screen:screens[i],r:0,body:0,labelOpacity:0,fontSize:8.5,lines:null,cx:0,cy:0})),visible:[]};
 const el=(name,attrs={},text)=>{const e=document.createElementNS(NS,name);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
 const contextWords=el('g',{class:'surrounding-words'}),contextLinks=el('g',{class:'surrounding-links'});
 let wordRatings=new Map(),ratedPoints=[];
 let arrivalLight=1;
 // The expanded card overlays the map. Keep the resting word layout anchored
 // in the space above the compact card, legend and controls.
 function measureWordStage(){
  if(view!=='word'||wordCard.dataset.expanded==='true')return false;
  const footer=wordFooter.getBoundingClientRect(),nav=navigation.getBoundingClientRect(),origin=map.getBoundingClientRect().top;
  if(!footer.height||!Number.isFinite(nav.bottom)||footer.top<=origin)return false;
  const top=Math.ceil(nav.bottom-origin+4),bottomInset=Math.ceil(origin+height-footer.top+4);
  if(wordStage?.top===top&&wordStage.bottomInset===bottomInset)return false;
  wordStage={top,bottomInset};return true;
 }
 function retargetWordFlight(oldWidth=width,oldHeight=height){
  const trip=selectionTravel;
  focusLayout=C.collective(width,height,particles.length-1,detailScale,detailPan,0,wordStage);
  for(let i=0;i<particles.length;i++){
   const p=particles[i],slot=i?focusLayout.slots[i-1]:focusLayout.center;
   p.homeX=slot.x;p.homeY=slot.y;p.homeR=slot.r;
   if(!p.waiting&&!p.launch){p.tx=slot.x;p.ty=slot.y;}
  }
  // Re-project the original tap into the resized map. Keep its elapsed flight
  // time, including through a series of small mobile address-bar changes.
  const from={...trip.from};
  if(from.lens){from.vanishX*=width/oldWidth;from.vanishY*=height/oldHeight;}
  const source=G.transform(from,width,height)(trip.fromAnchor);
  const adjusted=G.makeWordFlight(from,selected,{...source,r:trip.sourceRadius},focusLayout.center,width,height,trip.start);
  Object.assign(trip,adjusted,{duration:trip.duration,anchor:trip.anchor});
 }
 function resize(){
  const oldWidth=width,oldHeight=height;
  width=map.clientWidth||innerWidth;height=map.clientHeight||innerHeight;
  measureWordStage();
  const dpr=Math.min(root.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';context.setTransform(dpr,0,0,dpr,0,0);graph.setAttribute('viewBox',`0 0 ${width} ${height}`);
  if(flight)flight=null;
  if(selectionTravel)retargetWordFlight(oldWidth,oldHeight);
  if(view==='universe')camera=G.overview(atlas,width,height);
  sceneReady=false;dirty=needsRefresh=true;wake();
 }
 function isVisible(p,pad=40){return p.x>-pad&&p.x<width+pad&&p.y>74-pad&&p.y<height-96+pad;}
 function clearBubbles(){particles=[];surroundings=[];bodies=[];links=[];landingSteps=0;landingFrom=null;activeIds.clear();movingIds.clear();atlasControls.clear();contextLinks.replaceChildren();contextWords.replaceChildren();$('bubbles').replaceChildren();$('links').replaceChildren();settled=true;arrivalLight=1;}
 function projectScene(){
  const project=G.transform(camera,width,height);
  project.all(atlas.points,screens);
  projected=G.glyphs(atlas,camera,width,height,allScreens,(word,size)=>{context.font=size+'px Georgia, serif';return context.measureText(word).width;},glyphBuffer);
  sceneReady=true;
 }
 function kick(){settled=reduced;idleFrames=landingSteps=0;landingFrom=null;motionStarted=root.performance?.now?.()??clock;clock=motionStarted;last=0;accumulator=0;wake();}
 function launchDeparture(p,center,showTrail){
  const home=allScreens.get(p.node.w),stage=focusLayout.center,focus=isVisible(center,30)?center:stage;
  let dx=p.x-focus.x,dy=p.y-focus.y;
  if(Math.hypot(dx,dy)<1){dx=home.x-p.x;dy=home.y-p.y;}
  let angle=Math.atan2(dy,dx);
  // A tap near the edge puts most of the old family on its far side. Fan the
  // rays toward their existing positions in that family while still pointing out.
  if(Math.hypot(p.x-stage.x,p.y-stage.y)>1){
   const spread=Math.atan2(p.y-stage.y,p.x-stage.x)-angle;
   angle+=G.clamp(Math.atan2(Math.sin(spread),Math.cos(spread)),-1.15,1.15)*.72;
  }
  const ux=Math.cos(angle),uy=Math.sin(angle),bounds=focusLayout.bounds;
  const roomX=ux>0?width-p.x:p.x,roomY=uy>0?bounds.bottom+12-p.y:p.y-bounds.top+12;
  const runway=Math.max(0,Math.min(roomX/(Math.abs(ux)||1e-6),roomY/(Math.abs(uy)||1e-6)));
  const reach=G.clamp(86+runway*.83,100,Math.min(width,height)*.95);
  return {...p,local:false,depth:2,waiting:false,arrived:false,launch:null,trail:null,targetScale:1,
   vx:0,vy:0,spring:0,damping:1,maxSpeed:42,inverseMass:.002,
   departure:{r:p.r,angle,reach,travelled:0,elapsed:0,showTrail,tailX:p.x,tailY:p.y,hitHistory:[],
    focusId:focus===center?center.node.id:null,focusX:focus.x,focusY:focus.y,
    duration:805+Math.min(170,reach*.45),opacity:p.recoverOpacity??1}};
 }
 function refresh(reframe=false,newSelection=false){
  needsRefresh=false;lastRefresh=clock;
  if(view!=='word'||!selected){if(bodies.length)clearBubbles();focusLayout=null;$('connectionPager').hidden=true;return;}
  const focusedWord=document.activeElement?.getAttribute('data-word'),old=new Map(bodies.map(p=>[p.node.id,p])),oldLayout=focusLayout;
  if(atlasControls.size)clearBubbles();
  if(!sceneReady)projectScene();
  const glyphById=new Map(projected.map(v=>[v.point.node.id,v]));
  // Race navigation uses actual atlas words and does not create lexical edges.
  const neighbors=new Set(raceRoute?.(selected.word)||[]);
  const words=[...neighbors,...[...related.keys()].filter(word=>!neighbors.has(word))];
  focusLayout=C.collective(width,height,words.length,detailScale,detailPan,0,wordStage);connectionPage=0;
  $('connectionPager').hidden=true;$('connectionsPrevious').disabled=$('connectionsNext').disabled=true;map.classList.remove('has-connection-pages');
  const candidates=[{point:selected,screen:focusLayout.center},...words.map((word,i)=>({point:atlas.byWord.get(word),screen:focusLayout.slots[i]}))],ratio=oldLayout?detailScale/oldLayout.scale:1;
  particles=candidates.map(({point,screen},i)=>{
   const previous=old.get(point.node.id),isSelected=point===selected,origin=allScreens.get(point.word),glyph=glyphById.get(point.node.id);
   // A large family needs several depths outside a given edge. Keep the
   // true bearing of each source and leave space between successive waves.
   const edgeOffset=i%7*9+(words.length>48?Math.floor(i/7)*11:0);
   const entry=C.arrival(origin,screen,focusLayout.center,focusLayout.bounds,screen.r,{width,height},edgeOffset);
   const position=reduced?screen:isSelected&&!previous?origin:previous?(reframe&&previous.local?{x:screen.x+(previous.x-previous.homeX)*ratio,y:screen.y+(previous.y-previous.homeY)*ratio}:previous):entry;
   const waiting=!isSelected&&!reduced&&(!previous?.local||previous.waiting);
   const radius=reduced||reframe&&!waiting?screen.r:previous?.r??Math.min(screen.r,glyph?.r??3);
   const launch=!waiting&&!isSelected&&!reduced&&!newSelection&&!reframe?previous?.launch:null;
   const p={node:point.node,point,type:isSelected?'selected':related.get(point.word)?.edge.type||'nearby',depth:isSelected?0:1,
    x:position.x,y:position.y,tx:launch?previous.tx:screen.x,ty:launch?previous.ty:screen.y,homeX:screen.x,homeY:screen.y,
    anchorX:origin.x,anchorY:origin.y,vx:reframe?0:previous?.vx||0,vy:reframe?0:previous?.vy||0,
    r:radius,skin:Math.min(2,radius*.12),contactGap:Math.min(3,radius*.15),homeR:screen.r,scale:previous?.scale||1,scaleV:previous?.scaleV||0,targetScale:1,
    waiting,launch,reveal:waiting?0:launch?previous.reveal:1,trailEnabled:false,
    centerApproach:launch?previous.centerApproach:words.length<=32||i<=14,
    distantSlot:words.length>48&&(screen.x< -screen.r||screen.x>width+screen.r||screen.y< -screen.r||screen.y>height+screen.r),
    spring:isSelected?.075:launch?previous.spring:.045,damping:isSelected?.78:launch?previous.damping:.84,maxSpeed:isSelected?26:launch?previous.maxSpeed:24,
    repulsion:0,local:true,arrived:reduced||reframe&&!!previous?.arrived};
   if(waiting){
    // A new neighbor is still attached to its map point during the dive. A
    // returning, already visible bubble keeps the position at which it was caught.
    p.originWorld=previous?.waiting?previous.originWorld:previous?G.unproject(position,camera,width,height,point.z,point):point;
    p.heldRadius=previous?.waiting?previous.heldRadius:Math.max(radius,Math.min(6,screen.r*.18));
    p.heldGlyphRadius=previous?.waiting?previous.heldGlyphRadius:radius;
    p.edgeOffset=edgeOffset;p.holdX=p.tx=p.x;p.holdY=p.ty=p.y;p.spring=0;p.vx=p.vy=0;
    if(newSelection)p.releaseAt=Infinity;
    else if(previous?.waiting){
     p.releaseAt=previous.releaseAt;p.releaseDelay=previous.releaseDelay;p.waitElapsed=previous.waitElapsed;p.waitFrame=previous.waitFrame;
     p.holdX=previous.holdX;p.holdY=previous.holdY;p.drawX=previous.drawX;p.drawY=previous.drawY;
    }
   }
   return p;
  });
  const arrivals=particles.filter(p=>p.waiting||p.launch);
  arrivals.forEach((p,i)=>{
   p.trailEnabled=i<24;
   if(p.waiting&&!p.distantSlot&&i<14)p.centerApproach=true;
  });
  const unstaged=arrivals.filter(p=>p.waiting&&p.releaseAt===undefined);
  unstaged.forEach((p,i)=>stageArrival(p,clock,i,unstaged.length));
  fitHeldStars();
  activeIds=new Set(particles.map(p=>p.node.id));
  const departures=new Map();
  if(!reduced){
   for(const p of particles){
    const previous=old.get(p.node.id);
    p.recoverOpacity=previous?.departure?.opacity??previous?.recoverOpacity??1;
   }
   for(const p of old.values()){
    if(activeIds.has(p.node.id))continue;
    if(!isVisible(p,p.r+65))continue;
    if(p.departure){if(p.departure.opacity>.02)departures.set(p.node.id,p);}
    // A star still waiting at its atlas address has nothing to eject.
    else if(p.local&&p.r>1&&(!p.waiting||p.recoverOpacity<1))departures.set(p.node.id,launchDeparture(p,particles[0],departures.size<20));
   }
  }
  const contextGlyphs=projected.filter(v=>v.r>8&&!activeIds.has(v.point.node.id)&&!departures.has(v.point.node.id));
  surroundings=contextGlyphs.map(v=>{
   const last=old.get(v.point.node.id),previous=last&&!last.local&&!last.departure?last:null,screen=v.screen;
   const position=reduced?screen:previous?(reframe?{x:screen.x+(previous.x-previous.anchorX),y:screen.y+(previous.y-previous.anchorY)}:previous):screen;
   return {node:v.point.node,point:v.point,type:'nearby',depth:2,x:position.x,y:position.y,tx:screen.x,ty:screen.y,homeX:screen.x,homeY:screen.y,anchorX:screen.x,anchorY:screen.y,vx:previous?.vx||0,vy:previous?.vy||0,r:reduced||reframe?v.r:previous?.r??v.r,homeR:v.r,scale:previous?.scale||1,scaleV:0,targetScale:1,spring:.025,damping:.78,repulsion:0,inverseMass:2,local:false};
  });
  // During a close camera pass many backdrop glyphs can pile up in one pixel.
  // Give the visible burst first choice of space in the contact solver while
  // still painting it above those passive glyphs and below the current family.
  bodies=[...particles,...departures.values(),...surroundings];
  surroundings.push(...departures.values());
  movingIds=new Set(bodies.map(p=>p.node.id));const byId=new Map(bodies.map(p=>[p.node.id,p]));
  const network=connectionView.group(filters,movingIds),previousLinks=new Map(links.map(e=>[e.id,e]));
  links=network.dynamic.map(e=>({...e,a:byId.get(e.a.id)||{...allScreens.get(e.from.word),node:e.a,vx:0,vy:0},b:byId.get(e.b.id)||{...allScreens.get(e.to.word),node:e.b,vx:0,vy:0},highlighted:e.a.id===selected.node.id||e.b.id===selected.node.id}));
  const linkLayer=$('links'),nextContext=document.createDocumentFragment(),directEdges=new Map();
  const nextBubbles=document.createDocumentFragment();
  contextWords.replaceChildren();nextBubbles.append(contextWords);
  let contextEdgeCount=0;
  linkLayer.classList.remove('tracing-relations');
  for(const e of links){
   const previous=previousLinks.get(e.id);
   if(previous){e.el=previous.el;previousLinks.delete(e.id);e.el.classList.remove('traced-edge');}
   else{
    e.el=el('path',{class:'edge','data-edge-id':e.id});
    e.el.append(el('title',{},`${e.a.node.w} ↔ ${e.b.node.w} · ${types[e.type].description}`));
   }
   if(previous?.highlighted!==e.highlighted){
    e.el.classList.toggle('selected-edge',e.highlighted);
    e.el.setAttribute('stroke',e.highlighted?types[e.type].color:'#bcbdb7');
    e.el.setAttribute('stroke-width',e.highlighted?4.05:.75);e.el.setAttribute('opacity',e.highlighted?.88:.23);
    if(e.highlighted&&e.type==='ending')e.el.setAttribute('stroke-dasharray','4 5');else e.el.removeAttribute('stroke-dasharray');
   }
   if(!e.highlighted){if(e.el.parentNode!==contextLinks)nextContext.append(e.el);contextEdgeCount++;continue;}
   const other=e.a.node.id===selected.node.id?e.b.node:e.a.node;
   if(!directEdges.has(other.id))directEdges.set(other.id,[]);
   directEdges.get(other.id).push(e);
  }
  for(const obsolete of previousLinks.values())obsolete.el.remove();
  contextLinks.append(nextContext);
  if(contextLinks.parentNode!==linkLayer)linkLayer.prepend(contextLinks);
  const nextDirect=document.createDocumentFragment();
  for(const group of directEdges.values())for(const e of group)nextDirect.append(e.el);
  linkLayer.append(nextDirect);
  // Dense neighborhoods retain every context path while giving the selected family priority.
  linkLayer.style.setProperty('--context-edge-opacity',G.clamp(.16*Math.sqrt(80/Math.max(contextEdgeCount,1)),.025,.16));
  if(directEdges.size>=96)linkLayer.style.setProperty('--direct-edge-width',Math.max(1.1,4.05*Math.sqrt(48/directEdges.size)).toFixed(2)+'px');
  else linkLayer.style.removeProperty('--direct-edge-width');
  // Separate paths sharing endpoints so both relation colors remain identifiable.
  for(const group of directEdges.values())if(group.length>1)group.forEach((e,i)=>{
   e.parallelBend=(i-(group.length-1)/2)*20*(e.a.node.id===selected.node.id?1:-1);
  });
  let focusedId=null,traced=null;
  function trace(){
   const next=directEdges.get(hover??focusedId)||null;
   if(next===traced)return;
   if(traced)for(const e of traced)e.el.classList.remove('traced-edge');
   if(next)for(const e of next)e.el.classList.add('traced-edge');
   linkLayer.classList.toggle('tracing-relations',!!next);
   traced=next;
  }
  // Context draws first, so the active family remains easy to read.
  let refocus=null;
  for(const p of [...surroundings,...particles]){
   if(p.departure){
    // Preserve the exact painted label, colour, radius and halo at release.
    // The outgoing copy has no old drag, keyboard or tracing listeners.
    if(!p.el.classList.contains('departing-word')){
     const g=p.el.cloneNode(true);g.classList.add('departing-word');
     g.querySelector('.arrival-trail')?.remove();
     if(g.classList.contains('selected')){g.classList.remove('selected');g.classList.add('was-selected');}
     g.removeAttribute('tabindex');g.removeAttribute('role');g.setAttribute('aria-hidden','true');
     g.addEventListener('pointerdown',e=>{
      if(navigationLocked||p.departure.opacity<=.25)return;
      if(e.target===p.departure.hit||e.target===p.departure.trail){
       const touch=local(e),behind=bodies.find(other=>!other.departure&&Math.hypot(other.x-touch.x,other.y-touch.y)<=other.r*other.scale);
       if(behind){start(e,behind);return;}
      }
      start(e,null,p.point);
     });
     p.el=g;p.circle=g.querySelector('.bubble');p.label=g.querySelector('text');p.orbit=g.querySelector('.selection-orbit');p.ratingMark=g.querySelector('.proficiency-mark');
     p.departure.hit=el('path',{class:'departure-hit',fill:'none',stroke:'transparent','stroke-linecap':'round','aria-hidden':'true'});
     g.prepend(p.departure.hit);
     if(p.departure.showTrail){
      p.departure.trail=el('path',{class:'departure-trail',fill:types[p.type]?.color||'#73736b','fill-opacity':'.58'});
      g.prepend(p.departure.trail);
     }
    }
    nextBubbles.append(p.el);continue;
   }
   const chosen=p.depth===0,t=types[p.type],group=directEdges.get(p.node.id);
   const relation=group?`${selected.word} ↔ ${p.node.w} · ${group.map(e=>types[e.type].description).join(' / ')}`:'';
   const g=el('g',{class:'word-node'+(chosen?' selected':'')+(!p.local?' surrounding-word':''),tabindex:'0',role:'button','data-word':p.node.w,'data-type':p.type});
   g.append(el('title'));p.relation=relation;describeWord(g,p.node,relation,chosen);
   if(p.trailEnabled&&!reduced&&(p.waiting||p.launch)){
    p.trail=el('path',{class:'arrival-trail',fill:t?.color||'#8c8b81','pointer-events':'none','aria-hidden':'true',opacity:0});
    g.append(p.trail);
   }
   if(chosen)g.append(el('circle',{r:p.r+7,class:'selection-orbit',fill:'none',stroke:'#54534a','stroke-width':1.15,'stroke-dasharray':'2 5'}));
   const relationInk=p.local?t:null;
   g.append(el('circle',{r:p.r,class:'bubble',fill:chosen?'#22221b':relationInk?.fill||'#f0efe7',stroke:chosen?'#22221b':relationInk?.border||'#717066','stroke-width':chosen?1.15:.75}));
   const label=G.fitLabel(p.node.w,p.homeR,G.clamp(p.homeR*.43,8.5,p.local?(chosen?48:40):12),(word,size)=>{context.font=size+'px Georgia, serif';return context.measureText(word).width;}),size=label.fontSize,lines=label.lines;
   const text=el('text',{'text-anchor':'middle','font-size':size,fill:chosen?'#fff':relationInk?'#0a0a07':'#191915'});
   lines.forEach((line,i)=>text.append(el('tspan',{x:0,y:(i-(lines.length-1)/2)*(size+2)+size*.32},line)));g.append(text);p.label=text;p.circle=g.querySelector('.bubble');p.orbit=g.querySelector('.selection-orbit');
   g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(p.node);}});g.addEventListener('pointerdown',e=>start(e,p));
   g.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;hover=p.node.id;trace();if(!reduced){p.scaleV=.025;kick();}});
   g.addEventListener('pointerleave',()=>{if(hover===p.node.id)hover=null;trace();});
   g.addEventListener('focus',()=>{focusedId=p.node.id;hover=null;trace();});
   g.addEventListener('blur',()=>{if(focusedId===p.node.id)focusedId=null;trace();});
   p.el=g;p.ratingMark=null;syncProficiencyMark(p);(p.local?nextBubbles:contextWords).append(g);
   if(focusedWord===p.node.w||(chosen&&departures.has(model.byWord.get(focusedWord)?.id)))refocus=g;
  }
  $('bubbles').replaceChildren(nextBubbles);refocus?.focus?.({preventScroll:true});
  trace();
  if(reduced||reframe)constrain();dirty=true;kick();
 }
 function describeWord(control,node,relation='',chosen=false){
  const name=[node.w,node.en].filter(Boolean).join(': ')+(chosen?' — seçilmiş söz':'');
  control.setAttribute('aria-label',relation?name+' — '+relation:name);
  control.querySelector('title').textContent=relation||[node.w,[node.az,node.en].filter(Boolean).join(' / ')].filter(Boolean).join(' · ');
 }
 function placeProficiencyMark(p){
  const offset=p.r*.66;
  p.ratingMark.setAttribute('cx',offset);p.ratingMark.setAttribute('cy',-offset);
  p.ratingMark.setAttribute('r',G.clamp(p.r*.18,1.5,5));
 }
 function syncProficiencyMark(p){
  const level=wordRatings.get(p.node.w);
  if(level===undefined){p.ratingMark?.remove();p.ratingMark=null;return;}
  if(!p.ratingMark){
   p.ratingMark=el('circle',{class:'proficiency-mark','aria-hidden':'true','pointer-events':'none'});
   p.el.append(p.ratingMark);
  }
  p.ratingMark.setAttribute('data-rating',level);placeProficiencyMark(p);
 }
 function setWordRatings(ratings){
  wordRatings=ratings;ratedPoints=[];
  for(const [word,level] of ratings){
   const point=atlas.byWord.get(word);
   if(point)ratedPoints.push({point,screen:allScreens.get(word),fill:proficiencyColours[level]});
  }
  for(const p of bodies)if(p.el)syncProficiencyMark(p);
  dirty=true;wake();
 }
 function drawRatings(){
  for(const {point,screen,fill} of ratedPoints){
   if(movingIds.has(point.node.id)||screen.occluded||!isVisible(screen,0))continue;
   const bubble=G.clamp(camera.zoom*36*(screen.depth||1),0,48),offset=bubble>9?bubble*.60:0;
   context.fillStyle=fill;context.beginPath();
   context.arc(screen.x+offset,screen.y-offset,G.clamp(bubble*.17,1.8,4.5),0,Math.PI*2);context.fill();
  }
 }
 function refreshText(){
  panel.refresh();
  for(const p of bodies)if(p.el)describeWord(p.el,p.node,p.relation,p.depth===0);
  for(const [word,control] of atlasControls)describeWord(control,atlas.byWord.get(word).node);
 }
 function renderAtlasControls(){
  // Canvas draws every word. These transparent controls add keyboard focus at
  // the identical coordinates, without a second visible bubble layer.
  if(view==='word')return;
  const candidates=projected.filter(v=>v.labelOpacity>.02&&isVisible(v.screen,0)).sort((a,b)=>Math.hypot(a.screen.x-width/2,a.screen.y-height/2)-Math.hypot(b.screen.x-width/2,b.screen.y-height/2)).slice(0,width<640?72:120),keep=new Set(candidates.map(v=>v.point.word));
  for(const [word,g]of atlasControls)if(!keep.has(word)){g.remove();atlasControls.delete(word);}
  for(const v of candidates){const {point,screen,r}=v;let g=atlasControls.get(point.word);
   if(!g){g=el('g',{class:'word-node atlas-word',tabindex:'0',role:'button','data-word':point.word,'data-type':'nearby'});g.append(el('circle',{class:'atlas-hit',fill:'transparent'}),el('title'));describeWord(g,point.node);g.addEventListener('pointerdown',e=>start(e,null,point));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(point.node);}});atlasControls.set(point.word,g);$('bubbles').append(g);}
   g.setAttribute('transform',`translate(${screen.x} ${screen.y})`);g.firstElementChild.setAttribute('r',r);g.style.setProperty('--label-opacity',v.labelOpacity);
  }
 }
 const sky=root.AtlasSky.create(atlas,()=>{dirty=true;wake();});
 let atlasLanes=[], atlasConnectionMode='word';
 const routePulse=el('g',{id:'atlas-route-pulse','aria-hidden':'true','pointer-events':'none'});
 $('viewport').prepend(routePulse);
 let pulsePair=null,pulsePlayed=false;
 function clearRoutePulse(){if(routePulse.firstChild)routePulse.replaceChildren();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearRoutePulse();});
 routePulse.addEventListener('animationend',event=>{if(event.target.parentNode===routePulse)event.target.remove();});
 function updateRoutePulse(){
  const from=selectedLane&&Math.min(selectedLane.from,selectedLane.to),to=selectedLane&&Math.max(selectedLane.from,selectedLane.to);
  const pair=selectedLane&&panel.isOpen()?from+'-'+to:null;
  if(pair!==pulsePair){clearRoutePulse();pulsePair=pair;pulsePlayed=false;}
  if(!pair)return;
  if(reduced||paused||pageHidden||document.hidden||navigationLocked||view==='word'){
   clearRoutePulse();pulsePlayed=true;return;
  }
  if(pulsePlayed&&!routePulse.firstChild)return;
  const lane=atlasLanes.find(({route})=>route.from===from&&route.to===to);
  if(!lane){clearRoutePulse();return;}
  // Reprojection updates the path of the two existing lights without restarting their travel.
  const curve=`path("M${lane.x1} ${lane.y1} Q${lane.cx} ${lane.cy} ${lane.x2} ${lane.y2}")`;
  if(routePulse.style.getPropertyValue('--route-curve')!==curve)routePulse.style.setProperty('--route-curve',curve);
  if(!pulsePlayed){
   routePulse.append(el('circle',{r:2.1}),el('circle',{r:2.1,class:'return-pulse'}));pulsePlayed=true;
  }
 }
 function drawBackground(){
  dirty=false;
  if(!sceneReady)projectScene();
  context.clearRect(0,0,width,height);
  const project=G.transform(camera,width,height);
  // Fly through the same regional routes seen in the overview. Individual
  // word connections resolve as the camera approaches their neighborhood.
  const closeUp=view==='word'&&!selectionTravel;
  const laneOpacity=closeUp?0:G.clamp((.075-camera.zoom)/.026,0,1);
  const lineOpacity=1-laneOpacity;
  atlasConnectionMode=laneOpacity===1?'region':laneOpacity===0?'word':'transition';
  sky.drawClouds(context,project,width,height,camera.zoom);
  atlasLanes=root.AtlasSky.drawLanes(context,atlas,project,routeLanes,selectedLane,width,height,laneOpacity);
  updateRoutePulse();
  atlasLines=[];
  let webOpacity=lineOpacity;
  if(selectionTravel){
   // The distant connections recede as the camera enters the star field.
   const t=G.clamp((clock-selectionTravel.start)/selectionTravel.duration,0,1);
   const fade=G.clamp(Math.max(1-t/.16,(t-.82)/.18),0,1);
   webOpacity*=fade*fade*(3-2*fade);
  }
  if(webOpacity>0){
   atlasLines=connectionView.group(filters,movingIds).visible(width,height);
   context.globalAlpha=webOpacity*(view==='word' ? .036 : .25)*G.clamp(Math.sqrt(3000/Math.max(atlasLines.length,1)),.18,1);
   context.lineWidth=.75;context.strokeStyle='#bcbdb7';context.beginPath();
   for(const {a,b} of atlasLines){context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);}
   context.stroke();
  }
  context.globalAlpha=1;
  const wordFlight=reduced||paused||pageHidden||document.hidden?null:selectionTravel;
  sky.drawStars(context,projected,width,height,camera.zoom,movingIds,project,wordFlight,clock);
  drawRatings();
  sky.drawFlightTrails(context,projected,project,particles[0],width,height,wordFlight,clock);
  hitDots=movingIds.size?projected.filter(v=>!movingIds.has(v.point.node.id)):projected;
  if(view==='word'){if(labels.firstChild)labels.replaceChildren();}else {renderLabels(project);renderAtlasControls();}
 }
 // Keep the same focusable element while its region, camera and callout move.
 const areaLabels=new Map();
 const labelObstacles=['.app-bar','.atlas-intro','.daily-entry','.map-tools','#mapTouchHint','.map-legend','#atlasRoutesPanel'].map(selector=>document.querySelector(selector));
 function areaLabel(area,kind){
  if(areaLabels.has(area))return areaLabels.get(area);
  const button=document.createElement('button'),title=document.createElement('span'),count=document.createElement('small'),leader=document.createElement('i');
  button.type='button';button.className='atlas-label '+kind+'-label';button.dataset[kind]=area.id;
  title.className='area-name';title.textContent=area.label;count.textContent=countFormat.format(area.count)+' söz';
  leader.className='atlas-leader';leader.setAttribute('aria-hidden','true');
  button.setAttribute('aria-label',area.label+' — '+count.textContent+', yaxınlaş');button.append(title,count,leader);
  button.addEventListener('pointerdown',event=>start(event,null,null,{area,kind}));
  button.onclick=event=>{if(!event.detail)visitArea(area,kind);};
  const widths=(kind==='region'?[17,21]:[14,17]).map(fontSize=>{
   context.font=(kind==='region'?'italic ':'')+fontSize+'px Georgia, serif';const nameWidth=context.measureText(area.label).width;
   context.font='10px system-ui, sans-serif';const countWidth=context.measureText(count.textContent).width;
   return Math.ceil(Math.max(nameWidth,countWidth+8)+14);
  });
  const label={button,leader,widths};areaLabels.set(area,label);return label;
 }
 function renderLabels(project){
  const fade=1-G.clamp((camera.zoom-.18)/.22,0,1),compact=width<=640;
  const margin=compact?7:12,gap=compact?4:9;
  const occupied=[];
  for(const element of labelObstacles){
   if(!element||element.hidden)continue;
   const r=element.getBoundingClientRect();
   if(r.width>0&&r.height>0&&(r.width<width-1||r.height<height-1))occupied.push({x:r.left,y:r.top,w:r.width,h:r.height});
  }
  const candidates=[];
  function add(area,kind,priority){
   const screen=project(area),size=area.radius*camera.zoom;
   if(screen.x<0||screen.x>width||screen.y<0||screen.y>height||size>Math.max(width,height)*.8)return;
   if(kind==='cluster'&&(size<36||camera.zoom<.015))return;
   if(kind==='region'&&size<8)return;
   candidates.push({area,kind,screen,size,priority});
  }
  if(fade>0){
   for(const area of atlas.regions)add(area,'region',selectedLane&&(selectedLane.from===area.index||selectedLane.to===area.index)?0:1);
   for(const area of atlas.clusters)add(area,'cluster',2);
  }
  candidates.sort((a,b)=>a.priority-b.priority||b.area.count-a.area.count);
  const visible=new Set();
  for(const {area,kind,screen,size,priority} of candidates){
   const {button,leader,widths}=areaLabel(area,kind),w=widths[compact?0:1],h=kind==='region'?(compact?44:50):41;
   const angle=Math.atan2(screen.y-height/2,screen.x-width/2);
   const offset=G.clamp(size*.52,compact?8:18,compact?48:92);
   let best,lowest=Infinity;
   // Score placements around the projected centre. Prefer a short outward leader
   // and a clear view of nearby centres, including those whose label comes later.
   for(const spread of [1,.4,1.6])for(const turn of [0,.64,-.64,1.25,-1.25,1.9,-1.9,Math.PI]){
    const cos=Math.cos(angle+turn),sin=Math.sin(angle+turn);
    const x=G.clamp(screen.x+cos*(w/2+offset*spread)-w/2,margin,width-margin-w);
    const y=G.clamp(screen.y+sin*(h/2+offset*spread)-h/2,margin,height-margin-h);
    if(occupied.some(r=>x<r.x+r.w+gap&&x+w>r.x-gap&&y<r.y+r.h+gap&&y+h>r.y-gap))continue;
    const d=Math.hypot(x+w/2-screen.x,y+h/2-screen.y);
    let score=Math.abs(turn)*6+Math.abs(spread-1)*7+d*.06;
    for(const neighbor of candidates){
     if(neighbor.kind!=='region')continue;
     const p=neighbor.screen,clear=Math.hypot(Math.max(x-p.x,0,p.x-x-w),Math.max(y-p.y,0,p.y-y-h));
     score+=Math.max(0,Math.min(neighbor.size*.27,compact?14:32)-clear)*(neighbor.area===area?1.25:.65);
    }
    if(score<lowest){lowest=score;best={x,y,w,h};}
   }
   if(!best)continue;
   const {x,y}=best,cx=x+w/2,cy=y+h/2,dx=screen.x-cx,dy=screen.y-cy,d=Math.hypot(dx,dy);
   const ux=dx/(d||1),uy=dy/(d||1),boundary=Math.min(w/(Math.abs(ux)*2||.001),h/(Math.abs(uy)*2||.001));
   button.style.width=w+'px';button.style.height=h+'px';button.style.left=cx+'px';button.style.top=cy+'px';button.style.opacity=fade;
   button.classList.toggle('is-route-end',priority===0);leader.hidden=d<=boundary+4;
   if(!leader.hidden){
    leader.style.left=(w/2+ux*(boundary+1)-2)+'px';leader.style.top=(h/2+uy*(boundary+1)-1)+'px';
    leader.style.width=(d-boundary-1)+'px';leader.style.transform='rotate('+Math.atan2(dy,dx)+'rad)';
   }
   if(button.parentNode!==labels)labels.append(button);occupied.push(best);visible.add(button);
   if(visible.size>=(compact?10:16))break;
  }
  for(const button of [...labels.children])if(!visible.has(button))button.remove();
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
 function fitHeldStars(){
  // Hundreds of distant atlas marks can fit into a few overview pixels.
  // Use their actual spacing until launch, just as the atlas does at zoom.
  if(particles.length<=48)return;
  const stars=particles.filter(p=>p.waiting).sort((a,b)=>a.x-b.x);
  let reach=0;
  for(const p of stars){p.spacing2=Infinity;reach=Math.max(reach,p.heldGlyphRadius*2.7);}
  for(let i=0;i<stars.length;i++){
   const p=stars[i];
   for(let j=i+1;j<stars.length;j++){
    const q=stars[j],dx=q.x-p.x;if(dx>reach)break;
    const dy=q.y-p.y,d2=dx*dx+dy*dy;
    if(d2<p.spacing2)p.spacing2=d2;
    if(d2<q.spacing2)q.spacing2=d2;
   }
  }
  for(const p of stars){
   p.r=Math.max(.00001,Math.min(p.heldGlyphRadius,Math.sqrt(p.spacing2)*.375));
   p.skin=Math.min(2,p.r*.12);p.contactGap=Math.min(3,p.r*.15);
  }
 }
 function drawnBack(p,origin,amount=1){
  // Hoist nearby source stars toward the edge of the visible stage on their
  // own atlas ray. The camera reveals that outward movement before release.
  if(!p.centerApproach||amount<=0)return origin;
  const center=focusLayout.center,bounds=focusLayout.bounds;
  let dx=origin.x-center.x,dy=origin.y-center.y,distance=Math.hypot(dx,dy);
  if(distance<.0001){dx=p.homeX-center.x;dy=p.homeY-center.y;distance=Math.hypot(dx,dy)||1;}
  const ux=dx/distance,uy=dy/distance,margin=Math.min(22,p.homeR*.6);
  const side=ux>0?(width-margin-center.x)/ux:ux<0?(margin-center.x)/ux:Infinity;
  const end=uy>0?(bounds.bottom-margin-center.y)/uy:uy<0?(bounds.top+margin-center.y)/uy:Infinity;
  const lift=Math.max(0,Math.min(side,end)-Math.hypot(origin.x-center.x,origin.y-center.y))*amount;
  return {x:origin.x+ux*lift,y:origin.y+uy*lift};
 }
 function stageArrival(p,time,rank,count){
  const wound=drawnBack(p,p),lift=Math.hypot(wound.x-p.x,wound.y-p.y);
  p.holdX=p.x;p.holdY=p.y;p.drawX=wound.x;p.drawY=wound.y;p.waitElapsed=0;p.waitFrame=time;
  // Give the first words individually visible beats. The rest follow in a
  // bounded wave, even when a hub has hundreds of documented connections.
  const solo=Math.min(6,rank)*145;
  const group=Math.max(0,rank-6)/Math.max(1,count-7)*Math.min(1000,Math.max(0,count-7)*48);
  p.releaseDelay=80+Math.min(270,lift*1.5)+solo+group;p.releaseAt=time+p.releaseDelay;
 }
 function releaseArrival(p){
  const center=focusLayout.center,dx=p.x-center.x,dy=p.y-center.y,range=Math.hypot(dx,dy)||1;
  const rx=p.homeX-center.x,ry=p.homeY-center.y,orbit=Math.hypot(rx,ry)||1;
  // Foreground words head for the selected bubble itself. The outer rings
  // of a large hub skim inward near their own slots to keep its centre open.
  const inset=Math.min(p.homeR*1.2,orbit*.25);
  p.tx=p.centerApproach?center.x+dx/range*center.r*.45:p.homeX-rx/orbit*inset;
  p.ty=p.centerApproach?center.y+dy/range*center.r*.45:p.homeY-ry/orbit*inset;
  const distance=Math.max(1,Math.hypot(p.x-p.tx,p.y-p.ty));
  p.waiting=false;p.originWorld=null;p.heldRadius=null;
  p.launch={distance,radius:p.r,steps:0,returning:false,tailX:p.x,tailY:p.y,bendX:p.x,bendY:p.y};
  p.spring=.038;p.damping=.87;
  p.maxSpeed=p.centerApproach?G.clamp(distance/36,5.8,24):G.clamp(distance/24,12,46);
  const impulse=p.maxSpeed*.35/distance;
  p.vx=(p.tx-p.x)*impulse;p.vy=(p.ty-p.y)*impulse;
 }
 function updateArrival(p){
  const launch=p.launch,center=focusLayout.center;launch.steps++;
  if(!launch.returning){
   const remaining=Math.hypot(p.x-p.tx,p.y-p.ty);
   p.reveal=Math.max(p.reveal,G.clamp(1-remaining/launch.distance,0,1));
   const radial=Math.hypot(p.x-center.x,p.y-center.y);
   const contact=P.radius(particles[0])+P.radius(p)+Math.min(3,p.contactGap)+3;
   const hit=p.centerApproach?radial<=contact:remaining<p.homeR*.55;
   // A previously landed neighbor can intercept the approach to the centre.
   // It produces the same rebound as a direct contact, with a finite deadline.
   if(!hit&&launch.steps<=launch.distance/p.maxSpeed+18)return;
   launch.returning=true;launch.impact=launch.steps;
   p.spring=.066;p.damping=.79;p.tx=p.homeX;p.ty=p.homeY;
   if(p.centerApproach){
    const angle=Math.atan2(p.y-center.y,p.x-center.x),homeAngle=Math.atan2(p.homeY-center.y,p.homeX-center.x);
    launch.angle=angle;launch.turn=Math.atan2(Math.sin(homeAngle-angle),Math.cos(homeAngle-angle));
    launch.contact=radial;launch.orbit=Math.hypot(p.homeX-center.x,p.homeY-center.y);
    const kick=G.clamp(p.homeR*.24,4,9);
    p.vx=p.vx*.18+Math.cos(angle)*kick;p.vy=p.vy*.18+Math.sin(angle)*kick;
   }
  }
  const age=launch.steps-launch.impact;
  if(p.centerApproach){
   // Expand away from the contact and arc into the assigned slot. This also
   // gives words whose slots are behind the selection a path around the rim.
   const span=19+Math.abs(launch.turn)*6,t=Math.min(1,age/span);
   const turn=t*t*(3-2*t),angle=launch.angle+launch.turn*turn;
   const radius=launch.contact+(launch.orbit-launch.contact)*(1-(1-t)**2)+p.homeR*.95*Math.sin(Math.PI*t);
   p.tx=center.x+radius*Math.cos(angle);p.ty=center.y+radius*Math.sin(angle);
   if(t===1){p.tx=p.homeX;p.ty=p.homeY;}
  }
  p.reveal+=(1-p.reveal)*.13;
  if(age>42&&p.reveal>.996){p.reveal=1;p.tx=p.homeX;p.ty=p.homeY;p.launch=null;p.maxSpeed=24;}
 }
 function renderArrivalTrail(p,dt){
  const launch=p.launch;
  if(!launch||reduced||settled){if(p.trail.hasAttribute('d'))p.trail.removeAttribute('d');return;}
  const dx=launch.tailX-p.x,dy=launch.tailY-p.y,length=Math.hypot(dx,dy);
  // Two real position histories let the ribbon curve through the rebound.
  const bx=launch.bendX-p.x,by=launch.bendY-p.y;
  const follow=1-Math.exp(-dt/145),bend=1-Math.exp(-dt/58);
  launch.tailX-=dx*follow;launch.tailY-=dy*follow;launch.bendX-=bx*bend;launch.bendY-=by*bend;
  const behind=length-p.r*.65;
  if(behind<4){p.trail.removeAttribute('d');return;}
  const reach=Math.min(144,length),x=dx/length,y=dy/length,w=Math.min(6,p.r*.27);
  const sx=x*p.r*.56,sy=y*p.r*.56;
  p.trail.setAttribute('d',`M${sx-y*w},${sy+x*w} Q${bx-y*w},${by+x*w} ${x*reach},${y*reach} Q${bx+y*w},${by-x*w} ${sx+y*w},${sy-x*w} Z`);
  p.trail.setAttribute('opacity',Math.min(.72,behind/46));
 }
 function finishLandingStep(){
  if(selectionTravel||drag||particles.some(p=>p.waiting)){landingSteps=0;landingFrom=null;return;}
  // Count simulated spring steps. A slow display must still show each launch
  // and rebound before a crowded ring finishes easing into its clear slots.
  if(++landingSteps<96)return;
  if(!landingFrom)landingFrom=particles.map(p=>({x:p.x,y:p.y,r:p.r,scale:p.scale,reveal:p.reveal}));
  const t=Math.min(1,(landingSteps-96)/36),ease=t*t*(3-2*t);
  particles.forEach((p,i)=>{
   const start=landingFrom[i];
   p.x=start.x+(p.homeX-start.x)*ease;p.y=start.y+(p.homeY-start.y)*ease;
   p.r=start.r+(p.homeR-start.r)*ease;p.scale=start.scale+(1-start.scale)*ease;
   p.reveal=start.reveal+(1-start.reveal)*ease;p.launch=null;p.tx=p.homeX;p.ty=p.homeY;
   p.skin=Math.min(2,p.r*.12);p.contactGap=Math.min(3,p.r*.15);
  });
 }
 function growRadii(){
  let sorted=null,maxRadius=0;
  for(const p of bodies){
   if(p.departure||p.local&&p.waiting||selectionTravel&&(!p.local||p===particles[0]))continue;
   if(p.local&&p.launch)updateArrival(p);
   let target=p.homeR;
   if(p.local&&p.launch){
    // Give the travelling word a readable silhouette during departure from
    // the rim, before it traverses the space between its origin and focus.
    let growth=Math.min(1,p.reveal*1.12+.78*Math.min(1,p.launch.steps/7));
    // In a huge family the outer rings land beyond the screen. These words
    // travel as small comets and grow near their own slots, leaving the
    // central approach clear for words that will actually settle in view.
    if(p.distantSlot){
     const proximity=G.clamp(1-Math.hypot(p.x-p.homeX,p.y-p.homeY)/(p.homeR*4),0,1);
     growth*=.13+.87*proximity*proximity;
    }
    target=p.launch.radius+(p.homeR-p.launch.radius)*growth;
   }
   let next=p.r+(target-p.r)*(p.launch&&p.centerApproach?.24:.13);if(Math.abs(target-next)<.005)next=target;
   // Local words take priority over backdrop stars in the contact solver.
   // Only another family circle can limit the growth of an incoming word.
   if(next>p.r&&p!==particles[0]){
    const factor=Math.max(1,p.scale)+.09;
    const reach=next*factor+Math.min(2,next*.12)+3.02;
    // Positions stay fixed through this growth pass. For a large family,
    // bound the search by x, then check the exact current radius of each
    // nearby circle, including those already grown earlier in this pass.
    if(bodies.length>=64&&!sorted){
     sorted=bodies.slice().sort((a,b)=>a.x-b.x);
     for(const q of sorted){
      q.growthRadius=P.radius(q);
      const largest=Math.max(q.r,q.homeR,q.launch?.radius||0);
      maxRadius=Math.max(maxRadius,largest*(Math.max(1,q.scale)+.09)+Math.max(2,q.skin||0));
     }
    }
    const nearby=sorted||(p.local?particles:bodies);
    let start=0;
    if(sorted){
     let end=nearby.length;
     while(start<end){const mid=(start+end)>>>1;if(nearby[mid].x<p.x-reach-maxRadius)start=mid+1;else end=mid;}
    }
    for(let i=start;i<nearby.length;i++){
     const q=nearby[i];
     if(sorted&&q.x>p.x+reach+maxRadius)break;
     if(q===p||p.local&&!q.local)continue;
     const dx=p.x-q.x,dy=p.y-q.y,other=sorted?q.growthRadius:P.radius(q),near=reach+other;
     if(Math.abs(dx)>near||Math.abs(dy)>near)continue;
     const room=Math.hypot(dx,dy)-other-Math.min(p.contactGap??3,q.contactGap??3)-.02;
     const limit=room<(factor+.12)*16.6667?room/(factor+.12):(room-2)/factor;
     next=Math.max(p.r,Math.min(next,limit));
     if(next===p.r)break;
    }
   }
   p.r=next;if(p.skin!==undefined){p.skin=Math.min(2,p.r*.12);p.contactGap=Math.min(3,p.r*.15);}
   if(sorted)p.growthRadius=P.radius(p);
  }
 }
 function advanceDepartures(dt){
  const steps=Math.min(3,Math.floor((accumulator+dt)/16.66));
  let removed=false;
  for(const p of surroundings){
   const d=p.departure;if(!d)continue;
   d.elapsed+=dt;
   const t=reduced?1:Math.min(1,d.elapsed/d.duration),blend=t*t*(3-2*t);
   if(steps){
    // Integrate the heading, not a target on the far side of the screen.
    // Even when the camera overtakes a word's home, its visible ray keeps
    // going out. The fading end of the trail curves toward its real address.
    const distance=d.reach*t*(1.06-.06*t),delta=distance-d.travelled;
    const home=allScreens.get(p.node.w),toHome=Math.atan2(home.y-p.y,home.x-p.x)-d.angle;
    const turn=G.clamp((t-.32)/.68,0,1);
    const angle=d.angle+G.clamp(Math.atan2(Math.sin(toHome),Math.cos(toHome)),-.38,.38)*turn*turn;
    const focus=particles[0];
    if(focus.node.id!==d.focusId)d.focusId=null;
    const follow=d.focusId===null?0:.58*(1-blend);
    p.vx=(Math.cos(angle)*delta+(focus.x-d.focusX)*follow)/steps;
    p.vy=(Math.sin(angle)*delta+(focus.y-d.focusY)*follow)/steps;
    p.tx=p.x+p.vx*steps;p.ty=p.y+p.vy*steps;
    d.travelled=distance;d.focusX=focus.x;d.focusY=focus.y;
   }
   p.r=d.r*(1-.93*blend);p.skin=Math.min(2,p.r*.12);p.contactGap=Math.min(3,p.r*.15);
   const fade=G.clamp((t-.10)/.90,0,1);
   d.opacity=(p.recoverOpacity??1)*(1-fade*fade*(3-2*fade));
   p.el.setAttribute('opacity',d.opacity);p.el.setAttribute('pointer-events',navigationLocked||d.opacity<=.25?'none':'auto');
   if(t===1){p.el.remove();movingIds.delete(p.node.id);removed=true;}
  }
  if(!removed)return;
  surroundings=surroundings.filter(p=>movingIds.has(p.node.id));bodies=bodies.filter(p=>movingIds.has(p.node.id));
  // A remaining moving-to-static connection ends at the atlas point again.
  // Static-to-static paths return to the single canvas pass.
  links=links.filter(e=>{
   if(!movingIds.has(e.a.node.id)&&!movingIds.has(e.b.node.id)){e.el.remove();return false;}
   if(e.a.departure&&!movingIds.has(e.a.node.id))e.a={...allScreens.get(e.a.node.w),node:e.a.node,vx:0,vy:0};
   if(e.b.departure&&!movingIds.has(e.b.node.id))e.b={...allScreens.get(e.b.node.w),node:e.b.node,vx:0,vy:0};
   return true;
  });
  dirty=true;
 }
 function paintDepartureTrails(dt){
  const follow=1-Math.exp(-dt/110);
  for(const p of surroundings){
   const d=p.departure;if(!d)continue;
   const dx=(d.tailX-p.x)/p.scale,dy=(d.tailY-p.y)/p.scale,distance=Math.hypot(dx,dy);
   const x=dx/(distance||1),y=dy/(distance||1);
   if(d.opacity>.25){
    // Accept a finger landing on the last painted frame, including a bend
    // around another word. Bound the catch area to the short, visible streak.
    let ink='M0,0 l0,.01',left=d.trail?Math.min(58,distance*1.35):14,from=p;
    for(const old of d.hitHistory){
     const sx=(old.x-from.x)/p.scale,sy=(old.y-from.y)/p.scale,length=Math.hypot(sx,sy);
     if(length>.01){
      const fraction=Math.min(1,left/length);
      ink+=` l${sx*fraction},${sy*fraction}`;left-=length*fraction;
      if(left<=.01)break;
     }
     from=old;
    }
    d.hit.setAttribute('d',ink);
    d.hit.setAttribute('stroke-width',Math.max(44/p.scale,p.r*2));
    if(dt>0||!d.hitHistory.length){
     d.hitHistory.unshift({x:p.x,y:p.y});if(d.hitHistory.length>4)d.hitHistory.pop();
    }
   }
   if(d.trail){
    const length=Math.min(distance*1.35,91),wide=Math.min(8,p.r*.29);
    if(length>2){
     const base=p.r*.7,tip=p.r+length;
     d.trail.setAttribute('d',`M${x*base-y*wide},${y*base+x*wide} Q${x*p.r-y*wide*.58},${y*p.r+x*wide*.58} ${x*tip},${y*tip} Q${x*p.r+y*wide*.58},${y*p.r-x*wide*.58} ${x*base+y*wide},${y*base-x*wide} Z`);
    }else d.trail.removeAttribute('d');
   }
   d.tailX+=(p.x-d.tailX)*follow;d.tailY+=(p.y-d.tailY)*follow;
  }
 }
 function smoothPhase(value){const t=G.clamp(value,0,1);return t*t*(3-2*t);}
 function renderFlightLayers(dt){
  let backdrop=1,card=1;
  if(selectionTravel&&!reduced){
   const t=G.clamp((clock-selectionTravel.start)/selectionTravel.duration,0,1);
   // The word, its travelling relatives and their strokes stay in front.
   // The rest of the map recedes, then reappears behind the landing family.
   backdrop=1-.97*smoothPhase(t/.22)+.17*smoothPhase((t-.74)/.26);
   card=smoothPhase((t-.56)/.39);
   arrivalLight=0;
  }else if(arrivalLight<1){
   arrivalLight=reduced||settled||view!=='word'?1:Math.min(1,arrivalLight+dt/850);
   backdrop=.20+.80*smoothPhase((arrivalLight-.14)/.86);
  }
  const alpha=backdrop.toFixed(3);
  if(contextWords.getAttribute('opacity')!==alpha){
   contextWords.setAttribute('opacity',alpha);contextLinks.setAttribute('opacity',alpha);
  }
  // Reserve the card's space so the flight lands accurately. Its contents
  // are already available to assistive technology and appear on approach.
  if(card<1){
   wordCard.classList.add('flight-arrival');
   wordCard.classList.toggle('waiting-for-flight',card<.15);
   wordCard.style.setProperty('--card-reveal',card.toFixed(3));
   wordCard.style.setProperty('--card-rise',((1-card)*10).toFixed(2)+'px');
  }else if(wordCard.classList.contains('flight-arrival')){
   wordCard.classList.remove('flight-arrival','waiting-for-flight');
   wordCard.style.removeProperty('--card-reveal');wordCard.style.removeProperty('--card-rise');
  }
 }
 function renderBubbles(dt){
  renderFlightLayers(dt);
  if(!bodies.length)return;
  advanceDepartures(dt);
  for(const p of particles)if(p.recoverOpacity<1){p.recoverOpacity=Math.min(1,p.recoverOpacity+dt/150);p.el.setAttribute('opacity',p.recoverOpacity);}
  const chosen=particles[0];
  if(!reduced&&!settled){
   for(const p of particles)if(p.waiting&&Number.isFinite(p.releaseAt)){
    // Count the time actually presented. A dropped phone frame cannot skip
    // all the release beats, even after the browser has paused for a second.
    p.waitElapsed+=Math.max(0,Math.min(dt,clock-p.waitFrame));p.waitFrame=clock;
    const left=p.releaseDelay-p.waitElapsed;p.releaseAt=clock+Math.max(0,left);
    if(left<=0){releaseArrival(p);continue;}
    const t=G.clamp(p.waitElapsed/Math.min(p.releaseDelay,260),0,1);
    const draw=t*t*(3-2*t),cx=focusLayout.center.x,cy=focusLayout.center.y;
    const dx=p.drawX-cx,dy=p.drawY-cy,distance=Math.hypot(dx,dy)||1;
    const tension=G.clamp(1-left/110,0,1)*Math.min(13,distance*.08);
    p.tx=p.holdX+(p.drawX-p.holdX)*draw+dx/distance*tension;
    p.ty=p.holdY+(p.drawY-p.holdY)*draw+dy/distance*tension;p.spring=.22;
   }
   accumulator+=dt;let steps=0,energy=0;while(accumulator>=16.66&&steps++<3){
   if(chosen&&!selectionTravel&&chosen!==drag?.particle){
    chosen.vx=G.clamp((chosen.vx+(chosen.homeX-chosen.x)*.075)*.78,-26,26);chosen.vy=G.clamp((chosen.vy+(chosen.homeY-chosen.y)*.075)*.78,-26,26);chosen.x+=chosen.vx;chosen.y+=chosen.vy;
    if(Math.hypot(chosen.homeX-chosen.x,chosen.homeY-chosen.y)<.01&&Math.hypot(chosen.vx,chosen.vy)<.01){chosen.x=chosen.homeX;chosen.y=chosen.homeY;chosen.vx=chosen.vy=0;}
   }
   const centerMotion=chosen?Math.abs(chosen.vx)+Math.abs(chosen.vy):0,centerVelocity=chosen?{x:chosen.vx,y:chosen.vy}:null;
   // Stillness counts only the selection's own motion (averaged over every body, as before): two background words
   // whose map spots sit closer than their circles can nudge each other indefinitely, and they freeze with everything
   // else once the selection rests.
   const bx=particles.map(p=>p.x),by=particles.map(p=>p.y);P.step(bodies,[],anchor());energy=particles.reduce((e,p,i)=>e+Math.abs(p.x-bx[i])+Math.abs(p.y-by[i])+Math.abs(p.scaleV||0)*30,0)+centerMotion;growRadii();finishLandingStep();if(chosen&&chosen!==drag?.particle){chosen.vx=centerVelocity.x;chosen.vy=centerVelocity.y;}accumulator-=16.66;
  }constrain();
   if(steps&&!drag){
    const atHome=particles.every(p=>!p.waiting&&Math.abs(p.homeR-p.r)<.01&&Math.hypot(p.x-p.homeX,p.y-p.homeY)<.30);
    if(energy/Math.max(1,bodies.length)<.025&&atHome&&landingSteps>24)idleFrames++;else idleFrames=0;
    if(!selectionTravel&&(idleFrames>=20||landingSteps>=132)){
     settled=true;landingFrom=null;
     for(const p of particles){p.x=p.homeX;p.y=p.homeY;p.r=p.homeR;p.reveal=1;p.launch=null;p.skin=Math.min(2,p.r*.12);p.contactGap=Math.min(3,p.r*.15);}
     for(const p of bodies){p.vx=p.vy=p.scaleV=0;p.scale=1;}
     constrain();
    }
   }
  }
  const denseMotion=!settled&&!reduced&&particles.length>=96;
  for(const p of bodies){
   // In a large family most travelling bubbles can be several screens away.
   // Keep simulating them and paint them again before even a trail can enter.
   const pad=p.r*1.35+85;
   const offscreen=(p.behindCamera||denseMotion&&(p.x< -pad||p.x>width+pad||p.y< -pad||p.y>height+pad))&&p.el!==document.activeElement;
   if(offscreen!==!!p.paintHidden){p.el.style.display=offscreen?'none':'';p.paintHidden=offscreen;}
   if(offscreen)continue;
   p.el.setAttribute('transform',`translate(${p.x.toFixed(3)} ${p.y.toFixed(3)}) scale(${p.scale.toFixed(3)})`);
   p.circle.setAttribute('r',p.r);
   if(p.ratingMark)placeProficiencyMark(p);
   if(p.orbit){p.orbit.setAttribute('r',p.r+7);p.orbit.setAttribute('opacity',G.clamp(p.r/18,0,1));}
   p.label.setAttribute('transform','scale('+p.r/p.homeR+')');
   p.label.setAttribute('opacity',p.depth===0?G.clamp((p.r-2)/10,0,1):G.clamp((p.r-6)/10,0,1));
  }
  for(const p of particles)if(p.trail)renderArrivalTrail(p,dt);
  paintDepartureTrails(dt);
  // At a hub, hundreds of routes may leave the viewport together. Keep the
  // path to each visible word clear, with fine spokes to the outer rings.
  const farInk=particles.length>=96?22/particles.length:1;
  for(const e of links){
   if(e.highlighted){
    const peer=e.a===chosen?e.b:e.a,reveal=peer.reveal??1;
    const beyond=Math.max(0,-peer.x,peer.x-width,-peer.y,peer.y-height)-peer.r;
    const ink=farInk===1?1:Math.round((1-(1-farInk)*G.clamp(beyond/90,0,1))*100)/100;
    if(e.ink!==ink){
     if(ink===1)e.el.style.removeProperty('--far-opacity');else e.el.style.setProperty('--far-opacity',ink);
     e.ink=ink;
    }
    if(reveal!==e.lastReveal){
     if(reveal===1)e.el.style.removeProperty('--arrival');else e.el.style.setProperty('--arrival',reveal.toFixed(3));
     e.lastReveal=reveal;
    }
   }
   const staged=denseMotion&&(e.a.waiting||e.b.waiting);
   const visible=!staged&&!e.a.behindCamera&&!e.b.behindCamera&&!e.a.occluded&&!e.b.occluded&&G.crossesViewport(e.a,e.b,width,height,30);
   if(visible!==e.painted){e.el.style.display=visible?'':'none';e.painted=visible;}
   if(denseMotion&&!visible){
    // A dormant link still has its real, moving endpoints. It gains its
    // spring bend on the frame it comes into view.
    if(e.hiddenX1!==e.a.x||e.hiddenY1!==e.a.y||e.hiddenX2!==e.b.x||e.hiddenY2!==e.b.y){
     e.el.setAttribute('d',`M${e.a.x},${e.a.y} Q${e.a.x},${e.a.y} ${e.b.x},${e.b.y}`);
     e.hiddenX1=e.a.x;e.hiddenY1=e.a.y;e.hiddenX2=e.b.x;e.hiddenY2=e.b.y;
    }
    continue;
   }
   e.hiddenX1=undefined;
   const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,d=Math.hypot(dx,dy)||1,age=clock-motionStarted;
   const shake=settled||reduced?0:Math.sin(age*.024+e.id*.6)*9*Math.exp(-age/270);
   const velocity=settled?0:G.clamp(((e.b.vx-e.a.vx)*(-dy)+(e.b.vy-e.a.vy)*dx)/d*.65,-15,15),bow=(e.parallelBend??(e.id%3-1)*3)+shake+velocity;
   e.el.setAttribute('d',`M${e.a.x},${e.a.y} Q${(e.a.x+e.b.x)/2-dy/d*bow},${(e.a.y+e.b.y)/2+dx/d*bow} ${e.b.x},${e.b.y}`);
  }
 }
 function canOrbit(){return !navigationLocked&&view!=='word';}
 function syncOrbit(){
  const available=canOrbit();
  if(!available)orbitMode=false;
  const nextState=available?(orbitMode?'active':'ready'):'hidden';
  if(!orbitToggle||nextState===lastOrbitState)return;
  lastOrbitState=nextState;orbitToggle.hidden=!available;
  orbitToggle.setAttribute('aria-pressed',String(orbitMode));
  orbitToggle.setAttribute('aria-label','Xəritəni fırlat');
  orbitToggle.title=orbitMode?'Sürükləyin və ya ox düymələri ilə xəritəni döndərin':'Xəritəni fırlat';
  if(orbitMode)orbitToggle.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown Home');
  else orbitToggle.removeAttribute('aria-keyshortcuts');
  map.classList.toggle('is-orbiting',orbitMode);
 }
 orbitToggle?.addEventListener('click',()=>{if(canOrbit()){cancelGestures();orbitMode=!orbitMode;updateHud();}});
 function updateHud(){
  syncOrbit();
  $('zoomLabel').textContent=zoomFormat.format(view==='word'?detailScale:camera.zoom/G.overview(atlas,width,height).zoom)+'×';
  graph.setAttribute('aria-label',view==='word'?'Seçilmiş söz və əlaqələri':orbitMode?'Söz kainatı. Ox düymələri xəritəni döndərir.':'Söz kainatı');
  map.classList.toggle('is-travelling',!!flight);map.classList.toggle('is-gathered',view==='word');
 }
 function releasePending(){
  const now=root.performance?.now?.()??clock,pending=particles.filter(p=>p.waiting&&!Number.isFinite(p.releaseAt));
  pending.forEach((p,i)=>stageArrival(p,now,i,pending.length));
 }
 function interruptWordFlight(){
  if(!selectionTravel)return;
  camera=G.closeFlightLens(camera,selectionTravel.anchor,particles[0],width,height);
  selectionTravel=null;sceneReady=false;dirty=true;
 }
 function advanceSelection(time){
  if(!selectionTravel)return;
  const travel=selectionTravel,t=G.clamp((time-travel.start)/travel.duration,0,1),before=G.transform(camera,width,height);
  const oldCamera=camera,next=G.sampleWordFlight(travel,t,width,height);camera=next.camera;travel.anchor=next.anchor;
  const after=G.transform(camera,width,height);
  for(const p of bodies){
   if(p.departure)continue;
   const projected=after(p.point);p.anchorX=projected.x;p.anchorY=projected.y;
   if(p===particles[0])continue;
   if(p.local){
    p.arrived=false;
    // Carried neighbors are already free of the sky and glide to their new slots.
    if(!p.waiting)continue;
    const origin=p.originWorld===p.point?projected:after(p.originWorld);
    const source=C.arrival(origin,p,focusLayout.center,focusLayout.bounds,p.homeR,{width,height},p.edgeOffset);
    const unwind=G.clamp((t-.52)/.44,0,1);
    const entry=drawnBack(p,source,unwind*unwind*(3-2*unwind));
    p.x=p.tx=p.holdX=entry.x;p.y=p.ty=p.holdY=entry.y;p.vx=p.vy=0;
    p.heldGlyphRadius=Math.min(p.heldRadius,p.heldGlyphRadius*camera.zoom/oldCamera.zoom);
    p.r=p.heldGlyphRadius;
   }else{
    // Carry a backdrop glyph through the same world coordinates throughout
    // the trip. Re-unprojecting a collision offset near the eye can send it
    // hundreds of pixels across the family between two frames.
    if(!p.skyAnchor){
     p.skyAnchor=G.unproject(p,oldCamera,width,height,p.point.z,p.point);
     p.worldRadius=p.r/(oldCamera.zoom*before(p.skyAnchor).depth);
    }
    const b=after(p.skyAnchor);
    p.behindCamera=b.occluded;
    p.x=p.tx=p.homeX=b.x;p.y=p.ty=p.homeY=b.y;p.vx=p.vy=0;
    p.r=p.behindCamera ? .001 : G.clamp(p.worldRadius*camera.zoom*b.depth,.05,48);
    p.skin=Math.min(2,p.r*.12);p.contactGap=Math.min(3,p.r*.15);
   }
   if(p.skin!==undefined){p.skin=Math.min(2,p.r*.12);p.contactGap=Math.min(3,p.r*.15);}
  }
  const chosen=particles[0],screen=after(travel.anchor);if(chosen){chosen.x=screen.x;chosen.y=screen.y;chosen.r=next.radius;chosen.vx=chosen.vy=0;}
  // A timed race needs a reachable next move when the starting word lands.
  // Let its first neighbor fly in alongside the camera on the final approach.
  if(navigationLocked&&t>=.56&&!travel.raceApproach){
   travel.raceApproach=true;
   const first=particles.find(p=>p.waiting&&!p.distantSlot);
   if(first)releaseArrival(first);
  }
  fitHeldStars();
  sceneReady=false;projectScene();for(const e of links)for(const end of [e.a,e.b])if(!movingIds.has(end.node.id))Object.assign(end,allScreens.get(end.node.w));dirty=true;
  if(t===1){releasePending();selectionTravel=null;focusCamera={...camera};needsRefresh=true;}
 }
 function tick(time){
  raf=0;if(document.hidden||paused||pinch?.preview)return;const now=Number.isFinite(time)?time:clock+16.67,dt=last?G.clamp(now-last,0,50):16.67;last=now;clock=now;
  if(selectionTravel){
   // A slow first paint or a dropped frame must not consume the whole flight.
   const previous=selectionTravel.lastFrame??selectionTravel.start;
   selectionTravel.start+=Math.max(0,now-previous-50);
   selectionTravel.lastFrame=Math.max(previous,now);
   advanceSelection(now);
  }
  if(flight){const next=G.sampleFlight(flight,now);camera={x:next.x,y:next.y,z:next.z||0,zoom:next.zoom,angle:next.angle,tilt:next.tilt,roll:next.roll||0};sceneReady=false;dirty=true;if(next.done){flight=null;needsRefresh=true;}}
  if(needsRefresh&&!selectionTravel&&(!drag||!drag.particle)&&(!flight||view==='word')&&(clock-lastRefresh>70||!particles.length))refresh();
  if(dirty)drawBackground();renderBubbles(dt);updateHud();
  if((flight||selectionTravel||(!reduced&&bodies.length&&!settled))&&!document.hidden&&!paused)raf=requestAnimationFrame(tick);
 }
 function wake(){if(!raf&&!document.hidden&&!paused)raf=requestAnimationFrame(tick);}
 function fly(to,kind){
  interruptWordFlight();flight=G.makeFlight(camera,to,width,height,root.performance?.now?.()??clock,reduced);view=kind;
  clearBubbles();focusLayout=null;$('connectionPager').hidden=true;$('connectionsPrevious').disabled=$('connectionsNext').disabled=true;map.classList.remove('has-connection-pages');sceneReady=false;dirty=true;onView?.(kind);
  if(reduced){camera={...to};sceneReady=false;flight=null;needsRefresh=true;refresh();drawBackground();renderBubbles(0);updateHud();}else wake();
 }
 function select(node,{initial=false}={}){
  panel.close();
  cancelGestures();selectionTravel=null;flight=null;detailScale=1;detailPan={x:0,y:0};hover=null;accumulator=0;
  selected=atlas.byWord.get(node.w);related.clear();for(const r of C.relationships(model.related(node,filters)))related.set(r.node.w,r);
  const cluster=atlas.clusters[selected.cluster],region=atlas.regions[selected.region];onLocation?.({region,cluster,word:node});
  if(initial){view='universe';onLocation?.({region:null,cluster:null,word:null});sceneReady=false;dirty=needsRefresh=true;refresh();drawBackground();renderBubbles(0);updateHud();return;}
  focusCamera={...camera};view='word';onView?.('word');measureWordStage();refresh(false,true);
  const trip=G.makeWordFlight(camera,selected,particles[0],focusLayout.center,width,height,root.performance?.now?.()??clock);
  if(reduced){camera=trip.to;sceneReady=false;refresh(true);}else selectionTravel=trip;
  drawBackground();renderBubbles(0);updateHud();wake();
 }
 function visitArea(a,kind){
  if(navigationLocked)return;
  cancelGestures();const target=G.area(a,width,height);
  if(kind==='cluster'&&camera.zoom>=target.zoom*.9&&Math.hypot(camera.x-target.x,camera.y-target.y)<a.radius*.25){const word=a.featured[0];if(word)onSelect(model.byWord.get(word));return;}
  fly(target,kind);onLocation?.({region:kind==='region'?a:atlas.regions[a.region],cluster:kind==='cluster'?a:null,word:null});
 }
 function home(){if(navigationLocked)return;orbitMode=false;cancelGestures();fly(G.overview(atlas,width,height),'universe');onLocation?.({region:null,cluster:null,word:null});}
 function focusSelected(){if(navigationLocked)return;if(!selected)return;if(view!=='word'){select(selected.node);return;}detailPan={x:0,y:0};scaleDetail(1);}
 function setFilters(next){
  filters=new Set(next);
  routeLanes=routeIndex.lanes(filters);
  if(selectedLane){
   const {from,to}=selectedLane;
   selectedLane={from,to,...routeIndex.summary(from,to,filters)};
   if(!selectedLane.count)selectedLane=null;
  }
  panel.setFilters(filters);
  related.clear();connectionPage=0;
  if(selected)for(const r of C.relationships(model.related(selected.node,filters)))related.set(r.node.w,r);
  // Apply explicit filter changes on the next frame, even if reduced motion leaves no frame after it.
  lastRefresh=-Infinity;needsRefresh=dirty=true;wake();
 }
 function manual(){
  if(view==='word')return;
  flight=null;
  if(view!=='explore'){view='explore';onView?.('explore');}
  sceneReady=false;dirty=needsRefresh=true;wake();
 }
 function local(e){const r=graph.getBoundingClientRect();return {x:(e.clientX-r.left)*width/(r.width||width),y:(e.clientY-r.top)*height/(r.height||height)};}
 function cancelGestures(){clearPinchPreview();const ids=[...pointers.keys()];if(drag?.particle)drag.particle.targetScale=1;pointers.clear();drag=pinch=null;gesture=false;for(const id of ids)if(graph.hasPointerCapture?.(id))graph.releasePointerCapture(id);}
 function scaleDetail(value,anchorPoint=null){
  if(navigationLocked)return;
  releasePending();interruptWordFlight();
  if(drag?.particle){drag.particle.targetScale=1;drag=null;}
  if(value<1){leaveFocus(value/detailScale,anchorPoint||focusLayout.center);return;}
  const previous=detailScale,next=G.clamp(value,1,6),base=focusLayout.baseCenter;
  if(anchorPoint){const ratio=next/previous;detailPan={x:anchorPoint.x-base.x-(anchorPoint.x-base.x-detailPan.x)*ratio,y:anchorPoint.y-base.y-(anchorPoint.y-base.y-detailPan.y)*ratio};}
  const focusPoint=anchorPoint||{x:base.x+detailPan.x,y:base.y+detailPan.y};camera=G.zoomAt(camera,focusPoint,camera.zoom*next/previous,width,height,selected?.z||0,selected||camera);detailScale=next;focusCamera={...camera,zoom:camera.zoom/detailScale};sceneReady=false;refresh(true);drawBackground();renderBubbles(0);updateHud();wake();
 }
 function panDetail(x,y){if(navigationLocked)return;releasePending();interruptWordFlight();detailPan={x:G.clamp(x,-width*detailScale,width*detailScale),y:G.clamp(y,-height*detailScale,height*detailScale)};sceneReady=false;refresh(true);drawBackground();renderBubbles(0);updateHud();wake();}
 function pair(){
  const [a,b]=pointers.values(),dx=b.x-a.x,dy=b.y-a.y;
  return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(dx,dy)),angle:Math.atan2(dy,dx)};
 }
 function closestDot(point,minOpacity=0){
  let closest=null,minimum=Infinity;
  for(const dot of hitDots){
   if(dot.labelOpacity<minOpacity)continue;
   const dx=dot.screen.x-point.x,dy=dot.screen.y-point.y,distance=dx*dx+dy*dy,radius=Math.max(9,dot.r);
   if(distance<radius*radius&&distance<minimum){closest=dot;minimum=distance;}
  }
  return closest?.point;
 }
 function clearPinchPreview(){$('viewport').removeAttribute('transform');canvas.style.transform='';labels.style.transform='';}
 function cameraGesture(from,start,next,ratio,anchor=null,turn=0){
  const zoom=G.clamp(from.zoom*ratio,G.overview(atlas,width,height).zoom*.7,Math.max(2.4,(focusCamera?.zoom||1)*6));
  const roll=(from.roll||0)+turn;
  return G.aimAt({...from,zoom,roll},G.unproject(start,from,width,height,anchor?.z||0,anchor||from),next,width,height);
 }
 function leaveFocus(ratio,point,next=point){interruptWordFlight();camera=cameraGesture(camera,point,next,ratio);flight=null;view='explore';clearBubbles();focusLayout=null;sceneReady=false;dirty=needsRefresh=true;onView?.('explore');refresh();drawBackground();updateHud();wake();}
 function updatePinch(){
  const next=pair(),raw=next.distance/pinch.distance;
  const ratio=G.clamp(raw,G.overview(atlas,width,height).zoom*.7/pinch.camera.zoom,view==='word'?6/pinch.detailScale:2.4/pinch.camera.zoom);
  if(view!=='word'){
   const turn=G.touchTurn(pinch,next);
   if(!pinch.moved){
    const pan=Math.hypot(next.x-pinch.x,next.y-pinch.y),spread=Math.abs(next.distance-pinch.distance)/2;
    if(Math.max(pan,spread,Math.abs(turn)*next.distance/2)<=3)return;
    pinch.moved=true;map.classList.add('touch-explored');
   }
   // Camera math is cheap on every event. Only the next animation frame
   // projects words, routes and their upright labels, once for both fingers.
   camera=cameraGesture(pinch.camera,pinch,next,ratio,pinch.anchor,turn);
   manual();return;
  }
  // A word family has its own magnetic layout. Keep the touched SVG nodes
  // throughout this gesture and refit that family once on release.
  const x=next.x-pinch.x*ratio,y=next.y-pinch.y*ratio;
  pinch.preview={next,ratio,x,y};
  $('viewport').setAttribute('transform',`matrix(${ratio} 0 0 ${ratio} ${x} ${y})`);
  for(const layer of [canvas,labels]){layer.style.transformOrigin='0 0';layer.style.transform=`translate(${x}px,${y}px) scale(${ratio})`;}
  $('zoomLabel').textContent=zoomFormat.format(pinch.detailScale*ratio)+'×';
 }
 function commitPinch(){if(!pinch)return;const p=pinch;pinch=null;clearPinchPreview();if(!p.preview){wake();return;}const {next,ratio}=p.preview;camera=cameraGesture(p.camera,p,next,ratio,p.anchor);flight=null;last=0;
  if(view==='word'&&p.detailScale*ratio>=.999){const base=focusLayout.baseCenter;detailScale=Math.max(1,p.detailScale*ratio);detailPan={x:next.x-base.x-(p.x-base.x-p.detailPan.x)*ratio,y:next.y-base.y-(p.y-base.y-p.detailPan.y)*ratio};focusCamera={...camera,zoom:camera.zoom/detailScale};sceneReady=false;refresh(true);drawBackground();renderBubbles(0);updateHud();}
  else {view='explore';clearBubbles();focusLayout=null;sceneReady=false;dirty=needsRefresh=true;onView?.('explore');refresh();drawBackground();updateHud();}wake();
 }
 function start(e,particle=null,tapPoint=null,tapArea=null){
  // Start a map gesture with a primary contact. A second finger can then join it.
  if(e.pointerType==='touch'&&!pointers.size&&e.isPrimary===false)return;
  if((e.button!==0&&e.pointerType==='mouse')||pointers.size>=2)return;e.preventDefault();e.stopPropagation();const p=local(e);pointers.set(e.pointerId,p);graph.setPointerCapture?.(e.pointerId);
  if(navigationLocked){if(pointers.size>1){gesture=true;drag=null;return;}gesture=false;drag={id:e.pointerId,start:p,last:p,particle,tapPoint,tapArea:null,moved:false};return;}
  if(view!=='word')flight=null;
  if(pointers.size===2){
   releasePending();interruptWordFlight();gesture=true;
   if(drag?.particle)drag.particle.targetScale=1;
   drag=null;
   const initial=pair();
   let anchorWord=selected;
   if(view!=='word')anchorWord=atlasControls.size?closestDot(initial,.2):null;
   pinch={...initial,camera:{...camera},anchor:anchorWord,detailScale,detailPan:{...detailPan}};
   if(view==='word'){cancelAnimationFrame(raf);raf=0;}
   return;
  }
  const slop=e.pointerType==='touch'?G.clamp(Math.max(e.width||0,e.height||0)*.36,7,12):6;
  gesture=false;drag={id:e.pointerId,start:p,last:p,camera:{...camera},detailPan:{...detailPan},particle,tapPoint,tapArea,startPX:particle?.x,startPY:particle?.y,moved:false,slop,throwX:0,throwY:0};if(particle&&!reduced)particle.targetScale=.95;kick();
 }
 function movePointer(e,p){
  pointers.set(e.pointerId,p);
  if(navigationLocked){if(drag?.id===e.pointerId&&Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>6)drag.moved=true;e.preventDefault();return;}
  if(pinch&&pointers.size>=2){e.preventDefault();updatePinch();return;}
  if(!drag||drag.id!==e.pointerId)return;
  const dx=p.x-drag.start.x,dy=p.y-drag.start.y;
  if(!drag.moved&&Math.hypot(dx,dy)<=drag.slop)return;
  drag.moved=true;releasePending();interruptWordFlight();
  if(drag.particle){P.moveDragged(bodies,drag.particle,drag.startPX+dx,drag.startPY+dy,!reduced);drag.throwX=G.clamp(p.x-drag.last.x,-12,12);drag.throwY=G.clamp(p.y-drag.last.y,-12,12);renderBubbles(0);wake();}
  else if(view==='word'){panDetail((drag.detailPan?.x||0)+dx,(drag.detailPan?.y||0)+dy);}
  else if(orbitMode&&canOrbit()){
   camera=G.dragOrbit(drag.camera,dx,dy,width,height);
   manual();
  }
  else if(view!=='word'){camera=cameraGesture(drag.camera,drag.start,p,1,drag.tapPoint);manual();}
  drag.last=p;
 }
 graph.addEventListener('pointerdown',e=>{if(!e.target.closest('.word-node'))start(e);});
 graph.addEventListener('pointerleave',()=>graph.classList.remove('over-route'));
 graph.addEventListener('pointermove',e=>{
  if(pointers.has(e.pointerId)){graph.classList.remove('over-route');movePointer(e,local(e));}
  else if(e.pointerType==='mouse'){
   const point=local(e);
   const onRoute=!navigationLocked&&view!=='word'&&!e.target.closest('.word-node')&&root.AtlasSky.hitRoute(atlasLanes,point.x,point.y,6);
   graph.classList.toggle('over-route',!!onRoute);
  }
 });
 function end(e,cancel=false){
  if(!pointers.has(e.pointerId))return;
  const previous=pointers.get(e.pointerId),p=cancel?previous:local(e);
  // Some touch streams deliver the final displacement only on pointerup.
  if(!cancel&&(p.x!==previous.x||p.y!==previous.y))movePointer(e,p);
  pointers.delete(e.pointerId);if(graph.hasPointerCapture?.(e.pointerId))graph.releasePointerCapture(e.pointerId);
  if(pinch&&cancel){commitPinch();cancelGestures();return;}
  if(pinch){commitPinch();if(pointers.size===1){const[id,point]=[...pointers][0];drag={id,start:point,last:point,camera:{...camera},detailPan:{...detailPan},particle:null,moved:true};}else drag=null;return;}
  if(drag?.id===e.pointerId){const d=drag;drag=null;if(d.particle){d.particle.targetScale=1;if(!cancel&&d.moved&&!navigationLocked){d.particle.vx=d.throwX;d.particle.vy=d.throwY;}else if(!cancel&&!d.moved&&!gesture)onSelect(d.particle.node);}else if(!cancel&&!d.moved&&!gesture){if(d.tapArea){visitArea(d.tapArea.area,d.tapArea.kind);return;}if(!d.tapPoint&&!navigationLocked&&view!=='word'){
     const lane=root.AtlasSky.hitRoute(atlasLanes,d.start.x,d.start.y,e.pointerType==='touch'?Math.max(9,d.slop):6);
     if(lane){panel.open(lane.route.from,lane.route.to);return;}
    }
    const point=d.tapPoint||closestDot(d.start);if(point)onSelect(point.node);}
  }if(reduced){for(const body of bodies){body.x=body.homeX;body.y=body.homeY;body.vx=body.vy=0;body.scale=1;}constrain();renderBubbles(0);}kick();
 }
 graph.addEventListener('pointerup',e=>end(e));graph.addEventListener('pointercancel',e=>end(e,true));graph.addEventListener('lostpointercapture',e=>end(e,true));
 graph.addEventListener('wheel',e=>{
  e.preventDefault();if(navigationLocked)return;
  const pixel=local(e),ratio=Math.exp(-e.deltaY*.0018);
  if(view==='word'){scaleDetail(detailScale*ratio,pixel);return;}
  // Visible word hit targets sit on their own elevation, not the atlas plane.
  const word=e.target.closest?.('.atlas-word')?.getAttribute('data-word');
  const anchor=atlas.byWord.get(word);
  const zoom=G.clamp(camera.zoom*ratio,G.overview(atlas,width,height).zoom*.7,2.4);
  camera=G.zoomAt(camera,pixel,zoom,width,height,anchor?.z||0,anchor||camera);manual();
 },{passive:false});
 function cameraKey(e){
  if(e.target!==graph&&e.target!==orbitToggle&&e.key!=='Home')return;
  const dx=({ArrowLeft:-1,ArrowRight:1})[e.key]||0,dy=({ArrowUp:-1,ArrowDown:1})[e.key]||0;
  if(!dx&&!dy&&!['+','=','-','Home'].includes(e.key))return;
  if(e.target===orbitToggle&&!orbitMode&&e.key!=='Home')return;
  e.preventDefault();if(navigationLocked)return;
  if(e.key==='Home'){home();return;}
  if(!dx&&!dy){zoom(e.key==='-'?1/1.8:1.8);return;}
  if(view==='word'){panDetail(detailPan.x-dx*90,detailPan.y-dy*90);return;}
  if(orbitMode&&canOrbit())camera=G.orbit(camera,dx*Math.PI/12,-dy*Math.PI/24);
  else camera=cameraGesture(camera,{x:width/2+dx*90,y:height/2+dy*90},{x:width/2,y:height/2},1);
  manual();
 }
 graph.addEventListener('keydown',cameraKey);orbitToggle?.addEventListener('keydown',cameraKey);
 function zoom(mult){if(navigationLocked)return;if(view==='word'){scaleDetail(detailScale*mult);return;}fly({...camera,zoom:G.clamp(camera.zoom*mult,G.overview(atlas,width,height).zoom*.7,2.4)},'explore');}
 function suspend(value){
  const now=root.performance?.now?.()??clock;
  if(value&&pauseTime===null)pauseTime=now;
  if(!value&&pauseTime!==null){
   const elapsed=now-pauseTime;motionStarted+=elapsed;
   if(selectionTravel){selectionTravel.start+=elapsed;if(selectionTravel.lastFrame!==undefined)selectionTravel.lastFrame+=elapsed;}
   for(const p of particles)if(p.waiting&&Number.isFinite(p.releaseAt))p.releaseAt+=elapsed;
   pauseTime=null;
  }
  paused=value;
  if(value){cancelGestures();cancelAnimationFrame(raf);raf=0;last=0;savedCamera=flight?{...flight.to}:null;flight=null;}
  else{if(savedCamera){camera=savedCamera;savedCamera=null;}sceneReady=false;dirty=true;if(reduced){lastRefresh=-Infinity;needsRefresh=true;}wake();}
 }
 function setPageHidden(value){if(value)panel.close();pageHidden=value;suspend(value||document.hidden);}
 document.addEventListener('visibilitychange',()=>suspend(document.hidden||pageHidden));
 function setMotionPreference(value){
  motionPreference=value==='full'||value==='reduced'?value:'system';
  const wasReduced=reduced;
  reduced=motionPreference==='reduced'||motionPreference==='system'&&!!media?.matches;
  map.dataset.motionPreference=motionPreference;
  map.dataset.motion=reduced?'reduced':'full';
  if(wasReduced===undefined||reduced===wasReduced)return;
  if(reduced){
   cancelGestures();
   if(selectionTravel){camera={...selectionTravel.to};focusCamera={...camera};selectionTravel=null;}
   if(flight){camera={...flight.to};flight=null;}
   for(const p of bodies){p.scale=1;p.scaleV=p.vx=p.vy=0;}
   // A preference change can interrupt the camera, a waiting spring or an exit.
   // Finish at the destination even in a hidden tab. The system may enable
   // motion again before the next frame and a cancelled flight cannot release its stars.
   lastRefresh=-Infinity;settled=true;sceneReady=false;dirty=needsRefresh=true;
   refresh(true);
   if(!paused&&!document.hidden){drawBackground();renderBubbles(0);updateHud();}
  }
  wake();
 }
 const systemMotionChanged=()=>setMotionPreference(motionPreference);
 if(media?.addEventListener)media.addEventListener('change',systemMotionChanged);
 else media?.addListener?.(systemMotionChanged);
 new ResizeObserver(()=>{if(map.clientWidth&&map.clientHeight&&(map.clientWidth!==width||map.clientHeight!==height)){cancelGestures();resize();}}).observe(map);
 new ResizeObserver(()=>{
  if(measureWordStage()){
   if(selectionTravel)retargetWordFlight();
   needsRefresh=dirty=true;wake();
  }
 }).observe(wordFooter);
 resize();
 return {atlas,select,home,setMotionPreference,setWordRatings,setRaceRoute:route=>{raceRoute=route;needsRefresh=dirty=true;wake();},refreshText,setNavigationLocked:value=>{cancelGestures();if(value)panel.close();navigationLocked=!!value;syncOrbit();},isCenteredWord:word=>selected?.word===word&&view==='word'&&!selectionTravel&&!!particles[0]&&Math.hypot(particles[0].x-focusLayout.center.x,particles[0].y-focusLayout.center.y)<.1,visibleWords:()=>[...new Set([...bodies.filter(p=>!p.departure&&p.r>=10&&p.x-p.r>=8&&p.x+p.r<=width-8&&p.y-p.r>100&&p.y+p.r<height-130).map(p=>p.node.w),...hitDots.filter(p=>p.labelOpacity>.2&&p.screen.x-p.r>=8&&p.screen.x+p.r<=width-8&&p.screen.y-p.r>100&&p.screen.y+p.r<height-130).map(p=>p.point.word)])],focus:focusSelected,zoom,visitRegion:id=>visitArea(atlas.regions.find(r=>r.id===id),'region'),visitCluster:id=>visitArea(atlas.clusters.find(c=>c.id===id),'cluster'),setFilters,suspend,setPageHidden,resize,
  inspect:()=>({navigationLocked,orbitMode,pinching:!!pinch,pinchPreview:pinch?.preview?{...pinch.preview}:null,camera:{...camera},view,flight:!!flight,cameraTravelling:!!selectionTravel,selectionAnchor:selectionTravel?{...selectionTravel.anchor}:null,gathering:!settled,detailScale,detailPan:{...detailPan},settled,focusCenter:focusLayout?{...focusLayout.center}:null,lines:links.map(e=>({id:e.id,a:e.a.node.w,b:e.b.node.w,path:e.el.getAttribute('d'),color:e.el.getAttribute('stroke'),highlighted:e.highlighted,visible:e.el.style.display!=='none'})),particles:particles.map(p=>({word:p.node.w,x:p.x,y:p.y,r:P.radius(p),visualRadius:p.r,waiting:p.waiting,releaseAt:p.releaseAt,targetX:p.homeX,targetY:p.homeY,arrived:p.arrived,vx:p.vx,vy:p.vy})),surroundings:surroundings.map(p=>({word:p.node.w,x:p.x,y:p.y,r:P.radius(p)})),points:atlas.points.length,visible:projected.length,atlasGlyphs:projected.filter(v=>!movingIds.has(v.point.node.id)).map(v=>({word:v.point.word,x:v.screen.x,y:v.screen.y,r:v.r,labelOpacity:v.labelOpacity})),atlasLines:atlasLines.map(({edge,a,b})=>({id:edge.id,a:edge.from.word,b:edge.to.word,x1:a.x,y1:a.y,x2:b.x,y2:b.y,color:'#bcbdb7'})),atlasLanes:atlasLanes.map(l=>({...l})),atlasConnectionMode,atlasDustReady:sky.cloudsReady,availableAtlasEdgeCount:atlas.edges.length,screenPositions:[...allScreens].map(([word,p])=>({word,x:p.x,y:p.y})),reduced,motionPreference,paused,connectionPage:0,connectionPages:1,connectionCapacity:related.size,relatedWords:[...related.keys()],focusBounds:focusLayout?.bounds||null,contained:focusLayout?.contained||false})};

}
root.GalaxyView={mount};
})(window);
