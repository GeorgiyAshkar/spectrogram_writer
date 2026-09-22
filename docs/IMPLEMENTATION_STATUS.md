# play_music_theory — Implementation Status

**Branch:** `playmusictheory`  
**Updated:** 2026-09-22  
**Reference:** https://playmusictheory.net/play

## Status

The music-mode architecture is stable. Exact reference values are no longer provisional for Key, Scale, Range, Tune, Tempo, Quantize, Swing, Program 1/2, accompaniment identities, instrument names/colors, Grid default, photo-fit modes, and share field limits.

Remaining parity work is concentrated in behaviors that cannot yet be inferred safely from public observation alone: Freestyle, exact original synthesis recipes, octave entitlement/clamp behavior, and a few export details.

## Implemented

### Theory and timeline
- [x] canonical `NoteEvent[]`
- [x] X -> beat
- [x] Y -> scale pitch
- [x] exact Key labels: C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B
- [x] 10 exact Scale options
- [x] default Major pentatonic
- [x] Range 1/2/3 octaves, default 3
- [x] Tune -50..+50 cents
- [x] Tempo 60..200 BPM, default 120
- [x] exact Quantize list, default 1/8 triplet
- [x] exact Swing values
- [x] triplet grids ignore swing
- [x] stroke compiler
- [x] adjacent equal-note event merge

### Drawing canvas
- [x] normalized vector strokes
- [x] Pointer Events for mouse/touch/stylus
- [x] pressure capture
- [x] realtime playhead
- [x] Program 1 — Drawing mode
- [x] Program 2 — Pixel mode
- [x] measured 48-column Pixel grid
- [x] measured square-cell fill ratio 18/19
- [x] Pixel rows follow the active pitch-range row count
- [x] `pixelRowCount` persisted per new Pixel stroke
- [x] legacy Program-2 32×24 fallback retained for old saved work
- [x] Program 3 retained in model but hidden because the current reference UI hides it
- [x] Grid toggle, default On
- [x] Pen
- [x] Eraser by dragging across a line
- [x] Undo
- [x] Redo
- [x] Cmd/Ctrl+Z
- [x] Cmd/Ctrl+Shift+Z / Ctrl+Y
- [x] Restart without stopping the beat
- [x] Shuffle random drawing
- [x] pure/testable Shuffle implementation
- [x] pure/testable Recolor implementation

### Exact instrument palette
- [x] keys — #1d9e75
- [x] pluck — #d85a30
- [x] bell — #7f77dd
- [x] marimba — #ef9f27
- [x] flute — #3e5ec6
- [x] strings — #de7bae
- [x] chime — #85bee8
- [x] bass — #33312b
- [x] 8bit — #f4be82
- [x] stable `instrument:<id>` identity independent of color
- [x] Recolor existing instrument strokes
- [x] “Original colors” reset
- [x] 27 measured recolor preset colors
- [x] custom recolor + control
- [x] custom colors persist/share without changing instrument identity
- [x] legacy color-based layer compatibility

### Accompaniment
- [x] • = Bass
- [x] •• = Drums
- [x] ••• = Arpeggio
- [x] independent stacking
- [x] all accompaniment routed through canonical `NoteEvent[]`
- [x] realtime/WAV/MIDI all consume the same accompaniment events
- [x] drums use GM kick/snare/closed-hat note numbers
- [x] MIDI drums routed to percussion channel 10
- [x] measured default Bass: tonic at C3/MIDI 48 for Key=C, retrigger every beat
- [x] measured default Arpeggio: C5-E5-G5-A5-C6-A5-G5-E5 on 1/8-triplet steps
- [x] measured default Drums: hi-hat every 1/3 beat, kick on 0/2, snare on 1/3
- [x] measured Bass/Drums/Arpeggio implemented for default Major-pentatonic behavior
- [ ] non-default Scale behavior of Arpeggio — clean-room triad fallback currently used

### Realtime audio
- [x] Web Audio engine
- [x] `AudioContext.currentTime` scheduling
- [x] look-ahead scheduler
- [x] true loop playback
- [x] pause/resume
- [x] seek
- [x] realtime metronome
- [x] first-beat accent
- [x] live note audition
- [x] active voice cleanup
- [x] configurable voice profiles
- [x] named instrument layers route to distinct clean-room voice profiles
- [x] per-instrument clean-room attack/release/sustain envelopes
- [x] per-instrument harmonic partial profiles
- [x] realtime and WAV share the same voice-profile model
- [ ] exact original synthesis recipes

### Virtual keyboard / MIDI input
- [x] three-octave virtual keyboard
- [x] live note-on/note-off
- [x] loop recording
- [x] Web MIDI support detection
- [x] permission states
- [x] connected-device list
- [x] velocity
- [x] held-note cleanup on disconnect/disable
- [x] stable instrument layer identity on recorded notes

### Export
- [x] WAV from canonical timeline
- [x] MIDI Standard MIDI File
- [x] tempo meta event
- [x] note-on/note-off
- [x] velocity
- [x] deterministic PPQ
- [x] percussion channel for drum accompaniment
- [x] Freehand MIDI pitch-bend export with isolated expressive channels
- [x] 14-bit bend curve and RPN pitch-bend range setup
- [x] graceful rounded-note fallback if all expressive channels are occupied
- [x] WAV and MIDI use the same musical timeline
- [ ] exact reference metronome-in-WAV policy
- [ ] exact reference MIDI track layout

### Backgrounds
- [x] Paper
- [x] Sky
- [x] user Photo
- [x] Fill
- [x] Fit
- [x] Stretch
- [x] reference-like max photo dimension: 2000 px
- [x] JPEG quality 0.9 for resized photo
- [x] durable Photo persistence in project schema v2
- [x] Photo survives reload
- [x] Photo survives Share/Gallery
- [x] v1 -> v2 migration

### Persistence
- [x] versioned local draft
- [x] autosave
- [x] reload restore
- [x] settings
- [x] strokes
- [x] virtual keyboard notes
- [x] MIDI notes
- [x] selected instrument
- [x] custom instrument colors
- [x] background + photo fit
- [x] corrupted storage fallback

### Take / record
- [x] canvas video stream
- [x] realtime Web Audio capture
- [x] MediaRecorder
- [x] capability detection
- [x] measured reference policy: request `video/mp4` first
- [x] observed Chromium result: `video/mp4;codecs=vp9,opus`
- [x] WebM fallbacks for browsers without MP4 MediaRecorder support
- [x] record/stop lifecycle
- [x] downloadable take
- [x] cleanup on mode switch
- [x] Web Share file flow for “share take”
- [x] download fallback when file sharing is unavailable

### Share / Gallery
- [x] FastAPI publish/list/detail endpoints
- [x] SQLite storage
- [x] title maxlength 48
- [x] author/handle maxlength 120
- [x] versioned project snapshot
- [x] public piece ID
- [x] copyable `?piece=<id>` URL
- [x] shared-project loading
- [x] safe confirmation before replacing local work
- [x] gallery thumbnail generation
- [x] SQLite thumbnail migration
- [x] responsive visual gallery cards

### Freehand / Freestyle
- [x] Freehand control
- [x] Freehand leaves canvas geometry unchanged
- [x] Freehand maps Y to continuous fractional pitch
- [x] measured Freehand curve at octave offset 0: C ≈ MIDI 79 − 31·y
- [x] Freehand is independent from Scale and Range
- [x] measured signed Key transpose: F#=+6 boundary, G=-5 wrap
- [x] Freehand realtime glissando ramps
- [x] Freehand WAV glissando ramps
- [x] Freehand help text
- [x] old drafts default Freehand to Off
- [x] Freehand regression tests
- [ ] Freestyle — exact transformation still VERIFY; geometry, pitch spectrum, theory-control state, backward drawing and onset timing all tested without a distinguishing effect

## Verification

### CI
- [x] clean checkout
- [x] `npm ci`
- [x] focused TypeScript music check
- [x] music-domain smoke tests
- [x] full frontend build
- [x] production browser smoke
- [x] production mobile smoke at 390×844
- [x] no mobile horizontal document overflow in the tested music flow
- [x] Python gallery unit tests

### Music smoke tests
- [x] note -> MIDI
- [x] MIDI -> Hz
- [x] all ten scale families
- [x] exact Major pentatonic default
- [x] quantize
- [x] straight-grid swing
- [x] triplet no-swing behavior
- [x] StrokeCompiler
- [x] voice profiles
- [x] accompaniment controls
- [x] GM drum pitches
- [x] draft migration
- [x] durable Photo background
- [x] WAV/MIDI export
- [x] deterministic Shuffle
- [x] instrument-only Recolor
- [x] exact original-color reset

## Reference measurement tooling

The branch contains disposable clean-room measurement workflows:

- `scripts/reference-dom-probe.mjs`
- `scripts/reference-interaction-probe.cjs`
- `scripts/reference-freehand-curve-probe.cjs`
- `scripts/reference-export-probe.cjs`
- `scripts/reference-take-probe.cjs`
- `.github/workflows/reference-parity-probe.yml`
- `.github/workflows/reference-focused-probes.yml`

They inspect only public rendered UI/interaction state and are not runtime dependencies.

Measured facts are recorded in:

- `docs/PARITY_EVIDENCE_MATRIX.md`
- `docs/PLAYMUSICTHEORY_PARITY_AUDIT.md`

## Next work

1. experimentally determine Freestyle behavior;
2. resolve octave min/max and Freehand octave-offset behavior outside the currently locked public entitlement state;
3. compare named instrument audio behavior and refine configurable voice profiles;
4. verify metronome export policy;
5. verify MIDI structure, especially Freehand pitch-bend behavior;
6. keep production browser smoke green across desktop/mobile-sized viewports;
7. refine UI layout toward the compact icon-oriented reference once behavior is fully stable.
