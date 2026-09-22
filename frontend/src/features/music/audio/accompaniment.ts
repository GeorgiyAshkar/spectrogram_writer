import { SCALE_INTERVALS, signedKeyTranspose } from '../model/theory';
import type { MusicSettings, NoteEvent } from '../model/types';

const DEFAULT_ARP_STEP_BEATS = 1 / 3;
const DEFAULT_MAJOR_PENTATONIC_ARP_OFFSETS = [0, 4, 7, 9, 12, 9, 7, 4] as const;

function bassRootMidi(settings: MusicSettings): number {
  return 48 + signedKeyTranspose(settings.key) + settings.octaveOffset * 12;
}

function arpeggioTonicMidi(settings: MusicSettings): number {
  return 72 + signedKeyTranspose(settings.key) + settings.octaveOffset * 12;
}

function arpeggioOffsets(settings: MusicSettings): readonly number[] {
  if (settings.scale === 'majorPentatonic') {
    return DEFAULT_MAJOR_PENTATONIC_ARP_OFFSETS;
  }

  // Only the default Major-pentatonic arpeggio has been measured directly.
  // For the other scales use a conservative clean-room triad fallback until
  // dedicated reference measurements are available.
  const intervals = SCALE_INTERVALS[settings.scale];
  const third = intervals[Math.min(2, intervals.length - 1)] ?? 4;
  const fifth = intervals[Math.min(4, intervals.length - 1)] ?? 7;
  return [0, third, fifth, 12, fifth, third];
}

/**
 * Reference controls confirm independent Bass / Drums / Arpeggio layers.
 *
 * Measured on the 2026-09-22 public reference at the default settings:
 * - Bass: tonic around C3 (MIDI 48 for Key=C), retriggered every beat.
 * - Arpeggio: 1/8-triplet step (1/3 beat) and, for C Major pentatonic,
 *   C5-E5-G5-A5-C6-A5-G5-E5 repeating.
 * - Drums: closed-hat every 1/3 beat; kick on beats 0/2; snare on beats 1/3.
 */
export function buildAccompanimentEvents(settings: MusicSettings): NoteEvent[] {
  const events: NoteEvent[] = [];
  const loopLength = Math.max(0.001, settings.loopLengthBeats);

  if (settings.bassEnabled) {
    const root = bassRootMidi(settings);
    for (let beat = 0; beat < loopLength; beat += 1) {
      events.push({
        id: `bass:${beat}`,
        layerId: 'accompaniment:bass',
        midi: root,
        velocity: beat % 4 === 0 ? 0.78 : 0.7,
        startBeat: beat,
        durationBeats: Math.min(0.82, loopLength - beat),
      });
    }
  }

  if (settings.drumsEnabled) {
    // Measured reference pattern at 120 BPM:
    // closed-hat transient every 1/3 beat, kick on beats 0/2,
    // snare on beats 1/3. Triplet subdivisions remain unswung.
    for (
      let beat = 0, step = 0;
      beat < loopLength;
      beat += 1 / 3, step += 1
    ) {
      events.push({
        id: `hat:${step}`,
        layerId: 'accompaniment:drums:hat',
        midi: 42,
        velocity: step % 3 === 0 ? 0.42 : 0.3,
        startBeat: beat,
        durationBeats: Math.min(0.08, loopLength - beat),
      });
    }

    for (let beat = 0; beat < loopLength; beat += 1) {
      const integerBeat = Math.round(beat);
      const snare = integerBeat % 4 === 1 || integerBeat % 4 === 3;
      events.push({
        id: `drum:${integerBeat}`,
        layerId: snare ? 'accompaniment:drums:snare' : 'accompaniment:drums:kick',
        midi: snare ? 38 : 36,
        velocity: 0.7,
        startBeat: beat,
        durationBeats: Math.min(0.12, loopLength - beat),
      });
    }
  }

  if (settings.arpeggioEnabled) {
    const tonic = arpeggioTonicMidi(settings);
    const offsets = arpeggioOffsets(settings);

    for (
      let beat = 0, index = 0;
      beat < loopLength;
      beat += DEFAULT_ARP_STEP_BEATS, index += 1
    ) {
      events.push({
        id: `arp:${index}`,
        layerId: 'accompaniment:arpeggio',
        midi: tonic + offsets[index % offsets.length],
        velocity: 0.52,
        startBeat: beat,
        durationBeats: Math.min(0.3, loopLength - beat),
      });
    }
  }

  return events.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
}
