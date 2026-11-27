/* Canvas lighting for the word atlas. Every compact light has a word at its centre.
   The diffuse layer integrates those same words in world coordinates. */
(function (root) {
'use strict';

const clamp = (number, minimum, maximum) => Math.max(minimum, Math.min(maximum, number));
const TAU = 2 * Math.PI;
// Region order follows the atlas. Light is coloured as it would appear against an ink sky.
const palette = [
  [169,151,223], [218,177,124], [112,196,179], [218,163,162], [190,162,196],
  [180,146,228], [122,166,208], [116,196,216], [160,192,184], [128,166,213]
];
const pigment = index => palette[index % palette.length];
function css(rgb) { return 'rgb(' + rgb.join(',') + ')'; }
function mix(a, b, t) { return a.map((value, i) => Math.round(value + (b[i] - value) * t)); }

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

function cloudTexture(region, points, weights, resolution) {
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
  const hue = pigment(region.index);
  for (let i=0; i<light.length; i++) {
    // Several optical scales preserve the bright ridges and feather the occupied boundaries.
    const hot = 1-Math.exp(-core[i]*1.32);
    const local = 1-Math.exp(-fine[i]*.82);
    const haze = 1-Math.exp(-halo[i]*1.7);
    const diffuse = 1-Math.exp(-bloom[i]*1.8);
    const alpha = clamp(hot*.32 + local*.16 + haze*.28 + diffuse*.40,0,.80);
    if (alpha < .002) continue;
    const j = i*4, warmth = hot*hot;
    pixels.data[j] = hue[0]*(.52 + .42*warmth);
    pixels.data[j+1] = hue[1]*(.55 + .44*warmth);
    pixels.data[j+2] = hue[2]*(.71 + .28*warmth);
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
  const radiance = new Float32Array(capacity*3);
  const layers = atlas.regions.map(()=>new Map()), beacons = new Map();
  for (const p of atlas.points) {
    const id = p.node.id, cluster = atlas.clusters[p.cluster], d = degree[id];
    // Light the relief of each actual cluster, using the recorded point elevation and density.
    const u = (p.x-cluster.x)/Math.max(1,cluster.radius), v = (p.y-cluster.y)/Math.max(1,cluster.radius);
    const distance = Math.min(1, Math.hypot(u,v));
    const relief = clamp(.5 + ((p.z||0)-(cluster.z||0))/230,0,1);
    const core = Math.exp(-distance*distance*5);
    const grain = (Math.imul(id+1,2654435761)>>>0)/4294967296;
    const ridge = relief*relief;
    stars[id] = clamp(.10 + .40*ridge + .25*core + .09*Math.log2(d+1) + .86*grain**12,.09,1.8);
    const tint=pigment(p.region), pearl=clamp((stars[id]-.40)*.95,0,.74);
    radiance[id*3]=stars[id]*(tint[0]+(244-tint[0])*pearl);
    radiance[id*3+1]=stars[id]*(tint[1]+(249-tint[1])*pearl);
    radiance[id*3+2]=stars[id]*(tint[2]+(250-tint[2])*pearl);
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
      for (const words of layers[region.index].values()) batch.push({region,words});
      layers[region.index].clear();
    }
    const now=()=>root.performance?.now?.() ?? Date.now();
    const schedule=callback=>root.requestIdleCallback
      ? root.requestIdleCallback(callback,{timeout:90})
      : root.setTimeout(callback,8);
    function build(deadline) {
      const started=now();
      do {
        const next=batch.pop();
        const cloud=cloudTexture(next.region,next.words,brightness,resolution);
        if (cloud) tiles.push(cloud);
      } while(batch.length && now()-started<8 && (!deadline || deadline.timeRemaining()>2));
      if (batch.length) schedule(build);
      else { clouds=tiles; warming=false; onCloudsReady?.(); }
    }
    if (batch.length) schedule(build);
    else { clouds=[]; warming=false; }
  }
  const beaconList = [...beacons.values()].sort((a,b)=>b.degree-a.degree).slice(0,56);
  const inks = palette.map(c => [css(mix(c,[118,146,201],.17)),css(mix(c,[214,240,245],.24)),css(mix(c,[244,247,233],.65))]);
  const trailInks = palette.map(c => [`rgba(${c.join(',')},0)`, `rgba(${c.join(',')},.53)`, css(mix(c,[231,242,255],.7))]);
  let lightFlight=null, tracks=[], afterglow=[], lastLit=-Infinity;

  // Take bearings from real lights once per flight. The sparse frame at high
  // zoom can still see dust along the bearings of the atlas's distant beacons.
  function flightTracks(items, project, focus, width, height) {
    const sectors=width<640?14:22, slots=new Array(sectors*2);
    function sample(point,screen) {
      const id=point.node.id, dx=screen.x-focus.x, dy=screen.y-focus.y, distance=Math.hypot(dx,dy);
      if(id===focus.node.id || distance<5)return;
      const unitX=dx/distance, unitY=dy/distance;
      const angle=(Math.atan2(dy,dx)+TAU)%TAU;
      const index=Math.floor(angle/TAU*sectors)*2+((id>>>2)&1);
      const variation=(Math.imul(id+1,2654435761)>>>0)/4294967296;
      const inside=screen.x>=0&&screen.x<=width&&screen.y>=0&&screen.y<=height;
      const score=(inside?2:0)+stars[id]+variation*.35;
      if(slots[index] && slots[index].score>=score)return;
      const reach=toFrame(unitX,unitY,focus,width,height);
      slots[index]={unitX,unitY,score,variation,ink:trailInks[point.region%palette.length],
        phase:inside&&reach>0?clamp(distance/reach,.08,.93):.12+.76*variation,alpha:0};
    }
    for(const {p} of beaconList)sample(p,project(p));
    const stride=Math.max(1,Math.ceil(items.length/480));
    for(let i=0;i<items.length;i+=stride)sample(items[i].point,items[i].screen);
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
    const {x,y,tailX,tailY,ink}=track;
    const tint=ctx.createLinearGradient?.(tailX,tailY,x,y);
    if(tint){tint.addColorStop(0,ink[0]);tint.addColorStop(.68,ink[1]);tint.addColorStop(1,ink[2]);}
    ctx.strokeStyle=tint||ink[2];ctx.globalAlpha=alpha;ctx.lineWidth=track.weight;
    ctx.beginPath();ctx.moveTo(tailX,tailY);ctx.lineTo(x,y);ctx.stroke();
  }
  function drawFlightTrails(ctx,items,project,focus,width,height,flight,now) {
    if(!flight||!focus){lightFlight=null;tracks.length=afterglow.length=0;return;}
    if(flight!==lightFlight){
      afterglow=lightFlight&&now-lastLit<150?tracks:[];
      tracks=flightTracks(items,project,focus,width,height);lightFlight=flight;
    }
    const elapsed=Math.max(0,now-flight.start),t=clamp(elapsed/flight.duration,0,1);
    const speed=Math.sin(t*Math.PI)**2, travel=t-Math.sin(t*TAU)/TAU;
    const aperture=Math.max(30,focus.r*1.5+8), longest=Math.min(116,Math.min(width,height)*.21);
    ctx.save?.();ctx.lineCap='round';
    for(const track of afterglow)paintTrail(ctx,track,clamp(1-elapsed/115,0,1));
    if(elapsed>=115)afterglow.length=0;
    for(const track of tracks){
      const {unitX,unitY,variation}=track;
      const reach=toFrame(unitX,unitY,focus,width,height);
      const phase=(track.phase+travel*(.76+.43*variation))%1;
      const distance=reach*phase;
      const length=Math.min(distance-aperture,longest*speed*(.22+.78*phase)*(.75+.5*variation));
      track.alpha=length<1?0:speed*(.43+.39*variation)*clamp(phase/.12,0,1)*clamp((1-phase)/.13,0,1);
      if(!track.alpha)continue;
      track.x=focus.x+unitX*distance;track.y=focus.y+unitY*distance;
      track.tailX=track.x-unitX*length;track.tailY=track.y-unitY*length;
      track.weight=.65+phase*(.6+.8*variation);
      paintTrail(ctx,track);
    }
    if(ctx.restore)ctx.restore();else {ctx.globalAlpha=1;ctx.lineCap='butt';}
    lastLit=now;
  }
  // As an atlas point becomes a readable word, its region tint settles into charcoal.
  const wordColours = atlas.regions.map(region => {
    const tint = [1,3,5].map(start => parseInt(region.color.slice(start,start+2),16));
    return Array.from({length:256}, (_,i) => css(mix(tint,[81,81,79],i/255)));
  });

  function drawClouds(ctx,project,width,height,zoom) {
    if (!ctx.drawImage || !ctx.transform || !ctx.save) { clouds=[]; return; }
    if (zoom >= .20) return;
    if (!clouds) { warmClouds(width); return; }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = clamp(1-(zoom-.027)/.173, 0, 1);
    for (const cloud of clouds) {
      if (!cloud) continue;
      const a=project(cloud), b=project({x:cloud.x+cloud.w,y:cloud.y,z:cloud.z}), c=project({x:cloud.x,y:cloud.y+cloud.h,z:cloud.z});
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
    // summing their light without constructing 90,000 Canvas paths every camera frame.
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
      const power=exposure*densityExposure, source=id*3;
      const red=power*radiance[source], green=power*radiance[source+1], blue=power*radiance[source+2];
      const offset=(y*w+x)*4;
      for (let k=0;k<4;k++) {
        const a=(k&1?fx:1-fx)*(k>=2?fy:1-fy);
        const j=offset+(k&1)*4+(k>=2?w*4:0);
        if (!data[j+3]) { touched[count++]=j; data[j+3]=255; }
        data[j]+=red*a; data[j+1]+=green*a; data[j+2]+=blue*a;
      }
    }
    // ImageData expects straight alpha. On a transparent canvas (the sky colour is CSS)
    // storing opaque, dim RGB here would mask the diffuse light around each subpixel star.
    raster.count=count;
    for (let k=0;k<count;k++) {
      const j=touched[k];
      const peak=Math.max(data[j],data[j+1],data[j+2]);
      data[j+3]=peak;
      if (peak) {
        const scale=255/peak;data[j]*=scale;data[j+1]*=scale;data[j+2]*=scale;
      }
    }
    raster.ctx.putImageData(raster.image,0,0);
    ctx.save();ctx.globalAlpha=opacity;ctx.globalCompositeOperation='screen';
    ctx.drawImage(raster.canvas,0,0,width,height);ctx.restore();
    return true;
  }
  function drawStars(ctx,items,width,height,zoom,moving,project) {
    const resolved=clamp((zoom-.031)/.014,0,1);
    const scattered=scatter(ctx,items,width,height,zoom,moving,1-resolved);
    if (!scattered || resolved>0) {
      const opacity=scattered?resolved:1;
      const batches = palette.map(()=>[[],[],[]]);
      for (const v of items) if (v.r<=3 && !moving.has(v.point.node.id)) {
        const light=stars[v.point.node.id], level=light>.66?2:light>.34?1:0;
        batches[v.point.region%palette.length][level].push(v);
      }
      for (let region=0;region<batches.length;region++) for (let level=0;level<3;level++) {
        if (!batches[region][level].length) continue;
        ctx.beginPath();ctx.globalAlpha=opacity*[.26,.54,.90][level];ctx.fillStyle=inks[region][level];
        for (const v of batches[region][level]) {
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
          glow.addColorStop(0,'rgba(243,254,253,.95)');glow.addColorStop(.13,'rgba(233,252,249,.88)');
          glow.addColorStop(.25,'rgba(165,225,238,.24)');glow.addColorStop(1,'rgba(135,199,227,0)');
          s.ctx.fillStyle=glow;s.ctx.fillRect(0,0,40,40);spark=s.canvas;
        }
      }
      if (spark) {
        ctx.save();ctx.globalCompositeOperation='screen';
        for (const [i,{p,degree}] of beaconList.entries()) {
          if (moving.has(p.node.id)) continue;
          const s=project(p);
          if(s.x<0||s.x>width||s.y<0||s.y>height)continue;
          const radius=clamp(Math.log2(degree+1)*1.35,4,10);
          ctx.globalAlpha=clamp((.07-zoom)/.045,0,.78);
          ctx.drawImage(spark,s.x-radius,s.y-radius,radius*2,radius*2);
          if (i<12 && radius>6) {
            ctx.globalAlpha*=.78;ctx.strokeStyle='#d9eff3';ctx.lineWidth=.7;ctx.beginPath();
            ctx.moveTo(s.x-radius*.48,s.y);ctx.lineTo(s.x+radius*.48,s.y);
            ctx.moveTo(s.x,s.y-radius*.58);ctx.lineTo(s.x,s.y+radius*.58);ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
    for (const v of items) {
      if (v.r<=3||moving.has(v.point.node.id)) continue;
      const {point,screen:p,r,body,labelOpacity}=v;
      ctx.globalAlpha=.68+.28*body;ctx.fillStyle=wordColours[point.region][Math.round(body*255)];
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fill();
      ctx.globalAlpha=body*.7;ctx.lineWidth=.65;ctx.strokeStyle='#aaa697';ctx.stroke();
      if (labelOpacity>0) {
        ctx.globalAlpha=labelOpacity;ctx.fillStyle='#f1ede4';ctx.font=v.fontSize+'px Georgia, serif';ctx.textAlign='center';
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
    const tone=highlighted?'#f7d39a':css(mix(mix(pigment(route.from),pigment(route.to),.5),[195,235,246],.38));
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
