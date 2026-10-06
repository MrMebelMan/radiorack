# RadioRack

A local web app with simulators of avionics units (Garmin, Trig, Becker, King, Bendix/King), so the owner can practice operating them outside the cockpit.
- Landing page: `sim/index.html`, one card per simulator; the whole card is the link to it.
- **GTR 225A** (VHF COM): source of truth `sim/manuals/gtr225-pilots-guide.pdf` (190-01182-00 Rev D, SW v2.10; same file as `GTR225.pdf`).
- **GNC 255A** (NAV/COM): source of truth `sim/manuals/gnc255-pilots-guide.pdf` (190-01182-01 Rev E).
- **Trig TT31** (Mode S transponder): source of truth `sim/manuals/tt31-operating-manual.pdf` (00454-00-AF, same file as `XPDR TT31 Operating Handbook.pdf`) and `tt31-installation-manual.pdf` (00455-00-AR). Its screens are copied from user photos of the real unit (boot, main, FLIGHT TIME, TIMER, ALTITUDE MONITOR, squawk entry).
- **Garmin GTX 328** (Mode S transponder): source of truth `sim/manuals/gtx328-pilots-guide.pdf` (190-00420-03 Rev A, SW 5.00), `gtx328-installation-manual.pdf` (190-00420-04 Rev C: the configuration pages, every figure at the LCD's native 200 x 33 dots) and `gtx328-maintenance-manual.pdf` (190-00420-05 Rev A). The bezel is laid out from a GTX 327 shop photo (same front panel).
- **King KMA 20 TSO** (audio panel with marker beacon receiver, version 066-1024-03 with AUTO): source of truth `sim/manuals/kma20-operating-guide.pdf` (brochure 006-8200-05, same file as `KMA_20_audio_panel.pdf`) and `kma20-installation-manual.pdf` (KMA 20/KR 21 IM 006-0044-02 Rev 2: operation §3, pinout per version Fig 2-8). The bezel is laid out from a user photo of a real unit (unlit).
- **Bendix/King KN 64** (DME, 066-1088-00 black face plate): source of truth `sim/manuals/kn64-pilots-guide.pdf` (Silver Crown Plus Pilot's Guide R4, KN 62A/KN 64 pp. 25-26; same file as `DME KN 64.pdf`, which also has the KR 87 and KT 76C pages) and `kn64-installation-manual.pdf` (KN 62/62A/64 IM 006-00144-0007 Rev 7: specs 1.3, operation 3.1, Fig 2-13 outline). The bezel is laid out from a user photo of an unlit unit; display colors from photos of lit units.
- **Becker AR6201** (57 mm VHF COM): source of truth `sim/manuals/ar6201-operating-instructions.pdf` (Issue 5 2013, same file as `AR6201_OI.pdf`) and `ar6201-installation-manual.pdf` (DV 14300.03 Issue 5, has the Installation Setup). Gaps filled from the newer AR620X family manual are listed in ASSUMPTIONS.md. The bezel is laid out from user photos of a real unit (unlit and lit).

## Run / test
- Serve: `python3 sim/serve.py` → http://localhost:8225. It sends no-cache headers, so a normal reload picks up edits. ES modules don't load over `file://`.
- Test: `npm test` (or `cd sim && node --test`) runs `sim/test/*.test.mjs` headless, against the device classes.
- Lint: `npm run lint` (Biome, config `biome.json`, formatter off). On NixOS the npm binary doesn't run: `BIOME_BINARY=$(nix shell nixpkgs#biome -c sh -c 'readlink -f $(which biome)') npm run lint`.
- Deploy: GitHub Actions `.github/workflows/ci.yml` lints and tests, then `wrangler deploy` (`wrangler.jsonc`, Cloudflare Workers static assets serving `sim/`) on master. The domain radiorack.dr1v3.cz is attached to the Worker in the Cloudflare dashboard, not in `wrangler.jsonc`, so the deploy token has no DNS access. Not served: `sim/.assetsignore`. Headers: `sim/_headers`. Setup in README "Deploying".
- The PDF can be read with poppler via nix: `nix shell nixpkgs#poppler-utils -c pdftotext -layout GTR225.pdf out.txt`. Write output to the scratchpad, not the repo.
- The user does the visual testing in the browser. Don't take screenshots for that unless asked. Functional checks over CDP (e.g. reading the LCD text) are fine.
- In this shell `rm` is aliased to prompt for confirmation. Use `rm -f`.

## Layout (`sim/`)
Plain ES modules with no build step. The layers depend downward only: `devices` → `com` / `nav` / `ui` → `core`.
- `og/<page>.jpg`: link-preview images (1200 x 630, the unit's preview with its name), rendered by `.claude/skills/add-device/scripts/og.mjs` (page list `PAGES` there). Every page's `<head>` has `<meta name="description">` and the Open Graph / Twitter tags with absolute `https://radiorack.dr1v3.cz/` URLs; `test/og.test.mjs` checks them.
- `config.js`: site settings (`SELF_HOST_MANUALS`). `_headers` and `.assetsignore`: deploy-only (see Run / test).
- Navbar and languages: every page starts with `<nav class="topbar">` (`shared/topbar.css`): the back button to the landing page (device pages) or the RadioRack title (landing page) on the left, the language picker (flags from `flags/`, flag-icons with the official colors, see `flags/README.md`) on the right.
  - The web UI is in English (EN), Ukrainian (UA, code `uk`), Czech (CS) and Slovak (SK). The units are never translated: LCD, bezel labels, key names, system messages and manual names stay English; bezel tooltips are translated.
  - English is the page HTML. Translatable elements carry `data-i18n="key"` (text), `data-i18n-html` (markup with `<b>`, `<small>`), `data-i18n-title` / `-aria` / `-alt`. Keys are `<page>.<slug>` (`tip.` for tooltips), or `common.<slug>` for texts on several pages. Elements with `translate="no"` are skipped.
  - Strings built in JS go through `t(key, vars)` from `ui/i18n.js`; their English is in `i18n/en.js`. `onLang(fn)` reruns `fn` after a language change (value labels, SVG tooltips, manual notes).
  - Translations: `i18n/<uk|cs|sk>/common.js` (`common.*` and JS keys without a page prefix) and `i18n/<lang>/<page>.js` (`<page>.*`); only the visitor's language and page are loaded. `ui/i18n-boot.js` (classic script in `<head>`) picks the language (localStorage `radiorack.lang`, else `navigator.languages`, else English) and hides the body until the page is translated.
  - `test/i18n.test.mjs` checks every key in every language, no unused keys, matching `<b>` markup and `{placeholders}`, and the navbar on every page.
- `index.html` plus `shared/landing.css`: the landing page. `previews/*.png` are powered-on bezel screenshots, captured with headless Chrome, for the README; the landing page uses the `previews/*.webp` copies (quality 85, about 7x smaller), and only those are deployed.
- `shared/style.css`: the page shell, panels, LCD and base bezel. The LCD uses the bundled pixel font `fonts/jersey15.woff2` (OFL).
- `core/`: device-independent helpers.
  - `util.js` (range/wrap/clamp, the `S()` display segment)
  - `freq.js` (COM channel math)
  - `nav.js` (bearings, radial/bearing TO, VOR CDI, dead-reckoning step, `FLIGHT_VAR` for simulated flights)
  - `text.js`, `time.js`, `geo.js`, `persist.js`
- `com/`: the COM transceiver shared by all units.
  - `com-radio.js` holds `ComRadio`:
    - power, bus and switch; TX/RX and monitor priority; holds, emergency and lock; stuck mic; messages; timers;
    - `input()`, `tick()` and `view()`;
    - band-aware setters (`setActive` / `setStandby` / `swap(band)`), plus `mainBand()` / `goMain()`.
  - `band.js` (`COM_BAND`).
  - `garmin-defs.js`: the messages, ICS/SYS settings and COM defaults shared by GTR and GNC.
  - `database.js`.
  - `pages/*.js`: one module per screen, each `{ handlers, render, tick? }`. They're called with `this` = the radio and keyed by `page.id`. The lists, user-edit, database look-up and main page read `p.band`, so COM and NAV share them.
- `nav/`: the NAV (VLOC) side.
  - `band.js` (`NAV_BAND`: 108.00–117.95 in 50 kHz, 2 decimals, 3 on the NAV DATABASE page, NAV types)
  - `nav-database.js` (VOR/DME/ILS look-up, reverse look-up, nearest VOR)
  - `obs-page.js` (OBS/CDI)
- `devices/<model>/`:
  - `index.html` (bezel, panels, procedures)
  - `device.js` (subclass of `ComRadio`: menu, keys, messages, defaults, `PERSIST_KEY`)
  - `info.js`
  - `main.js` (wires `ui/*`)
  - optional bezel CSS
  - `gnc255/device.js` adds the NAV state, C/N / OBS / T/F keys, NAV VOL/ID knob, CDI, DST row, flight simulation (`livePos`, ground speed/track) and Morse ident (`navAudio()`).
- `ui/`:
  - `lcd.js` (view → LCD HTML; segments: inv/ul/big/tiny, `stack`, `cdi`, `bar`; full-width message screen; big digits in fixed slots so values never shift; `photo` in a view sets the backlight from the cockpit light)
  - `lcd-seg7.js` (KN 64 `seg7` view: SVG seven-segment gas discharge display)
  - `lcd-becker.js` (AR6201 `bk` view), `lcd-gtx.js` + `fonts-gtx.js` (GTX 328 `gtx` view: 200 x 33 dot matrix on a canvas, bitmap fonts from the manual figures)
  - `controls.js` (the COM pot, further `pots`, optional encoders, keys, hold buttons, `latch`: right-click keeps a hold key pressed, keyboard; `fitBezel` scales to the small viewport height `100svh`, so a mobile address bar sliding in and out doesn't resize the bezel, and on screens under 500 px tall lets it use the height below the header; the bezel stays hidden until the first fit adds `.fitted` to the wrap)
  - `audio.js` (static, incoming-call clips, NAV Morse; exports `MORSE` / `scheduleMorse` for units with their own mixer)
  - `panel.js` (status line, yoke/simulation panels, Flight block when present, cockpit light slider and key lighting; `ambWord`)
  - `manuals.js` (manual link targets, see `manuals/` below)
- `data/lk.js` (COM frequencies, positions, DB info) and `data/lk-nav.js` (VOR/DME/ILS from ENR 4.1 / AD 2.19; `NDBS` and the marker `APPROACHES` from AD 2.19 / AD 2.12; every navaid has `dme: { lat, lon, elev }`, its DME antenna from ENR 4.1 / AD 2.19).
- `manuals/`: the source-of-truth PDFs of every unit (see the list at the top; the GTR/GNC TSO Installation Manual 190-01182-02 Rev L is a public copy with highlights, Garmin doesn't publish it), linked from the simulator pages.
  - The manual links are only on the device pages, in `<nav class="manuals">` at the end of the page `<header>`, under the description lines and above the bezel; in the one-column layout (≤ 1000 px, phones) `ui/manuals.js` moves it to the top of `.help-col`, right above Procedures; the landing page has none.
  - Every manual link is `<a data-manual="<id>" href="…manuals/<id>.pdf">`. `ui/manuals.js` (imported by each `main.js`) points it at `manuals/<id>.pdf` or at the public source in `data/manuals.js`, per `SELF_HOST_MANUALS` in `config.js` (`true` in the repo; the deploy job sets it to `false` and leaves `manuals/` out unless the repo variable `SELF_HOST_MANUALS` is `true`).
  - `data/manuals.js` holds the URL each PDF was downloaded from, checked byte-identical. A new manual gets an entry there; `test/manuals.test.mjs` checks every link, PDF and source.
- `test/gtr225.test.mjs`, `test/gnc255.test.mjs` (unit/feature tests), `test/manual-gtr225.test.mjs`, `test/manual-gnc255.test.mjs`, `test/manual-tt31.test.mjs`, `test/manual-ar6201.test.mjs`, `test/manual-gtx328.test.mjs`, `test/gtx328.test.mjs`, `test/manual-kma20.test.mjs`, `test/kma20.test.mjs`, `test/manual-kn64.test.mjs`, `test/kn64.test.mjs` (literal manual procedure replays), `test/manuals.test.mjs` (manual links), `test/og.test.mjs` (link-preview tags), `test/i18n.test.mjs` (translations, navbar).
- `devices/ar6201/`: standalone `AR6201` class (`device.js`), Installation Setup page table (`setup.js`), preloaded AIP channels (`channels.js`). LCD view type `bk` rendered by `ui/lcd-becker.js` (positive LCD theme `.lcd.pos`, font Barlow Semi Condensed in `fonts/`, OFL). Keys are bound as holds (`down:KEY` / `up:KEY`); the device times short / long (2 s) presses.
- `devices/gtx328/`: standalone `GTX328` class (`device.js`), configuration page table with every position copied from the IM figures (`config.js`), `sound.js` (490 Hz tone, voice clips `sounds/gtx328/{male,female}-{leaving-altitude,timer-expired}.mp3`, supplied by the owner). The LCD is a real 200 x 33 dot matrix on a canvas: `ui/lcd-gtx.js` (view type `gtx`: a list of draw ops in dot coordinates; `gtxBitmap()` is pure and used by the tests) with bitmap fonts in `ui/fonts-gtx.js` (glyphs extracted from the manual figures; designed ones listed in `DESIGNED`). Keys are holds; right-click latches a key (`latch` in `bindControls`) for FUNC + ON.
- `devices/kma20/`: standalone `KMA20` class (`device.js`: toggles, mic selector, `routes()` speaker / phone / EXT / muting, marker reception and keying on an AD 2.19 approach, lamps) and `sound.js` (Web Audio: each receiver input feeds a speaker bus and a phone bus; COM clips, Morse idents via the exported `scheduleMorse` of `ui/audio.js`, marker tones keyed on the unit's clock). No display; the bezel toggles are bound in `main.js` (mouse: press upper / lower half, wheel; touch: swipe up / down one position per 14 px or tap a half, `touch-action: none`; MKR TEST held).
- `devices/kn64/`: standalone `KN64` class (`device.js`: function switch, concentric knobs with pull, GS/T hold and power-on search, search / lock / memory, slant range, ground speed and time-to-station from a simulated flight to the DME antennas in `lk-nav.js`) and `sound.js` (Morse ident while locked). The display is the SVG seven-segment renderer `ui/lcd-seg7.js` (view type `seg7`: fixed digit slots, decimal points, printed annunciators; unlit segments stay visible through the glass).
- Cockpit light: units with a photocell (GTR, GNC, TT31, GTX, KMA 20, KN 64) have a "Cockpit light" slider; the AR6201 has none.
- `devices/tt31/`: standalone `TT31` class (not a `ComRadio`, same `input` / `tick` / `view` shape). The LCD view type is `xpdr` (amber theme `.lcd.amber`). It has its own small panel binding in `main.js`.
- Adding a device: create `devices/<name>/` (class, page with `<body data-page="<name>">` and the navbar, `main.js`), add a card and preview to the landing page, add `i18n/<lang>/<name>.js` for each language, and add tests, including a manual replay suite.
  Use the project skill `.claude/skills/add-device/` (`/add-device`): the full workflow, the look techniques (`look.md`) and the CDP check scripts (`checks.md`, `scripts/`).

## Manual errata / gaps (GNC 255)
- §2.2.1 gives the NAV MHz range as 118–136; §1.1 says 108–117.95. The simulator uses §1.1.
- The NAV user-list screenshots are titled "NAV RECENT FREQS". This is copied as shown.
- Nearest VOR: the text says ENT/CLR, but the screenshot shows `⇄=ACT`, so flip is allowed.
- Simulator assumptions, not from the manual:
  - OBS key again (or C/N) leaves the OBS page.
  - T/F cycles off → TO → FROM → off.
  - OBS steps: outer knob 10°, inner knob 1°.
  - VOR/LOC usable within 150 NM.
  - LOC full scale ±2.5°.
  - Flight track is converted with 5°E variation.
  - MON works only in COM mode.

## Rules
- **Follow the manual exactly.** Implement the manual's step sequences literally, with no "convenient" shortcuts. Where the manual is silent or contradicts itself, say so and ask; don't guess quietly. The simulators are for practicing the real unit, so any deviation trains a wrong habit for the cockpit (e.g. ENT jumping to the next field when the manual says to turn the outer knob).
- **The procedure steps are the spec.** `test/manual-*.test.mjs` replay every numbered procedure of both Pilot's Guides literally, one input per step, on a radio used elsewhere first. Any behavior change must keep them green. Before calling something an assumption, check whether a procedure's step sequence already decides it.
- **No invented screen text.** Anything on the display that isn't in a manual screenshot or a photo of the unit is removed, not guessed. Assumptions go in `ASSUMPTIONS.md` for checking on a real unit.
- **Don't add anything that wasn't asked for.** That covers UI helpers, extra controls, decorations, duplicated status, keyboard shortcuts, knob position markers and sounds. Offer the idea in one line instead.
- **Frequencies must be real.** Check them against the Czech AIP at aim.rlp.cz (eAIP AD 2.18, VFR Manual, ENR 2.1, GEN 3.5), never from memory. They are stored in kHz using 8.33 channel names (120.335 → `120335`). The current data was verified for AIRAC 01 OCT 2026.
- Saved state lives in localStorage under `PERSIST_KEY` in `devices/gtr225/device.js`. Bump it when the defaults change in a way that old saved state would hide.
- **American English** in all text (UI, docs, comments): color, center, behavior, gray, practice, labeled. Quotes from manuals stay verbatim.
- **Every new or changed web UI text gets its `data-i18n*` key (or `t()` key in `i18n/en.js`) and the Ukrainian, Czech and Slovak translation** in the same change. Key names (`<b>ENT</b>`), screen text, frequencies and manual section numbers stay as they are in the translations. Ukrainian: "натисніть" for clicks (use "клацніть" sparingly).
- MON and squelch override are operating states. They reset at every power-up. Frequencies, lists and ICS/SYS settings persist.

## Commits
- The owner commits. Don't run `git add` / `git commit` yourself.
- When asked for a commit message (`/commit-msg`), give **one message per distinct change**, e.g. a `docs:` one and a `feat:` one, never one message covering both. One-line conventional commits, no emojis, no co-author line.
- With each message, give a copy-paste command that stages only that change's files:
  ```
  git add README.md && git commit -m "docs: ..."
  git add sim/devices/gnc255/device.js sim/test/gnc255.test.mjs && git commit -m "feat: ..."
  ```
  Check `git status` first so the file lists are exact, and leave out untracked files that aren't part of the change (e.g. the manual PDFs in the repo root).
