import type { ProgramMode } from './model/types';

export const PARITY_KEY_OPTIONS = [
  'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
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

export const PARITY_RANGE_OPTIONS = [
  { value: 1, label: '1 octave' },
  { value: 2, label: '2 octaves' },
  { value: 3, label: '3 octaves' },
] as const;

export const PARITY_BPM = {
  min: 60,
  max: 200,
  step: 1,
  default: 120,
} as const;

export const PARITY_PROGRAMS: ReadonlyArray<{
  value: ProgramMode;
  label: string;
  tooltip: string;
}> = [
  { value: 1, label: '1', tooltip: 'Drawing mode' },
  { value: 2, label: '2', tooltip: 'Pixel mode' },
  { value: 3, label: '3', tooltip: 'Video mode' },
];

export const PARITY_ACCOMPANIMENT_CONTROLS = [
  { setting: 'bassEnabled', label: '•', tooltip: 'Bass' },
  { setting: 'drumsEnabled', label: '••', tooltip: 'Drums' },
  { setting: 'arpeggioEnabled', label: '•••', tooltip: 'Arpeggio' },
] as const;

export const PARITY_INSTRUMENT_SWATCHES = [
  { id: 'keys', label: 'keys', color: '#1d9e75' },
  { id: 'pluck', label: 'pluck', color: '#d85a30' },
  { id: 'bell', label: 'bell', color: '#7f77dd' },
  { id: 'marimba', label: 'marimba', color: '#ef9f27' },
  { id: 'flute', label: 'flute', color: '#3e5ec6' },
  { id: 'strings', label: 'strings', color: '#de7bae' },
  { id: 'chime', label: 'chime', color: '#85bee8' },
  { id: 'bass', label: 'bass', color: '#33312b' },
  { id: '8bit', label: '8bit', color: '#f4be82' },
] as const;

export const DEFAULT_MUSIC_COLORS = PARITY_INSTRUMENT_SWATCHES.map((swatch) => swatch.color);


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

export const PARITY_TUNE_CENTS = {
  min: -50,
  max: 50,
  step: 1,
  default: 0,
} as const;
