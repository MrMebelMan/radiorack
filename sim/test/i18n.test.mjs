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

test('every page has the navbar with the language picker and the contact footer', () => {
  for (const [page, file] of Object.entries(PAGES)) {
    const html = read(file), base = page === 'landing' ? '' : '../../';
    assert.ok(html.includes(`<script src="${base}ui/i18n-boot.js"></script>`), `${file}: boot script`);
    assert.ok(html.includes(`<link rel="stylesheet" href="${base}shared/topbar.css">`), `${file}: topbar.css`);
    assert.match(html, /<nav class="topbar">/, `${file}: navbar`);
    assert.ok(html.includes('<a href="mailto:pulse_dr1v3@proton.me">'), `${file}: contact footer`);
    assert.equal(html.includes('class="back-btn" href="../../"'), page !== 'landing', `${file}: back button`);
    const opts = [...html.matchAll(/<div role="option" data-lang="(\w+)"[^>]*><img src="([^"]+)"/g)];
    assert.deepEqual(opts.map(o => o[1]), ['en', ...LANGS], `${file}: languages`);
    for (const o of opts) assert.ok(existsSync(new URL(o[2], new URL(file, root))), `${file}: ${o[2]}`);
  }
});
