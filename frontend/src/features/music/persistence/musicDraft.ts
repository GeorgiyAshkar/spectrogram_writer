import type { MusicSettings, NoteEvent, Stroke } from '../model/types';

const STORAGE_KEY = 'spectrogram-writer:playmusictheory:draft';

export type PersistedBackground =
  | { kind: 'paper' }
  | { kind: 'sky' }
  | { kind: 'photo'; dataUrl: string };

type MusicDraftV1 = {
  schemaVersion: 1;
  settings: MusicSettings;
  strokes: Stroke[];
  virtualKeyboardEvents: NoteEvent[];
  midiRecordedEvents: NoteEvent[];
  activeColor: string;
  customColor: string;
  backgroundKind: 'paper' | 'sky';
  savedAt: string;
};

export type MusicDraftV2 = {
  schemaVersion: 2;
  settings: MusicSettings;
  strokes: Stroke[];
  virtualKeyboardEvents: NoteEvent[];
  midiRecordedEvents: NoteEvent[];
  activeColor: string;
  customColor: string;
  background: PersistedBackground;
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

function isPersistedBackground(value: unknown): value is PersistedBackground {
  if (!isObject(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'paper' || value.kind === 'sky') return true;
  return value.kind === 'photo' && typeof value.dataUrl === 'string' && value.dataUrl.startsWith('data:image/');
}

function isMusicDraftV2(value: unknown): value is MusicDraftV2 {
  if (!isObject(value) || value.schemaVersion !== 2) return false;
  if (!isObject(value.settings)) return false;
  if (!Array.isArray(value.strokes)) return false;
  if (!Array.isArray(value.virtualKeyboardEvents)) return false;
  if (!Array.isArray(value.midiRecordedEvents)) return false;
  if (typeof value.activeColor !== 'string' || typeof value.customColor !== 'string') return false;
  if (!isPersistedBackground(value.background)) return false;
  return typeof value.savedAt === 'string';
}

function migrateV1(draft: MusicDraftV1): MusicDraftV2 {
  return {
    schemaVersion: 2,
    settings: draft.settings,
    strokes: draft.strokes,
    virtualKeyboardEvents: draft.virtualKeyboardEvents,
    midiRecordedEvents: draft.midiRecordedEvents,
    activeColor: draft.activeColor,
    customColor: draft.customColor,
    background: { kind: draft.backgroundKind },
    savedAt: draft.savedAt,
  };
}

export function loadMusicDraft(): MusicDraftV2 | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isMusicDraftV2(parsed)) return parsed;
    if (isMusicDraftV1(parsed)) return migrateV1(parsed);
    return null;
  } catch {
    return null;
  }
}

export function saveMusicDraft(draft: Omit<MusicDraftV2, 'schemaVersion' | 'savedAt'>): boolean {
  try {
    const payload: MusicDraftV2 = {
      schemaVersion: 2,
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
