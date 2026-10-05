// ComRadio: the VHF COM transceiver behaviour shared by Garmin COM units
// (GTR 225, and the COM side of a GNC 255). No DOM: the UI feeds input() and
// renders view(). A device subclass supplies its menu, settings, keys, messages,
// defaults and info pages through the `device` config passed to the constructor.
import { S, clamp } from '../core/util.js';
import { EMERGENCY, fmtFreq, stepKhz, is833Only, snapTo25 } from '../core/freq.js';
import { toChars } from '../core/text.js';
import { Stopwatch, fmtTime } from '../core/time.js';
import { makeStore } from '../core/persist.js';
import { FreqDatabase } from './database.js';
import { COM_BAND } from './band.js';
import { MAX_RECENT, HOLD_MS, STUCK_WARN_MS, STUCK_MS, DB_MEMORY_MS, IDENT_LEN } from './constants.js';
import comMain from './pages/com-main.js';
import menu from './pages/menu.js';
import lists, { LIST_KINDS } from './pages/lists.js';
import userEdit from './pages/user-edit.js';
import dbLookup from './pages/db-lookup.js';
import settings from './pages/settings.js';
import info from './pages/info.js';
import loadDb from './pages/load-db.js';
import { countUp, countDown } from './pages/timers.js';

const BOOT_MS = 2500;
const SHUTDOWN_HOLDUP_MS = 10000;

export class ComRadio {
  /**
   * @param opts   { now, storage }
   * @param device { persistKey, defaults(), menu, settingsDefs, messages, unitInfo,
   *                 data: { airports, stations, fir, positions, usbDb },
   *                 keys: {KEY: radio => …} (blocked while a message shows),
   *                 alwaysKeys: {KEY: radio => …} (work even with a message),
   *                 pages: extra/override page modules,
   *                 itemBlocked(key) -> truthy when unavailable, infoPage(kind) -> [title, ...lines] }
   * }
   */
  constructor({ now = () => performance.now(), storage = null } = {}, device) {
    this.now = now;
    this.device = device;
    this.store = makeStore(storage, device.persistKey);
    this.menu = device.menu;
    this.settingsDefs = device.settingsDefs;
    this.messages = device.messages;
    this.unitInfo = device.unitInfo;
    this.db = new FreqDatabase(device.data);
    this.positions = device.data.positions;
    this.usbDb = device.data.usbDb;
    this.pages = {
      com: comMain, menu, list: lists, uedit: userEdit, db: dbLookup,
      set: settings, info, load: loadDb, tmrup: countUp, tmrdown: countDown,
      ...(device.pages || {}),
    };

    this.s = device.defaults();
    const saved = this.store.load();
    if (saved) Object.assign(this.s, saved);

    this.power = false;     // unit actually running
    this.switchOn = false;  // PWR/VOL knob turned past the OFF detent
    this.bus = true;        // aircraft (avionics bus) power present
    this.bootUntil = 0;
    this.page = { id: 'com' };
    this.menuPos = { cat: 0, item: -1 };
    this.cu = new Stopwatch();
    this.cd = new Stopwatch();
    this.tx = false; this.txStart = 0; this.stuck = false; this.pttWarned = false;
    this.locked = false;
    // incoming transmissions, one per frequency: {which, start, until, clip}
    this.rx = { act: null, stb: null };
    this.hold = {};
    this.msgs = [];
    this.volShowUntil = 0;
    this.emergHintUntil = 0;
    this.dbMemory = {};   // last database look-up per band (kept 30 min)
    this.recallIdx = -1;
    this.shutdownAt = 0;
  }

  // ---------- persistence ----------
  save() { this.store.save(this.s); }
  factoryReset() {
    this.s = this.device.defaults();
    this.cu.reset(); this.cd.reset();
    this.locked = false; this.msgs = []; this.dbMemory = {};
    this.page = { id: 'com' };
    this.save();
  }

  // ---------- helpers ----------
  get transmitting() { return this.tx && !this.stuck; }
  get pos() { return this.positions.find(p => p.id === this.s.posId) || this.positions[0]; }
  pushRecent(f, band = COM_BAND) {
    const st = band.state(this);
    st.recent = [f, ...st.recent.filter(x => x !== f)].slice(0, MAX_RECENT);
  }
  setActive(f, band = COM_BAND) {
    if (band === COM_BAND) {
      if (this.locked || this.transmitting) return false;
    }
    band.state(this).act = f;
    this.pushRecent(f, band);
    this.save();
    return true;
  }
  setStandby(f, band = COM_BAND) { band.state(this).stb = f; this.save(); }
  swap(band = COM_BAND) {
    if (band === COM_BAND) {
      if (this.locked || this.transmitting) return; // locked / flip disabled during TX
    }
    const st = band.state(this);
    [st.act, st.stb] = [st.stb, st.act];
    this.pushRecent(st.act, band);
    this.save();
  }
  // band shown on the main page (a NAV/COM switches it with C/N)
  mainBand() { return COM_BAND; }
  goMain() { this.page = { id: 'com', band: this.mainBand() }; }
  goCom() { this.page = { id: 'com' }; }
  goBack(p = this.page) { if (p.back) this.page = p.back; else this.goMain(); }
  raise(id) {
    if (this.msgs.includes(id)) return;
    this.msgs.push(id);
  }
  itemBlocked(key) { return this.device.itemBlocked ? this.device.itemBlocked.call(this, key) : null; }
  infoPage(kind) { return this.device.infoPage.call(this, kind); }

  // ---------- database ----------
  reverse(f, band = COM_BAND) { return this.s.gps ? band.db(this).reverse(f, this.pos) : null; }
  usableFreq(f) { return this.s.spacing === 833 || !is833Only(f); }
  listItems(kind, band = COM_BAND) {
    const st = band.state(this);
    if (kind === 'recent') return st.recent.map(f => ({ freq: f, l2: [S(this.reverse(f, band) || '')] }));
    if (kind === 'user') {
      const items = st.user.map(u => ({ freq: u.freq, user: u }));
      return items;
    }
    if (!this.s.gps) return [];
    if (kind === 'nvor') return this.navDb.nearestVors(this.pos).map(v => ({ freq: v.f, l2: [S(`${v.id} ${v.type}`)] }));
    if (kind === 'napt') return this.db.nearestAirports(this.pos).map(a => ({ apt: a, l2: [S(a.name)] }));
    const cat = { nacc: 'acc', nfss: 'fss', nwx: 'wx' }[kind];
    return this.db.nearestStations(cat, this.pos, f => this.usableFreq(f)).map(o => ({ freq: o.f, l2: [S(o.name)] }));
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
    this.bootUntil = this.now() + BOOT_MS;
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
  // Generic events: vol (arg), outer/inner (arg = ±1), push, CLR, ENT, sqDown/sqUp,
  // flipDown/flipUp, xfrDown/xfrUp, pttDown/pttUp, recall, chanUp/chanDn.
  // Bezel keys (COM, MEM, FUNC, MON, ICS…) come from the device key maps.
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
      case 'chanUp': case 'chanDn':
        this.setStandby(stepKhz(this.s.stb, evt === 'chanUp' ? 1 : -1, this.s.spacing));
        return;
    }
    const always = this.device.alwaysKeys?.[evt];
    if (always) return always(this);

    // Pending message: ENT acknowledges; other bezel keys are ignored.
    if (this.msgs.length) {
      if (evt === 'ENT') this.msgs.shift();
      return;
    }

    const key = this.device.keys?.[evt];
    if (key) return key(this);

    const h = this.pages[this.page.id]?.handlers;
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
      const it = this.listItems(p.kind, p.band || COM_BAND)[p.idx];
      if (it && !it.empty && !it.apt) this.setActive(it.freq, p.band || COM_BAND); // stays on the list (CLR leaves)
      return;
    }
    if (!this.msgs.length && p.id === 'db' && p.phase === 'type') {
      const band = p.band || COM_BAND;
      const e = p.entries[p.idx];
      this.dbMemory[band.key] = { ident: p.ident.join(''), idx: p.idx, t: this.now() };
      // from the main page the look-up ends on the main page (manual 2.4 step 7);
      // from the function lists you stay on the page
      if (this.setActive(e.f, band) && p.from === 'com') this.goMain();
      return;
    }
    this.swap(this.mainBand());
  }

  emergency() {
    if (this.locked) return;
    if (this.s.act !== EMERGENCY) this.s.stb = this.s.act;
    this.s.act = EMERGENCY;
    this.pushRecent(EMERGENCY);
    this.emergHintUntil = this.now() + 2500;
    this.showCom();
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

  setSpacing(sp) {
    if (sp === this.s.spacing) return;
    this.s.spacing = sp;
    if (sp === 25) {
      this.s.user = this.s.user.filter(u => !is833Only(u.freq));
      this.s.recent = this.s.recent.filter(f => !is833Only(f)); // NOTE p.i: user and recent 8.33 freqs are lost
      this.s.act = snapTo25(this.s.act);
      this.s.stb = snapTo25(this.s.stb);
    }
    this.save();
  }

  // emergency / lock always end on the COM page
  showCom() { this.goCom(); }

  // ---------- page openers ----------
  openSetting(kind, back, viaKey = false) {
    const def = this.settingsDefs[kind];
    this.page = { id: 'set', kind, vals: def.get(this.s), cur: 0, back, viaKey, func: !viaKey };
  }
  openItem(key) {
    const back = { id: 'menu', func: true };
    if (this.itemBlocked(key)) return;
    const navBand = this.device.navBand;
    if (navBand && key.startsWith('nav')) {
      const kind = key.slice(3);   // navrecent / navuser / navdb
      if (kind === 'db') this.openLookup('func', back, navBand);
      else this.page = { id: 'list', kind, band: navBand, idx: 0, from: 'func', func: true, back };
    } else if (key === 'nvor') {
      this.page = { id: 'list', kind: 'nvor', band: navBand, idx: 0, from: 'func', func: true, back };
    } else if (LIST_KINDS.includes(key)) {
      this.page = { id: 'list', kind: key, idx: 0, from: 'func', func: true, back };
    } else if (key === 'db') {
      this.openLookup('func', back);
    } else if (this.settingsDefs[key]) {
      this.openSetting(key, back);
    } else if (key === 'load') {
      this.page = { id: 'load', phase: 'prompt', func: true, back };
    } else if (key === 'tmrup' || key === 'tmrdown') {
      this.page = { id: key, func: true, back };
    } else {
      this.page = { id: 'info', kind: key, func: true, back };
    }
  }
  openAirportFreqs(a, back) {
    this.page = { id: 'db', from: 'func', func: true, fromList: true, back, phase: 'type',
      ident: toChars(a.id, IDENT_LEN), cur: 0, entries: this.db.typeEntries(a), idx: 0 };
  }
  openLookup(from, back, band = COM_BAND) {
    const m = this.dbMemory[band.key];
    const mem = m && this.now() - m.t < DB_MEMORY_MS ? m : null;
    this.page = {
      id: 'db', band, from, back, func: from === 'func', phase: 'ident',
      ident: toChars(mem ? mem.ident : '', IDENT_LEN), cur: 0,
      entries: [], idx: mem ? mem.idx : 0,
    };
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
    this.pages[this.page.id]?.tick?.call(this, this.page);
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
    this.shutdownAt = this.now() + SHUTDOWN_HOLDUP_MS;
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
    const s = this.s;
    if (this.booting) {
      // Installation Manual 190-01182-02: "Garmin" appears at power-up (6.4) and the database
      // information is displayed during the start-up sequence (6.6.4.4). Exact layout not shown.
      const first = this.now() < this.bootUntil - BOOT_MS / 2;
      return { splash: first ? ['GARMIN'] : ['', `CYCLE: ${s.db.cycle}`, `EFCTV: ${s.db.effective}`] };
    }
    const au = this.audio();
    const v = {
      brt: s.brt, contrast: s.contrast,
      ann: this.transmitting ? 'TX' : (au.src === 'act' || au.src === 'stb') ? 'RX' : s.sq ? 'SQ' : '',
      act: fmtFreq(s.act),   // replaced below by the shown band
      right: null, bottomLeft: [], bottomRight: [], bottomFull: null,
    };

    if (this.msgs.length) {
      // manual 5.1 screenshot: message text full width, "ENT=ACCEPT" bottom-left
      // (messages are stored as "CATEGORY - text"; the unit shows the text)
      const full = this.messages[this.msgs[0]];
      const text = full.includes(' - ') ? full.slice(full.indexOf(' - ') + 3) : full;
      return { brt: s.brt, contrast: s.contrast, message: text.replace(/\.$/, ''), bottomLeft: [S('ENT=ACCEPT')] };
    }

    const p = this.page;
    const shown = p.band || this.mainBand();
    v.act = shown.fmt(shown.state(this).act);
    if (shown !== COM_BAND) v.ann = this.navAnn?.() ?? '';
    this.pages[p.id].render.call(this, p, v);
    // settings that preview live on the display (e.g. brightness / contrast)
    if (p.id === 'set') this.settingsDefs[p.kind].preview?.(p.vals, v);

    // overlays on the bottom line
    if (p.id === 'com' || (p.id === 'db' && p.from === 'com')) {
      const holdingFlip = this.hold.flip && !this.hold.flip.fired && now - this.hold.flip.t > 300;
      if (holdingFlip || now < this.emergHintUntil) v.bottomFull = [S('HOLD FOR EMERGENCY COM FREQUENCY', { box: true })];
    }
    if (now < this.volShowUntil) v.bottomFull = [S('COM VOL '), S('', { bar: s.vol })];
    if (this.stuck) v.bottomFull = [S('STUCK MIC', { inv: true })];
    return v;
  }
}
