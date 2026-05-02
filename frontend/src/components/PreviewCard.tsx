import { useEffect, useMemo, useRef } from 'react';
import type { GenerationFormData, PreviewResponse } from '../types/config';

interface PreviewCardProps {
  preview: PreviewResponse | null;
  formData: GenerationFormData;
  isLoading: boolean;
  className?: string;
}

const CHART_WIDTH = 960;
const CHART_HEIGHT = 540;
const FRAME_PADDING = 24;
const AXIS_LEFT = 88;
const AXIS_RIGHT = 28;
const AXIS_TOP = 24;
const AXIS_BOTTOM = 68;
const TICK_FONT = '12px Inter, system-ui, sans-serif';

function formatSeconds(value: number): string {
  if (value >= 10) return `${value.toFixed(0)} c`;
  if (value >= 1) return `${value.toFixed(1)} c`;
  return `${value.toFixed(2)} c`;
}

function formatFrequency(value: number): string {
  if (Math.abs(value) >= 1000) {
    const khz = value / 1000;
    return Number.isInteger(khz) ? `${khz.toFixed(0)} кГц` : `${khz.toFixed(1)} кГц`;
  }
  return `${value.toFixed(0)} Гц`;
}

function createTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count < 2 || min === max) return [min, max];
  return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
}

function drawSpectrogramChart(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  preview: PreviewResponse,
  formData: GenerationFormData,
  isLoading: boolean,
) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = CHART_WIDTH * dpr;
  canvas.height = CHART_HEIGHT * dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, CHART_WIDTH, CHART_HEIGHT);

  context.fillStyle = '#faf8f4';
  context.fillRect(0, 0, CHART_WIDTH, CHART_HEIGHT);

  const chartLeft = FRAME_PADDING + AXIS_LEFT;
  const chartTop = FRAME_PADDING + AXIS_TOP;
  const chartWidth = CHART_WIDTH - FRAME_PADDING * 2 - AXIS_LEFT - AXIS_RIGHT;
  const chartHeight = CHART_HEIGHT - FRAME_PADDING * 2 - AXIS_TOP - AXIS_BOTTOM;

  const plotWidth = chartWidth;
  const plotHeight = chartHeight;
  const plotLeft = chartLeft;
  const plotTop = chartTop;

  context.fillStyle = '#f1ede6';
  context.fillRect(chartLeft, chartTop, chartWidth, chartHeight);

  context.save();
  context.beginPath();
  context.rect(plotLeft, plotTop, plotWidth, plotHeight);
  context.clip();
  context.drawImage(image, plotLeft, plotTop, plotWidth, plotHeight);
  context.restore();

  context.strokeStyle = '#d7cfc3';
  context.lineWidth = 1;
  context.strokeRect(plotLeft + 0.5, plotTop + 0.5, plotWidth - 1, plotHeight - 1);

  const timeStart = 0;
  const timeEnd = preview.totalDuration;
  const frequencyStart = formData.fmin;
  const frequencyEnd = formData.fmax;
  const xTicks = createTicks(
    formData.orientation === 'time-x' ? timeStart : frequencyStart,
    formData.orientation === 'time-x' ? timeEnd : frequencyEnd,
    6,
  );
  const yTicks = createTicks(
    formData.orientation === 'time-x'
      ? frequencyStart
      : formData.freq_x_rotation === 'ccw'
        ? timeStart
        : timeEnd,
    formData.orientation === 'time-x'
      ? frequencyEnd
      : formData.freq_x_rotation === 'ccw'
        ? timeEnd
        : timeStart,
    5,
  );

  context.strokeStyle = '#e9dfd2';
  context.fillStyle = '#6b7280';
  context.font = TICK_FONT;
  context.textAlign = 'center';
  context.textBaseline = 'top';

  xTicks.forEach((tick, index) => {
    const x = plotLeft + (plotWidth * index) / (xTicks.length - 1);
    context.beginPath();
    context.moveTo(x + 0.5, plotTop);
    context.lineTo(x + 0.5, plotTop + plotHeight);
    context.stroke();
    context.fillText(formData.orientation === 'time-x' ? formatSeconds(tick) : formatFrequency(tick), x, plotTop + plotHeight + 12);
  });

  context.textAlign = 'right';
  context.textBaseline = 'middle';
  yTicks.forEach((tick, index) => {
    const ratio = index / (yTicks.length - 1);
    const y = plotTop + plotHeight - plotHeight * ratio;
    context.beginPath();
    context.moveTo(plotLeft, y + 0.5);
    context.lineTo(plotLeft + plotWidth, y + 0.5);
    context.stroke();
    context.fillText(formData.orientation === 'time-x' ? formatFrequency(tick) : formatSeconds(tick), plotLeft - 12, y);
  });

  context.strokeStyle = '#8f7a65';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(plotLeft, plotTop + plotHeight + 0.5);
  context.lineTo(plotLeft + plotWidth, plotTop + plotHeight + 0.5);
  context.moveTo(plotLeft + 0.5, plotTop);
  context.lineTo(plotLeft + 0.5, plotTop + plotHeight);
  context.stroke();

  if (isLoading) {
    context.fillStyle = 'rgba(250, 248, 244, 0.72)';
    context.fillRect(plotLeft, plotTop, plotWidth, plotHeight);
    context.fillStyle = '#5f4633';
    context.font = '600 14px Inter, system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('Предпросмотр обновляется…', plotLeft + plotWidth / 2, plotTop + plotHeight / 2);
  }
}

export function PreviewCard({ preview, formData, isLoading, className = '' }: PreviewCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const orientationLabel = useMemo(() => (
    formData.orientation === 'time-x'
      ? 'X — время, Y — частота'
      : 'X — частота, Y — время'
  ), [formData.orientation, formData.freq_x_rotation]);

  useEffect(() => {
    if (!preview || !canvasRef.current) return;

    const image = new Image();
    image.onload = () => {
      if (canvasRef.current) {
        drawSpectrogramChart(canvasRef.current, image, preview, formData, isLoading);
      }
    };
    image.src = preview.previewImage;
  }, [preview, formData, isLoading]);

  return (
    <section className={`panel preview-card panel--compact panel--fill ${className}`.trim()}>
      <div className="section__header section__header--compact">
        <h2>Живой предпросмотр</h2>
        <p>{orientationLabel}</p>
      </div>
      <div className="preview-card__body preview-card__body--fill">
        <div className="preview-frame preview-frame--chart">
          {preview ? (
            <canvas className="preview-chart" ref={canvasRef} aria-label="График ожидаемой спектрограммы" />
          ) : (
            <div className="empty-state preview-frame__placeholder">Введите параметры — здесь появится график спектрограммы с осями времени и частоты.</div>
          )}
        </div>

      </div>
    </section>
  );
}
