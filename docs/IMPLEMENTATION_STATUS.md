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
- [x] project versioning baseline
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
- [x] mouse/touch/stylus Pointer Events
- [x] pressure capture
- [x] fast-pointer buffering through mutable ref
- [x] pitch grid
- [x] note labels
- [x] beat grid
- [x] color strokes
- [x] drawing-resolution presets 1/2/3
- [x] preset snapshot stored per stroke
- [x] presets 2/3 rendered as grid/pixel strokes
- [x] realtime playhead
- [x] Paper background
- [x] Sky background
- [x] user Photo background
- [x] stroke-only undo matching reference behavior
- [x] Cmd/Ctrl+Z stroke undo
- [x] clear workspace

### Controls
- [x] Key
- [x] Scale
- [x] Range abstraction
- [x] Octave offset
- [x] palette
- [x] custom color `+`
- [x] drawing preset 1/2/3
- [x] rhythm preset •/••/•••
- [x] Tempo numeric input
- [x] linked Tempo range slider
- [x] Tap tempo
- [x] Quantize
- [x] Swing
- [x] realtime Click On/Off
- [x] Tune abstraction in cents
- [x] MIDI in On/Off with visible status

### Realtime audio / transport
- [x] Web Audio realtime engine
- [x] `AudioContext.currentTime` scheduling
- [x] look-ahead scheduler
- [x] true loop playback
- [x] pause/resume
- [x] seek
- [x] realtime playhead via requestAnimationFrame
- [x] realtime metronome
- [x] accent on first beat
- [x] live note audition
- [x] active voice cleanup
- [x] mode-change cleanup
- [x] tempo/settings changes restart scheduler at current beat
- [x] no generated WAV required for interactive playback

### Virtual keyboard
- [x] refactored to three octaves
- [x] octave follows current octave offset
- [x] live note-on/note-off
- [x] mouse/touch/stylus
- [x] keyboard activation with Enter/Space
- [x] recording played notes into current loop
- [x] same canonical `NoteEvent[]` as drawing/MIDI

### Web MIDI
- [x] capability detection
- [x] permission flow
- [x] unsupported state
- [x] denied state
- [x] no-device state
- [x] connected-device list
- [x] note-on
- [x] note-off
- [x] velocity
- [x] live audition
- [x] loop recording
- [x] disconnect/disable releases held notes
- [x] device notes enter canonical `NoteEvent[]`

### Export
- [x] WAV render from canonical `NoteEvent[]`
- [x] WAV excludes metronome by default until parity confirms otherwise
- [x] MIDI Standard MIDI File export
- [x] tempo meta event
- [x] note-on/note-off
- [x] velocity
- [x] deterministic PPQ
- [x] WAV and MIDI consume the same timeline

### Persistence
- [x] versioned local draft schema
- [x] autosave
- [x] restore after reload
- [x] settings persistence
- [x] strokes persistence
- [x] virtual-keyboard event persistence
- [x] MIDI event persistence
- [x] color/background persistence
- [x] corrupted/unavailable localStorage fallback
- [x] Photo intentionally falls back to Paper after reload (blob URL is not durable)

### Take / record
- [x] canvas video capture
- [x] realtime Web Audio capture bus
- [x] MediaRecorder capability detection
- [x] WebM/MP4 candidate selection
- [x] record/stop workflow
- [x] take download
- [x] recorder cleanup on mode change/clear

### Share / Gallery MVP
- [x] FastAPI publish endpoint
- [x] FastAPI gallery list endpoint
- [x] FastAPI gallery detail endpoint
- [x] SQLite storage with no new dependency
- [x] project-size limit
- [x] title validation
- [x] author validation
- [x] share UI with title + handle
- [x] public project ID
- [x] copyable `?piece=<id>` link
- [x] automatic shared-project loading from URL
- [x] gallery list UI
- [x] safe confirmation before replacing non-empty local work
- [x] schema-version check on load
- [x] responsive share/gallery layout

### Verification / CI
- [x] focused TypeScript music check
- [x] executable music-domain smoke tests
- [x] theory mapping assertions
- [x] quantize/swing assertions
- [x] StrokeCompiler assertions
- [x] WAV/MIDI export smoke assertions
- [x] backend SQLite gallery unit tests
- [x] GitHub Actions frontend + backend workflow
- [x] clean checkout uses npm ci
- [x] frontend build verified green in CI
- [x] backend tests verified green in CI
- [x] tracked frontend/node_modules removed

### Compatibility
- [x] existing spectrogram text/upload/draw workflow preserved
- [x] old spectrogram WAV pipeline preserved
- [x] music editor isolated from legacy raster editor
- [x] music WAV download no longer downloads unrelated legacy canvas PNG

## Important implementation decisions

### One canonical timeline

All musical inputs now converge on:

```
MusicCanvas strokes
Virtual keyboard
Web MIDI
      |
      v
   NoteEvent[]
      |
      +--> RealtimeMusicTransport
      +--> WAV renderer
      +--> MIDI exporter
      +--> persistence/share
```

There is no longer a separate musical interpretation for each output.

### Interactive playback is not WAV playback

Generated WAV is export-only. Interactive playback uses Web Audio scheduling.

### Unknown parity values are configuration

Values not yet measured exactly from the original are isolated in `parityConfig.ts`, including provisional:

- BPM limits/default;
- Range options;
- Quantize options;
- Swing values;
- Tune cents range;
- rhythm preset mapping.

They can be replaced without changing the canvas/compiler/audio architecture.

### Gallery persistence

Gallery MVP uses SQLite at `data/music_gallery.sqlite3` by default or `MUSIC_GALLERY_DB` when configured.

This is appropriate for the current single-instance MVP. A horizontally scaled public deployment should move gallery persistence to PostgreSQL/object storage.

## Validation status

Pure domain/audio/export modules are intentionally dependency-light and TypeScript-strict.

A complete `npm run build` has not been executed in the current isolated execution environment because the repository dependencies cannot be fetched from npm/GitHub from that environment. Integrated browser smoke testing remains required on a normal development machine or CI runner.

Backend gallery code uses only Python stdlib SQLite plus the FastAPI/Pydantic stack already present in the project.

## Remaining work

### Exact parity audit

Evidence tracking: `docs/PARITY_EVIDENCE_MATRIX.md`


- [ ] exact Key labels/enharmonics
- [ ] exact Range values
- [ ] Octave min/max
- [ ] exact Tune semantics/range
- [ ] exact Quantize values
- [ ] exact Swing values
- [ ] exact BPM limits/default
- [ ] exact drawing preset 3 grid density (visual pixel behavior is implemented)
- [ ] exact •/••/••• mapping
- [ ] exact custom-color `+` interaction
- [ ] color -> sound mapping
- [ ] exact MIDI scale behavior
- [ ] exact export metronome policy
- [ ] exact MIDI track structure in original
- [ ] exact take codec/container in original
- [ ] exact share validation in original
- [ ] exact gallery item behavior in original

### Product hardening
- [ ] chronological unified undo across strokes/virtual keyboard/MIDI
- [ ] redo
- [ ] persistent Photo background via IndexedDB or backend asset
- [ ] gallery pagination UI
- [ ] gallery moderation/rate limiting for public deployment
- [ ] gallery preview thumbnails
- [ ] configurable instrument/timbre rack if parity audit confirms color/timbre mapping
- [ ] full browser smoke test
- [ ] mobile Safari take/MIDI compatibility test
- [ ] automated unit/integration tests

## Next milestone

The core implementation is now far enough that the next milestone should be **Parity Hardening**, not another architectural rewrite.

The remaining work should focus on:

1. exact interactive measurements from the original service;
2. replacing provisional values in `parityConfig.ts`;
3. fixing any behavioral discrepancies found side-by-side;
4. adding regression tests after those values stabilize.
