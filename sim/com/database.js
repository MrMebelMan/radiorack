// Frequency database queries: identifiers, reverse look-up, nearest lists.
import { distNm } from '../core/geo.js';
import { NEAREST_MAX } from './constants.js';

export class FreqDatabase {
  // data: { airports, stations, fir }
  constructor({ airports, stations, fir }) {
    this.airports = airports;
    this.stations = stations;
    this.fir = fir;
  }
  // FIR pseudo-identifier carrying all FSS/ACC/WX stations
  firEntry() {
    return { ...this.fir, nonApt: true, freqs: this.stations.map(st => ({ type: st.type, f: st.f, label: st.name })) };
  }
  allIdents() { return [...this.airports, this.firEntry()]; }
  findIdent(id) { return this.allIdents().find(a => a.id === id); }
  findAll(id) { return this.allIdents().filter(a => a.id === id); }
  stationName(f) { return this.stations.find(st => st.f === f)?.name || ''; }
  // frequency types for the look-up; "+" when the facility has more of that type
  typeEntries(a) {
    const counts = {};
    a.freqs.forEach(fr => { counts[fr.type] = (counts[fr.type] || 0) + 1; });
    return a.freqs.map(fr => ({ ...fr, label: fr.type + (counts[fr.type] > 1 ? '+' : '') }));
  }
  // nearest station using f: "IDENT TYPE" ("*" = several types), or null
  reverse(f, pos, maxNm = 200) {
    let best = null;
    for (const a of this.airports) {
      const matches = a.freqs.filter(x => x.f === f);
      if (!matches.length) continue;
      const d = distNm(pos, a);
      if (d > maxNm) continue;
      const types = [...new Set(matches.map(m => m.type))];
      if (!best || d < best.d) best = { d, text: `${a.id} ${types[0]}${types.length > 1 ? '*' : ''}` };
    }
    for (const st of this.stations) {
      if (st.f !== f) continue;
      const d = distNm(pos, st);
      if (d > maxNm) continue;
      if (!best || d < best.d) best = { d, text: `${st.id} ${st.type}` };
    }
    return best ? best.text : null;
  }
  nearestAirports(pos) {
    return this.airports.map(a => ({ a, d: distNm(pos, a) })).sort((x, y) => x.d - y.d).slice(0, NEAREST_MAX).map(o => o.a);
  }
  // cat: 'acc' | 'fss' | 'wx' -> [{ f, name, d }] sorted by distance
  nearestStations(cat, pos, usable = () => true) {
    let st = this.stations.filter(x => x.cat === cat).map(x => ({ f: x.f, d: distNm(pos, x), name: x.name }));
    if (cat === 'wx') {
      // ATIS / AWOS of airports count as weather frequencies too
      for (const a of this.airports) for (const fr of a.freqs) {
        if (fr.type === 'ATIS' || fr.type === 'AWS') st.push({ f: fr.f, d: distNm(pos, a), name: `${a.id} ${fr.type}` });
      }
    }
    return st.filter(o => usable(o.f)).sort((p, q) => p.d - q.d).slice(0, NEAREST_MAX);
  }
}
