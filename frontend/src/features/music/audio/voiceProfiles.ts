export type VoiceWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export type VoiceProfile = {
  waveform: VoiceWaveform;
  gain: number;
};

/**
 * Color -> timbre mapping is still VERIFY for the reference product.
 * Keep all layers neutral until direct parity evidence is available.
 */
export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  waveform: 'sine',
  gain: 1,
};

export const PARITY_LAYER_VOICE_PROFILES: Readonly<Record<string, VoiceProfile>> = {
  'accompaniment:bass': { waveform: 'triangle', gain: 0.86 },
  'accompaniment:drums:kick': { waveform: 'sine', gain: 1 },
  'accompaniment:drums:snare': { waveform: 'square', gain: 0.28 },
  'accompaniment:drums:hat': { waveform: 'square', gain: 0.12 },
  'accompaniment:arpeggio': { waveform: 'triangle', gain: 0.62 },
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
