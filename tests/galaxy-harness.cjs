const {parseHTML}=require('linkedom'),fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const dir=path.join(__dirname,'../dist');
const viewports=new WeakMap();
function canvasMock(window){
 const counts={frames:0,arcs:0,texts:0},context={};
 for(const method of ['setTransform','clearRect','fillRect','beginPath','moveTo','lineTo','quadraticCurveTo','stroke','rect','fill','arc','setLineDash','fillText']){
  context[method]=(...args)=>{for(const a of args)if(typeof a==='number')assert(Number.isFinite(a),method+' received nonfinite coordinates');};
 }
 for(const [method,count] of [['arc','arcs'],['fillText','texts']]){
  const draw=context[method];
  context[method]=(...args)=>{draw(...args);counts[count]++;};
 }
 const clear=context.clearRect;
 context.clearRect=(...args)=>{clear(...args);counts.frames++;counts.arcs=counts.texts=0;};
 context.measureText=text=>({width:String(text).length*(parseFloat(context.font)||11)*.55});context.createRadialGradient=()=>({addColorStop(){}});
 for(const canvas of window.document.querySelectorAll('canvas'))canvas.getContext=()=>context;
 // The word sheet creates a detached canvas for text measurement.
 const createElement=window.document.createElement.bind(window.document);
 window.document.createElement=(name,...args)=>{
  const element=createElement(name,...args);
  if(name==='canvas')element.getContext=()=>context;
  return element;
 };
 return counts;
}
function boot({width=390,height=844,hash='',saved=[],reduced=false,layers=false,configureWindow,fetchJSON=require('./layers.cjs').fetchJSON}={}){
 const dom=parseHTML(fs.readFileSync(path.join(dir,'index.html'),'utf8')).window,frames=new Map(),intervals=[],resizeObservers=[],errors=[];
 // Linkedom's window proxies writes to Node globals. Give each viewport its own browser globals.
 const window={};
 for(const name of ['document','navigator','Event','Element','HTMLElement','HTMLSelectElement','HTMLCanvasElement','addEventListener','removeEventListener','dispatchEvent'])window[name]=dom[name];
 window.window=window;
 let id=0,now=0;
 const motionListeners=new Set();
 const motion={matches:reduced,addEventListener(type,fn){if(type==='change')motionListeners.add(fn);}};
 const setReducedMotion=value=>{motion.matches=value;for(const fn of motionListeners)fn({matches:value});};
 const storage=new Map([['soz-toxumasi:saved',JSON.stringify(saved)]]);
 Object.assign(window,{module:undefined,console:{...console,error:(...e)=>errors.push(e)},innerWidth:width,innerHeight:height,devicePixelRatio:1,performance:{now:()=>now},setTimeout,clearTimeout,setInterval:fn=>intervals.push(fn),clearInterval:id=>{delete intervals[id-1];},matchMedia:()=>motion,ResizeObserver:class{constructor(fn){resizeObservers.push(fn);}observe(){}},requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},location:{hash},history:{state:null,replaceState:(a,b,url)=>{window.history.state=a;window.location.hash=url;},pushState:(a,b,url)=>{window.history.state=a;window.location.hash=url;}}});
 const captures=new Map(),viewport={width,height,captures};viewports.set(window.document,viewport);
 Object.defineProperties(window.HTMLElement.prototype,{clientWidth:{configurable:true,get(){return viewports.get(this.ownerDocument)?.width||0;}},clientHeight:{configurable:true,get(){return viewports.get(this.ownerDocument)?.height||0;}}});
 const selectValue=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value');if(selectValue&&!selectValue.set)Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get:selectValue.get,set(value){const options=[...this.querySelectorAll('option')];for(const option of options)option.removeAttribute('selected');options.find(option=>option.value===value)?.setAttribute('selected','');}});
 window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};window.HTMLElement.prototype.close=function(){this.removeAttribute('open');};window.HTMLElement.prototype.scrollIntoView=function(){};
 window.Element.prototype.setPointerCapture=function(id){viewports.get(this.ownerDocument).captures.set(id,this);};window.Element.prototype.hasPointerCapture=function(id){return viewports.get(this.ownerDocument).captures.get(id)===this;};window.Element.prototype.releasePointerCapture=function(id){viewports.get(this.ownerDocument).captures.delete(id);};
 window.Element.prototype.getBoundingClientRect=function(){const {width,height}=viewports.get(this.ownerDocument);return {left:0,top:0,width,height};};
 // Detail files and the forms archive load synchronously from dist/ in tests.
 // Search is tested through its normal input path. Skip background prewarming in each synthetic viewport.
 window.requestIdleCallback=()=>0;
 window.SOZ_FETCH_JSON=fetchJSON;
 window.fetch=async file=>({ok:true,json:()=>window.SOZ_FETCH_JSON(file)});
 configureWindow?.(window);
 const counts=canvasMock(window),context=vm.createContext(window);
 let model;
 // Tests that build their own createModel also need the data layers the page no longer loads.
 if(layers)require('./layers.cjs').loadLayers(context);
 for(const script of window.document.querySelectorAll('script[src]')){
  const file=script.getAttribute('src').split('?')[0];
  vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),context,{filename:file});
  if(file==='model.js'){
   const restore=window.WordWeb.restoreModel;
   window.WordWeb.restoreModel=(...args)=>(model=restore(...args));
  }
 }
 assert.equal(errors.length,0,errors.map(x=>String(x)).join('\n'));
 const $=id=>window.document.getElementById(id),input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new window.Event('input'));};
 const runFrames=(n=120,afterFrame=null,sampleEvery=1,frameMs=1000/60)=>{for(let i=0;i<n;i++){now+=frameMs;const queue=[...frames];frames.clear();for(const[,fn]of queue)fn(now);if(queue.length&&(i%sampleEvery===0||i===n-1))afterFrame?.();}};
 const runUntilIdle=(check=null)=>{
  for(let frame=0;frames.size&&frame<360;frame++)runFrames(1,frame%8===0?check:null);
  assert.equal(frames.size,0,'The atlas should stop animating within six simulated seconds');
  check?.();
 };
 const pointer=(type,id,x,y,target=$('graph'))=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0});target.dispatchEvent(e);};
 const resize=(w,h)=>{viewport.width=window.innerWidth=w;viewport.height=window.innerHeight=h;resizeObservers.forEach(fn=>fn());runFrames(3);};
 return {window,$,model,input,frames,runFrames,runUntilIdle,pointer,resize,counts,storage,intervals,errors,captures,setReducedMotion};
}
module.exports={boot,canvasMock};
