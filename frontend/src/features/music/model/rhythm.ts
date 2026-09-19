export function mapXToBeat(x: number, loopLengthBeats: number): number {
  const clamped = Math.min(1, Math.max(0, x));
  return clamped * Math.max(0, loopLengthBeats);
}

export function quantizeBeat(beat: number, stepBeats: number | null): number {
  if (stepBeats === null || stepBeats <= 0) return beat;
  return Math.round(beat / stepBeats) * stepBeats;
}

/**
 * swing is normalized to 0..1 and delays every second grid position.
 * Exact parity ratios are intentionally configured outside this function.
 */
export function applySwing(beat: number, stepBeats: number | null, swing: number): number {
  if (stepBeats === null || stepBeats <= 0 || swing <= 0) return beat;

  const tripletGrid =
    Math.abs(stepBeats - 1 / 3) < 1e-6 ||
    Math.abs(stepBeats - 1 / 6) < 1e-6;
  if (tripletGrid) return beat;

  const amount = Math.min(1, Math.max(0, swing));
  const gridIndex = Math.round(beat / stepBeats);
  if (gridIndex % 2 === 0) return beat;

  return beat + stepBeats * 0.5 * amount;
}
