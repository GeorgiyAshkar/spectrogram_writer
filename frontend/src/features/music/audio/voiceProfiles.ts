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

export const PARITY_LAYER_VOICE_PROFILES: Readonly<Record<string, VoiceProfile>> = {
  // Instrument identities/colors are measured reference facts.
  // The synthesis recipes below are deliberately clean-room approximations.
  'instrument:keys': profile('sine', 0.92, 0.008, 0.12, 0.62, [
    { ratio: 1, gain: 1 },
    { ratio: 2, gain: 0.34 },
    { ratio: 3, gain: 0.12 },
  ]),
  'instrument:pluck': profile('triangle', 0.86, 0.004, 0.08, 0.34, [
    { ratio: 1, gain: 1 },
    { ratio: 2, gain: 0.28 },
    { ratio: 3, gain: 0.11 },
  ]),
  'instrument:bell': profile('sine', 0.74, 0.003, 0.42, 0.4, [
    { ratio: 1, gain: 1 },
    { ratio: 2.01, gain: 0.42 },
    { ratio: 3.98, gain: 0.2 },
  ]),
  'instrument:marimba': profile('triangle', 0.78, 0.003, 0.16, 0.3, [
    { ratio: 1, gain: 1 },
    { ratio: 2, gain: 0.2 },
  ]),
  'instrument:flute': profile('sine', 0.72, 0.045, 0.12, 0.86, [
    { ratio: 1, gain: 1 },
    { ratio: 2, gain: 0.08 },
  ]),
  'instrument:strings': profile('sawtooth', 0.42, 0.08, 0.18, 0.9, [
    { ratio: 1, gain: 1 },
    { ratio: 2, gain: 0.12 },
  ]),
  'instrument:chime': profile('sine', 0.66, 0.003, 0.5, 0.3, [
    { ratio: 1, gain: 1 },
    { ratio: 2.7, gain: 0.28 },
    { ratio: 4.1, gain: 0.16 },
  ]),
  'instrument:bass': profile('triangle', 0.9, 0.01, 0.11, 0.72, [
    { ratio: 1, gain: 1 },
    { ratio: 2, gain: 0.18 },
  ]),
  'instrument:8bit': profile('square', 0.48, 0.002, 0.025, 0.95, [
    { ratio: 1, gain: 1 },
  ]),

  // Legacy color-based layers remain readable for existing saved/shared projects.
  'color:#1d9e75': profile('sine', 0.92, 0.008, 0.12, 0.62, [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.34 }, { ratio: 3, gain: 0.12 }]),
  'color:#d85a30': profile('triangle', 0.86, 0.004, 0.08, 0.34, [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.28 }, { ratio: 3, gain: 0.11 }]),
  'color:#7f77dd': profile('sine', 0.74, 0.003, 0.42, 0.4, [{ ratio: 1, gain: 1 }, { ratio: 2.01, gain: 0.42 }, { ratio: 3.98, gain: 0.2 }]),
  'color:#ef9f27': profile('triangle', 0.78, 0.003, 0.16, 0.3, [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.2 }]),
  'color:#3e5ec6': profile('sine', 0.72, 0.045, 0.12, 0.86, [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.08 }]),
  'color:#de7bae': profile('sawtooth', 0.42, 0.08, 0.18, 0.9, [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.12 }]),
  'color:#85bee8': profile('sine', 0.66, 0.003, 0.5, 0.3, [{ ratio: 1, gain: 1 }, { ratio: 2.7, gain: 0.28 }, { ratio: 4.1, gain: 0.16 }]),
  'color:#33312b': profile('triangle', 0.9, 0.01, 0.11, 0.72, [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.18 }]),
  'color:#f4be82': profile('square', 0.48, 0.002, 0.025, 0.95, [{ ratio: 1, gain: 1 }]),

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
