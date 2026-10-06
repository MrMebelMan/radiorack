// Link previews: every page has the Open Graph / Twitter tags, and its og:image exists in og/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const SITE = 'https://radiorack.dr1v3.cz/';
const root = new URL('../', import.meta.url);
const pages = ['index.html', ...readdirSync(new URL('devices/', root)).map(d => `devices/${d}/index.html`)]
  .filter(p => existsSync(new URL(p, root)));
const meta = (html, attr, key) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`))?.[1];

for (const p of pages) {
  test(`${p}: Open Graph tags`, () => {
    const html = readFileSync(new URL(p, root), 'utf8');
    for (const k of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt'])
      assert.ok(meta(html, 'property', k), `${k} missing`);
    assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image');
    assert.equal(meta(html, 'name', 'description'), meta(html, 'property', 'og:description'));
    assert.equal(meta(html, 'property', 'og:url'), SITE + p.replace(/index\.html$/, ''));
    const img = meta(html, 'property', 'og:image');
    assert.match(img, new RegExp(`^${SITE}og/[a-z0-9]+\\.jpg$`));
    assert.ok(existsSync(new URL(img.slice(SITE.length), root)), `${img} not in sim/og/`);
  });
}
