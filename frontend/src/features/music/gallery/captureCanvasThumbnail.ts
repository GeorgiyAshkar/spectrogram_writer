export function captureCanvasThumbnail(
  canvas: HTMLCanvasElement,
  maxWidth = 480,
  quality = 0.72,
): string {
  const scale = Math.min(1, maxWidth / Math.max(1, canvas.width));
  const width = Math.max(1, Math.round(canvas.width * scale));
  const height = Math.max(1, Math.round(canvas.height * scale));

  const preview = document.createElement('canvas');
  preview.width = width;
  preview.height = height;
  const ctx = preview.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать preview gallery.');

  ctx.drawImage(canvas, 0, 0, width, height);
  return preview.toDataURL('image/jpeg', quality);
}
