// Garmin GTX 328 LCD: a 200 x 33 dot matrix (Maintenance Manual parts list "LCD,200x33").
// The device's view() lists draw operations in LCD dot coordinates; gtxBitmap() turns them into dots
// (pure, used by the tests too) and createGtxLcd() paints them on a canvas.
import { FONTS, FONT_META, UNITS } from './fonts-gtx.js';

export const LCD_W = 200, LCD_H = 33;

const glyphCache = {};
function glyph(f, ch) {
  const k = f + ch;
  if (!(k in glyphCache)) {
    const g = FONTS[f][ch];
    glyphCache[k] = g ? { dy: g[0], rows: g[1].split('|'), w: g[1].indexOf('|') < 0 ? g[1].length : g[1].indexOf('|') } : null;
  }
  return glyphCache[k];
}
const unitRows = id => UNITS[id].split('|');

// Spacing as measured in the figures: digits are tabular (centered in the font's digit cell), the small font's
// capitals sit in a 5-dot cell, everything else is proportional (ink + 1 dot); fixed-pitch fonts (code digits,
// entry field) take one cell per character.
const BEARING = { s: { '.': [2, 6] } };   // [left bearing, advance] seen in the figures
function layout(f, s) {
  const m = FONT_META[f], out = [];
  let x = 0;
  for (const ch of s) {
    if (m.pitch) {
      const g = ch === ' ' ? null : glyph(f, ch);
      if (g) out.push({ g, x: x + Math.floor((m.pitch - 1 - g.w) / 2) });
      x += m.pitch;
      continue;
    }
    if (ch === ' ') { x += m.space; continue; }
    const g = glyph(f, ch);
    if (!g) { x += m.cell + 1; continue; }
    let lb = 0, adv = g.w + 1;
    const fixed = BEARING[f]?.[ch];
    if (fixed) [lb, adv] = fixed;
    else if (/[0-9]/.test(ch) || (f === 's' && /[A-Z?]/.test(ch))) { const cell = Math.max(g.w, m.cell); lb = Math.floor((cell - g.w) / 2); adv = cell + 1; }
    out.push({ g, x: x + lb });
    x += adv;
  }
  return { items: out, w: m.pitch ? x : Math.max(0, x - 1) };
}
export const textWidth = (f, s) => layout(f, s).w;
export const missingGlyphs = (f, s) => [...s].filter(ch => ch !== ' ' && !glyph(f, ch));

// ops: { t:'txt', f, x, y, s, align:'c'|'r', w } (y = cap top; with align, x..x+w is the box)
//      { t:'unit', id, x, y } | { t:'rect', x, y, w, h } (filled) | { t:'frame', x, y, w, h } (1-dot outline)
//      { t:'inv', x, y, w, h } (inverts what is drawn so far: cursor / highlighted field)
export function gtxBitmap(ops) {
  const px = new Uint8Array(LCD_W * LCD_H);
  const set = (x, y, v = 1) => { if (x >= 0 && x < LCD_W && y >= 0 && y < LCD_H) px[y * LCD_W + x] = v; };
  for (const o of ops || []) {
    if (o.t === 'txt') {
      const { items, w } = layout(o.f, o.s);
      let x0 = o.x;
      if (o.align === 'c') x0 = o.x + Math.floor((o.w - w) / 2);
      else if (o.align === 'r') x0 = o.x + o.w - w;
      for (const it of items) it.g.rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') set(x0 + it.x + i, o.y + it.g.dy + j); });
    } else if (o.t === 'unit') {
      unitRows(o.id).forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') set(o.x + i, o.y + j); });
    } else if (o.t === 'rect') {
      for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) set(x, y);
    } else if (o.t === 'frame') {
      for (let x = o.x; x < o.x + o.w; x++) { set(x, o.y); set(x, o.y + o.h - 1); }
      for (let y = o.y; y < o.y + o.h; y++) { set(o.x, y); set(o.x + o.w - 1, y); }
    } else if (o.t === 'inv') {
      for (let y = Math.max(0, o.y); y < Math.min(LCD_H, o.y + o.h); y++) for (let x = Math.max(0, o.x); x < Math.min(LCD_W, o.x + o.w); x++) px[y * LCD_W + x] ^= 1;
    }
  }
  return px;
}
export const unitWidth = id => UNITS[id].indexOf('|');

// Canvas painter. Each dot's darkness eases toward its target (LCD response), so only dots that change fade
// and a value redrawn unchanged never flickers. Theme: negative (light dots on black) or positive (dark dots
// on a lit background), backlight 0..1, contrast 0..1. The power fade keeps the last frame.
const RESPONSE_MS = 120;
export function createGtxLcd(canvas) {
  const ctx = canvas.getContext('2d');
  const cur = new Float32Array(LCD_W * LCD_H);
  let target = new Uint8Array(LCD_W * LCD_H);
  let last = performance.now(), on = false, power = 0, theme = { pos: false, lit: 1, contrast: 0.5 };
  const pitch = () => canvas.width / LCD_W;
  function paint() {
    const now = performance.now(), dt = Math.min(100, now - last); last = now;
    const k = 1 - Math.exp(-dt / RESPONSE_MS * 2.3);
    power += ((on ? 1 : 0) - power) * (1 - Math.exp(-dt / (on ? 60 : 40)));
    for (let i = 0; i < cur.length; i++) cur[i] += (target[i] - cur[i]) * k;
    const p = pitch(), d = p * 0.92, W = canvas.width, H = canvas.height;
    const lit = theme.lit * power;
    // negative: yellow-green dots on black (manual figures); positive: dark dots on the lit backlight
    const bg = theme.pos ? mix([20, 24, 12], [190, 214, 96], lit) : mix([6, 7, 5], [10, 12, 7], lit);
    const dot = theme.pos ? [14, 18, 8] : mix([40, 48, 14], [212, 240, 64], 0.25 + 0.75 * lit);
    ctx.fillStyle = rgb(bg); ctx.fillRect(0, 0, W, H);
    const off = theme.pos ? mix(bg, dot, 0.04) : mix(bg, dot, 0.025 * power);   // unlit dots barely visible
    ctx.fillStyle = rgb(off);
    for (let y = 0; y < LCD_H; y++) for (let x = 0; x < LCD_W; x++) ctx.fillRect(x * p, y * p, d, d);
    const strength = power * (0.55 + theme.contrast * 0.45);
    for (let y = 0; y < LCD_H; y++) for (let x = 0; x < LCD_W; x++) {
      const v = cur[y * LCD_W + x] * strength;
      if (v < 0.02) continue;
      ctx.fillStyle = rgb(mix(off, dot, v));
      ctx.fillRect(x * p, y * p, d, d);
    }
  }
  function loop() { paint(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  return function render(v) {
    if (v.off) { on = false; return; }   // keep the last frame; it fades with the backlight
    on = true;
    target = gtxBitmap(v.gtx.ops);
    theme = { pos: !!v.gtx.pos, lit: v.gtx.lit ?? 1, contrast: v.gtx.contrast ?? 0.5 };
  };
}
const mix = (a, b, t) => a.map((c, i) => c + (b[i] - c) * Math.max(0, Math.min(1, t)));
const rgb = c => `rgb(${c.map(Math.round).join(',')})`;
