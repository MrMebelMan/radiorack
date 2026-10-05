// LCD renderer: turns a device view() model into the display's HTML.
const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function seg(sg) {
  if (sg.bar !== undefined) return `<span class="bar"><i style="width:${sg.bar}%"></i></span>`;
  const cls = [sg.inv && 'inv', sg.ul && 'ul', sg.big && 'big', sg.small && 'small', sg.dim && 'dim', sg.box && 'boxed'].filter(Boolean).join(' ');
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
  if (v.splash) {
    return `<div class="splash"><div class="logo">${v.splash[0]}</div><div class="mid">${esc(v.splash[1])}</div><div>${esc(v.splash[2])}</div></div>`;
  }
  const r = v.right;
  let h = `<div class="ann"><div class="top">${v.ann}</div><div>ACT</div></div>`;
  h += `<div class="act"><span class="big">${v.act}</span></div>`;
  if (r.type === 'com') {
    h += `<div class="comann">${r.com ? 'COM' : ''}</div><div class="lab">${r.label}</div>`;
    h += `<div class="stb">${r.big.map(x => seg({ ...x, big: true })).join('')}</div>`;
  } else if (r.type === 'page') {
    const cls = ['rpage', v.bottomFull ? 'short' : '', r.rows.length > 2 ? 'three' : ''].join(' ');
    h += `<div class="${cls}"><div class="title">${esc(r.title)}</div>${r.rows.map(row => `<div class="row">${segs(row)}</div>`).join('')}</div>`;
  } else if (r.type === 'msg') {
    h += `<div class="msg"><div class="title">${r.title}</div>${wrapText(r.text, 30).map(esc).join('<br>')}</div>`;
  }
  if (v.bottomFull) {
    h += `<div class="bfull">${segs(v.bottomFull)}</div>`;
  } else {
    h += `<div class="bl${v.promptWide ? ' wide' : ''}">${segs(v.bottomLeft)}</div>`;
    if (r.type === 'com') {
      const isTimer = /^\d\d:\d\d:\d\d$/.test(v.bottomRight?.[0]?.t || '');
      h += `<div class="br${isTimer ? ' timer' : ''}">${segs(v.bottomRight)}</div>`;
    }
  }
  if (v.locked) h += `<div class="lockbadge">LOCK</div>`;
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
    const b = v.brt ?? 0, c = v.contrast ?? 0;
    lcd.style.filter = `brightness(${(0.75 + (b + 10) / 110 * 0.5).toFixed(2)}) contrast(${(1 + c / 100).toFixed(2)})`;
  };
}
