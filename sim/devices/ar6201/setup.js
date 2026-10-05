// AR6201 Installation Setup (Installation Manual DV 14300.03 Issue 5, 2.8): the page table.
// Each page: { id, title, show?(d), view(d, st) -> body, turn?(d, st, dir), sto?(d, st) }.
// `d` is the device, `st` the page cursor state ({ hi, scroll, pt, sel }); values are stored at once (2.8.3).
import { clamp } from '../../core/util.js';

export const SETUP_PASSWORD = '6435';

// figures 2.8.5 (defaults: family manual 2.8 Factory Default Settings, see ASSUMPTIONS.md)
export function setupDefaults() {
  return {
    dim: 'NONE',
    illum: { '14V': { v1: 1.5, b1: 10, rate: 10, v2: 12 }, '28V': { v1: 4, b1: 10, rate: 5, v2: 24 } },
    mem: { chStore: true, last: true },
    pages: { std: true, bat: true, chn: true },
    lowBatt: 10.5,
    cfg: { tandem: false, aux: false, auxMute: false, isol: true, scanBeep: false, fcBeep: false, swapMic: false },
    auxSens: 500, auxAtt: 20,
    io: [
      { mic1: 'STD1', mic2: 'NONE', both: true, hp: true, spk: false },
      { mic1: 'NONE', mic2: 'DYN', both: false, hp: false, spk: true },
    ],
    std1: 110, dyn: 3.5,
    spkSrc: 'BOTH',
    scanHold: 1,
    sidetone: 6,
  };
}
export const FAIL_TYPES = ['P_NVRAM TEST', 'P_INTERNAL IC', 'P_RXS LOCK', 'P_RECEIVER', 'P_SUPP BLOCK', 'P_OVER TEMP',
  'C_INTERNAL IC', 'C_RXS LOCK', 'C_TXS LOCK', 'C_TX POWER', 'C_SUPP BLOCK', 'C_TX OVERLOAD', 'C_OVER TEMP', 'C_STUCK PTT'];

const VISIBLE = 4;   // "Within the display frame of the AR6201 only 4 failure types can be shown."
const scrollTo = (st, n) => { const hi = st.hi ?? 0; st.scroll = clamp(st.scroll ?? 0, Math.max(0, hi - VISIBLE + 1), Math.min(hi, Math.max(0, n - VISIBLE))); };
const move = (st, dir, n) => { st.hi = clamp((st.hi ?? 0) + dir, 0, n - 1); scrollTo(st, n); };
const stepList = (list, v, dir) => { let i = list.findIndex(x => x >= v - 1e-9); if (i < 0) i = list.length - 1; return list[clamp(i + dir, 0, list.length - 1)]; };
const numPage = (id, title, get, set, min, max, step = 1, fmt = v => String(v)) => ({
  id, title,
  view: d => ({ type: 'value', value: fmt(get(d)), bar: (get(d) - min) / (max - min) }),
  turn: (d, st, dir) => set(d, Math.round(clamp(get(d) + dir * step, min, max) * 10) / 10),
});
const noYes = (id, title, action) => ({
  id, title,
  view: (d, st) => ({ type: 'noyes', sel: st.sel || 'NO' }),
  turn: (d, st) => { st.sel = st.sel === 'YES' ? 'NO' : 'YES'; },
  sto: (d, st) => { if (st.sel === 'YES') action(d); st.sel = 'NO'; },
});
const checks = (id, title, items) => ({
  id, title,
  view: (d, st) => { const it = items(d); scrollTo(st, it.length); return { type: 'check', items: it.map((x, i) => ({ t: x.t, on: x.get(), hi: i === (st.hi ?? 0) })), scroll: { pos: st.scroll ?? 0, n: it.length, vis: VISIBLE } }; },
  turn: (d, st, dir) => move(st, dir, items(d).length),
  sto: (d, st) => { const x = items(d)[st.hi ?? 0]; if (x && x.toggle() === false) d.flash(); },
});
const radios = (id, title, opts, get, set) => ({
  id, title,
  view: (d, st) => ({ type: 'radio', items: opts.map(([v, t], i) => ({ t, on: get(d) === v, hi: i === (st.hi ?? opts.findIndex(o => o[0] === get(d))) })) }),
  turn: (d, st, dir) => { st.hi = clamp((st.hi ?? opts.findIndex(o => o[0] === get(d))) + dir, 0, opts.length - 1); },
  sto: (d, st) => set(d, opts[st.hi ?? opts.findIndex(o => o[0] === get(d))][0]),
});
const MIKE_STD1 = [9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 125, 150, 200, 300, 400, 500, 750, 1000, 1250, 1500];
const MIKE_DYN = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 12.5, 15, 20, 25];
const AUX_SENS = [50, 100, 200, 300, 500, 800, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000];
const comma = v => String(v).replace('.', ',');

// IN/OUT CFG items: radio groups (one choice) then check groups (any choice)
function ioItems(cfg) {
  return [
    { g: 'MICROPHONE 1', t: 'STD1 MIKE', kind: 'radio', get: () => cfg.mic1 === 'STD1', set: () => { cfg.mic1 = 'STD1'; } },
    { g: 'MICROPHONE 1', t: 'NONE', kind: 'radio', get: () => cfg.mic1 === 'NONE', set: () => { cfg.mic1 = 'NONE'; } },
    { g: 'MICROPHONE 2', t: 'DYN MIKE', kind: 'radio', get: () => cfg.mic2 === 'DYN', set: () => { cfg.mic2 = 'DYN'; } },
    { g: 'MICROPHONE 2', t: 'NONE', kind: 'radio', get: () => cfg.mic2 === 'NONE', set: () => { cfg.mic2 = 'NONE'; } },
    { g: 'MIC ACTIVATION', t: 'BOTH MIKES', kind: 'check', get: () => cfg.both, set: () => { cfg.both = !cfg.both; } },
    { g: 'OUTPUTS', t: 'HEADPHONE 1', kind: 'check', get: () => cfg.hp, set: () => { cfg.hp = !cfg.hp; } },
    { g: 'OUTPUTS', t: 'SPEAKER', kind: 'check', get: () => cfg.spk, set: () => { cfg.spk = !cfg.spk; } },
  ];
}
const ioPage = (n) => ({
  id: `io${n}`, title: `IN/OUT CFG ${n}`,
  view: (d, st) => {
    const it = ioItems(d.s.setup.io[n - 1]);
    return { type: 'io', items: it.map((x, i) => ({ g: x.g, t: x.t, kind: x.kind, on: x.get(), hi: i === (st.hi ?? 0) })), scroll: { pos: st.hi ?? 0, n: it.length } };
  },
  turn: (d, st, dir) => { st.hi = clamp((st.hi ?? 0) + dir, 0, 6); },
  sto: (d, st) => ioItems(d.s.setup.io[n - 1])[st.hi ?? 0].set(),
});
const vuPage = (id, title, key, list, unit, show) => ({
  id, title, show,
  view: d => ({ type: 'vu', value: d.s.setup[key], unit, level: d.micVu(), max: list[list.length - 1] }),
  turn: (d, st, dir) => { d.s.setup[key] = stepList(list, d.s.setup[key], dir); },
});
const ILLUM_KEYS = ['v1', 'b1', 'rate', 'v2'];

export const SETUP_PAGES = [
  { id: 'info', title: 'DEVICE INFO', view: d => ({ type: 'kv', rows: [['CM SW VER', d.unitInfo.cmSw], ['CH SW VER', d.unitInfo.chSw, true], ['AR SN', d.unitInfo.sn]] }) },
  radios('dim', 'DIMMING INPUT', [['NONE', 'NONE'], ['14V', '0 – 14V'], ['28V', '0 – 28V']], d => d.s.setup.dim, (d, v) => { d.s.setup.dim = v; }),
  { ...numPage('brt', 'BRIGHTNESS', d => d.s.brt, (d, v) => { d.s.brt = v; }, 0, 100), show: d => d.s.setup.dim === 'NONE' },
  {
    id: 'illum', title: 'ILLUM CURVE', show: d => d.s.setup.dim !== 'NONE',
    view: (d, st) => ({ type: 'curve', c: d.s.setup.illum[d.s.setup.dim], pt: st.pt ?? null, bus: d.s.setup.dim }),
    turn: (d, st, dir) => {
      if (st.pt == null) return;
      const c = d.s.setup.illum[d.s.setup.dim], max = d.s.setup.dim === '14V' ? 14 : 28, k = ILLUM_KEYS[st.pt];
      const lim = { v1: [d.s.setup.dim === '14V' ? 1.5 : 4, c.v2 - 0.5], b1: [0, 100], rate: [1, 50], v2: [c.v1 + 0.5, max] }[k];
      const step = k === 'b1' || k === 'rate' ? 1 : 0.5;
      c[k] = Math.round(clamp(c[k] + dir * step, ...lim) * 10) / 10;
    },
    sto: (d, st) => { st.pt = st.pt == null ? 0 : (st.pt + 1) % 4; },
  },
  checks('mem', 'MEM OPTIONS', d => [
    { t: 'CHANNEL STORE', get: () => d.s.setup.mem.chStore, toggle: () => { d.s.setup.mem.chStore = !d.s.setup.mem.chStore; } },
    { t: 'STORE LAST CHANNELS', get: () => d.s.setup.mem.last, toggle: () => { d.s.setup.mem.last = !d.s.setup.mem.last; } },
  ]),
  checks('mde', 'MDE PAGES', d => {
    const p = d.s.setup.pages;
    // "There is no possibility to deselect all options"
    const tog = k => () => { if (p[k] && Object.values(p).filter(Boolean).length === 1) return false; p[k] = !p[k]; };
    return [
      { t: 'STANDBY FREQUENCY', get: () => p.std, toggle: tog('std') },
      { t: 'BATTERY VOLTAGE', get: () => p.bat, toggle: tog('bat') },
      { t: 'CHANNEL MEMORY', get: () => p.chn, toggle: tog('chn') },
    ];
  }),
  numPage('lowbatt', 'LOW BATT THR', d => d.s.setup.lowBatt, (d, v) => { d.s.setup.lowBatt = v; }, 10, 33, 0.1, comma),
  checks('cfg', 'CONFIGURATION', d => {
    const c = d.s.setup.cfg, t = k => () => { c[k] = !c[k]; };
    return [
      { t: 'TANDEM', get: () => c.tandem, toggle: t('tandem') },
      { t: 'AUX INPUT', get: () => c.aux, toggle: t('aux') },
      ...(c.aux ? [{ t: 'AUX AUTO MUTE', get: () => c.auxMute, toggle: t('auxMute') }] : []),   // "Only if AUX INPUT is enabled"
      { t: 'AUTO ISOL IN TX', get: () => c.isol, toggle: t('isol') },
      { t: 'SCAN BEEP', get: () => c.scanBeep, toggle: t('scanBeep') },
      { t: 'FREQ CHANGE BEEP', get: () => c.fcBeep, toggle: t('fcBeep') },
      { t: 'SWAP MIKE IC', get: () => c.swapMic, toggle: t('swapMic') },
    ];
  }),
  vuPage('auxsens', 'AUX IN SENS', 'auxSens', AUX_SENS, 'mV', d => d.s.setup.cfg.aux),
  numPage('auxatt', 'AUTO AUX ATT', d => d.s.setup.auxAtt, (d, v) => { d.s.setup.auxAtt = v; }, 0, 40),
  ioPage(1),
  ioPage(2),
  vuPage('std1', 'STD1 MIKE SENS', 'std1', MIKE_STD1, 'mV', d => d.s.setup.io[0].mic1 === 'STD1'),
  vuPage('dyn', 'DYN MIKE SENS', 'dyn', MIKE_DYN, 'mV', d => d.s.setup.io[0].mic2 === 'DYN'),
  radios('spksrc', 'SPKR VOL SRC', [['PRIMARY', 'PRIMARY CH'], ['SECONDARY', 'SECONDARY CH'], ['BOTH', 'BOTH']], d => d.s.setup.spkSrc, (d, v) => { d.s.setup.spkSrc = v; }),
  numPage('sqthr', 'SQUELCH THR', d => d.s.sqThr, (d, v) => { d.s.sqThr = v; }, 6, 26),
  numPage('scanhold', 'SCAN HOLD TIME', d => d.s.setup.scanHold, (d, v) => { d.s.setup.scanHold = v; }, 1, 60),
  numPage('sidetone', 'SIDETONE ATT', d => d.s.setup.sidetone, (d, v) => { d.s.setup.sidetone = v; }, 0, 12),
  noYes('erasech', 'ERASE CHN MEM', d => { d.s.ch = Array(99).fill(null); d.s.last = []; }),
  noYes('eraselab', 'ERASE FRQ LAB', d => { d.s.labels = {}; }),
  {
    id: 'fail', title: 'FAIL LIST',
    view: (d, st) => { scrollTo(st, FAIL_TYPES.length); return { type: 'list', rows: FAIL_TYPES.map(f => [f, d.s.fail[f] ? '1' : '0']), scroll: { pos: st.scroll ?? 0, n: FAIL_TYPES.length, vis: VISIBLE } }; },
    turn: (d, st, dir) => { st.hi = clamp((st.scroll ?? 0) + dir, 0, FAIL_TYPES.length - VISIBLE); st.scroll = st.hi; },
  },
  noYes('erasefail', 'ERASE FAIL LIST', d => { d.s.fail = {}; }),
  noYes('recall', 'RECALL DEF.', d => d.recallDefaults()),
];
