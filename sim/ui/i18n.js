// Web UI translations: the page around the unit (navbar, header, panels, status line, procedures, tooltips).
// The units themselves (LCD, bezel labels, key names) stay English. English is the page's own HTML; elements carry
//   data-i18n="key" (text), data-i18n-html="key" (markup), data-i18n-title / -aria / -alt="key" (attributes)
// and i18n/<lang>/common.js + i18n/<lang>/<page>.js hold the translations (<page> = <body data-page>).
// Strings built in JS go through t(); their English is in i18n/en.js. Language picked by ui/i18n-boot.js.
import EN from '../i18n/en.js';

export const LANGS = ['en', 'uk', 'cs', 'sk'];
const STORE = 'radiorack.lang';
const html = document.documentElement;
const page = document.body.dataset.page;
const ATTRS = [['i18nTitle', 'title'], ['i18nAria', 'aria-label'], ['i18nAlt', 'alt']];
const SELECTOR = '[data-i18n],[data-i18n-html],[data-i18n-title],[data-i18n-aria],[data-i18n-alt]';

let cur = 'en', dict = {};
const orig = new WeakMap();   // element -> its English, so switching back needs no reload
const listeners = [];

export const lang = () => cur;
// Translation of a key, or undefined in English / when missing (callers fall back to their own English).
export const translated = key => dict[key];
export function t(key, vars) {
  let s = dict[key] ?? EN[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}
// fn() now and after every language change.
export function onLang(fn) { listeners.push(fn); fn(); }

async function load(l) {
  if (l === 'en') return {};
  const mods = await Promise.all([`${l}/common.js`, `${l}/${page}.js`].map(f => import(new URL(`../i18n/${f}`, import.meta.url).href)));
  return Object.assign({}, ...mods.map(m => m.default));
}

// the English of an element, remembered before anything is replaced
function english(el) {
  let o = orig.get(el);
  if (!o) {
    const d = el.dataset;
    o = {};
    if (d.i18n) o.text = el.textContent;
    if (d.i18nHtml) o.html = el.innerHTML;
    for (const [k, attr] of ATTRS) if (d[k]) o[attr] = el.getAttribute(attr);
    orig.set(el, o);
  }
  return o;
}

function apply() {
  for (const el of document.querySelectorAll(SELECTOR)) {
    const d = el.dataset, o = english(el);
    if (d.i18n) el.textContent = dict[d.i18n] ?? o.text;
    if (d.i18nHtml) el.innerHTML = dict[d.i18nHtml] ?? o.html;
    for (const [k, attr] of ATTRS) if (d[k]) el.setAttribute(attr, dict[d[k]] ?? o[attr]);
  }
}

export async function setLang(l, save = true) {
  if (!LANGS.includes(l)) l = 'en';
  try { dict = await load(l); } catch (e) { console.error(e); dict = {}; l = 'en'; }
  cur = l;
  html.lang = l;
  if (save) try { localStorage.setItem(STORE, l); } catch { /* private mode */ }
  apply();
  syncPicker();
  html.classList.remove('i18n-pending');
  for (const fn of listeners) fn();
}

// navbar language picker: button + listbox of flags
const btn = document.getElementById('langBtn'), list = document.getElementById('langList');
const opts = list ? [...list.querySelectorAll('[role=option]')] : [];
function syncPicker() {
  if (!btn) return;
  const o = opts.find(x => x.dataset.lang === cur) || opts[0];
  btn.querySelector('img').src = o.querySelector('img').src;
  btn.querySelector('.code').textContent = o.querySelector('.code').textContent;
  for (const x of opts) x.setAttribute('aria-selected', x === o);
}
function open(focusOpt = true) {
  list.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  if (focusOpt) (opts.find(x => x.dataset.lang === cur) || opts[0]).focus();
}
function close(focusBtn = false) {
  list.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
  if (focusBtn) btn.focus();
}
function pick(o) { close(true); if (o.dataset.lang !== cur) setLang(o.dataset.lang); }
if (btn && list) {
  btn.addEventListener('click', () => (list.hidden ? open(false) : close()));
  btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
  for (const o of opts) o.addEventListener('click', () => pick(o));
  list.addEventListener('keydown', e => {
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); opts[(i + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length].focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); opts[e.key === 'Home' ? 0 : opts.length - 1].focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) pick(opts[i]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close();
  });
  document.addEventListener('pointerdown', e => { if (!list.hidden && !e.target.closest('.lang')) close(); });
}

await setLang(LANGS.includes(html.lang) ? html.lang : 'en', false);
