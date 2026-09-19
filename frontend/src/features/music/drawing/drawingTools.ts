import type { MusicSettings, Stroke } from '../model/types';
import {
  DEFAULT_INSTRUMENT_COLORS,
  PARITY_INSTRUMENT_SWATCHES,
  type ParityInstrumentId,
} from '../parityConfig';

export type InstrumentColorMap = Record<ParityInstrumentId, string>;

export type RandomSource = () => number;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function generateRandomDrawing(
  settings: Pick<MusicSettings, 'programMode'>,
  instrumentColors: InstrumentColorMap,
  random: RandomSource = Math.random,
  now = Date.now(),
): Stroke[] {
  const unit = () => clampUnit(random());
  const strokeCount = 5 + Math.floor(unit() * 6);

  return Array.from({ length: strokeCount }, (_, strokeIndex) => {
    const pointCount = 3 + Math.floor(unit() * 5);
    const startX = unit() * 0.16;
    const span = 0.35 + unit() * 0.62;
    const swatchIndex = Math.min(
      PARITY_INSTRUMENT_SWATCHES.length - 1,
      Math.floor(unit() * PARITY_INSTRUMENT_SWATCHES.length),
    );
    const swatch = PARITY_INSTRUMENT_SWATCHES[swatchIndex] ?? PARITY_INSTRUMENT_SWATCHES[0];
    const color = instrumentColors[swatch.id] ?? swatch.color;

    const points = Array.from({ length: pointCount }, (_, pointIndex) => ({
      x: Math.min(1, startX + (span * pointIndex) / Math.max(1, pointCount - 1)),
      y: 0.08 + unit() * 0.84,
      t: pointIndex * 80,
    }));

    return {
      id: `shuffle-${now}-${strokeIndex}`,
      layerId: `instrument:${swatch.id}`,
      color,
      createdAt: now + strokeIndex,
      programMode: settings.programMode,
      points,
    };
  });
}

export function recolorInstrumentStrokes(
  strokes: readonly Stroke[],
  instrumentId: ParityInstrumentId,
  color: string,
): Stroke[] {
  const layerId = `instrument:${instrumentId}`;
  return strokes.map((stroke) =>
    stroke.layerId === layerId && stroke.color !== color
      ? { ...stroke, color }
      : stroke,
  );
}

export function restoreDefaultInstrumentColors(
  strokes: readonly Stroke[],
): { colors: InstrumentColorMap; strokes: Stroke[] } {
  const colors = { ...DEFAULT_INSTRUMENT_COLORS };

  return {
    colors,
    strokes: strokes.map((stroke) => {
      if (!stroke.layerId.startsWith('instrument:')) return stroke;
      const instrumentId = stroke.layerId.slice('instrument:'.length) as ParityInstrumentId;
      const color = colors[instrumentId];
      return color && color !== stroke.color ? { ...stroke, color } : stroke;
    }),
  };
}
