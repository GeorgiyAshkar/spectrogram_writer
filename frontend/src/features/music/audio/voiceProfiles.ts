export type VoiceWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export type VoicePartial = {
  ratio: number;
  gain: number;
  phaseRadians?: number;
};

export type VoiceProfile = {
  waveform: VoiceWaveform;
  gain: number;
  attackSeconds: number;
  decaySeconds: number;
  releaseSeconds: number;
  sustain: number;
  partials: readonly VoicePartial[];
};

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  waveform: 'sine',
  gain: 1,
  attackSeconds: 0.012,
  decaySeconds: 0.12,
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
  decaySeconds = 0.12,
): VoiceProfile => ({
  waveform,
  gain,
  attackSeconds,
  decaySeconds,
  releaseSeconds,
  sustain,
  partials,
});

export function amplitudeFromRelativeDb(relativeDb: number): number {
  return 10 ** (relativeDb / 20);
}

const measuredPartials = (
  entries: readonly (readonly [ratio: number, relativeDb: number, phaseRadians?: number])[],
): readonly VoicePartial[] =>
  entries.map(([ratio, relativeDb, phaseRadians = 0]) => ({
    ratio,
    gain: amplitudeFromRelativeDb(relativeDb),
    phaseRadians,
  }));

/**
 * Harmonic ratios below are black-box measurements of the public reference
 * captured on 2026-09-22 from a single drawn note near G4.
 *
 * Attack values are measured from the public reference's 2%→90% RMS rise
 * using an isolated drawn note. Decay/sustain/release remain clean-room
 * approximations until the shorter-note release probe is complete.
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

const KEYS_PROFILE = profile('sine', 0.92, 0.080, 0.12, 0.62, MEASURED_INSTRUMENT_PARTIALS.keys);
const PLUCK_PROFILE = profile('sine', 0.86, 0.082, 0.08, 0.34, MEASURED_INSTRUMENT_PARTIALS.pluck);
const BELL_PROFILE = profile('sine', 0.74, 0.078, 0.42, 0.4, MEASURED_INSTRUMENT_PARTIALS.bell);
const MARIMBA_PROFILE = profile('sine', 0.78, 0.079, 0.16, 0.3, MEASURED_INSTRUMENT_PARTIALS.marimba);
const FLUTE_PROFILE = profile('sine', 0.72, 0.180, 0.12, 0.86, MEASURED_INSTRUMENT_PARTIALS.flute);
const STRINGS_PROFILE = profile('sine', 0.42, 0.317, 0.18, 0.9, MEASURED_INSTRUMENT_PARTIALS.strings);
const CHIME_PROFILE = profile('sine', 0.66, 0.083, 0.5, 0.3, MEASURED_INSTRUMENT_PARTIALS.chime);
const BASS_PROFILE = profile('sine', 0.9, 0.136, 0.11, 0.72, MEASURED_INSTRUMENT_PARTIALS.bass);
const BIT8_PROFILE = profile('sine', 0.48, 0.132, 0.025, 0.95, MEASURED_INSTRUMENT_PARTIALS['8bit']);

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

export type PeriodicWaveCoefficients = {
  real: Float32Array;
  imag: Float32Array;
};

/**
 * Convert an integer-harmonic sine profile into Web Audio Fourier
 * coefficients. Returns null for non-sine or non-integer profiles.
 */
export function periodicWaveCoefficients(
  profile: VoiceProfile,
): PeriodicWaveCoefficients | null {
  if (profile.waveform !== 'sine' || profile.partials.length === 0) return null;
  if (
    profile.partials.some(
      (partial) =>
        !Number.isInteger(partial.ratio) ||
        partial.ratio < 1 ||
        partial.ratio > 64,
    )
  ) {
    return null;
  }

  const maxHarmonic = Math.max(...profile.partials.map((partial) => partial.ratio));
  const real = new Float32Array(maxHarmonic + 1);
  const imag = new Float32Array(maxHarmonic + 1);
  const normalization = normalizedPartialGain(profile);

  for (const partial of profile.partials) {
    const amplitude = partial.gain * normalization;
    const phase = partial.phaseRadians ?? 0;

    // A*sin(nωt+φ) = A*sin(nωt)*cosφ + A*cos(nωt)*sinφ
    real[partial.ratio] += amplitude * Math.sin(phase);
    imag[partial.ratio] += amplitude * Math.cos(phase);
  }

  return { real, imag };
}

export function sampleVoice(profile: VoiceProfile, phase: number): number {
  const normalization = normalizedPartialGain(profile);
  let sample = 0;
  for (const partial of profile.partials) {
    sample +=
      sampleWaveform(
        profile.waveform,
        phase * partial.ratio + (partial.phaseRadians ?? 0),
      ) *
      partial.gain *
      normalization;
  }
  return sample;
}

export const ENVELOPE_EPSILON = 1e-4;

export type ScheduledEnvelope = {
  durationSeconds: number;
  attackEndSeconds: number;
  decayEndSeconds: number;
  releaseStartSeconds: number;
  sustain: number;
};

export function scheduledEnvelope(
  profile: VoiceProfile,
  durationSeconds: number,
): ScheduledEnvelope {
  const duration = Math.max(0.001, durationSeconds);
  const attack = Math.min(duration, Math.max(0.001, profile.attackSeconds));
  const release = Math.min(duration, Math.max(0.001, profile.releaseSeconds));
  const releaseStart = Math.max(attack, duration - release);
  const decay = Math.max(0.001, profile.decaySeconds);
  const decayEnd = Math.min(releaseStart, attack + decay);

  return {
    durationSeconds: duration,
    attackEndSeconds: attack,
    decayEndSeconds: decayEnd,
    releaseStartSeconds: releaseStart,
    sustain: Math.min(1, Math.max(ENVELOPE_EPSILON, profile.sustain)),
  };
}

function exponentialInterpolation(start: number, end: number, progress: number): number {
  const safeStart = Math.max(ENVELOPE_EPSILON, start);
  const safeEnd = Math.max(ENVELOPE_EPSILON, end);
  const p = Math.min(1, Math.max(0, progress));
  return safeStart * (safeEnd / safeStart) ** p;
}

/**
 * Normalized envelope used by offline WAV rendering.
 *
 * It intentionally mirrors the scheduled Web Audio gain automation:
 * exponential attack -> linear decay -> sustain hold -> exponential release.
 */
export function envelopeAt(
  profile: VoiceProfile,
  timeSeconds: number,
  durationSeconds: number,
): number {
  const shape = scheduledEnvelope(profile, durationSeconds);
  const t = Math.min(shape.durationSeconds, Math.max(0, timeSeconds));

  if (t <= shape.attackEndSeconds) {
    const progress = shape.attackEndSeconds > 0
      ? t / shape.attackEndSeconds
      : 1;
    return exponentialInterpolation(ENVELOPE_EPSILON, 1, progress);
  }

  if (t < shape.decayEndSeconds) {
    const decayDuration = shape.decayEndSeconds - shape.attackEndSeconds;
    if (decayDuration <= 1e-9) return shape.sustain;
    const progress = (t - shape.attackEndSeconds) / decayDuration;
    return 1 + (shape.sustain - 1) * progress;
  }

  if (t < shape.releaseStartSeconds) {
    return shape.sustain;
  }

  const releaseDuration = shape.durationSeconds - shape.releaseStartSeconds;
  if (releaseDuration <= 1e-9) return ENVELOPE_EPSILON;
  const progress = (t - shape.releaseStartSeconds) / releaseDuration;
  return exponentialInterpolation(shape.sustain, ENVELOPE_EPSILON, progress);
}
