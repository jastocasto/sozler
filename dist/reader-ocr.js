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

async function photoPixels(file) {
 const uri = URL.createObjectURL(file);
 try {
  const photo = new Image();
  await new Promise((resolve, reject) => {
   photo.onload = resolve;
   photo.onerror = () => reject(new Error('This photo could not open. Choose a JPEG or PNG image.'));
   photo.src = uri;
  });
  const canvas = root.document.createElement('canvas');
  const scale = Math.min(1, 2550 / Math.max(photo.naturalWidth, photo.naturalHeight));
  canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
  const paint = canvas.getContext('2d', {alpha:false});
  paint.fillStyle = '#fff';paint.fillRect(0, 0, canvas.width, canvas.height);paint.drawImage(photo, 0, 0, canvas.width, canvas.height);
  return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('This photo could not be prepared.')), 'image/png'));
 } finally { URL.revokeObjectURL(uri); }
}

async function scan(file, {signal, onProgress = () => {}} = {}) {
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
  const [lib, image] = await Promise.all([engine(base), photoPixels(file)]);
  if (finished) return '';
  const ready = lib.createWorker('aze', lib.OEM.LSTM_ONLY, {
   workerPath:new URL('worker.min.js', base).href,
   corePath:new URL('tesseract-core-lstm.wasm.js', base).href,
   langPath:base.href, workerBlobURL:false, cacheMethod:'none',errorHandler:fail,
   logger:step => { if (!finished && step.status === 'recognizing text') onProgress(step.progress); }
  });
  worker = await ready;
  if (finished) { await worker.terminate();return ''; }
  await worker.setParameters({tessedit_pageseg_mode:lib.PSM.AUTO, preserve_interword_spaces:'0'});
  const {data} = await worker.recognize(image);
  return data.text.normalize('NFC').trim();
 };
 try { return await Promise.race([work(), interrupt]); }
 finally {
  finished = true;clearTimeout(timer);signal?.removeEventListener('abort', cancel);
  await worker?.terminate().catch(() => {});
 }
}

root.SozReaderOCR = {scan};
})(typeof window !== 'undefined' ? window : globalThis);
