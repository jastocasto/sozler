const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const base = 'https://example.test/soz/';
const clip = 'study-audio/cv10-29987089.mp3';
const bytes = fs.readFileSync('dist/' + clip);
const hash = crypto.createHash('sha256').update(bytes).digest('hex');
const entries = new Map([
  [base + 'index.html', new Response('SÖZ')],
  [base + 'plain.txt', new Response('unchanged')],
  [base + clip, new Response(bytes, {headers: {'Content-Type':'audio/mpeg', ETag:'"clip"'}})]
]);
const state = {cache:'downloaded', hashes:{[clip]:hash}};
const meta = new Map([[base + '__ready__', Response.json(state)]]);
const stores = new Map([['soz-offline-state', meta], ['downloaded', entries]]);
const caches = {
  has: async name => stores.has(name),
  open: async name => ({match: async url => stores.get(name).get(url)?.clone()})
};
let fetchEvent;
const self = {
  registration: {scope:base},
  addEventListener(type, handler) {if (type === 'fetch') fetchEvent = handler;}
};
let live;
vm.runInNewContext(fs.readFileSync('dist/sw.js','utf8'), {
  self, caches, URL, Request, Response, Headers,
  fetch: async () => {if (live) return live.clone(); throw new Error('offline');}
});
function get(range, file = clip, extra = {}) {
  const headers = new Headers(extra);
  if (range) headers.set('Range',range);
  let response;
  fetchEvent({request:new Request(base + file,{headers}),respondWith:value => {response=value;}});
  return response;
}
async function expectRange(range, start, end, file, headers) {
  const result = await get(range,file,headers);
  assert.equal(result.status,206);
  assert.equal(result.headers.get('Content-Type'),'audio/mpeg');
  assert.equal(result.headers.get('Accept-Ranges'),'bytes');
  assert.equal(result.headers.get('Content-Range'),`bytes ${start}-${end}/${bytes.length}`);
  assert.equal(Number(result.headers.get('Content-Length')),end - start + 1);
  assert.deepEqual(Buffer.from(await result.arrayBuffer()),bytes.subarray(start,end + 1));
}
(async () => {
  await expectRange('bytes=0-1',0,1);
  await expectRange('bytes=2-',2,bytes.length-1);
  await expectRange('bytes=-5',bytes.length-5,bytes.length-1);
  await expectRange('bytes=-99999999',0,bytes.length-1);
  await expectRange('bytes=3-99999999',3,bytes.length-1,clip+'?v='+hash.slice(0,16));
  await expectRange('bytes=9-19',9,19,clip,{'If-Range':'"clip"'});
  for (const range of ['bytes=6-4','bytes=-0','bytes='+bytes.length+'-']) {
    const result = await get(range);
    assert.equal(result.status,416);
    assert.equal(result.headers.get('Content-Range'),'bytes */'+bytes.length);
    assert.equal((await result.arrayBuffer()).byteLength,0);
  }
  for (const range of [null,'bytes=banana','bytes=0-1,3-4']) {
    const result = await get(range);
    assert.equal(result.status,200);
    assert.deepEqual(Buffer.from(await result.arrayBuffer()),bytes);
  }
  assert.equal((await get('bytes=0-1',clip,{'If-Range':'"old"'})).status,200);
  assert.equal((await get('bytes=0-1','plain.txt')).status,200);
  live = new Response('ok',{status:206,headers:{'Content-Range':'bytes 0-1/2'}});
  assert.equal(await (await get('bytes=0-1')).text(),'ok');
  console.log('PASS cached study audio serves byte probes, open/closed/suffix ranges, seeks and 416s; online and other assets retain their behavior.');
})().catch(err => {console.error(err);process.exitCode=1;});
