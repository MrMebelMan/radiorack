// NAV (VLOC) band: 108.00-117.95 MHz in 50 kHz steps (GNC 255 manual 1.1).
// Shown with two decimals; the NAV DATABASE page shows three (manual 3.3.3 screenshot).
import { range, wrap } from '../core/util.js';
import { fmtFreq } from '../core/freq.js';

export const NAV_MIN_MHZ = 108, NAV_MAX_MHZ = 117;
const KHZ = range(0, 950, 50);
export const NAV_TYPES = ['VOR', 'DME', 'LOC', 'ILS', ...range(1, 36).map(n => String(n).padStart(2, '0')), ''];

export const fmtNav = f => `${Math.floor(f / 1000)}.${String(f % 1000).padStart(3, '0').slice(0, 2)}`;
export function stepNavMhz(f, dir) {
  let mhz = Math.floor(f / 1000) + dir;
  if (mhz > NAV_MAX_MHZ) mhz = NAV_MIN_MHZ;
  if (mhz < NAV_MIN_MHZ) mhz = NAV_MAX_MHZ;
  return mhz * 1000 + (f % 1000);
}
export function stepNavKhz(f, dir) {
  const mhz = Math.floor(f / 1000);
  let i = KHZ.indexOf(f % 1000);
  if (i < 0) i = Math.floor((f % 1000) / 50);
  return mhz * 1000 + KHZ[wrap(i + dir, KHZ.length)];
}
// localizer channels: 108.10-111.95 with an odd tenths digit
export const isLoc = f => f >= 108000 && f < 112000 && Math.floor((f % 1000) / 100) % 2 === 1;

export const NAV_BAND = {
  key: 'nav',
  label: 'NAV',
  types: NAV_TYPES,
  fmt: fmtNav,
  fmtDb: fmtFreq,
  stepMhz: stepNavMhz,
  stepKhz: (f, d) => stepNavKhz(f, d),
  state: r => r.s.nav,
  db: r => r.navDb,
  saveHint: 'ENT=DONE  CLR=UNDO',
  // the manual's NAV user-list screenshots are titled "NAV RECENT FREQS" (3.3.2) - copied as shown
  titles: { recent: 'NAV RECENT FREQS', user: 'NAV RECENT FREQS', db: 'NAV DATABASE' },
  idle: { act: 'NAV ACTIVE', stb: 'NAV STANDBY' },
};
