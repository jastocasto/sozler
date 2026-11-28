/* The Study desk and the full-screen reader share an appearance preference. */
(function (root) {
'use strict';
const doc=root.document, html=doc.documentElement;
const storageKey='soz-toxumasi:study-theme';
const shapes={
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 moon:'<path d="M20.7 14.3A9 9 0 0 1 9.7 3.3a9 9 0 1 0 11 11Z"/>'
};
function paint(button) {
 const dark=html.dataset.sozTheme==='dark';
 button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');
 button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+shapes[dark?'sun':'moon']+'</svg>';
}
function setTheme(dark) {
 html.dataset.sozTheme=dark?'dark':'light';
 for (const control of doc.querySelectorAll('.study-theme-toggle')) paint(control);
}
try { setTheme(root.localStorage.getItem(storageKey)==='dark'); } catch {}
function button(owner,extra='') {
 const control=owner.createElement('button');
 control.type='button';
 control.className=extra?'study-theme-toggle '+extra:'study-theme-toggle';
 paint(control);
 control.addEventListener('click',()=>{
  setTheme(html.dataset.sozTheme!=='dark');
  try { root.localStorage.setItem(storageKey,html.dataset.sozTheme); } catch {}
 });
 return control;
}
root.SozTheme={button};
})(window);
