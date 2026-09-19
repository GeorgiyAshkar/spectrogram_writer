import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPitchRange, midiToNoteName } from '../model/theory';
import type { MusicSettings, Point, Stroke } from '../model/types';

type Props = {
  settings: MusicSettings;
  strokes: Stroke[];
  activeColor: string;
  onChange: (strokes: Stroke[]) => void;
};

const WIDTH = 960;
const HEIGHT = 420;

function snapPoint(point: Point, preset: MusicSettings['drawingResolutionPreset']): Point {
  if (preset === 1) return point;

  // Engineering defaults until exact parity grid sizes are measured.
  const columns = preset === 2 ? 32 : 16;
  const rows = preset === 2 ? 24 : 12;

  return {
    ...point,
    x: Math.round(point.x * columns) / columns,
    y: Math.round(point.y * rows) / rows,
  };
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  stroke.points.forEach((point, index) => {
    const x = point.x * WIDTH;
    const y = point.y * HEIGHT;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
  ctx.restore();
}

export function MusicCanvas({ settings, strokes, activeColor, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const pointerStartedAt = useRef(0);

  const pitchRange = useMemo(
    () => buildPitchRange(settings.key, settings.scale, 3 + settings.octaveOffset, settings.rangeOctaves),
    [settings.key, settings.scale, settings.octaveOffset, settings.rangeOctaves],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.strokeStyle = '#e7e1d8';
    ctx.lineWidth = 1;
    for (let beat = 0; beat <= settings.loopLengthBeats; beat += 1) {
      const x = settings.loopLengthBeats > 0 ? (beat / settings.loopLengthBeats) * WIDTH : 0;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }

    const rows = Math.max(1, pitchRange.length);
    for (let index = 0; index < rows; index += 1) {
      const y = rows === 1 ? HEIGHT / 2 : (index / (rows - 1)) * HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();

      const midi = pitchRange[pitchRange.length - 1 - index];
      if (midi !== undefined) {
        ctx.fillStyle = '#8b8174';
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText(midiToNoteName(midi), 8, Math.max(14, y - 4));
      }
    }
    ctx.restore();

    strokes.forEach((stroke) => drawStroke(ctx, stroke));
    if (draft) drawStroke(ctx, draft);
  }, [draft, pitchRange, settings.loopLengthBeats, strokes]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point: Point = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      t: performance.now() - pointerStartedAt.current,
      pressure: event.pressure || undefined,
    };
    return snapPoint(point, settings.drawingResolutionPreset);
  };

  const appendPoint = (point: Point) => {
    const current = draftRef.current;
    if (!current) return;

    const previous = current.points[current.points.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) return;

    const next = { ...current, points: [...current.points, point] };
    draftRef.current = next;
    setDraft(next);
  };

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className="music-draw-canvas"
      aria-label="Музыкальный холст: горизонталь задаёт время, вертикаль — высоту ноты"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerStartedAt.current = performance.now();
        const point = pointFromEvent(event);
        const nextDraft: Stroke = {
          id:
            typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `stroke-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          layerId: 'default',
          color: activeColor,
          createdAt: Date.now(),
          points: [point],
        };
        draftRef.current = nextDraft;
        setDraft(nextDraft);
      }}
      onPointerMove={(event) => {
        if (!draftRef.current) return;
        appendPoint(pointFromEvent(event));
      }}
      onPointerUp={(event) => {
        const current = draftRef.current;
        if (!current) return;

        const finalPoint = pointFromEvent(event);
        const previous = current.points[current.points.length - 1];
        const points =
          previous && previous.x === finalPoint.x && previous.y === finalPoint.y
            ? current.points
            : [...current.points, finalPoint];

        if (points.length > 0) {
          onChange([...strokes, { ...current, points }]);
        }
        draftRef.current = null;
        setDraft(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        draftRef.current = null;
        setDraft(null);
      }}
    />
  );
}
