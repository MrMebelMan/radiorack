import { TRIG_LOGO } from './logos.js';
import { beckerHtml } from './lcd-becker.js';

// LCD renderer: turns a device view() model into the display's HTML.
const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// graphic CDI (GNC 255 manual 2.3): 5 dots each side, TO/FROM triangle, deflection bar
function cdiSvg(c) {
  const W = 132, H = 16, mid = W / 2, step = 12;
  let g = '';
  for (let i = 1; i <= 5; i++) for (const x of [mid - i * step, mid + i * step]) {
    g += `<path d="M${x} ${H / 2 - 3}l3 3-3 3-3-3z"/>`;
  }
  if (c.loc) g += `<circle cx="${mid}" cy="${H / 2}" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="${mid}" cy="${H / 2}" r="1.6"/>`;
  if (c.toFrom === 'TO') g += `<path d="M${mid} 1l6 13h-12z" fill="none" stroke="currentColor" stroke-width="1.6"/>`;
  if (c.toFrom === 'FROM') g += `<path d="M${mid} 15l6-13h-12z" fill="none" stroke="currentColor" stroke-width="1.6"/>`;
  if (c.needle != null) g += `<rect x="${mid + c.needle * 5 * step - 2}" y="1" width="4" height="${H - 2}"/>`;
  return `<svg class="cdi" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="currentColor" aria-hidden="true">${g}</svg>`;
}

function seg(sg) {
  if (sg.bar !== undefined) return `<span class="bar"><i style="width:${sg.bar}%"></i></span>`;
  if (sg.cdi) return cdiSvg(sg.cdi);
  if (sg.stack) return `<span class="stack">${sg.stack.map(x => `<i>${esc(x)}</i>`).join('')}</span>`;
  const cls = [sg.inv && 'inv', sg.ul && 'ul', sg.big && 'big', sg.small && 'small', sg.tiny && 'tiny', sg.dim && 'dim', sg.box && 'boxed'].filter(Boolean).join(' ');
  let t = esc(sg.t).replace(/ /g, '&nbsp;');
  if (sg.big) t = slots(t);
  return cls ? `<span class="${cls}">${t}</span>` : t;
}
// big digits sit in fixed slots (the font's 1 is much narrower than 2), so values never move
const slots = t => t.replace(/[0-9]/g, '<i class="d">$&</i>');
const segs = a => (a || []).map(seg).join('');

function wrapText(text, width) {
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

// Trig TT31 layout (photos of the unit): top row mode / reply / small value,
// bottom row flight level, then big squawk or Flight ID, or a FUNC page label + value.
// reply indicator as in the photos of the unit: a bell on a thin base, two dimmer horizontal arrows above pointing inwards
const REPLY_SVG = '<svg viewBox="0 0 14 10" width="18" height="13" aria-hidden="true"><path d="M5.3 3.8h3.4l1.3 4.4H4zM1 8.6h12v1.1H1z" fill="currentColor"/>'
  + '<path d="M.6 1.6H4.4M3.2.4l1.2 1.2-1.2 1.2M13.4 1.6H9.6M10.8.4 9.6 1.6l1.2 1.2" fill="none" stroke="currentColor" stroke-width=".9" opacity=".45"/></svg>';
const cell = (c, h, key = c) => `<span class="${c} cell" data-c="${key}"><span class="cl">${h}</span></span>`;
// text one character per cell, so only a changed character fades; digits get a fixed slot (the font's 4 and 5 are narrower)
const charCells = a => (a || []).flatMap(sg => [...(sg.t || '')].map(ch => ({ ...sg, t: ch }))).map((sg, i) => cell(/[0-9]/.test(sg.t) ? 'ch dg' : 'ch', seg(sg), `ch${i}`)).join('');
const xpdrLayout = x => x.boot ? 'boot' : x.alert ? 'alert' : 'main';
function xpdrHtml(x) {
  if (x.boot) return `<div class="xboot"><div class="xlogo">${x.boot.logo === 'TRIG' ? TRIG_LOGO : esc(x.boot.logo)}</div><div class="xlines">${x.boot.lines.map(l => `<div>${esc(l)}</div>`).join('')}</div></div>`;
  if (x.alert) return `<div class="xalert"><div>${esc(x.alert.title)}</div><div>${esc(x.alert.text)}${x.alert.key ? ` <span class="inv">${esc(x.alert.key)}</span>` : ''}</div></div>`;
  const ptr = x.pointer === 'up' ? '&#9650;' : x.pointer === 'down' ? '&#9660;' : x.pointer === 'level' ? '&#9670;' : '';
  let right;
  if (x.lines) right = `<div class="xlabel">${x.label.map(l => `<div>${segs(l)}</div>`).join('')}</div><div class="xlines2">${x.lines.map(l => `<div>${segs(l)}</div>`).join('')}</div>`;
  else if (x.label) right = `<div class="xlabel${x.wide ? ' wide' : ''}">${x.label.map(l => `<div>${segs(l)}</div>`).join('')}</div>${x.big ? `<div class="xbig">${charCells(x.big)}</div>` : ''}`;
  else right = `<div class="xbig">${charCells(x.big)}</div>`;
  return `<div class="xtop">${cell('xmode', charCells([{ t: x.mode }]))}<span class="xc">${cell('xreply', x.reply ? REPLY_SVG : '')}${cell('xid', x.ident ? 'IDENT' : '')}</span>${cell('xsmall', charCells(x.small))}</div>`
    + `<div class="xbot">${cell('xfl', charCells([{ t: x.fl }]) + cell('xptr', ptr))}${cell('xr', right)}</div>`;
}

export function lcdHtml(v) {
  if (v.off) return '';
  if (v.xpdr) return xpdrHtml(v.xpdr);
  if (v.bk) return beckerHtml(v.bk);
  if (v.splash) return `<div class="splash">${v.splash[0] ? `<div class="logo">${esc(v.splash[0])}</div>` : ''}${v.splash.slice(1).map(l => `<div class="mid">${esc(l)}</div>`).join('')}</div>`;
  if (v.message !== undefined) {
    const lines = wrapText(v.message, 34).slice(0, 2);
    return `<div class="msgfull">${lines.map(esc).join('<br>')}</div><div class="bl">${segs(v.bottomLeft)}</div>`;
  }
  const r = v.right;
  let h = `<div class="ann"><div class="top">${v.ann}</div><div>ACT</div></div>`;
  h += `<div class="act"><span class="big">${slots(esc(v.act))}</span></div>`;
  if (r.type === 'com') {
    h += `<div class="comann">${r.ann ?? (r.com ? 'COM' : '')}</div><div class="lab">${r.label}</div>`;
    h += `<div class="stb">${r.big.map(x => seg({ ...x, big: true })).join('')}</div>`;
  } else if (r.type === 'menu') {
    h += `<div class="rmenu">${r.lines.map(l => `<div class="mline">${segs(l)}</div>`).join('')}</div>`;
  } else if (r.type === 'page') {
    const cls = ['rpage', v.bottomFull ? 'short' : '', r.rows.length > 2 ? 'three' : ''].join(' ');
    h += `<div class="${cls}"><div class="title">${esc(r.title)}</div>${r.rows.map(row => `<div class="row">${segs(row)}</div>`).join('')}</div>`;
  }
  if (v.bottomFull) {
    const rich = v.bottomFull.some(x => x.stack || x.cdi);   // DST / CDI / COM VOL+NAV rows
    h += `<div class="bfull${rich ? ' rich' : ''}">${segs(v.bottomFull)}</div>`;
  } else {
    h += `<div class="bl${v.promptWide ? ' wide' : ''}">${segs(v.bottomLeft)}</div>`;
    if (r.type === 'com') {
      const isTimer = /^\d\d:\d\d:\d\d$/.test(v.bottomRight?.[0]?.t || '');
      h += `<div class="br${isTimer ? ' timer' : ''}">${segs(v.bottomRight)}</div>`;
    }
  }
  return h;
}


// Renders into the .lcd element; returns render(view).
// TT31: what changed fades in while the old content fades out, both at once; unchanged text stays.
// Same layout: only the cells whose content changed fade. New layout (boot, warning): the whole frame.
// Layers add up (plus-lighter), so pixels lit in both stay at full brightness.
export const XFADE_MS = 150;
function fadeIn(box, cls, html) {
  for (const old of box.querySelectorAll(`:scope > .${cls}:not(.gone)`)) {
    old.classList.add('gone');
    const from = +getComputedStyle(old).opacity;
    old.getAnimations().forEach(a => a.cancel());
    old.style.opacity = '0';
    old.animate([{ opacity: from }, { opacity: 0 }], { duration: XFADE_MS * from }).onfinish = () => old.remove();
  }
  const el = document.createElement(box.tagName === 'SPAN' ? 'span' : 'div');
  el.className = cls;
  el.innerHTML = html;
  box.appendChild(el);
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: XFADE_MS });
  return el;
}
// cells directly under root (not nested in another cell)
const topCells = root => [...root.querySelectorAll('[data-c]')].filter(c => c.parentElement.closest('[data-c]') === root.closest('[data-c]'));
// a cell's markup with its nested cells emptied: same skeleton -> only the nested cells that changed fade
function skeleton(cl) { const c = cl.cloneNode(true); c.querySelectorAll('[data-c]').forEach(k => { k.innerHTML = ''; }); return c.innerHTML; }
function syncCell(oc, nc) {
  const want = nc.firstChild, have = oc.querySelector(':scope > .cl:not(.gone)');
  if (have && have.innerHTML === want.innerHTML) return;
  if (!have || skeleton(have) !== skeleton(want) || !want.querySelector('[data-c]')) { fadeIn(oc, 'cl', want.innerHTML); return; }
  for (const k of topCells(want)) syncCell(have.querySelector(`[data-c="${k.dataset.c}"]`), k);
}
function xpdrRender(lcd, x, fade) {
  const html = xpdrHtml(x), layout = xpdrLayout(x);
  let stack = lcd.querySelector(':scope > .xs');
  if (!stack) { lcd.innerHTML = '<div class="xs"></div>'; stack = lcd.firstChild; fade = false; }
  const cur = stack.querySelector(':scope > .xl:not(.gone)');
  if (!fade || !cur) { stack.innerHTML = ''; const el = document.createElement('div'); el.className = 'xl'; el.dataset.l = layout; el.innerHTML = html; stack.appendChild(el); return; }
  if (cur.dataset.l !== layout) { fadeIn(stack, 'xl', html).dataset.l = layout; return; }
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  for (const nc of topCells(tmp)) syncCell(cur.querySelector(`[data-c="${nc.dataset.c}"]`), nc);
}

export function createLcd(lcd) {
  let lastHtml = null;
  return function render(v) {
    // when switching off keep the last frame so it fades out with the backlight
    const html = v.off ? lastHtml : lcdHtml(v);
    if (html !== null && html !== lastHtml) {
      if (v.xpdr) xpdrRender(lcd, v.xpdr, !lcd.classList.contains('off'));   // no fade at power-up
      else lcd.innerHTML = html;
      lastHtml = html;
    }
    lcd.classList.toggle('off', !!v.off);
    if (v.off) return; // keep the last frame's layout untouched while it fades out
    lcd.classList.toggle('splashing', !!v.splash);
    const com = !!(v.right && v.right.type === 'com');
    lcd.classList.toggle('cg', com);
    lcd.classList.toggle('pg', !!v.right && !com);
    lcd.classList.toggle('mg', v.message !== undefined);
    lcd.classList.toggle('xp', !!v.xpdr);
    lcd.classList.toggle('bk', !!v.bk);
    if (v.bk) {   // Becker: backlight level and the short whole-display inversion
      lcd.style.setProperty('--lit', v.bk.lit.toFixed(2));
      lcd.classList.toggle('flash', !!v.bk.flash);
    }
    // backlight following the photocell (cockpit light); about unchanged at 60 %
    const photo = v.photo === undefined ? 1 : 0.55 + 0.75 * v.photo / 100;
    if (v.brt === undefined) { lcd.style.filter = v.photo === undefined ? '' : `brightness(${photo.toFixed(2)})`; return; }
    const b = v.brt, c = v.contrast ?? 0;   // Garmin: DSPL BRT is an offset from the automatic level (Pilot's Guide 3.4.3)
    lcd.style.filter = `brightness(${(photo * (0.75 + (b + 10) / 110 * 0.5)).toFixed(2)}) contrast(${(1 + c / 100).toFixed(2)})`;
  };
}
