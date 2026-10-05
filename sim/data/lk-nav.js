// Czech radio-navigation aids for the NAV (VLOC) receiver.
//
// Verified against the Czech eAIP (aim.rlp.cz, AIRAC 01 OCT 2026) on 2026-10-05:
// ENR 4.1 (en-route VOR/DME, DME) and the AD 2.19 pages (ILS/LOC).
// Re-check each AIRAC cycle - FOR SIMULATOR PRACTICE ONLY, never for real flight.
// f = VHF frequency in kHz (115.40 MHz -> 115400; DME-only stations: paired VHF frequency).
// var = magnetic variation / VOR declination in degrees (east positive).
// course = localizer course (MAG); null where AD 2.19 publishes none.
// There are no duplicate identifiers among these stations.

const ENR = 'https://aim.rlp.cz/eaip/html/eAIP/LK-ENR-4.1-en-GB.html';
const AD = id => `https://aim.rlp.cz/eaip/html/eAIP/LK-AD-2.${id}-en-GB.html`;

export const NAVAIDS = [
  // VOR/DME, DVOR/DME (ENR 4.1.1)
  { id: 'BNO', name: 'BRNO', type: 'VOR', f: 114450, lat: 49.1501, lon: 16.6926, var: 5, src: ENR },
  { id: 'NER', name: 'NERATOVICE', type: 'VOR', f: 112250, lat: 50.3666, lon: 14.6214, var: 4, src: ENR },
  { id: 'OTA', name: 'OSTRAVA', type: 'VOR', f: 117450, lat: 49.6975, lon: 18.1091, var: 6, src: ENR },
  { id: 'OKL', name: 'PRAHA', type: 'VOR', f: 112600, lat: 50.0959, lon: 14.2656, var: 5, src: ENR },
  { id: 'VOZ', name: 'VOZICE', type: 'VOR', f: 116950, lat: 49.5323, lon: 14.8747, var: 5, src: ENR },
  // German station listed in ENR 4.1 ("See AIP Germany"); declination not given, MAG var 3E (2016)
  { id: 'HDO', name: 'HERMSDORF', type: 'VOR', f: 108650, lat: 50.9281, lon: 14.3688, var: 3, src: ENR },
  // DME only (paired VHF frequency)
  { id: 'OKF', name: 'DESNA', type: 'DME', f: 113150, lat: 48.9692, lon: 15.5456, var: 5, src: ENR },
  { id: 'OKX', name: 'FRYDLANT', type: 'DME', f: 114850, lat: 50.9027, lon: 15.0319, var: 5, src: ENR },
  { id: 'OKG', name: 'CHEB', type: 'DME', f: 115700, lat: 50.0651, lon: 12.4057, var: 5, src: ENR },
  { id: 'PSK', name: 'PISEK', type: 'DME', f: 117600, lat: 49.7850, lon: 14.0348, var: 5, src: ENR },
  { id: 'RVC', name: 'REVNICOV', type: 'DME', f: 114650, lat: 50.1870, lon: 13.7917, var: 5, src: ENR },
  { id: 'VLM', name: 'VLASIM', type: 'DME', f: 114300, lat: 49.7043, lon: 15.0667, var: 5, src: ENR },
  // ILS localizers (AD 2.19); position = LOC antenna
  { id: 'PH', name: 'LKPR RWY 06', type: 'ILS', f: 111150, lat: 50.1174, lon: 14.2782, var: 5, course: 60, src: AD('LKPR') },
  { id: 'PR', name: 'LKPR RWY 24', type: 'ILS', f: 109100, lat: 50.1003, lon: 14.2212, var: 5, course: 240, src: AD('LKPR') },
  { id: 'PG', name: 'LKPR RWY 30', type: 'ILS', f: 109500, lat: 50.1101, lon: 14.2410, var: 5, course: 302, src: AD('LKPR') },
  { id: 'PA', name: 'LKPR RWY 12', type: 'ILS', f: 109950, lat: 50.0889, lon: 14.2849, var: 5, course: 122, src: AD('LKPR') },
  { id: 'BO', name: 'LKTB RWY 27', type: 'ILS', f: 111500, lat: 49.1533, lon: 16.6708, var: 5, course: 272, src: AD('LKTB') },
  { id: 'OSV', name: 'LKMT RWY 22', type: 'ILS', f: 110950, lat: 49.6822, lon: 18.0881, var: 6, course: 220, src: AD('LKMT') },
  { id: 'KVY', name: 'LKKV RWY 29', type: 'ILS', f: 111550, lat: 50.2070, lon: 12.9005, var: 5, course: 288, src: AD('LKKV') },
  { id: 'PK', name: 'LKPD RWY 27', type: 'ILS', f: 109350, lat: 50.0141, lon: 15.7165, var: 5, course: 267, src: AD('LKPD') },
  { id: 'KD', name: 'LKKB RWY 24', type: 'ILS', f: 108350, lat: 50.1160, lon: 14.5277, var: 5, course: null, src: AD('LKKB') },
  { id: 'VO', name: 'LKVO RWY 28', type: 'ILS', f: 110750, lat: 50.2200, lon: 14.3758, var: 5, course: 280, src: AD('LKVO') },
  { id: 'CF', name: 'LKCV RWY 31', type: 'ILS', f: 111750, lat: 49.9496, lon: 15.3675, var: 5, course: 312, src: AD('LKCV') },
  { id: 'LA', name: 'LKNA RWY 30', type: 'ILS', f: 111350, lat: 49.1752, lon: 16.1076, var: 5, course: 304, src: AD('LKNA') },
];
