// GNC 255 Pilot's Guide (190-01182-01 Rev E) procedures, replayed literally:
// one input per numbered step, starting from a radio that has been used elsewhere first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GNC255 } from '../devices/gnc255/device.js';
import { NavDatabase } from '../nav/nav-database.js';

function radio() {
  let t = 0;
  const r = new GNC255({ now: () => t });
  r.advance = ms => { t += ms; r.tick(); };
  r.input('vol', 1); r.advance(3000);
  // use it elsewhere first: SYS > DSPL BRT, back, TMR, exit; NAV mode and back; OBS
  ['FUNC', 'outer', 'outer', 'outer', 'inner', 'inner', 'inner', 'ENT', 'CLR', 'outer', 'FUNC', 'CN', 'OBS', 'OBS', 'CN'].forEach(e => step(r, e));
  return r;
}
function step(r, e) { Array.isArray(e) ? r.input(...e) : (e === 'inner' || e === 'outer') ? r.input(e, 1) : r.input(e); }
const steps = (r, ...es) => es.forEach(e => step(r, e));
const clicks = (r, knob, n) => { for (let i = 0; i < Math.abs(n); i++) r.input(knob, Math.sign(n)); };
const func = r => { step(r, 'FUNC'); if (r.page.id !== 'menu') step(r, 'FUNC'); };
function screen(r) {
  const v = r.view();
  const segs = a => (a || []).map(x => (x.stack ? x.stack.join('/') : x.t ?? '')).join('');
  if (v.message !== undefined) return `${v.message} | ${segs(v.bottomLeft)}`;
  const right = v.right.type === 'menu' ? v.right.lines.map(segs).join(' / ')
    : v.right.type === 'page' ? `${v.right.title} | ${v.right.rows.map(segs).join(' | ')}`
      : `${v.right.ann ?? ''} ${v.right.label} ${segs(v.right.big)}`;
  return `${v.ann} ACT ${v.act} | ${right} | ${segs(v.bottomFull) || `${segs(v.bottomLeft)} ${segs(v.bottomRight)}`}`;
}
const has = (r, ...texts) => { const s = screen(r); for (const t of texts) assert.ok(s.includes(t), `"${t}" not on screen: ${s}`); };

test('2.1.1 selecting a COM frequency (C/N if necessary)', () => {
  const r = radio();
  step(r, 'CN');                  // (now in NAV) 1. Press C/N, if necessary, to reach COM.
  step(r, 'CN');
  has(r, 'COM STB');
  r.s.stb = 120000;
  steps(r, 'outer', 'inner');     // 2./3. outer = MHz, inner = kHz
  assert.equal(r.s.stb, 121005);
  steps(r, 'flipDown', 'flipUp'); // 6. FLIP/FLOP
  assert.equal(r.s.act, 121005);
});

test('2.1.2 monitoring is not canceled by switching to NAV mode', () => {
  const r = radio();
  step(r, 'MON');
  steps(r, 'CN', 'CN');
  has(r, 'COM MN');
});

test('2.1.3 saving a COM channel / 2.1.4 database look-up', () => {
  const r = radio();
  r.s.user = r.s.user.slice(0, 4);
  step(r, 'ENT');                 // 1. Press ENT.
  has(r, 'SAVE USER FREQ', 'ENT=ACCEPT  CLR=UNDO');
  steps(r, 'inner', 'ENT', 'outer', 'inner', 'ENT');
  assert.equal(r.s.user.length, 5);
  step(r, 'push');                // 2.1.4 1. Press the inner knob from the COM display.
  has(r, 'ENTER IDENTIFIER');
  clicks(r, 'inner', 12); step(r, 'ENT');
  has(r, 'COM DATABASE');
  step(r, 'ENT');
  assert.equal(r.page.id, 'com');
});

test('2.2.1 selecting a NAV frequency', () => {
  const r = radio();
  step(r, 'CN');                  // 1. Press C/N to reach NAV. The NAV annunciator shows.
  has(r, 'NAV STB', 'ACT 112.60');
  step(r, 'outer');               // 2. outer = MHz
  step(r, 'inner');               // 3. inner = kHz
  assert.equal(r.s.nav.stb, 113300);
  steps(r, 'flipDown', 'flipUp'); // 4. FLIP/FLOP
  assert.equal(r.s.nav.act, 113300);
});

test('2.2.2 saving a NAV channel', () => {
  const r = radio();
  r.s.nav.user = [];
  step(r, 'CN');
  step(r, 'ENT');                 // 1. Press ENT.
  has(r, 'SAVE USER FREQ', 'ENT=DONE  CLR=UNDO');
  clicks(r, 'inner', 14);         // 2. inner = characters (N)
  step(r, 'outer');               // 3. outer = cursor
  clicks(r, 'inner', 5);          //    (E)
  step(r, 'ENT');                 // 4. After selecting characters, press ENT.
  step(r, 'outer');               // 5. outer to the waypoint type
  step(r, 'inner');               // 6. inner = type (VOR)
  step(r, 'ENT');                 // 7. Press ENT to save.
  assert.deepEqual(r.s.nav.user[0], { freq: r.s.nav.stb, name: 'NE', type: 'VOR' });
});

test('2.2.3 listening to the NAV ID', () => {
  const r = radio();
  step(r, 'CN');                  // NAV display active
  step(r, 'navIdUp');             // press the NAV volume knob
  assert.equal(r.view().ann, 'ID');
  has(r, 'ID ACT');
  step(r, ['navVol', 1]);         // turn clockwise to increase volume
  assert.equal(r.s.nav.vol, 55);
});

test('2.3 OBS mode / 2.4 DST display', () => {
  const r = radio();
  step(r, 'OBS');                 // Press OBS to see the OBS setting and graphic CDI.
  has(r, 'NAV STB', 'OBS', 'CM/ACT');
  steps(r, 'outer', 'inner');     // knobs change the OBS value (no external CDI)
  assert.equal(r.s.nav.obs, 11);
  step(r, 'OBS');
  step(r, 'TF');                  // If DST data is not shown, press T/F.
  has(r, 'OKL', 'TO/BRG', 'N/M', 'K/T', 'NV/ACT');
});

test('3.2.1 recent COM frequencies (via FUNC)', () => {
  const r = radio();
  step(r, 'FUNC');                // 1. Press FUNC.
  step(r, 'inner');               // 2. Turn the inner knob to RECENT FREQS.
  has(r, 'RECENT FREQS');
  step(r, 'ENT');                 // 3. Press ENT.
  has(r, 'COM RECENT FREQS', '⇄=ACT  ENT=STB');
  step(r, 'inner');               // 4. select an entry
  const f = r.listItems('recent')[1].freq;
  step(r, 'ENT');                 // 5. ENT = standby
  assert.equal(r.s.stb, f);
});

test('3.2.2 COM user frequencies: view / delete / edit', () => {
  const r = radio();
  step(r, 'FUNC'); clicks(r, 'inner', 2); step(r, 'ENT');   // FUNC, inner to USER FREQS, ENT
  has(r, 'COM USER FREQS', 'WPT');
  const n = r.s.user.length;
  steps(r, 'inner', 'CLR');
  has(r, 'DELETE FREQUENCY? ENT TO CONFIRM');
  step(r, 'ENT');
  assert.equal(r.s.user.length, n - 1);
  step(r, 'push');
  has(r, 'EDIT USER FREQ');
  steps(r, 'inner', 'outer', 'inner', 'outer', 'inner', 'ENT', 'outer', 'inner', 'ENT');
  assert.equal(r.page.id, 'list');
});

test('3.2.3-3.2.7 COM database and nearest', () => {
  const r = radio();
  step(r, 'FUNC'); clicks(r, 'inner', 3); step(r, 'ENT');
  has(r, 'COM DATABASE', 'ENT=DONE');
  for (const [n, kind] of [[4, 'napt'], [5, 'nacc'], [6, 'nfss'], [7, 'nwx']]) {
    func(r); clicks(r, 'inner', n); step(r, 'ENT');
    assert.equal(r.page.kind, kind);
    step(r, 'CLR');               // CLR returns to the functions display
    assert.equal(r.page.id, 'menu');
  }
});

test('3.3.1 recent NAV frequencies', () => {
  const r = radio();
  step(r, 'FUNC');                // 1. Press FUNC.
  step(r, 'outer');               // 2. Turn the outer knob to NAV FREQUENCY LIST.
  has(r, 'NAV FREQUENCY LIST');
  step(r, 'inner');               // 3. Turn the inner knob to RECENT FREQS.
  step(r, 'ENT');                 // 4. Press ENT.
  has(r, 'NAV RECENT FREQS', '1 OF', 'ID ACT'.slice(3));
  step(r, 'inner');               // 5. Turn the inner knob to select an entry.
  const f = r.s.nav.recent[1];
  steps(r, 'flipDown', 'flipUp'); // 6. FLIP/FLOP sets active
  assert.equal(r.s.nav.act, f);
});

test('3.3.2 NAV user frequencies: view / delete / edit', () => {
  const r = radio();
  steps(r, 'FUNC', 'outer'); clicks(r, 'inner', 2); step(r, 'ENT');   // FUNC, NAV FREQUENCY LIST, USER FREQS, ENT
  has(r, 'WPT OKL', 'TYPE VOR');
  step(r, 'inner');
  const f = r.s.nav.user[1].freq;
  step(r, 'ENT');                 // ENT sets the displayed frequency as standby
  assert.equal(r.s.nav.stb, f);
  const n = r.s.nav.user.length;
  steps(r, 'CLR');                // 6. Press CLR to delete
  has(r, 'DELETE FREQUENCY? ENT TO CONFIRM');
  step(r, 'ENT');                 // 7. ENT to confirm
  assert.equal(r.s.nav.user.length, n - 1);
  step(r, 'push');                // 6. Press the inner knob to start editing
  has(r, 'EDIT USER FREQ', 'ENT=DONE  CLR=UNDO');
  steps(r, 'inner', 'outer', 'inner', 'outer', 'inner', 'ENT', 'outer', 'inner', 'ENT');
  assert.equal(r.page.id, 'list');
});

test('3.3.3 NAV database frequencies (and duplicate identifiers)', () => {
  const r = radio();
  steps(r, 'FUNC', 'outer'); clicks(r, 'inner', 3); step(r, 'ENT');   // 1.-4.
  has(r, 'NAV DATABASE', 'ENTER IDENTIFIER', 'ENT=DONE');
  clicks(r, 'inner', 22);         // 5. inner = character (V)
  step(r, 'outer');               // 6. outer = cursor
  while (r.page.ident[1] !== 'O') step(r, 'inner');
  step(r, 'outer');
  while (r.page.ident[2] !== 'Z') step(r, 'inner');
  has(r, 'VOZICE');
  step(r, 'ENT');                 // 7. Press ENT.
  has(r, 'NAV DATABASE', '116.950', 'WPT VOZ', 'TYPE VOR');
  step(r, 'ENT');                 // 9. ENT sets standby
  assert.equal(r.s.nav.stb, 116950);
  // duplicates (fixture: there are none in the Czech data)
  r.navDb = new NavDatabase([
    { id: 'PDT', name: 'PENDLETON', type: 'VOR', f: 114700, lat: 50, lon: 14.5, var: 5 },
    { id: 'PDT', name: 'PADERBORN', type: 'VOR', f: 113000, lat: 51.6, lon: 8.6, var: 3 },
  ]);
  func(r); step(r, 'outer'); clicks(r, 'inner', 3); step(r, 'ENT');   // NAV DATABASE again
  r.page.ident = ['P', 'D', 'T', '_'];
  step(r, 'ENT');                 // 1. When duplicate identifiers are found, press ENT.
  has(r, 'DUPLICATES FOUND');
  step(r, 'ENT');
  step(r, 'inner');               // 2. Turn the inner knob to select the identifier.
  has(r, 'PADERBORN', 'ENT=ACCEPT  CLR=UNDO');
  step(r, 'ENT');                 // 3. Press ENT.
  step(r, 'ENT');                 // 5. ENT sets standby
  assert.equal(r.s.nav.stb, 113000);
});

test('3.3.4 nearest VOR', () => {
  const r = radio();
  steps(r, 'FUNC', 'outer'); clicks(r, 'inner', 4); step(r, 'ENT');   // 1.-4.
  has(r, 'NEAREST VOR', 'OF');
  step(r, 'inner');               // 5. display the available VORs
  const f = r.listItems('nvor', r.device.navBand)[1].freq;
  step(r, 'ENT');                 // 6. ENT sets standby
  assert.equal(r.s.nav.stb, f);
  step(r, 'CLR');                 //    CLR exits
  assert.equal(r.page.id, 'menu');
});

test('3.4 ICS configuration via FUNC (no ICS key)', () => {
  const r = radio();
  steps(r, 'FUNC'); clicks(r, 'outer', 2);   // Press FUNC. Turn the outer knob to ICS CONFIGURATION.
  step(r, 'inner');               // Turn the inner knob to ADJUST INTRCOM.
  step(r, 'ENT');
  has(r, 'ADJUST INTRCOM', 'SQ: AUTO');
  steps(r, 'inner', 'outer', 'inner', 'outer', 'inner', 'ENT');
  assert.deepEqual(r.s.ics, { on: true, sq: 0, vol: 71, mute: true });
  func(r); clicks(r, 'outer', 2); clicks(r, 'inner', 2); step(r, 'ENT');
  has(r, 'AUX AUDIO');
});

test('3.5 system configuration (outer knob 3x to SYS)', () => {
  const r = radio();
  const open = n => { func(r); clicks(r, 'outer', 3); clicks(r, 'inner', n); step(r, 'ENT'); };
  open(1); has(r, 'CHNL SPACE');
  step(r, 'CLR');
  open(5); has(r, 'DATABASE INFO', 'CYCLE:');
  step(r, 'FUNC'); assert.equal(r.page.id, 'com');
  open(7); has(r, 'SOFTWARE VERSIONS');
});

test('3.6 timers (outer knob 4x to TMR, COUNT DOWN first)', () => {
  const r = radio();
  steps(r, 'FUNC'); clicks(r, 'outer', 4);   // outer to TMR CONFIGURATION
  step(r, 'inner');                           // inner to COUNT DOWN
  step(r, 'ENT');
  has(r, 'COUNT DOWN TIMER', '00:01:00');
  func(r); clicks(r, 'outer', 4); clicks(r, 'inner', 2); step(r, 'ENT');   // COUNT UP
  has(r, 'COUNT UP TIMER');
  step(r, 'ENT'); step(r, 'CN'); r.advance(3000);   // timer shown on the NAV display too
  has(r, 'NAV STB', '00:00:03');
});

test('5.1 messages', () => {
  const r = radio();
  r.triggerMessage('GS_FAIL');
  has(r, 'GLIDESLOPE RECEIVER HAS FAILED', 'ENT=ACCEPT');
  step(r, 'ENT');
  assert.equal(r.page.id, 'com');
});
