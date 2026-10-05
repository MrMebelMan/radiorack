// NAV database: VOR / DME / ILS stations, look-up, reverse look-up, nearest VORs.
import { distNm } from '../core/geo.js';
import { NEAREST_MAX } from '../com/constants.js';

export const NAV_RANGE_NM = 200;   // manual 2.4: DST only for stations within 200 NM

export class NavDatabase {
  constructor(stations) { this.stations = stations; }
  allIdents() { return [...new Map(this.stations.map(s => [s.id, s])).values()]; }
  findIdent(id) { return this.stations.find(s => s.id === id); }
  findAll(id) { return this.stations.filter(s => s.id === id); }
  typeEntries(st) { return [{ type: st.type, f: st.f, label: st.type }]; }
  // nearest station transmitting on f within range, or null
  stationOn(f, pos, maxNm = NAV_RANGE_NM) {
    let best = null;
    for (const st of this.stations) {
      if (st.f !== f) continue;
      const d = distNm(pos, st);
      if (d <= maxNm && (!best || d < best.d)) best = { st, d };
    }
    return best;
  }
  reverse(f, pos) {
    const b = this.stationOn(f, pos);
    return b ? `${b.st.id} ${b.st.type}` : null;
  }
  nearestVors(pos) {
    return this.stations.filter(s => s.type === 'VOR')
      .map(s => ({ s, d: distNm(pos, s) })).sort((a, b) => a.d - b.d).slice(0, NEAREST_MAX).map(o => o.s);
  }
}
