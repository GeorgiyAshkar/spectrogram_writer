import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPitchRange, midiToNoteName } from '../model/theory';
import type { MusicSettings, Point, Stroke } from '../model/types';

export type PhotoFit = 'fill' | 'fit' | 'stretch';

export type MusicCanvasBackground =
  | { kind: 'paper' }
  | { kind: 'sky' }
  | { kind: 'photo'; url: string | null; fit: PhotoFit };

type Props = {
  settings: MusicSettings;
  strokes: Stroke[];
  activeColor: string;
  background: MusicCanvasBackground;
  playheadProgress?: number;
  showGrid?: boolean;
  tool?: 'pen' | 'eraser';
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  onChange: (strokes: Stroke[]) => void;
};

const WIDTH = 960;
const HEIGHT = 420;

function snapPoint(point: Point, programMode: MusicSettings['programMode']): Point {
  if (programMode !== 2) return point;

  // Pixel mode density is an isolated clean-room rendering choice.
  const columns = 32;
  const rows = 24;
  return {
    ...point,
    x: Math.round(point.x * columns) / columns,
    y: Math.round(point.y * rows) / rows,
  };
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return;

  const programMode = stroke.programMode ?? stroke.drawingResolutionPreset ?? 1;
  ctx.save();

  if (programMode === 2) {
    const columns = 32;
    const rows = 24;
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
  showGrid = false,
  tool = 'pen',
  onCanvasReady,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const [erasedStrokeIds, setErasedStrokeIds] = useState<Set<string>>(new Set());
  const erasedStrokeIdsRef = useRef<Set<string>>(new Set());
  const erasingRef = useRef(false);
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

      if (background.fit === 'stretch') {
        ctx.drawImage(backgroundImage, 0, 0, WIDTH, HEIGHT);
      } else if (background.fit === 'fit') {
        ctx.fillStyle = '#fffdf8';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        let targetWidth = WIDTH;
        let targetHeight = HEIGHT;
        if (imageRatio > canvasRatio) {
          targetHeight = WIDTH / imageRatio;
        } else {
          targetWidth = HEIGHT * imageRatio;
        }
        const targetX = (WIDTH - targetWidth) / 2;
        const targetY = (HEIGHT - targetHeight) / 2;
        ctx.drawImage(backgroundImage, targetX, targetY, targetWidth, targetHeight);
      } else {
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
      }

      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      ctx.fillStyle = '#fffdf8';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    if (showGrid) {
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
    }

    strokes
      .filter((stroke) => !erasedStrokeIds.has(stroke.id))
      .forEach((stroke) => drawStroke(ctx, stroke));
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
  }, [background, backgroundImage, draft, erasedStrokeIds, pitchRange, playheadProgress, settings.loopLengthBeats, showGrid, strokes]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point: Point = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      t: performance.now() - pointerStartedAt.current,
      pressure: event.pressure || undefined,
    };
    return snapPoint(point, settings.programMode);
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

  const eraseAtPoint = (point: Point) => {
    const threshold = 18;
    const px = point.x * WIDTH;
    const py = point.y * HEIGHT;

    const distanceToSegment = (
      x: number,
      y: number,
      ax: number,
      ay: number,
      bx: number,
      by: number,
    ) => {
      const dx = bx - ax;
      const dy = by - ay;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared <= 1e-9) return Math.hypot(x - ax, y - ay);
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
      return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    };

    const next = new Set(erasedStrokeIdsRef.current);
    for (const stroke of strokes) {
      if (next.has(stroke.id) || stroke.points.length === 0) continue;

      let hit = stroke.points.length === 1
        ? Math.hypot(px - stroke.points[0].x * WIDTH, py - stroke.points[0].y * HEIGHT) <= threshold
        : false;

      for (let index = 1; !hit && index < stroke.points.length; index += 1) {
        const a = stroke.points[index - 1];
        const b = stroke.points[index];
        hit = distanceToSegment(
          px,
          py,
          a.x * WIDTH,
          a.y * HEIGHT,
          b.x * WIDTH,
          b.y * HEIGHT,
        ) <= threshold;
      }

      if (hit) next.add(stroke.id);
    }

    if (next.size !== erasedStrokeIdsRef.current.size) {
      erasedStrokeIdsRef.current = next;
      setErasedStrokeIds(new Set(next));
    }
  };

  const finishEraserGesture = () => {
    if (!erasingRef.current) return;
    erasingRef.current = false;
    const erased = erasedStrokeIdsRef.current;
    if (erased.size > 0) {
      onChange(strokes.filter((stroke) => !erased.has(stroke.id)));
    }
    erasedStrokeIdsRef.current = new Set();
    setErasedStrokeIds(new Set());
  };

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className={tool === 'eraser' ? 'music-draw-canvas is-erasing' : 'music-draw-canvas'}
      aria-label="Музыкальный холст: горизонталь задаёт время, вертикаль — высоту ноты"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerStartedAt.current = performance.now();
        const point = pointFromEvent(event);

        if (tool === 'eraser') {
          erasingRef.current = true;
          erasedStrokeIdsRef.current = new Set();
          setErasedStrokeIds(new Set());
          eraseAtPoint(point);
          return;
        }

        const nextDraft: Stroke = {
          id:
            typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `stroke-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          layerId: `color:${activeColor.toLowerCase()}`,
          color: activeColor,
          createdAt: Date.now(),
          programMode: settings.programMode,
          points: [point],
        };
        draftRef.current = nextDraft;
        setDraft(nextDraft);
      }}
      onPointerMove={(event) => {
        const point = pointFromEvent(event);
        if (tool === 'eraser' && erasingRef.current) {
          eraseAtPoint(point);
          return;
        }
        if (!draftRef.current) return;
        appendPoint(point);
      }}
      onPointerUp={(event) => {
        if (tool === 'eraser') {
          eraseAtPoint(pointFromEvent(event));
          finishEraserGesture();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          return;
        }

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
        if (tool === 'eraser') finishEraserGesture();
        draftRef.current = null;
        setDraft(null);
      }}
    />
  );
}
