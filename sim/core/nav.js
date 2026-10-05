// Navigation geometry: bearings, VOR radial / bearing TO, CDI, dead-reckoning step.
// Angles in degrees; magnetic = true - variation (variation east positive).
const rad = Math.PI / 180;
export const wrap360 = a => ((a % 360) + 360) % 360;
export const wrap180 = a => { const w = wrap360(a); return w > 180 ? w - 360 : w; };

// initial great-circle bearing a -> b (true)
export function bearingTrue(a, b) {
  const p1 = a.lat * rad, p2 = b.lat * rad, dl = (b.lon - a.lon) * rad;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return wrap360(Math.atan2(y, x) / rad);
}

// radial the aircraft is on (FROM the station) and the bearing TO the station, both magnetic
export const radialFrom = (st, pos) => wrap360(bearingTrue(st, pos) - (st.var || 0));
export const bearingTo = (st, pos) => wrap360(bearingTrue(pos, st) - (st.var || 0));

// magnetic variation used to turn a simulated flight's track into true (Czech ~5E)
export const FLIGHT_VAR = 5;

export const CDI_FULL_DEG = 10;   // manual 2.3: 5 dots each side, 2 degrees per dot

/**
 * VOR CDI for a selected course (OBS).
 * Returns { toFrom: 'TO'|'FROM', needleDeg } where needleDeg > 0 means the course is to
 * the right (fly towards the needle), clamped to +-CDI_FULL_DEG.
 */
export function vorCdi(obs, radial) {
  const brgTo = wrap360(radial + 180);
  const toFrom = Math.abs(wrap180(brgTo - obs)) <= 90 ? 'TO' : 'FROM';
  const ref = toFrom === 'TO' ? brgTo : radial;
  const needle = wrap180(obs - ref);
  return { toFrom, needleDeg: Math.max(-CDI_FULL_DEG, Math.min(CDI_FULL_DEG, needle)) };
}

// move pos along a true track by distNm (spherical)
export function movePos(pos, trkTrue, distNm) {
  const d = distNm / 3440.065, th = trkTrue * rad;
  const p1 = pos.lat * rad, l1 = pos.lon * rad;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th));
  const l2 = l1 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: p2 / rad, lon: ((l2 / rad + 540) % 360) - 180 };
}
