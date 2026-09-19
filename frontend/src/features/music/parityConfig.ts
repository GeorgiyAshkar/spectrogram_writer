import type { DrawingResolutionPreset, RhythmPreset } from './model/types';

export const PARITY_KEY_OPTIONS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

export const PARITY_SCALE_OPTIONS = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
] as const;

/**
 * Exact original Range labels remain VERIFY.
 * These values are isolated here so parity measurements can replace them
 * without touching theory/audio code.
 */
export const PROVISIONAL_RANGE_OPTIONS = [1, 2, 3] as const;

/**
 * Exact original BPM range/default remains VERIFY.
 */
export const PROVISIONAL_BPM = {
  min: 30,
  max: 300,
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


export const PROVISIONAL_QUANTIZE_OPTIONS = [
  { label: 'Off', value: null },
  { label: '1/4', value: 1 },
  { label: '1/8', value: 0.5 },
  { label: '1/16', value: 0.25 },
] as const;

export const PROVISIONAL_SWING_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: 'Light', value: 0.25 },
  { label: 'Heavy', value: 0.5 },
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
export const PROVISIONAL_TUNE_CENTS = {
  min: -100,
  max: 100,
  step: 1,
} as const;
