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
  const t = esc(sg.t).replace(/ /g, '&nbsp;');
  return cls ? `<span class="${cls}">${t}</span>` : t;
}
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

export function lcdHtml(v) {
  if (v.off) return '';
  if (v.splash) return `<div class="splash">${v.splash[0] ? `<div class="logo">${esc(v.splash[0])}</div>` : ''}${v.splash.slice(1).map(l => `<div class="mid">${esc(l)}</div>`).join('')}</div>`;
  if (v.message !== undefined) {
    const lines = wrapText(v.message, 34).slice(0, 2);
    return `<div class="msgfull">${lines.map(esc).join('<br>')}</div><div class="bl">${segs(v.bottomLeft)}</div>`;
  }
  const r = v.right;
  let h = `<div class="ann"><div class="top">${v.ann}</div><div>ACT</div></div>`;
  h += `<div class="act"><span class="big">${v.act}</span></div>`;
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
export function createLcd(lcd) {
  let lastHtml = null;
  return function render(v) {
    // when switching off keep the last frame so it fades out with the backlight
    const html = v.off ? lastHtml : lcdHtml(v);
    if (html !== null && html !== lastHtml) { lcd.innerHTML = html; lastHtml = html; }
    lcd.classList.toggle('off', !!v.off);
    if (v.off) return; // keep the last frame's layout untouched while it fades out
    lcd.classList.toggle('splashing', !!v.splash);
    const com = !!(v.right && v.right.type === 'com');
    lcd.classList.toggle('cg', com);
    lcd.classList.toggle('pg', !!v.right && !com);
    lcd.classList.toggle('mg', v.message !== undefined);
    const b = v.brt ?? 0, c = v.contrast ?? 0;
    lcd.style.filter = `brightness(${(0.75 + (b + 10) / 110 * 0.5).toFixed(2)}) contrast(${(1 + c / 100).toFixed(2)})`;
  };
}
