// English of the web UI strings built in JS (ui/i18n.js t()). The English of the page text is the HTML itself.
// Keys starting with a page id (gtx328.…) are translated in i18n/<lang>/<page>.js, all others in i18n/<lang>/common.js.
export default {
  // cockpit light slider value (ui/panel.js ambWord)
  'amb.night': 'night',
  'amb.dusk': 'dusk',
  'amb.day': 'day',
  'amb.sunlight': 'sunlight',
  'sim.fly': 'Fly',
  'sim.pause': 'Pause',
  'sim.busOff': 'Avionics master off.',
  'sim.on': 'on',
  'sim.off': 'off',

  // GTR 225 / GNC 255 status line and panels (ui/panel.js)
  'panel.hint.off': 'Radio is OFF. Turn the PWR/VOL knob clockwise (drag up or scroll up) to power on.',
  'panel.hint.busOffPowered': 'Avionics master off: the unit shuts down in a few seconds unless it is switched back on.',
  'panel.hint.busOff': 'Avionics master off. Switch it on to bring the radio back.',
  'panel.hint.locked': 'COM is locked to 121.5. Hold COM RMT XFR for 2 s to unlock.',
  'panel.hear.off': 'radio off',
  'panel.hear.tx': 'transmitting on {freq} (sidetone {sidetone})',
  'panel.hear.sidetoneFixed': 'fixed',
  'panel.hear.sidetoneOffset': 'offset {offset}',
  'panel.hear.act': 'receiving on ACTIVE {freq}{name}',
  'panel.hear.stb': 'receiving on STANDBY {freq}{name} (monitor)',
  'panel.hear.static': 'squelch open: background static',
  'panel.hear.quiet': 'quiet (squelched)',
  'panel.hear.extra': ' · vol {vol}% · speaker {speaker} · ICS {ics}',
  'panel.hear.mutedRx': ' (muted on RX)',
  'panel.hear.nav': ' · NAV ident {ident} (vol {vol}%)',
  'panel.confirm.factory': 'Reset all settings, user frequencies and recent list?',

  // manual button tooltips: the note on a public copy (data/manuals.js), shown when the manuals aren't self-hosted
  'manual.note.kma20-operating-guide': 'Public copy of another edition: "How to get the most from your King KMA 20"',

  'ar6201.hint.off': 'Transceiver OFF. Turn the volume knob clockwise (drag up or scroll up).',
  'ar6201.hear.tx': 'transmitting on {freq}',
  'ar6201.hear.act': 'receiving on the ACTIVE frequency {freq}',
  'ar6201.hear.stb': 'receiving on the PRESET frequency {freq} (scan)',
  'ar6201.hear.static': 'squelch off: receiver noise',
  'ar6201.hear.quiet': 'quiet (squelch)',
  'ar6201.hear.vol': ' · vol {vol}%',
  'ar6201.hear.intercom': ' · intercom',
  'ar6201.confirm.factory': 'Reset all settings, channels and labels to factory defaults?',

  'gtx328.key.ON': 'ON: selects Mode A (and Mode S). The transponder replies to interrogations, as shown by the reply symbol, but the replies do not include altitude. Powers the unit on.',
  'gtx328.key.OFF': 'OFF: powers off the GTX 328.',
  'gtx328.key.STBY': 'STBY: standby, the transponder does not reply to interrogations. Press and hold for ground (GND) mode when it is not selected automatically. Powers the unit on.',
  'gtx328.key.ALT': 'ALT: selects Mode A and Mode C (and Mode S). Replies include the pressure altitude from the altitude source. Powers the unit on.',
  'gtx328.hint.off': 'Transponder OFF. Press STBY, ON or ALT.',
  'gtx328.hint.config': 'Configuration mode: FUNC next page, START/STOP back, CRSR select / accept. Turn the power off to leave.',
  'gtx328.hear.selfTest': 'self test',
  'gtx328.hear.status': '{mode} · squawk {code} · {reply}',
  'gtx328.confirm.factory': 'Reset the code and all configuration settings to the simulator defaults?',
  'xpdr.replying': 'replying to interrogations',
  'xpdr.notReplying': 'not replying',

  'kma20.hear.nothing': 'nothing',
  'kma20.hear.ext': 'EXT speaker: {list}',
  'kma20.hear.speaker': 'Speaker: {list}',
  'kma20.hear.muted': ' (muted)',
  'kma20.hear.phones': ' · Phones: {list}',
  'kma20.hear.micExt': ' · microphone on the EXT speaker',
  'kma20.hear.tx': ' · transmitting on {name}',
  'kma20.confirm.factory': 'Reset the switches, tuned stations and approach to the simulator defaults?',

  'kn64.confirm.factory': 'Reset the switches, frequencies and flight to the simulator defaults?',

  'tt31.hint.off': 'Transponder OFF. Turn the mode knob clockwise (drag up or scroll up) to SBY.',
  'tt31.hear.squat': ' (selected {mode}, squat switch: on ground)',
  'tt31.confirm.factory': 'Reset all settings to factory defaults?',
};
