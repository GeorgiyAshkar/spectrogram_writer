import type { Point } from '../model/types';

export const PIXEL_COLUMNS = 48;
export const PIXEL_FILL_RATIO = 18 / 19;

export function pixelCellSide(canvasWidth: number): number {
  return (canvasWidth / PIXEL_COLUMNS) * PIXEL_FILL_RATIO;
}

export function pixelColumnIndex(x: number): number {
  return Math.min(
    PIXEL_COLUMNS - 1,
    Math.max(0, Math.floor(Math.min(0.999999, Math.max(0, x)) * PIXEL_COLUMNS)),
  );
}

export function pixelColumnCenter(column: number): number {
  const safeColumn = Math.min(PIXEL_COLUMNS - 1, Math.max(0, Math.round(column)));
  return (safeColumn + 0.5) / PIXEL_COLUMNS;
}

export function pixelRowCenter(
  row: number,
  rowCount: number,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const safeRows = Math.max(1, Math.floor(rowCount));
  if (safeRows === 1) return 0.5;

  const halfCell = pixelCellSide(canvasWidth) / (2 * canvasHeight);
  const step = (1 - 2 * halfCell) / (safeRows - 1);
  return halfCell + Math.min(safeRows - 1, Math.max(0, Math.round(row))) * step;
}

export function pixelRowIndex(
  y: number,
  rowCount: number,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const safeRows = Math.max(1, Math.floor(rowCount));
  if (safeRows === 1) return 0;

  const halfCell = pixelCellSide(canvasWidth) / (2 * canvasHeight);
  const step = (1 - 2 * halfCell) / (safeRows - 1);
  return Math.min(
    safeRows - 1,
    Math.max(0, Math.round((Math.min(1, Math.max(0, y)) - halfCell) / step)),
  );
}

export function snapPixelPoint(
  point: Point,
  rowCount: number,
  canvasWidth: number,
  canvasHeight: number,
): Point {
  const column = pixelColumnIndex(point.x);
  const row = pixelRowIndex(point.y, rowCount, canvasWidth, canvasHeight);
  return {
    ...point,
    x: pixelColumnCenter(column),
    y: pixelRowCenter(row, rowCount, canvasWidth, canvasHeight),
  };
}
