const {parseHTML}=require('linkedom'),fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const dir=path.join(__dirname,'../dist');
function canvasMock(window){
 const counts={frames:0,marks:0,paths:[],arcs:[],texts:[]};const context={};let pathCommands=[];
 for(const method of ['setTransform','clearRect','fillRect','beginPath','moveTo','lineTo','quadraticCurveTo','stroke','rect','fill','arc','setLineDash','fillText'])context[method]=(...args)=>{for(const a of args)if(typeof a==='number')assert(Number.isFinite(a),method+' received nonfinite coordinates');if(method==='clearRect'){counts.frames++;counts.paths=[];counts.arcs=[];counts.texts=[];}if(method==='beginPath')pathCommands=[];if(['moveTo','lineTo','quadraticCurveTo'].includes(method))pathCommands.push({method,args});if(method==='stroke'&&pathCommands.length)counts.paths.push({color:context.strokeStyle,commands:[...pathCommands]});if(method==='rect')counts.marks++;if(method==='arc')counts.arcs.push(args);if(method==='fillText')counts.texts.push({text:args[0],x:args[1],y:args[2],alpha:context.globalAlpha});};
 context.measureText=text=>({width:String(text).length*(parseFloat(context.font)||11)*.55});context.createRadialGradient=()=>({addColorStop(){}});
 window.HTMLCanvasElement.prototype.getContext=()=>context;return counts;
}
function boot({width=390,height=844,hash='',saved=[],reduced=false,layers=false}={}){
 const {window}=parseHTML(fs.readFileSync(path.join(dir,'index.html'),'utf8')),frames=new Map(),intervals=[],resizeObservers=[],errors=[];let id=0,now=0;
 const storage=new Map([['soz-toxumasi:saved',JSON.stringify(saved)]]);
 Object.assign(window,{module:undefined,console:{...console,error:(...e)=>errors.push(e)},innerWidth:width,innerHeight:height,devicePixelRatio:1,performance:{now:()=>now},setTimeout,clearTimeout,setInterval:fn=>intervals.push(fn),matchMedia:()=>({matches:reduced,addEventListener(){}}),ResizeObserver:class{constructor(fn){resizeObservers.push(fn);}observe(){}},requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},location:{hash},history:{state:null,replaceState:(a,b,url)=>{window.history.state=a;window.location.hash=url;},pushState:(a,b,url)=>{window.history.state=a;window.location.hash=url;}}});
 let W=width,H=height;Object.defineProperties(window.HTMLElement.prototype,{clientWidth:{configurable:true,get(){return W;}},clientHeight:{configurable:true,get(){return H;}}});
 const selectValue=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value');if(selectValue&&!selectValue.set)Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get:selectValue.get,set(value){const options=[...this.querySelectorAll('option')];for(const option of options)option.removeAttribute('selected');options.find(option=>option.value===value)?.setAttribute('selected','');}});
 window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};window.HTMLElement.prototype.close=function(){this.removeAttribute('open');};window.HTMLElement.prototype.scrollIntoView=function(){};
 const captures=new Map();window.Element.prototype.setPointerCapture=function(id){captures.set(id,this);};window.Element.prototype.hasPointerCapture=function(id){return captures.get(id)===this;};window.Element.prototype.releasePointerCapture=function(id){captures.delete(id);};window.Element.prototype.getBoundingClientRect=()=>({left:0,top:0,width:W,height:H});
 // Detail files and the forms archive load synchronously from dist/ in tests.
 window.SOZ_FETCH_JSON=require('./layers.cjs').fetchJSON;
 const counts=canvasMock(window),context=vm.createContext(window);
 // Tests that build their own createModel also need the data layers the page no longer loads.
 if(layers)require('./layers.cjs').loadLayers(context);
 for(const script of window.document.querySelectorAll('script[src]')){const file=script.getAttribute('src').split('?')[0];vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),context,{filename:file});}
 assert.equal(errors.length,0,errors.map(x=>String(x)).join('\n'));
 const $=id=>window.document.getElementById(id),input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new window.Event('input'));};
 const runFrames=(n=120,afterFrame=null)=>{for(let i=0;i<n;i++){now+=1000/60;const queue=[...frames];frames.clear();for(const[,fn]of queue)fn(now);if(queue.length)afterFrame?.();}};
 const pointer=(type,id,x,y,target=$('graph'))=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0});target.dispatchEvent(e);};
 const resize=(w,h)=>{W=w;H=h;window.innerWidth=w;window.innerHeight=h;resizeObservers.forEach(fn=>fn());runFrames(3);};
 return {window,$,input,frames,runFrames,pointer,resize,counts,storage,intervals,errors,captures};
}
module.exports={boot,canvasMock};
