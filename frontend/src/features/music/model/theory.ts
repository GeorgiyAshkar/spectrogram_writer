import type { ScaleName } from './types';

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  DB: 1,
  D: 2,
  'D#': 3,
  EB: 3,
  E: 4,
  F: 5,
  'F#': 6,
  GB: 6,
  G: 7,
  'G#': 8,
  AB: 8,
  A: 9,
  'A#': 10,
  BB: 10,
  B: 11,
};

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const SCALE_INTERVALS: Record<ScaleName, readonly number[]> = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  blues: [0, 3, 5, 6, 7, 10],
};

export function midiToFrequency(midi: number, tuningCents = 0): number {
  return 440 * 2 ** ((midi - 69 + tuningCents / 100) / 12);
}

export function noteNameToMidi(noteName: string): number | null {
  const match = /^([A-Ga-g])([#bB]?)(-?\d+)$/.exec(noteName.trim());
  if (!match) return null;

  const [, letter, accidental, octaveText] = match;
  const pitchClass = `${letter.toUpperCase()}${accidental.toUpperCase()}`;
  const semitone = NOTE_TO_SEMITONE[pitchClass];
  const octave = Number(octaveText);

  if (semitone === undefined || !Number.isInteger(octave)) return null;
  return (octave + 1) * 12 + semitone;
}

export function noteNameToFrequency(noteName: string, tuningCents = 0): number | null {
  const midi = noteNameToMidi(noteName);
  return midi === null ? null : midiToFrequency(midi, tuningCents);
}

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const pitchClass = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${SHARP_NAMES[pitchClass]}${octave}`;
}

export function tonicToPitchClass(key: string): number {
  const normalized = key.trim().toUpperCase();
  const value = NOTE_TO_SEMITONE[normalized];
  if (value === undefined) {
    throw new Error(`Unsupported key: ${key}`);
  }
  return value;
}

export function buildPitchRange(
  key: string,
  scale: ScaleName,
  baseOctave: number,
  rangeOctaves: number,
): number[] {
  const tonic = tonicToPitchClass(key);
  const intervals = SCALE_INTERVALS[scale];
  const safeRange = Math.max(1, Math.floor(rangeOctaves));
  const result: number[] = [];

  for (let octaveOffset = 0; octaveOffset < safeRange; octaveOffset += 1) {
    const octave = baseOctave + octaveOffset;
    const octaveBase = (octave + 1) * 12;

    for (const interval of intervals) {
      const absoluteSemitone = tonic + interval;
      const carry = Math.floor(absoluteSemitone / 12);
      const pitchClass = ((absoluteSemitone % 12) + 12) % 12;
      result.push(octaveBase + carry * 12 + pitchClass);
    }
  }

  return [...new Set(result)].sort((a, b) => a - b);
}

export function mapYToMidi(y: number, pitchRange: readonly number[]): number {
  if (pitchRange.length === 0) {
    throw new Error('Cannot map Y to pitch: pitch range is empty.');
  }

  const clamped = Math.min(1, Math.max(0, y));
  const highToLowIndex = Math.round(clamped * (pitchRange.length - 1));
  return pitchRange[pitchRange.length - 1 - highToLowIndex];
}


/**
 * Measured reference Freehand mapping at octave offset 0.
 *
 * Black-box spectral probing on 2026-09-22 established that:
 * - Scale does not change Freehand pitch.
 * - Range does not change Freehand pitch.
 * - Key transposes the whole curve.
 * - For Key=C the vertical curve is consistent with ~31 semitones
 *   from MIDI 79 at y=0 to MIDI 48 at y=1.
 *
 * The octave control is not measurable in the public web session, so
 * octaveOffset is kept as the conventional ±12-semitone transpose.
 */
export const FREEHAND_C_TOP_MIDI = 79;
export const FREEHAND_C_SPAN_SEMITONES = 31;

export function signedKeyTranspose(key: string): number {
  const pitchClass = tonicToPitchClass(key);
  return pitchClass > 6 ? pitchClass - 12 : pitchClass;
}

export function mapYToFreehandMidi(
  y: number,
  key: string,
  octaveOffset = 0,
): number {
  const clamped = Math.min(1, Math.max(0, y));
  return (
    FREEHAND_C_TOP_MIDI -
    FREEHAND_C_SPAN_SEMITONES * clamped +
    signedKeyTranspose(key) +
    octaveOffset * 12
  );
}

/**
 * @deprecated Use mapYToFreehandMidi(y, key, octaveOffset).
 * Retained only for source compatibility while callers migrate.
 */
export function mapYToContinuousMidi(y: number, pitchRange: readonly number[]): number {
  if (pitchRange.length === 0) {
    throw new Error('Cannot map Y to continuous pitch: pitch range is empty.');
  }
  const low = pitchRange[0];
  const high = pitchRange[pitchRange.length - 1];
  const clamped = Math.min(1, Math.max(0, y));
  return high - clamped * (high - low);
}
