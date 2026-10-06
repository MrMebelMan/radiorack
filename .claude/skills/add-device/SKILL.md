---
name: add-device
description: Add a new avionics device (radio, NAV/COM, transponder, DME, …) to the simulator collection in sim/ from its manual PDF(s) and photos of the real unit. Use when the user asks to implement, add or build a simulator for a new unit or hands over a new manual.
---

# Add a device to the avionics simulator collection

You are adding one more practice simulator to `sim/` (plain ES modules, no build step; see `CLAUDE.md` for the layout). The owner uses these to practice on the ground, so the bar is **"behaves and looks like the real unit"**. Every past device needed many correction rounds; this skill exists so you get it right the first time. Read `CLAUDE.md` first, then follow the phases in order. Supporting files: `look.md` (bezel/LCD techniques), `checks.md` (verification recipes), `scripts/` (CDP helpers).

## Hard rules (the user enforces these strictly)
- **The manual is the spec.** Implement procedures literally, step by step, no "convenient" shortcuts. Cite the § for every behavior.
- **No invented screen text.** Anything on the display that is not in a manual figure or a photo of the unit is not shown. Where a screen must show something undocumented, keep it minimal and list it in `ASSUMPTIONS.md`.
- **Add nothing that wasn't asked for**: no helper buttons, markers, keyboard shortcuts, duplicated status, decorative sounds, explanatory toasts. Offer an idea in one line instead.
- **Real data only.** Frequencies/navaids from the Czech AIP (aim.rlp.cz) via `sim/data/lk.js` / `lk-nav.js`; never from memory.
- **A unit with a photocell gets the Cockpit light slider** (like every other unit with one), driving its documented lighting behavior.
- **Every control and every panel label gets a `title` tooltip** that explains it in plain words (bezel parts worded from the manual).
- **Assumptions are written down**, not hidden: `ASSUMPTIONS.md`, a section per device, one `- [ ]` item each with Sim / source / Real.
- The user does the visual testing in the browser, **but you compare against the reference photos yourself before handing over** (`checks.md`). Never claim a look matches without having viewed a side-by-side.
- `rm` is aliased interactive: use `rm -f`. Scratch output goes to the scratchpad, never the repo.

## Phase 1 — Sources (no code yet)
1. Locate the manual(s) the user gave (often in the repo root). Copy them into `sim/manuals/<model>-<kind>.pdf`. Record the URL each one was downloaded from in `sim/data/manuals.js` (check it with `sha256sum`; the user's Firefox download history has it if they don't know), and give every manual link `data-manual="<model>-<kind>"`.
2. Text: `nix shell nixpkgs#poppler-utils -c pdftotext -layout file.pdf <scratch>/x.txt`. Booklet PDFs may be imposed two pages per sheet and rotated: read the text carefully, page numbers can be interleaved.
3. **View every page as an image** (`pdftoppm -r 110 -png`, then Read each PNG). Screen figures are often raster images whose text never reaches pdftotext. Extract figures with `pdfimages -png` and zoom (`magick … -crop … -scale 300%`) to read small display text. This is your OCR; `tesseract` only as a helper.
4. Find what the user's PDF lacks: the **installation manual** (setup menus, defaults, exact message texts, connector features), other issues of the same manual, sibling/newer models. Launch a research subagent with an explicit numbered question list; demand verbatim quotes + URL + document issue; downloads go to the scratchpad. Newer-model facts are hints only: mark them as such.
5. Ask the user for **photos of the real unit**: unlit front, lit display, close-ups (display, knobs, screws/corners). Keep the paths; they are the visual reference.
6. Re-check: for every behavior you are about to call an assumption, look whether a procedure's step sequence or an installation-manual figure already decides it.

## Phase 2 — Plan (plan mode)
- Write the plan: Context, Look (from photos), Behavior per manual section with § refs and ⚑ for anything not stated, Code (which shared modules), Tests, Docs, Verification.
- Ask only genuine choices with AskUserQuestion (e.g. how a two-key combo is pressed with a mouse, preloaded data, how much of an optional feature to simulate). Recommend an option.

## Phase 3 — Build (reuse first)
- **Device class** `sim/devices/<model>/device.js`:
  - A VHF COM / NAV-COM in the Garmin family: subclass `ComRadio` (`com/com-radio.js`) with pages in `com/pages/`, bands in `com/band.js` / `nav/band.js`.
  - Anything else: a standalone class with the same shape as `devices/tt31/device.js` / `devices/ar6201/device.js`: `constructor({ now, storage })`, `input(evt, arg)`, `tick()`, `view()`, `audio()`, `save()`, `factoryReset()`, `PERSIST_KEY`. Time only via `this.now()` so tests can drive it.
  - Long/short presses: bind keys as holds (`down:KEY` / `up:KEY`) and let the device time them in `tick()` (see AR6201 `held`, `LONG_MS`).
  - Constants with a comment naming their source or "(not stated)".
- **Shared code to use, not copy:** `core/freq.js` (COM channel math, 8.33), `core/util.js` (`clamp`, `wrap`, `S()`), `core/persist.js` (`makeStore`), `core/time.js` (Stopwatch), `core/text.js`, `ui/controls.js` (`bindControls`: encoders, `innerPush`, pots with `angle` / `dragPx` / `wheelSteps`, holds, `latch` for two-key combinations with a mouse; `fitBezel`), `ui/audio.js` (`createAudio` with the `audio()` contract `src: off|quiet|static|act|stb|tx`, `call`, `quality`; optional `alertAudio()`, `beepAudio()`, `navAudio()`; a unit that mixes several sources, like the KMA 20 audio panel, has its own `sound.js` and reuses the exported `MORSE` / `scheduleMorse`), `ui/lcd.js` (`createLcd`; add a view type; a big one gets its own `ui/lcd-<x>.js`, like `lcd-becker.js`; a dot-matrix LCD gets a canvas renderer like `lcd-gtx.js`), `data/lk.js` for frequencies. Extend shared modules with optional, backwards-compatible options; run all tests after.
- **Page** `devices/<model>/index.html` + `<model>.css` + `main.js` + `info.js`, copying the structure of an existing device page: header (back link, title, source line, mouse hint), bezel, status bar, panel cards (simulation inputs only: pilot/yoke, traffic & audio, aircraft & faults/installation), manual buttons (`<nav class="manuals">` as the last child of `unit-col`, links with `data-manual`; `main.js` imports `../../ui/manuals.js`), Procedures cheat-sheet worded from the manual.
- **Look:** follow `look.md` exactly (measure from the photo, light from top-left, glare/shadow rules, fonts, LCD digit slots, cross-fades, power fades).
- **Landing:** add a card to `sim/index.html` (preview, one-line description, Open simulator; no manual buttons) and capture `sim/previews/<model>.png` and `.webp` (`scripts/preview.mjs`; the landing page uses the WebP).

## Phase 4 — Verify (see `checks.md`)
- `npm run lint` clean and `npm test` (or `cd sim && node --test`): all suites green, including the new `test/manual-<model>.test.mjs` that replays **every numbered procedure literally, one input per step, on a unit used elsewhere first** (copy the pattern of `test/manual-tt31.test.mjs` / `manual-ar6201.test.mjs`).
- `scripts/lcd-check.mjs`: walk every mode/menu/setup page; no JS exceptions, no LCD overflow.
- Side-by-side screenshots vs the user's photos (whole bezel + zoomed details) — view them and fix differences before reporting. Measure positions (`scripts/measure.mjs`) instead of guessing.
- Recapture the preview; landing and manual links return 200.

## Phase 5 — Docs and report
- `ASSUMPTIONS.md`: a section for the device (sources listed, every ⚑ as a checkbox item).
- `CLAUDE.md`: the device in the intro list (source of truth), its files in Layout, tests list.
- Report to the user: what was built, the assumptions that matter, open questions — concise. Don't claim visual parity; ask them to look.

## While the user reviews
Expect many small visual corrections. For each: change one thing, re-render, compare with the photo, then answer. When they point out a value (angle, step size, duration), update `ASSUMPTIONS.md` too. Never revert to an earlier mistake to fix a new one (e.g. don't brighten the whole face to fix one dark corner).
