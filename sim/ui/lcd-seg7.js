// Seven-segment gas-discharge display (view type `seg7`, KN 64 DME): fixed digit slots with
// decimal points and printed-on-glass annunciators, drawn as SVG. Every segment and legend is
// always present: unlit they stay faintly visible through the tinted glass (owner's photos),
// lit they glow. Layout in display pixels, measured from the unlit photo of the unit.

const NS = 'http://www.w3.org/2000/svg';
// segment polygons of one digit (a..g) in a 22 x 32 box, thin bars with chamfered ends
const W = 22, H = 32, T = 2.8, G = 0.8;
const hBar = (y) => `${G + T / 2},${y} ${G + T},${y - T / 2} ${W - G - T},${y - T / 2} ${W - G - T / 2},${y} ${W - G - T},${y + T / 2} ${G + T},${y + T / 2}`;
const vBar = (x, y0, y1) => `${x},${y0 + G} ${x + T / 2},${y0 + G + T / 2} ${x + T / 2},${y1 - G - T / 2} ${x},${y1 - G} ${x - T / 2},${y1 - G - T / 2} ${x - T / 2},${y0 + G + T / 2}`;
const SEG = {
  a: hBar(T / 2), g: hBar(H / 2), d: hBar(H - T / 2),
  f: vBar(T / 2, T / 2, H / 2), b: vBar(W - T / 2, T / 2, H / 2),
  e: vBar(T / 2, H / 2, H - T / 2), c: vBar(W - T / 2, H / 2, H - T / 2),
};
const GLYPH = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
  '-': 'g', ' ': '',
};

/**
 * @param el     container element (the display window)
 * @param layout { width, height, digits: [x...], top, skew (deg, digits leaning right < 0), dps: { slotIndex: [x, y] }, ann: { NAME: [x, y] }, marks: svg }
 */
export function createSeg7(el, layout) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('width', layout.width); svg.setAttribute('height', layout.height);
  svg.classList.add('seg7');
  const digits = layout.digits.map(x => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${x} ${layout.top}) skewX(${layout.skew || 0})`);
    const segs = {};
    for (const [k, pts] of Object.entries(SEG)) {
      const p = document.createElementNS(NS, 'polygon');
      p.setAttribute('points', pts); p.classList.add('seg');
      g.append(p); segs[k] = p;
    }
    svg.append(g);
    return segs;
  });
  const dps = {};
  for (const [i, [x, y]] of Object.entries(layout.dps)) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 1.9); c.classList.add('seg');
    svg.append(c); dps[i] = c;
  }
  const anns = {};
  for (const [name, [x, y]] of Object.entries(layout.ann)) {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y); t.classList.add('seg', 'ann');
    t.textContent = name;
    svg.append(t); anns[name] = t;
  }
  if (layout.marks) svg.insertAdjacentHTML('beforeend', layout.marks);   // printed glass marks, never lit
  el.append(svg);

  return function render(v) {
    el.classList.toggle('on', !!v.power);
    if (!v.power) return;                       // keep the last frame while it fades out
    el.style.setProperty('--lvl', v.level.toFixed(2));
    v.ch.forEach((c, i) => {
      const on = GLYPH[c] ?? '';
      for (const [k, p] of Object.entries(digits[i])) p.classList.toggle('lit', on.includes(k));
    });
    for (const [i, c] of Object.entries(dps)) c.classList.toggle('lit', !!v.dp[i]);
    for (const [n, t] of Object.entries(anns)) t.classList.toggle('lit', !!v.ann[n]);
  };
}
