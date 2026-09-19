export type ScaleName = 'major' | 'minor';

export type DrawingResolutionPreset = 1 | 2 | 3;
export type RhythmPreset = 1 | 2 | 3;

export interface Point {
  /** Normalized horizontal coordinate: 0 = loop start, 1 = loop end. */
  x: number;
  /** Normalized vertical coordinate: 0 = top/high pitch, 1 = bottom/low pitch. */
  y: number;
  /** Milliseconds since the start of the stroke. */
  t: number;
  /** Optional PointerEvent pressure in the 0..1 range. */
  pressure?: number;
}

export interface Stroke {
  id: string;
  layerId: string;
  color: string;
  points: Point[];
  createdAt: number;
  /** Snapshot of the visual drawing preset used when this stroke was created. */
  drawingResolutionPreset?: DrawingResolutionPreset;
}

export interface NoteEvent {
  id: string;
  layerId: string;
  midi: number;
  velocity: number;
  startBeat: number;
  durationBeats: number;
}

export interface MusicSettings {
  key: string;
  scale: ScaleName;
  octaveOffset: number;
  rangeOctaves: number;
  loopLengthBeats: number;
  bpm: number;
  quantizeStepBeats: number | null;
  swing: number;
  metronomeEnabled: boolean;
  tuningCents: number;
  drawingResolutionPreset: DrawingResolutionPreset;
  rhythmPreset: RhythmPreset;
}

export interface MusicProject {
  schemaVersion: 1;
  title: string;
  author: string;
  settings: MusicSettings;
  strokes: Stroke[];
}

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  key: 'C',
  scale: 'major',
  octaveOffset: 0,
  rangeOctaves: 3,
  loopLengthBeats: 4,
  bpm: 120,
  quantizeStepBeats: null,
  swing: 0,
  metronomeEnabled: false,
  tuningCents: 0,
  drawingResolutionPreset: 1,
  rhythmPreset: 1,
};
