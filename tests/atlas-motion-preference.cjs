const assert=require('node:assert/strict');
const {boot}=require('./galaxy-harness.cjs');

const key='soz-toxumasi:motion';
const storage=new Map([[key,'reduced']]);

function openMap(path,{systemReduced=true,blocked=false,legacy=false}={}){
  return boot({width:390,height:844,reduced:systemReduced,configureWindow(window){
    window.location=new URL(path,'https://soz.test/');
    window.URL=URL;
    window.URLSearchParams=URLSearchParams;
    window.history.replaceState=(state,title,path)=>{
      window.history.state=state;
      window.location.href=new URL(path,window.location.href).href;
    };
    window.localStorage={
      getItem(key){if(blocked)throw Error('Storage denied');return storage.get(key)??null;},
      setItem(key,value){if(blocked)throw Error('Storage denied');storage.set(key,value);}
    };
    if(legacy){
      const media=window.matchMedia(),listen=media.addEventListener;
      media.addListener=fn=>listen('change',fn);
      delete media.addEventListener;
    }
  }});
}

function choose(h,choice){
  h.$('motionPreference').value=choice;
  h.$('motionPreference').dispatchEvent(new h.window.Event('change',{bubbles:true}));
}
function mode(h,choice,effective){
  assert.equal(h.$('motionPreference').value,choice);
  assert.equal(h.$('map').dataset.motionPreference,choice);
  assert.equal(h.$('map').dataset.motion,effective);
}
function landed(h,word){
  const state=h.window.SozApp.inspect();
  assert.equal(state.selected,word);
  assert.equal(state.cameraTravelling,false);
  assert.equal(state.settled,true);
  assert(state.particles.length>1);
  assert(state.particles.every(p=>!p.waiting&&Math.hypot(p.x-p.targetX,p.y-p.targetY)<.01));
}

{
  const h=openMap('/?ref=friend&motion=full#w=g%C3%B6z%C9%99l');
  mode(h,'full','full');
  assert.equal(storage.get(key),'reduced','a shared link leaves the saved choice in place');
  const flight=h.window.SozApp.inspect();
  assert.equal(flight.selected,'gözəl');
  assert(flight.cameraTravelling&&flight.particles.some(p=>p.waiting),'a word link launches the camera and holds its family on OS Reduce Motion');
  h.runFrames(6);
  assert.notDeepEqual(h.window.SozApp.inspect().camera,flight.camera);
  h.setReducedMotion(false);h.setReducedMotion(true);
  assert(h.window.SozApp.inspect().cameraTravelling,'an explicit full flight survives OS changes');
  h.window.SozApp.selectWord('kitab');
  assert.equal(h.window.location.searchParams.get('motion'),'full','word navigation preserves the shared mode');
  h.$('menuButton').click();
  assert(h.$('menuDialog').hasAttribute('open'));
  assert.equal(h.$('menuDialog').querySelector('label[for=motionPreference]').textContent,'Xəritə animasiyaları');
  choose(h,'reduced');
  mode(h,'reduced','reduced');landed(h,'kitab');
  assert.equal(h.window.location.search,'?ref=friend');
  assert.equal(h.window.location.hash,'#w=kitab');
  h.setReducedMotion(false);mode(h,'reduced','reduced');
  choose(h,'system');mode(h,'system','full');
  h.window.SozApp.selectWord('söz');
  assert(h.window.SozApp.inspect().cameraTravelling);
  h.setReducedMotion(true);mode(h,'system','reduced');landed(h,'söz');
  h.setReducedMotion(false);mode(h,'system','full');
  h.window.SozApp.selectWord('gözəl');
  const doc=h.window.document;
  Object.defineProperty(doc,'hidden',{configurable:true,writable:true,value:true});
  doc.dispatchEvent(new h.window.Event('visibilitychange'));
  h.setReducedMotion(true);h.setReducedMotion(false);
  doc.hidden=false;doc.dispatchEvent(new h.window.Event('visibilitychange'));
  h.runFrames(2);
  landed(h,'gözəl');
  choose(h,'full');
  assert.equal(storage.get(key),'full');
}
{
  const h=openMap('/?motion=%E0%A4%A#w=kitab',{legacy:true});
  mode(h,'full','full');
  assert(h.window.SozApp.inspect().cameraTravelling,'an invalid parameter falls back to the saved choice');
  choose(h,'system');mode(h,'system','reduced');landed(h,'kitab');
  h.setReducedMotion(false);mode(h,'system','full');
}
{
  const h=openMap('/?motion=reduced#w=kitab',{systemReduced:false,blocked:true});
  mode(h,'reduced','reduced');landed(h,'kitab');
  choose(h,'full');mode(h,'full','full');
  h.window.SozApp.selectWord('söz');
  assert(h.window.SozApp.inspect().cameraTravelling);
  assert.equal(h.window.location.searchParams.get('motion'),'full','a denied storage write keeps the choice in this URL');
  assert.equal(decodeURIComponent(h.window.location.hash),'#w=söz');
  assert.equal(storage.get(key),'system');
}
{
  const h=openMap('/?motion=unknown#w=kitab',{blocked:true});
  mode(h,'system','reduced');landed(h,'kitab');
}
console.log('PASS: shared motion links, interrupted flights, OS changes, accessible preferences and restricted storage.');
