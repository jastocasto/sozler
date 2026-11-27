/* Canvas ink for the word atlas. Every star has a word at its centre.
   The diffuse layer integrates those same words in world coordinates. */
(function (root) {
'use strict';

const clamp = (number, minimum, maximum) => Math.max(minimum, Math.min(maximum, number));
const TAU = 2 * Math.PI;
const inks = ['#747474','#474747','#1f1f1f'];
const trailInk = ['rgba(43,43,43,0)','rgba(43,43,43,.46)','#262626'];

function surface(width, height) {
  const canvas = root.document?.createElement('canvas');
  if (!canvas) return null;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  return ctx?.createImageData && ctx.putImageData ? {canvas, ctx} : null;
}

// Two separable box passes produce a smooth footprint with bounded work per texel.
function blur(input, width, height, radius) {
  const middle = new Float32Array(input.length), output = new Float32Array(input.length);
  const span = 2 * radius + 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = 0; x <= radius; x++) sum += input[row + x];
    for (let x = 0; x < width; x++) {
      middle[row + x] = sum / span;
      if (x - radius >= 0) sum -= input[row + x - radius];
      if (x + radius + 1 < width) sum += input[row + x + radius + 1];
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y <= radius; y++) sum += middle[y * width + x];
    for (let y = 0; y < height; y++) {
      output[y * width + x] = sum / span;
      if (y - radius >= 0) sum -= middle[(y - radius) * width + x];
      if (y + radius + 1 < height) sum += middle[(y + radius + 1) * width + x];
    }
  }
  return output;
}

function cloudTexture(points, weights, resolution) {
  if (!points.length) return null;
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zSum = 0;
  for (const p of points) {
    xMin = Math.min(xMin,p.x); xMax = Math.max(xMax,p.x);
    yMin = Math.min(yMin,p.y); yMax = Math.max(yMax,p.y); zSum += p.z || 0;
  }
  const unit = Math.max(15, Math.max(xMax-xMin,yMax-yMin) / resolution);
  const kernel = radius => Math.max(1, Math.round(radius*resolution/210));
  const pad = kernel(30);
  const w = Math.max(2*pad+4, Math.ceil((xMax-xMin)/unit) + pad*2);
  const h = Math.max(2*pad+4, Math.ceil((yMax-yMin)/unit) + pad*2);
  const sheet = surface(w,h);
  if (!sheet) return null;
  const x = xMin-pad*unit, y = yMin-pad*unit;
  const light = new Float32Array(w*h);
  for (const p of points) {
    const u = (p.x-x)/unit, v = (p.y-y)/unit, column = Math.floor(u), row = Math.floor(v);
    const fx = u-column, fy = v-row, i = row*w+column;
    const value = weights[p.node.id] * (74/unit)**2;
    light[i] += value*(1-fx)*(1-fy); light[i+1] += value*fx*(1-fy);
    light[i+w] += value*(1-fx)*fy; light[i+w+1] += value*fx*fy;
  }
  const fine = blur(light,w,h,kernel(2));
  const core = blur(fine,w,h,kernel(5));
  const halo = blur(core,w,h,kernel(12));
  const bloom = blur(halo,w,h,kernel(20));
  const pixels = sheet.ctx.createImageData(w,h);
  for (let i=0; i<light.length; i++) {
    // Several scales preserve the ridges and feather the occupied boundaries.
    const hot = 1-Math.exp(-core[i]*1.32);
    const local = 1-Math.exp(-fine[i]*.82);
    const haze = 1-Math.exp(-halo[i]*1.7);
    const diffuse = 1-Math.exp(-bloom[i]*1.8);
    const alpha = clamp(hot*.14 + local*.08 + haze*.09 + diffuse*.11,0,.35);
    if (alpha < .002) continue;
    const j = i*4;
    pixels.data[j] = pixels.data[j+1] = pixels.data[j+2] = 63;
    pixels.data[j+3] = Math.round(alpha*255);
  }
  sheet.ctx.putImageData(pixels,0,0);
  return {canvas:sheet.canvas,x,y,z:zSum/points.length,w:w*unit,h:h*unit};
}

function create(atlas, onCloudsReady) {
  const capacity = atlas.points.reduce((max,p)=>Math.max(max,p.node.id+1),0);
  const degree = new Uint32Array(capacity);
  for (const edge of atlas.edges) { degree[edge.from.node.id]++; degree[edge.to.node.id]++; }
  const stars = new Float32Array(capacity), brightness = new Float32Array(capacity);
  const darkness = new Float32Array(capacity);
  const layers = atlas.regions.map(()=>new Map()), beacons = new Map();
  const localStars=atlas.clusters.map(()=>[]), visited=new Uint32Array(atlas.clusters.length);
  const stride=atlas.clusters.map(c=>Math.max(1,Math.ceil((c.count||1)/256)));
  for (const p of atlas.points) {
    const id = p.node.id, cluster = atlas.clusters[p.cluster], d = degree[id];
    if(visited[p.cluster]++%stride[p.cluster]===0)localStars[p.cluster].push(p);
    // Light the relief of each actual cluster, using the recorded point elevation and density.
    const u = (p.x-cluster.x)/Math.max(1,cluster.radius), v = (p.y-cluster.y)/Math.max(1,cluster.radius);
    const distance = Math.min(1, Math.hypot(u,v));
    const relief = clamp(.5 + ((p.z||0)-(cluster.z||0))/230,0,1);
    const core = Math.exp(-distance*distance*5);
    const grain = (Math.imul(id+1,2654435761)>>>0)/4294967296;
    const ridge = relief*relief;
    stars[id] = clamp(.10 + .40*ridge + .25*core + .09*Math.log2(d+1) + .86*grain**12,.09,1.8);
    darkness[id] = stars[id] * (190 + 45*clamp((stars[id]-.4)*.95,0,1));
    brightness[id] = .04 + .9*core + 1.45*ridge*ridge + .38*Math.log2(d+1);
    // Keep each dust sheet near its actual word elevations when the camera tilts.
    const band=Math.floor((p.z||0)/120), region=layers[p.region];
    if (!region.has(band)) region.set(band,[]);
    region.get(band).push(p);
    if (d > 0 && d > (beacons.get(p.cluster)?.degree || 0)) beacons.set(p.cluster,{p,degree:d});
  }
  let clouds = null, warming = false, raster = null, spark = null;
  function warmClouds(width) {
    if (warming || clouds) return;
    warming=true;
    // The fine stars and all controls can appear immediately. Fit construction of
    // the soft, static light maps around input; one final repaint also works at rest.
    const resolution=width<680?82:136, batch=[], tiles=[];
    for (const region of atlas.regions) {
      for (const words of layers[region.index].values()) batch.push(words);
      layers[region.index].clear();
    }
    const now=()=>root.performance?.now?.() ?? Date.now();
    const schedule=callback=>root.requestIdleCallback
      ? root.requestIdleCallback(callback,{timeout:90})
      : root.setTimeout(callback,8);
    function build(deadline) {
      const started=now();
      do {
        const cloud=cloudTexture(batch.pop(),brightness,resolution);
        if (cloud) tiles.push(cloud);
      } while(batch.length && now()-started<8 && (!deadline || deadline.timeRemaining()>2));
      if (batch.length) schedule(build);
      else { clouds=tiles; warming=false; onCloudsReady?.(); }
    }
    if (batch.length) schedule(build);
    else { clouds=[]; warming=false; }
  }
  const beaconList = [...beacons.values()].sort((a,b)=>b.degree-a.degree).slice(0,56);
  const elevations=localStars.map(points=>{
    const z=points.map(p=>p.z||0).sort((a,b)=>a-b);
    return [z[Math.floor(z.length/3)],z[Math.floor(z.length*2/3)]];
  });
  // Crossing the same angular field takes longer at greater depth. The shutter
  // interval determines the visible length of each light's path through it.
  const depths=[
    {passes:.52,shutter:.065,width:.70,opacity:.62},
    {passes:1.28,shutter:.19,width:1.48,opacity:.86},
    {passes:2.54,shutter:.37,width:2.70,opacity:1}
  ];
  const acceleration=.23,braking=.28;
  let lightFlight=null, tracks=[], afterglow=[], lastLit=-Infinity;

  function flightTracks(items, project, focus, width, height) {
    const sectors=width<640?24:32, slots=new Array(sectors*depths.length);
    const home=focus.point||atlas.points[0];
    const under=home && project({...home,z:(home.z||0)+24}).depth<project(home).depth;
    function sample(point,screen,origin,priority) {
      const id=point.node.id,dx=screen.x-origin.x,dy=screen.y-origin.y,distance=Math.hypot(dx,dy);
      if(screen.occluded||origin.occluded||id===focus.node.id||distance<.001)return;
      const unitX=dx/distance, unitY=dy/distance;
      const angle=(Math.atan2(dy,dx)+TAU)%TAU;
      const hash=Math.imul(id+1,2654435761)>>>0,variation=hash/4294967296;
      const [low,high]=elevations[point.cluster];
      // Group dust by the source word's actual elevation inside its cluster.
      // Below the atlas those nearer and farther bands exchange places.
      const heightBand=low<high?(point.z<low?0:point.z>high?2:1):(hash>>>7)%depths.length;
      const layer=under?2-heightBand:heightBand,index=layer*sectors+Math.floor(angle/TAU*sectors);
      const score=priority+stars[id]+variation*.35;
      if(slots[index] && slots[index].score>=score)return;
      // Individual phase comes from the word ID, so several lights in one part
      // of a dense cluster are not all released from the same depth plane.
      slots[index]={unitX,unitY,score,variation,layer,
        phase:((hash>>>8)&0xffff)/65536,alpha:0};
    }
    // Capture actual bearings on both ends of the trip. A gathered bubble can
    // be tapped a long way from its atlas home. The shape of its own cluster
    // still supplies dust around the viewer, even in a nearly empty close-up.
    const clusterIndex=focus.point?.cluster, cluster=atlas.clusters[clusterIndex];
    if(cluster){
      const center=project(cluster);
      for(const point of localStars[clusterIndex]){
        sample(point,point,cluster,0);
        sample(point,project(point),center,2);
      }
    }
    for(const {p} of beaconList)sample(p,project(p),focus,4);
    const stride=Math.max(1,Math.ceil(items.length/480));
    for(let i=0;i<items.length;i+=stride)sample(items[i].point,items[i].screen,focus,6);
    return slots.filter(Boolean);
  }
  function toFrame(dx,dy,focus,width,height) {
    const x=dx>0?(width+12-focus.x)/dx:dx<0?(-12-focus.x)/dx:Infinity;
    const y=dy>0?(height+12-focus.y)/dy:dy<0?(-12-focus.y)/dy:Infinity;
    return Math.min(x,y);
  }
  function paintTrail(ctx,track,fade=1) {
    const alpha=track.alpha*fade;
    if(alpha<.008)return;
    const {x,y,tailX,tailY}=track,ink=trailInk;
    const tint=ctx.createLinearGradient?.(tailX,tailY,x,y);
    if(tint){tint.addColorStop(0,ink[0]);tint.addColorStop(.50,ink[1]);tint.addColorStop(.94,ink[2]);tint.addColorStop(1,ink[2]);}
    ctx.fillStyle=ctx.strokeStyle=tint||ink[2];
    // Perspective tapers the tail down to a hairline. Only foreground lights
    // bloom, and that bloom narrows back into the moving tip.
    if(track.layer && ctx.fill){
      const radius=track.weight*.58,nx=-track.unitY,ny=track.unitX;
      const neckX=x-track.unitX*radius,neckY=y-track.unitY*radius;
      for(let pass=track.layer;pass>=1;pass--){
        const spread=pass===2?radius*2.8:radius;
        ctx.globalAlpha=alpha*(pass===2?.095:.72);
        ctx.beginPath();ctx.moveTo(tailX,tailY);ctx.lineTo(neckX+nx*spread,neckY+ny*spread);
        ctx.quadraticCurveTo(x+track.unitX*spread,y+track.unitY*spread,neckX-nx*spread,neckY-ny*spread);
        ctx.fill();
      }
    }
    ctx.globalAlpha=alpha;ctx.lineWidth=track.weight*.54;
    ctx.beginPath();ctx.moveTo(tailX,tailY);ctx.lineTo(x,y);ctx.stroke();
  }
  // Integrated smooth acceleration, cruise, and braking. Both the camera-ward
  // particle distance and the shutter speed stay continuous at the boundaries.
  function flightSpeed(t){const u=clamp(Math.min(t/acceleration,(1-t)/braking),0,1);return u*u*(3-2*u);}
  function flightDistance(t){
    const total=1-(acceleration+braking)/2;
    if(t<acceleration){const u=t/acceleration;return acceleration*u**3*(1-u/2)/total;}
    if(t>1-braking){const u=(1-t)/braking;return 1-braking*u**3*(1-u/2)/total;}
    return (t-acceleration/2)/total;
  }
  function perspective(phase){return phase/(1.82-.82*phase);}
  function drawFlightTrails(ctx,items,project,focus,width,height,flight,now) {
    if(!(flight?.duration>0)||!focus){lightFlight=null;tracks.length=afterglow.length=0;return;}
    if(flight!==lightFlight){
      afterglow=lightFlight&&now-lastLit<150?tracks:[];
      tracks=flightTracks(items,project,focus,width,height);lightFlight=flight;
    }
    const elapsed=Math.max(0,now-flight.start),t=clamp(elapsed/flight.duration,0,1);
    const speed=flightSpeed(t),travel=flightDistance(t),aperture=Math.max(30,focus.r*1.5+8);
    ctx.save?.();ctx.lineCap='round';ctx.globalCompositeOperation='source-over';
    for(const track of afterglow)paintTrail(ctx,track,clamp(1-elapsed/115,0,1));
    if(elapsed>=115)afterglow.length=0;
    for(const track of tracks){
      const {unitX,unitY,variation,layer}=track,band=depths[layer];
      const reach=toFrame(unitX,unitY,focus,width,height)*1.28;
      const phase=(track.phase+travel*band.passes*(.88+.24*variation))%1;
      const head=perspective(phase),tail=perspective(Math.max(0,phase-band.shutter*speed));
      const clear=aperture+variation*18,distance=reach*head,length=distance-Math.max(clear,reach*tail);
      track.alpha=length<.7?0:speed*band.opacity*clamp((distance-clear)/26,0,1)*clamp((1-phase)/.085,0,1);
      if(!track.alpha)continue;
      track.x=focus.x+unitX*distance;track.y=focus.y+unitY*distance;
      track.tailX=track.x-unitX*length;track.tailY=track.y-unitY*length;
      track.weight=band.width*(.82+.49*head+.17*variation);
      paintTrail(ctx,track);
    }
    if(ctx.restore)ctx.restore();else {ctx.globalAlpha=1;ctx.lineCap='butt';ctx.globalCompositeOperation='source-over';}
    lastLit=now;
  }
  const wordColours = Array.from({length:256}, (_,i) => {
    const gray = Math.round(47 + 194*i/255);
    return `rgb(${gray},${gray},${gray})`;
  });

  function drawClouds(ctx,project,width,height,zoom) {
    if (!ctx.drawImage || !ctx.transform || !ctx.save) { clouds=[]; return; }
    if (zoom >= .20) return;
    if (!clouds) { warmClouds(width); return; }
    ctx.save();
    ctx.globalAlpha = clamp(1-(zoom-.027)/.173, 0, 1);
    for (const cloud of clouds) {
      if (!cloud) continue;
      const a=project(cloud), b=project({x:cloud.x+cloud.w,y:cloud.y,z:cloud.z}), c=project({x:cloud.x,y:cloud.y+cloud.h,z:cloud.z});
      if(a.occluded||b.occluded||c.occluded)continue;
      const dx=b.x+c.x-a.x, dy=b.y+c.y-a.y;
      if (Math.max(a.x,b.x,c.x,dx)<0 || Math.min(a.x,b.x,c.x,dx)>width ||
          Math.max(a.y,b.y,c.y,dy)<0 || Math.min(a.y,b.y,c.y,dy)>height) continue;
      ctx.save();
      const sw=cloud.canvas.width, sh=cloud.canvas.height;
      ctx.transform((b.x-a.x)/sw,(b.y-a.y)/sw,(c.x-a.x)/sh,(c.y-a.y)/sh,a.x,a.y);
      ctx.drawImage(cloud.canvas,0,0);ctx.restore();
    }
    ctx.restore();
  }

  function scatter(ctx,items,width,height,zoom,moving,opacity) {
    // Distant subpixel stars share pixels. Rasterise directly at the projected coordinates,
    // summing their ink without constructing 90,000 Canvas paths every camera frame.
    if (!ctx.drawImage || !opacity) return false;
    const ratio = Math.min(root.devicePixelRatio || 1,1.5);
    const w = Math.ceil(width*ratio), h = Math.ceil(height*ratio);
    if (!raster || raster.w!==w || raster.h!==h) {
      const s=surface(w,h);
      if (!s) return false;
      const image=s.ctx.createImageData(w,h);
      raster={...s,w,h,image,packed:new Uint32Array(image.data.buffer),touched:new Uint32Array(w*h),count:0};
    }
    const data=raster.image.data, touched=raster.touched;
    // Empty sky takes no CPU time to clear or convert.
    for (let k=0;k<raster.count;k++) raster.packed[touched[k]>>2]=0;
    let count=0;
    // Keep tightly packed words legible on smaller displays; their angular area
    // shrinks faster than their minimum selectable radius at universe scale.
    const densityExposure=clamp((zoom/.0095)**1.45,.10,1);
    const hasMoving=moving.size>0;
    for (const item of items) {
      const p=item.point, id=p.node.id;
      if (hasMoving && moving.has(id)) continue;
      const u=item.screen.x*ratio, v=item.screen.y*ratio, x=Math.floor(u), y=Math.floor(v);
      if (x<0||x+1>=w||y<0||y+1>=h) continue;
      const fx=u-x, fy=v-y;
      const exposure=clamp((.34+Math.min(1.3,item.r)**2*.32)*Math.min(1.08,item.screen.depth||1)*ratio, .23,1);
      const power=exposure*densityExposure*darkness[id];
      const offset=(y*w+x)*4;
      for (let k=0;k<4;k++) {
        const a=(k&1?fx:1-fx)*(k>=2?fy:1-fy);
        const j=offset+(k&1)*4+(k>=2?w*4:0);
        if (!data[j+3]) { touched[count++]=j; data[j+3]=255; }
        data[j]+=power*a;
      }
    }
    // Use the summed density as straight alpha over the paper sky.
    raster.count=count;
    for (let k=0;k<count;k++) {
      const j=touched[k];
      data[j+3]=data[j];data[j]=data[j+1]=data[j+2]=25;
    }
    raster.ctx.putImageData(raster.image,0,0);
    ctx.save();ctx.globalAlpha=opacity;
    ctx.drawImage(raster.canvas,0,0,width,height);ctx.restore();
    return true;
  }
  function drawStars(ctx,items,width,height,zoom,moving,project,flight=null,now=0) {
    const speed=flight?.duration>0?flightSpeed((now-flight.start)/flight.duration):0;
    const starExposure=1-.52*speed,wordExposure=1-.77*speed;
    const resolved=clamp((zoom-.031)/.014,0,1);
    const scattered=scatter(ctx,items,width,height,zoom,moving,(1-resolved)*starExposure);
    if (!scattered || resolved>0) {
      const opacity=(scattered?resolved:1)*starExposure;
      const batches = [[],[],[]];
      for (const v of items) if (v.r<=3 && !moving.has(v.point.node.id)) {
        const light=stars[v.point.node.id], level=light>.66?2:light>.34?1:0;
        batches[level].push(v);
      }
      for (let level=0;level<batches.length;level++) {
        if (!batches[level].length) continue;
        ctx.beginPath();ctx.globalAlpha=opacity*[.26,.54,.90][level];ctx.fillStyle=inks[level];
        for (const v of batches[level]) {
          ctx.moveTo(v.screen.x+v.r,v.screen.y); ctx.arc(v.screen.x,v.screen.y,v.r,0,TAU);
        }
        ctx.fill();
      }
    }
    if (ctx.drawImage && zoom<.07) {
      if (!spark) {
        const s=surface(40,40);
        if (s) {
          const glow=s.ctx.createRadialGradient(20,20,0,20,20,20);
          glow.addColorStop(0,'rgba(20,20,20,.85)');glow.addColorStop(.13,'rgba(34,34,34,.65)');
          glow.addColorStop(.25,'rgba(65,65,65,.16)');glow.addColorStop(1,'rgba(80,80,80,0)');
          s.ctx.fillStyle=glow;s.ctx.fillRect(0,0,40,40);spark=s.canvas;
        }
      }
      if (spark) {
        ctx.save();
        for (const [i,{p,degree}] of beaconList.entries()) {
          if (moving.has(p.node.id)) continue;
          const s=project(p);
          if(s.occluded||s.x<0||s.x>width||s.y<0||s.y>height)continue;
          const radius=clamp(Math.log2(degree+1)*1.35,4,10);
          ctx.globalAlpha=clamp((.07-zoom)/.045,0,.78)*starExposure;
          ctx.drawImage(spark,s.x-radius,s.y-radius,radius*2,radius*2);
          if (i<12 && radius>6) {
            ctx.globalAlpha*=.78;ctx.strokeStyle='#3f3f3f';ctx.lineWidth=.7;ctx.beginPath();
            ctx.moveTo(s.x-radius*.48,s.y);ctx.lineTo(s.x+radius*.48,s.y);
            ctx.moveTo(s.x,s.y-radius*.58);ctx.lineTo(s.x,s.y+radius*.58);ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
    for (const v of items) {
      if (v.r<=3||moving.has(v.point.node.id)) continue;
      const {screen:p,r,body,labelOpacity}=v;
      ctx.globalAlpha=(.68+.28*body)*wordExposure;ctx.fillStyle=wordColours[Math.round(body*255)];
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fill();
      ctx.globalAlpha=body*.7*wordExposure;ctx.lineWidth=.65;ctx.strokeStyle='#494949';ctx.stroke();
      if (labelOpacity>0) {
        ctx.globalAlpha=labelOpacity*wordExposure;ctx.fillStyle='#191919';ctx.font=v.fontSize+'px Georgia, serif';ctx.textAlign='center';
        v.lines.forEach((line,i)=>ctx.fillText(line,p.x,p.y+(i-(v.lines.length-1)/2)*(v.fontSize+2)+v.fontSize*.32));
      }
    }
    ctx.globalAlpha=1;
  }

  return {drawClouds,drawStars,drawFlightTrails,get cloudsReady(){ return clouds!==null; }};
}

function pointOnLane(lane,t) {
  const k=1-t;
  return {x:k*k*lane.x1+2*k*t*lane.cx+t*t*lane.x2,y:k*k*lane.y1+2*k*t*lane.cy+t*t*lane.y2};
}
function drawLanes(ctx,atlas,project,routes,selected,width,height,opacity) {
  if (!opacity) return [];
  if (selected && selected.count>0 && selected.from!==selected.to) {
    const from=Math.min(selected.from,selected.to),to=Math.max(selected.from,selected.to);
    selected={...selected,from,to};
    routes=[...routes.filter(r=>r.from!==from || r.to!==to),selected];
  }
  if (!routes.length) return [];
  const painted=[];
  const maximum=Math.max(1,...routes.map(route=>route.count));
  for (const route of routes) {
    const a=project(atlas.regions[route.from]),b=project(atlas.regions[route.to]);
    if(a.occluded||b.occluded)continue;
    const dx=b.x-a.x,dy=b.y-a.y,span=Math.hypot(dx,dy);
    if (span<1) continue;
    const sign=((route.from*31+route.to*7)%3===0?-1:1);
    const bend=sign*Math.min(span*.19,Math.min(width,height)*.16);
    const strength=Math.sqrt(route.count/maximum);
    const highlighted=route===selected;
    const emphasis=selected && !highlighted ? .55 : 1;
    const lane={route,x1:a.x,y1:a.y,x2:b.x,y2:b.y,cx:(a.x+b.x)/2-dy/span*bend,cy:(a.y+b.y)/2+dx/span*bend,width:.8+2.2*strength};
    if(Math.max(a.x,b.x,lane.cx)<-8||Math.min(a.x,b.x,lane.cx)>width+8||
       Math.max(a.y,b.y,lane.cy)<-8||Math.min(a.y,b.y,lane.cy)>height+8)continue;
    const tone=highlighted?'#222222':'#777777';
    ctx.strokeStyle=tone;
    ctx.globalAlpha=opacity*emphasis*(highlighted?.38:.065+.06*strength);
    ctx.lineWidth=lane.width*(highlighted?4.2:3.4);ctx.beginPath();
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(lane.cx,lane.cy,b.x,b.y);ctx.stroke();
    const left=[],right=[];
    for (let i=0;i<=18;i++) {
      const t=i/18,k=1-t,p=pointOnLane(lane,t);
      const vx=k*(lane.cx-a.x)+t*(b.x-lane.cx),vy=k*(lane.cy-a.y)+t*(b.y-lane.cy);
      const size=lane.width*(highlighted?.84:.52)*(.16+.84*Math.sin(Math.PI*t))/Math.max(1,Math.hypot(vx,vy));
      left.push([p.x-vy*size,p.y+vx*size]);right.push([p.x+vy*size,p.y-vx*size]);
    }
    ctx.fillStyle=tone;ctx.globalAlpha=opacity*emphasis*(highlighted?.98:.40+.35*strength);ctx.beginPath();
    ctx.moveTo(left[0][0],left[0][1]);for(const p of left)ctx.lineTo(p[0],p[1]);
    for(let i=right.length-1;i>=0;i--)ctx.lineTo(right[i][0],right[i][1]);ctx.fill();
    painted.push(lane);
  }
  ctx.globalAlpha=1;return painted;
}

function hitRoute(lanes,x,y,tolerance=7) {
  let closest=null,best=Infinity;
  for (const lane of lanes) {
    const threshold=tolerance+lane.width/2;
    if(x<Math.min(lane.x1,lane.cx,lane.x2)-threshold||x>Math.max(lane.x1,lane.cx,lane.x2)+threshold||
       y<Math.min(lane.y1,lane.cy,lane.y2)-threshold||y>Math.max(lane.y1,lane.cy,lane.y2)+threshold)continue;
    const steps=clamp(Math.ceil(Math.hypot(lane.x2-lane.x1,lane.y2-lane.y1)/14),12,96);
    let a={x:lane.x1,y:lane.y1};
    for(let i=1;i<=steps;i++){
      const b=pointOnLane(lane,i/steps),dx=b.x-a.x,dy=b.y-a.y;
      const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
      const distance=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
      if(distance<threshold&&distance<best){closest=lane;best=distance;}a=b;
    }
  }
  return closest;
}

const api={create,drawLanes,hitRoute,pointOnLane};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.AtlasSky=api;
})(typeof window!=='undefined'?window:globalThis);
