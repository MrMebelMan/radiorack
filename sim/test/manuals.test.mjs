// Manual links: every data-manual link has a source URL and a PDF in manuals/, and every manual is linked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { MANUALS, manualFile } from '../data/manuals.js';

const root = new URL('../', import.meta.url);
const pages = ['index.html', ...readdirSync(new URL('devices/', root)).map(d => `devices/${d}/index.html`)]
  .filter(p => existsSync(new URL(p, root)));
const links = pages.flatMap(p =>
  [...readFileSync(new URL(p, root), 'utf8').matchAll(/<a [^>]*data-manual="([^"]+)"[^>]*href="([^"]+)"/g)]
    .map(([, id, href]) => ({ page: p, id, href })));

test('every manual link names a known manual and points at its PDF', () => {
  assert.ok(links.length > 0);
  for (const { page, id, href } of links) {
    assert.ok(MANUALS[id], `${page}: unknown manual ${id}`);
    assert.ok(href.endsWith(`manuals/${manualFile(id)}`), `${page}: ${id} links ${href}`);
  }
});

test('every manual has its PDF and an http(s) source, and is linked', () => {
  const linked = new Set(links.map(l => l.id));
  for (const [id, { source }] of Object.entries(MANUALS)) {
    assert.ok(existsSync(new URL(`manuals/${manualFile(id)}`, root)), `missing manuals/${manualFile(id)}`);
    assert.match(source, /^https?:\/\/\S+$/, id);
    assert.ok(linked.has(id), `${id} is not linked from any page`);
  }
});

test('no manual link bypasses the switch', () => {
  for (const p of pages) {
    const html = readFileSync(new URL(p, root), 'utf8');
    for (const [a] of html.matchAll(/<a [^>]*href="[^"]*manuals\/[^"]*"[^>]*>/g))
      assert.match(a, /data-manual=/, `${p}: ${a}`);
  }
});
