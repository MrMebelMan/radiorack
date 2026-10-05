// Garmin GTR 225A: device definition on top of the shared COM transceiver.
import { ComRadio } from '../../com/com-radio.js';
import { AIRPORTS, STATIONS, FIR, POSITIONS, DB_INFO, USB_DB_INFO } from '../../data/lk.js';
import { UNIT_INFO } from './info.js';
import { COM_MESSAGES, COM_SETTINGS, comDefaults } from '../../com/garmin-defs.js';

export const MESSAGES = COM_MESSAGES;
export const SETTINGS = COM_SETTINGS;
export const defaultSettings = () => comDefaults(DB_INFO);

export const PERSIST_KEY = 'gtr225-sim-v2';

// FUNC menu tree (manual 3.1)
export const MENU = [
  { title: 'COM FREQUENCY LIST', items: [['RECENT FREQS', 'recent'], ['USER FREQS', 'user'], ['DATABASE', 'db'], ['NEAREST APT', 'napt'], ['NEAREST ACC', 'nacc'], ['NEAREST FSS', 'nfss'], ['NEAREST WX', 'nwx']] },
  { title: 'ICS CONFIGURATION', items: [['ADJUST INTRCOM', 'adjics'], ['AUX AUDIO', 'aux'], ['INTRCOM ON/OFF', 'icsonoff'], ['SPEAKER ON/OFF', 'spk']] },
  { title: 'SYS CONFIGURATION', items: [['COM SPACING', 'spacing'], ['COM SIDETONE', 'sidetone'], ['DSPL BRT', 'brt'], ['DSPL CONTRAST', 'contrast'], ['DATABASE INFO', 'dbinfo'], ['LOAD DATABASE', 'load'], ['SOFTWARE VER', 'swver'], ['SERIAL NUMBER', 'serial']] },
  { title: 'TMR CONFIGURATION', items: [['COUNT UP', 'tmrup'], ['COUNT DOWN', 'tmrdown']] },
];

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
    FUNC: r => { if (r.page.func) r.goCom(); else { r.menuPos = { cat: 0, item: -1 }; r.page = { id: 'menu', func: true }; } },   // FUNC opens at COM FREQUENCY LIST, no item (every manual procedure starts there)
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
    remoteIcs: r => { r.s.ics.on = !r.s.ics.on; r.save(); },
  },
  // Adjust Intercom needs the intercom ON (manual 3.3.1)
  itemBlocked(key) { return key === 'adjics' && !this.s.ics.on; },
  infoPage(kind) {
    const s = this.s, u = this.unitInfo;
    return {
      dbinfo: ['DATABASE INFO', `CYCLE: ${s.db.cycle}`, `EFCTV: ${s.db.effective}`, `REG: ${s.db.region}`],
      swver: ['SOFTWARE VERSIONS', `DISPLAY: ${u.displaySw}`, `COM: ${u.comSw}`],
      serial: ['SERIAL NUMBER', `S/N: ${u.serial}`, `ID: ${u.systemId}`],
    }[kind];
  },
};

export class GTR225 extends ComRadio {
  constructor(opts = {}) { super(opts, DEVICE); }
}
