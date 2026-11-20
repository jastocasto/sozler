const assert=require('node:assert/strict');
module.exports=function geometry(state,{centered=true}={}){
 const ps=[...state.particles,...state.surroundings],nodes=new Map([...state.screenPositions,...ps].map(p=>[p.word,p]));
 if(state.contained)for(const p of state.particles){if(!state.settled&&!p.arrived)continue;const b=state.focusBounds;assert(p.x-p.r>=b.left-.5&&p.x+p.r<=b.right+.5,p.word+' beyond horizontal stage');assert(p.y-p.r>=b.top-.5&&p.y+p.r<=b.bottom+.5,p.word+' beyond vertical stage');}
 if(centered&&state.view==='word'&&state.settled){const p=nodes.get(state.selected);assert(Math.hypot(p.x-state.focusCenter.x,p.y-state.focusCenter.y)<.001,'Selected word stays at the group center');}
 for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)assert(Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y)>=ps[i].r+ps[j].r-.001,ps[i].word+' overlaps '+ps[j].word);
 const ids=new Set(state.atlasLines.map(e=>e.id));
 for(const line of state.lines){assert(!ids.has(line.id),'Connection drawn twice');ids.add(line.id);const a=nodes.get(line.a),b=nodes.get(line.b),v=line.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);assert(a&&b);assert(Math.abs(v[0]-a.x)<.01&&Math.abs(v[1]-a.y)<.01,'Line origin follows bubble');assert(Math.abs(v[4]-b.x)<.01&&Math.abs(v[5]-b.y)<.01,'Line destination follows bubble');assert.equal(line.highlighted,line.a===state.selected||line.b===state.selected);if(!line.highlighted)assert.equal(line.color,'#bcbdb7');else assert.notEqual(line.color,'#bcbdb7');}
 for(const e of state.atlasLines){assert.equal(e.color,'#bcbdb7');const a=nodes.get(e.a),b=nodes.get(e.b);assert.equal(e.x1,a.x);assert.equal(e.y1,a.y);assert.equal(e.x2,b.x);assert.equal(e.y2,b.y);}
};
