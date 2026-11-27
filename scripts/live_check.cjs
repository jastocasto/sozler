// Smoke test of the live site: loads, search analysis, meaning sheet with origin, noun table. Exit 1 on any failure.
const { chromium } = require('playwright');
function wordKeyIsVisible() {
  const card = document.getElementById('meaningCard').getBoundingClientRect();
  const keys = [...document.querySelectorAll('#mapFilterKeys button')];
  const expected = ['Kök', 'Sinonim', 'Antonim', 'Mövzu', 'Sonluq'];
  return card.height > 0 && keys.length === expected.length && keys.every((button, i) => {
    const r = button.getBoundingClientRect();
    return button.textContent === expected[i] && r.top >= card.bottom && r.bottom <= innerHeight &&
      r.left >= 0 && r.right <= innerWidth && r.height >= 44 && r.width >= 44 &&
      button.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
}
(async () => {
  const url = process.argv[2] || 'https://soz-toxumasi.vercel.app/';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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
    check(await page.evaluate(wordKeyIsVisible), 'relationship key under the compact word card');
    await page.locator('#sheetToggle').click();
    check(await page.evaluate(wordKeyIsVisible), 'relationship key under the expanded word card');
    const synonym = page.locator('#mapFilterKeys button[data-type=syn]');
    const original = await synonym.getAttribute('aria-pressed');
    await synonym.press('Space');
    check(await synonym.getAttribute('aria-pressed') !== original, 'relationship key toggles from the keyboard');
    await synonym.press('Space');
    check(await synonym.getAttribute('aria-pressed') === original, 'relationship filter restores its original state');
  } catch (e) { ok = false; console.log('FAIL', e.message); }
  check(!errors.length, 'page errors ' + errors.join(' | '));
  console.log(ok ? 'LIVE CHECK PASS ' + url : 'LIVE CHECK FAIL ' + url);
  await browser.close(); process.exit(ok ? 0 : 1);
})();
