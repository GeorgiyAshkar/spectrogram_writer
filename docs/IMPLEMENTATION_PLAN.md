# Implementation Plan — play_music_theory parity

**Branch:** `playmusictheory`  
**Specification:** `docs/PLAYMUSICTHEORY_PARITY_SPEC.md`  
**Audit:** `docs/PLAYMUSICTHEORY_PARITY_AUDIT.md`

## 1. Goal

Incrementally transform the current experimental music mode into a maintainable visual-music editor compatible with the observed `playmusictheory.net` interaction model.

The central invariant is:

```
Stroke[] -> StrokeCompiler -> NoteEvent[]
                         |-> realtime playback
                         |-> WAV render
                         |-> MIDI export
                         |-> persistence/share
```

No renderer/exporter should infer music independently from canvas pixels.

## 2. Current-state findings

The existing branch already provides a useful shell, but music logic is concentrated in `frontend/src/App.tsx`:

- note frequencies are built inside the React component;
- piano presses append note-name strings to `musicSequence`;
- WAV synthesis is implemented inline;
- drawing is raster-only and continuously serialized to PNG/base64;
- the drawing canvas has no durable vector stroke model;
- music playback and spectrogram-generation concerns share one top-level component;
- no shared `NoteEvent` representation exists.

This makes parity features such as quantize, swing, MIDI, undo, MIDI export and reliable loop playback difficult to implement consistently.

## 3. Phase 1 — Music domain foundation

### 3.1 Typed model
Create:
- normalized Point;
- Stroke;
- NoteEvent;
- MusicSettings;
- DrawingResolutionPreset;
- RhythmPreset;
- Project.

### 3.2 MusicTheory
Pure functions:
- note name <-> MIDI;
- MIDI -> frequency;
- scale intervals;
- pitch-range generation;
- Y -> nearest allowed MIDI pitch.

### 3.3 Rhythm mapping
Pure functions:
- X -> beat;
- configurable quantization;
- configurable swing;
- presets kept behind mappers because exact parity values are still partly VERIFY.

### 3.4 StrokeCompiler
Convert vector strokes to canonical `NoteEvent[]`:
- deterministic resampling by time;
- Y -> pitch;
- quantize;
- swing;
- adjacent identical-note merge;
- minimum duration guard.

### 3.5 First integration
Replace duplicate note-frequency arithmetic in `App.tsx` with the domain module without changing visible behavior.

**DoD:** TypeScript build remains valid; existing piano sequence still works; new pure music modules have no React dependency.

## 4. Phase 2 — Vector drawing canvas

Replace raster-as-source-of-truth with:
- `Stroke[]` state;
- pointer capture;
- normalized coordinates;
- pressure field;
- active color;
- undo stack;
- canvas rasterization only as a view/export compatibility layer.

Keep PNG/base64 synchronization for the legacy spectrogram writer, but derive it from vector strokes.

Add:
- drawing resolution preset 1/2/3 abstraction;
- playhead overlay;
- note grid overlay.

**DoD:** resize does not destroy geometry; undo removes only the latest stroke; legacy spectrogram preview still receives an image.

## 5. Phase 3 — Realtime transport/audio

Create:
- `AudioEngine`;
- `Transport`;
- look-ahead scheduler based on `AudioContext.currentTime`;
- voice lifecycle and stop-all;
- metronome;
- loop playback.

Remove generated-WAV-as-preview from realtime playback.

**DoD:** loop does not accumulate drift; no hanging notes; tempo can change without canvas regeneration.

## 6. Phase 4 — Instrument controls

Implement parity panel:
- Key;
- Scale;
- Range;
- Octave;
- tempo + Tap;
- Quantize;
- Swing;
- Click;
- Tune abstraction;
- Paper/background;
- color palette/customization;
- drawing preset 1/2/3;
- rhythm preset •/••/•••.

All still-unverified exact values live in `parityConfig.ts`, not DSP code.

## 7. Phase 5 — Keyboard and MIDI

Unify all note sources through `NoteInputService`:
- virtual keyboard;
- Web MIDI;
- optional computer keyboard later.

States:
- unsupported;
- permission denied;
- no devices;
- connected;
- disconnected.

MIDI loop recording produces the same `NoteEvent[]`.

## 8. Phase 6 — Export

### WAV
Offline render from `NoteEvent[]`, not DOM/canvas.

### MIDI
Standard MIDI file with:
- tempo;
- note on/off;
- velocity;
- deterministic ticks;
- separate tracks if multiple voices are enabled.

**DoD:** exported WAV and MIDI represent the same project timeline as realtime playback.

## 9. Phase 7 — Take / record

Browser path:
- canvas capture stream;
- WebAudio MediaStream destination;
- MediaRecorder;
- capability/codec detection;
- audio-only fallback.

## 10. Phase 8 — Persistence/share/gallery

- versioned local draft;
- schema migrations;
- share DTO;
- backend persistence;
- gallery list/detail;
- safe load without silently overwriting current work.

## 11. Phase 9 — Responsive/accessibility

- mobile-first canvas sizing;
- bottom-sheet advanced controls;
- 44px+ targets;
- keyboard navigation;
- aria labels;
- reduced-motion mode;
- no hover-only actions.

## 12. Phase 10 — Parity hardening

Close remaining VERIFY items using an interactive reference audit:
- exact select options;
- BPM range/default;
- Tune;
- exact 1/2/3 mapping;
- exact •/••/••• mapping;
- custom color behavior;
- MIDI scale behavior;
- export details.

## 13. Test strategy

Pure domain modules:
- unit tests for theory, rhythm and compiler.

UI:
- component tests for controls and undo.

Browser:
- drawing -> playback;
- touch/pointer;
- MIDI mocked capability states;
- WAV/MIDI export smoke tests.

Regression invariants:
- changing Key/Scale never deletes strokes;
- visual resize never changes normalized geometry;
- all audio/export paths consume canonical `NoteEvent[]`;
- unknown parity values remain configuration, never duplicated magic constants.

## 14. Migration rule

Do not delete the existing spectrogram writer functionality while building parity mode. The music editor should be introduced as an isolated feature and legacy raster export should remain available until the new vector canvas can reproduce its payload reliably.
