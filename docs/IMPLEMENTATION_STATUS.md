# play_music_theory — Implementation Status

**Branch:** `playmusictheory`  
**Updated:** 2026-09-19

## Completed

### Specification / research
- [x] Detailed parity specification
- [x] First parity audit
- [x] Implementation plan
- [x] Unknown exact values isolated from DSP/UI logic

### Music domain foundation
- [x] `MusicSettings`
- [x] normalized `Point`
- [x] vector `Stroke`
- [x] canonical `NoteEvent`
- [x] project type
- [x] note name -> MIDI
- [x] MIDI -> frequency
- [x] Major / Minor pitch ranges
- [x] Y -> allowed scale pitch
- [x] X -> beat
- [x] quantization
- [x] swing transform
- [x] stroke -> note-event compiler
- [x] adjacent equal-pitch event merge

### Vector music canvas
- [x] separate `MusicCanvas`
- [x] normalized vector strokes
- [x] pointer capture
- [x] mouse/touch/stylus-compatible Pointer Events
- [x] pressure field captured
- [x] fast-pointer buffering through a mutable ref
- [x] pitch grid rendering
- [x] note labels on grid
- [x] beat grid
- [x] color strokes
- [x] drawing-resolution presets 1/2/3
- [x] undo last music input
- [x] clear music workspace

### Controls already wired
- [x] Key
- [x] Scale
- [x] Range abstraction
- [x] Octave offset
- [x] palette
- [x] drawing preset 1/2/3
- [x] rhythm preset •/••/•••
- [x] Tempo
- [x] Tap tempo
- [x] Quantize
- [x] Swing
- [x] Click On/Off state

### Audio / playback
- [x] drawing compiles to canonical NoteEvent[]
- [x] piano input compiles to canonical NoteEvent[]
- [x] drawing + piano events can coexist
- [x] WAV render consumes NoteEvent[] rather than canvas pixels
- [x] tuning-aware MIDI frequency conversion
- [x] metronome click rendering
- [x] play/pause behavior in music mode
- [x] waveform preview still works from generated WAV
- [x] music changes invalidate stale generated audio

### Compatibility
- [x] existing spectrogram text/upload/draw workflow preserved
- [x] existing piano UI preserved as secondary note input
- [x] music WAV download no longer downloads unrelated legacy canvas PNG

## Validated

Pure TypeScript music-domain modules were checked with strict TypeScript compilation in isolation:

- model types
- theory
- rhythm
- stroke compiler
- WAV renderer

A full Vite build could not be executed in the current isolated runtime because external npm/GitHub network access is unavailable. The repository itself remains the source of truth for the integrated React build.

## In progress / next

### Immediate
- [ ] separate realtime Web Audio transport from WAV generation
- [ ] playhead driven by AudioContext time
- [ ] true looping without rebuilding WAV
- [ ] metronome as realtime voice
- [ ] prevent metronome from leaking into exported WAV unless parity confirms it
- [ ] Tune UI and exact semantics abstraction
- [ ] background Paper / Sky / Photo
- [ ] custom color `+` flow

### Input
- [ ] three-octave virtual keyboard refactor onto NoteInputService
- [ ] Web MIDI capability / permission states
- [ ] MIDI note-on/note-off
- [ ] MIDI recording into loop

### Export
- [ ] dedicated clean WAV export
- [ ] MIDI file export
- [ ] parity verification of track structure

### Project state
- [ ] autosave local draft
- [ ] project schema migration
- [ ] record/take
- [ ] share
- [ ] gallery

### Audit items still requiring exact interactive measurement
- [ ] exact Key labels/enharmonics
- [ ] exact Range values
- [ ] Octave min/max
- [ ] Tune semantics/range
- [ ] exact Quantize values
- [ ] exact Swing values
- [ ] exact BPM limits/default
- [ ] exact `3` drawing resolution
- [ ] exact dot-preset mapping
- [ ] `+` behavior
- [ ] color -> sound mapping
- [ ] MIDI scale mapping
- [ ] export metronome policy

## Current architecture

```
MusicCanvas / Piano
       |
       v
 Stroke[] / keyboard events
       |
       v
  StrokeCompiler
       |
       v
   NoteEvent[]
       |
       +----> current WAV renderer
       |
       +----> next: realtime Transport
       |
       +----> next: MIDI exporter
       |
       +----> next: project/share persistence
```

## Next engineering milestone

The next milestone is **Realtime Transport**.

The current generated-WAV playback is useful as a deterministic bridge, but it should not become the final interactive engine. Realtime playback must move to Web Audio scheduling so that tempo changes, metronome, MIDI input and looping respond immediately without regenerating an audio file.
