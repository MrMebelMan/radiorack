# Verification recipes

The server must be running: `python3 sim/serve.py` (http://localhost:8225, no-cache). Don't start a second one if it is already up.
Scripts live in `.claude/skills/add-device/scripts/` and need `chromium` on PATH. Run them from the repo root with `S=<scratchpad dir>`; they write screenshots and Chromium profiles there.

## Tests
`cd sim && node --test` — every suite must stay green. The manual replay suite drives the device directly: it must call `tick()` / advance a fake clock itself (the page ticks every 50 ms; tests don't).

## LCD / functional walk — `scripts/lcd-check.mjs`
`S=$S node .claude/skills/add-device/scripts/lcd-check.mjs <device> steps.json`
- `steps.json`: an array of steps, each `{ "label": "...", "do": [ actions ] }`. Actions: `["wheel", "#sel", dy, n]`, `["click", "#sel"]`, `["hold", "#sel", ms]`, `["sleep", ms]`, `["eval", "js"]`, `["key", "MDE", ms]` (shortcut for `.key[data-key=MDE]`).
- Prints per step: LCD class, LCD text, and any element overflowing the LCD box; plus every JS exception and console error. Clear localStorage first with an `eval` step when state matters.

## Measure against the photo — `scripts/measure.mjs`
`S=$S node .claude/skills/add-device/scripts/measure.mjs <device> '#volKnob' '.key[data-key=MDE]' …`
Prints each element's left/right/top/bottom as % of the bezel. Measure the same edges in the photo (pixels / photo size) and adjust until they agree within ~1 %.

## Side-by-side with the photo — `scripts/cdp.mjs shot`
`S=$S node .claude/skills/add-device/scripts/cdp.mjs shot <device> out.png [js-to-run-first]`
saves a screenshot of just the bezel. Then:
```
magick out.png -resize 450x450 a.png
magick photo.png -resize 450x450 b.png
magick a.png b.png +append cmp.png      # view cmp.png
magick out.png -crop WxH+X+Y -scale 300% zoom.png   # details: corners, knobs, digits
```
Look at it. Fix differences before reporting.

## Landing preview — `scripts/preview.mjs`
`S=$S node .claude/skills/add-device/scripts/preview.mjs <device> [power-on js]` writes `sim/previews/<device>.png` (powered-on bezel). The power-on JS turns the unit on the way a user would (e.g. scroll the volume knob); default sends wheel events to the first `.knob` and waits 4 s.

## Display vs the native manual figures
For a dot-matrix display with native-resolution figures: load each figure's values into the device, render with the pure bitmap function (`gtxBitmap`) and diff against the thresholded figure dot for dot; only live values may differ.

## Color sampling
`magick photo.png -crop 10x10+X+Y -resize 1x1 -format '%[pixel:p{0,0}]' info:`

## Gotchas
- Inside `ev(\`…\`)` template strings, interpolate values with `${v}` deliberately; a stray `${'${v}'}` sends the literal text.
- Remove the Chromium profile dirs the scripts leave in `$S` if they pile up (`rm -rf`, it's the scratchpad).
- Saved state lives in localStorage under the device's `PERSIST_KEY`; stale state hides default changes — clear it in checks, bump the key when defaults change.
- Measuring text widths over CDP: `await document.fonts.load('62px LCD')` first, and remember `getBoundingClientRect` includes the `fitBezel` scale.
- A CDP screenshot can't catch a 300 ms flash: check transient states via computed styles right after the action instead.
