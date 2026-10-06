# Assumptions to verify on a real unit

This file covers everything the simulators do that the Pilot's Guides **don't specify, only imply, or contradict**. Check each item on a real radio, tick it, and note what the real unit does if it differs.

- GTR 225: Pilot's Guide 190-01182-00 Rev D (SW 2.10), `sim/manuals/gtr225-pilots-guide.pdf`
- GNC 255: Pilot's Guide 190-01182-01 Rev E, `sim/manuals/gnc255-pilots-guide.pdf`
- Both: TSO Installation Manual 190-01182-02 Rev L, `sim/manuals/gtr225-gnc255-installation-manual.pdf`
- Trig TT31, Garmin GTX 328, Becker AR6201, King KMA 20 and Bendix/King KN 64: see their sections.

**Rule:** screen text that isn't in a manual screenshot or photo has been **removed**. Where a screen has to show *something* but its look is undocumented, it is kept to the bare minimum and listed here.

Legend: **Sim:** what the simulator does now · **Why:** where it comes from · **Real:** fill in.

---

## 1. Both radios (shared COM side)

### Power and start-up
- [ ] **Start-up screen.** Sim: "GARMIN" for 1.25 s, then "CYCLE: …" / "EFCTV: …" for 1.25 s. Why: the Installation Manual says "Garmin" appears (§6.4) and the database information is displayed during the start-up sequence (§6.6.4.4); the layout, wording and timing aren't shown. The software version is not shown at start-up (not documented). Real:
- [ ] **What survives a power cycle.**
  - Restored: active/standby frequencies, recent and user lists, all ICS/SYS settings, count-down start value, DB cycle.
  - Reset: both timers, MON (off), squelch override (off), 121.5 lock (cleared), pending messages.
  - The 121.5 lock reset is documented (troubleshooting table: "cycle the avionics power"); the rest is assumed.

  Why: the manual only implies that user/recent lists are stored; the lock reset comes from the troubleshooting table. Real:
- [ ] **Aircraft power loss.** Sim: POWER ALERT, then shutdown after 10 s unless power returns. If the PWR knob is still on when power returns, the unit boots by itself. Why: the message text only says "if power is not restored immediately". Real:
- [ ] **Volume knob.** Sim: steps of 5 %, 0 % at −135° and 100 % at +135° of knob travel, OFF just below 0. The COM VOL bar graph shows for about 2 s after the last turn. Why: not specified. Real:
- [ ] **PUSH SQ held about 2 s tunes 121.5** (like holding flip/flop). Why: only in the message table ("press and hold the volume knob … force the COM radio to 121.5"). Real:

### COM tuning and display
- [ ] **8.33 mode steps.** Sim: the inner knob steps through the 25 kHz names too (x.000, x.005, x.010, x.015, x.025 …). It wraps inside the MHz with no carry; the outer knob wraps 118 ↔ 136. Real:
- [ ] **Switching 8.33 → 25 kHz.** Sim: active/standby snap down to the 25 kHz channel. 8.33-only frequencies are removed from user **and recent** lists, with no notice on screen. Why: the manual note mentions only user freqs; the front note says recent are lost too. Real:
- [ ] **Annunciator priority.** Sim: TX over RX over SQ (one shows at a time, top-left). Real:
- [ ] **Bottom line without GPS.** Sim: "COM ACTIVE" / "COM STANDBY". With GPS: the nearest facility using the frequency within 200 NM, "*" when that facility has several types on it. Real:
- [ ] **Flip / set active during TX or while locked.** Sim: silently ignored (no on-screen notice). Real:
- [ ] **Emergency hint.** Sim: "HOLD FOR EMERGENCY COM FREQUENCY" shows after holding flip/flop for 0.3 s, and stays 2.5 s after 121.5 is set. Why: the manual screenshot shows the text but not its timing. Real:
- [ ] **Recent list.** Sim: a frequency is added when it becomes active (flip, emergency, or set active from a list), duplicates removed, newest first, max 20. Real:

### Remote (yoke) inputs
- [ ] **COM RMT XFR.** Sim: tap = flip; hold 2 s = 121.5 **and** lock (hold again 2 s to unlock). Why: the manual says the lock applies "on units so configured". Real (installation-dependent):
- [ ] **COM CHAN UP / DN.** Sim: step the standby frequency by one channel. Why: these switches are named only in the message table. Real:
- [ ] **Remote ICS switch.** Sim: toggles the intercom, nothing shown on screen. Real:
- [ ] **Stuck mic timing.** Sim: "REMOTE KEY STUCK" message at 30 s, transmitting stops at 35 s ("STUCK MIC" until released). Why: §2.6 says 35 s, §5.1 says 30 s. Real:
- [ ] **COM RMT XFR held 30 s** raises "REMOTE KEY STUCK – COM remote transfer key". Real:

### Messages
- [ ] **Message screen.** Sim: text only (category prefix like "REMOTE KEY STUCK -" dropped), centered, wrapped to 2 lines if long, "ENT=ACCEPT" bottom-left. Why: the screenshot shows one short message. Real (long ones, e.g. COM LOCKED):
- [ ] **Keys while a message shows.** Sim: only ENT (acknowledge) works among the bezel keys; flip/flop, PTT, volume, MON keep working. Real:

### Lists and database (FUNC)
- [ ] **FUNC menu screen.** Sim, from two photos of a GNC 255:
  - one line per category, four visible;
  - choosing the category (outer knob) inverts only its short name ("ICS CONFIGURATION");
  - the first inner-knob click then shows the first item in place of the title, inverted ("NAV USER FREQS").

  Assumed:
  - the GTR 225 looks the same;
  - the list scrolls only when the active line would leave the window (with ICS active it still starts at COM, as in the photo);
  - ENT does nothing until an item is shown.

  From the procedures (not an assumption): FUNC always opens at COM FREQUENCY LIST with no item, since every procedure starts "Press FUNC. Turn the inner knob to …" (COM items) or "Turn the outer knob to … CONFIGURATION".

  Real:
- [ ] **ENT / flip in a list stays on the list.** CLR returns to the functions display. Why: inferred from the procedures, which list CLR as the way out. Real:
- [ ] **DB look-up from the COM page returns to the COM page** after ENT/flip. Why: §2.4 step 7 implies it. Real:
- [ ] **DB look-up details.**
  - Auto-completes from the characters up to the cursor.
  - Pressing PUSH CRSR again cancels back to the COM page.
  - Outer knob counter-clockwise on the type screen returns to the identifier.
  - Unknown ident: ENT does nothing.
  - The last look-up (ident + type) is offered again for 30 min.

  Real:
- [ ] **Adding a user frequency from FUNC → USER FREQS.** Sim: not possible (only view / edit / delete); save from the COM page. Why: the manual says saving is possible "from the COM User Function" but not how. Real:
- [ ] **User list full.** Sim: ENT does nothing (no notice). Real:
- [ ] **Empty list** (no recent, no user, no GPS for nearest). Sim: title only, blank rows. Real:
- [ ] **NEAREST lists.**
  - NEAREST APT lists airports; ENT shows that airport's frequencies (with GPS).
  - WX includes airport ATIS/AWOS.

  Real:

### Settings
- [ ] **Step sizes.** Sim: intercom VOL and AUX VOL in steps of 1 (observed by the owner); intercom SQ still in steps of 5 (unverified); sidetone offset, brightness and contrast in steps of 1. Real (SQ):
- [ ] **Brightness / contrast preview live** while turning; CLR restores, ENT keeps. Why: the manual only says ENT saves / CLR cancels. Real:
- [ ] **DSPL BRT readout.** Sim: BRIGHTNESS = offset (never below 0). Why: fitted to the only screenshot (OFFSET 25 → BRIGHTNESS 25); the real value likely depends on the photocell. Real:
- [ ] **FUNC on DATABASE INFO / SOFTWARE VER / SERIAL NUMBER** goes back to the COM page. Why: the manual says "exit page" / "return to the main menu" (could mean the FUNC menu). Real:
- [ ] **Database update after the version page.** Sim: ENT loads instantly and returns to the menu (verify on DATABASE INFO); no progress screen. No drive: ENT does nothing. Corrupt drive / missing unlock file: the message is raised straight from the prompt. Why: the manual only says "wait until the updating process is complete". Real (what's shown while updating):

### Timers
- [ ] **ENT on the COM page with a running timer shown** opens "STOP TMR? ENT=STOP CLR=CANCEL" (so ENT does not open SAVE USER FREQ then). Why: from "press ENT twice to stop". Real:
- [ ] **CLR then ENT resets the displayed timer** with nothing shown in between. Why: the manual says "CLR and then ENT" but shows only the STOP prompt. Real (what CLR shows):
- [ ] **Which timer is shown.** Sim: a running count-down; else a running count-up; else a stopped count-down that isn't at its start; else a stopped count-up that isn't zero. Why: the manual only covers running timers. Real:
- [ ] **Count-down editing** starts with the cursor on minutes; hours 0–23. Real:
- [ ] **Timer pages** show only the title, the time and the key hints (as in the screenshots). Real:

---

## 2. GTR 225 only
- [ ] **ICS key order.** Sim: Adjust Intercom → AUX Audio → Intercom On/Off → COM page. Adjust Intercom is skipped when the intercom is off. Why: §1.2 lists them in a different order; §3.3.1 starts with "Press ICS" → Adjust Intercom. Real:
- [ ] **MEM key.** Sim: first press = recent list; each further press toggles recent ↔ user. Real:
- [ ] **Adjust Intercom with the intercom OFF.** Sim: ENT on the menu item does nothing. Why: the manual only says it is "not available". Real (both radios):

---

## 3. GNC 255 only

### Manual errata (sim follows the more plausible reading)
- [ ] **NAV frequency range.** Sim: 108.00–117.95 MHz. Why: §2.2.1 says "118 to 136" (copy of the COM text); §1.1 says 108–117.95. Real:
- [ ] **NAV user-list title.** Sim: "NAV RECENT FREQS", as in the manual's §3.3.2 screenshots (probably a reused image). Real:
- [ ] **Nearest VOR flip/flop.** Sim: ⇄ sets active. Why: the text lists only ENT/CLR, but the screenshot shows "⇄=ACT". Real:

### NAV radio
- [ ] **NAV tuning.** Sim: inner knob 50 kHz steps wrapping inside the MHz; outer knob wraps 108 ↔ 117. Two decimals on the main page, three on the NAV DATABASE page (as in the screenshots). Real:
- [ ] **Annunciators on NAV displays.** Sim: only "ID" (when ident is on); SQ/TX/RX are not shown on NAV displays. Real:
- [ ] **ID toggle** works only while the NAV display is active (C/N in NAV). Real:
- [ ] **NAV volume.** Sim: steps of 5 %, no power detent; knob travel shown −135°…+135°. Real:
- [ ] **Morse ident audio.** Sim: 1020 Hz, about 10 words per minute, repeated every 8 s while the station is received and ID is on. Real:
- [ ] **MON key in NAV mode.** Sim: does nothing (monitoring is a COM function, but it stays on when switching to NAV, as the manual says). Real:
- [ ] **Power-up state (GNC).** Sim: starts in COM mode with T/F (DST row) off and NAV ID off; NAV frequencies, lists, OBS and NAV volume are kept. Real:
- [ ] **C/N** always goes to the main page of the selected radio; FUNC (exit) returns to the main page of the current radio. Real:
- [ ] **Holding flip/flop 2 s in NAV mode** sets 121.5 on COM and switches to COM mode. Real:
- [ ] **NAV RMT XFR.** Sim: tap swaps the NAV frequencies; no 2 s function; held 30 s → "REMOTE KEY STUCK – NAV remote transfer key". Real:
- [ ] **NAV database.** Sim: one entry per station (type = VOR, DME or ILS); ILS named like "LKPR RWY 24"; DME-only stations included but give no CDI/ident. Real:
- [ ] **Timers** shown bottom-right on the NAV page as on the COM page. Why: the manual says "COM/NAV displays". Real:

### OBS / CDI
- [ ] **Leaving the OBS page.** Sim: press OBS again (or C/N). Why: not specified. Real:
- [ ] **OBS knob steps.** Sim: outer knob 10°, inner knob 1°; shown 000–359. Why: the manual only says "the outer and inner knobs can be used". Real:
- [ ] **Decoded ident on the OBS page.** Sim: the station ident whenever the station is received; blank otherwise. Real:
- [ ] **CDI with no signal / DME-only.** Sim: dots only, no triangle, no needle. Real:
- [ ] **Localizer on the CDI.** Sim: "ident  LOC" instead of the OBS value and a circle at the center (both from a Garmin photo of the unit). Full scale ±2.5°, course from the database; LKKB ILS 24 has no published course, so no needle. Why: the deflection scale is not documented. Real:
- [ ] **Signal range.** Sim: VOR/LOC usable within 150 NM regardless of altitude. Real (altitude-dependent):

### T/F and DST
- [ ] **T/F cycle.** Sim: off → TO → FROM → off. While on, the DST row replaces the bottom line on the COM/NAV main page. Why: the manual doesn't say how DST is hidden. Real:
- [ ] **DST labels.** Sim: "TO/BRG" for bearing TO (from the screenshot); for radial FROM the value is shown with no label (none documented). Real (FROM label):
- [ ] **DST without data** (no GPS, nothing within 200 NM): dashes. Real:
- [ ] **Ground speed / time format.** Sim: GS in whole knots (0 while the simulated aircraft is paused); time to station "h:mm", "-:--" when GS is 0. Real:
- [ ] **COM VOL line** shows "NV ACT" + active NAV frequency at the right (from the §1.2 screenshot); the sim shows it on every volume change. Real:

---

- [ ] **Bezel layout** scaled from Garmin's front-view render (labels beside the knobs, 880×228). Real:

## 4. Trig TT31 transponder
Sources:
- Operating Manual 00454-00-AF;
- Installation Manual 00455-00-AR;
- photos of a real unit: boot screen, main screen, FLIGHT TIME, TIMER, ALTITUDE MONITOR, squawk entry.

Everything below is **not** shown or stated there.

- [ ] **Altitude monitor threshold.** Sim: 250 ft, from Installation Manual AR (2017, SW 3.16) and AP (2014); the Operating Manual and the 2009/2012 Installation Manuals say 200 ft. Real (SW 3.18):
- [ ] **Start-up screen duration.** Sim: 2 s. Real:
- [ ] **FUNC page order and exit.** Sim: FUNC steps FLIGHT TIME → TIMER → ADS-B monitor (only if installed) → ALTITUDE MONITOR → back to the main screen. Real (order; is there a timeout back to the main screen?):
- [ ] **ADS-B monitor page.** Sim: "ADS-B" / "MONITOR" + latitude / longitude (N50°07.88 / E014°31.54), dashes when the GPS position is invalid. Real:
- [ ] **BACK on FUNC pages.** Sim: does nothing there. Both manuals document BACK only as "goes back to the previous digit in the code selector" (and for configuration items). Real (does it step back a page or return to the main screen?):
- [ ] **IDENT indication.** Sim: "IDENT" next to the mode text for 18 s. Real (where, and does it flash?):
- [ ] **Reply indicator.** Shape from photos of the unit (bell on a thin base, two dimmer arrows above pointing inwards, top-center). Sim: lit for 180 ms about once a second while replying. Real (blink rate, or steady while replying?):
- [ ] **Display cross-fade.** Sim: when the display changes, the old frame fades out while the new one fades in, both over 150 ms (user observation; the duration is a guess). Real (duration):
- [ ] **ON mode altitude.** Sim: the flight level is still shown (only reporting is suppressed). Real:
- [ ] **Altitude monitor pointer.** Sim: ▲ / ▼ / ◆ next to the flight level (climb back / descend back / within limits). Real (shape):
- [ ] **Code entry details.**
  - BACK at the first digit does nothing.
  - The knob does nothing on FUNC pages.
  - Flight ID characters: blank, A–Z, 0–9.

  Real:
- [ ] **Warning texts and timing.** ADS-B: "WARNING – NO ADSB POSN" (Installation Manual §12.6), raised after about 2 s without valid GPS and cleared only by ENT, even once GPS is valid again (Trig support, quoted on vansairforce.net). Sim shows "WARNING" / "NO ADSB POSN" with ENT inverted. Antenna: "WARNING" / "CHECK ANTENNA" (text not documented). After ENT, a warning whose problem is still present reappears 10 s later (not documented). Real (antenna text, repeat timing, exact layout):
- [ ] **Fault text.** Sim: "FAULT" / "INTERNAL FAULT"; recoverable ones clear on switching off and on. Real:
- [ ] **Power-up resets.** Sim: flight timer and timer reset at power-up, and the altitude monitor stays as set. Real:
- [ ] **Default Flight ID.** Sim: "OKABC" placeholder (set by the installer as the aircraft registration). Real:
- [ ] **Configuration mode** (FUNC held while switching on) is not simulated; the installation options are switches in the Simulation panel.

## 4b. Garmin GTX 328 transponder
Sources:
- Pilot's Guide 190-00420-03 Rev A (`sim/manuals/gtx328-pilots-guide.pdf`), SW 5.00;
- Installation Manual 190-00420-04 Rev C (`sim/manuals/gtx328-installation-manual.pdf`): configuration pages, every page figure at the LCD's native 200 x 33 dots;
- Maintenance Manual 190-00420-05 Rev A (`sim/manuals/gtx328-maintenance-manual.pdf`): 200 x 33 LCD, 490 Hz audio test tone, GPS 35 kt airborne, photocell next to the 7 key;
- for gaps only: GTX 330 Pilot's Guide 190-00207-00 Rev G (same firmware family), marked GTX330;
- the bezel is laid out from a shop photo of a GTX 327 (same front panel, Maintenance Manual Table 6-2).

The display fonts are copied dot by dot from the manual figures. Glyphs that appear in no figure were drawn in the same style (list in `sim/ui/fonts-gtx.js`, `DESIGNED`): medium 4 7 9 -, bold J Q Z / > and the lowercase of "Garmin", annunciator O N S B Y G D I E R, small lowercase of the start-up page, code digits 0 1 2 3 6 and the dash, the trend arrows, °F and the meters unit.

Everything below is **not** stated in the three manuals.

- [ ] **Start-up page.** Sim: 3 s; layout of the three lines approximated from the Pilot's Guide render (not a native figure). Real:
- [ ] **Avionics master turn-on.** Sim: when wired, the unit switches on and off with the avionics master, in the last mode selected with the keys (not stated which mode). Real:
- [ ] **Hold STBY for GND.** Sim: 2 s. Real:
- [ ] **IDENT position and font.** Sim: "IDENT" in the mode-annunciator font above the mode, top left. IDENT is ignored in STBY. Real:
- [ ] **Reply symbol.** Sim: shown for 180 ms each second while replying in ON / ALT with radar coverage; not shown in GND. Real:
- [ ] **Code entry.** Sim: no timeout; while entering, the previous code stays active; CLR within 5 s shows the fourth digit as a dash. Real:
- [ ] **VFR Key Disabled advisory.** Sim: "VFR KEY" / "DISABLED" on the right half of the display. Real (wording, position):
- [ ] **PRESSURE ALT.** Sim: small trend arrow at |VS| ≥ VS RATE, large at ≥ 2 × VS RATE (arrow shapes drawn); no altitude source: dashes; meters with a small "m". Real:
- [ ] **ALT MONITOR page.** Sim: blank under the title while off; deviation rounded to 100 ft; GTX330: ABOVE / BELOW flashes over the limit until back within 100 ft, monitoring stops beyond 1000 ft + deviation. The voice / tone sounds once per excursion. Real:
- [ ] **COUNT DOWN entry.** Sim: CRSR, then six digits HHMMSS with a block cursor; CLR goes back a digit (on none it cancels); EXPIRED flashes 0.6 s on / 0.4 s off. Real:
- [ ] **CONTRAST / DISPLAY pages.** Sim: 8 / 9 step contrast by 5 (0–99) and backlight by 50 (0–999). Real:
- [ ] **Flight ID entry.** Sim: a key pressed repeatedly cycles digit first (5 → P → Q → R, derived from "R = 5 pressed four times"); typing from the whole-field cursor starts at the first character and keeps the rest; CRSR on a blank position goes to OK?. Real:
- [ ] **AUTO FLT TMR.** The text lists MAN / CLEAR / ACCUM; the SW 5.00 figure shows "AUTO FLT TMR? YES". Sim follows the figure (NO / YES); YES resets and starts the flight timer at every lift-off (CLEAR behavior). Real (which one, and how ACCUM is chosen):
- [ ] **Audio page values.** Sim: ALTITUDE MONITOR / COUNT DOWN TIMER show OFF / TONE / MSG (text: "Off, tone or message"); VOLUME bar 0–100 in steps of 5. The simulated installation has MSG / MSG and volume 50 (factory: OFF and 0). Real:
- [ ] **Attention tone.** Sim: 490 Hz for 0.4 s before each voice message; TONE mode plays only that. Real:
- [ ] **Configuration field editing.** Sim: CRSR highlights the first field and accepts it, moving to the next; numbers shift in from the right; BKLT LVL in MAN steps by 10 with 8 / 9. Real:
- [ ] **Lighting curves.** Sim: level = input × SLOPE/50 + (OFFSET − 50)/100, not below MIN; RSP TIME 0–7 sets an easing time of 0.15–1.9 s; DISPLAY MODE AUTO switches to positive above LEVEL on a 0–100 photocell scale; a lighting bus under 0.5 V counts as off (photocell). Real:
- [ ] **Diagnostics pages.** Sim: ANALOG INPUT counts are scaled guesses (LCD TEMP 512, UNIT TMP 540); RS232 and 429 RX pages show the figure's empty data. Real:
- [ ] **Automatic airborne determination.** Sim: squat switch (SQUAT SWITCH? YES) or GPS ground speed on a GPS input (< 35 kt = ground); SENSE is shown but not used; on the ground at power-up GND comes at once, after landing after DELAY TIME. Real:
- [ ] **Address and Flight ID defaults.** Sim installation: HEX 49D3A5, CONFIG ENTRY "OKABC". Real: the aircraft's.
- [ ] **Not simulated:** LOOPBACK STATE (test mode), ARINC 429 / RS-232 data, Comm-A / Comm-B, density altitude from an air data computer (Sim: from the probe OAT and pressure altitude, 120 ft per °C above ISA).

## 4c. Becker AR6201 transceiver
Sources:
- Operating Instructions AR6201-(X0X), Issue 5 / Nov 2013 (`sim/manuals/ar6201-operating-instructions.pdf`);
- Installation and Operation Manual DV 14300.03 Issue 5 (`sim/manuals/ar6201-installation-manual.pdf`), same software (CH 3.05 / CM 1.49);
- for gaps only: the newer AR620X family manual DV14307.03 Issue 05 (2016, SW 4.06 / 2.06), marked FAM;
- photos of a real unit (front, lit display).

Everything below is **not** stated in the two X0X manuals.

- [ ] **WAIT duration.** Sim: 3 s (FAM: "a few seconds"). Real:
- [ ] **FAILURE / PRESS ANY KEY.** Sim: any key continues to normal operation. Real:
- [ ] **Display inversion** ("inverted for a short time"). Sim: 300 ms. Real:
- [ ] **Frequency editing.**
  - Sim: a 4th push ends editing; no timeout.
  - The MHz field wraps 118–136; the 100 kHz and the 25/8.33 kHz fields wrap inside their block (no carry).
  - In 25 kHz mode the last field covers both decimals (figure "129.[00]") and steps 25 kHz through the MHz.
  - Turning without a field selected inverts the display (not allowed).

  Real:
- [ ] **Channel Mode selection.** Sim: the first clockwise turn only inverts the number (no step); turning steps through stored channels only and wraps; from CH-- the first stored channel is tuned. Real:
- [ ] **LAST database.** Sim: a frequency already in the list moves to LAST1 (no duplicates). Real:
- [ ] **STO page.** Sim: channel 1–99 wraps; the cursor wraps after the 10th character; a 7 s timeout also applies on the channel step. Real:
- [ ] **Label characters.** Sim: blank, A–Z, 0–9, -, / (OI: "blank → A → B → C"; FAM: "A…Z 0…9 — / blank"). Real:
- [ ] **Scan.** Sim: preset blink 1 Hz; SCAN HOLD TIME keeps the preset audible for that time after its signal ends; the beep comes once per preset transmission. Real:
- [ ] **Simulated signal levels.** Sim: poor −95, good −85, strong −75 dBm against the squelch threshold (6…26 ≈ −105…−87 dBm, linear). Poor and good also sound distorted (narrow band, more noise, poor fades). Real:
- [ ] **Warnings.** Sim: shown in the bottom line for 2 s of every 5 s (OI table: "every 5 seconds"; OI 3.1 and FAM: 3 s for LOW BATT); priority FAILURE > STUCK PTT > TX HOT > LOW BATT. A failure in operation lasts until switched off. Real:
- [ ] **Symbols.** Sim: the speaker symbol is drawn next to TX / IC / VOX-disabled in the top-left; VOX-disabled is "IC" crossed out. Real (position):
- [ ] **Menus.** Sim: the Pilots Menu leaves after 5 s (OI: "a few seconds"; FAM: 5 s); keys other than the documented ones invert the display. With VOX forced off by the speaker, turning on IC VOX inverts the display. Real:
- [ ] **TX blocking.** Sim: blocked in TX are mode change, spacing, swap, active-frequency change, channel selection and STO; squelch and menus stay allowed. Real:
- [ ] **Power-up state.** Sim: squelch ON, Scan off, menus closed; frequencies, mode, spacing, settings and databases are kept. Real:
- [ ] **Factory defaults (FAM 2.8).** Brightness 50, SQUELCH THR 12, sidetone 6 dB, scan hold 1 s, dimming NONE, memory options on, all MDE pages on, only AUTO ISOL IN TX checked, SPKR VOL SRC BOTH; IC volume 37 and VOX −15 (IM recommended values). IN/OUT CFG 1 / 2 as in the IM figures (CFG 1: STD1 MIKE, BOTH MIKES, HEADPHONE 1; CFG 2: DYN MIKE, SPEAKER). Real:
- [ ] **Installation Setup details.**
  - Password digits start at 0000; a wrong password keeps the dialog.
  - Paging stops at the first / last page.
  - ERASE / RECALL go back to NO after STO.
  - ILLUM CURVE defaults (14 V: start 1.5 V, 10 %, 10 %/V, max at 12 V; 28 V: 4 V, 10 %, 5 %/V, 24 V) and steps.
  - Mike / aux sensitivity steps.
  - Only IN/OUT CFG 1 is active (no MIKE_SW input).
  - RECALL DEF. resets only installation settings.

  Real:
- [ ] **Volume knob.** Sim: OFF (pointer at the OFF print, -57° from the top) plus 100 steps of 1 % up to about +78° (user observation). Real:
- [ ] **Not simulated:** aux audio input, TANDEM / RCU6201 second controller, PC database upload, SWAP MIKE IC / MIKE_SW, sidetone level.

## 4e. King KMA 20 TSO audio panel (066-1024-03)
Sources:
- the brochure "Operating your KMA 20 Audio Control System" 006-8200-05, 7/76 (`sim/manuals/kma20-operating-guide.pdf`), marked B;
- the KMA 20/KR 21 Installation Manual 006-0044-02 Rev 2, June 1976 (`sim/manuals/kma20-installation-manual.pdf`), marked IM;
- photos of a real unit (front, unlit); no photo with the lamps lit;
- marker beacons, NDBs and ILS data from the Czech eAIP AD 2.19 / AD 2.12 (AIRAC 01 OCT 2026).

Everything below is **not** stated in B or the IM.

- [ ] **AUTO with the mic on EXT.** Sim: AUTO selects no receiver. Real:
- [ ] **AUTO and a COM toggle on the same receiver.** Sim: they add up (e.g. AUTO SPEAKER + COM 1 PHONE: COM 1 on both). The IM only says "for normal operation" the COM toggles are off. Real:
- [ ] **Mic keyed: phones.** Sim: keying the mic mutes the speaker (amplifier input) only; PHONE audio stays on, since it "completely bypasses the amplifier" (IM 3.2). B says "the output of all aircraft receivers is electronically muted". Real:
- [ ] **Mic keyed: the transmitting COM.** Sim: no reception; its audio line carries the transceiver's sidetone (the same static as the GTR / GNC PTT), routed by its toggle and AUTO like any receiver, so with the speaker muted it is heard only on PHONE. The KMA 20 itself has no sidetone (IM). Real:
- [ ] **EXT.** Sim: the speaker toggles feed the ramp hail speaker, so nothing is heard on the cockpit speaker; PTT keys no transmitter. Real:
- [ ] **No power.** Sim: avionics master off silences everything, including the PHONE path (the IM calls PHONE "a bypass switching function", which may work without power). Real:
- [ ] **TEST.** Sim: spring-loaded, back to LO on release; lights all three lamps. Real:
- [ ] **MKR switch positions.** Sim: HI up, LO center, TEST down (photos). Real:
- [ ] **Marker reception.** Sim: on LO the cone is ±300 m around the outer marker and ±150 m around the middle marker (ICAO Annex 10 coverage); HI is 6 × wider, so the outer marker tone begins about 1 NM before the station (IM 3.1). The cone does not vary with height. Real:
- [ ] **Marker keying.** Sim: outer 375 ms dashes every 500 ms; middle a 100 ms dot and a 300 ms dash in 632 ms (ICAO: 95 combinations a minute); the lamp flashes with the tone. Real:
- [ ] **Lamp brightness.** Sim: 35 % at night to 100 % in sunlight with the Cockpit light slider (B: "Brighter during the day; dimmer at night"); the lit look (a bright layer in the lens color) is not from a photo. Real:
- [ ] **Mic selector detents.** Sim: COM 1 −22°, COM 2 straight up, EXT +22°, with stops at both ends. Real:
- [ ] **Receiver idents.** Sim: VOR / ILS and NDB idents at 1020 Hz every 8 s; DME at 1350 Hz every 30 s (the AIP doesn't publish NDB tones). Every tuned station is received at full strength. Real:
- [ ] **Not simulated:** the non-switched input (radar altimeter), KA 40 remote lamps, the speaker / ramp hailer load resistors, panel lighting from the instrument light dimmer.

## 4f. Bendix/King KN 64 DME (066-1088-00)
Sources:
- the Silver Crown Plus Pilot's Guide R4 (2002), "KN 62A and KN 64" pages 25-26 (`sim/manuals/kn64-pilots-guide.pdf`), marked PG;
- the KN 62/62A/64 Installation Manual 006-00144-0007 Rev 7, Nov 2004 (`sim/manuals/kn64-installation-manual.pdf`), marked IM;
- photos of real units: one unlit straight-on (layout), two lit in FREQ ("---  108.80", "---  108.60");
- DME antenna positions and elevations from the Czech eAIP ENR 4.1 and AD 2.19 (AIRAC 01 OCT 2026).

Everything below is **not** stated in the PG or the IM (no public maintenance manual).

- [ ] **Knob wrap.** Sim: the outer knob wraps 117 → 108 and back; the inner knob wraps .9 → .0 without carrying into the MHz. Real:
- [ ] **Pull / push in GS/T.** Sim: turning the knobs does nothing (PG "Frequency Hold"); pulling or pushing the inner knob is kept and shows when you go back to FREQ (the held frequency doesn't change). Real:
- [ ] **Power-on display.** Sim: dashes (search) straight away, no segment test. Real:
- [ ] **Range of 100 NM and more.** Sim: three whole digits, e.g. "125", decimal point off. Real:
- [ ] **Flying away from the station.** Sim: ground speed is the size of the range rate and time-to-station is range ÷ ground speed, whichever way you fly (the PG only says they are accurate tracking directly to or from / to the station). Real:
- [ ] **Leading blanks.** Sim: ground speed and time-to-station are right-aligned with blanks (" 90", " 5"), not zeros. Real:
- [ ] **Ground speed after lock-on.** Sim: the range rate over the last 3 s, so it shows 0 at lock-on and settles within 3 s; time-to-station shows 99 while the ground speed is 0. Real:
- [ ] **Memory.** Sim: the last reading is held 13 s after the signal is lost (IM "11 to 15 seconds"), then dashes; no ident while on memory. Real:
- [ ] **Reception.** Sim: line of sight 1.23 × √(altitude − DME antenna elevation, ft) NM, up to 389 NM; every DME in range locks (no power or sensitivity model, the published protection ranges are not used). Real:
- [ ] **Ident.** Sim: Morse at 1350 Hz about every 30 s while locked (ICAO values). Real:
- [ ] **Display brightness.** Sim: the lit segments go from a dim red at night to full orange-red with glow in sunlight, following the Cockpit light slider (IM 3.1: photocell dimming; curve not stated). The unlit segments and legends stay faintly visible at a fixed level (as at dusk); only the lit ones change. Real:
- [ ] **Glass marks.** Sim: the two unlabeled marks under the digits (left of RMT, right of MIN, seen on the unlit photo) never light. Real:
- [ ] **Switch positions.** Sim: ON/OFF slide right = on (Fig 3-1); function slider RMT left, FREQ center, GS/T right. Real:

## 4d. Cockpit light (photocell), all units that have one
The GTR 225 / GNC 255 (Installation Manual 190-01182-02 6.4.1.4–5), TT31 (Installation Manual 6.1.11) and GTX 328 set their display (and key) lighting from a photocell; the KMA 20 dims its marker lamps with one (see 4e), the KN 64 its display (see 4f). The AR6201 manuals mention none, so it has no slider.
- [ ] **GTR / GNC.** Sim: brightness 0.55 + 0.75 × light (about unchanged at 60 %), times the pilot DSPL BRT offset; key lighting fades in below the KEY CO default 80 %. Real:
- [ ] **TT31.** Sim: LCD brightness 0.55 + 0.75 × light. Real:

## 5. Simulator-only (no device check needed)
These exist only to make practice possible:
- Incoming-call sound clips, static levels, the "Audio" status line.
- KMA 20: the Headset switch (phones in the ears plus the speaker muffled through the ear cups), the approach slider and Fly button, the station lists.
- GPS start positions, the Flight panel (ground speed/track; track converted to true with a fixed 5°E variation); KN 64: the altitude slider and the NAV receiver list for RMT.
- USB-drive selector, message raiser, aircraft-power switch, factory reset.
- Keyboard shortcuts.
- Frequency and navaid data: Czech AIP, AIRAC 01 OCT 2026 (re-check each cycle).
