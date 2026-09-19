# play_music_theory — Parity Evidence Matrix

**Reference date:** 2026-09-19  
**Primary web reference:** https://playmusictheory.net/play  
**Official app reference:** https://apps.apple.com/us/app/play-music-theory/id6800616114

This matrix separates verified behavior from implementation defaults.

| Area | Evidence status | Evidence | Current implementation |
|---|---|---|---|
| Drawing -> sound | CONFIRMED | Official product description: “Listen to your drawings”; current web UI | Implemented |
| X -> time | CONFIRMED/OBSERVED | Playback scans drawing left-to-right; playhead screenshots | Implemented |
| Y -> pitch | CONFIRMED/OBSERVED | Note grid + visual instrument behavior | Implemented |
| Key | CONFIRMED | Current web UI + app v1.1 changelog | Implemented |
| Scale | CONFIRMED | Current web UI + app v1.1 | Major / Minor implemented |
| Major / Minor | CONFIRMED | App v1.1 changelog explicitly names both | Implemented |
| Range | CONTROL CONFIRMED, VALUES VERIFY | Current web UI shows Range select | Provisional 1/2/3 |
| Octave +/- | CONFIRMED | Current web UI | Implemented |
| Octave min/max | VERIFY | Not exposed by indexed DOM | Configurable UI, no final parity clamp |
| Paper | CONFIRMED | Current web UI + app v1.0.4 | Implemented |
| Sky | CONFIRMED | App v1.0.4 | Implemented |
| Photo background | CONFIRMED | App v1.0.3/v1.0.4 | Implemented |
| Tune | CONTROL CONFIRMED, SEMANTICS VERIFY | Current web UI | Implemented as provisional global cents |
| Tempo | CONFIRMED | Web UI + app v1.1 | Implemented |
| Tap tempo | CONFIRMED | Current web UI help/controls | Implemented |
| BPM exact range/default | VERIFY | Not exposed by indexed DOM | Provisional 30–300 / 120 |
| Quantize | CONFIRMED | Current web UI + app v1.1 “quantize ticks” | Implemented |
| Quantize exact options | VERIFY | Select options unavailable via indexed DOM | Provisional Off/1/4/1/8/1/16 |
| Swing | CONFIRMED | Current web UI | Implemented |
| Swing exact ratios | VERIFY | Select options unavailable via indexed DOM | Provisional Off/Light/Heavy |
| Click | CONFIRMED | Current web UI help/controls | Realtime metronome implemented |
| MIDI in | CONFIRMED | Current web UI help/controls | Web MIDI implemented |
| Three-octave keyboard | CONFIRMED | App v1.1 changelog | Implemented |
| Key button | STRONG OBSERVATION | Current web DOM exposes a separate Key button; likely keyboard trigger | Used to toggle virtual keyboard |
| 1/2/3 | PARTIALLY CONFIRMED | Official screenshots + secondary hands-on observation | Drawing resolution presets |
| Exact preset 3 mapping | VERIFY | No measurable public value | Configurable |
| •/••/••• | STRONG OBSERVATION | Current web UI + secondary hands-on observation | Rhythm preset abstraction |
| Exact dot mapping | VERIFY | No measurable public values | Configurable |
| Palette | CONFIRMED | Official screenshots/current UI | Implemented |
| Custom color + | WEB CONFIRMED/SEMANTICS PARTIAL | Web DOM has + and color input; help says colors can be customized | Native color input |
| Undo last line | CONFIRMED | App v1.1.1 changelog: last line; Cmd-Z on iPad | Implemented as stroke-only undo |
| Redo | NOT CURRENT PARITY | Current App Store review requests redo | Not implemented |
| The instrument | CONFIRMED | Current web UI + app v1.1 | Collapsible panel |
| Instrument default closed | CONFIRMED HIGH-LEVEL | App changelog: switch “opens it” | Default closed |
| WAV export | CONFIRMED | Current web UI + app v1.1 loop export | Implemented |
| MIDI export | CONFIRMED | Current web UI | Implemented |
| WAV metronome inclusion | VERIFY | Public sources do not say | Excluded by default |
| MIDI track format | VERIFY | Public sources do not expose file structure | Standard MIDI format 0 |
| Record / take | CONFIRMED | Current web UI + app v1.0.3/v1.0.4 | Canvas + Web Audio MediaRecorder |
| Take saved before sharing | CONFIRMED | App v1.0.4 | Browser take is materialized before sharing |
| Share title | CONFIRMED | Current web UI | Implemented |
| Share author/handle | CONFIRMED | Current web UI | Implemented |
| Gallery | CONFIRMED (WEB) | https://playmusictheory.net/gallery | Implemented MVP |
| Gallery exact editing behavior | VERIFY | Public index does not expose interaction | Safe load with confirmation |
| Help ? | CONFIRMED | Current web UI + app v1.0.2 | Implemented |
| Help content | CONFIRMED HIGH-LEVEL | Current web help text | Implemented with own wording |

## Official version history relevant to parity

### 1.1.1
- Undo returns the last line.
- Command-Z on iPad.

### 1.1
- “The instrument” feature bundle.
- Keys.
- Major and minor.
- Octaves.
- Quantize ticks.
- Tempo.
- Three-octave keyboard.
- Loop export.

### 1.0.4
- Background card: paper, sky, or photo.
- Take is saved the moment it ends, before sharing.

### 1.0.3
- Every line plays, regardless of line count.
- User photo background.
- Take saving.

### 1.0.2
- Help via question-mark control.

## Important negative evidence

The current official App Store reviews still request some features rather than describing them as available. These should not be treated as current parity requirements:

- redo;
- more brush/eraser sizes;
- additional synth sounds;
- individual sound mute/solo.

The web product may differ from the iOS app in some areas, especially custom color and gallery. Web behavior takes precedence because the target is `playmusictheory.net/play`.

## Unresolved exact-value audit

The following remain intentionally configurable in `frontend/src/features/music/parityConfig.ts` until a true interactive browser/DevTools audit can inspect actual select values and input bounds:

1. Range options.
2. Octave min/max.
3. Tune meaning/range.
4. BPM min/max/default.
5. Quantize select values.
6. Swing select values/ratios.
7. drawing preset 3 exact resolution.
8. dot preset exact rhythm mapping.
9. color -> timbre relationship, if any.
10. WAV metronome policy.
11. MIDI export track structure.

Do not promote provisional values to “confirmed” without direct measurement.
