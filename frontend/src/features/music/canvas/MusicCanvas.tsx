import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPitchRange, midiToNoteName } from '../model/theory';
import type { MusicSettings, Point, Stroke } from '../model/types';

export type MusicCanvasBackground =
  | { kind: 'paper' }
  | { kind: 'sky' }
  | { kind: 'photo'; url: string | null };

type Props = {
  settings: MusicSettings;
  strokes: Stroke[];
  activeColor: string;
  background: MusicCanvasBackground;
  playheadProgress?: number;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
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

  const preset = stroke.drawingResolutionPreset ?? 1;
  ctx.save();

  if (preset > 1) {
    const columns = preset === 2 ? 32 : 16;
    const rows = preset === 2 ? 24 : 12;
    const cellWidth = WIDTH / columns;
    const cellHeight = HEIGHT / rows;
    const visited = new Set<string>();

    const paintCell = (x: number, y: number) => {
      const col = Math.min(columns, Math.max(0, Math.round(x * columns)));
      const row = Math.min(rows, Math.max(0, Math.round(y * rows)));
      const key = `${col}:${row}`;
      if (visited.has(key)) return;
      visited.add(key);

      const cx = (col / columns) * WIDTH;
      const cy = (row / rows) * HEIGHT;
      ctx.fillStyle = stroke.color;
      ctx.fillRect(
        cx - cellWidth * 0.44,
        cy - cellHeight * 0.44,
        cellWidth * 0.88,
        cellHeight * 0.88,
      );
    };

    stroke.points.forEach((point, index) => {
      paintCell(point.x, point.y);
      if (index === 0) return;

      const previous = stroke.points[index - 1];
      const dx = (point.x - previous.x) * columns;
      const dy = (point.y - previous.y) * rows;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
      for (let step = 1; step < steps; step += 1) {
        const ratio = step / steps;
        paintCell(
          previous.x + (point.x - previous.x) * ratio,
          previous.y + (point.y - previous.y) * ratio,
        );
      }
    });

    ctx.restore();
    return;
  }

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

export function MusicCanvas({
  settings,
  strokes,
  activeColor,
  background,
  playheadProgress = 0,
  onCanvasReady,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const pointerStartedAt = useRef(0);

  const pitchRange = useMemo(
    () => buildPitchRange(settings.key, settings.scale, 3 + settings.octaveOffset, settings.rangeOctaves),
    [settings.key, settings.scale, settings.octaveOffset, settings.rangeOctaves],
  );

  useEffect(() => {
    onCanvasReady?.(canvasRef.current);
    return () => onCanvasReady?.(null);
  }, [onCanvasReady]);

  useEffect(() => {
    if (background.kind !== 'photo' || !background.url) {
      setBackgroundImage(null);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setBackgroundImage(image);
    };
    image.onerror = () => {
      if (!cancelled) setBackgroundImage(null);
    };
    image.src = background.url;

    return () => {
      cancelled = true;
    };
  }, [background]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    if (background.kind === 'sky') {
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, '#bfe2ff');
      gradient.addColorStop(0.62, '#e9f5ff');
      gradient.addColorStop(1, '#fffaf0');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else if (background.kind === 'photo' && backgroundImage) {
      const imageRatio = backgroundImage.width / backgroundImage.height;
      const canvasRatio = WIDTH / HEIGHT;
      let sourceWidth = backgroundImage.width;
      let sourceHeight = backgroundImage.height;
      let sourceX = 0;
      let sourceY = 0;

      if (imageRatio > canvasRatio) {
        sourceWidth = backgroundImage.height * canvasRatio;
        sourceX = (backgroundImage.width - sourceWidth) / 2;
      } else {
        sourceHeight = backgroundImage.width / canvasRatio;
        sourceY = (backgroundImage.height - sourceHeight) / 2;
      }

      ctx.drawImage(
        backgroundImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        WIDTH,
        HEIGHT,
      );
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      ctx.fillStyle = '#fffdf8';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    ctx.save();
    ctx.strokeStyle = background.kind === 'paper' ? '#e7e1d8' : 'rgba(72, 62, 51, 0.22)';
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

    const playheadX = Math.min(1, Math.max(0, playheadProgress)) * WIDTH;
    ctx.save();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, HEIGHT);
    ctx.stroke();
    ctx.restore();
  }, [background, backgroundImage, draft, pitchRange, playheadProgress, settings.loopLengthBeats, strokes]);

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
          layerId: `color:${activeColor.toLowerCase()}`,
          color: activeColor,
          createdAt: Date.now(),
          drawingResolutionPreset: settings.drawingResolutionPreset,
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
