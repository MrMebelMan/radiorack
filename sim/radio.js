// GTR 225 behaviour model. No DOM here: the UI feeds inputs and renders view().
import { AIRPORTS, STATIONS, FIR, POSITIONS, DB_INFO, USB_DB_INFO, UNIT_INFO } from './data.js';

export const TYPES = ['TWR', 'GND', 'ATIS', 'AWS', 'ATF', 'ARR', 'APPR', 'DEP', 'CLR', 'CTAF', 'FSS', 'RFS', 'MF', 'UNI', ''];
const CHARSET = '_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const EMERGENCY = 121500;
export const MAX_USER = 15;
export const MAX_RECENT = 20;
export const HOLD_MS = 2000;
export const STUCK_WARN_MS = 30000;
export const STUCK_MS = 35000;
const DB_MEMORY_MS = 30 * 60000;
const NAME_LEN = 6;
const IDENT_LEN = 4;

export const MESSAGES = {
  COM_SERVICE: 'COM RADIO - COM RADIO NEEDS SERVICE.',
  COM_INOP: 'COM RADIO - COM RADIO MAY BE INOPERATIVE.',
  COM_OVERTEMP: 'COM RADIO - COM OVERTEMP OR UNDERVOLTAGE. REDUCING TRANSMITTER POWER.',
  COM_LOCKED: 'COM RADIO - COM LOCKED TO 121.5 MHZ. HOLD REMOTE COM TRANSFER KEY TO EXIT.',
  FAN: 'COOLING FAN - THE COOLING FAN HAS FAILED.',
  DISPLAY: 'DISPLAY - DISPLAY BOARD NEEDS SERVICE.',
  UNLOCK_FAIL: 'FEATURE UNLOCK FAILURE - DATABASE CORRUPT OR SYSTEM ID MISMATCH.',
  NO_UNLOCK: 'NO UNLOCK FILE - USB DRIVE IS MISSING THE FEATURE UNLOCK FILE.',
  POWER: 'POWER ALERT - UNIT WILL SHUT DOWN IF POWER SWITCH IS NOT RESTORED IMMEDIATELY.',
  PTT_STUCK: 'REMOTE KEY STUCK - COM PUSH-TO-TALK KEY IS STUCK.',
  XFR_STUCK: 'REMOTE KEY STUCK - COM REMOTE TRANSFER KEY IS STUCK.',
  UP_STUCK: 'REMOTE KEY STUCK - COM REMOTE FREQUENCY INCREMENT KEY IS STUCK.',
  DN_STUCK: 'REMOTE KEY STUCK - COM REMOTE FREQUENCY DECREMENT KEY IS STUCK.',
};

// ---------- frequency helpers ----------
const range = (a, b, step = 1) => { const r = []; for (let v = a; v <= b; v += step) r.push(v); return r; };
const K25 = range(0, 975, 25);
const K833 = range(0, 990, 5).filter(k => k % 25 !== 20);
export const khzList = spacing => (spacing === 25 ? K25 : K833);

export function fmtFreq(f) {
  return `${Math.floor(f / 1000)}.${String(f % 1000).padStart(3, '0')}`;
}
export function stepMhz(f, dir) {
  let mhz = Math.floor(f / 1000) + dir;
  if (mhz > 136) mhz = 118;
  if (mhz < 118) mhz = 136;
  return mhz * 1000 + (f % 1000);
}
export function stepKhz(f, dir, spacing) {
  const mhz = Math.floor(f / 1000);
  const L = khzList(spacing);
  const k = f % 1000;
  let i = L.indexOf(k);
  if (i < 0) i = L.findIndex(v => v > k) - (dir > 0 ? 1 : 0);
  i = (i + dir + L.length) % L.length;
  return mhz * 1000 + L[i];
}
export const is833Only = f => f % 25 !== 0;
export const snapTo25 = f => f - (f % 25);

export function distNm(a, b) {
  const R = 3440.065, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

const wrap = (i, n) => ((i % n) + n) % n;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cycleChar = (c, dir) => CHARSET[wrap(CHARSET.indexOf(c) + dir, CHARSET.length)];
const toChars = (s, n) => (s.replace(/ /g, '_') + '_'.repeat(n)).slice(0, n).split('');
const fromChars = a => a.join('').replace(/_+$/, '').replace(/_/g, ' ');

// segment helper for the view model
const S = (t, o = {}) => ({ t: String(t), ...o });

class Stopwatch {
  constructor() { this.acc = 0; this.t0 = null; }
  get running() { return this.t0 !== null; }
  elapsed(now) { return this.acc + (this.t0 !== null ? now - this.t0 : 0); }
  start(now) { if (this.t0 === null) this.t0 = now; }
  stop(now) { if (this.t0 !== null) { this.acc += now - this.t0; this.t0 = null; } }
  toggle(now) { this.running ? this.stop(now) : this.start(now); }
  reset() { this.acc = 0; this.t0 = null; }
}

// ---------- function menu ----------
export const MENU = [
  { title: 'COM FREQUENCY LIST', items: [['RECENT FREQS', 'recent'], ['USER FREQS', 'user'], ['DATABASE', 'db'], ['NEAREST APT', 'napt'], ['NEAREST ACC', 'nacc'], ['NEAREST FSS', 'nfss'], ['NEAREST WX', 'nwx']] },
  { title: 'ICS CONFIGURATION', items: [['ADJUST INTRCOM', 'adjics'], ['AUX AUDIO', 'aux'], ['INTRCOM ON/OFF', 'icsonoff'], ['SPEAKER ON/OFF', 'spk']] },
  { title: 'SYS CONFIGURATION', items: [['COM SPACING', 'spacing'], ['COM SIDETONE', 'sidetone'], ['DSPL BRT', 'brt'], ['DSPL CONTRAST', 'contrast'], ['DATABASE INFO', 'dbinfo'], ['LOAD DATABASE', 'load'], ['SOFTWARE VER', 'swver'], ['SERIAL NUMBER', 'serial']] },
  { title: 'TMR CONFIGURATION', items: [['COUNT UP', 'tmrup'], ['COUNT DOWN', 'tmrdown']] },
];

const ONOFF = ['OFF', 'ON'];
const vol100 = range(0, 100, 5);
const SETTINGS = {
  adjics: {
    title: 'ADJUST INTRCOM',
    fields: [
      { k: 'sq', label: 'SQ', vals: ['AUTO', ...range(0, 100, 5)] },
      { k: 'vol', label: 'VOL', vals: vol100 },
      { k: 'mute', label: 'MUTE ON RX', vals: ONOFF },
    ],
    rows: [[0, 1], [2]],
    get: s => ({ sq: s.ics.sq, vol: s.ics.vol, mute: s.ics.mute ? 'ON' : 'OFF' }),
    set: (s, v) => { s.ics.sq = v.sq; s.ics.vol = v.vol; s.ics.mute = v.mute === 'ON'; },
  },
  aux: {
    title: 'AUX AUDIO',
    fields: [
      { k: 'on', label: 'AUX', vals: ONOFF },
      { k: 'vol', label: 'VOL', vals: vol100 },
      { k: 'mute', label: 'MUTE ON RX', vals: ONOFF },
    ],
    rows: [[0, 1], [2]],
    get: s => ({ on: s.aux.on ? 'ON' : 'OFF', vol: s.aux.vol, mute: s.aux.mute ? 'ON' : 'OFF' }),
    set: (s, v) => { s.aux.on = v.on === 'ON'; s.aux.vol = v.vol; s.aux.mute = v.mute === 'ON'; },
  },
  icsonoff: {
    title: 'INTRCOM ON/OFF',
    fields: [{ k: 'on', label: 'INTERCOM', sep: ' ', vals: ONOFF }],
    rows: [[0]],
    get: s => ({ on: s.ics.on ? 'ON' : 'OFF' }),
    set: (s, v) => { s.ics.on = v.on === 'ON'; },
  },
  spk: {
    title: 'SPEAKER ON/OFF',
    fields: [{ k: 'on', label: 'SPEAKER', sep: ' ', vals: ONOFF }],
    rows: [[0]],
    get: s => ({ on: s.speaker ? 'ON' : 'OFF' }),
    set: (s, v) => { s.speaker = v.on === 'ON'; },
  },
  spacing: {
    title: 'COM SPACING',
    fields: [{ k: 'sp', label: 'CHNL SPACE', sep: ' ', vals: ['8.33KHZ', '25.0KHZ'] }],
    rows: [[0]],
    get: s => ({ sp: s.spacing === 25 ? '25.0KHZ' : '8.33KHZ' }),
    set: null, // handled by Radio.setSpacing
  },
  sidetone: {
    title: 'COM SIDETONE',
    fields: [
      { k: 'mode', label: 'MODE', vals: ['OFFSET', 'FIXED'] },
      { k: 'offset', label: 'OFFSET', vals: range(-10, 10), show: v => v.mode === 'OFFSET' },
    ],
    rows: [[0], [1]],
    get: s => ({ ...s.sidetone }),
    set: (s, v) => { s.sidetone = { mode: v.mode, offset: v.offset }; },
  },
  brt: {
    title: 'DISPLAY BRIGHTNESS',
    fields: [{ k: 'brt', label: 'OFFSET', sep: ' ', vals: range(-10, 100) }],
    rows: [['info'], [0]],
    info: v => `BRIGHTNESS ${clamp(50 + v.brt, 0, 100)}`,
    get: s => ({ brt: s.brt }),
    set: (s, v) => { s.brt = v.brt; },
  },
  contrast: {
    title: 'DISPLAY CONTRAST',
    fields: [{ k: 'contrast', label: 'OFFSET', sep: ' ', vals: range(-50, 50) }],
    rows: [[0]],
    get: s => ({ contrast: s.contrast }),
    set: (s, v) => { s.contrast = v.contrast; },
  },
};

const PERSIST_KEY = 'gtr225-sim-v2';

export function defaultSettings() {
  return {
    vol: 60, sq: false, spacing: 833,
    act: 120335, stb: 126100, mon: false,
    recent: [120335, 126100],
    user: [
      { freq: 120335, name: 'LKLT', type: 'ATF' },
      { freq: 126100, name: 'PRAHA', type: 'FSS' },
      { freq: 120880, name: 'LKKB', type: 'TWR' },
      { freq: 123610, name: 'LKMB', type: 'ATF' },
    ],
    ics: { on: true, sq: 'AUTO', vol: 70, mute: false },
    aux: { on: false, vol: 50, mute: false },
    speaker: true,
    sidetone: { mode: 'OFFSET', offset: 0 },
    brt: 0, contrast: 0,
    db: { ...DB_INFO },
    cdStart: 60,
    gps: true, posId: 'LKLT',
    usb: 'none', // none | valid | corrupt | nounlock
    remoteConfigured: true,
  };
}

export class Radio {
  constructor({ now = () => performance.now(), storage = null } = {}) {
    this.now = now;
    this.storage = storage;
    this.s = defaultSettings();
    this.load();
    this.power = false;     // unit actually running
    this.switchOn = false;  // PWR/VOL knob turned past the OFF detent
    this.bus = true;        // aircraft (avionics bus) power present
    this.bootUntil = 0;
    this.page = { id: 'com' };
    this.menuPos = { cat: 0, item: 0 };
    this.cu = new Stopwatch();
    this.cd = new Stopwatch();
    this.tx = false; this.txStart = 0; this.stuck = false; this.pttWarned = false;
    this.locked = false;
    // incoming transmissions, one per frequency: {which, start, until, clip}
    this.rx = { act: null, stb: null };
    this.hold = {};
    this.msgs = [];
    this.toastMsg = null;
    this.volShowUntil = 0;
    this.emergHintUntil = 0;
    this.dbMemory = null;
    this.recallIdx = -1;
    this.shutdownAt = 0;
    this.listeners = [];
  }

  // ---------- persistence ----------
  load() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(PERSIST_KEY);
      if (raw) Object.assign(this.s, JSON.parse(raw));
    } catch { /* ignore */ }
  }
  save() {
    if (!this.storage) return;
    try { this.storage.setItem(PERSIST_KEY, JSON.stringify(this.s)); } catch { /* ignore */ }
  }
  factoryReset() {
    this.s = defaultSettings();
    this.cu.reset(); this.cd.reset();
    this.locked = false; this.msgs = []; this.dbMemory = null;
    this.page = { id: 'com' };
    this.save();
  }

  // ---------- helpers ----------
  toast(text, ms = 2000) { this.toastMsg = { text, until: this.now() + ms }; }
  get transmitting() { return this.tx && !this.stuck; }
  get pos() { return POSITIONS.find(p => p.id === this.s.posId) || POSITIONS[0]; }
  pushRecent(f) {
    const r = this.s.recent.filter(x => x !== f);
    r.unshift(f);
    this.s.recent = r.slice(0, MAX_RECENT);
  }
  setActive(f) {
    if (this.locked) { this.toast('COM LOCKED TO 121.5'); return false; }
    if (this.transmitting) { this.toast('TRANSMITTING'); return false; }
    this.s.act = f;
    this.pushRecent(f);
    this.save();
    return true;
  }
  setStandby(f) { this.s.stb = f; this.save(); }
  swap() {
    if (this.locked) { this.toast('COM LOCKED TO 121.5'); return; }
    if (this.transmitting) return; // flip disabled during TX
    const a = this.s.act;
    this.s.act = this.s.stb;
    this.s.stb = a;
    this.pushRecent(this.s.act);
    this.save();
  }
  goCom() { this.page = { id: 'com' }; }
  goBack(p = this.page) { this.page = p.back || { id: 'com' }; }
  raise(id) {
    if (this.msgs.includes(id)) return;
    this.msgs.push(id);
  }

  // ---------- database ----------
  firEntry() {
    return { ...FIR, nonApt: true, freqs: STATIONS.map(st => ({ type: st.type, f: st.f, label: st.name })) };
  }
  allIdents() { return [...AIRPORTS, this.firEntry()]; }
  findIdent(id) { return this.allIdents().find(a => a.id === id); }
  reverse(f) {
    if (!this.s.gps) return null;
    const pos = this.pos;
    let best = null;
    for (const a of AIRPORTS) {
      const matches = a.freqs.filter(x => x.f === f);
      if (!matches.length) continue;
      const d = distNm(pos, a);
      if (d > 200) continue;
      const types = [...new Set(matches.map(m => m.type))];
      if (!best || d < best.d) best = { d, text: `${a.id} ${types[0]}${types.length > 1 ? '*' : ''}` };
    }
    for (const st of STATIONS) {
      if (st.f !== f) continue;
      const d = distNm(pos, st);
      if (d > 200) continue;
      if (!best || d < best.d) best = { d, text: `${st.id} ${st.type}` };
    }
    return best ? best.text : null;
  }
  usableFreq(f) {
    return this.s.spacing === 833 || !is833Only(f);
  }
  listItems(kind) {
    const pos = this.pos;
    if (kind === 'recent') {
      return this.s.recent.map(f => ({ freq: f, l2: [S(this.reverse(f) || '')] }));
    }
    if (kind === 'user') {
      const items = this.s.user.map(u => ({ freq: u.freq, user: u }));
      if (items.length < MAX_USER) items.push({ empty: true });
      return items;
    }
    if (!this.s.gps) return [];
    if (kind === 'napt') {
      return AIRPORTS.map(a => ({ a, d: distNm(pos, a) })).sort((x, y) => x.d - y.d).slice(0, 25)
        .map(({ a }) => ({ apt: a, l2: [S(a.name)] }));
    }
    const cat = { nacc: 'acc', nfss: 'fss', nwx: 'wx' }[kind];
    let st = STATIONS.filter(x => x.cat === cat).map(x => ({ x, d: distNm(pos, x), name: x.name }));
    if (cat === 'wx') {
      // ATIS / AWOS of airports count as weather frequencies too
      for (const a of AIRPORTS) for (const fr of a.freqs) {
        if (fr.type === 'ATIS' || fr.type === 'AWS') st.push({ x: fr, d: distNm(pos, a), name: `${a.id} ${fr.type}` });
      }
    }
    st = st.filter(o => this.usableFreq(o.x.f)).sort((p, q) => p.d - q.d).slice(0, 25);
    return st.map(o => ({ freq: o.x.f, l2: [S(o.name)] }));
  }

  // ---------- power ----------
  // The unit runs only when the knob switch is on AND aircraft power is present.
  applyPower() {
    const want = this.switchOn && this.bus;
    if (want && !this.power) this.powerOn();
    else if (!want && this.power) this.powerOff();
  }
  powerOn() {
    this.power = true;
    // operating states, not settings: every power-up starts with MON off and auto squelch
    this.s.mon = false;
    this.s.sq = false;
    this.bootUntil = this.now() + 2500;
    this.page = { id: 'com' };
    this.locked = false;
  }
  powerOff() {
    this.power = false;
    this.tx = false; this.stuck = false;
    this.cu.reset(); this.cd.reset();
    this.locked = false;
    this.msgs = [];
    this.s.mon = false;
    this.shutdownAt = 0;
    this.save();
  }
  get booting() { return this.power && this.now() < this.bootUntil; }

  // ---------- timers ----------
  cdRemainingMs() { return this.s.cdStart * 1000 - this.cd.elapsed(this.now()); }
  cdSeg() {
    const rem = this.cdRemainingMs();
    if (rem >= 0) return S(fmtTime(Math.ceil(rem / 1000)));
    return S(fmtTime(Math.floor(-rem / 1000)), { inv: true });
  }
  cuSeg() { return S(fmtTime(this.cu.elapsed(this.now()) / 1000)); }
  displayedTimer() {
    const n = this.now();
    if (this.cd.running) return 'down';
    if (this.cu.running) return 'up';
    if (this.cd.elapsed(n) > 0) return 'down';
    if (this.cu.elapsed(n) > 0) return 'up';
    return null;
  }
  timerSeg(which) { return which === 'down' ? this.cdSeg() : this.cuSeg(); }

  // ---------- inputs ----------
  // evt: outer, inner (arg = +1/-1), push, COM, MEM, ICS, FUNC, CLR, ENT, MON,
  //      flipDown, flipUp, pttDown, pttUp, xfrDown, xfrUp, recall, vol (arg), sqDown, sqUp,
  //      chanUp, chanDn, remoteIcs
  input(evt, arg) {
    const now = this.now();
    if (evt === 'vol') return this.volume(arg);
    if (!this.power) return;
    if (this.booting) return;

    switch (evt) {
      case 'sqDown': this.hold.sq = { t: now, fired: false }; return;
      case 'sqUp': {
        const h = this.hold.sq; this.hold.sq = null;
        if (h && !h.fired) { this.s.sq = !this.s.sq; this.save(); }
        return;
      }
      case 'flipDown': this.hold.flip = { t: now, fired: false }; return;
      case 'flipUp': {
        const h = this.hold.flip; this.hold.flip = null;
        if (h && !h.fired) this.flipShort();
        return;
      }
      case 'xfrDown': if (this.s.remoteConfigured) this.hold.xfr = { t: now, fired: false }; return;
      case 'xfrUp': {
        const h = this.hold.xfr; this.hold.xfr = null;
        if (h && !h.fired) this.flipShort();
        return;
      }
      case 'pttDown':
        if (!this.tx) { this.tx = true; this.txStart = now; this.stuck = false; this.pttWarned = false; }
        return;
      case 'pttUp': this.tx = false; this.stuck = false; return;
      case 'recall': return this.remoteRecall();
      case 'remoteIcs':
        this.s.ics.on = !this.s.ics.on; this.save();
        this.toast(`INTERCOM ${this.s.ics.on ? 'ON' : 'OFF'}`);
        return;
      case 'chanUp': case 'chanDn': {
        const f = stepKhz(this.s.stb, evt === 'chanUp' ? 1 : -1, this.s.spacing);
        this.setStandby(f);
        return;
      }
      case 'MON': this.s.mon = !this.s.mon; this.save(); return;
    }

    // Pending message: ENT acknowledges; other bezel keys are ignored.
    if (this.msgs.length) {
      if (evt === 'ENT') this.msgs.shift();
      return;
    }

    switch (evt) {
      case 'COM': return this.goCom();
      case 'FUNC':
        if (this.page.func) return this.goCom();
        this.page = { id: 'menu', func: true };
        return;
      case 'MEM': {
        const p = this.page;
        const kind = p.id === 'list' && p.kind === 'recent' && p.from === 'mem' ? 'user' : 'recent';
        this.page = { id: 'list', kind, idx: 0, from: 'mem' };
        return;
      }
      case 'ICS': return this.icsKey();
    }

    const h = this.handlers[this.page.id];
    const fn = h && h[evt];
    if (fn) fn.call(this, this.page, arg);
  }

  volume(dir) {
    if (!this.switchOn) {
      if (dir > 0) { this.switchOn = true; this.applyPower(); }
      return;
    }
    const v = this.s.vol + dir * 5;
    if (v < 0) { this.switchOn = false; this.applyPower(); return; }
    this.s.vol = clamp(v, 0, 100);
    if (this.power) this.volShowUntil = this.now() + 2000;
    this.save();
  }

  flipShort() {
    const p = this.page;
    if (!this.msgs.length && p.id === 'list') {
      const it = this.listItems(p.kind)[p.idx];
      if (it && !it.empty && !it.apt) this.setActive(it.freq); // stays on the list (CLR leaves)
      return;
    }
    if (!this.msgs.length && p.id === 'db' && p.phase === 'type') {
      const e = p.entries[p.idx];
      this.dbMemory = { ident: p.ident.join(''), idx: p.idx, t: this.now() };
      // from the COM page the look-up ends on the COM page (manual 2.4 step 7);
      // from the function lists you stay on the page
      if (this.setActive(e.f) && p.from === 'com') this.goCom();
      return;
    }
    this.swap();
  }

  emergency() {
    if (this.locked) return;
    if (this.s.act !== EMERGENCY) this.s.stb = this.s.act;
    this.s.act = EMERGENCY;
    this.pushRecent(EMERGENCY);
    this.emergHintUntil = this.now() + 2500;
    this.goCom();
    this.save();
  }

  toggleLock() {
    if (!this.locked) {
      if (this.s.act !== EMERGENCY) this.s.stb = this.s.act;
      this.s.act = EMERGENCY;
      this.locked = true;
      this.msgs = this.msgs.filter(m => m !== 'COM_LOCKED');
      this.raise('COM_LOCKED');
    } else {
      this.locked = false;
      this.toast('COM UNLOCKED');
    }
    this.save();
  }

  remoteRecall() {
    if (!this.s.remoteConfigured) return;
    const u = this.s.user;
    if (!u.length) return;
    this.recallIdx = (this.recallIdx + 1) % u.length;
    this.setStandby(u[this.recallIdx].freq);
  }

  icsKey() {
    const order = ['adjics', 'aux', 'icsonoff'].filter(k => k !== 'adjics' || this.s.ics.on);
    const p = this.page;
    let next = 0;
    if (p.id === 'set' && p.viaIcs) {
      next = order.indexOf(p.kind) + 1;
      if (next >= order.length) return this.goCom();
    }
    this.openSetting(order[next], { id: 'com' }, true);
  }

  openSetting(kind, back, viaIcs = false) {
    const def = SETTINGS[kind];
    this.page = { id: 'set', kind, vals: def.get(this.s), cur: 0, back, viaIcs, func: !viaIcs };
  }

  setSpacing(sp) {
    if (sp === this.s.spacing) return;
    this.s.spacing = sp;
    if (sp === 25) {
      const before = this.s.user.length;
      this.s.user = this.s.user.filter(u => !is833Only(u.freq));
      const removed = before - this.s.user.length;
      this.s.recent = this.s.recent.filter(f => !is833Only(f)); // NOTE p.i: user and recent 8.33 freqs are lost
      this.s.act = snapTo25(this.s.act);
      this.s.stb = snapTo25(this.s.stb);
      if (removed) this.toast(`${removed} 8.33 USER FREQ DELETED`, 3000);
    }
    this.save();
  }

  openItem(key) {
    const back = { id: 'menu', func: true };
    if (['recent', 'user', 'napt', 'nacc', 'nfss', 'nwx'].includes(key)) {
      this.page = { id: 'list', kind: key, idx: 0, from: 'func', func: true, back };
    } else if (key === 'db') {
      this.openLookup('func', back);
    } else if (SETTINGS[key]) {
      if (key === 'adjics' && !this.s.ics.on) { this.toast('INTERCOM IS OFF'); return; }
      this.openSetting(key, back);
    } else if (key === 'load') {
      this.page = { id: 'load', phase: 'prompt', func: true, back };
    } else if (key === 'tmrup' || key === 'tmrdown') {
      this.page = { id: key, func: true, back };
    } else {
      this.page = { id: 'info', kind: key, func: true, back };
    }
  }

  typeEntries(a) {
    const counts = {};
    a.freqs.forEach(fr => { counts[fr.type] = (counts[fr.type] || 0) + 1; });
    return a.freqs.map(fr => ({ ...fr, label: fr.type + (counts[fr.type] > 1 ? '+' : '') }));
  }
  openAirportFreqs(a, back) {
    this.page = { id: 'db', from: 'func', func: true, fromList: true, back, phase: 'type',
      ident: toChars(a.id, IDENT_LEN), cur: 0, entries: this.typeEntries(a), idx: 0 };
  }

  openLookup(from, back) {
    const mem = this.dbMemory && this.now() - this.dbMemory.t < DB_MEMORY_MS ? this.dbMemory : null;
    this.page = {
      id: 'db', from, back, func: from === 'func', phase: 'ident',
      ident: toChars(mem ? mem.ident : '', IDENT_LEN), cur: 0,
      entries: [], idx: mem ? mem.idx : 0,
    };
  }

  // ---------- per-page handlers ----------
  handlers = {
    com: {
      outer(p, d) { if (p.prompt) return; this.setStandby(stepMhz(this.s.stb, d)); },
      inner(p, d) { if (p.prompt) return; this.setStandby(stepKhz(this.s.stb, d, this.s.spacing)); },
      push(p) { if (p.prompt) return; this.openLookup('com', { id: 'com' }); },
      ENT(p) {
        if (p.prompt) {
          const which = p.prompt.which;
          const sw = which === 'down' ? this.cd : this.cu;
          if (p.prompt.kind === 'stop') sw.stop(this.now());
          else sw.reset();
          p.prompt = null;
          return;
        }
        const dt = this.displayedTimer();
        if (dt && (dt === 'down' ? this.cd : this.cu).running) {
          p.prompt = { kind: 'stop', which: dt };
          return;
        }
        if (this.s.user.length >= MAX_USER) { this.toast('USER FREQ LIST FULL'); return; }
        this.page = { id: 'uedit', mode: 'save', freq: this.s.stb, name: toChars('', NAME_LEN), type: TYPES.length - 1, cur: 0, back: { id: 'com' } };
      },
      CLR(p) {
        if (p.prompt) { p.prompt = null; return; }
        const dt = this.displayedTimer();
        if (dt) p.prompt = { kind: 'reset', which: dt };
      },
    },

    menu: {
      outer(p, d) { this.menuPos.cat = wrap(this.menuPos.cat + d, MENU.length); this.menuPos.item = 0; },
      inner(p, d) { const c = MENU[this.menuPos.cat]; this.menuPos.item = wrap(this.menuPos.item + d, c.items.length); },
      ENT() { this.openItem(MENU[this.menuPos.cat].items[this.menuPos.item][1]); },
      CLR() { this.goCom(); },
    },

    list: {
      inner(p, d) {
        if (p.confirm) return;
        const n = this.listItems(p.kind).length;
        if (n) p.idx = wrap(p.idx + d, n);
      },
      ENT(p) {
        if (p.confirm) {
          this.s.user.splice(p.idx, 1);
          this.save();
          p.confirm = false;
          p.idx = clamp(p.idx, 0, Math.max(0, this.listItems('user').length - 1));
          return;
        }
        const it = this.listItems(p.kind)[p.idx];
        if (!it || it.empty) return;
        if (it.apt) { this.openAirportFreqs(it.apt, p); return; } // NEAREST APT: ENT=DONE -> its frequencies
        this.setStandby(it.freq); // stays on the list; CLR returns to the functions display
      },
      CLR(p) {
        if (p.confirm) { p.confirm = false; return; }
        if (p.kind === 'user') {
          const it = this.listItems('user')[p.idx];
          if (it && !it.empty) { p.confirm = true; return; }
        }
        this.goBack(p);
      },
      push(p) {
        if (p.kind !== 'user' || p.confirm) return;
        const it = this.listItems('user')[p.idx];
        const u = it.empty ? { freq: this.s.stb, name: '', type: '' } : it.user;
        this.page = {
          id: 'uedit', mode: 'edit', idx: it.empty ? -1 : p.idx,
          freq: u.freq, name: toChars(u.name, NAME_LEN), type: TYPES.indexOf(u.type), cur: 0,
          back: p, func: p.func,
        };
      },
    },

    uedit: {
      // Manual 2.3 / 3.2.2: inner = character, outer = cursor; ENT accepts the name,
      // then the OUTER knob moves to the TYPE field; ENT there saves, CLR cancels.
      outer(p, d) {
        const fields = this.ueditFields(p);
        if (p.nameDone) {
          p.nameDone = false;
          if (d > 0) p.cur = fields.indexOf('type');
          return;
        }
        p.cur = clamp(p.cur + d, 0, fields.length - 1);
      },
      inner(p, d) {
        if (p.nameDone) return;
        const f = this.ueditFields(p)[p.cur];
        if (f === 'mhz') p.freq = stepMhz(p.freq, d);
        else if (f === 'khz') p.freq = stepKhz(p.freq, d, this.s.spacing);
        else if (f === 'type') p.type = wrap(p.type + d, TYPES.length);
        else { const i = +f.slice(1); p.name[i] = cycleChar(p.name[i], d); }
      },
      ENT(p) {
        const fields = this.ueditFields(p);
        if (fields[p.cur][0] === 'c' && !p.nameDone) { p.nameDone = true; return; }
        const entry = { freq: p.freq, name: fromChars(p.name), type: TYPES[p.type] };
        if (p.mode === 'save' || p.idx < 0) {
          if (this.s.user.length >= MAX_USER) { this.toast('USER FREQ LIST FULL'); return; }
          this.s.user.push(entry);
          this.toast(`SAVED ${this.s.user.length} OF ${MAX_USER}`);
        } else {
          this.s.user[p.idx] = entry;
          this.toast('USER FREQ UPDATED');
        }
        this.save();
        this.goBack(p);
      },
      CLR(p) { this.goBack(p); },
    },

    db: {
      inner(p, d) {
        if (p.phase === 'type') { p.idx = wrap(p.idx + d, p.entries.length); return; }
        p.ident[p.cur] = cycleChar(p.ident[p.cur], d);
        // Garmin-style auto-complete from the characters up to the cursor
        const prefix = p.ident.slice(0, p.cur + 1).join('');
        if (!prefix.includes('_')) {
          const m = this.allIdents().map(a => a.id).sort().find(id => id.startsWith(prefix));
          if (m) p.ident = toChars(m, IDENT_LEN);
          else for (let i = p.cur + 1; i < IDENT_LEN; i++) p.ident[i] = '_';
        }
      },
      outer(p, d) {
        if (p.phase === 'type') { if (d < 0 && !p.fromList) p.phase = 'ident'; return; }
        p.cur = clamp(p.cur + d, 0, IDENT_LEN - 1);
      },
      push(p) {
        if (p.from === 'com') this.goCom();
      },
      ENT(p) {
        if (p.phase === 'ident') {
          const a = this.findIdent(fromChars(p.ident));
          if (!a) { this.toast('NO MATCHING IDENTIFIER'); return; }
          p.entries = this.typeEntries(a);
          if (p.idx >= p.entries.length) p.idx = 0;
          p.phase = 'type';
          return;
        }
        const e = p.entries[p.idx];
        this.dbMemory = { ident: p.ident.join(''), idx: p.idx, t: this.now() };
        this.setStandby(e.f);
        if (p.from === 'com') this.goCom(); // manual 2.4: then FLIP/FLOP swaps on the COM page
      },
      CLR(p) {
        if (p.phase === 'type' && !p.fromList) { p.phase = 'ident'; return; }
        this.goBack(p);
      },
    },

    set: {
      outer(p, d) {
        const def = SETTINGS[p.kind];
        const vis = def.fields.map((f, i) => i).filter(i => !def.fields[i].show || def.fields[i].show(p.vals));
        const pos = vis.indexOf(p.cur);
        p.cur = vis[clamp(pos + d, 0, vis.length - 1)];
      },
      inner(p, d) {
        const f = SETTINGS[p.kind].fields[p.cur];
        const i = f.vals.indexOf(p.vals[f.k]);
        p.vals[f.k] = f.vals[clamp(i + d, 0, f.vals.length - 1)];
      },
      ENT(p) {
        const def = SETTINGS[p.kind];
        if (p.kind === 'spacing') this.setSpacing(p.vals.sp.startsWith('25') ? 25 : 833);
        else def.set(this.s, p.vals);
        this.save();
        this.goBack(p);
      },
      CLR(p) { this.goBack(p); },
    },

    info: {
      ENT(p) { this.goBack(p); },
      CLR(p) { this.goBack(p); },
    },

    load: {
      ENT(p) {
        if (p.phase === 'prompt') {
          if (this.s.usb === 'none') { this.toast('NO USB DRIVE DETECTED'); return; }
          if (this.s.usb === 'corrupt') { this.raise('UNLOCK_FAIL'); this.goBack(p); return; }
          if (this.s.usb === 'nounlock') { this.raise('NO_UNLOCK'); this.goBack(p); return; }
          p.phase = 'version';
        } else if (p.phase === 'version') {
          p.phase = 'progress'; p.t0 = this.now();
        } else if (p.phase === 'done') {
          this.goBack(p);
        }
      },
      CLR(p) { if (p.phase !== 'progress') this.goBack(p); },
    },

    tmrup: {
      ENT() { this.cu.toggle(this.now()); },
      CLR() { this.cu.reset(); },
    },

    tmrdown: {
      push(p) {
        if (p.edit) return;
        const v = this.s.cdStart;
        p.edit = { h: Math.floor(v / 3600), m: Math.floor((v % 3600) / 60), s: v % 60, field: 1 };
      },
      outer(p, d) { if (p.edit) p.edit.field = clamp(p.edit.field + d, 0, 2); },
      inner(p, d) {
        if (!p.edit) return;
        const e = p.edit;
        if (e.field === 0) e.h = wrap(e.h + d, 24);
        else if (e.field === 1) e.m = wrap(e.m + d, 60);
        else e.s = wrap(e.s + d, 60);
      },
      ENT(p) {
        if (p.edit) {
          const e = p.edit;
          this.s.cdStart = e.h * 3600 + e.m * 60 + e.s;
          this.cd.reset();
          p.edit = null;
          this.save();
          return;
        }
        this.cd.toggle(this.now());
      },
      CLR(p) {
        if (p.edit) { p.edit = null; return; }
        this.cd.reset();
      },
    },
  };

  ueditFields(p) {
    const chars = range(0, NAME_LEN - 1).map(i => `c${i}`);
    return p.mode === 'edit' ? ['mhz', 'khz', ...chars, 'type'] : [...chars, 'type'];
  }

  // ---------- periodic ----------
  tick() {
    const now = this.now();
    if (!this.power) return;
    const h = this.hold;
    if (h.flip && !h.flip.fired && now - h.flip.t >= HOLD_MS) { h.flip.fired = true; this.emergency(); }
    if (h.xfr && !h.xfr.fired && now - h.xfr.t >= HOLD_MS) { h.xfr.fired = true; this.toggleLock(); }
    if (h.xfr && !h.xfr.stuck && now - h.xfr.t >= STUCK_WARN_MS) { h.xfr.stuck = true; this.raise('XFR_STUCK'); }
    if (h.sq && !h.sq.fired && now - h.sq.t >= HOLD_MS) { h.sq.fired = true; this.emergency(); }
    if (this.tx && !this.stuck) {
      const dur = now - this.txStart;
      if (dur >= STUCK_WARN_MS && !this.pttWarned) { this.pttWarned = true; this.raise('PTT_STUCK'); }
      if (dur >= STUCK_MS) this.stuck = true;
    }
    for (const k of ['act', 'stb']) if (this.rx[k] && now > this.rx[k].until) this.rx[k] = null;
    if (this.page.id === 'load' && this.page.phase === 'progress' && now - this.page.t0 > 6000) {
      this.page.phase = 'done';
      this.s.db = { ...USB_DB_INFO };
      this.save();
    }
    if (this.shutdownAt && now >= this.shutdownAt) this.powerOff();
  }

  // ---------- simulation events (side panel) ----------
  simulateRx(which, ms = 4000, clip = 0) {
    if (!this.power) return;
    const now = this.now();
    this.rx[which] = { which, start: now, until: now + ms, clip };
  }
  // Losing aircraft power: POWER ALERT, then the unit shuts down after a short
  // hold-up time unless power returns. When power returns with the knob still on,
  // the unit powers back up by itself.
  removeAircraftPower() {
    if (!this.bus) return;
    this.bus = false;
    if (!this.power) return;
    this.msgs = this.msgs.filter(m => m !== 'POWER');
    this.raise('POWER');
    this.shutdownAt = this.now() + 10000;
  }
  restoreAircraftPower() {
    this.bus = true;
    this.shutdownAt = 0;
    this.msgs = this.msgs.filter(m => m !== 'POWER');
    this.applyPower();
  }
  triggerMessage(id) {
    if (!this.power) return;
    this.msgs = this.msgs.filter(m => m !== id);
    this.raise(id);
  }

  // What the pilot would hear right now.
  audio() {
    if (!this.power) return { src: 'off' };
    if (this.transmitting) return { src: 'tx', freq: this.s.act };
    // Manual 2.2: a signal on the active frequency takes priority over the
    // monitored standby; the standby is heard again once the active goes quiet.
    if (this.rx.act) return { src: 'act', freq: this.s.act, call: this.rx.act };
    if (this.rx.stb && this.s.mon) return { src: 'stb', freq: this.s.stb, call: this.rx.stb };
    if (this.s.sq) return { src: 'static' };
    return { src: 'quiet' };
  }

  // ---------- view model ----------
  view() {
    const now = this.now();
    if (!this.power) return { off: true };
    if (this.booting) {
      return { splash: ['GARMIN', `${UNIT_INFO.model}  SW ${UNIT_INFO.displaySw}`, `DB CYCLE ${this.s.db.cycle}  ${this.s.db.region}`] };
    }
    const s = this.s;
    const au = this.audio();
    const v = {
      brt: s.brt, contrast: s.contrast,
      ann: this.transmitting ? 'TX' : (au.src === 'act' || au.src === 'stb') ? 'RX' : s.sq ? 'SQ' : '',
      act: fmtFreq(s.act),
      locked: this.locked,
      right: null, bottomLeft: [], bottomRight: [], bottomFull: null,
    };

    if (this.msgs.length) {
      v.right = { type: 'msg', title: 'MESSAGE', text: MESSAGES[this.msgs[0]] };
      v.bottomLeft = [S('ENT=ACKNOWLEDGE')];
      return v;
    }

    const p = this.page;
    const render = this.renderers[p.id];
    render.call(this, p, v);

    // overlays on bottom line (COM display first-class indications)
    if (this.toastMsg && now < this.toastMsg.until && !v.bottomFull) v.bottomFull = [S(this.toastMsg.text)];
    if (p.id === 'com' || (p.id === 'db' && p.from === 'com')) {
      const holdingFlip = this.hold.flip && !this.hold.flip.fired && now - this.hold.flip.t > 300;
      if (holdingFlip || now < this.emergHintUntil) v.bottomFull = [S('HOLD FOR EMERGENCY COM FREQUENCY', { box: true })];
    }
    if (now < this.volShowUntil) v.bottomFull = [S('COM VOL '), S('', { bar: s.vol })];
    if (this.stuck) v.bottomFull = [S('STUCK MIC', { inv: true })];
    return v;
  }

  renderers = {
    com(p, v) {
      const s = this.s;
      v.right = { type: 'com', com: true, label: s.mon ? 'MN' : 'STB', big: [S(fmtFreq(s.stb))] };
      const dt = this.displayedTimer();
      if (p.prompt) {
        v.bottomLeft = [S(p.prompt.kind === 'stop' ? 'STOP TMR? ENT=STOP CLR=CANCEL' : 'RESET TMR? ENT=RESET CLR=CANCEL')];
        v.bottomRight = [this.timerSeg(p.prompt.which)];
        v.promptWide = true;
        return;
      }
      v.bottomLeft = [S(this.reverse(s.act) || 'COM ACTIVE')];
      v.bottomRight = dt ? [this.timerSeg(dt)] : [S(this.reverse(s.stb) || 'COM STANDBY')];
    },

    menu(p, v) {
      const c = MENU[this.menuPos.cat];
      const i = this.menuPos.item;
      const item = (k) => {
        const [label, key] = c.items[k];
        const dis = key === 'adjics' && !this.s.ics.on;
        return label + (dis ? ' (OFF)' : '');
      };
      v.right = {
        type: 'page', title: c.title,
        rows: [
          [S(item(i), { inv: true }), S(`  ${i + 1}/${c.items.length}`, { small: true })],
          [S(c.items.length > 1 ? item(wrap(i + 1, c.items.length)) : '', { dim: true })],
        ],
      };
      v.bottomLeft = [S('ENT=SELECT  FUNC=EXIT')];
    },

    list(p, v) {
      const titles = { recent: 'COM RECENT FREQS', user: 'COM USER FREQS', napt: 'NEAREST AIRPORT', nacc: 'NEAREST ACC', nfss: 'NEAREST FSS', nwx: 'NEAREST WEATHER' };
      const items = this.listItems(p.kind);
      const it = items[p.idx];
      const count = p.kind === 'user' ? this.s.user.length : items.length;
      let rows;
      if (!items.length) {
        rows = [[S(['recent', 'user'].includes(p.kind) ? 'LIST EMPTY' : 'NO POSITION')], [S('')]];
      } else if (it.empty) {
        rows = [[S('---.---', { big: true }), S(` ${p.idx + 1}`, { inv: true }), S(` OF ${MAX_USER}`, { small: true })],
          [S('EMPTY - PUSH CRSR TO ADD')]];
      } else {
        const l2 = p.kind === 'user'
          ? [S('WPT '), S(toChars(it.user.name, NAME_LEN).join(''), { ul: true }), S(' TYPE '), S(it.user.type || '____', { ul: true })]
          : it.l2;
        const head = it.apt ? it.apt.id : fmtFreq(it.freq);
        rows = [[S(head, { big: true }), S(` ${p.idx + 1}`, { inv: true }), S(` OF ${count}`, { small: true })], l2];
      }
      v.right = { type: 'page', title: titles[p.kind], rows };
      v.bottomLeft = [S(p.kind === 'napt' ? 'ENT=DONE' : '⇄=ACT  ENT=STB')];
      if (p.confirm) v.bottomFull = [S('DELETE FREQUENCY? ENT TO CONFIRM')];
    },

    uedit(p, v) {
      const fields = this.ueditFields(p);
      const cf = p.nameDone ? null : fields[p.cur];
      const f = fmtFreq(p.freq).split('.');
      const freqSegs = p.mode === 'edit'
        ? [S(f[0], { big: true, inv: cf === 'mhz' }), S('.', { big: true }), S(f[1], { big: true, inv: cf === 'khz' })]
        : [S(fmtFreq(p.freq), { big: true })];
      // save screen: 'Number of Frequencies Saved' (manual 2.3); edit: position in list
      const n = p.mode === 'save' ? this.s.user.length : (p.idx < 0 ? this.s.user.length + 1 : p.idx + 1);
      const name = p.name.map((c, i) => S(c, { inv: cf === `c${i}`, ul: true }));
      v.right = {
        type: 'page', title: p.mode === 'save' ? 'SAVE USER FREQ' : 'EDIT USER FREQ',
        rows: [
          [...freqSegs, S(` ${n}`, { inv: false }), S(` OF ${MAX_USER}`, { small: true })],
          [S('WPT '), ...name, S(' TYPE '), S(TYPES[p.type] || '____', { inv: cf === 'type', ul: true })],
        ],
      };
      v.bottomLeft = [S('ENT=ACCEPT  CLR=UNDO')];
    },

    db(p, v) {
      if (p.phase === 'ident') {
        const field = p.ident.map((c, i) => S(c, { inv: i === p.cur }));
        const a = this.findIdent(fromChars(p.ident));
        const name = a ? a.name : 'ENTER IDENTIFIER';
        if (p.from === 'com') {
          v.right = { type: 'com', com: true, label: '', big: field };
          v.bottomLeft = [S('COM ACTIVE')];
          v.bottomRight = [S(name)];
        } else {
          v.right = { type: 'page', title: 'COM DATABASE', rows: [field.map(x => ({ ...x, big: true })), [S(name)]] };
          v.bottomLeft = [S('ENT=DONE')];
        }
        return;
      }
      const e = p.entries[p.idx];
      v.right = {
        type: 'page', title: 'COM DATABASE',
        rows: [
          [S(fmtFreq(e.f), { big: true }), S(` ${p.idx + 1} OF ${p.entries.length}`, { small: true })],
          [S('WPT '), S(fromChars(p.ident), { ul: true }), S(' TYPE '), S(e.label, { inv: true })],
        ],
      };
      if (e.label && fromChars(p.ident) === FIR.id) v.right.rows[1] = [S(STATIONS.find(st => st.f === e.f)?.name || ''), S(' '), S(e.type, { inv: true })];
      v.bottomLeft = [S('⇄=ACT  ENT=STB')];
    },

    set(p, v) {
      const def = SETTINGS[p.kind];
      const fieldSeg = (i) => {
        const f = def.fields[i];
        if (f.show && !f.show(p.vals)) return [];
        return [S(`${f.label}${f.sep ?? ': '}`), S(p.vals[f.k], { inv: i === p.cur }), S('  ')];
      };
      const rows = def.rows.map(r => r.flatMap(i => (i === 'info' ? [S(def.info(p.vals))] : fieldSeg(i))));
      v.right = { type: 'page', title: def.title, rows };
      v.bottomLeft = [S('ENT=DONE  CLR=UNDO')];
    },

    info(p, v) {
      const s = this.s;
      const pages = {
        dbinfo: ['DATABASE INFO', `CYCLE: ${s.db.cycle}`, `EFCTV: ${s.db.effective}`, `REG: ${s.db.region}`],
        swver: ['SOFTWARE VERSIONS', `DISPLAY: ${UNIT_INFO.displaySw}`, `COM: ${UNIT_INFO.comSw}`],
        serial: ['SERIAL NUMBER', `S/N: ${UNIT_INFO.serial}`, `ID: ${UNIT_INFO.systemId}`],
      };
      const [title, ...lines] = pages[p.kind];
      v.right = { type: 'page', title, rows: lines.map(l => [S(l)]) };
      v.bottomLeft = [S('')];
    },

    load(p, v) {
      let rows;
      if (p.phase === 'prompt') rows = [[S('PRESS ENT TO LOAD')], [S('DATABASE FROM USB.')], [S('CLR TO CANCEL.')]];
      else if (p.phase === 'version') rows = [[S('INSTALLED   ON DRIVE')], [S(`CYCLE: ${this.s.db.cycle} CYCLE: ${USB_DB_INFO.cycle}`)]];
      else if (p.phase === 'progress') {
        const pct = Math.min(100, Math.floor((this.now() - p.t0) / 60));
        rows = [[S('UPDATING DATABASE...')], [S('', { bar: pct }), S(` ${pct}%`)], [S('DO NOT REMOVE USB')]];
      } else rows = [[S('UPDATE COMPLETE')], [S(`CYCLE: ${this.s.db.cycle}`)], [S('ENT TO CONTINUE')]];
      v.right = { type: 'page', title: p.phase === 'version' ? 'DATABASE VERSIONS:' : 'DATABASE UPDATE', rows };
      v.bottomLeft = [S(p.phase === 'version' ? 'ENT=UPDATE  CLR=CANCEL' : '')];
    },

    tmrup(p, v) {
      v.right = { type: 'page', title: 'COUNT UP TIMER', rows: [[{ ...this.cuSeg(), big: true }], [S(this.cu.running ? 'RUNNING' : 'STOPPED', { small: true })]] };
      v.bottomLeft = [S('ENT=START/STOP  CLR=RESET')];
    },

    tmrdown(p, v) {
      let big;
      if (p.edit) {
        const e = p.edit;
        big = [e.h, e.m, e.s].flatMap((x, i) => [S(String(x).padStart(2, '0'), { big: true, inv: e.field === i }), ...(i < 2 ? [S(':', { big: true })] : [])]);
        v.bottomLeft = [S('ENT=ACCEPT  CLR=CANCEL')];
      } else {
        big = [{ ...this.cdSeg(), big: true }];
        v.bottomLeft = [S('ENT=START/STOP CLR=RESET PUSH CRSR=SETTINGS')];
      }
      const status = p.edit ? 'SET START TIME' : this.cd.running ? (this.cdRemainingMs() < 0 ? 'EXPIRED - COUNTING UP' : 'RUNNING') : 'STOPPED';
      v.right = { type: 'page', title: 'COUNT DOWN TIMER', rows: [big, [S(`${status}  START ${fmtTime(this.s.cdStart)}`, { small: true })]] };
    },
  };
}
