// GTX 330 configuration pages (Installation Manual 190-00207-02 Rev AE §5.2, SW 8). Same page engine and
// field kinds as the GTX 328 (gtx328/config.js); every label and field position is copied from the Rev AE
// figures (200 x 33 dots). Pages the two units share unchanged are taken from the GTX 328 table.
import { PAGES as GTX328_PAGES, T, L, keyRows } from '../gtx328/config.js';

export function defaultConfig() {
  return {
    // Audio and messages (§5.2.2, §5.2.3)
    voice: 'MALE', volume: 50, altMonAudio: 'MSG', cdAudio: 'MSG', pageChange: 'DISABLE', tisAudio: 'MSG',
    // display (§5.2.4-5.2.7): factory defaults
    dispMode: 'AUTO', dispLevel: 75,
    bkltMode: 'AUTO', bkltLvl: 500, bkltRsp: 4, bkltMin: 8, bkltSrc: 'PHOTO', bkltSlope: 50, bkltOffset: 50,
    keyRsp: 4, keyMin: 8, keySrc: 'PHOTO', keySlope: 50, keyOffset: 50,
    contrastMode: 'AUTO', contrast: 50,
    vfrKey: 'ENABLE',
    // I/O (§5.2.9, §5.2.10); RS-232 1 REMOTE: the GPS position source for ADS-B
    in1Speed: 'LOW', in1Data: 'OFF', in2Speed: 'LOW', in2Data: 'OFF', in3Speed: 'LOW', in3Data: 'OFF', in4Data: 'OFF',
    out1: 'OFF', out2: 'GARMIN W/TIS',
    rs1In: 'REMOTE', rs1Out: 'ICARUS ALT', rs2In: 'OFF', rs2Out: 'OFF',
    // aircraft (§5.2.11-5.2.18)
    vsRate: 500, format: 'FLIGHT LVL', vfrId: '7000', altDev: 200,
    squat: 'NO', sense: 'LOW', delay: 24, autoAlt: 'ON', autoFlt: 'MAN',
    tempSensor: 'YES', tempUnits: 'C',
    addrType: 'HEX', addr: '49D3A5',
    dfltMode: 'ENTRY', fltId: 'OKABC', pilotFlt: 'YES',
    gpsX: 'UNK', gpsY: 'UNK', gpsInt: '1E-3',
    acType: '<15.5K', maxAs: '<=150', stall: 'DEFAULT',
    acLen: 'LENGTH <= 15', acWid: 'WIDTH <= 11.5',
    adsbTx: 'PILOT SET', in1090: 'NO', uatIn: 'YES',
    ehs: 'ENABLE',
  };
}

// ARINC 429 input data (Table 5-11), outputs (Table 5-12), RS-232 (Tables 5-15, 5-16)
const IN429 = ['OFF', 'GPS/FMS', 'ADC NO ALT', 'ADC W/ALT', 'AHRS', 'EFIS NO ALT', 'EFIS W/ALT', 'FLIGHT CTRL', 'GRMN DISPLAY', 'GRMN TAS', 'GRMN 743A'];
const OUT429 = ['OFF', 'GARMIN', 'GARMIN W/TIS', 'GARMIN TAS'];
const RS_IN = ['OFF', 'GPS', 'ICARUS ALT', 'ICRS ALT 25', 'ADC NO ALT', 'ADC W/ALT', 'SHADIN ALT', 'SHDN ALT 25', 'FADC NO ALT', 'FADC W/ALT', 'REMOTE', 'GNS'];
const RS_OUT = ['OFF', 'ICARUS ALT', 'REMOTE', 'REMOTE + TIS', 'GNS'];
// GPS antenna offsets (Table 5-22): lateral 6 m right to 6 m left, longitudinal 2 to 60 m, both in 2 m steps
const GPS_X = ['UNK', '6R', '4R', '2R', '0', '2L', '4L', '6L'];
const GPS_Y = ['UNK', ...Array.from({ length: 30 }, (_, i) => String(2 + i * 2))];
// stall speed (Table 5-23): DEFAULT or >=30 to >=200 kt in 5 kt steps
const STALL = ['DEFAULT', ...Array.from({ length: 35 }, (_, i) => `>=${30 + i * 5}`)];
// aircraft size (§5.2.16)
const LEN = [...[15, 25, 35, 45, 55, 65, 75, 85].map(m => `LENGTH <= ${m}`), 'LENGTH > 85'];
const WID = [...['11.5', '23.0', '28.5', '33.0', '34.0', '38.0', '39.5', '45.0', '52.0', '59.5', '67.0', '72.5', '80.0'].map(m => `WIDTH <= ${m}`), 'WIDTH > 80.0'];
// the three words sit in fixed columns (figure)
const sizeWords = (opts, cmpX, numX) => Object.fromEntries(opts.map(o => { const [w, c, n] = o.split(' '); return [o, [[w, 0], [c, cmpX], [n, numX]]]; }));

const shared = id => GTX328_PAGES.find(p => p.id === id);

export const PAGES = [
  shared('JUMP'),
  shared('AUDIO1'),
  shared('AUDIO2'),
  { id: 'TRAFFIC', labels: [T('s', 41, 13, 'TRAFFIC'), T('s', 86, 13, 'MESSAGES')],
    fields: [L('tisAudio', 141, 11, ['TONE', 'MSG'])] },
  shared('DISPMODE'),
  shared('BKLT'),
  shared('KEY'),
  shared('CONTRAST'),
  { id: 'VFRKEY', labels: [T('s', 60, 13, 'VFR'), T('s', 81, 13, 'KEY')], fields: [L('vfrKey', 110, 11, ['ENABLE', 'DISABLE'])] },
  { ...shared('IN1'), fields: [L('in1Speed', 66, 10, ['LOW', 'HIGH']), L('in1Data', 114, 10, IN429), L('in2Speed', 66, 22, ['LOW', 'HIGH']), L('in2Data', 114, 22, IN429)] },
  { ...shared('IN2'), fields: [L('in3Speed', 66, 10, ['LOW', 'HIGH']), L('in3Data', 114, 10, IN429), L('in4Data', 114, 22, IN429)] },
  { ...shared('OUT'), fields: [L('out1', 114, 10, OUT429), L('out2', 114, 22, OUT429)] },
  { id: 'RS232', labels: [T('s', 2, 1, 'RS-232'), T('s', 40, 1, 'INPUT'), T('s', 120, 1, 'OUTPUT'), T('s', 2, 12, 'CHNL'), T('s', 29, 12, '1'), T('s', 2, 24, 'CHNL'), T('s', 29, 24, '2')],
    fields: [L('rs1In', 40, 10, RS_IN), L('rs1Out', 120, 10, RS_OUT), L('rs2In', 40, 22, RS_IN), L('rs2Out', 120, 22, RS_OUT)] },
  shared('CONF1'),
  { id: 'CONF2', labels: [T('s', 2, 5, 'SQUAT'), T('s', 35, 5, 'SWITCH?'), T('s', 123, 5, 'SENSE'), T('s', 2, 23, 'AUTO'), T('s', 29, 23, 'ALT?'),
    T('s', 84, 23, 'AUTO'), T('s', 111, 23, 'FLT'), T('s', 132, 23, 'TMR?')],
    fields: [L('squat', 88, 3, ['NO', 'YES']), L('sense', 162, 3, ['LOW', 'HIGH']), L('autoAlt', 57, 21, ['OFF', 'ON']), L('autoFlt', 160, 21, ['MAN', 'CLEAR', 'ACCUM'])] },
  shared('TEMP'),
  shared('ADDR'),
  { id: 'DFLTID', labels: [T('s', 1, 6, 'DEFAULT'), T('s', 46, 6, 'FLT'), T('s', 67, 6, 'ID')],
    fields: [L('dfltMode', 83, 4, ['US TAIL', 'ENTRY'], { words: { 'US TAIL': [['US', 0], ['TAIL', 18]] } }),
      { key: 'fltId', kind: 'chars', x: 138, y: 4, only: c => c.dfltMode === 'ENTRY' }] },
  { id: 'FLTCFG', labels: [T('s', 13, 13, 'ALLOW'), T('s', 46, 13, 'PILOT'), T('s', 79, 13, 'TO'), T('s', 94, 13, 'EDIT'), T('s', 121, 13, 'FLT'), T('s', 142, 13, 'ID')],
    fields: [L('pilotFlt', 165, 11, ['NO', 'YES'])] },
  { id: 'GPS', labels: [T('s', 4, 5, 'GPS'), T('s', 25, 5, 'X'), T('s', 34, 5, 'OFST'), T('s', 108, 5, 'GPS'), T('s', 129, 5, 'Y'), T('s', 138, 5, 'OFST'),
    T('s', 46, 23, 'GPS'), T('s', 67, 23, 'INTEGRITY')],
    fields: [L('gpsX', 66, 3, GPS_X), L('gpsY', 170, 3, GPS_Y), L('gpsInt', 131, 21, ['UNK', '1E-3', '1E-5', '1E-7'])] },
  { id: 'ACTYPE', labels: [T('s', 2, 5, 'AC'), T('s', 17, 5, 'TYPE'), T('s', 106, 5, 'MAX'), T('s', 127, 5, 'A/S'), T('s', 2, 22, 'STALL'), T('s', 35, 22, 'SPEED')],
    fields: [L('acType', 52, 3, ['UNKNOWN', '<15.5K', '>=15.5K', 'ROTOR'], { unitAfter: v => /K$/.test(v) && 'Lb' }),
      L('maxAs', 149, 3, ['UNKNOWN', '<=75', '<=150', '<=300', '>300'], { unitAfter: v => /\d$/.test(v) && 'kt' }),
      L('stall', 70, 20, STALL, { unitAfter: v => /\d$/.test(v) && 'kt' })] },
  { id: 'ACSIZE', labels: [T('s', 2, 5, 'AC'), T('s', 17, 5, 'LENGTH'), T('s', 56, 5, 'TYPE'), T('s', 2, 23, 'AC'), T('s', 17, 23, 'WIDTH'), T('s', 50, 23, 'TYPE')],
    fields: [L('acLen', 88, 3, LEN, { words: sizeWords(LEN, 46, 59), unitAfter: () => 'mt', unitOff: [-1, -1] }),
      L('acWid', 86, 21, WID, { words: sizeWords(WID, 41, 54), unitAfter: () => 'mt', unitOff: [-1, -1] })] },
  { id: 'ADSB', labels: [T('s', 50, 5, 'ADS-B'), T('s', 83, 5, 'TX'), T('s', 15, 23, '1090'), T('s', 42, 23, 'IN'), T('s', 128, 23, 'UAT'), T('s', 149, 23, 'IN')],
    fields: [L('adsbTx', 108, 3, ['DISABLE', 'ENABLE', 'PILOT SET']), L('in1090', 64, 21, ['NO', 'YES']), L('uatIn', 170, 21, ['NO', 'YES'])] },
  { id: 'EHS', labels: [T('s', 55, 13, 'EHS')], fields: [L('ehs', 108, 11, ['DISABLE', 'ENABLE'])] },
  shared('GRAY'),
  shared('EXTSW'),
  shared('ANALOG'),
  shared('RSDISP'),
  shared('RX12'),
  shared('RX34'),
];

// JUMP TO targets (§5.2.1, Table 5-1)
export const JUMP_TARGET = { DIAGNOSTICS: 'GRAY', 'DISPLAY/AUDIO': 'AUDIO1', 'I/O CONFIG': 'IN1', 'ACFT CONFIG': 'CONF1' };

// DEFAULT FLT ID page: ENTRY shows the key rows (figure); US TAIL shows the registration
export function extraOps(page, c) {
  if (page.id !== 'DFLTID') return [];
  if (c.dfltMode === 'ENTRY') return keyRows();
  return c.addrType === 'US TAIL#' ? [T('b', 138, 4, `N${c.addr}`)] : [];
}
