// GTX 328 configuration pages (Installation Manual 190-00420-04 Rev C §5.2, SW 5.00). Entered by holding FUNC
// while powering on. Every label and field position is copied from the page figures (200 x 33 dots).
// Field kinds: list (8/9 step through `opts`), num (0-9 enter digits), bar (8/9 slider), chars (address /
// Flight ID entry), show (display only).
import { textWidth } from '../../ui/lcd-gtx.js';

export const KEY_CHARS = ['0ABC', '1DEF', '2GHI', '3JKL', '4MNO', '5PQR', '6STU', '7VWX', '8YZ', '9'];
const HEX_CHARS = ['0ABC', '1DEF', '2', '3', '4', '5', '6', '7', '8', '9'];
export const keyChars = hex => (hex ? HEX_CHARS : KEY_CHARS);

export function defaultConfig() {
  return {
    // Audio and messages (§5.2.2; the figure shows OFF / OFF / DISABLE)
    voice: 'MALE', volume: 50, altMonAudio: 'MSG', cdAudio: 'MSG', pageChange: 'DISABLE',
    // display (§5.2.3-5.2.6): factory defaults
    dispMode: 'AUTO', dispLevel: 75,
    bkltMode: 'AUTO', bkltLvl: 500, bkltRsp: 4, bkltMin: 8, bkltSrc: 'PHOTO', bkltSlope: 50, bkltOffset: 50,
    keyRsp: 4, keyMin: 8, keySrc: 'PHOTO', keySlope: 50, keyOffset: 50,
    contrastMode: 'AUTO', contrast: 50,
    vfrKey: 'ENABLE',
    // I/O (§5.2.8, §5.2.9)
    in1Speed: 'LOW', in1Data: 'OFF', in2Speed: 'LOW', in2Data: 'OFF', in3Speed: 'LOW', in3Data: 'OFF', in4Data: 'OFF',
    out1: 'OFF', out2: 'OFF',
    rs1In: 'OFF', rs1Out: 'ICARUS', rs2In: 'OFF', rs2Out: 'OFF',
    // aircraft (§5.2.10-5.2.13)
    vsRate: 500, format: 'FLIGHT LVL', vfrId: '7000', altDev: 200,
    squat: 'NO', sense: 'LOW', delay: 24, autoFlt: 'NO',
    tempSensor: 'NO', tempUnits: 'C',
    addrType: 'HEX', addr: '49D3A5',
    fltMode: 'CONFIG ENTRY', fltId: 'OKABC',
    acType: '<15.5K', maxAs: '<=150',
  };
}

const T = (f, x, y, s) => ({ t: 'txt', f, x, y, s });
// the key letter rows below an entry field (Flight ID / address figures)
const LETTERS = [['ABC', 3], ['DEF', 24], ['GHI', 45], ['JKL', 66], ['MNO', 87], ['PQR', 108], ['STU', 129], ['VWX', 150], ['YZ', 171]];
const DIGIT_X = [9, 30, 51, 72, 93, 116, 137, 158, 176, 194];
export const keyRows = (hexOnly = false) => [
  ...LETTERS.slice(0, hexOnly ? 2 : 9).map(([s, x]) => T('s', x, 14, s)),
  ...DIGIT_X.map((x, i) => T('s', x, 24, String(i))),
];

// ARINC 429 input data (§5.2.8) and RS-232 input (§5.2.9) selections
const IN429 = ['OFF', 'GPS', 'ADC NO ALT', 'ADC W/ALT', 'AHRS', 'EF/AD NO ALT', 'EF/AD W/ALT'];
const RS_IN = ['OFF', 'GPS', 'ICARUS ALT', 'ICRS ALT 25', 'ADC NO ALT', 'ADC W/ALT', 'SHADIN ALT', 'SHDN ALT 25', 'FADC NO ALT', 'FADC W/ALT', 'REMOTE'];
const L = (key, x, y, opts, more = {}) => ({ key, kind: 'list', x, y, f: 'b', opts, ...more });
const N = (key, x, y, digits, more = {}) => ({ key, kind: 'num', x, y, f: 'b', digits, ...more });

export const PAGES = [
  { id: 'JUMP', labels: [T('s', 40, 13, 'JUMP'), T('s', 67, 13, 'TO')],
    fields: [L('jump', 88, 11, ['DIAGNOSTICS', 'DISPLAY/AUDIO', 'I/O CONFIG', 'ACFT CONFIG'], { local: true })] },
  { id: 'AUDIO1', labels: [T('b', 4, 3, 'AUDIO'), T('b', 85, 3, 'VOLUME'), T('b', 4, 20, 'VOICE'), T('b', 85, 20, 'MESSAGE')],
    fields: [{ key: 'volume', kind: 'bar', x: 130, y: 2, w: 68, h: 12, max: 100, step: 5 },
      L('voice', 39, 20, ['MALE', 'FEMALE']), N('message', 137, 20, 1, { local: true })] },
  { id: 'AUDIO2', labels: [T('s', 101, 0, 'AUDIO'), T('s', 137, 0, 'PAGE'), T('s', 164, 0, 'CHANGE'), T('s', 3, 12, 'ALTITUDE'), T('s', 54, 12, 'MONITOR'),
    T('s', 3, 25, 'COUNT'), T('s', 36, 25, 'DOWN'), T('s', 63, 25, 'TIMER')],
    fields: [L('altMonAudio', 103, 10, ['OFF', 'TONE', 'MSG']), L('pageChange', 147, 10, ['DISABLE', 'ENABLE']), L('cdAudio', 103, 23, ['OFF', 'TONE', 'MSG'])] },
  { id: 'DISPMODE', labels: [T('s', 15, 13, 'DISPLAY'), T('s', 60, 13, 'MODE'), T('s', 132, 13, 'LEVEL')],
    fields: [L('dispMode', 94, 11, ['AUTO', 'NGTV', 'PSTV']), N('dispLevel', 174, 11, 2)] },
  { id: 'BKLT', labels: [T('s', 2, 5, 'BKLT'), T('s', 61, 5, 'LVL'), T('s', 107, 5, 'RSP'), T('s', 128, 5, 'TIME'), T('s', 164, 5, 'MIN'),
    T('s', 2, 23, 'BKLT'), T('s', 29, 23, 'SRCE'), T('s', 97, 23, 'SLOPE'), T('s', 147, 23, 'OFFSET')],
    fields: [L('bkltMode', 28, 3, ['AUTO', 'MAN']), { key: 'bkltLvl', kind: 'step', x: 83, y: 3, f: 'b', digits: 3, step: 10, max: 999, manOnly: 'bkltMode', live: d => d.bkltLevelShown() },
      N('bkltRsp', 155, 3, 1, { max: 7, autoOnly: 'bkltMode' }), N('bkltMin', 185, 3, 2, { autoOnly: 'bkltMode' }),
      L('bkltSrc', 54, 21, ['PHOTO', '14V', '28V', '5V'], { autoOnly: 'bkltMode' }), N('bkltSlope', 130, 21, 2, { autoOnly: 'bkltMode' }), N('bkltOffset', 185, 21, 2, { autoOnly: 'bkltMode' })] },
  { id: 'KEY', labels: [T('s', 2, 5, 'KEY'), T('s', 61, 5, 'LVL'), T('s', 107, 5, 'RSP'), T('s', 128, 5, 'TIME'), T('s', 164, 5, 'MIN'),
    T('s', 2, 23, 'KEY'), T('s', 23, 23, 'SRCE'), T('s', 97, 23, 'SLOPE'), T('s', 147, 23, 'OFFSET')],
    fields: [{ key: 'bkltMode', kind: 'show', x: 24, y: 3, f: 'b' }, { key: 'keyLvl', kind: 'show', x: 83, y: 3, f: 'b', digits: 3, live: d => d.keyLevelShown() },
      N('keyRsp', 155, 3, 1, { max: 7, autoOnly: 'bkltMode' }), N('keyMin', 185, 3, 2, { autoOnly: 'bkltMode' }),
      L('keySrc', 54, 21, ['PHOTO', '14V', '28V', '5V'], { autoOnly: 'bkltMode' }), N('keySlope', 130, 21, 2, { autoOnly: 'bkltMode' }), N('keyOffset', 185, 21, 2, { autoOnly: 'bkltMode' })] },
  { id: 'CONTRAST', labels: [T('b', 5, 11, 'CONTRAST'), T('b', 65, 11, 'MODE')],
    fields: [L('contrastMode', 99, 11, ['AUTO', 'MAN']), { key: 'contrast', kind: 'bar', x: 130, y: 10, w: 68, h: 12, max: 99, step: 1, value: { x: 158, y: 23 } }] },
  { id: 'VFRKEY', labels: [T('s', 61, 14, 'VFR'), T('s', 82, 14, 'KEY')],
    fields: [L('vfrKey', 112, 13, ['ENABLE', 'DISABLE'])] },
  { id: 'IN1', labels: [T('s', 2, 1, '429'), T('s', 23, 1, 'INPUT'), T('s', 66, 1, 'SPEED'), T('s', 114, 1, 'DATA'),
    T('s', 2, 12, 'CHANNEL'), T('s', 47, 12, '1'), T('s', 2, 24, 'CHANNEL'), T('s', 47, 24, '2')],
    fields: [L('in1Speed', 66, 10, ['LOW', 'HIGH']), L('in1Data', 114, 10, IN429), L('in2Speed', 66, 22, ['LOW', 'HIGH']), L('in2Data', 114, 22, IN429)] },
  { id: 'IN2', labels: [T('s', 2, 1, '429'), T('s', 23, 1, 'INPUT'), T('s', 66, 1, 'SPEED'), T('s', 114, 1, 'DATA'),
    T('s', 2, 12, 'CHANNEL'), T('s', 47, 12, '3'), T('s', 2, 24, 'CHANNEL'), T('s', 47, 24, '4')],
    fields: [L('in3Speed', 66, 10, ['LOW', 'HIGH']), L('in3Data', 114, 10, IN429), L('in4Data', 114, 22, ['OFF', 'ADLP'])] },
  { id: 'OUT', labels: [T('s', 2, 1, '429'), T('s', 23, 1, 'OUTPUT'), T('s', 114, 1, 'DATA'), T('s', 2, 12, 'CHANNEL'), T('s', 47, 12, '1'), T('s', 2, 24, 'CHANNEL'), T('s', 47, 24, '2')],
    fields: [L('out1', 114, 11, ['OFF', 'ADLP', 'GARMIN']), L('out2', 114, 22, ['OFF', 'GARMIN'])] },
  { id: 'RS232', labels: [T('s', 2, 1, 'RS232'), T('s', 40, 1, 'INPUT'), T('s', 120, 1, 'OUTPUT'), T('s', 2, 12, 'CHNL'), T('s', 29, 12, '1'), T('s', 2, 24, 'CHNL'), T('s', 29, 24, '2')],
    fields: [L('rs1In', 40, 10, RS_IN), L('rs1Out', 120, 10, ['OFF', 'ICARUS', 'REMOTE']), L('rs2In', 40, 22, RS_IN), L('rs2Out', 120, 22, ['OFF', 'ICARUS', 'REMOTE'])] },
  { id: 'CONF1', labels: [T('s', 2, 5, 'VS'), T('s', 17, 5, 'RATE'), { t: 'unit', id: 'fm', x: 71, y: 3 }, T('s', 90, 5, 'FORMAT'),
    T('s', 2, 22, 'VFR'), T('s', 23, 22, 'ID'), T('s', 90, 22, 'ALT'), T('s', 111, 22, 'ALRT'), T('s', 138, 22, 'DEV'), { t: 'unit', id: 'ft', x: 185, y: 20 }],
    fields: [N('vsRate', 43, 4, 4, { min: 100 }), L('format', 135, 4, ['FLIGHT LVL', 'FEET', 'METERS']),
      N('vfrId', 43, 20, 4, { octal: true }), N('altDev', 164, 20, 3, { min: 200 })] },
  { id: 'CONF2', labels: [T('s', 2, 5, 'SQUAT'), T('s', 35, 5, 'SWITCH?'), T('s', 123, 5, 'SENSE'), T('s', 2, 23, 'DELAY'), T('s', 35, 23, 'TIME'),
    T('s', 88, 23, 'AUTO'), T('s', 115, 23, 'FLT'), T('s', 136, 23, 'TMR?')],
    fields: [L('squat', 88, 3, ['NO', 'YES']), L('sense', 162, 3, ['LOW', 'HIGH']), N('delay', 63, 21, 2), L('autoFlt', 168, 21, ['NO', 'YES'])] },
  { id: 'TEMP', labels: [T('s', 68, 6, 'TEMPERATURE'), T('s', 8, 21, 'SENSOR'), T('s', 47, 21, 'INSTALLED'), T('s', 146, 21, 'UNITS')],
    fields: [L('tempSensor', 110, 19, ['NO', 'YES']), { key: 'tempUnits', kind: 'list', unit: true, x: 179, y: 18, opts: ['C', 'F'] }] },
  { id: 'ADDR', labels: [T('b', 1, 2, 'ADDRESS')],
    fields: [L('addrType', 54, 2, ['US TAIL#', 'HEX']), { key: 'addr', kind: 'chars', x: 114, y: 2 }] },
  { id: 'FLTID', labels: [T('b', 1, 2, 'FLT'), T('b', 23, 2, 'ID')],
    fields: [L('fltMode', 36, 2, ['PWR-UP ENTRY', 'CONFIG ENTRY', 'SAME AS TAIL']), { key: 'fltId', kind: 'chars', x: 121, y: 2, only: c => c.fltMode === 'CONFIG ENTRY' }] },
  { id: 'ACTYPE', labels: [T('s', 2, 5, 'AC'), T('s', 17, 5, 'TYPE'), T('s', 106, 5, 'MAX'), T('s', 127, 5, 'A/S')],
    fields: [L('acType', 52, 3, ['UNKNOWN', '<15.5K', '>=15.5K', 'ROTOR'], { unitAfter: v => /K$/.test(v) && 'Lb' }),
      L('maxAs', 149, 3, ['UNKNOWN', '<=75', '<=150', '<=300', '>300'], { unitAfter: v => /\d$/.test(v) && 'kt' })] },
  { id: 'GRAY', diag: true, labels: [...'daaabbbccc'].map((c, i) => T('s', [36, 42, 49, 56, 64, 71, 78, 85, 92, 99][i], 1, c)),
    fields: [] },
  { id: 'EXTSW', diag: true, labels: [T('s', 40, 1, 'EXTERNAL'), T('s', 91, 1, 'SWITCH'), T('s', 130, 1, 'STATE'), T('s', 6, 21, 'IDENT'), T('s', 66, 21, 'STANDBY'), T('s', 146, 21, 'SQUAT')],
    fields: [] },
  { id: 'ANALOG', diag: true, labels: [T('s', 1, 5, '14/5V'), T('s', 34, 5, 'LTG'), T('s', 75, 5, 'PHOTO'), T('s', 130, 5, 'LCD'), T('s', 151, 5, 'TEMP'),
    T('s', 12, 23, '28V'), T('s', 33, 23, 'LTG'), T('s', 87, 23, 'OAT'), T('s', 130, 23, 'UNIT'), T('s', 157, 23, 'TMP')],
    fields: [] },
  { id: 'RSDISP', diag: true, labels: [T('s', 2, 5, 'RS232'), T('s', 40, 5, 'CH1'), T('s', 40, 22, 'CH2')], fields: [] },
  { id: 'RX12', diag: true, labels: [T('b', 2, 3, '429'), T('b', 6, 20, 'RX'), T('s', 24, 5, 'CH1'), T('s', 24, 22, 'CH2')], fields: [] },
  { id: 'RX34', diag: true, labels: [T('b', 2, 3, '429'), T('b', 6, 20, 'RX'), T('s', 24, 5, 'CH3'), T('s', 24, 22, 'CH4')], fields: [] },
];

// JUMP TO targets (§5.2.1)
export const JUMP_TARGET = { DIAGNOSTICS: 'GRAY', 'DISPLAY/AUDIO': 'AUDIO1', 'I/O CONFIG': 'IN1', 'ACFT CONFIG': 'CONF1' };

// FLT ID option words are spaced as in the figures
const FLT_WORDS = { 'PWR-UP ENTRY': [['PWR-UP', 0], ['ENTRY', 47]], 'CONFIG ENTRY': [['CONFIG', 0], ['ENTRY', 43]], 'SAME AS TAIL': [['SAME', 0], ['AS', 32], ['TAIL', 50]] };
const ADDR_WORDS = { 'US TAIL#': [['US', 0], ['TAIL#', 18]], HEX: [['HEX', 0]] };
function optionOps(field, v) {
  const words = field.key === 'fltMode' ? FLT_WORDS[v] : field.key === 'addrType' ? ADDR_WORDS[v] : null;
  if (words) return words.map(([s, dx]) => T(field.f, field.x + dx, field.y, s));
  return [T(field.f, field.x, field.y, String(v))];
}
const optWidth = (field, v) => {
  const ops = optionOps(field, v);
  return Math.max(...ops.map(o => o.x - field.x + textWidth(o.f, o.s)));
};

const fmtNum = (v, digits) => String(v).padStart(digits, '0').slice(-digits);

// draw a page: labels, field values, the highlighted field inverted
export function pageOps(page, c, dev, edit) {
  const ops = [...page.labels];
  page.fields.forEach((field, i) => {
    if (field.only && !field.only(c)) return;
    const hl = edit && edit.field === i;
    const v = hl && edit.draft !== undefined ? edit.draft : field.live ? field.live(dev) : field.local ? (field.opts ? field.opts[0] : 0) : c[field.key];
    if (field.kind === 'bar') {
      ops.push({ t: 'frame', x: field.x, y: field.y, w: field.w, h: field.h });
      // the fill starts at the left border (one column even at 0), as in the figures
      ops.push({ t: 'rect', x: field.x + 1, y: field.y + 1, w: 1 + Math.round((field.w - 3) * v / field.max), h: field.h - 2 });
      if (field.value) ops.push(T('s', field.value.x, field.value.y, fmtNum(v, 3)));
      if (hl) ops.push({ t: 'inv', x: field.x - 1, y: field.y - 1, w: field.w + 2, h: field.h + 2 });
      return;
    }
    if (field.unit) {
      ops.push({ t: 'unit', id: v === 'F' ? 'degF' : 'degC', x: field.x, y: field.y });
      if (hl) ops.push({ t: 'inv', x: field.x - 1, y: field.y - 1, w: 9, h: 14 });
      return;
    }
    if (field.kind === 'chars') return ops.push(...charsOps(field, c, dev, edit, hl));
    const s = field.digits ? fmtNum(v, field.digits) : String(v);
    ops.push(...optionOps(field, s));
    const u = field.unitAfter && field.unitAfter(s);
    if (u) ops.push({ t: 'unit', id: u, x: field.x + textWidth('b', s) + 2, y: field.y });
    if (hl) {
      const w = field.opts ? Math.max(...field.opts.map(o => optWidth(field, o))) : textWidth(field.f, s);
      ops.push({ t: 'inv', x: field.x - 1, y: field.y - 1, w: w + 2, h: 12 });
    }
  });
  return ops;
}

// address / Flight ID entry field: fixed 7-dot cells (figures), blanks as underscores, the cursor inverts one cell
export function entryOps(x, y, chars, pos, len) {
  const ops = [];
  for (let i = 0; i < len; i++) {
    const ch = chars[i] || (pos >= 0 ? '_' : ' ');   // blanks show as underscores only while the cursor is in the field (figures)
    const cx = x + i * 7;
    ops.push({ t: 'txt', f: 'e', x: ch === '_' ? cx + 2 : cx, y, s: ch });
    if (i === pos) ops.push({ t: 'inv', x: cx, y: y - 1, w: 8, h: 12 });
  }
  return ops;
}
function charsOps(field, c, dev, edit, hl) {
  if (field.key === 'addr') {
    const us = (hl && edit.addrType) ? edit.addrType === 'US TAIL#' : c.addrType === 'US TAIL#';
    const chars = hl ? edit.chars : [...(c.addr || '')];
    const ops = [];
    if (us) ops.push({ t: 'txt', f: 'e', x: 106, y: field.y, s: 'N' });
    ops.push(...entryOps(field.x, field.y, chars, hl ? edit.pos : -1, us ? 5 : 6));
    ops.push(...keyRows(!us));
    return ops;
  }
  const chars = hl ? edit.chars : [...(c.fltId || '')];
  return [...entryOps(field.x, field.y, chars, hl ? edit.pos : -1, 8), ...keyRows()];
}
// FLT ID page in PWR-UP ENTRY mode shows the key rows too (figure); SAME AS TAIL shows only the mode
export function extraOps(page, c) {
  if (page.id === 'FLTID' && c.fltMode === 'PWR-UP ENTRY') return keyRows();
  return [];
}
