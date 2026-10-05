// VHF COM channel math. Frequencies are integers in kHz using channel names
// (8.33 kHz channels named x.005/x.010/x.015/x.030...; 25 kHz ones x.000/x.025/...).
import { range } from './util.js';

export const EMERGENCY = 121500;
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
