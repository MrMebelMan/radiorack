# GTR 225 simulator

A local web app that simulates the Garmin GTR 225A VHF COM radio. It exists so the owner can practise operating the radio on the ground. The source of truth is `GTR225.pdf` (Pilot's Guide 190-01182-00 Rev D, SW v2.10).

## Run / test
- Serve: `python3 sim/serve.py` → http://localhost:8225. It sends no-cache headers, so a normal reload picks up edits. ES modules don't load over `file://`.
- Test: `cd sim && node --test` runs `radio.test.mjs` against `radio.js` headless.
- The PDF can be read with poppler via nix: `nix shell nixpkgs#poppler-utils -c pdftotext -layout GTR225.pdf out.txt`. Write output to the scratchpad, not the repo.
- The user does the visual testing in the browser. Don't take screenshots for that unless asked. Functional checks over CDP (e.g. reading the LCD text) are fine.

## Layout (`sim/`)
- `radio.js`: all radio behaviour, with no DOM. It is a `Radio` class.
  - `input(evt, arg)` takes the bezel and remote inputs.
  - `tick()` handles timed things: 2 s holds, stuck mic, shutdown.
  - `view()` returns a display model. The UI only renders it.
  - Per-page logic lives in the `handlers` and `renderers` maps, keyed by `page.id`.
  - Settings pages are table-driven via `SETTINGS`.
  - Time comes from an injected `now()`, so tests drive the clock.
- `ui.js`: renders `view()` into the LCD and binds the bezel: knob drag/wheel, keys, the remote buttons in the side panel, and the simulation panel. It also holds the WebAudio sound (static, the incoming-call clips in `sounds/`).
- `data.js`: the frequency database (`AIRPORTS`, `STATIONS`, `FIR`), the GPS positions, and the DB/unit info.
- `index.html` / `style.css`: the bezel is absolutely positioned on an 880×210 canvas, scaled to fit. The LCD is a CSS grid.

## Rules
- **Follow the manual exactly.** Implement the manual's step sequences literally, with no "convenient" shortcuts. Where the manual is silent or contradicts itself, say so and ask; don't guess quietly.
- **Don't add anything that wasn't asked for.** That covers UI helpers, extra controls, decorations, duplicated status and sounds. Offer the idea in one line instead.
- **Frequencies must be real.** Check them against the Czech AIP at aim.rlp.cz (eAIP AD 2.18, VFR Manual, ENR 2.1, GEN 3.5), never from memory. They are stored in kHz using 8.33 channel names (120.335 → `120335`). The current data was verified for AIRAC 01 OCT 2026.
- Saved state lives in localStorage under `PERSIST_KEY` in `radio.js`. Bump it when the defaults change in a way that old saved state would hide.
- MON and squelch override are operating states. They reset at every power-up. Frequencies, lists and ICS/SYS settings persist.
