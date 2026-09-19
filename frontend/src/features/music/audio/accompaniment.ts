import { buildPitchRange } from '../model/theory';
import { applySwing } from '../model/rhythm';
import type { MusicSettings, NoteEvent } from '../model/types';

/**
 * Bass / Drums / Arpeggio roles are confirmed from the reference DOM.
 * The exact musical patterns remain clean-room defaults isolated here.
 */
export function buildAccompanimentEvents(settings: MusicSettings): NoteEvent[] {
  const events: NoteEvent[] = [];
  const loopLength = Math.max(0.001, settings.loopLengthBeats);
  const scale = buildPitchRange(
    settings.key,
    settings.scale,
    2 + settings.octaveOffset,
    Math.max(1, settings.rangeOctaves),
  );
  const root = scale[0] ?? 48;

  if (settings.bassEnabled) {
    for (let beat = 0; beat < loopLength; beat += 1) {
      events.push({
        id: `bass:${beat}`,
        layerId: 'accompaniment:bass',
        midi: root,
        velocity: beat % 4 === 0 ? 0.78 : 0.64,
        startBeat: beat,
        durationBeats: 0.42,
      });
    }
  }

  if (settings.drumsEnabled) {
    for (let beat = 0; beat < loopLength; beat += 0.5) {
      const step = Math.round(beat * 2);
      const swungBeat = applySwing(beat, 0.5, settings.swing);
      events.push({
        id: `hat:${step}`,
        layerId: 'accompaniment:drums:hat',
        midi: 78,
        velocity: step % 2 === 0 ? 0.42 : 0.3,
        startBeat: swungBeat,
        durationBeats: 0.08,
      });

      if (step % 2 === 0) {
        const integerBeat = Math.round(beat);
        const snare = integerBeat % 4 === 1 || integerBeat % 4 === 3;
        events.push({
          id: `drum:${integerBeat}`,
          layerId: snare ? 'accompaniment:drums:snare' : 'accompaniment:drums:kick',
          midi: snare ? 50 : 36,
          velocity: 0.7,
          startBeat: beat,
          durationBeats: 0.12,
        });
      }
    }
  }

  if (settings.arpeggioEnabled) {
    const chordIndices = [0, 2, 4, 2];
    const notes = chordIndices.map(
      (index) => scale[Math.min(index, scale.length - 1)] ?? root,
    );

    for (let beat = 0, index = 0; beat < loopLength; beat += 0.5, index += 1) {
      events.push({
        id: `arp:${index}`,
        layerId: 'accompaniment:arpeggio',
        midi: notes[index % notes.length],
        velocity: 0.52,
        startBeat: applySwing(beat, 0.5, settings.swing),
        durationBeats: 0.34,
      });
    }
  }

  return events.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
}
