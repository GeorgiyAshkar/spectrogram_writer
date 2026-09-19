import { SCALE_INTERVALS, tonicToPitchClass } from '../model/theory';
import type { MusicSettings, NoteEvent } from '../model/types';

function midiForTonic(key: string, octave: number): number {
  const pitchClass = tonicToPitchClass(key);
  return (octave + 1) * 12 + pitchClass;
}

export function buildAccompanimentEvents(settings: MusicSettings): NoteEvent[] {
  const events: NoteEvent[] = [];
  const loopLength = Math.max(0.001, settings.loopLengthBeats);

  if (settings.bassEnabled) {
    const root = midiForTonic(settings.key, 2 + settings.octaveOffset);
    for (let beat = 0; beat < loopLength; beat += 1) {
      events.push({
        id: `bass:${beat}`,
        layerId: 'accompaniment:bass',
        midi: root,
        velocity: beat === 0 ? 0.78 : 0.64,
        startBeat: beat,
        durationBeats: Math.min(0.82, loopLength - beat),
      });
    }
  }

  if (settings.drumsEnabled) {
    for (let beat = 0; beat < loopLength; beat += 0.5) {
      events.push({
        id: `drums:hat:${beat}`,
        layerId: 'accompaniment:drums:hat',
        midi: 42,
        velocity: Number.isInteger(beat) ? 0.42 : 0.3,
        startBeat: beat,
        durationBeats: Math.min(0.12, loopLength - beat),
      });
    }

    for (let beat = 0; beat < loopLength; beat += 1) {
      events.push({
        id: `drums:kick:${beat}`,
        layerId: 'accompaniment:drums:kick',
        midi: 36,
        velocity: beat === 0 ? 0.9 : 0.68,
        startBeat: beat,
        durationBeats: Math.min(0.2, loopLength - beat),
      });

      if (beat % 2 === 1) {
        events.push({
          id: `drums:snare:${beat}`,
          layerId: 'accompaniment:drums:snare',
          midi: 38,
          velocity: 0.62,
          startBeat: beat,
          durationBeats: Math.min(0.16, loopLength - beat),
        });
      }
    }
  }

  if (settings.arpeggioEnabled) {
    const intervals = SCALE_INTERVALS[settings.scale];
    const tonic = midiForTonic(settings.key, 3 + settings.octaveOffset);
    const pattern = intervals.slice(0, Math.min(4, intervals.length));
    const step = 0.5;

    for (let beat = 0, index = 0; beat < loopLength; beat += step, index += 1) {
      const interval = pattern[index % Math.max(1, pattern.length)] ?? 0;
      events.push({
        id: `arpeggio:${index}`,
        layerId: 'accompaniment:arpeggio',
        midi: tonic + interval,
        velocity: 0.46,
        startBeat: beat,
        durationBeats: Math.min(0.38, loopLength - beat),
      });
    }
  }

  return events.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
}
