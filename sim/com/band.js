// Band descriptors: what differs between the COM and the NAV side of a radio.
// Pages (lists, user edit, database look-up, main page) take `p.band` and stay generic.
import { fmtFreq, stepMhz, stepKhz } from '../core/freq.js';
import { TYPES } from './constants.js';

export const COM_BAND = {
  key: 'com',
  label: 'COM',
  types: TYPES,
  fmt: fmtFreq,
  fmtDb: fmtFreq,
  stepMhz: (f, d) => stepMhz(f, d),
  stepKhz: (f, d, r) => stepKhz(f, d, r.s.spacing),
  state: r => r.s,                 // { act, stb, recent, user }
  db: r => r.db,
  saveHint: 'ENT=ACCEPT  CLR=UNDO',
  titles: { recent: 'COM RECENT FREQS', user: 'COM USER FREQS', db: 'COM DATABASE' },
  idle: { act: 'COM ACTIVE', stb: 'COM STANDBY' },
};
