// GTX 328 page entry: builds the transponder and wires the shared UI modules to index.html.
import '../../ui/manuals.js';
import { t, onLang } from '../../ui/i18n.js';
import { GTX328 } from './device.js';
import { createGtxLcd } from '../../ui/lcd-gtx.js';
import { bindControls, fitBezel } from '../../ui/controls.js';
import { createSound } from './sound.js';
import { ambWord } from '../../ui/panel.js';

let storage = null;
try { storage = window.localStorage; storage.getItem('x'); } catch { storage = null; }

const xpdr = new GTX328({ storage });
const $ = id => document.getElementById(id);

// ---------- mode cluster: ON / OFF / STBY around the round ALT key (positions measured from the photo) ----------
const CX = 149, CY = 87, R1 = 32, R2 = 59, RC = [10, 4];   // corner radii: outer, inner
const MODE_KEYS = [
  { key: 'ON', deg: -90, half: 29 },
  { key: 'OFF', deg: 27, half: 27 },
  { key: 'STBY', deg: 150, half: 27 },
];
const pt = (r, deg) => [CX + r * Math.cos(deg * Math.PI / 180), CY + r * Math.sin(deg * Math.PI / 180)];
// annular sector outline (outer arc, inner arc) with its four corners rounded
function sectorPath(r1, r2, a0, a1, rc) {
  const n = 24, P = [];
  for (let i = 0; i <= n; i++) P.push(pt(r2, a0 + (a1 - a0) * i / n));
  for (let i = n; i >= 0; i--) P.push(pt(r1, a0 + (a1 - a0) * i / n));
  const corners = new Set([0, n, n + 1, 2 * n + 1]);
  const f = v => v.toFixed(1);
  let d = '';
  // a point rc away from corner i, walking along the outline in direction dir (follows the arc)
  const rOf = i => (i === 0 || i === n ? rc[0] : rc[1]);   // outer corners rounder than the inner ones (photo)
  const along = (i, dir) => {
    let j = i, left = rOf(i), cur = P[i];
    for (;;) {
      const k = (j + dir + P.length) % P.length, q = P[k], seg = Math.hypot(q[0] - cur[0], q[1] - cur[1]);
      if (seg >= left || corners.has(k)) { const t = Math.min(1, left / seg); return [cur[0] + (q[0] - cur[0]) * t, cur[1] + (q[1] - cur[1]) * t]; }
      left -= seg; cur = q; j = k;
    }
  };
  const near = (a, c) => Math.hypot(a[0] - P[c][0], a[1] - P[c][1]) < rOf(c);
  P.forEach((p, i) => {
    if (corners.has(i)) {
      const a = along(i, -1), b = along(i, 1);
      d += `${d ? 'L' : 'M'}${f(a[0])} ${f(a[1])}Q${f(p[0])} ${f(p[1])} ${f(b[0])} ${f(b[1])}`;
    } else if (![...corners].some(c => near(p, c))) d += `L${f(p[0])} ${f(p[1])}`;   // points inside a rounding are skipped
  });
  return d + 'Z';
}
function buildCluster(svg) {
  let h = `<defs>
    <linearGradient id="gtxKeyGrad" gradientUnits="userSpaceOnUse" x1="0" y1="25" x2="0" y2="140"><stop offset="0" stop-color="#4b4a4d"/><stop offset=".45" stop-color="#3c3b3e"/><stop offset="1" stop-color="#2c2b2e"/></linearGradient>
    <filter id="gtxKeyShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="#000" flood-opacity=".6"/></filter>
    <filter id="gtxKeyShadowDown" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="#000" flood-opacity=".6"/></filter>
  </defs>`;
  for (const k of MODE_KEYS) {
    const a0 = k.deg - k.half, a1 = k.deg + k.half;
    const [tx, ty] = pt((R1 + R2) / 2, k.deg);
    const rot = k.deg === -90 ? 0 : k.deg - 90;
    h += `<path class="well" d="${sectorPath(R1 - 2, R2 + 2, a0 - 2.5, a1 + 2.5, [RC[0] + 2, RC[1] + 2])}"/>`;
    h += `<g class="mkey" data-key="${k.key}"><title></title><g class="lift">
      <path class="cap" d="${sectorPath(R1, R2, a0, a1, RC)}"/>
      <g transform="rotate(${rot} ${tx.toFixed(1)} ${ty.toFixed(1)})"><text class="${k.key.toLowerCase()}" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${k.key}</text></g></g></g>`;   // rotation on its own group, the press offset on .lift: they never replace each other
  }
  h += `<circle class="well" cx="${CX}" cy="${CY}" r="28"/>`;
  h += `<g class="mkey" data-key="ALT"><title></title>
    <g class="lift"><circle class="cap" cx="${CX}" cy="${CY}" r="26"/><text x="${CX}" y="${CY}" text-anchor="middle" dominant-baseline="central">ALT</text></g></g>`;
  svg.innerHTML = h;
  return [...svg.querySelectorAll('.mkey')];
}
const clusterKeys = buildCluster($('cluster'));
// key tooltips (SVG <title>), in the page language
onLang(() => { for (const k of clusterKeys) k.querySelector('title').textContent = t(`gtx328.key.${k.dataset.key}`); });

fitBezel($('bezel'), $('bezelWrap'), { width: 880, height: 219, maxScale: 2.2 });
const renderLcd = createGtxLcd($('lcd'));
const sound = createSound(xpdr, { toggle: $('audioOn'), base: new URL('../../sounds/gtx328/', import.meta.url) });

function render() {
  xpdr.tick();
  renderLcd(xpdr.view());
  sound.update();
  renderPanel();
}

// every key is a hold: the transponder times the STBY hold and sees FUNC held at power-on
const keyHold = el => [el, `down:${el.dataset.key}`, `up:${el.dataset.key}`];
bindControls(xpdr, render, {
  keys: [],
  holds: [...document.querySelectorAll('.key[data-key]'), ...clusterKeys].map(keyHold),
  latch: true,
});

// ---------- panels ----------
const sim = () => xpdr.s.sim;
const sync = () => {
  const s = sim();
  $('altSl').value = s.alt; $('altVal').textContent = `${s.alt} ft`;
  $('vsSl').value = s.vs; $('vsVal').textContent = `${s.vs > 0 ? '+' : ''}${s.vs} fpm`;
  $('gsSl').value = s.gs; $('gsVal').textContent = `${s.gs} kt`;
  $('oatSl').value = s.oat; $('oatVal').textContent = `${s.oat} °C`;
  $('ambSl').value = s.ambient; $('ambVal').textContent = ambWord(s.ambient);
  $('busV').value = s.lightBus; $('busVal').textContent = `${s.lightBus.toFixed(1)} V`;
  $('gndSw').checked = s.onGround; $('radarSw').checked = s.radar; $('encSw').checked = s.encoder;
  $('extStby').checked = s.extStby; $('masterSw').checked = s.avMaster;
};
onLang(sync);   // also relabels the cockpit light value after a language change
const live = (id, fn) => { $(id).oninput = e => { fn(+e.target.value); xpdr.save(); sync(); }; };
live('altSl', v => { sim().alt = v; });
live('vsSl', v => { sim().vs = v; });
live('gsSl', v => { sim().gs = v; });
live('oatSl', v => { sim().oat = v; });
live('ambSl', v => { sim().ambient = v; });
live('busV', v => { sim().lightBus = v; });
const sw = (id, fn) => { $(id).onchange = e => { fn(e.target.checked); xpdr.save(); sync(); render(); }; };
sw('gndSw', v => { sim().onGround = v; });
sw('radarSw', v => { sim().radar = v; });
sw('encSw', v => { sim().encoder = v; });
sw('extStby', v => { sim().extStby = v; });
$('masterSw').onchange = e => { xpdr.setMasterWiring(e.target.checked); sync(); render(); };
sw('failSw', v => { xpdr.raiseFault(v); });
$('busSw').onchange = e => { xpdr.setAircraftPower(e.target.checked); render(); };
const extIdent = on => () => { sim().extIdent = on; $('extIdent').classList.toggle('down', on); render(); };
$('extIdent').onpointerdown = extIdent(true);
$('extIdent').onpointerup = $('extIdent').onpointerleave = extIdent(false);
$('factory').onclick = () => { if (confirm(t('gtx328.confirm.factory'))) { xpdr.factoryReset(); sync(); render(); } };

function renderPanel() {
  const m = xpdr.opMode;
  $('hint').textContent = !xpdr.bus ? t('sim.busOff') : !xpdr.power ? t('gtx328.hint.off') : xpdr.config ? t('gtx328.hint.config') : '';
  $('hearingRow').hidden = !xpdr.power;
  const reply = t(xpdr.replying ? 'xpdr.replying' : 'xpdr.notReplying');
  $('hearing').textContent = xpdr.booting ? t('gtx328.hear.selfTest') : `${t('gtx328.hear.status', { mode: m, code: xpdr.s.code, reply })}${xpdr.identActive ? ' · IDENT (SPI)' : ''}${xpdr.altAlert ? ' · ALTITUDE ALERT' : ''}`;
  $('statusBar').dataset.state = !xpdr.power ? 'off' : xpdr.altAlert ? 'nopower' : xpdr.replying ? 'rx' : 'on';
  $('altLamp').classList.toggle('on', xpdr.altAlert);
  $('busSw').checked = xpdr.bus;
  $('failSw').checked = xpdr.fault;
  // key legend lighting: follows the key lighting level, visible in the dark
  $('bezel').style.setProperty('--keylit', xpdr.power ? (xpdr.lit.key * (1 - sim().ambient / 100)).toFixed(2) : 0);
}

xpdr.setAircraftPower(xpdr.bus);   // wired to the avionics master: on as soon as the page opens with power
setInterval(render, 50);
render();
