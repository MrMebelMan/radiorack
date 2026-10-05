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

// NDBs and locators (L) for the ADF, from the AD 2.19 tables (ENR 4.1 lists none).
// Verified against the Czech eAIP (AIRAC 01 OCT 2026) on 2026-10-05. f in kHz. The emission
// (ident tone) is not published.
export const NDBS = [
  { id: 'KD', name: 'KBELY', type: 'NDB', f: 300, lat: 50.1526, lon: 14.6366, src: AD('LKKB') },
  { id: 'K', name: 'KBELY', type: 'L', f: 438, lat: 50.1297, lon: 14.5682, src: AD('LKKB') },
  { id: 'PK', name: 'PARDUBICE', type: 'NDB', f: 432, lat: 50.0111, lon: 15.8130, src: AD('LKPD') },
  { id: 'P', name: 'PARDUBICE', type: 'L', f: 888, lat: 50.0125, lon: 15.7705, src: AD('LKPD') },
  { id: 'L', name: 'VRATA', type: 'L', f: 365, lat: 50.1958, lon: 12.9417, src: AD('LKKV') },
  { id: 'V', name: 'MASLOVICE', type: 'L', f: 416, lat: 50.2202, lon: 14.3748, src: AD('LKVO') },
  { id: 'CF', name: 'CASLAV', type: 'NDB', f: 345.5, lat: 49.9040, lon: 15.4328, src: AD('LKCV') },
  { id: 'C', name: 'CASLAV', type: 'L', f: 715, lat: 49.9248, lon: 15.4032, src: AD('LKCV') },
  { id: 'F', name: 'CASLAV', type: 'L', f: 715, lat: 49.9582, lon: 15.3553, src: AD('LKCV') },
  { id: 'LA', name: 'NAMEST', type: 'NDB', f: 514.5, lat: 49.1365, lon: 16.1796, src: AD('LKNA') },
  { id: 'L', name: 'NAMEST', type: 'L', f: 362, lat: 49.1505, lon: 16.1536, src: AD('LKNA') },
  { id: 'XU', name: 'NAMEST', type: 'NDB', f: 563, lat: 49.1973, lon: 16.0668, src: AD('LKNA') },
  { id: 'X', name: 'NAMEST', type: 'L', f: 362, lat: 49.1810, lon: 16.0968, src: AD('LKNA') },
  { id: 'KUN', name: 'KUNOVICE', type: 'NDB', f: 416, lat: 49.1139, lon: 17.5014, src: AD('LKKU') },
  { id: 'KNE', name: 'KUNOVICE', type: 'NDB', f: 434, lat: 49.0465, lon: 17.4522, src: AD('LKKU') },
];

// ILS approaches with 75 MHz marker beacons (AD 2.19 markers, AD 2.12 threshold). The marker
// positions are the published antenna coordinates; toThr is the published distance to the
// threshold in m (null where AD 2.19 gives none: computed from the coordinates).
export const APPROACHES = [
  { id: 'LKKB24', name: 'LKKB ILS RWY 24', ils: 'KD', gp: 3, rdh: 52.69, thr: { lat: 50.1255, lon: 14.5560 }, src: AD('LKKB'),
    markers: [{ type: 'OM', lat: 50.1525, lon: 14.6365, toThr: 6490 }, { type: 'MM', lat: 50.1297, lon: 14.5683, toThr: 989 }] },
  { id: 'LKPD27', name: 'LKPD ILS RWY 27', ils: 'PK', gp: 3, rdh: 50.85, thr: { lat: 50.0129, lon: 15.7560 }, src: AD('LKPD'),
    markers: [{ type: 'OM', lat: 50.0111, lon: 15.8129, toThr: null }, { type: 'MM', lat: 50.0125, lon: 15.7706, toThr: null }] },
];
