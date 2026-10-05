// Side panels: status line, external (yoke) controls and the simulation panel.
import { fmtFreq } from '../core/freq.js';

export const ambWord = v => (v < 15 ? 'night' : v > 85 ? 'sunlight' : v < 50 ? 'dusk' : 'day');
const KEY_CUTOFF = 80;   // KEY CO default (Installation Manual 190-01182-02 Table 6-4)

export function bindPanel(radio, { $, send, render, audio, positions, messages }) {
  const posSel = $('posSel');
  positions.forEach(p => posSel.add(new Option(p.label, p.id)));
  const syncInputs = () => {
    posSel.value = radio.s.posId;
    $('gpsOn').checked = radio.s.gps;
    $('usbSel').value = radio.s.usb;
  };
  syncInputs();
  posSel.onchange = () => {
    if (radio.setStartPos) radio.setStartPos(posSel.value);   // also resets a flown position
    else { radio.s.posId = posSel.value; radio.save(); }
  };

  // flight simulation (NAV/COM pages only): ground speed, track, run / pause, back to start
  const gs = $('flightGs');
  if (gs) {
    const trk = $('flightTrk'), run = $('flightRun');
    const sync = () => {
      gs.value = radio.s.flight.gs; $('flightGsVal').textContent = `${radio.s.flight.gs} kt`;
      trk.value = radio.s.flight.trk; $('flightTrkVal').textContent = `${String(radio.s.flight.trk).padStart(3, '0')}°`;
    };
    sync();
    gs.oninput = () => { radio.s.flight.gs = +gs.value; radio.save(); sync(); };
    trk.oninput = () => { radio.s.flight.trk = +trk.value; radio.save(); sync(); };
    run.onclick = () => { radio.setFlying(!radio.flying); run.textContent = radio.flying ? 'Pause' : 'Fly'; run.classList.toggle('down', radio.flying); };
    $('flightReset').onclick = () => { radio.setStartPos(posSel.value); render(); };
  }
  $('gpsOn').onchange = e => { radio.s.gps = e.target.checked; radio.save(); };
  $('usbSel').onchange = e => { radio.s.usb = e.target.value; radio.save(); };
  // aircraft (avionics bus) power switch
  $('busSw').onchange = e => { if (e.target.checked) radio.restoreAircraftPower(); else radio.removeAircraftPower(); render(); };
  // cockpit light on the photocell: display backlight and key lighting (Installation Manual 190-01182-02 6.4.1.4-5)
  const amb = $('ambSl');
  const ambSync = () => { amb.value = radio.ambient; $('ambVal').textContent = ambWord(radio.ambient); };
  amb.oninput = () => { radio.ambient = +amb.value; ambSync(); render(); };
  ambSync();
  const msgSel = $('msgSel');
  Object.entries(messages).forEach(([id, t]) => msgSel.add(new Option(t.length > 60 ? t.slice(0, 58) + '…' : t, id)));

  document.querySelectorAll('[data-sim]').forEach(b => b.addEventListener('click', () => {
    switch (b.dataset.sim) {
      case 'recall': send('recall'); break;
      case 'chanUp': send('chanUp'); break;
      case 'chanDn': send('chanDn'); break;
      case 'remoteIcs': send('remoteIcs'); break;
      case 'rxAct': audio.incomingCall('act'); break;
      case 'rxStb': audio.incomingCall('stb'); break;
      case 'msg': radio.triggerMessage(msgSel.value); break;
      case 'factory':
        if (confirm('Reset all settings, user frequencies and recent list?')) { radio.factoryReset(); syncInputs(); }
        break;
    }
    render();
  }));

  // status line under the radio
  return function renderStatus() {
    const s = radio.s;
    $('hint').textContent = !radio.switchOn
      ? 'Radio is OFF. Turn the PWR/VOL knob clockwise (drag up or scroll up) to power on.'
      : !radio.bus ? (radio.power ? 'Aircraft power removed: unit shuts down in a few seconds unless power is restored.' : 'No aircraft power. Restore aircraft power to bring the radio back.')
      : radio.locked ? 'COM is locked to 121.5. Hold COM RMT XFR for 2 s to unlock.' : '';
    const a = radio.audio();
    // nothing to hear without power: the hint line says enough
    $('hearingRow').hidden = a.src === 'off';
    const name = f => { const r = radio.reverse(f); return r ? ` (${r})` : ''; };
    const txt = {
      off: 'radio off',
      tx: `transmitting on ${fmtFreq(a.freq || 0)} (sidetone ${s.sidetone.mode === 'FIXED' ? 'fixed' : 'offset ' + s.sidetone.offset})`,
      act: `receiving on ACTIVE ${fmtFreq(a.freq || 0)}${name(a.freq)}`,
      stb: `receiving on STANDBY ${fmtFreq(a.freq || 0)}${name(a.freq)} (monitor)`,
      static: 'squelch open: background static',
      quiet: 'quiet (squelched)',
    }[a.src];
    const extra = radio.power ? ` · vol ${s.vol}% · speaker ${s.speaker ? 'on' : 'off'} · ICS ${s.ics.on ? 'on' : 'off'}${s.ics.mute && (a.src === 'act' || a.src === 'stb') ? ' (muted on RX)' : ''}${radio.stuck ? ' · STUCK MIC' : ''}` : '';
    const nav = radio.navAudio?.();
    $('hearing').textContent = txt + extra + (nav ? ` · NAV ident ${nav.ident} (vol ${nav.vol}%)` : '');
    $('usbSlot').classList.toggle('inserted', s.usb !== 'none');
    $('busSw').checked = radio.bus;
    // bezel key lighting tracks the photocell and switches off above KEY CO (default 80 %)
    $('bezel').style.setProperty('--keylit', radio.power && radio.ambient < KEY_CUTOFF ? (1 - radio.ambient / KEY_CUTOFF).toFixed(2) : 0);
    // status dot: off / on / no aircraft power / receiving / transmitting
    $('statusBar').dataset.state = !radio.bus && radio.switchOn ? 'nopower'
      : a.src === 'off' ? 'off' : a.src === 'tx' ? 'tx' : (a.src === 'act' || a.src === 'stb') ? 'rx' : 'on';
    $('xfr').classList.toggle('down', !!radio.hold.xfr);
    $('ptt').classList.toggle('down', radio.tx);
  };
}
