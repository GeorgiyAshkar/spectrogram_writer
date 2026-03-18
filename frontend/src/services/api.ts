import type { GenerationFormData, PreviewResponse } from '../types/config';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api';

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.detail ?? 'Request failed';
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function fetchPreview(payload: GenerationFormData): Promise<PreviewResponse> {
  const response = await fetch(`${API_BASE}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = await response.json();
  return {
    previewImage: data.previewImage,
    autoEdgePad: data.autoEdgePad,
    totalDuration: data.totalDuration,
    bitmapShape: data.bitmapShape,
  };
}

export async function downloadWav(payload: GenerationFormData): Promise<Blob> {
  const response = await fetch(`${API_BASE}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.blob();
}
