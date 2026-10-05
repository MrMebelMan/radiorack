// Simulated frequency database for the Prague area / Czech Republic.
//
// Verified against the Czech AIP (aim.rlp.cz, AIRAC 01 OCT 2026) on 2026-10-05:
// eAIP AD 2.18 pages, VFR Manual, ENR 2.1 (FIS/ACC) and GEN 3.5 (VOLMET).
// Re-check each AIRAC cycle - FOR SIMULATOR PRACTICE ONLY, never for real flight.
// Frequencies are integers in kHz using 8.33 channel names (120.335 MHz -> 120335).
// "RADIO" (air/ground) stations are typed ATF; Radar/APP as APPR; Delivery as CLR.

const VFR = id => `https://aim.rlp.cz/vfrmanual/actual/${id}_text_cz.html`;
const EAIP = id => `https://aim.rlp.cz/eaip/html/eAIP/LK-AD-2.${id}-en-GB.html`;

export const AIRPORTS = [
  { id: 'LKLT', name: 'LETNANY', lat: 50.1314, lon: 14.5256, src: VFR('lklt'), freqs: [
    { type: 'ATF', f: 120335 },  // LETNANY RADIO
  ] },
  { id: 'LKKB', name: 'PRAHA KBELY', lat: 50.1214, lon: 14.5436, src: EAIP('LKKB'), freqs: [
    { type: 'TWR', f: 120880 },  // KBELY TOWER
    { type: 'TWR', f: 134730 },  // reserve
    { type: 'APPR', f: 124680 }, // KBELY RADAR (when on duty)
  ] },
  { id: 'LKMB', name: 'MLADA BOLESLAV', lat: 50.3983, lon: 14.8983, src: VFR('lkmb'), freqs: [
    { type: 'ATF', f: 123610 },  // BOLESLAV RADIO
  ] },
  { id: 'LKPR', name: 'PRAHA RUZYNE', lat: 50.1008, lon: 14.2600, src: EAIP('LKPR'), freqs: [
    { type: 'ATIS', f: 122160 },
    { type: 'CLR', f: 120060 },  // RUZYNE DELIVERY
    { type: 'GND', f: 121910 },  // RUZYNE GROUND
    { type: 'GND', f: 118110 },  // supplementary
    { type: 'TWR', f: 134560 },  // RUZYNE TOWER
    { type: 'DEP', f: 120530 },  // PRAHA RADAR
    { type: 'APPR', f: 127580 }, // PRAHA RADAR (arrivals)
    { type: 'APPR', f: 119010 }, // RUZYNE RADAR
    { type: 'APPR', f: 118310 }, // RUZYNE RADAR (VFR / CTR entry)
  ] },
  { id: 'LKVO', name: 'VODOCHODY', lat: 50.2167, lon: 14.3956, src: EAIP('LKVO'), freqs: [
    { type: 'TWR', f: 133080 },
    { type: 'APPR', f: 127480 },
  ] },
  { id: 'LKKL', name: 'KLADNO', lat: 50.1128, lon: 14.0897, src: VFR('lkkl'), freqs: [
    { type: 'ATF', f: 123480 },
  ] },
  { id: 'LKRO', name: 'ROUDNICE', lat: 50.4106, lon: 14.2261, src: VFR('lkro'), freqs: [
    { type: 'ATF', f: 122205 },
  ] },
  { id: 'LKBE', name: 'BENESOV', lat: 49.7408, lon: 14.6447, src: VFR('lkbe'), freqs: [
    { type: 'ATF', f: 118005 },
  ] },
  { id: 'LKPM', name: 'PRIBRAM', lat: 49.7200, lon: 14.1003, src: VFR('lkpm'), freqs: [
    { type: 'ATF', f: 118755 },
  ] },
  { id: 'LKHK', name: 'HRADEC KRALOVE', lat: 50.2533, lon: 15.8453, src: 'https://aim.rlp.cz/vfrmanual/actual/lkhk_text_en.html', freqs: [
    { type: 'ATF', f: 122005 },  // KRAL RADIO
  ] },
  { id: 'LKPD', name: 'PARDUBICE', lat: 50.0135, lon: 15.7386, src: EAIP('LKPD'), freqs: [
    { type: 'TWR', f: 120155 },
    { type: 'TWR', f: 120205 },  // reserve
    { type: 'APPR', f: 128365 }, // PARDUBICE RADAR
  ] },
  { id: 'LKKV', name: 'KARLOVY VARY', lat: 50.2031, lon: 12.9150, src: EAIP('LKKV'), freqs: [
    { type: 'TWR', f: 121230 },  // VARY TOWER
    { type: 'TWR', f: 119700 },  // reserve, state acft without 8.33
    { type: 'ATIS', f: 127640 },
    { type: 'APPR', f: 118650 }, // PRAHA RADAR
    { type: 'APPR', f: 124050 }, // PRAHA RADAR reserve
  ] },
  { id: 'LKTB', name: 'BRNO TURANY', lat: 49.1514, lon: 16.6939, src: EAIP('LKTB'), freqs: [
    { type: 'TWR', f: 119605 },
    { type: 'GND', f: 125430 },
    { type: 'ATIS', f: 131105 },
    { type: 'APPR', f: 127350 }, // PRAHA RADAR
    { type: 'APPR', f: 124050 }, // PRAHA RADAR reserve
  ] },
  { id: 'LKMT', name: 'OSTRAVA', lat: 49.6961, lon: 18.1108, src: EAIP('LKMT'), freqs: [
    { type: 'TWR', f: 120805 },
    { type: 'CLR', f: 128525 },  // MOSNOV DELIVERY
    { type: 'ATIS', f: 118055 },
    { type: 'APPR', f: 119375 }, // PRAHA RADAR
    { type: 'APPR', f: 124050 }, // PRAHA RADAR reserve
  ] },
];

// Non-airport stations. `id` is the short label shown on the COM page
// (reverse look-up); `name` is shown in the Nearest lists.
// Positions are rough sector centres, used only for "nearest" sorting.
export const STATIONS = [
  // PRAHA INFORMATION (FIS, below FL95) - ENR 2.1
  { cat: 'fss', id: 'PRAHA', type: 'FSS', name: 'PRAHA INFO W', f: 126100, lat: 49.90, lon: 13.30 },
  { cat: 'fss', id: 'PRAHA', type: 'FSS', name: 'PRAHA INFO E', f: 136175, lat: 50.00, lon: 15.30 },
  { cat: 'fss', id: 'PRAHA', type: 'FSS', name: 'PRAHA INFO MOR', f: 136275, lat: 49.40, lon: 17.20 },
  // PRAHA RADAR (APP / ACC sectors) - ENR 2.1
  { cat: 'acc', id: 'PRAHA', type: 'ACC', name: 'PRAHA APP', f: 120530, lat: 50.10, lon: 14.26 },
  { cat: 'acc', id: 'PRAHA', type: 'ACC', name: 'PRAHA RDR TB', f: 127350, lat: 49.15, lon: 16.69 },
  { cat: 'acc', id: 'PRAHA', type: 'ACC', name: 'PRAHA RDR KV', f: 118650, lat: 50.20, lon: 12.92 },
  { cat: 'acc', id: 'PRAHA', type: 'ACC', name: 'PRAHA RDR MT', f: 119375, lat: 49.70, lon: 18.11 },
  { cat: 'acc', id: 'PRAHA', type: 'ACC', name: 'PRAHA RDR WL', f: 120275, lat: 49.90, lon: 13.50 },
  { cat: 'acc', id: 'PRAHA', type: 'ACC', name: 'PRAHA RDR NL', f: 127825, lat: 50.50, lon: 15.00 },
  { cat: 'acc', id: 'PRAHA', type: 'ACC', name: 'PRAHA RDR SL', f: 127125, lat: 49.20, lon: 15.50 },
  // Weather - GEN 3.5
  { cat: 'wx', id: 'PRAHA', type: 'VOLM', name: 'PRAHA VOLMET', f: 125525, lat: 50.10, lon: 14.26 },
];

// Ident used in the DB look-up for the FIR stations (all FSS/ACC/WX).
export const FIR = { id: 'LKAA', name: 'PRAHA FIR', lat: 50.08, lon: 14.42 };

export const POSITIONS = [
  { id: 'LKLT', label: 'LKLT Letnany', lat: 50.1314, lon: 14.5256 },
  { id: 'LKKB', label: 'LKKB Kbely', lat: 50.1214, lon: 14.5436 },
  { id: 'LKMB', label: 'LKMB Mlada Boleslav', lat: 50.3983, lon: 14.8983 },
  { id: 'PRG', label: 'Over Prague city', lat: 50.0800, lon: 14.4200 },
  { id: 'LKPR', label: 'LKPR Ruzyne', lat: 50.1008, lon: 14.2600 },
  { id: 'BRNO', label: 'Near Brno', lat: 49.2000, lon: 16.6000 },
];

export const DB_INFO = { cycle: '2610', effective: '01-OCT-26', region: 'EUR' };
export const USB_DB_INFO = { cycle: '2611', effective: '29-OCT-26', region: 'EUR' };
