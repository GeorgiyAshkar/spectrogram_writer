import type { MusicSettings } from './types';

export const MUSIC_DURATION_LIMITS = {
  minSeconds: 1,
  maxSeconds: 120,
  stepSeconds: 0.5,
} as const;

export function loopDurationSeconds(
  settings: Pick<MusicSettings, 'loopLengthBeats' | 'bpm'>,
): number {
  const bpm = Math.max(1, settings.bpm);
  return (Math.max(0, settings.loopLengthBeats) * 60) / bpm;
}

export function loopLengthBeatsForDuration(
  durationSeconds: number,
  bpm: number,
): number {
  const safeSeconds = Math.min(
    MUSIC_DURATION_LIMITS.maxSeconds,
    Math.max(MUSIC_DURATION_LIMITS.minSeconds, durationSeconds),
  );
  return (safeSeconds * Math.max(1, bpm)) / 60;
}

export function withPlaybackDuration(
  settings: MusicSettings,
  durationSeconds: number,
): MusicSettings {
  return {
    ...settings,
    loopLengthBeats: loopLengthBeatsForDuration(durationSeconds, settings.bpm),
  };
}

export function withBpmPreservingDuration(
  settings: MusicSettings,
  bpm: number,
): MusicSettings {
  const durationSeconds = loopDurationSeconds(settings);
  const nextBpm = Math.max(1, bpm);
  return {
    ...settings,
    bpm: nextBpm,
    loopLengthBeats: loopLengthBeatsForDuration(durationSeconds, nextBpm),
  };
}
