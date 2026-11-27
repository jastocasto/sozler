const assert = require('node:assert/strict');
const {create} = require('../dist/atlas-sky.js');
const {boot} = require('./galaxy-harness.cjs');

function recordTrails(ctx) {
  const lines = [];
  ctx.createLinearGradient = (...endpoints) => ({endpoints, addColorStop() {}});
  const stroke = ctx.stroke.bind(ctx);
  ctx.stroke = () => {
    if (ctx.strokeStyle?.endpoints) {
      const line=ctx.strokeStyle.endpoints;
      // The nearest lights use the same path for a soft halo and a bright core.
      if(lines.at(-1)?.line===line)lines.pop();
      lines.push({line,alpha:ctx.globalAlpha,width:ctx.lineWidth});
    }
    stroke();
  };
  return lines;
}

const width=390, height=700, focus={x:165,y:290,r:20,node:{id:0},point:{x:165,y:290,z:0,cluster:0}};
const points=Array.from({length:256},(_,i)=>{
  const angle=i*.97, distance=50+(i*3)%180;
  return {node:{id:i+1},x:focus.x+Math.cos(angle)*distance,y:focus.y+Math.sin(angle)*distance,z:(i*47)%257-128,region:0,cluster:0};
});
const atlas={points, edges:[], regions:[{color:'#a592c3'}], clusters:[{...focus,radius:220}]};
const sky=create(atlas), items=points.map(point=>({point,screen:point}));
const ctx={beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}};
const lines=recordTrails(ctx), flight={start:0,duration:1000};
function frame(now,flightRef=flight,visible=items,project=p=>p) {
  lines.length=0;
  sky.drawFlightTrails(ctx,visible,project,focus,width,height,flightRef,now);
  return [...lines];
}
assert.equal(frame(0).length,0);
const early=frame(55),middle=frame(500);
assert(middle.length>=45 && middle.length<=72);
const lengths=records=>records.map(({line:[x,y,tx,ty]})=>Math.hypot(tx-x,ty-y));
assert(Math.max(...lengths(middle))>120 && Math.max(...lengths(middle))>3*Math.max(...lengths(early)));
assert(lengths(middle.filter(r=>r.width>1.19)).some(n=>n>120),'a foreground light sweeps a substantial distance on a phone');
assert(Math.max(...lengths(middle.filter(r=>r.width<.60)))<100,'distant lights cast much shorter trails');
const heights=points.map(p=>p.z).sort((a,b)=>a-b),low=heights[Math.floor(points.length/3)],high=heights[Math.floor(points.length*2/3)];
function verifyBearings(records,under=false){
  for(const r of records){
    const [x1,y1,x2,y2]=r.line,dx=x2-x1,dy=y2-y1;
    assert(Math.abs((x1-focus.x)*dy-(y1-focus.y)*dx)<1e-7,'tail points back at the selected bubble');
    assert((x2-focus.x)*dx+(y2-focus.y)*dy>0);
    assert(Math.hypot(x1-focus.x,y1-focus.y)>=focus.r*1.5+8-.001);
    const point=points.find(p=>(p.x-focus.x)*dx+(p.y-focus.y)*dy>0 && Math.abs((p.x-focus.x)*dy-(p.y-focus.y)*dx)<1e-7);
    assert(point,'bearing belongs to a mapped star');
    const elevation=point.z<low?0:point.z>high?2:1;
    assert.equal(track(r).band,under?2-elevation:elevation,'motion depth resolves the source elevation from this side of the atlas');
  }
}
verifyBearings(middle);
const following=frame(520),rates=[[],[],[]];
function track(r){
  const [x,y,headX,headY]=r.line;
  const band=r.width<.60?0:r.width<1.19?1:2;
  const direction=Math.atan2(headY-y,headX-x).toFixed(6);
  return {key:band+':'+direction,band,radius:Math.hypot(headX-focus.x,headY-focus.y)};
}
const atPeak=new Map(middle.map(track).map(s=>[s.key,s.radius]));
for(const s of following.map(track))if(s.radius>atPeak.get(s.key))rates[s.band].push(s.radius-atPeak.get(s.key));
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
assert(rates.every(group=>group.length>=8));
assert(median(rates[2])>median(rates[1])*1.35 && median(rates[1])>median(rates[0])*1.35,'near, middle and far lights pass at distinct measured speeds');
frame(500);
assert.deepEqual(frame(500,{start:500,duration:1000}),middle,'a rapid retap carries the visible afterimage into the next flight');
assert.equal(frame(1500,null).length,0);
assert.equal(frame(1000).length,0);
assert.equal(frame(1500,{start:1500,duration:0}).length,0);
const sparse={start:1600,duration:1200};
const fromBelow=p=>({...p,depth:1-(p.z||0)/1000});
frame(sparse.start,sparse,[],fromBelow);
const under=frame(sparse.start+600,sparse,[],fromBelow);
assert(under.length>=45,'the real destination cluster supplies the flight in an empty close-up');
verifyBearings(under,true);

for (const reduced of [false,true]) {
  const h=boot({width:390,height:844,reduced});
  const paints=recordTrails(h.$('universeCanvas').getContext('2d'));
  h.runFrames(2);
  assert.equal(paints.length,0);
  h.window.SozApp.selectWord('gözəl');h.runFrames(18);
  if(reduced)assert.equal(paints.length,0);
  else assert(paints.length>20,'selecting a real atlas word paints the flight');
  paints.length=0;h.$('universeButton').click();h.runFrames(4);
  assert.equal(paints.length,0,'leaving word selection clears the trails');
}
console.log('PASS selection lights follow actual atlas bearings, accelerate and fade, keep the focal word clear and honor interruption and reduced motion.');
