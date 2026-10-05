// Becker AR6201 display: annunciator column on the left, active frequency on top and the
// second line (preset / battery / channel / storage / message) below; menus, setup pages and
// the WAIT / FAILURE / PASSWORD screens (Operating Instructions and Installation Manual figures).
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// digits as on the unit's LCD (photo): thin strokes with 45° chamfered corners, on a 10 x 18 grid
const GLYPH = {
  0: 'M2.6 0H7.4L10 2.6V15.4L7.4 18H2.6L0 15.4V2.6Z',
  1: 'M1.8 3.9 4.4 0H5.6V18M1.3 18H9.7',   // flag with a flat (cut-off) top, foot
  2: 'M0 2.5 2 0H8L10 2V7.5L0 15.5V18H10',
  3: 'M0 2 2 0H8L10 2V7L8 9H3.5M8 9 10 11V16L8 18H2L0 16',
  4: 'M7.5 18V0L0 12.5H10',
  5: 'M10 0H1L0 8.5H8L10 10.5V16L8 18H2L0 16',
  6: 'M9.5 0H4L0 5V16L2 18H8L10 16V10.5L8 8.5H0',
  7: 'M0 0H10V2.5L4 18',
  8: 'M2.8 0H7.2L9 1.8V6.8L7.2 8.6H2.8L1 6.8V1.8ZM2.2 8.6H7.8L10 10.8V15.8L7.8 18H2.2L0 15.8V10.8Z',
  9: 'M10 9.5H2L0 7.5V2L2 0H8L10 2V13L5.5 18H0.5',
  '-': 'M1 9H9',
  _: 'M0 18H10',
};
const glyph = ch => {
  if (ch === '.' || ch === ',') return '<svg class="dg dot" viewBox="0 0 3 20" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><rect x="0.4" y="16.4" width="2.2" height="2.2"/></svg>';
  if (!GLYPH[ch]) return esc(ch);
  return `<svg class="dg" viewBox="-1 -1 12 20" preserveAspectRatio="none" aria-hidden="true"><path d="${GLYPH[ch]}" vector-effect="non-scaling-stroke"/></svg>`;
};
// text with digits drawn as LCD glyphs (letters stay in the font)
const lcd = t => [...String(t)].map(glyph).join('');
const segs = a => (a || []).map(s => (s.inv ? `<span class="inv">${lcd(s.t)}</span>` : lcd(s.t))).join('');

// symbols (OI 4.1.1)
const SYM = {
  // intercom via VOX disabled: "IC" crossed out
  NOVOX: '<svg class="bsym" viewBox="0 0 22 18" aria-hidden="true"><text x="2" y="14" font-size="13" font-weight="600" fill="currentColor">IC</text><path d="M1 1 21 17M21 1 1 17" stroke="currentColor" stroke-width="1.6"/></svg>',
  spkOn: '<svg class="bsym spk" viewBox="0 0 12 18" aria-hidden="true"><path d="M1.5 6h3l4-4v14l-4-4h-3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  spkMute: '<svg class="bsym spk" viewBox="0 0 12 18" aria-hidden="true"><path d="M1.5 6h3l4-4v14l-4-4h-3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M0 1 12 17" stroke="currentColor" stroke-width="1.4"/></svg>',
};
// RX field strength triangle in front of the receiving frequency: empty / half / full (OI 4.6)
function tri(level) {
  if (!level) return '';
  const fill = level === 'full' ? '<path d="M1 1 9 6 1 11z" fill="currentColor"/>' : level === 'half' ? '<path d="M1 6 9 6 1 11z" fill="currentColor"/>' : '';
  return `<svg class="btri" viewBox="0 0 10 12" aria-hidden="true"><path d="M1 1 9 6 1 11z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>${fill}</svg>`;
}
const bar = (f, cls = '') => `<span class="bbar ${cls}"><i style="width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%"></i></span>`;

function top(t) {
  const sym = t.ann === 'TX' || t.ann === 'IC' ? `<span class="bann">${t.ann}</span>` : t.ann === 'NOVOX' ? SYM.NOVOX : '';
  const spk = t.spk === 'on' ? SYM.spkOn : t.spk === 'mute' ? SYM.spkMute : '';
  return `<div class="brow r1"><div class="bcol">${sym}${spk}</div><div class="bt">${tri(t.tri)}</div><div class="bf b1">${segs(t.l)}</div></div>`;
}
function bottom(b) {
  const ann = `<div class="bcol stack">${b.ann.map(a => `<span class="bann">${a}</span>`).join('')}</div>`;
  let body = '';
  switch (b.kind) {
    case 'freq': body = `<div class="bf b2">${segs(b.l)}</div>`; break;
    case 'bat': body = `<div class="bsmall bat">${esc(b.t)}</div>`; break;   // small text (OI 4.4.2 figure)
    case 'msg': body = `<div class="bmsg">${esc(b.t)}</div>`; break;
    case 'chan': body = `<div class="bchan"><span class="bst"><i>${b.db}</i><i>${esc(b.label || '')}</i></span><span class="bnum${b.inv ? ' inv' : ''}">${lcd(b.num)}</span></div>`; break;
    case 'sto': body = `<div class="bchan"><span class="bst one"><i>${b.status}</i></span><span class="bch">CH</span><span class="bnum inv">${lcd(b.num)}</span></div>`; break;
    case 'label': body = `<div class="blabel">${segs(b.l)}</div>`; break;
  }
  return `<div class="brow r2">${ann}<div class="bt">${tri(b.tri)}</div>${body}</div>`;
}

function setupBody(b) {
  const sb = s => (s && s.n > s.vis ? `<span class="bscroll"><i style="top:${s.pos / s.n * 100}%;height:${s.vis / s.n * 100}%"></i></span>` : '');
  switch (b.type) {
    case 'kv': return `<div class="skv">${b.rows.map(([k, v, box]) => `<div class="${box ? 'boxed' : ''}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>`;
    case 'radio': return `<div class="slist">${b.items.map(x => `<div class="${x.hi ? 'hi' : ''}"><span class="mk">${x.on ? '●' : '○'}</span><span class="${x.hi ? 'inv' : ''}">${esc(x.t)}</span></div>`).join('')}</div>`;
    case 'check': {
      const vis = b.items.slice(b.scroll.pos, b.scroll.pos + b.scroll.vis);
      return `<div class="slist chk">${vis.map(x => `<div><span class="cb${x.on ? ' on' : ''}"></span><span class="${x.hi ? 'inv' : ''}">${esc(x.t)}</span></div>`).join('')}${sb(b.scroll)}</div>`;
    }
    case 'value': return `<div class="sval">${lcd(b.value)}</div>${bar(b.bar, 'sbar')}`;
    case 'noyes': return `<div class="snoyes">${['NO', 'YES'].map(o => `<span class="${b.sel === o ? 'inv' : 'boxed'}">${o}</span>`).join('')}</div>`;
    case 'vu': return `<div class="svu"><span class="vu">${bar(b.level, 'vubar')}<b>VU</b></span><span class="vul"><i>20 dB</i><i>${esc(b.value)} ${b.unit}</i></span>${bar(b.value / b.max, 'sbar thick')}</div>`;
    case 'list': {
      const rows = b.rows.slice(b.scroll.pos, b.scroll.pos + b.scroll.vis);
      return `<div class="slist fl">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><span>${v}</span></div>`).join('')}${sb(b.scroll)}</div>`;
    }
    case 'io': {
      let g = '', html = '';
      for (const x of b.items) {
        if (x.g !== g) { g = x.g; html += `<div class="ig">${esc(g)}</div>`; }
        const mk = x.kind === 'radio' ? (x.on ? '●' : '○') : `<span class="cb${x.on ? ' on' : ''}"></span>`;
        html += `<div class="ii"><span class="mk">${mk}</span><span class="${x.hi ? 'inv' : ''}">${esc(x.t)}</span></div>`;
      }
      return `<div class="sio">${html}<span class="bscroll tall"><i style="top:${b.scroll.pos / b.scroll.n * 100}%;height:${100 / b.scroll.n}%"></i></span></div>`;
    }
    case 'curve': {
      // ILLUM CURVE: brightness over dimming-bus voltage, the selected point marked (IM 2.8.5)
      const c = b.c, vmax = b.bus === '14V' ? 14 : 28, W = 120, H = 44;
      const x = v => 6 + v / vmax * (W - 10), y = br => H - 4 - br / 100 * (H - 10);
      const b2 = Math.min(100, c.b1 + c.rate * (c.v2 - c.v1));
      const pts = [[x(0), y(0)], [x(c.v1), y(0)], [x(c.v1), y(c.b1)], [x(c.v2), y(b2)], [x(vmax), y(b2)]];
      const mark = [[c.v1, 0], [c.v1, c.b1], [(c.v1 + c.v2) / 2, (c.b1 + b2) / 2], [c.v2, b2]][b.pt];
      return `<div class="scurve"><span class="ax">ILLUM</span><svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="M5 2V${H - 3}H${W - 2}" fill="none" stroke="currentColor" stroke-width="1"/><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="1.2"/>${mark ? `<path d="M${x(mark[0])} ${y(mark[1]) - 4}l3 4-3 4-3-4z" fill="currentColor"/>` : ''}<text x="${W - 16}" y="${H - 6}" font-size="7" fill="currentColor">${b.bus}</text></svg></div>`;
    }
  }
  return '';
}

export function beckerHtml(v) {
  switch (v.scr) {
    case 'wait': return `<div class="bfull wait"><div class="big">${esc(v.lines[0])}</div>${v.lines.slice(1).map(l => `<div>${esc(l)}</div>`).join('')}</div>`;
    case 'failstart': return '<div class="bfull fail"><div class="big">FAILURE</div><div>PRESS ANY KEY</div></div>';
    case 'pw': return `<div class="bfull pw"><div class="big">PASSWORD</div><div class="pwd">${[...v.digits].map((d, i) => (i === v.pos ? `<span class="inv">${glyph(d)}</span>` : glyph(d))).join('')}</div></div>`;
    case 'setup': return `<div class="bsetup"><div class="stitle">${esc(v.title)}</div>${setupBody(v.body)}</div>`;
    case 'menu': return `<div class="bmain menu">${top(v.top)}<div class="blabelbar">${esc(v.label)}</div><div class="bmenu">${bar(v.bar)}<span class="bval">${lcd(v.value)}</span></div></div>`;
    default: return `<div class="bmain">${top(v.top)}${bottom(v.bot)}</div>`;
  }
}
