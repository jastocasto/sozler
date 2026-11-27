const assert = require('node:assert/strict');
const {create} = require('../dist/atlas-sky.js');
const {boot} = require('./galaxy-harness.cjs');

function recordTrails(ctx) {
  const lines = [];
  ctx.createLinearGradient = (...endpoints) => ({endpoints, addColorStop() {}});
  const stroke = ctx.stroke.bind(ctx);
  ctx.stroke = () => {
    if (ctx.strokeStyle?.endpoints) lines.push({line: ctx.strokeStyle.endpoints, alpha: ctx.globalAlpha});
    stroke();
  };
  return lines;
}

const width=390, height=700, focus={x:165,y:290,r:20,node:{id:0}};
const points=Array.from({length:60},(_,i)=>{
  const angle=i*.97, distance=50+i*3;
  return {node:{id:i+1}, x:focus.x+Math.cos(angle)*distance, y:focus.y+Math.sin(angle)*distance, region:0, cluster:0};
});
const atlas={points, edges:[], regions:[{color:'#a592c3'}], clusters:[{...focus,radius:220}]};
const sky=create(atlas), items=points.map(point=>({point,screen:point}));
const ctx={beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}};
const lines=recordTrails(ctx), flight={start:0,duration:1000};
function frame(now,flightRef=flight) {
  lines.length=0;
  sky.drawFlightTrails(ctx,items,p=>p,focus,width,height,flightRef,now);
  return [...lines];
}
assert.equal(frame(0).length,0);
const early=frame(150),middle=frame(500);
assert(middle.length>=12 && middle.length<=28);
const lengths=records=>records.map(({line:[x,y,tx,ty]})=>Math.hypot(tx-x,ty-y));
assert(Math.max(...lengths(middle))>45 && Math.max(...lengths(middle))>3*Math.max(...lengths(early)));
for(const {line:[x1,y1,x2,y2]} of middle){
  const dx=x2-x1,dy=y2-y1;
  assert(Math.abs((x1-focus.x)*dy-(y1-focus.y)*dx)<1e-7, 'tail points back at the selected bubble');
  assert((x2-focus.x)*dx+(y2-focus.y)*dy>0);
  assert(Math.hypot(x1-focus.x,y1-focus.y)>=focus.r*1.5+8-.001);
  assert(points.some(p=>(p.x-focus.x)*dx+(p.y-focus.y)*dy>0 && Math.abs((p.x-focus.x)*dy-(p.y-focus.y)*dx)<1e-7), 'bearing belongs to a mapped star');
}
assert.deepEqual(frame(500,{start:500,duration:1000}),middle,'a rapid retap carries the visible afterimage into the next flight');
assert.equal(frame(1500,null).length,0);
assert.equal(frame(1000).length,0);

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
