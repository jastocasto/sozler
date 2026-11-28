/* Recognize Azerbaijani print in a same-origin worker. Images stay in the browser. */
(function (root) {
'use strict';

let loading = null;
function engine(base) {
 if (root.Tesseract) return Promise.resolve(root.Tesseract);
 if (loading) return loading;
 loading = new Promise((resolve, reject) => {
  const script = root.document.createElement('script');
  script.src = new URL('tesseract.min.js', base);
  script.onload = () => root.Tesseract ? resolve(root.Tesseract) : fail();
  script.onerror = fail;
  function fail() { script.remove();reject(new Error('The scan tools could not load. Try again or paste the page text.')); }
  root.document.head.append(script);
 }).catch(error => { loading = null;throw error; });
 return loading;
}

function parsePage(value,{title='',reflow=true}={}) {
 const normalize=text=>text.trim().toLocaleLowerCase('az').replace(/[^\p{L}\p{N}]/gu,'').replace(/ə/g,'e');
 const lines=value.normalize('NFC').replace(/\r\n?/g,'\n').trim().split('\n').map(line=>line.trim());
 const headers=new Set(['Zaur Pənahov','Qaranlıq günəş',title].filter(Boolean).map(normalize));
 while (lines.length&&(!lines[0]||headers.has(normalize(lines[0])))) lines.shift();

 let page='',chapter;
 const folio=lines.at(-1)?.match(/^[–—-]?\s*(\d{1,4})\s*[–—-]?$/u);
 if (lines.length>1&&folio) {
  page=folio[1];lines.pop();
  while (lines.at(-1)==='') lines.pop();
 }
 const first=lines[0]||'';
 const numbered=first.match(/^(?:(fəs[iİ]l)\s+)?(\d{1,3}|[IVXLCDM]{1,7})(?:[.\s:–—-]+(.+))?$/iu);
 if (numbered) {
  const after=lines.findIndex((line,i)=>i>0&&line);
  const heading=numbered[3]||lines[after]||'';
  const bodyStart=numbered[3]?1:after+1;
  const candidate=heading.replace(/[^\p{L}]/gu,'');
  const uppercase=candidate===candidate.toLocaleUpperCase('az')&&candidate!==candidate.toLocaleLowerCase('az');
  if ((numbered[1]||uppercase)&&candidate.length>=2&&heading.length<=120&&lines.slice(bodyStart).some(line=>/\p{L}/u.test(line))) {
   chapter={number:numbered[2],title:heading};lines.splice(0,bodyStart);
  }
 }

 let text=lines.join('\n').trim().replace(/\n{3,}/gu,'\n\n');
 if (reflow) text=text.split(/\n\n+/u).map(block=>block
  .replace(/(\p{L}+)[-‐\u00ad]\n(\p{Ll}+)/gu,(_,left,right)=>left+(left===right?'-':'')+right)
  .replace(/\n/gu,' ')).join('\n\n');
 return {text,page,...(chapter?{chapter}:{})};
}

function png(canvas) {
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('This photo could not be prepared.')),'image/png'));
}

async function photoPixels(file,{spread,rotation}) {
 const uri = URL.createObjectURL(file);
 try {
  const photo = new Image();
  await new Promise((resolve, reject) => {
   photo.onload = resolve;
   photo.onerror = () => reject(new Error('This photo could not open. Choose a JPEG or PNG image.'));
   photo.src = uri;
  });
  const scale = Math.min(1,3200/Math.max(photo.naturalWidth,photo.naturalHeight));
  const width=Math.max(1,Math.round(photo.naturalWidth*scale)),height=Math.max(1,Math.round(photo.naturalHeight*scale));
  const canvas = root.document.createElement('canvas');
  [canvas.width,canvas.height]=rotation%180?[height,width]:[width,height];
  const paint = canvas.getContext('2d', {alpha:false});
  paint.fillStyle='#fff';paint.fillRect(0,0,canvas.width,canvas.height);
  paint.translate(canvas.width/2,canvas.height/2);paint.rotate(rotation*Math.PI/180);
  paint.drawImage(photo,-width/2,-height/2,width,height);
  if (!spread) return [await png(canvas)];
  if (canvas.width<=canvas.height) throw new Error('A spread should be wider than it is tall. Rotate the photo in Photo options, then choose it again.');

  const split=Math.round(canvas.width/2);
  return await Promise.all([[0,split],[split,canvas.width-split]].map(([x,cropWidth])=>{
   const half=root.document.createElement('canvas');
   half.width=cropWidth;half.height=canvas.height;
   half.getContext('2d',{alpha:false}).drawImage(canvas,x,0,cropWidth,canvas.height,0,0,cropWidth,canvas.height);
   return png(half);
  }));
 } finally { URL.revokeObjectURL(uri); }
}

async function scan(file, {title,spread=false,rotation=0,signal,onProgress=()=>{}}={}) {
 const base = new URL('ocr/v6.0.1/', root.document.baseURI);
 let worker, finished = false, timer, cancel, fail;
 const interrupt = new Promise((_, reject) => {
  cancel = () => reject(new DOMException('Scan canceled', 'AbortError'));
  fail = () => reject(new Error('The scan could not finish. Try another photo or paste the page text.'));
  timer = setTimeout(() => reject(new Error('The scan is taking too long. Try a cropped, well-lit photo.')), 85000);
  signal?.addEventListener('abort', cancel, {once:true});
  if (signal?.aborted) cancel();
 });
 const work = async () => {
  const [lib,images]=await Promise.all([engine(base),photoPixels(file,{spread,rotation})]);
  if (finished) return [];
  let current=0;
  const ready = lib.createWorker('aze', lib.OEM.LSTM_ONLY, {
   workerPath:new URL('worker.min.js', base).href,
   corePath:new URL('tesseract-core-lstm.wasm.js', base).href,
   langPath:base.href, workerBlobURL:false, cacheMethod:'none',errorHandler:fail,
   logger:step => { if (!finished && step.status === 'recognizing text') onProgress((current+step.progress)/images.length); }
  });
  worker = await ready;
  if (finished) { await worker.terminate();return []; }
  await worker.setParameters({tessedit_pageseg_mode:lib.PSM.AUTO, preserve_interword_spaces:'0'});
  const pages=[];
  for (const image of images) {
   if (finished) break;
   const {data}=await worker.recognize(image);
   const page=parsePage(data.text,{title});
   if (/\p{L}/u.test(page.text)) pages.push(page);
   current++;
  }
  return pages;
 };
 try { return await Promise.race([work(), interrupt]); }
 finally {
  finished = true;clearTimeout(timer);signal?.removeEventListener('abort', cancel);
  await worker?.terminate().catch(() => {});
 }
}

root.SozReaderOCR = {scan,parsePage};
})(typeof window !== 'undefined' ? window : globalThis);
