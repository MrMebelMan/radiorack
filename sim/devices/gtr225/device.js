// Garmin GTR 225A: device definition on top of the shared COM transceiver.
import { range, clamp } from '../../core/util.js';
import { ComRadio } from '../../com/com-radio.js';
import { AIRPORTS, STATIONS, FIR, POSITIONS, DB_INFO, USB_DB_INFO } from '../../data/lk.js';
import { UNIT_INFO } from './info.js';

export const PERSIST_KEY = 'gtr225-sim-v2';

// Messages (manual 5.1)
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

// FUNC menu tree (manual 3.1)
export const MENU = [
  { title: 'COM FREQUENCY LIST', items: [['RECENT FREQS', 'recent'], ['USER FREQS', 'user'], ['DATABASE', 'db'], ['NEAREST APT', 'napt'], ['NEAREST ACC', 'nacc'], ['NEAREST FSS', 'nfss'], ['NEAREST WX', 'nwx']] },
  { title: 'ICS CONFIGURATION', items: [['ADJUST INTRCOM', 'adjics'], ['AUX AUDIO', 'aux'], ['INTRCOM ON/OFF', 'icsonoff'], ['SPEAKER ON/OFF', 'spk']] },
  { title: 'SYS CONFIGURATION', items: [['COM SPACING', 'spacing'], ['COM SIDETONE', 'sidetone'], ['DSPL BRT', 'brt'], ['DSPL CONTRAST', 'contrast'], ['DATABASE INFO', 'dbinfo'], ['LOAD DATABASE', 'load'], ['SOFTWARE VER', 'swver'], ['SERIAL NUMBER', 'serial']] },
  { title: 'TMR CONFIGURATION', items: [['COUNT UP', 'tmrup'], ['COUNT DOWN', 'tmrdown']] },
];

// Settings pages (manual 3.3 / 3.4); labels as on the manual's screenshots
const ONOFF = ['OFF', 'ON'];
const vol100 = range(0, 100, 5);
export const SETTINGS = {
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
    // ComRadio.setSpacing also drops 8.33-only user/recent freqs (manual NOTE)
    set(s, v) { this.setSpacing(v.sp.startsWith('25') ? 25 : 833); },
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
    // readout fitted to the manual's screenshot (OFFSET 25 -> BRIGHTNESS 25); formula not published
    info: v => `BRIGHTNESS ${clamp(v.brt, 0, 100)}`,
    preview: (vals, view) => { view.brt = vals.brt; },   // live while turning; CLR restores
    get: s => ({ brt: s.brt }),
    set: (s, v) => { s.brt = v.brt; },
  },
  contrast: {
    title: 'DISPLAY CONTRAST',
    fields: [{ k: 'contrast', label: 'OFFSET', sep: ' ', vals: range(-50, 50) }],
    rows: [[0]],
    preview: (vals, view) => { view.contrast = vals.contrast; },
    get: s => ({ contrast: s.contrast }),
    set: (s, v) => { s.contrast = v.contrast; },
  },
};

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

// ICS key: Adjust Intercom -> AUX Audio -> Intercom On/Off -> COM page
function icsKey(r) {
  const order = ['adjics', 'aux', 'icsonoff'].filter(k => k !== 'adjics' || r.s.ics.on);
  const p = r.page;
  let next = 0;
  if (p.id === 'set' && p.viaKey) {
    next = order.indexOf(p.kind) + 1;
    if (next >= order.length) return r.goCom();
  }
  r.openSetting(order[next], { id: 'com' }, true);
}

const DEVICE = {
  persistKey: PERSIST_KEY,
  defaults: defaultSettings,
  menu: MENU,
  settingsDefs: SETTINGS,
  messages: MESSAGES,
  unitInfo: UNIT_INFO,
  data: { airports: AIRPORTS, stations: STATIONS, fir: FIR, positions: POSITIONS, usbDb: USB_DB_INFO },
  // bezel keys; ignored while a message is shown (ENT acknowledges)
  keys: {
    COM: r => r.goCom(),
    FUNC: r => { if (r.page.func) r.goCom(); else r.page = { id: 'menu', func: true }; },
    MEM: r => {
      const p = r.page;
      const kind = p.id === 'list' && p.kind === 'recent' && p.from === 'mem' ? 'user' : 'recent';
      r.page = { id: 'list', kind, idx: 0, from: 'mem' };
    },
    ICS: icsKey,
  },
  // work even while a message is shown
  alwaysKeys: {
    MON: r => { r.s.mon = !r.s.mon; r.save(); },
    remoteIcs: r => { r.s.ics.on = !r.s.ics.on; r.save(); r.toast(`INTERCOM ${r.s.ics.on ? 'ON' : 'OFF'}`); },
  },
  // Adjust Intercom needs the intercom ON (manual 3.3.1)
  itemBlocked(key) { return key === 'adjics' && !this.s.ics.on ? 'INTERCOM IS OFF' : null; },
  infoPage(kind) {
    const s = this.s, u = this.unitInfo;
    return {
      dbinfo: ['DATABASE INFO', `CYCLE: ${s.db.cycle}`, `EFCTV: ${s.db.effective}`, `REG: ${s.db.region}`],
      swver: ['SOFTWARE VERSIONS', `DISPLAY: ${u.displaySw}`, `COM: ${u.comSw}`],
      serial: ['SERIAL NUMBER', `S/N: ${u.serial}`, `ID: ${u.systemId}`],
    }[kind];
  },
  splash() {
    return ['GARMIN', `${this.unitInfo.model}  SW ${this.unitInfo.displaySw}`, `DB CYCLE ${this.s.db.cycle}  ${this.s.db.region}`];
  },
};

export class GTR225 extends ComRadio {
  constructor(opts = {}) { super(opts, DEVICE); }
}
