# Look: bezel and display techniques that the user accepted

Reference implementations: `sim/devices/ar6201/ar6201.css` (most refined), `sim/devices/tt31/tt31.css`, `sim/devices/gnc255/gnc255.css`, base rules in `sim/shared/style.css`.

## Measure, don't eyeball
- Lay the bezel out in a fixed pixel box (e.g. 880×248 for a wide radio, 440×440 for a 57 mm square unit) and scale with `fitBezel`.
- Get positions from the photo: crop/zoom with ImageMagick, convert to % of the face, place elements in the same %. Verify with `scripts/measure.mjs` (prints element boxes as % of the bezel) and fix until they agree.
- Colors: sample `magick photo.png -crop 10x10+X+Y -resize 1x1 -format '%[pixel:p{0,0}]' info:` on several spots. Studio photos are lighter than a cockpit: go a bit darker than the samples. The user notices both "too bright" and "way too dark".

## Light comes from the top-left — everywhere
- Highlights/glare top-left, shadows to the bottom-right (`box-shadow` with positive x and y). Taller parts (knobs) cast longer shadows than flat ones (keys, screws).
- Raised parts: inset highlight top-left + inset shade bottom-right. Recessed parts: the opposite (dark top/left slopes, lit bottom slope).
- **Never rotate an element that carries lighting.** Rotate only the moving part (knob grip, pointer, screw slot via `--rot` on `::before/::after`); keep glare/shade on fixed layers (`.knob::before/::after`, a fixed cap overlay). Otherwise shadows spin with the knob.

## Bezel
- Matte finish: `var(--bezel-grain)` under a slightly translucent gradient; grain must stay faint.
- Rounded outer corners; anything in the corners (screw recesses) is clipped by the face (`overflow: hidden`) and follows the border radius.
- Raised round front (panel cut-out ring): nearly as big as the face, dark step outside, a glare line all round that is thicker/brighter top-left. Controls sit inside it.
- Recesses (screw mounts): only a little darker than the face, never black; there is still material in them.
- Printed legends: white, bold; use a **rounded** font if the unit's legends are rounded (Nunito, bundled). Keep legend positions from the photo.
- A legend set into a printed line (KMA 20 SPEAKER / PHONE): **break the line** around it, never cover it with a background patch. Center the *glyphs* on the line both ways: measure their bounds in a render (threshold the crop) and offset the box, since the text box's leading and trailing letter spacing shift it. Equal gaps on both sides.
- Bat toggle switches (KMA 20 `.tgl`): dark bushing nut, lever, chrome ball; center = the ball seen end-on, up / down = a short lever with the ball above / below. Click the upper / lower half to move one step, wheel too.

## Screws and holes
- Domed radial gradient with a soft glare top-left; the cross as two `::before/::after` bars rotated by `--rot`; give each screw a different angle.
- Size and overlap exactly as in the photo (front screws partly cover the body screws; they sit near, not in, the recess corner).
- Small holes: dark, with only a subtle gloss on the top-left half of the rim.

## Keys
- Keys set at an angle (a mode cluster): draw them as SVG paths with the gradient in page space; keep the rotation of a legend on its own group, the press offset on a wrapper, so neither replaces the other.
- Rubber caps: dome gradient, inset highlight on top, inset shade at the bottom, outer drop shadow to the bottom-right. Pressed = `translateY(1px)` and a smaller shadow.
- Hover is one shared rule in `shared/style.css`: `filter: brightness(1.12)` on keys and knobs, plus a 1 px `var(--accent)` outline around every control's visible part (keys, knobs, dual rings, switches, sliders). For a knob nested in another (dual encoder), light and outline only the ring under the pointer. When the clickable element isn't the visible shape (a transparent box, a toggle's hit box, a hit strip, an SVG key), outline its visible parts instead (KMA 20 `.tgl` nut / lever / ball, mic skirt and bar; KN 64 slide with `outline-offset` past its lip; GTX 328 `.cap` stroke; AR6201 bracket and label), never the hit areas.
- Key lighting (backlit legends) may follow the unit's brightness via a CSS variable.

## Knobs
- Knurled rim: `repeating-conic-gradient` masked to a ring; smooth cap in the middle; cylinder shading on fixed layers; long bottom-right shadow.
- Pots with end stops: the angle comes from the device state (`angle: r => …`). Take the range from the photo (e.g. the pointer at OFF points at the OFF print) and the step size from the user/manual; set `dragPx` / `wheelSteps` so dragging and scrolling feel right. No turning animation on the first render (handled in `controls.js`).
- Printed arcs/scales: generate the SVG path with a short script — concentric with the knob, a thin tapered tail growing clockwise, ending where the photo ends; drawn 1:1 in layout coordinates (fixed `width/height`, not stretched).

## Display
- Frame: thick, rounded surround with sloped sides (top slopes dark, bottom slope lit, glare on the outer corners).
- Fonts: bundle OFL woff2 files in `sim/fonts/` with their license. Pixel LCDs: Jersey 15. Segment-like positive LCDs: a condensed sans for letters and **hand-drawn SVG digit glyphs** when the real digits have a distinctive shape (chamfered corners, a foot on the 1, flat-topped 1, decimal dot on the baseline, thicker strokes on the main line). Compare glyphs zoomed against a close-up photo.
- Seven-segment gas discharge / LED displays (KN 64, `ui/lcd-seg7.js`): SVG segment polygons in fixed slots, every segment, decimal point and printed legend always drawn; unlit they stay faintly visible through the tinted glass (the owner checks this on the unlit photo), lit they glow with a `drop-shadow` whose strength follows the photocell. Measure slot positions and the slant of the digits from a straight-on photo.
- Dot-matrix LCDs: when the manuals have figures at the display's native resolution (check `pdfimages -list`: e.g. 200 x 33 images), draw the real dot matrix on a canvas (`ui/lcd-gtx.js`) and extract the fonts dot by dot from the figures, mapping each figure's text to its glyph blobs. Check every repeated letter for consistency, learn the spacing (tabular digits, per-font cells) from the figures, then re-render each figure and diff it dot for dot until it matches. Design missing glyphs in the same style and list them.
- Digits never move: every digit sits in a fixed-width slot (the widest digit) so 4/5/1 don't shift neighbors.
- Text changes: cross-fade only the characters that changed (TT31 `xpdrRender`/`syncCell` in `ui/lcd.js`); a value redrawn with the same text must not flicker.
- Backlight: a fixed-color layer whose opacity follows brightness; unlit glass color from the unlit photo. Inversion ("display inverted") swaps the two theme colors explicitly — never `filter: invert()` (gives wrong hues).
- Power: keep the last frame while fading out; fade durations as the user specifies (they will tell you; for the AR6201 off was almost instant, on ~120 ms).
- Big proportional digits (e.g. Jersey 15) also need fixed slots, or values jump when they change or swap (GTR flip).
- Fixed slots for indicators that blink (reply indicator, annunciators) so neighbors never move.

## Page layout
- `fitBezel(bezel, wrap, { width, height, maxScale, maxViewport })`.
- A square/narrow unit on wide screens: put the panel cards in a column beside it (`.ar-col` media query in `ar6201.css`).
