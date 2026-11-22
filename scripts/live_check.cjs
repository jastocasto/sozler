// Smoke test of the live site: loads, search analysis, meaning sheet with origin, noun table. Exit 1 on any failure.
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2] || 'https://soz-toxumasi.vercel.app/';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  let ok = true; const check = (c, m) => { if (!c) { ok = false; console.log('FAIL', m); } };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.SozApp && document.getElementById('mapLoading').hidden, null, { timeout: 120000 });
    await page.waitForFunction(() => document.getElementById('meaningDefinition').textContent !== '…', null, { timeout: 60000 });
    const r = await page.evaluate(async () => {
      const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
      $('search').value = 'kitablarımızdan'; $('search').dispatchEvent(new Event('input')); await wait(400);
      const search = $('searchResults').firstElementChild?.dataset.word;
      window.SozApp.selectWord('çörək'); await wait(2500);
      return { search, word: $('meaningWord').textContent, def: $('meaningDefinition').textContent, table: $('meaningDeclension').innerText.includes('çörəyi'), meter: !$('meaningFrequency').hidden };
    });
    check(r.search === 'kitab', 'search analysis ' + r.search); check(r.word === 'çörək' && r.def.length > 3, 'meaning ' + r.def); check(r.table, 'noun table'); check(r.meter, 'frequency meter');
  } catch (e) { ok = false; console.log('FAIL', e.message); }
  check(!errors.length, 'page errors ' + errors.join(' | '));
  console.log(ok ? 'LIVE CHECK PASS ' + url : 'LIVE CHECK FAIL ' + url);
  await browser.close(); process.exit(ok ? 0 : 1);
})();
