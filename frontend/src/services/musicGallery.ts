import type { MusicSettings, NoteEvent, Stroke } from '../features/music/model';
import { API_BASE } from './api';

export type ShareableBackground =
  | { kind: 'paper' }
  | { kind: 'sky' }
  | { kind: 'photo'; dataUrl: string };

export type MusicShareProjectV1 = {
  schemaVersion: 1;
  settings: MusicSettings;
  strokes: Stroke[];
  virtualKeyboardEvents: NoteEvent[];
  midiRecordedEvents: NoteEvent[];
  activeColor: string;
  customColor: string;
  backgroundKind: 'paper' | 'sky';
};

export type MusicShareProjectV2 = {
  schemaVersion: 2;
  settings: MusicSettings;
  strokes: Stroke[];
  virtualKeyboardEvents: NoteEvent[];
  midiRecordedEvents: NoteEvent[];
  activeColor: string;
  customColor: string;
  background: ShareableBackground;
};

export type MusicShareProject = MusicShareProjectV1 | MusicShareProjectV2;

export type GallerySummary = {
  id: string;
  title: string;
  author: string;
  created_at: string;
};

export type GalleryDetail = GallerySummary & {
  project: MusicShareProject;
};

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload.detail ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function publishMusicPiece(
  title: string,
  author: string,
  project: MusicShareProjectV2,
): Promise<GallerySummary> {
  const response = await fetch(`${API_BASE}/music/gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, author, project }),
  });

  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function listMusicGallery(limit = 30, offset = 0): Promise<GallerySummary[]> {
  const response = await fetch(
    `${API_BASE}/music/gallery?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
  );
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json();
  return payload.items ?? [];
}

export async function fetchMusicPiece(id: string): Promise<GalleryDetail> {
  const response = await fetch(`${API_BASE}/music/gallery/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}
