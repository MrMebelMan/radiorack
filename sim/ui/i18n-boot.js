// Loaded in <head> as a classic script (the CSP forbids inline ones): picks the web UI language before the page
// renders and hides the body until ui/i18n.js has translated it, so English doesn't flash.
(() => {
  const LANGS = ['en', 'uk', 'cs', 'sk'];
  let lang = null;
  try { lang = localStorage.getItem('radiorack.lang'); } catch { lang = null; }
  if (!LANGS.includes(lang))
    lang = (navigator.languages || [navigator.language]).map(l => String(l).slice(0, 2).toLowerCase()).find(l => LANGS.includes(l)) || 'en';
  const html = document.documentElement;
  html.lang = lang;
  if (lang !== 'en') {
    html.classList.add('i18n-pending');
    setTimeout(() => html.classList.remove('i18n-pending'), 1500);   // never leave the page blank
  }
})();
