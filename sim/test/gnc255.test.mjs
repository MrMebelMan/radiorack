import test from 'node:test';
import assert from 'node:assert/strict';
import { GNC255, MENU } from '../devices/gnc255/device.js';
import { stepNavKhz, stepNavMhz, fmtNav, isLoc, NAV_BAND } from '../nav/band.js';
import { NavDatabase } from '../nav/nav-database.js';
import { vorCdi, radialFrom, movePos } from '../core/nav.js';

function make() {
  let t = 0;
  const r = new GNC255({ now: () => t });
  r.advance = ms => { t += ms; r.tick(); };
  r.input('vol', 1);
  r.advance(3000);
  return r;
}
const text = v => JSON.stringify(v);

test('NAV channel stepping: 108.00-117.95 in 50 kHz steps (manual 1.1)', () => {
  assert.equal(fmtNav(stepNavKhz(108000, 1)), '108.05');
  assert.equal(fmtNav(stepNavKhz(117950, 1)), '117.00');
  assert.equal(fmtNav(stepNavKhz(110000, -1)), '110.95');
  assert.equal(fmtNav(stepNavMhz(117500, 1)), '108.50');
  assert.equal(fmtNav(stepNavMhz(108500, -1)), '117.50');
  assert.ok(isLoc(109100) && isLoc(111950) && !isLoc(109200) && !isLoc(112100));
});

test('C/N switches COM / NAV; NAV tuning, flip and annunciator (manual 2.2.1)', () => {
  const r = make();
  assert.match(text(r.view()), /"ann":"COM"/);
  r.input('CN');
  assert.equal(r.mode, 'nav');
  const v = r.view();
  assert.match(text(v), /"ann":"NAV"/);
  assert.equal(v.act, '112.60');
  assert.match(text(v), /OKL VOR/);
  r.input('outer', 1); r.input('inner', 1);
  assert.equal(r.s.nav.stb, 113300);
  r.input('flipDown'); r.input('flipUp');
  assert.equal(r.s.nav.act, 113300);
  assert.equal(r.s.nav.recent[0], 113300);
  assert.equal(r.s.act, 120335, 'COM untouched');
  r.input('CN');
  assert.equal(r.mode, 'com');
});

test('monitoring is not canceled by switching to NAV mode (manual 2.1.2)', () => {
  const r = make();
  r.input('MON');
  r.input('CN'); r.input('CN');
  assert.ok(r.s.mon);
  assert.match(text(r.view()), /"label":"MN"/);
});

test('NAV ident: press NAV knob with NAV display active -> ID (manual 2.2.3)', () => {
  const r = make();
  r.input('navIdUp');
  assert.ok(!r.s.nav.id, 'not from the COM display');
  r.input('CN'); r.input('navIdUp');
  assert.ok(r.s.nav.id);
  assert.equal(r.view().ann, 'ID');
  assert.equal(r.navAudio().ident, 'OKL');
  r.input('navVol', 1);
  assert.equal(r.s.nav.vol, 55);
});

test('save NAV channel: ENT=DONE hint and NAV types (manual 2.2.2)', () => {
  const r = make();
  r.s.nav.user = [];
  r.input('CN'); r.input('ENT');
  assert.equal(r.page.id, 'uedit');
  assert.match(text(r.view()), /ENT=DONE  CLR=UNDO/);
  r.input('inner', 1);      // A
  r.input('ENT');           // accept name
  r.input('outer', 1);      // to TYPE
  r.input('inner', 1);      // VOR (wraps from blank)
  r.input('ENT');
  assert.deepEqual(r.s.nav.user[0], { freq: 112250, name: 'A', type: 'VOR' });
});

test('FUNC tree: NAV FREQUENCY LIST, Count Down before Count Up, no MEM / ICS keys (manual 3.1)', () => {
  assert.deepEqual(MENU.map(c => c.title), ['COM FREQUENCY LIST', 'NAV FREQUENCY LIST', 'ICS CONFIGURATION', 'SYS CONFIGURATION', 'TMR CONFIGURATION']);
  assert.deepEqual(MENU[4].items.map(i => i[0]), ['COUNT DOWN', 'COUNT UP']);
  const r = make();
  r.input('MEM'); r.input('ICS');
  assert.equal(r.page.id, 'com');
});

test('NAV database look-up: 3-decimal frequency, ENT = standby (manual 3.3.3)', () => {
  const r = make();
  r.input('FUNC'); r.input('outer', 1); r.input('inner', 3); r.input('ENT');   // NAV > DATABASE
  assert.equal(r.page.id, 'db');
  r.page.ident = ['V', 'O', 'Z', '_'];
  r.input('ENT');
  assert.match(text(r.view()), /116\.950/);
  assert.match(text(r.view()), /NAV DATABASE/);
  r.input('ENT');
  assert.equal(r.s.nav.stb, 116950);
});

test('NAV database duplicates flow (manual 3.3.3), with fixture data', () => {
  const r = make();
  r.navDb = new NavDatabase([
    { id: 'PDT', name: 'PENDLETON', type: 'VOR', f: 114700, lat: 45.7, lon: -118.9, var: 17 },
    { id: 'PDT', name: 'PADERBORN', type: 'VOR', f: 113000, lat: 51.6, lon: 8.6, var: 3 },
  ]);
  r.openLookup('func', { id: 'menu', func: true }, NAV_BAND);
  r.page.ident = ['P', 'D', 'T', '_'];
  r.input('ENT');
  assert.match(text(r.view()), /DUPLICATES FOUND/);
  r.input('ENT');
  assert.match(text(r.view()), /PENDLETON/);
  r.input('inner', 1);
  assert.match(text(r.view()), /PADERBORN/);
  r.input('ENT');
  r.input('ENT');
  assert.equal(r.s.nav.stb, 113000);
});

test('nearest VOR: ENT = standby, flip = active, CLR exits (manual 3.3.4)', () => {
  const r = make();
  r.input('FUNC'); r.input('outer', 1); r.input('inner', 4); r.input('ENT');
  assert.equal(r.page.kind, 'nvor');
  assert.match(text(r.view()), /NEAREST VOR/);
  r.input('inner', 1);
  const f = r.listItems('nvor', NAV_BAND)[1].freq;
  r.input('ENT');
  assert.equal(r.s.nav.stb, f);
  r.input('flipDown'); r.input('flipUp');
  assert.equal(r.s.nav.act, f);
  r.input('CLR');
  assert.equal(r.page.id, 'menu');
});

test('VOR CDI geometry: TO/FROM and needle side (2 deg per dot, 10 full scale)', () => {
  // on radial 270 inbound (course 090): centred, TO
  assert.deepEqual(vorCdi(90, 270), { toFrom: 'TO', needleDeg: 0 });
  // on radial 280 with OBS 090: north of course, course to the left -> needle left
  assert.ok(vorCdi(90, 280).needleDeg < 0);
  // outbound on radial 090 with OBS 090: FROM, centred
  assert.deepEqual(vorCdi(90, 90), { toFrom: 'FROM', needleDeg: 0 });
  assert.equal(vorCdi(90, 120).needleDeg, -10);   // clamped full scale
});

test('OBS page: knobs set the OBS, CDI follows the aircraft position (manual 2.3)', () => {
  const r = make();
  r.input('OBS');
  assert.equal(r.page.id, 'obs');
  const radial = Math.round(radialFrom(r.navDb.findIdent('OKL'), r.pos));
  // set the OBS to the radial the aircraft is on -> FROM, centred
  for (let i = 0; i < Math.floor(radial / 10); i++) r.input('outer', 1);
  for (let i = 0; i < radial % 10; i++) r.input('inner', 1);
  assert.equal(r.s.nav.obs, radial);
  const c = r.cdi();
  assert.equal(c.toFrom, 'FROM');
  assert.ok(Math.abs(c.needle) < 0.1);
  assert.match(text(r.view()), /"OBS","tiny":true/);
  assert.match(text(r.view()), /"stack":\["CM","ACT"\]/);
  r.input('OBS');
  assert.equal(r.page.id, 'com');
});

test('T/F: DST row TO/FROM, ignored on a localizer (manual 2.4)', () => {
  const r = make();
  r.input('TF');
  let v = text(r.view());
  assert.match(v, /OKL/);
  assert.match(v, /"stack":\["TO","BRG"\]/);
  assert.match(v, /"stack":\["NV","ACT"\]/);
  r.input('TF');                 // FROM: the radial; no FROM label (none in the manual)
  assert.equal(r.s.nav.tf, 'from');
  assert.doesNotMatch(text(r.view()), /"stack":\["TO","BRG"\]/);
  r.s.nav.act = 109100;   // PR localizer
  r.s.nav.tf = 'off';
  r.input('TF');
  assert.equal(r.s.nav.tf, 'off');
});

test('flight sim moves the aircraft; DST distance and ETE follow', () => {
  const r = make();
  const p0 = { ...r.pos };
  r.s.flight.gs = 120; r.s.flight.trk = 0;
  r.setFlying(true);
  r.advance(30 * 60000);   // 30 minutes at 120 kt = 60 NM north
  const moved = r.pos;
  const expect = movePos(p0, 5, 60);
  assert.ok(Math.abs(moved.lat - expect.lat) < 0.01 && Math.abs(moved.lon - expect.lon) < 0.01);
  r.input('TF');
  assert.match(text(r.view()), /" 120"/);
  r.setStartPos('LKLT');
  assert.deepEqual(r.pos, { ...r.positions.find(p => p.id === 'LKLT') });
});

test('message screen: text full width, ENT=ACCEPT (manual 5.1)', () => {
  const r = make();
  r.triggerMessage('VLOC_FAIL');
  const v = r.view();
  assert.equal(v.message, 'NAVIGATION RECEIVER HAS FAILED');
  assert.equal(v.bottomLeft[0].t, 'ENT=ACCEPT');
  r.input('ENT');
  assert.equal(r.view().message, undefined);
});

test('COM VOL line shows the active NAV frequency (manual 1.2)', () => {
  const r = make();
  r.input('vol', 1);
  assert.match(text(r.view()), /COM VOL/);
  assert.match(text(r.view()), /"stack":\["NV","ACT"\]/);
});

test('localizer on the OBS page: "LOC" instead of the OBS value, no TO/FROM (photo of the unit)', () => {
  const r = make();
  r.setStartPos('LKPR');
  r.s.nav.act = 109100;      // PR, LKPR ILS 24
  r.input('OBS');
  const c = r.cdi();
  assert.equal(c.ident, 'PR');
  assert.ok(c.loc && c.toFrom === null);
  const v = JSON.stringify(r.view());
  assert.match(v, /"t":"LOC"/);
  assert.doesNotMatch(v, /"OBS","tiny"/);
});

test('FUNC menu scrolls over five categories, NAV line active (photo of the unit)', () => {
  const r = make();
  r.input('FUNC'); r.input('outer', 1); r.input('inner', 2);   // NAV > USER FREQS
  const lines = r.view().right.lines.map(l => l.map(x => x.t).join(''));
  assert.deepEqual(lines, ['COM FREQUENCY LIST', 'NAV USER FREQS', 'ICS CONFIGURATION', 'SYS CONFIGURATION']);
  r.input('outer', 1); r.input('outer', 1); r.input('outer', 1);  // TMR: list scrolls by one
  assert.deepEqual(r.view().right.lines.map(l => l.map(x => x.t).join('')), ['NAV FREQUENCY LIST', 'ICS CONFIGURATION', 'SYS CONFIGURATION', 'TMR CONFIGURATION']);
});
