// Web UI translations: every data-i18n* key of every page and every JS string of i18n/en.js is translated in each
// language, nothing unused is left in the dictionaries, and placeholders / markup match the English.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import EN from '../i18n/en.js';

const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const LANGS = ['uk', 'cs', 'sk'];
const PAGES = { landing: 'index.html' };
for (const d of readdirSync(new URL('devices/', root))) PAGES[d] = `devices/${d}/index.html`;
// a key starting with a page id belongs to that page's dictionary, any other to common.js
const fileOf = key => (key.split('.')[0] in PAGES ? key.split('.')[0] : 'common');

const htmlKeys = {};   // key -> English (raw HTML for data-i18n-html, else null)
for (const [page, file] of Object.entries(PAGES)) {
  const html = read(file);
  assert.match(html, new RegExp(`<body data-page="${page}">`), `${file}: data-page`);
  for (const m of html.matchAll(/data-i18n(-html|-title|-aria|-alt)?="([^"]+)"/g)) {
    const key = m[2];
    assert.ok(fileOf(key) === 'common' || fileOf(key) === page, `${file}: ${key} belongs to another page`);
    if (m[1] === '-html') {
      const el = html.match(new RegExp(`<(\\w+)[^>]*data-i18n-html="${key}"[^>]*>([\\s\\S]*?)</\\1>`));
      assert.ok(el, `${file}: element of ${key}`);
      htmlKeys[key] = el[2];
    } else htmlKeys[key] ??= null;
  }
}
// the navbar and footer markup of ui/chrome.js (common keys, plain text)
for (const m of read('ui/chrome.js').matchAll(/data-i18n(?:-title|-aria)?="([^"]+)"/g)) htmlKeys[m[1]] ??= null;

const dicts = {};
for (const l of LANGS)
  for (const f of ['common', ...Object.keys(PAGES)]) {
    const p = new URL(`i18n/${l}/${f}.js`, root);
    assert.ok(existsSync(p), `i18n/${l}/${f}.js missing`);
    dicts[`${l}/${f}`] = (await import(p.href)).default;
  }

const tags = s => (s.match(/<\/?[a-z]+/g) || []).sort().join(' ');
const vars = s => (s.match(/\{\w+\}/g) || []).sort().join(' ');

for (const l of LANGS) {
  test(`${l}: every page key and JS string is translated`, () => {
    for (const key of [...Object.keys(htmlKeys), ...Object.keys(EN)]) {
      const s = dicts[`${l}/${fileOf(key)}`][key];
      assert.equal(typeof s, 'string', `${key} missing in i18n/${l}/${fileOf(key)}.js`);
      assert.ok(s.trim(), `${l} ${key} empty`);
    }
  });
  test(`${l}: no unused or misplaced keys`, () => {
    for (const f of ['common', ...Object.keys(PAGES)])
      for (const key of Object.keys(dicts[`${l}/${f}`])) {
        assert.ok(key in htmlKeys || key in EN, `i18n/${l}/${f}.js: ${key} is not used`);
        assert.equal(fileOf(key), f, `i18n/${l}/${f}.js: ${key} belongs in ${fileOf(key)}.js`);
      }
  });
  test(`${l}: markup and placeholders match the English`, () => {
    for (const [key, en] of Object.entries(htmlKeys))
      if (en !== null) assert.equal(tags(dicts[`${l}/${fileOf(key)}`][key]), tags(en), `${l} ${key}: markup`);
    for (const [key, en] of Object.entries(EN))
      assert.equal(vars(dicts[`${l}/${fileOf(key)}`][key]), vars(en), `${l} ${key}: placeholders`);
  });
}

test('JS t() keys exist in i18n/en.js', () => {
  const files = ['ui/panel.js', ...Object.keys(PAGES).filter(p => p !== 'landing').map(p => `devices/${p}/main.js`)];
  for (const f of files)
    for (const m of read(f).matchAll(/\bt\('([^']+)'/g)) assert.ok(m[1] in EN, `${f}: t('${m[1]}') not in i18n/en.js`);
});

test('every page has the navbar and footer placeholders filled by ui/chrome.js', () => {
  for (const [page, file] of Object.entries(PAGES)) {
    const html = read(file), base = page === 'landing' ? '' : '../../';
    assert.ok(html.includes(`<script src="${base}ui/i18n-boot.js"></script>`), `${file}: boot script`);
    assert.ok(html.includes(`<link rel="stylesheet" href="${base}shared/topbar.css">`), `${file}: topbar.css`);
    assert.match(html, page === 'landing' ? /<nav class="topbar">/ : /<nav class="topbar" data-back><\/nav>/, `${file}: navbar`);
    assert.ok(html.includes('<footer class="site-foot"></footer>'), `${file}: footer`);
  }
  const chrome = read('ui/chrome.js');
  assert.ok(chrome.includes("CONTACT = 'pulse_dr1v3@proton.me'") && chrome.includes('href="mailto:'), 'contact link');
  const langs = [...chrome.matchAll(/\['(\w+)', '(\w+)', '\w+', '[^']+'\]/g)];
  assert.deepEqual(langs.map(l => l[1]), ['en', ...LANGS], 'languages');
  for (const l of langs) assert.ok(existsSync(new URL(`flags/${l[2]}.svg`, root)), `flags/${l[2]}.svg`);
});
