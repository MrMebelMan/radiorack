// GTR 225 Pilot's Guide (190-01182-00 Rev D) procedures, replayed literally:
// one input per numbered step, starting from a radio that has been used elsewhere first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GTR225 } from '../devices/gtr225/device.js';

function radio() {
  let t = 0;
  const r = new GTR225({ now: () => t });
  r.advance = ms => { t += ms; r.tick(); };
  r.input('vol', 1); r.advance(3000);                 // power on
  // use it elsewhere first: SYS > DSPL BRT, back, TMR, exit; MEM; ICS
  ['FUNC', 'outer', 'outer', 'inner', 'inner', 'inner', 'ENT', 'CLR', 'outer', 'FUNC', 'MEM', 'MEM', 'COM', 'ICS', 'COM'].forEach(e => step(r, e));
  return r;
}
// one step: 'inner' / 'outer' = one click clockwise; ['inner', -1] = one click counter-clockwise
function step(r, e) { Array.isArray(e) ? r.input(...e) : (e === 'inner' || e === 'outer') ? r.input(e, 1) : r.input(e); }
const steps = (r, ...es) => es.forEach(e => step(r, e));
const clicks = (r, knob, n) => { for (let i = 0; i < Math.abs(n); i++) r.input(knob, Math.sign(n)); };
// everything visible on the display as one string
function screen(r) {
  const v = r.view();
  const segs = a => (a || []).map(x => x.t ?? '').join('');
  if (v.message !== undefined) return `${v.message} | ${segs(v.bottomLeft)}`;
  const right = v.right.type === 'menu' ? v.right.lines.map(segs).join(' / ')
    : v.right.type === 'page' ? `${v.right.title} | ${v.right.rows.map(segs).join(' | ')}`
      : `${v.right.ann ?? ''} ${v.right.label} ${segs(v.right.big)}`;
  return `${v.ann} ACT ${v.act} | ${right} | ${segs(v.bottomFull) || `${segs(v.bottomLeft)} ${segs(v.bottomRight)}`}`;
}
const has = (r, ...texts) => { const s = screen(r); for (const t of texts) assert.ok(s.includes(t), `"${t}" not on screen: ${s}`); };

test('2.1 selecting a COM frequency', () => {
  const r = radio();
  r.s.act = 118000; r.s.stb = 120000;
  step(r, 'COM');                 // 1. Press COM, if necessary. The COM annunciator will show.
  has(r, 'COM STB');
  step(r, 'outer');               // 2. Turn the outer knob: MHz
  step(r, 'inner');               // 3. Turn the inner knob: kHz (8.33 steps)
  assert.equal(r.s.stb, 121005);
  steps(r, 'flipDown', 'flipUp'); // 6. Press and release FLIP/FLOP
  assert.equal(r.s.act, 121005);
});

test('2.2 monitoring the standby channel', () => {
  const r = radio();
  r.s.gps = false;
  step(r, 'MON');                 // Press MON: "MN" replaces "STB"
  has(r, 'COM MN', 'COM ACTIVE', 'COM STANDBY');
  step(r, 'MON');                 // turned off by pressing MON again
  has(r, 'COM STB');
});

test('2.3 saving a COM channel', () => {
  const r = radio();
  r.s.user = r.s.user.slice(0, 4);
  step(r, 'ENT');                 // 1. Press ENT.
  has(r, 'SAVE USER FREQ', 'OF 15', 'ENT=ACCEPT  CLR=UNDO');
  clicks(r, 'inner', 11);         // 2. Turn the inner knob to select characters (K)
  step(r, 'outer');               // 3. Turn the outer knob to move the cursor.
  clicks(r, 'inner', 19);         //    (S)
  step(r, 'ENT');                 // 4. After selecting characters, press ENT.
  step(r, 'outer');               // 5. Turn the outer knob to select the waypoint type.
  clicks(r, 'inner', 1);          // 6. Turn the inner knob to select the type (TWR).
  has(r, 'TYPE TWR');
  step(r, 'ENT');                 // 7. Press ENT to save.
  assert.deepEqual(r.s.user[4], { freq: r.s.stb, name: 'KS', type: 'TWR' });
  assert.equal(r.page.id, 'com');
});

test('2.4 COM database look-up', () => {
  const r = radio();
  step(r, 'push');                // 1. Press the inner knob from the COM display.
  has(r, 'COM ACTIVE', 'ENTER IDENTIFIER');
  clicks(r, 'inner', 12);         // 2. inner = characters (L), outer = cursor
  step(r, 'outer'); step(r, 'outer');
  while (r.page.ident[2] !== 'P') step(r, 'inner');
  step(r, 'outer');
  while (r.page.ident[3] !== 'R') step(r, 'inner');
  has(r, 'LKPR', 'PRAHA RUZYNE');
  step(r, 'ENT');                 // 3. After selecting characters, press ENT.
  has(r, 'COM DATABASE', 'WPT LKPR', 'TYPE ATIS', '⇄=ACT  ENT=STB');
  while (r.page.entries[r.page.idx].type !== 'TWR') step(r, 'inner');   // 4. inner = types
  step(r, 'ENT');                 // 5. Press ENT to copy the frequency into standby.
  assert.equal(r.s.stb, 134560);
  assert.equal(r.page.id, 'com');
  steps(r, 'flipDown', 'flipUp'); // 7. FLIP/FLOP swaps active and standby.
  assert.equal(r.s.act, 134560);
});

test('2.5 emergency channel / 2.6 stuck mic / 2.8 remote recall', () => {
  const r = radio();
  const old = r.s.act;
  step(r, 'flipDown'); r.advance(2100);   // press and hold FLIP/FLOP about two seconds
  has(r, 'HOLD FOR EMERGENCY COM FREQUENCY');
  step(r, 'flipUp');
  assert.equal(r.s.act, 121500); assert.equal(r.s.stb, old);
  step(r, 'pttDown'); r.advance(35500);   // keyed longer than 35 s -> receive mode
  assert.ok(!r.transmitting);
  step(r, 'ENT');                          // acknowledge REMOTE KEY STUCK
  has(r, 'STUCK MIC');
  step(r, 'pttUp');
  const presets = r.s.user.map(u => u.freq);
  const seen = presets.map(() => { step(r, 'recall'); return r.s.stb; });
  assert.deepEqual(seen, presets);
  step(r, 'recall');                       // wraps to the top
  assert.equal(r.s.stb, presets[0]);
});

test('3.2.1 recent COM frequencies', () => {
  const r = radio();
  step(r, 'MEM');                 // 1. Press MEM.
  has(r, 'COM RECENT FREQS', '1 OF', '⇄=ACT  ENT=STB');
  step(r, 'inner');               // 2. Turn the inner knob to select an entry.
  const f = r.listItems('recent')[1].freq;
  step(r, 'ENT');                 // 3. ENT sets standby
  assert.equal(r.s.stb, f);
  steps(r, 'flipDown', 'flipUp'); //    FLIP/FLOP sets active
  assert.equal(r.s.act, f);
});

test('3.2.2 viewing / deleting / editing a COM user frequency', () => {
  const r = radio();
  step(r, 'FUNC');                // 1. Press FUNC.
  step(r, 'inner'); step(r, 'inner');   // 2. Turn the inner knob to USER FREQS.
  has(r, '[COM]'.slice(1, 4), 'USER FREQS');
  step(r, 'ENT');                 // 3. Press ENT.
  has(r, 'COM USER FREQS', 'WPT', 'TYPE');
  step(r, 'inner');               // 4. Turn the inner knob to cycle through user frequencies.
  const u = r.s.user[1];
  step(r, 'ENT');                 // 5. ENT sets standby
  assert.equal(r.s.stb, u.freq);
  // deleting
  const n = r.s.user.length;
  step(r, 'CLR');                 // 5. Press CLR to delete the selected user frequency.
  has(r, 'DELETE FREQUENCY? ENT TO CONFIRM');
  step(r, 'ENT');                 // 6. Press ENT to confirm.
  assert.equal(r.s.user.length, n - 1);
  // editing
  step(r, 'push');                // 5. Press the inner knob to start editing.
  has(r, 'EDIT USER FREQ');
  const f0 = r.s.user[1].freq;
  step(r, 'inner');               // 6. Turn the inner knob to select the MHz values.
  step(r, 'outer');               // 7. Turn the outer knob to select the kHz field.
  step(r, 'inner');               // 8. Turn the inner knob to select the kHz values.
  step(r, 'outer');               // 9. Turn the outer knob to select the WPT field.
  step(r, 'inner');               // 10. inner = characters
  step(r, 'ENT');                 // 11. Press ENT.
  steps(r, 'outer');              // 12. Turn the outer knob to select the TYPE field.
  step(r, 'inner');               // 13. Turn the inner knob to select the waypoint type.
  step(r, 'ENT');                 // 14. Press ENT to accept changes.
  assert.notEqual(r.s.user[1].freq, f0);
  assert.equal(r.page.id, 'list');
});

test('3.2.3 COM database frequencies (FUNC)', () => {
  const r = radio();
  step(r, 'FUNC');                          // 1. Press FUNC.
  clicks(r, 'inner', 3);                    // 2. Turn the inner knob to DATABASE.
  has(r, 'DATABASE');
  step(r, 'ENT');                           // 3. Press ENT.
  has(r, 'COM DATABASE', 'ENT=DONE');
  clicks(r, 'inner', 12);                   // 4./5. characters / cursor: L -> LKAA
  step(r, 'ENT');                           // 6. Press ENT.
  step(r, 'inner');                         // 7. turn the inner knob to select the type
  const f = r.page.entries[r.page.idx].f;
  step(r, 'ENT');                           // 8. ENT sets standby
  assert.equal(r.s.stb, f);
});

test('3.2.4-3.2.7 nearest APT / ACC / FSS / WX', () => {
  const r = radio();
  const kinds = [[4, 'NEAREST AIRPORT', 'napt'], [5, 'NEAREST ACC', 'nacc'], [6, 'NEAREST FSS', 'nfss'], [7, 'NEAREST WEATHER', 'nwx']];
  for (const [n, title, kind] of kinds) {
    step(r, 'FUNC'); if (r.page.id !== 'menu') step(r, 'FUNC');   // 1. Press FUNC.
    clicks(r, 'inner', n);                  // 2. Turn the inner knob to NEAREST xxx.
    step(r, 'ENT');                         // 3. Press ENT.
    assert.equal(r.page.kind, kind);
    has(r, title, 'OF');
    step(r, 'inner');                       // 4. scroll through the list
    step(r, 'CLR');                         // 5. CLR returns to the functions display.
    assert.equal(r.page.id, 'menu');
    step(r, 'COM');
  }
});

test('3.3.1 adjust intercom (ICS key)', () => {
  const r = radio();
  step(r, 'ICS');                 // 1. Press ICS.
  has(r, 'ADJUST INTRCOM', 'SQ: AUTO', 'MUTE ON RX', 'ENT=DONE  CLR=UNDO');
  step(r, 'inner');               // 2. inner = ICS squelch
  step(r, 'outer');               // 3. outer to VOL
  step(r, 'inner');               // 4. inner = volume
  step(r, 'outer');               // 5. outer to MUTE ON RX
  step(r, 'inner');               // 6. inner = ON
  step(r, 'ENT');                 // 7. Press ENT to save changes.
  assert.deepEqual(r.s.ics, { on: true, sq: 0, vol: 71, mute: true });
});

test('3.3.2-3.3.4 AUX audio, intercom on/off, speaker (FUNC)', () => {
  const r = radio();
  steps(r, 'FUNC', 'outer');      // Press FUNC. Turn the outer knob to ICS CONFIGURATION.
  clicks(r, 'inner', 2);          // Turn the inner knob to AUX AUDIO.
  step(r, 'ENT');
  has(r, 'AUX AUDIO', 'AUX: OFF', 'VOL: 50');
  steps(r, 'inner', 'outer', 'inner', 'ENT');   // AUX ON, VOL 51, save
  assert.equal(r.s.aux.on, true); assert.equal(r.s.aux.vol, 51);
  steps(r, 'FUNC'); if (r.page.id !== 'menu') step(r, 'FUNC');
  steps(r, 'outer'); clicks(r, 'inner', 3); step(r, 'ENT');     // INTRCOM ON/OFF
  has(r, 'INTRCOM ON/OFF', 'INTERCOM ON');
  steps(r, ['inner', -1], 'ENT');
  assert.equal(r.s.ics.on, false);
  steps(r, 'FUNC'); if (r.page.id !== 'menu') step(r, 'FUNC');
  steps(r, 'outer'); clicks(r, 'inner', 4); step(r, 'ENT');     // SPEAKER ON/OFF
  has(r, 'SPEAKER ON/OFF', 'SPEAKER ON');
});

test('3.4.1-3.4.8 system configuration', () => {
  const r = radio();
  const open = n => { step(r, 'FUNC'); if (r.page.id !== 'menu') step(r, 'FUNC'); clicks(r, 'outer', 2); clicks(r, 'inner', n); step(r, 'ENT'); };
  open(1); has(r, 'COM SPACING', 'CHNL SPACE 8.33KHZ');           // 3.4.1
  steps(r, 'inner', 'ENT'); assert.equal(r.s.spacing, 25);
  open(2); has(r, 'COM SIDETONE', 'MODE: OFFSET', 'OFFSET: 0');   // 3.4.2
  steps(r, 'outer', 'inner', 'ENT'); assert.equal(r.s.sidetone.offset, 1);
  open(3); has(r, 'DISPLAY BRIGHTNESS', 'BRIGHTNESS', 'OFFSET 0'); // 3.4.3
  steps(r, 'inner', 'ENT'); assert.equal(r.s.brt, 1);
  open(4); has(r, 'DISPLAY CONTRAST', 'OFFSET 0');                 // 3.4.4
  steps(r, 'CLR');
  open(5); has(r, 'DATABASE INFO', 'CYCLE: 2610', 'EFCTV:', 'REG:'); // 3.4.5
  step(r, 'FUNC'); assert.equal(r.page.id, 'com');                 // 5. Press FUNC to exit page.
  r.s.usb = 'valid';
  open(6); has(r, 'PRESS ENT TO LOAD', 'DATABASE FROM USB.');      // 3.4.6
  step(r, 'ENT'); has(r, 'DATABASE VERSIONS:', 'INSTALLED', 'ON DRIVE');
  step(r, 'ENT'); assert.equal(r.s.db.cycle, '2611');
  open(7); has(r, 'SOFTWARE VERSIONS', 'DISPLAY:', 'COM:');         // 3.4.7
  step(r, 'FUNC'); assert.equal(r.page.id, 'com');
  open(8); has(r, 'SERIAL NUMBER', 'S/N:', 'ID:');                  // 3.4.8
});

test('3.5.1 / 3.5.2 / 3.5.3 timers', () => {
  const r = radio();
  steps(r, 'FUNC'); clicks(r, 'outer', 3);   // 1./2. FUNC, outer to TMR CONFIGURATION
  clicks(r, 'inner', 2);                     // 3. inner to COUNT DOWN
  step(r, 'ENT');                            // 4. Press ENT.
  has(r, 'COUNT DOWN TIMER', '00:01:00', 'ENT=START/STOP CLR=RESET PUSH CRSR=SETTINGS');
  step(r, 'push');                           // 5. Press the inner knob to enter a starting value.
  step(r, 'outer');                          // 6. Turn the outer knob to move to seconds/minutes/hours.
  step(r, 'inner');
  step(r, 'ENT');                            // 7. Press ENT to confirm entry.
  const start = r.s.cdStart;
  step(r, 'ENT'); r.advance(3000);           // 8. Press ENT to start or stop the timer.
  step(r, 'ENT');
  assert.ok(!r.cd.running);
  step(r, 'CLR');                            // 9. CLR resets the timer to the starting value.
  assert.equal(Math.round(r.cdRemainingMs() / 1000), start);
  step(r, 'push');                           // 10. Press the inner knob to change the starting value.
  assert.ok(r.page.edit);
  step(r, 'CLR');
  // 3.5.2 count up
  steps(r, 'FUNC'); if (r.page.id !== 'menu') step(r, 'FUNC');
  clicks(r, 'outer', 3); step(r, 'inner'); step(r, 'ENT');
  has(r, 'COUNT UP TIMER', '00:00:00', 'ENT=START/STOP  CLR=RESET');
  step(r, 'ENT'); r.advance(5000);           // 5. ENT starts
  step(r, 'ENT');                            // 6. ENT again stops
  has(r, '00:00:05');
  step(r, 'CLR');                            // 7. CLR resets to 0:00 and stops counting
  has(r, '00:00:00');
  // 3.5.3 on the COM display
  step(r, 'ENT'); step(r, 'COM'); r.advance(2000);
  has(r, '00:00:02');
  steps(r, 'CLR', 'ENT');                    // 1. To reset the timer, press CLR and then ENT.
  assert.equal(r.displayedTimer(), null);
  steps(r, 'FUNC'); clicks(r, 'outer', 3); step(r, 'inner'); steps(r, 'ENT', 'ENT', 'COM');
  step(r, 'ENT'); has(r, 'STOP TMR? ENT=STOP CLR=CANCEL');   // 2. press ENT twice to stop
  step(r, 'ENT'); assert.ok(!r.cu.running);
});

test('5.1 messages: ENT acknowledges and returns to the previous page', () => {
  const r = radio();
  steps(r, 'FUNC', 'outer');
  r.triggerMessage('FAN');
  has(r, 'THE COOLING FAN HAS FAILED', 'ENT=ACCEPT');
  step(r, 'ENT');
  assert.equal(r.page.id, 'menu');
  has(r, 'ICS CONFIGURATION');
});
