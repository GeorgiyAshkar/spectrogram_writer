export type VoiceWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export type VoicePartial = {
  ratio: number;
  gain: number;
};

export type VoiceProfile = {
  waveform: VoiceWaveform;
  gain: number;
  attackSeconds: number;
  releaseSeconds: number;
  sustain: number;
  partials: readonly VoicePartial[];
};

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  waveform: 'sine',
  gain: 1,
  attackSeconds: 0.012,
  releaseSeconds: 0.05,
  sustain: 1,
  partials: [{ ratio: 1, gain: 1 }],
};

const profile = (
  waveform: VoiceWaveform,
  gain: number,
  attackSeconds: number,
  releaseSeconds: number,
  sustain: number,
  partials: readonly VoicePartial[],
): VoiceProfile => ({
  waveform,
  gain,
  attackSeconds,
  releaseSeconds,
  sustain,
  partials,
});

export function amplitudeFromRelativeDb(relativeDb: number): number {
  return 10 ** (relativeDb / 20);
}

const measuredPartials = (
  entries: readonly (readonly [ratio: number, relativeDb: number])[],
): readonly VoicePartial[] =>
  entries.map(([ratio, relativeDb]) => ({
    ratio,
    gain: amplitudeFromRelativeDb(relativeDb),
  }));

/**
 * Harmonic ratios below are black-box measurements of the public reference
 * captured on 2026-09-22 from a single drawn note near G4.
 *
 * Envelope values remain clean-room approximations until attack/release can be
 * isolated independently from the reference's sustained loop playback.
 */
const MEASURED_INSTRUMENT_PARTIALS = {
  keys: measuredPartials([
    [1, 0],
    [2, -8.8],
    [3, -16.8],
  ]),
  pluck: measuredPartials([
    [1, 0],
    [3, -17.5],
    [5, -30.2],
    [7, -43.3],
    [9, -52.1],
  ]),
  bell: measuredPartials([
    [1, 0],
    [3, -13.1],
    [5, -26.7],
    [7, -46.6],
    [9, -63.8],
  ]),
  marimba: measuredPartials([
    [1, 0],
    [2, -45.7],
    [3, -45.2],
    [4, -10.3],
    [6, -45.5],
  ]),
  flute: measuredPartials([
    [1, 0],
    [2, -20.8],
    [3, -51.7],
  ]),
  strings: measuredPartials([
    [1, 0],
    [3, -13.1],
    [5, -37.8],
    [7, -36.6],
    [9, -46.3],
  ]),
  chime: measuredPartials([
    [1, 0],
    [2, -53.3],
    [3, -49.5],
    [4, -13.0],
    [6, -54.1],
  ]),
  bass: measuredPartials([
    [1, 0],
    [2, -13.3],
    [3, -51.8],
    [4, -53.3],
  ]),
  '8bit': measuredPartials([
    [1, 0],
    [3, -13.6],
    [5, -28.4],
    [7, -38.8],
    [9, -46.2],
  ]),
} as const;

const KEYS_PROFILE = profile('sine', 0.92, 0.008, 0.12, 0.62, MEASURED_INSTRUMENT_PARTIALS.keys);
const PLUCK_PROFILE = profile('sine', 0.86, 0.004, 0.08, 0.34, MEASURED_INSTRUMENT_PARTIALS.pluck);
const BELL_PROFILE = profile('sine', 0.74, 0.003, 0.42, 0.4, MEASURED_INSTRUMENT_PARTIALS.bell);
const MARIMBA_PROFILE = profile('sine', 0.78, 0.003, 0.16, 0.3, MEASURED_INSTRUMENT_PARTIALS.marimba);
const FLUTE_PROFILE = profile('sine', 0.72, 0.045, 0.12, 0.86, MEASURED_INSTRUMENT_PARTIALS.flute);
const STRINGS_PROFILE = profile('sine', 0.42, 0.08, 0.18, 0.9, MEASURED_INSTRUMENT_PARTIALS.strings);
const CHIME_PROFILE = profile('sine', 0.66, 0.003, 0.5, 0.3, MEASURED_INSTRUMENT_PARTIALS.chime);
const BASS_PROFILE = profile('sine', 0.9, 0.01, 0.11, 0.72, MEASURED_INSTRUMENT_PARTIALS.bass);
const BIT8_PROFILE = profile('sine', 0.48, 0.002, 0.025, 0.95, MEASURED_INSTRUMENT_PARTIALS['8bit']);

export const PARITY_LAYER_VOICE_PROFILES: Readonly<Record<string, VoiceProfile>> = {
  'instrument:keys': KEYS_PROFILE,
  'instrument:pluck': PLUCK_PROFILE,
  'instrument:bell': BELL_PROFILE,
  'instrument:marimba': MARIMBA_PROFILE,
  'instrument:flute': FLUTE_PROFILE,
  'instrument:strings': STRINGS_PROFILE,
  'instrument:chime': CHIME_PROFILE,
  'instrument:bass': BASS_PROFILE,
  'instrument:8bit': BIT8_PROFILE,

  // Legacy color-based layers remain readable for existing saved/shared projects.
  'color:#1d9e75': KEYS_PROFILE,
  'color:#d85a30': PLUCK_PROFILE,
  'color:#7f77dd': BELL_PROFILE,
  'color:#ef9f27': MARIMBA_PROFILE,
  'color:#3e5ec6': FLUTE_PROFILE,
  'color:#de7bae': STRINGS_PROFILE,
  'color:#85bee8': CHIME_PROFILE,
  'color:#33312b': BASS_PROFILE,
  'color:#f4be82': BIT8_PROFILE,

  'accompaniment:bass': profile('triangle', 0.86, 0.006, 0.1, 0.68, [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.14 }]),
  'accompaniment:drums:kick': profile('sine', 1, 0.002, 0.05, 0.2, [{ ratio: 1, gain: 1 }]),
  'accompaniment:drums:snare': profile('square', 0.28, 0.002, 0.045, 0.18, [{ ratio: 1, gain: 1 }, { ratio: 1.7, gain: 0.36 }]),
  'accompaniment:drums:hat': profile('square', 0.12, 0.002, 0.025, 0.12, [{ ratio: 1, gain: 1 }, { ratio: 2.4, gain: 0.32 }]),
  'accompaniment:arpeggio': profile('triangle', 0.62, 0.004, 0.08, 0.52, [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.16 }]),
};

export function resolveVoiceProfile(layerId: string): VoiceProfile {
  return PARITY_LAYER_VOICE_PROFILES[layerId] ?? DEFAULT_VOICE_PROFILE;
}

export function sampleWaveform(waveform: VoiceWaveform, phase: number): number {
  const normalized = phase / (2 * Math.PI);
  const cycle = normalized - Math.floor(normalized);

  switch (waveform) {
    case 'triangle':
      return 1 - 4 * Math.abs(cycle - 0.5);
    case 'square':
      return cycle < 0.5 ? 1 : -1;
    case 'sawtooth':
      return 2 * cycle - 1;
    case 'sine':
    default:
      return Math.sin(phase);
  }
}

export function normalizedPartialGain(profile: VoiceProfile): number {
  const total = profile.partials.reduce((sum, partial) => sum + Math.abs(partial.gain), 0);
  return total > 1 ? 1 / total : 1;
}

export function sampleVoice(profile: VoiceProfile, phase: number): number {
  const normalization = normalizedPartialGain(profile);
  let sample = 0;
  for (const partial of profile.partials) {
    sample +=
      sampleWaveform(profile.waveform, phase * partial.ratio) *
      partial.gain *
      normalization;
  }
  return sample;
}

export function envelopeAt(
  profile: VoiceProfile,
  timeSeconds: number,
  durationSeconds: number,
): number {
  const duration = Math.max(0.001, durationSeconds);
  const attack = Math.max(0.001, profile.attackSeconds);
  const release = Math.max(0.001, Math.min(profile.releaseSeconds, duration));
  const attackLevel = Math.min(1, Math.max(0, timeSeconds / attack));
  const timeToEnd = Math.max(0, duration - timeSeconds);
  const releaseLevel = Math.min(1, timeToEnd / release);

  const body = profile.sustain + (1 - profile.sustain) * attackLevel;
  return Math.min(attackLevel, releaseLevel) * body;
}
