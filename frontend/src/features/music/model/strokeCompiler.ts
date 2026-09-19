import { buildPitchRange, mapYToMidi } from './theory';
import { applySwing, mapXToBeat, quantizeBeat } from './rhythm';
import type { MusicSettings, NoteEvent, Point, Stroke } from './types';

export interface StrokeCompilerOptions {
  /**
   * Horizontal sampling interval in beats before quantization.
   * Smaller values preserve more pitch changes but produce more events.
   */
  sampleStepBeats?: number;
  minimumDurationBeats?: number;
  velocity?: number;
  baseOctave?: number;
}

interface SampledPoint {
  point: Point;
  beat: number;
}

function sampleStrokeByBeat(
  stroke: Stroke,
  loopLengthBeats: number,
  sampleStepBeats: number,
): SampledPoint[] {
  if (stroke.points.length === 0) return [];

  const ordered = [...stroke.points].sort((a, b) => a.x - b.x);
  if (ordered.length === 1) {
    return [{ point: ordered[0], beat: mapXToBeat(ordered[0].x, loopLengthBeats) }];
  }

  const startBeat = mapXToBeat(ordered[0].x, loopLengthBeats);
  const endBeat = mapXToBeat(ordered[ordered.length - 1].x, loopLengthBeats);
  const step = Math.max(1e-4, sampleStepBeats);

  const samples: SampledPoint[] = [];
  let segmentIndex = 0;

  for (let beat = startBeat; beat <= endBeat + step * 0.25; beat += step) {
    const x = loopLengthBeats > 0 ? beat / loopLengthBeats : 0;

    while (
      segmentIndex < ordered.length - 2 &&
      ordered[segmentIndex + 1].x < x
    ) {
      segmentIndex += 1;
    }

    const left = ordered[segmentIndex];
    const right = ordered[Math.min(segmentIndex + 1, ordered.length - 1)];
    const span = right.x - left.x;
    const ratio = span > 0 ? Math.min(1, Math.max(0, (x - left.x) / span)) : 0;

    samples.push({
      beat,
      point: {
        x,
        y: left.y + (right.y - left.y) * ratio,
        t: left.t + (right.t - left.t) * ratio,
        pressure:
          left.pressure === undefined && right.pressure === undefined
            ? undefined
            : (left.pressure ?? 0.5) + ((right.pressure ?? 0.5) - (left.pressure ?? 0.5)) * ratio,
      },
    });
  }

  const finalPoint = ordered[ordered.length - 1];
  const finalBeat = mapXToBeat(finalPoint.x, loopLengthBeats);
  if (samples.length === 0 || Math.abs(samples[samples.length - 1].beat - finalBeat) > 1e-6) {
    samples.push({ point: finalPoint, beat: finalBeat });
  }

  return samples;
}

export function compileStroke(
  stroke: Stroke,
  settings: MusicSettings,
  options: StrokeCompilerOptions = {},
): NoteEvent[] {
  const {
    sampleStepBeats = settings.quantizeStepBeats ?? 0.125,
    minimumDurationBeats = 0.0625,
    velocity = 0.8,
    baseOctave = 3 + settings.octaveOffset,
  } = options;

  const pitchRange = buildPitchRange(
    settings.key,
    settings.scale,
    baseOctave,
    settings.rangeOctaves,
  );

  const samples = sampleStrokeByBeat(stroke, settings.loopLengthBeats, sampleStepBeats);
  if (samples.length === 0) return [];

  const mapped = samples.map((sample) => {
    const quantized = quantizeBeat(sample.beat, settings.quantizeStepBeats);
    return {
      midi: mapYToMidi(sample.point.y, pitchRange),
      beat: applySwing(quantized, settings.quantizeStepBeats, settings.swing),
    };
  });

  const events: NoteEvent[] = [];
  let groupStart = mapped[0].beat;
  let currentMidi = mapped[0].midi;

  for (let i = 1; i <= mapped.length; i += 1) {
    const current = mapped[i];
    if (current && current.midi === currentMidi) continue;

    const endBeat = current?.beat ?? Math.min(settings.loopLengthBeats, mapped[mapped.length - 1].beat + sampleStepBeats);
    const durationBeats = Math.max(minimumDurationBeats, endBeat - groupStart);

    events.push({
      id: `${stroke.id}:${events.length}`,
      layerId: stroke.layerId,
      midi: currentMidi,
      velocity: Math.min(1, Math.max(0, velocity)),
      startBeat: Math.min(settings.loopLengthBeats, Math.max(0, groupStart)),
      durationBeats,
    });

    if (current) {
      groupStart = current.beat;
      currentMidi = current.midi;
    }
  }

  return events;
}

export function compileStrokes(
  strokes: readonly Stroke[],
  settings: MusicSettings,
  options: StrokeCompilerOptions = {},
): NoteEvent[] {
  return strokes
    .flatMap((stroke) => compileStroke(stroke, settings, options))
    .sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
}
