# GTR 225 simulator

A local web app that simulates the Garmin GTR 225A VHF COM radio. It exists so the owner can practise operating the radio on the ground. The source of truth is `GTR225.pdf` (Pilot's Guide 190-01182-00 Rev D, SW v2.10).

## Run / test
- Serve: `python3 sim/serve.py` → http://localhost:8225. It sends no-cache headers, so a normal reload picks up edits. ES modules don't load over `file://`.
- Test: `cd sim && node --test` runs `test/*.test.mjs` headless, against the device classes.
- The PDF can be read with poppler via nix: `nix shell nixpkgs#poppler-utils -c pdftotext -layout GTR225.pdf out.txt`. Write output to the scratchpad, not the repo.
- The user does the visual testing in the browser. Don't take screenshots for that unless asked. Functional checks over CDP (e.g. reading the LCD text) are fine.
- In this shell `rm` is aliased to prompt for confirmation. Use `rm -f`.

## Layout (`sim/`)
Plain ES modules with no build step. The layers depend downward only: `devices` → `com` / `ui` → `core`.
- `core/`: device-independent helpers.
  - `util.js` (range/wrap/clamp, the `S()` display segment)
  - `freq.js` (COM channel math, 8.33/25 kHz)
  - `text.js` (knob character entry)
  - `time.js` (Stopwatch, fmtTime)
  - `geo.js` (distNm)
  - `persist.js` (guarded localStorage)
- `com/`: the COM transceiver, shared by every Garmin COM unit (GTR 225, the COM side of a GNC 255).
  - `com-radio.js` holds the `ComRadio` base class:
    - power, bus and switch, TX/RX and monitor priority, 2 s holds, the emergency channel and the 121.5 lock, stuck mic, messages, timers;
    - `input(evt, arg)` takes the inputs, `tick()` handles timed things, and `view()` returns the display model.
    - Device-specific things come from the `device` config: menu, settings defs, messages, key maps, defaults, info pages, splash.
  - `database.js` (`FreqDatabase`: identifiers, reverse look-up, nearest lists).
  - `constants.js`.
  - `pages/*.js`: one module per screen, each `{ handlers, render, tick? }`. They're called with `this` = the radio and registered in `ComRadio.pages` under `page.id`.
- `devices/gtr225/`:
  - `device.js` defines the `GTR225` class: menu tree, settings pages, messages, defaults, `PERSIST_KEY`, the COM/FUNC/MEM/ICS/MON keys and the ICS key cycle.
  - `info.js` holds the unit info.
  - `main.js` is the page entry: it builds the device and wires the UI modules to `index.html`.
- `ui/`:
  - `lcd.js` (view model → LCD HTML)
  - `controls.js` (knob drag/wheel, keys, hold buttons, keyboard, bezel scaling; config-driven)
  - `audio.js` (static plus the incoming-call clips in `sounds/`)
  - `panel.js` (status line, yoke and simulation panels)
- `data/lk.js`: the Czech frequency database, GPS positions, and DB cycle info.
- `manuals/`: a local copy of the GTR 225 Pilot's Guide, opened from the button in the page header.
- `index.html` / `style.css`: the bezel is absolutely positioned on an 880×248 canvas, scaled to fit. The LCD is a CSS grid using the bundled pixel font (`fonts/jersey15.woff2`, OFL).
- Adding a device (e.g. GNC 255): add `devices/<name>/` with a subclass of `ComRadio` (plus NAV pages via `device.pages`), its own bezel HTML, and a `main.js` that reuses `ui/*`.

## Rules
- **Follow the manual exactly.** Implement the manual's step sequences literally, with no "convenient" shortcuts. Where the manual is silent or contradicts itself, say so and ask; don't guess quietly.
- **Don't add anything that wasn't asked for.** That covers UI helpers, extra controls, decorations, duplicated status and sounds. Offer the idea in one line instead.
- **Frequencies must be real.** Check them against the Czech AIP at aim.rlp.cz (eAIP AD 2.18, VFR Manual, ENR 2.1, GEN 3.5), never from memory. They are stored in kHz using 8.33 channel names (120.335 → `120335`). The current data was verified for AIRAC 01 OCT 2026.
- Saved state lives in localStorage under `PERSIST_KEY` in `devices/gtr225/device.js`. Bump it when the defaults change in a way that old saved state would hide.
- MON and squelch override are operating states. They reset at every power-up. Frequencies, lists and ICS/SYS settings persist.
