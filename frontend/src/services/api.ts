import type { GenerationFormData, PreviewResponse } from '../types/config';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api';
const LOGO_URL = `${API_BASE}/branding/logo`;

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.detail ?? 'Ошибка запроса';
  } catch {
    return `Ошибка запроса: ${response.status}`;
  }
}

export async function resolveLogoUrl(): Promise<string | null> {
  try {
    const response = await fetch(LOGO_URL, { method: 'GET' });
    return response.ok ? LOGO_URL : null;
  } catch {
    return null;
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
