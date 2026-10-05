# RadioRack

Avionics simulators for training on the ground before you fly.

Every unit here behaves the way its manual says it does: the same keys, the same knob pushes, the same menus, the same screens. You turn knobs with the mouse, hear the radio, and work through the real procedures until your fingers know them.

## The units

### Garmin GTR 225A — VHF COM

![GTR 225A](sim/previews/gtr225.png)

8.33 kHz COM with monitor, intercom, timers, the frequency database (nearest airports, ATIS, FIS), user frequencies, stuck-mic and emergency 121.5. Built from the [Pilot's Guide 190-01182-00 Rev D](https://static.garmin.com/pumac/190-01182-00_d.pdf).

### Garmin GNC 255A — NAV/COM

![GNC 255A](sim/previews/gnc255.png)

Everything the GTR does, plus the NAV side: VOR/LOC tuning, OBS and CDI, TO/FROM, distance, and Morse ident. A simple flight simulation moves the aircraft along a track. Built from the [Pilot's Guide 190-01182-01 Rev E](https://static.garmin.com/pumac/190-01182-01_e.pdf).

### Trig TT31 — Mode S transponder

![Trig TT31](sim/previews/tt31.png)

Mode knob, squawk and Flight ID entry, IDENT, the VFR conspicuity code, flight timer, stopwatch, altitude monitor and the ADS-B position warning. Built from the [Operating Manual 00454-00-AF](https://trig-avionics.com/library/00454-00%20AF%20TT31%20Operating%20Handbook.pdf) and [Installation Manual 00455-00-AR](https://trig-avionics.com/library/00455-00%20AR%20TT31%20Installation%20Manual%20-%20Full.pdf).

### Garmin GTX 328 — Mode S transponder

![Garmin GTX 328](sim/previews/gtx328.png)

The mode keys, squawk entry with dashes and the cursor, IDENT, VFR, pressure altitude with the trend arrow, flight time, altitude monitor with "Leaving Altitude", count up and count down timers, Flight ID entry at power-up and all the installer configuration pages. Built from the [Pilot's Guide 190-00420-03](https://static.garmin.com/pumac/GTX328Transponder_PilotsGuide.pdf), the Installation Manual 190-00420-04 (not published by Garmin) and the [Maintenance Manual 190-00420-05](https://static.garmin.com/pumac/GTX328Transponder_MaintenanceManual.pdf).

### Becker AR6201 — 57 mm VHF COM

![Becker AR6201](sim/previews/ar6201.png)

Standard, Direct Tune and Channel modes, scan with priority, 99 labeled user channels and the last-channel memory, squelch with signal strength, intercom and pilot menus — and the full installer Installation Setup behind the password. Built from the [Operating Instructions (Issue 5, 2013)](https://www.becker-avionics.com/wp-content/uploads/2017/08/AR6201_OI.pdf) and the [Installation and Operation Manual DV 14300.03](https://www.becker-avionics.com/wp-content/uploads/2017/08/AR6201_IO_SW3050149.pdf).

### King KMA 20 TSO — audio panel with marker beacon receiver

![King KMA 20 TSO](sim/previews/kma20.png)

The microphone selector, a SPEAKER / OFF / PHONE toggle for every receiver, the AUTO switch that follows the transmitter you talk on, mic muting, and the marker lamps and tones (HI / LO / TEST) while you fly a real Czech ILS approach with outer and middle markers. Every input plays a real signal: COM calls and the Morse idents of the tuned VOR, ILS, NDB and DME. Built from the King brochure "Operating your KMA 20 Audio Control System" (006-8200-05) and the KMA 20/KR 21 Installation Manual (006-0044-02 Rev 2); neither is published by Honeywell (Bendix/King), so they are only in `sim/manuals/`.

## Running it

You need Python 3 and a browser.

```sh
python3 sim/serve.py
```

Open <http://localhost:8225> and pick a unit.

## How to use a simulator

- **Turn a knob:** drag it up or down, or scroll over it.
- **Push a knob:** click it.
- **Press a key:** click it. Hold it for a long press where the unit has one.
- **Keep a key pressed:** right-click it (GTX 328), click again to release.
- **Flip a toggle switch:** click its upper or lower half, or scroll over it (KMA 20).
- **Hover anything** for a tooltip that says what it does.

Under each unit there are panels for the things that happen *outside* the radio: the cockpit light on the photocell, hold PTT, make a station call you on the active or standby frequency, switch off the avionics master, set the GPS position, fly a track or an ILS approach, tune the receivers behind the audio panel, put the headset on, raise a fault. On the right there's a cheat sheet of the procedures from the manual, and the manuals themselves are one click away.

Settings, frequencies and stored channels are kept in your browser.

## How faithful is it?

The manual is the spec. Procedures are implemented step by step as written, and every one of them is replayed as an automated test. Nothing appears on a screen unless it's in a manual figure or a photo of the real unit.

Where a manual is silent — how long a splash screen stays up, what a key does on a page the manual never mentions — the simulator makes a minimal, sensible choice and writes it down in [ASSUMPTIONS.md](ASSUMPTIONS.md), with a checkbox to tick once someone checks it on a real unit.

Frequencies and navaids come from the Czech AIP (aim.rlp.cz) for a specific AIRAC cycle; the cycle is noted in `sim/data/lk.js`.

## Tests

```sh
cd sim && node --test
```

Unit tests plus a manual-replay suite per device: every numbered procedure from the manuals, pressed key by key on a unit that's already been used for something else.

## Adding a unit

There's a Claude Code skill for it in [`.claude/skills/add-device/`](.claude/skills/add-device/SKILL.md): how to read the manuals, what to look for in the installation manual, which shared code to reuse, how to make the bezel look right, and how to check the result against photos. The code layout is described in [CLAUDE.md](CLAUDE.md).

## Credits

The manuals in `sim/manuals/` belong to Garmin, Trig Avionics, Becker Avionics and Honeywell (Bendix/King) and are included for reference. The bundled fonts — Jersey 15, Barlow Semi Condensed and Nunito — are under the SIL Open Font License (see `sim/fonts/`).
