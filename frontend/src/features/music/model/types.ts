export type ScaleName =
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'major'
  | 'minor'
  | 'harmonicMinor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'blues';

export type ProgramMode = 1 | 2 | 3;
/** @deprecated Legacy name kept only for loading older saved strokes. */
export type DrawingResolutionPreset = ProgramMode;

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
  /** Program used when this stroke was created. */
  programMode?: ProgramMode;
  /** @deprecated Legacy v1/v2 field, read only during migration/render fallback. */
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
  programMode: ProgramMode;
  bassEnabled: boolean;
  drumsEnabled: boolean;
  arpeggioEnabled: boolean;
}

export interface MusicProject {
  schemaVersion: 2;
  title: string;
  author: string;
  settings: MusicSettings;
  strokes: Stroke[];
}

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  key: 'C',
  scale: 'majorPentatonic',
  octaveOffset: 0,
  rangeOctaves: 3,
  loopLengthBeats: 4,
  bpm: 120,
  quantizeStepBeats: 1 / 3,
  swing: 0,
  metronomeEnabled: false,
  tuningCents: 0,
  programMode: 1,
  bassEnabled: false,
  drumsEnabled: false,
  arpeggioEnabled: false,
};
