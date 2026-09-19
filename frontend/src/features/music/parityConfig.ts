import type { DrawingResolutionPreset, RhythmPreset } from './model/types';

export const PARITY_KEY_OPTIONS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

export const PARITY_SCALE_OPTIONS = [
  { value: 'majorPentatonic', referenceValue: 'pentatonic', label: 'Major pentatonic' },
  { value: 'minorPentatonic', referenceValue: 'minor', label: 'Minor pentatonic' },
  { value: 'major', referenceValue: 'major', label: 'Major' },
  { value: 'minor', referenceValue: 'natural', label: 'Minor' },
  { value: 'harmonicMinor', referenceValue: 'harmonic', label: 'Harmonic minor' },
  { value: 'dorian', referenceValue: 'dorian', label: 'Dorian' },
  { value: 'phrygian', referenceValue: 'phrygian', label: 'Phrygian' },
  { value: 'lydian', referenceValue: 'lydian', label: 'Lydian' },
  { value: 'mixolydian', referenceValue: 'mixolydian', label: 'Mixolydian' },
  { value: 'blues', referenceValue: 'blues', label: 'Blues' },
] as const;

/**
 * Exact original Range labels remain VERIFY.
 * These values are isolated here so parity measurements can replace them
 * without touching theory/audio code.
 */
export const PARITY_RANGE_OPTIONS = [
  { value: 1, label: '1 octave' },
  { value: 2, label: '2 octaves' },
  { value: 3, label: '3 octaves' },
] as const;

/**
 * Exact original BPM range/default remains VERIFY.
 */
export const PARITY_BPM = {
  min: 60,
  max: 200,
  step: 1,
  default: 120,
} as const;

export const DRAWING_PRESETS: readonly DrawingResolutionPreset[] = [1, 2, 3];
export const RHYTHM_PRESETS: readonly RhythmPreset[] = [1, 2, 3];

export const DEFAULT_MUSIC_COLORS = [
  '#171717',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
] as const;


export const PARITY_QUANTIZE_OPTIONS = [
  { label: '1/4', referenceValue: 1, stepBeats: 1 },
  { label: '1/8', referenceValue: 2, stepBeats: 0.5 },
  { label: '1/8 triplet', referenceValue: 3, stepBeats: 1 / 3 },
  { label: '1/16', referenceValue: 4, stepBeats: 0.25 },
  { label: '1/16 triplet', referenceValue: 6, stepBeats: 1 / 6 },
  { label: '1/32', referenceValue: 8, stepBeats: 0.125 },
] as const;

export const PARITY_SWING_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: 'Light', value: 0.1 },
  { label: 'Medium', value: 0.2 },
  { label: 'Hard', value: 0.33 },
] as const;

/**
 * Provisional mapping only: audit confirms the dot controls are rhythm-related,
 * but the exact original subdivision mapping still needs interactive measurement.
 */
export const PROVISIONAL_RHYTHM_STEP_BEATS: Record<RhythmPreset, number | null> = {
  1: null,
  2: 0.5,
  3: 0.25,
};


/**
 * Tune is modeled as global cents offset until the exact original input semantics
 * are measured interactively.
 */
export const PARITY_TUNE_CENTS = {
  min: -50,
  max: 50,
  step: 1,
  default: 0,
} as const;
