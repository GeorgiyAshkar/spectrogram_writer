# play_music_theory — Parity Evidence Matrix

**Reference date:** 2026-09-22  
**Primary web reference:** https://playmusictheory.net/play  
**Official app reference:** https://apps.apple.com/us/app/play-music-theory/id6800616114  
**Measurement method:** public server DOM + rendered DOM + interaction probe in headless Chrome. No copied source implementation is used as application code.

## Confirmed reference controls and values

| Area | Reference behavior / exact values | Current implementation |
|---|---|---|
| Key | C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B | Implemented |
| Default key | C | Implemented |
| Scale | Major pentatonic, Minor pentatonic, Major, Minor, Harmonic minor, Dorian, Phrygian, Lydian, Mixolydian, Blues | Implemented |
| Default scale | Major pentatonic | Implemented |
| Range | 1 octave, 2 octaves, 3 octaves | Implemented |
| Default Range | 3 octaves | Implemented |
| Octave | - / numeric offset / + | Implemented |
| Tune | -50..+50 cents, step 1, default 0 | Implemented |
| Tempo | 60..200 BPM, step 1, default 120 | Implemented |
| Tempo number | exact BPM display is readonly in current web | Implemented |
| Tap | tempo tap control | Implemented |
| Quantize | 1/4, 1/8, 1/8 triplet, 1/16, 1/16 triplet, 1/32 | Implemented |
| Default Quantize | 1/8 triplet | Implemented |
| Swing | Off=0, Light=0.1, Medium=0.2, Hard=0.33 | Implemented |
| Swing rule | straight grids only; triplet grids keep their own feel | Implemented |
| Click | metronome toggle | Implemented |
| MIDI in | external MIDI keyboard into the loop | Implemented |
| Export | WAV + MIDI inside The instrument | Implemented |
| Program 1 | Drawing mode | Implemented |
| Program 2 | Pixel mode | Implemented |
| Program 3 | Video mode: “Map a photo to each instrument”; currently display:none in public rendered UI | Hidden to match current reference |
| • | Bass | Implemented as accompaniment layer |
| •• | Drums | Implemented as accompaniment layer |
| ••• | Arpeggio | Implemented as accompaniment layer |
| Stacking beats | Bass hint explicitly says “Stack any of the three.” | Controls are independently stackable |
| Pen | “Draw. Every line is a sound.” | Implemented |
| Eraser | “Erase. Drag across a line.” | Implemented |
| Undo | “Undo the last line.” | Implemented |
| Redo | “Redo a line you took back.” | Implemented |
| Restart | “Clear the drawing. The beat keeps going.” | Implemented without stopping transport |
| Shuffle | “A new drawing, at random.” | Implemented; palette is preserved |
| Recolor | “Change the colors: tap this, then any color.” | Implemented with measured 27-color picker + custom + reset |
| Original colors | explicit reset control exists | Implemented |
| Grid | “every note and beat under the ink”; rendered reference starts On | Implemented, default On |
| Three-octave keyboard | confirmed in official app changelog | Implemented |
| Key button | separate current-web button next to mode controls | Used to show/hide virtual keyboard |
| Background | Paper / Sky / user Photo | Implemented |
| Photo fit | Fill / Fit / Stretch | Implemented |
| Photo preprocessing | reference downsizes photos only past ~2000 px and uses JPEG 0.9 | Implemented |
| Record | record/take control | Implemented |
| Take container | current Chromium reference requests `video/mp4`; actual recorder/data chunks report `video/mp4;codecs=vp9,opus` | Implemented as MP4-first with WebM fallbacks |
| Share take | separate share control appears after take | Implemented with Web Share file sharing and download fallback |
| Share title | maxlength 48 | Implemented frontend/backend |
| Share name/handle | maxlength 120 | Implemented frontend/backend |
| Gallery | public gallery | Implemented MVP with thumbnail cards |
| Help | ? control | Implemented |

## Measured accompaniment behavior

At the default C / Major pentatonic / 120 BPM settings, black-box output analysis established:

- **Bass**: fundamental around C3 / MIDI 48, retriggered approximately once per beat and sustained through most of the beat.
- **Arpeggio**: a repeating 1/8-triplet sequence approximately C5–E5–G5–A5–C6–A5–G5–E5.
- **Drums**: short-window transient analysis resolves a closed-hi-hat transient every 1/3 beat, kick accents on beats 0 and 2, and snare accents on beats 1 and 3.

The clone now matches the measured default Bass, Drums and Arpeggio behavior. Non-default Scale arpeggios remain a documented clean-room fallback until measured separately.

## Exact instrument palette

The rendered web UI exposes stable instrument identity separately from color:

| Instrument ID | Reference color |
|---|---|
| keys | rgb(29, 158, 117) / #1d9e75 |
| pluck | rgb(216, 90, 48) / #d85a30 |
| bell | rgb(127, 119, 221) / #7f77dd |
| marimba | rgb(239, 159, 39) / #ef9f27 |
| flute | rgb(62, 94, 198) / #3e5ec6 |
| strings | rgb(222, 123, 174) / #de7bae |
| chime | rgb(133, 190, 232) / #85bee8 |
| bass | rgb(51, 49, 43) / #33312b |
| 8bit | rgb(244, 190, 130) / #f4be82 |

The application now stores instrument identity as `instrument:<id>`, while color remains customizable. This is important because Recolor must not change the selected sound identity.

**Exact synthesis recipes are still unknown.** Current synthesis is a clean-room approximation behind a configurable voice-profile layer. The nine named instruments now have distinct waveform/partial/envelope profiles, and realtime playback and WAV export use the same profiles.



## Exact recolor picker presets

The rendered color picker exposes 27 preset choices plus a custom `+` and a separate “The original colors” reset:

```
#1d9e75 #0e7a5a #7bc9a8
#3fb0c0 #2c8c8c #8fd3dc
#3e5ec6 #2a3f8f #87a5e8
#7f77dd #5a4fb8 #b3aeed
#de7bae #c2497f #f2b5d2
#d85a30 #a83a1c #f09a75
#ef9f27 #c77e12 #f6c877
#f4be82 #b98a54 #8a6238
#33312b #6b675c #a7a294
```

The clone uses the same measured preset list while retaining stable instrument identity independently of the chosen color.

## Confirmed interaction observations

### Shuffle
A click changes the canvas drawing while all nine swatch colors remain unchanged. Therefore Shuffle is a random drawing generator, not a palette randomizer.

### Recolor
The current web exposes:
- a dedicated “Change the colors” control;
- a custom color surface;
- a separate “The original colors” reset.

Our implementation keeps instrument IDs stable and recolors existing strokes belonging to the selected instrument.

### Grid
The rendered reference starts with `gridBtn` in an `on` state. Grid is therefore default-on.

### Program 3
The DOM contains:
- Program 3;
- tooltip “Video mode”;
- hint “Video mode. Map a photo to each instrument.”

But the current rendered public UI applies `display:none` to Program 3. The clone therefore keeps it hidden rather than exposing an incomplete feature as current parity.

## Freestyle / Freehand measurements

The current rendered DOM contains independent controls:

- `Freestyle` (`lockBtn`);
- `Freehand` (`freeBtn`).

A controlled identical pointer gesture produced **pixel-for-pixel identical canvas geometry** in default, Freestyle, and Freehand.

A black-box analyser attached only to the final Web Audio destination showed:

- default and Freestyle produced essentially the same stepped pitch spectrum under the tested gesture;
- Freehand produced a substantially denser, smoothly moving fundamental frequency sequence.

Therefore:

- **Freehand: CONFIRMED behavior** — it preserves the visual line but removes discrete scale-pitch stepping and follows continuous vertical pitch.
- **Freehand vertical mapping: MEASURED at octave offset 0** — Scale and Range do not change the curve. For Key=C, the observed frequencies are consistent with `MIDI ≈ 79 - 31*y` across the canvas. Key transposes the entire curve using the nearest signed pitch-class offset around C: C=0, D=+2, F#=+6, G=-5, A=-3, Bb=-2, B=-1. The implementation now uses this measured mapping for realtime and WAV glissando.
- **Freestyle: still VERIFY** — it does not change visible geometry and did not produce a material spectral difference in the tested gesture. A separate onset-timing probe at x=0.19/0.23/0.29 produced default vs Freestyle onsets that matched within only a few milliseconds, so Freestyle is not treated as a Quantize bypass. No behavior is invented until a distinguishing interaction is measured.

## Still unresolved exact behavior

1. Octave min/max clamp.
2. Exact envelope/phase recipe for each of the nine named instruments. Harmonic ratios and relative gains are measured and implemented.
3. Arpeggio behavior is measured for all 10 Scale options: major-family scales use 0/4/7/9/12/9/7/4 and minor-family scales use 0/3/7/10/12/10/7/3.
4. Exact MIDI input interaction with scale/freestyle modes.
5. Whether metronome Click is included in reference WAV export.
6. Exact reference MIDI file track/channel structure.
7. Exact behavior of Freestyle.
9. Exact effect of the Octave +/- control on Freehand while the public entitlement state prevents observing octave changes.
10. Exact color-picker interpolation/model beyond measured preset colors and custom picker.
11. Exact public-gallery open/edit permissions and lifecycle.

## Instrument envelope measurement boundary

The public reference exposes the instrument controls and a small `#octave` Key canvas, but the containing `#prorow` is rendered with the `locked` class in the non-entitled web session. Pointer probing on that canvas produces no audio.

Therefore:
- harmonic ratios/relative levels are measured from normal drawn playback and implemented;
- exact attack/release envelope values are **not** claimed as measured;
- the clone keeps clean-room envelope values until an observable, non-entitlement-bypassing measurement path exists.

## Take recorder policy

Black-box MediaRecorder instrumentation of the current reference page established:

- the reference calls `new MediaRecorder(..., { mimeType: 'video/mp4' })`;
- Chromium reports the active recorder MIME as `video/mp4;codecs=vp9,opus`;
- emitted `dataavailable` blobs carry the same `video/mp4;codecs=vp9,opus` type;
- the hidden “Share the take” control becomes visible after the recorder stops.

The clone now follows the same MP4-first policy and falls back to VP9/Opus WebM, VP8/Opus WebM, then generic WebM only when MP4 is unavailable.

## Compatibility decisions

- Existing saved color-based strokes remain readable.
- New strokes use stable `instrument:<id>` layer IDs.
- Old drafts are migrated instead of being rejected.
- Unknown reference synthesis details are kept behind configuration, not encoded as alleged parity facts.


## Pixel mode geometry

Black-box image-difference probing of Program 2 established the following geometry:

- horizontal grid: **48 columns** across the 960 px reference canvas;
- cell side: approximately **18/19 of one 20 px column pitch**;
- cells are rendered as squares;
- horizontal snap uses the center of the selected 1/48 column;
- vertical rows follow the active discrete pitch range rather than a fixed 24-row grid;
- at the current default Major pentatonic / 3-octave settings the measured row count is **15**;
- row centers are distributed between half a cell from the top and half a cell from the bottom.

Implementation details:
- new Program-2 strokes persist `pixelRowCount`;
- reload/share therefore preserve the exact row geometry that existed when the stroke was drawn;
- legacy Program-2 strokes without `pixelRowCount` keep the older clean-room 32×24 fallback for backward compatibility.

