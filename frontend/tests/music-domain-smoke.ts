import {
  DEFAULT_MUSIC_SETTINGS,
  buildPitchRange,
  compileStroke,
  mapYToMidi,
  mapYToContinuousMidi,
  midiToFrequency,
  noteNameToMidi,
  quantizeBeat,
  applySwing,
  type Stroke,
} from '../src/features/music/model';
import { renderNoteEventsToMidiBlob } from '../src/features/music/export/renderMidi';
import { renderNoteEventsToWavBlob } from '../src/features/music/audio/renderWav';
import {
  DEFAULT_VOICE_PROFILE,
  resolveVoiceProfile,
  sampleWaveform,
} from '../src/features/music/audio/voiceProfiles';
import { normalizeMusicDraft } from '../src/features/music/persistence/musicDraft';
import { buildAccompanimentEvents } from '../src/features/music/audio/accompaniment';
import {
  generateRandomDrawing,
  recolorInstrumentStrokes,
  restoreDefaultInstrumentColors,
} from '../src/features/music/drawing/drawingTools';
import {
  DEFAULT_INSTRUMENT_COLORS,
  PARITY_INSTRUMENT_SWATCHES,
  PARITY_RECOLOR_PRESETS,
} from '../src/features/music/parityConfig';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function approx(actual: number, expected: number, tolerance: number, message: string) {
  assert(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function testTheory() {
  assert(noteNameToMidi('C4') === 60, 'C4 must be MIDI 60');
  assert(noteNameToMidi('A4') === 69, 'A4 must be MIDI 69');
  assert(noteNameToMidi('Db4') === 61, 'Db4 must resolve enharmonically');
  assert(noteNameToMidi('bad') === null, 'Invalid note must return null');
  approx(midiToFrequency(69), 440, 1e-9, 'A4 frequency');

  const range = buildPitchRange('C', 'major', 4, 1);
  assert(
    JSON.stringify(range) === JSON.stringify([60, 62, 64, 65, 67, 69, 71]),
    'C major range must contain the expected seven notes',
  );

  const pentatonic = buildPitchRange('C', 'majorPentatonic', 4, 1);
  assert(
    JSON.stringify(pentatonic) === JSON.stringify([60, 62, 64, 67, 69]),
    'C major pentatonic must match the reference scale',
  );
  assert(mapYToMidi(0, range) === 71, 'Top of canvas must map to highest note');
  assert(mapYToMidi(1, range) === 60, 'Bottom of canvas must map to lowest note');
  approx(mapYToContinuousMidi(0.5, range), 65.5, 1e-9, 'Freehand midpoint must remain continuous');

  const expectedScaleSizes = {
    majorPentatonic: 5,
    minorPentatonic: 5,
    major: 7,
    minor: 7,
    harmonicMinor: 7,
    dorian: 7,
    phrygian: 7,
    lydian: 7,
    mixolydian: 7,
    blues: 6,
  } as const;
  for (const [scale, expectedSize] of Object.entries(expectedScaleSizes)) {
    const notes = buildPitchRange('C', scale as keyof typeof expectedScaleSizes, 4, 1);
    assert(notes.length === expectedSize, `${scale} scale size must match reference option`);
  }
}

function testRhythm() {
  approx(quantizeBeat(0.74, 0.5), 0.5, 1e-9, 'Quantize below midpoint');
  approx(quantizeBeat(0.76, 0.5), 1.0, 1e-9, 'Quantize above midpoint');
  approx(quantizeBeat(0.76, null), 0.76, 1e-9, 'Quantize off');
  approx(applySwing(0.5, 0.5, 0.5), 0.625, 1e-9, 'Odd subdivision swing delay');
  approx(applySwing(1.0, 0.5, 0.5), 1.0, 1e-9, 'Even subdivision remains straight');
  approx(applySwing(1 / 3, 1 / 3, 0.33), 1 / 3, 1e-9, 'Triplet grid ignores swing');
}

function testStrokeCompiler() {
  const settings = {
    ...DEFAULT_MUSIC_SETTINGS,
    rangeOctaves: 1,
    loopLengthBeats: 4,
    quantizeStepBeats: null,
    swing: 0,
  };

  const stroke: Stroke = {
    id: 'stroke-1',
    layerId: 'default',
    color: '#000000',
    createdAt: 0,
    points: [
      { x: 0, y: 1, t: 0 },
      { x: 1, y: 1, t: 1000 },
    ],
  };

  const events = compileStroke(stroke, settings, { sampleStepBeats: 0.25, baseOctave: 3 });
  assert(events.length === 1, 'Flat stroke should merge into one note event');
  assert(events[0].midi === 48, 'Bottom flat stroke should map to C3');
  approx(events[0].startBeat, 0, 1e-9, 'Flat stroke start beat');
  assert(events[0].durationBeats >= 3.9, 'Flat stroke should span essentially the whole loop');
}

function testFreehandCompiler() {
  const stroke: Stroke = {
    id: 'freehand-stroke',
    layerId: 'instrument:keys',
    color: '#1d9e75',
    createdAt: 0,
    points: [
      { x: 0, y: 0.31, t: 0 },
      { x: 1, y: 0.69, t: 1000 },
    ],
  };

  const normal = compileStroke(stroke, {
    ...DEFAULT_MUSIC_SETTINGS,
    rangeOctaves: 1,
    quantizeStepBeats: 0.5,
    freehandEnabled: false,
  }, { baseOctave: 4 });

  const freehand = compileStroke(stroke, {
    ...DEFAULT_MUSIC_SETTINGS,
    rangeOctaves: 1,
    quantizeStepBeats: 0.5,
    freehandEnabled: true,
  }, { baseOctave: 4 });

  assert(normal.every((event) => Number.isInteger(event.midi)), 'Normal drawing must stay on discrete scale notes');
  assert(
    freehand.some((event) => Math.abs(event.midi - Math.round(event.midi)) > 1e-6),
    'Freehand must produce fractional MIDI pitches between scale notes',
  );
  assert(
    freehand.some((event) => event.endMidi !== undefined && Math.abs(event.endMidi - event.midi) > 1e-6),
    'Freehand must preserve continuous pitch ramps inside note events',
  );
  assert(
    freehand.length > normal.length,
    'Freehand must sample pitch more densely than discrete drawing',
  );
}

function testVoiceProfiles() {
  assert(resolveVoiceProfile('color:#ff0000') === DEFAULT_VOICE_PROFILE, 'Unknown color layer must use neutral voice');
  approx(sampleWaveform('sine', Math.PI / 2), 1, 1e-9, 'Sine waveform sample');
  approx(sampleWaveform('square', Math.PI / 2), 1, 1e-9, 'Square waveform sample');
  approx(sampleWaveform('sawtooth', Math.PI), 0, 1e-9, 'Sawtooth midpoint sample');
}

function testAccompaniment() {
  assert(
    Math.abs((DEFAULT_MUSIC_SETTINGS.quantizeStepBeats ?? 0) - 1 / 3) < 1e-9,
    'Reference default quantize must be 1/8 triplet',
  );

  assert(
    buildAccompanimentEvents(DEFAULT_MUSIC_SETTINGS).length === 0,
    'Bass/Drums/Arpeggio must all be off by default',
  );

  const bass = buildAccompanimentEvents({ ...DEFAULT_MUSIC_SETTINGS, bassEnabled: true });
  assert(bass.length > 0 && bass.every((event) => event.layerId === 'accompaniment:bass'), 'Bass control must create only bass events');

  const drums = buildAccompanimentEvents({ ...DEFAULT_MUSIC_SETTINGS, drumsEnabled: true });
  assert(drums.some((event) => event.layerId === 'accompaniment:drums:kick'), 'Drums must include kick');
  assert(drums.some((event) => event.layerId === 'accompaniment:drums:snare'), 'Drums must include snare');
  assert(drums.some((event) => event.layerId === 'accompaniment:drums:hat'), 'Drums must include hat');

  const arpeggio = buildAccompanimentEvents({ ...DEFAULT_MUSIC_SETTINGS, arpeggioEnabled: true });
  assert(arpeggio.length > 0 && arpeggio.every((event) => event.layerId === 'accompaniment:arpeggio'), 'Arpeggio control must create arpeggio events');
}

function testReferencePalette() {
  assert(PARITY_INSTRUMENT_SWATCHES.length === 9, 'Reference must expose nine named instrument swatches');
  assert(PARITY_RECOLOR_PRESETS.length === 27, 'Reference recolor picker must expose 27 measured preset colors');
  assert(new Set(PARITY_RECOLOR_PRESETS).size === 27, 'Reference recolor preset colors must be unique');
  assert(PARITY_INSTRUMENT_SWATCHES[0].id === 'keys', 'Keys must be the default first instrument');
  assert(PARITY_INSTRUMENT_SWATCHES[8].id === '8bit', '8bit must remain the ninth instrument');
}

function testDrawingTools() {
  let index = 0;
  const sequence = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const random = () => sequence[index++ % sequence.length];

  const shuffled = generateRandomDrawing(
    { programMode: 2 },
    { ...DEFAULT_INSTRUMENT_COLORS },
    random,
    1234,
  );

  assert(shuffled.length >= 5 && shuffled.length <= 10, 'Shuffle must create a bounded random drawing');
  assert(shuffled.every((stroke) => stroke.programMode === 2), 'Shuffle must preserve the active program mode');
  assert(shuffled.every((stroke) => stroke.layerId.startsWith('instrument:')), 'Shuffle strokes must keep stable instrument identity');

  const target = shuffled[0];
  const instrumentId = target.layerId.replace('instrument:', '') as keyof typeof DEFAULT_INSTRUMENT_COLORS;
  const recolored = recolorInstrumentStrokes(shuffled, instrumentId, '#123456');
  assert(
    recolored.filter((stroke) => stroke.layerId === target.layerId).every((stroke) => stroke.color === '#123456'),
    'Recolor must update every stroke of the selected instrument',
  );
  assert(
    recolored.filter((stroke) => stroke.layerId !== target.layerId).every((stroke, i) => {
      const original = shuffled.filter((candidate) => candidate.layerId !== target.layerId)[i];
      return !original || stroke.color === original.color;
    }),
    'Recolor must leave other instruments untouched',
  );

  const restored = restoreDefaultInstrumentColors(recolored);
  for (const swatch of PARITY_INSTRUMENT_SWATCHES) {
    assert(restored.colors[swatch.id] === swatch.color, `${swatch.id} must restore the exact reference color`);
  }
  assert(
    restored.strokes.every((stroke) => {
      if (!stroke.layerId.startsWith('instrument:')) return true;
      const id = stroke.layerId.replace('instrument:', '') as keyof typeof DEFAULT_INSTRUMENT_COLORS;
      return stroke.color === DEFAULT_INSTRUMENT_COLORS[id];
    }),
    'Reset colors must recolor existing instrument strokes to reference defaults',
  );
}

function testDraftMigration() {
  const {
    programMode: _programMode,
    bassEnabled: _bassEnabled,
    drumsEnabled: _drumsEnabled,
    arpeggioEnabled: _arpeggioEnabled,
    ...legacyBaseSettings
  } = DEFAULT_MUSIC_SETTINGS;

  const legacy = normalizeMusicDraft({
    schemaVersion: 1,
    settings: {
      ...legacyBaseSettings,
      drawingResolutionPreset: 2,
      rhythmPreset: 3,
    },
    strokes: [],
    virtualKeyboardEvents: [],
    midiRecordedEvents: [],
    activeColor: '#171717',
    customColor: '#111827',
    backgroundKind: 'sky',
    savedAt: '2026-09-19T00:00:00.000Z',
  });

  assert(legacy?.schemaVersion === 2, 'Legacy draft must migrate to schema v2');
  assert(legacy?.background.kind === 'sky', 'Legacy sky background must survive migration');
  assert(legacy?.settings.programMode === 2, 'Legacy drawing preset must migrate to Program 2');
  assert(legacy?.settings.bassEnabled === false, 'Legacy rhythm guess must not become Bass');
  assert(legacy?.settings.drumsEnabled === false, 'Legacy rhythm guess must not become Drums');
  assert(legacy?.settings.arpeggioEnabled === false, 'Legacy rhythm guess must not become Arpeggio');

  const photoDataUrl = 'data:image/jpeg;base64,AA==';
  const current = normalizeMusicDraft({
    schemaVersion: 2,
    settings: DEFAULT_MUSIC_SETTINGS,
    strokes: [],
    virtualKeyboardEvents: [],
    midiRecordedEvents: [],
    activeColor: '#171717',
    customColor: '#111827',
    background: { kind: 'photo', dataUrl: photoDataUrl },
    savedAt: '2026-09-19T00:00:00.000Z',
  });

  assert(current?.background.kind === 'photo', 'Photo background must validate in schema v2');
  if (current?.background.kind === 'photo') {
    assert(current.background.dataUrl === photoDataUrl, 'Photo data must survive validation');
  }

  assert(normalizeMusicDraft({ schemaVersion: 999 }) === null, 'Unknown schema must be rejected');
}

function testExports() {
  const settings = {
    ...DEFAULT_MUSIC_SETTINGS,
    bpm: 120,
    loopLengthBeats: 4,
    metronomeEnabled: true,
  };
  const events = [
    {
      id: 'n1',
      layerId: 'default',
      midi: 60,
      velocity: 0.8,
      startBeat: 0,
      durationBeats: 1,
    },
  ];

  const wav = renderNoteEventsToWavBlob(events, settings);
  assert(wav.type === 'audio/wav', 'WAV export MIME type');
  assert(wav.size > 44, 'WAV export must contain audio data beyond RIFF header');

  const midi = renderNoteEventsToMidiBlob(events, settings);
  assert(midi.type === 'audio/midi', 'MIDI export MIME type');
  assert(midi.size > 20, 'MIDI export must contain header and track data');
}

testTheory();
testRhythm();
testStrokeCompiler();
testFreehandCompiler();
testVoiceProfiles();
testAccompaniment();
testReferencePalette();
testDrawingTools();
testDraftMigration();
testExports();

console.log('music-domain-smoke: all checks passed');
