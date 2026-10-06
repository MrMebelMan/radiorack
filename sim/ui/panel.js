// Side panels: status line, external (yoke) controls and the simulation panel.
import { fmtFreq } from '../core/freq.js';
import { t, onLang } from './i18n.js';

export const ambWord = v => t(`amb.${v < 15 ? 'night' : v > 85 ? 'sunlight' : v < 50 ? 'dusk' : 'day'}`);
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
    const runSync = () => { run.textContent = t(radio.flying ? 'sim.pause' : 'sim.fly'); run.classList.toggle('down', radio.flying); };
    run.onclick = () => { radio.setFlying(!radio.flying); runSync(); };
    onLang(runSync);
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
  onLang(ambSync);
  const msgSel = $('msgSel');
  Object.entries(messages).forEach(([id, m]) => msgSel.add(new Option(m.length > 60 ? m.slice(0, 58) + '…' : m, id)));

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
        if (confirm(t('panel.confirm.factory'))) { radio.factoryReset(); syncInputs(); }
        break;
    }
    render();
  }));

  // status line under the radio
  return function renderStatus() {
    const s = radio.s;
    $('hint').textContent = !radio.switchOn ? t('panel.hint.off')
      : !radio.bus ? t(radio.power ? 'panel.hint.busOffPowered' : 'panel.hint.busOff')
      : radio.locked ? t('panel.hint.locked') : '';
    const a = radio.audio();
    // nothing to hear without power: the hint line says enough
    $('hearingRow').hidden = a.src === 'off';
    const name = f => { const r = radio.reverse(f); return r ? ` (${r})` : ''; };
    const freq = fmtFreq(a.freq || 0);
    const sidetone = s.sidetone.mode === 'FIXED' ? t('panel.hear.sidetoneFixed') : t('panel.hear.sidetoneOffset', { offset: s.sidetone.offset });
    const txt = t(`panel.hear.${a.src}`, { freq, sidetone, name: name(a.freq) });
    const onOff = v => t(v ? 'sim.on' : 'sim.off');
    const extra = radio.power ? `${t('panel.hear.extra', { vol: s.vol, speaker: onOff(s.speaker), ics: onOff(s.ics.on) })}${s.ics.mute && (a.src === 'act' || a.src === 'stb') ? t('panel.hear.mutedRx') : ''}${radio.stuck ? ' · STUCK MIC' : ''}` : '';
    const nav = radio.navAudio?.();
    $('hearing').textContent = txt + extra + (nav ? t('panel.hear.nav', nav) : '');
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
