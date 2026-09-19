import type { MusicSettings, NoteEvent, Stroke } from '../model/types';

const STORAGE_KEY = 'spectrogram-writer:playmusictheory:draft';

export type PersistedBackgroundKind = 'paper' | 'sky';

export type MusicDraftV1 = {
  schemaVersion: 1;
  settings: MusicSettings;
  strokes: Stroke[];
  virtualKeyboardEvents: NoteEvent[];
  midiRecordedEvents: NoteEvent[];
  activeColor: string;
  customColor: string;
  backgroundKind: PersistedBackgroundKind;
  savedAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMusicDraftV1(value: unknown): value is MusicDraftV1 {
  if (!isObject(value) || value.schemaVersion !== 1) return false;
  if (!isObject(value.settings)) return false;
  if (!Array.isArray(value.strokes)) return false;
  if (!Array.isArray(value.virtualKeyboardEvents)) return false;
  if (!Array.isArray(value.midiRecordedEvents)) return false;
  if (typeof value.activeColor !== 'string' || typeof value.customColor !== 'string') return false;
  if (value.backgroundKind !== 'paper' && value.backgroundKind !== 'sky') return false;
  return true;
}

export function loadMusicDraft(): MusicDraftV1 | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isMusicDraftV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMusicDraft(draft: Omit<MusicDraftV1, 'schemaVersion' | 'savedAt'>): boolean {
  try {
    const payload: MusicDraftV1 = {
      schemaVersion: 1,
      ...draft,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearMusicDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable or blocked.
  }
}
