import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import defaults from '../../defaults.json';
import { FormField } from './components/FormField';
import { Header } from './components/Header';
import { AudioPlayer } from './components/AudioPlayer';
import { PreviewCard } from './components/PreviewCard';
import { SettingsSection } from './components/SettingsSection';
import { useSpectrogramGenerator } from './hooks/useSpectrogramGenerator';
import type { GenerationFormData } from './types/config';
import {
  compileStrokes,
  DEFAULT_MUSIC_SETTINGS,
  noteNameToMidi,
  type MusicSettings,
  type NoteEvent,
  type Stroke,
} from './features/music/model';
import { MusicCanvas, type MusicCanvasBackground } from './features/music/canvas/MusicCanvas';
import { renderNoteEventsToWavUrl } from './features/music/audio/renderWav';
import { useRealtimeMusicTransport } from './features/music/audio/useRealtimeMusicTransport';
import { buildAccompanimentEvents } from './features/music/audio/accompaniment';
import { renderNoteEventsToMidiUrl } from './features/music/export/renderMidi';
import { useWebMidiInput } from './features/music/midi/useWebMidiInput';
import {
  clearMusicDraft,
  loadMusicDraft,
  saveMusicDraft,
} from './features/music/persistence/musicDraft';
import { prepareBackgroundPhoto } from './features/music/background/prepareBackgroundPhoto';
import { captureCanvasThumbnail } from './features/music/gallery/captureCanvasThumbnail';
import {
  fetchMusicPiece,
  listMusicGallery,
  publishMusicPiece,
  type GallerySummary,
  type MusicShareProject,
  type MusicShareProjectV2,
} from './services/musicGallery';
import {
  DEFAULT_MUSIC_COLORS,
  PARITY_ACCOMPANIMENT_CONTROLS,
  PARITY_KEY_OPTIONS,
  PARITY_SCALE_OPTIONS,
  PARITY_BPM,
  PARITY_QUANTIZE_OPTIONS,
  PARITY_RANGE_OPTIONS,
  PARITY_PROGRAMS,
  PARITY_SWING_OPTIONS,
  PARITY_TUNE_CENTS,
} from './features/music/parityConfig';
import './styles/app.css';

const initialState: GenerationFormData = defaults as GenerationFormData;

function parseWeights(value: string): number[] | null {
  const weights = value
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(Number)
    .filter((item) => Number.isFinite(item));
  return weights.length > 0 ? weights : null;
}

export default function App() {
  const [formData, setFormData] = useState<GenerationFormData>(initialState);
  const [inputSource, setInputSource] = useState<'text' | 'upload' | 'draw'>('draw');
  const [showSettings, setShowSettings] = useState(false);
  const [activePanel, setActivePanel] = useState<'text' | 'upload' | 'draw' | 'music' | 'info'>('draw');
  const [headerControlsHidden, setHeaderControlsHidden] = useState(false);
  const [drawCanvasHeight, setDrawCanvasHeight] = useState(340);
  const [eraserEnabled, setEraserEnabled] = useState(false);
  const [musicSettings, setMusicSettings] = useState<MusicSettings>(DEFAULT_MUSIC_SETTINGS);
  const [virtualKeyboardEvents, setVirtualKeyboardEvents] = useState<NoteEvent[]>([]);
  const [musicStrokes, setMusicStrokes] = useState<Stroke[]>([]);
  const [redoMusicStrokes, setRedoMusicStrokes] = useState<Stroke[]>([]);
  const [musicColor, setMusicColor] = useState<string>(DEFAULT_MUSIC_COLORS[0]);
  const [musicCustomColor, setMusicCustomColor] = useState<string>('#111827');
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [midiRecordedEvents, setMidiRecordedEvents] = useState<NoteEvent[]>([]);
  const [musicBackgroundKind, setMusicBackgroundKind] = useState<'paper' | 'sky' | 'photo'>('paper');
  const [musicPhotoUrl, setMusicPhotoUrl] = useState<string | null>(null);
  const [musicPhotoFit, setMusicPhotoFit] = useState<'fill' | 'fit' | 'stretch'>('fill');
  const [showMusicGrid, setShowMusicGrid] = useState(true);
  const [musicDraftHydrated, setMusicDraftHydrated] = useState(false);
  const [musicDraftStatus, setMusicDraftStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [isTakeRecording, setIsTakeRecording] = useState(false);
  const [takeUrl, setTakeUrl] = useState<string | null>(null);
  const [takeMimeType, setTakeMimeType] = useState('video/webm');
  const [takeError, setTakeError] = useState<string | null>(null);
  const [showInstrumentPanel, setShowInstrumentPanel] = useState(false);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [showMusicHelp, setShowMusicHelp] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [shareAuthor, setShareAuthor] = useState('');
  const [shareStatus, setShareStatus] = useState<'idle' | 'publishing' | 'published' | 'error'>('idle');
  const [shareError, setShareError] = useState<string | null>(null);
  const [publishedPieceId, setPublishedPieceId] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryItems, setGalleryItems] = useState<GallerySummary[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const pendingMidiNotesRef = useRef(
    new Map<string, { midi: number; startBeat: number; velocity: number; id: string }>(),
  );
  const pendingVirtualNotesRef = useRef(
    new Map<string, { midi: number; startBeat: number; velocity: number; id: string }>(),
  );
  const realtimePlayingRef = useRef(false);
  const musicCanvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const takeChunksRef = useRef<Blob[]>([]);
  const takeVideoTracksRef = useRef<MediaStreamTrack[]>([]);

  useEffect(() => {
    const draft = loadMusicDraft();
    if (draft) {
      setMusicSettings(draft.settings);
      setMusicStrokes(draft.strokes);
      setVirtualKeyboardEvents(draft.virtualKeyboardEvents);
      setMidiRecordedEvents(draft.midiRecordedEvents);
      setMusicColor(draft.activeColor);
      setMusicCustomColor(draft.customColor);
      setMusicBackgroundKind(draft.background.kind);
      setMusicPhotoUrl(draft.background.kind === 'photo' ? draft.background.dataUrl : null);
      setMusicPhotoFit(draft.background.kind === 'photo' ? draft.background.fit ?? 'fill' : 'fill');
      setMusicDraftStatus('saved');
    }
    setMusicDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!musicDraftHydrated) return;

    setMusicDraftStatus('idle');
    const timer = window.setTimeout(() => {
      const saved = saveMusicDraft({
        settings: musicSettings,
        strokes: musicStrokes,
        virtualKeyboardEvents,
        midiRecordedEvents,
        activeColor: musicColor,
        customColor: musicCustomColor,
        background:
          musicBackgroundKind === 'photo' && musicPhotoUrl
            ? { kind: 'photo', dataUrl: musicPhotoUrl, fit: musicPhotoFit }
            : { kind: musicBackgroundKind === 'sky' ? 'sky' : 'paper' },
      });
      setMusicDraftStatus(saved ? 'saved' : 'error');
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    midiRecordedEvents,
    musicBackgroundKind,
    musicColor,
    musicCustomColor,
    musicDraftHydrated,
    musicSettings,
    musicPhotoFit,
    musicPhotoUrl,
    musicStrokes,
    virtualKeyboardEvents,
  ]);

  const handlePanelChange = (next: 'text' | 'upload' | 'draw' | 'music' | 'info') => {
    setActivePanel(next);
    if (next === 'text' || next === 'upload' || next === 'draw') {
      setInputSource(next);
    }
  };
  const keyboardOctaves = useMemo(
    () => [2, 3, 4].map((octave) => octave + musicSettings.octaveOffset),
    [musicSettings.octaveOffset],
  );
  const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  const canvasMusicEvents = useMemo(
    () => compileStrokes(musicStrokes, musicSettings),
    [musicSettings, musicStrokes],
  );

  const accompanimentEvents = useMemo(
    () => buildAccompanimentEvents(musicSettings),
    [musicSettings],
  );

  const activeMusicEvents = useMemo(
    () =>
      [
        ...canvasMusicEvents,
        ...virtualKeyboardEvents,
        ...midiRecordedEvents,
        ...accompanimentEvents,
      ].sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi),
    [accompanimentEvents, canvasMusicEvents, midiRecordedEvents, virtualKeyboardEvents],
  );
  const musicPlaybackSettings = musicSettings;

  const realtimeMusic = useRealtimeMusicTransport(activeMusicEvents, musicPlaybackSettings);

  useEffect(() => {
    realtimePlayingRef.current = realtimeMusic.isPlaying;
  }, [realtimeMusic.isPlaying]);

  const handleMidiNoteOn = useCallback(
    (midi: number, velocity: number, deviceId: string) => {
      const voiceId = `${deviceId}:${midi}`;
      void realtimeMusic.noteOn(midi, velocity, voiceId);

      if (!realtimePlayingRef.current) return;
      pendingMidiNotesRef.current.set(voiceId, {
        midi,
        startBeat: realtimeMusic.getPositionBeat(),
        velocity,
        id: `midi-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      });
    },
    [realtimeMusic.getPositionBeat, realtimeMusic.noteOn],
  );

  const handleMidiNoteOff = useCallback(
    (midi: number, deviceId: string) => {
      const voiceId = `${deviceId}:${midi}`;
      realtimeMusic.noteOff(midi, voiceId);

      const pending = pendingMidiNotesRef.current.get(voiceId);
      if (!pending) return;
      pendingMidiNotesRef.current.delete(voiceId);

      const endBeat = realtimeMusic.getPositionBeat();
      const loopLength = Math.max(0.001, musicPlaybackSettings.loopLengthBeats);
      let durationBeats = endBeat - pending.startBeat;
      if (durationBeats < 0) durationBeats += loopLength;
      durationBeats = Math.max(0.0625, durationBeats);

      setMidiRecordedEvents((current) => [
        ...current,
        {
          id: pending.id,
          layerId: 'midi',
          midi: pending.midi,
          velocity: pending.velocity,
          startBeat: pending.startBeat,
          durationBeats,
        },
      ]);
    },
    [musicPlaybackSettings.loopLengthBeats, realtimeMusic.getPositionBeat, realtimeMusic.noteOff],
  );

  const handleVirtualNoteOn = useCallback(
    (noteName: string) => {
      const midi = noteNameToMidi(noteName);
      if (midi === null) return;

      const voiceId = `virtual:${midi}`;
      void realtimeMusic.noteOn(midi, 0.82, voiceId);

      if (!realtimePlayingRef.current) return;
      pendingVirtualNotesRef.current.set(voiceId, {
        midi,
        startBeat: realtimeMusic.getPositionBeat(),
        velocity: 0.82,
        id: `virtual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      });
    },
    [realtimeMusic.getPositionBeat, realtimeMusic.noteOn],
  );

  const handleVirtualNoteOff = useCallback(
    (noteName: string) => {
      const midi = noteNameToMidi(noteName);
      if (midi === null) return;

      const voiceId = `virtual:${midi}`;
      realtimeMusic.noteOff(midi, voiceId);

      const pending = pendingVirtualNotesRef.current.get(voiceId);
      if (!pending) return;
      pendingVirtualNotesRef.current.delete(voiceId);

      const endBeat = realtimeMusic.getPositionBeat();
      const loopLength = Math.max(0.001, musicPlaybackSettings.loopLengthBeats);
      let durationBeats = endBeat - pending.startBeat;
      if (durationBeats < 0) durationBeats += loopLength;
      durationBeats = Math.max(0.0625, durationBeats);

      setVirtualKeyboardEvents((current) => [
        ...current,
        {
          id: pending.id,
          layerId: 'keyboard',
          midi: pending.midi,
          velocity: pending.velocity,
          startBeat: pending.startBeat,
          durationBeats,
        },
      ]);
    },
    [musicPlaybackSettings.loopLengthBeats, realtimeMusic.getPositionBeat, realtimeMusic.noteOff],
  );

  const midiInput = useWebMidiInput({
    enabled: midiEnabled && activePanel === 'music',
    onNoteOn: handleMidiNoteOn,
    onNoteOff: handleMidiNoteOff,
  });

  const musicCanvasBackground = useMemo<MusicCanvasBackground>(
    () =>
      musicBackgroundKind === 'photo'
        ? { kind: 'photo', url: musicPhotoUrl, fit: musicPhotoFit }
        : { kind: musicBackgroundKind },
    [musicBackgroundKind, musicPhotoFit, musicPhotoUrl],
  );

  useEffect(() => {
    if (activePanel === 'music') return;
    realtimePlayingRef.current = false;
    pendingMidiNotesRef.current.clear();
    pendingVirtualNotesRef.current.clear();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    mediaRecorderRef.current = null;
    realtimeMusic.stop();
  }, [activePanel, realtimeMusic.stop]);

  useEffect(
    () => () => {
      if (takeUrl) URL.revokeObjectURL(takeUrl);
    },
    [takeUrl],
  );

  useEffect(() => {
    const pieceId = new URLSearchParams(window.location.search).get('piece');
    if (!pieceId) return;
    void openSharedPiece(pieceId, false);
  }, []);

  const downloadMusicWav = () => {
    if (!activeMusicEvents.length) return;
    const url = renderNoteEventsToWavUrl(activeMusicEvents, musicPlaybackSettings);
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const filename = `music_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.wav`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const downloadMusicMidi = () => {
    if (!activeMusicEvents.length) return;
    const url = renderNoteEventsToMidiUrl(activeMusicEvents, musicPlaybackSettings);
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const filename = `music_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.mid`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const startTakeRecording = async () => {
    const canvas = musicCanvasElementRef.current;
    if (!canvas) {
      setTakeError('Музыкальный холст недоступен.');
      return;
    }
    if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
      setTakeError('Запись take не поддерживается этим браузером.');
      return;
    }

    try {
      setTakeError(null);
      if (takeUrl) {
        URL.revokeObjectURL(takeUrl);
        setTakeUrl(null);
      }

      const videoStream = canvas.captureStream(30);
      const audioStream = await realtimeMusic.getCaptureStream();
      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);

      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const mimeType =
        candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
      const recorder = mimeType
        ? new MediaRecorder(combined, { mimeType })
        : new MediaRecorder(combined);

      takeChunksRef.current = [];
      takeVideoTracksRef.current = videoStream.getVideoTracks();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) takeChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setTakeError('Не удалось записать take.');
      };
      recorder.onstop = () => {
        const finalType = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(takeChunksRef.current, { type: finalType });
        setTakeMimeType(finalType);
        setTakeUrl(URL.createObjectURL(blob));
        setIsTakeRecording(false);
        takeChunksRef.current = [];
        for (const track of takeVideoTracksRef.current) track.stop();
        takeVideoTracksRef.current = [];
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsTakeRecording(true);

      if (!realtimeMusic.isPlaying) {
        await realtimeMusic.togglePlayback();
      }
    } catch {
      setTakeError('Не удалось запустить запись take.');
      setIsTakeRecording(false);
    }
  };

  const stopTakeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    mediaRecorderRef.current = null;
    realtimeMusic.stop();
  };

  const downloadTake = () => {
    if (!takeUrl) return;
    const extension = takeMimeType.includes('mp4') ? 'mp4' : 'webm';
    const link = document.createElement('a');
    link.href = takeUrl;
    link.download = `music_take_${new Date().toISOString().replace(/[:.]/g, '-') }.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const buildShareProject = (): MusicShareProjectV2 => ({
    schemaVersion: 2,
    settings: musicSettings,
    strokes: musicStrokes,
    virtualKeyboardEvents,
    midiRecordedEvents,
    activeColor: musicColor,
    customColor: musicCustomColor,
    background:
      musicBackgroundKind === 'photo' && musicPhotoUrl
        ? { kind: 'photo', dataUrl: musicPhotoUrl, fit: musicPhotoFit }
        : { kind: musicBackgroundKind === 'sky' ? 'sky' : 'paper' },
  });

  const publishCurrentProject = async () => {
    if (!shareTitle.trim() || !shareAuthor.trim()) return;
    setShareStatus('publishing');
    setShareError(null);
    try {
      const thumbnail = musicCanvasElementRef.current
        ? captureCanvasThumbnail(musicCanvasElementRef.current)
        : null;
      const result = await publishMusicPiece(
        shareTitle.trim(),
        shareAuthor.trim(),
        buildShareProject(),
        thumbnail,
      );
      setPublishedPieceId(result.id);
      setShareStatus('published');
    } catch (error) {
      setShareStatus('error');
      setShareError(error instanceof Error ? error.message : 'Не удалось опубликовать проект.');
    }
  };

  const copyPublishedLink = async () => {
    if (!publishedPieceId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('piece', publishedPieceId);
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      window.prompt('Скопируйте ссылку', url.toString());
    }
  };

  const refreshGallery = async () => {
    setGalleryLoading(true);
    setGalleryError(null);
    try {
      setGalleryItems(await listMusicGallery());
    } catch (error) {
      setGalleryError(error instanceof Error ? error.message : 'Не удалось загрузить галерею.');
    } finally {
      setGalleryLoading(false);
    }
  };

  const applySharedProject = (project: MusicShareProject) => {
    realtimeMusic.stop();
    pendingMidiNotesRef.current.clear();
    pendingVirtualNotesRef.current.clear();
    setMusicSettings(project.settings);
    setMusicStrokes(project.strokes);
    setRedoMusicStrokes([]);
    setVirtualKeyboardEvents(project.virtualKeyboardEvents ?? []);
    setMidiRecordedEvents(project.midiRecordedEvents ?? []);
    setMusicColor(project.activeColor || DEFAULT_MUSIC_COLORS[0]);
    setMusicCustomColor(project.customColor || '#111827');

    if (project.schemaVersion === 2) {
      setMusicBackgroundKind(project.background.kind);
      setMusicPhotoUrl(project.background.kind === 'photo' ? project.background.dataUrl : null);
      setMusicPhotoFit(project.background.kind === 'photo' ? project.background.fit ?? 'fill' : 'fill');
      return;
    }

    if (project.schemaVersion === 1) {
      setMusicBackgroundKind(project.backgroundKind === 'sky' ? 'sky' : 'paper');
      setMusicPhotoUrl(null);
      return;
    }

    setGalleryError('Эта версия проекта пока не поддерживается.');
  };

  const openSharedPiece = async (id: string, requireConfirmation = true) => {
    if (
      requireConfirmation &&
      activeMusicEvents.length > 0 &&
      !window.confirm('Открыть работу из галереи? Текущий проект будет заменён, но его последняя версия уже сохранена локально.')
    ) {
      return;
    }

    setGalleryLoading(true);
    setGalleryError(null);
    try {
      const detail = await fetchMusicPiece(id);
      applySharedProject(detail.project);
      setShareTitle(detail.title);
      setShareAuthor(detail.author);
      setShowGallery(false);
    } catch (error) {
      setGalleryError(error instanceof Error ? error.message : 'Не удалось открыть работу.');
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleMusicStrokesChange = (next: Stroke[]) => {
    setMusicStrokes(next);
    setRedoMusicStrokes([]);
  };

  const undoMusic = () => {
    setMusicStrokes((current) => {
      if (current.length === 0) return current;
      const last = current[current.length - 1];
      setRedoMusicStrokes((redo) => [...redo, last]);
      return current.slice(0, -1);
    });
  };

  const redoMusic = () => {
    setRedoMusicStrokes((current) => {
      if (current.length === 0) return current;
      const stroke = current[current.length - 1];
      setMusicStrokes((strokes) => [...strokes, stroke]);
      return current.slice(0, -1);
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (activePanel !== 'music') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modifier && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoMusic();
      } else if ((modifier && key === 'z' && event.shiftKey) || (event.ctrlKey && key === 'y')) {
        event.preventDefault();
        redoMusic();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePanel]);

  const clearMusic = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    mediaRecorderRef.current = null;
    realtimeMusic.stop();
    clearMusicDraft();
    setMusicStrokes([]);
    setRedoMusicStrokes([]);
    setVirtualKeyboardEvents([]);
    setMidiRecordedEvents([]);
    pendingMidiNotesRef.current.clear();
    pendingVirtualNotesRef.current.clear();
  };

  const chooseMusicPhoto = async (file: File | null) => {
    if (!file) return;
    try {
      const prepared = await prepareBackgroundPhoto(file);
      setMusicPhotoUrl(prepared.dataUrl);
      setMusicPhotoFit('fill');
      setMusicBackgroundKind('photo');
      setTakeError(null);
    } catch (error) {
      setTakeError(error instanceof Error ? error.message : 'Не удалось подготовить фотографию.');
    }
  };

  const handleMusicCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    musicCanvasElementRef.current = canvas;
  }, []);

  const updateMusicSetting = <K extends keyof MusicSettings>(key: K, value: MusicSettings[K]) => {
    setMusicSettings((current) => ({ ...current, [key]: value }));
  };

  const tapTempo = () => {
    const now = performance.now();
    const recent = [...tapTimesRef.current.filter((value) => now - value < 4000), now].slice(-8);
    tapTimesRef.current = recent;
    if (recent.length < 2) return;

    const intervals = recent.slice(1).map((value, index) => value - recent[index]).sort((a, b) => a - b);
    const middle = Math.floor(intervals.length / 2);
    const median =
      intervals.length % 2 === 0
        ? (intervals[middle - 1] + intervals[middle]) / 2
        : intervals[middle];

    const bpm = Math.round(60000 / Math.max(1, median));
    updateMusicSetting('bpm', Math.min(PARITY_BPM.max, Math.max(PARITY_BPM.min, bpm)));
  };

  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawState = useRef<{ active: boolean }>({ active: false });
  const drawCanvasWrapRef = useRef<HTMLDivElement | null>(null);

  const harmonicWeightsText = useMemo(
    () => (formData.harmonic_weights?.length ? formData.harmonic_weights.join(', ') : ''),
    [formData.harmonic_weights],
  );

  const showHarmonicControls = formData.timbre_mode === 'harmonic';
  const showCustomWeights =
    formData.instrument_type === 'custom' || formData.harmonic_decay_mode === 'custom_list';
  const showFreqXFlowModes = formData.orientation === 'freq-x';

  const updateField = <K extends keyof GenerationFormData>(key: K, value: GenerationFormData[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const updateFreqXMarquee = (checked: boolean) => {
    setFormData((current) => ({
      ...current,
      freq_x_marquee: checked,
      freq_x_word_rows: checked ? false : current.freq_x_word_rows,
    }));
  };

  const updateFreqXWordRows = (checked: boolean) => {
    setFormData((current) => ({
      ...current,
      freq_x_word_rows: checked,
      freq_x_marquee: checked ? false : current.freq_x_marquee,
    }));
  };

  const uploadImage = async (file: File | null) => {
    if (!file) {
      updateField('image_base64', null);
      return;
    }
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    updateField('image_base64', btoa(binary));
    setInputSource('upload');
  };

  const syncCanvasToPayload = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : null;
    updateField('image_base64', base64);
  };

  const resizeCanvas = (nextHeight: number) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const clampedHeight = Math.min(1200, Math.max(340, Math.round(nextHeight)));
    if (canvas.height === clampedHeight) return;

    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    const snapshotCtx = snapshot.getContext('2d');
    if (snapshotCtx) {
      snapshotCtx.drawImage(canvas, 0, 0);
    }

    canvas.height = clampedHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(snapshot, 0, 0);
    syncCanvasToPayload();
  };

  const clearCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    syncCanvasToPayload();
  };

  const drawAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas || !drawState.current.active) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = eraserEnabled ? '#ffffff' : '#000000';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    updateField('image_base64', canvas.toDataURL('image/png').split(',')[1] ?? null);
  };

  const toggleEraser = () => {
    setEraserEnabled((current) => !current);
  };

  const downloadCanvasSnapshot = (baseName: string) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${baseName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    clearCanvas();
  }, []);

  useEffect(() => {
    const wrap = drawCanvasWrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextHeight = Math.round(entry.contentRect.height);
      setDrawCanvasHeight((current) => {
        if (current === nextHeight) return current;
        resizeCanvas(nextHeight);
        return nextHeight;
      });
    });

    observer.observe(wrap);
    resizeCanvas(Math.round(wrap.getBoundingClientRect().height));

    return () => observer.disconnect();
  }, []);

  const effectiveFormData = useMemo(
    () => ({
      ...formData,
      image_base64: inputSource === 'text' ? null : formData.image_base64,
      leading_silence: formData.orientation === 'freq-x' ? 0 : formData.leading_silence,
      trailing_silence: formData.orientation === 'freq-x' ? 0 : formData.trailing_silence,
    }),
    [formData, inputSource],
  );

  const { preview, error, summary, logoUrl, isLoadingPreview, isDownloading, playAudio, audioUrl } =
    useSpectrogramGenerator(effectiveFormData);

  return (
    <div className="page-shell">
      <div className="app-shell">
        <Header
          logoUrl={logoUrl}
          activePanel={activePanel}
          onPanelChange={handlePanelChange}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings((s) => !s)}
          controlsHidden={headerControlsHidden}
          onLogoTripleClick={() => setHeaderControlsHidden((current) => !current)}
        />
        <section className="panel playback-panel">
          <AudioPlayer
            audioUrl={audioUrl}
            isPreparingAudio={isDownloading}
            onRequestAudio={playAudio}
            onToggleEraser={toggleEraser}
            eraserEnabled={eraserEnabled}
            onDownloadSnapshot={downloadCanvasSnapshot}
            onClearCanvas={() => { clearCanvas(); setInputSource('draw'); }}
            musicModeEnabled={activePanel === 'music'}
            musicUndoDisabled={musicStrokes.length === 0}
            musicRedoDisabled={redoMusicStrokes.length === 0}
            musicHasContent={activeMusicEvents.length > 0 || musicSettings.metronomeEnabled}
            musicHasExportContent={activeMusicEvents.length > 0}
            musicIsPlaying={realtimeMusic.isPlaying}
            musicProgress={realtimeMusic.progress}
            onUndoMusic={undoMusic}
            onRedoMusic={redoMusic}
            onToggleMusicPlayback={realtimeMusic.togglePlayback}
            onSeekMusic={(progress) => realtimeMusic.seek(progress * musicPlaybackSettings.loopLengthBeats)}
          />
          {activePanel === 'music' ? (
            <div className="music-panel">
              <div className="music-panel-switches">
                <button
                  type="button"
                  className="button-secondary music-help-button"
                  aria-label="Справка по музыкальному режиму"
                  aria-expanded={showMusicHelp}
                  onClick={() => setShowMusicHelp((current) => !current)}
                >
                  ?
                </button>
                <button
                  type="button"
                  className={showInstrumentPanel ? 'button-secondary is-active' : 'button-secondary'}
                  aria-expanded={showInstrumentPanel}
                  onClick={() => setShowInstrumentPanel((current) => !current)}
                >
                  The instrument
                </button>
                <button
                  type="button"
                  className={showVirtualKeyboard ? 'button-secondary is-active' : 'button-secondary'}
                  aria-expanded={showVirtualKeyboard}
                  onClick={() => setShowVirtualKeyboard((current) => !current)}
                >
                  Key
                </button>
                <button
                  type="button"
                  className={showMusicGrid ? 'button-secondary is-active' : 'button-secondary'}
                  aria-pressed={showMusicGrid}
                  title="The grid: notes and beats under the ink"
                  aria-label="Grid"
                  onClick={() => setShowMusicGrid((current) => !current)}
                >
                  Grid
                </button>
              </div>

              {showMusicHelp ? (
                <div className="music-help-panel" role="dialog" aria-label="Справка по музыкальному режиму">
                  <div className="music-help-panel__header">
                    <strong>play_music_theory — справка</strong>
                    <button
                      type="button"
                      className="button-secondary"
                      aria-label="Закрыть справку"
                      onClick={() => setShowMusicHelp(false)}
                    >
                      ×
                    </button>
                  </div>
                  <p>Рисуйте на холсте: по горизонтали идёт время, по вертикали — высота ноты.</p>
                  <p>Key и Scale ограничивают доступные ноты; Range и Octave меняют вертикальный диапазон.</p>
                  <p>Quantize, Swing, Tempo/Tap и Click управляют ритмом. MIDI in подключает внешнюю MIDI-клавиатуру.</p>
                  <p>Цвет выбирается в палитре; + открывает пользовательский цвет. Paper/Sky/Photo меняют только фон.</p>
                  <p>WAV и MIDI экспортируют один loop. Record создаёт аудиовизуальный take, Share публикует проект в gallery.</p>
                </div>
              ) : null}

              {showInstrumentPanel ? (
              <div className="music-instrument-panel">
                <div className="music-instrument-panel__header">
                  <strong>The instrument</strong>
                  <button
                    type="button"
                    className="button-secondary"
                    aria-label="Закрыть The instrument"
                    onClick={() => setShowInstrumentPanel(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="music-parity-controls">
                <label className="music-control">
                  <span>Key</span>
                  <select value={musicSettings.key} onChange={(e) => updateMusicSetting('key', e.target.value)}>
                    {PARITY_KEY_OPTIONS.map((key) => <option key={key} value={key}>{key}</option>)}
                  </select>
                </label>
                <label className="music-control">
                  <span>Scale</span>
                  <select value={musicSettings.scale} onChange={(e) => updateMusicSetting('scale', e.target.value as MusicSettings['scale'])}>
                    {PARITY_SCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="music-control">
                  <span>Range</span>
                  <select value={musicSettings.rangeOctaves} onChange={(e) => updateMusicSetting('rangeOctaves', Number(e.target.value))}>
                    {PARITY_RANGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <div className="music-control">
                  <span>Octave</span>
                  <div className="music-inline-buttons">
                    <button type="button" onClick={() => updateMusicSetting('octaveOffset', musicSettings.octaveOffset - 1)}>−</button>
                    <strong>{musicSettings.octaveOffset}</strong>
                    <button type="button" onClick={() => updateMusicSetting('octaveOffset', musicSettings.octaveOffset + 1)}>+</button>
                  </div>
                </div>
                <label className="music-control">
                  <span>Tempo</span>
                  <div className="music-tempo">
                    <input
                      type="number"
                      min={PARITY_BPM.min}
                      max={PARITY_BPM.max}
                      value={musicSettings.bpm}
                      aria-label="Tempo BPM"
                      readOnly
                    />
                    <input
                      type="range"
                      min={PARITY_BPM.min}
                      max={PARITY_BPM.max}
                      step={1}
                      value={musicSettings.bpm}
                      aria-label="Tempo"
                      onChange={(e) => updateMusicSetting('bpm', Number(e.target.value))}
                    />
                    <button type="button" onClick={tapTempo}>Tap</button>
                  </div>
                </label>
                <label className="music-control">
                  <span>Quantize</span>
                  <select
                    value={
                      PARITY_QUANTIZE_OPTIONS.find(
                        (option) => Math.abs(option.stepBeats - (musicSettings.quantizeStepBeats ?? -1)) < 1e-6,
                      )?.referenceValue ?? 3
                    }
                    onChange={(e) => {
                      const referenceValue = Number(e.target.value);
                      const option = PARITY_QUANTIZE_OPTIONS.find(
                        (candidate) => candidate.referenceValue === referenceValue,
                      );
                      if (option) updateMusicSetting('quantizeStepBeats', option.stepBeats);
                    }}
                  >
                    {PARITY_QUANTIZE_OPTIONS.map((option) => (
                      <option key={option.referenceValue} value={option.referenceValue}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="music-control">
                  <span>Swing</span>
                  <select value={musicSettings.swing} onChange={(e) => updateMusicSetting('swing', Number(e.target.value))}>
                    {PARITY_SWING_OPTIONS.map((option) => (
                      <option key={option.label} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <div className="music-control">
                  <span>Click</span>
                  <button
                    type="button"
                    className={musicSettings.metronomeEnabled ? 'music-toggle is-active' : 'music-toggle'}
                    aria-pressed={musicSettings.metronomeEnabled}
                    onClick={() => updateMusicSetting('metronomeEnabled', !musicSettings.metronomeEnabled)}
                  >
                    {musicSettings.metronomeEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                <div className="music-control">
                  <span>MIDI in</span>
                  <button
                    type="button"
                    className={midiEnabled ? 'music-toggle is-active' : 'music-toggle'}
                    aria-pressed={midiEnabled}
                    onClick={() => {
                      if (midiEnabled) {
                        for (const [voiceId, pending] of pendingMidiNotesRef.current) {
                          realtimeMusic.noteOff(pending.midi, voiceId);
                        }
                        pendingMidiNotesRef.current.clear();
                      }
                      setMidiEnabled((current) => !current);
                    }}
                  >
                    {midiEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                <label className="music-control">
                  <span>Tune</span>
                  <input
                    type="number"
                    min={PARITY_TUNE_CENTS.min}
                    max={PARITY_TUNE_CENTS.max}
                    step={PARITY_TUNE_CENTS.step}
                    value={musicSettings.tuningCents}
                    onChange={(e) =>
                      updateMusicSetting(
                        'tuningCents',
                        Math.min(
                          PARITY_TUNE_CENTS.max,
                          Math.max(PARITY_TUNE_CENTS.min, Number(e.target.value)),
                        ),
                      )
                    }
                  />
                </label>
                <label className="music-control">
                  <span>Paper</span>
                  <select
                    value={musicBackgroundKind}
                    onChange={(e) => setMusicBackgroundKind(e.target.value as 'paper' | 'sky' | 'photo')}
                  >
                    <option value="paper">Paper</option>
                    <option value="sky">Sky</option>
                    <option value="photo" disabled={!musicPhotoUrl}>Photo</option>
                  </select>
                </label>
                <label className="music-control music-photo-picker">
                  <span>Photo</span>
                  <span className="button-secondary music-photo-picker__button">Выбрать</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => { void chooseMusicPhoto(e.target.files?.[0] ?? null); }}
                  />
                </label>
                {musicBackgroundKind === 'photo' && musicPhotoUrl ? (
                  <div className="music-control">
                    <span>Photo fit</span>
                    <div className="music-inline-buttons" aria-label="Photo fit">
                      {(['fill', 'fit', 'stretch'] as const).map((fit) => (
                        <button
                          type="button"
                          key={fit}
                          className={musicPhotoFit === fit ? 'is-active' : ''}
                          aria-pressed={musicPhotoFit === fit}
                          onClick={() => setMusicPhotoFit(fit)}
                        >
                          {fit === 'fill' ? 'Fill' : fit === 'fit' ? 'Fit' : 'Stretch'}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="music-control music-export-control">
                  <span>Export</span>
                  <div className="music-inline-buttons">
                    <button
                      type="button"
                      onClick={downloadMusicWav}
                      disabled={activeMusicEvents.length === 0}
                    >
                      WAV
                    </button>
                    <button
                      type="button"
                      onClick={downloadMusicMidi}
                      disabled={activeMusicEvents.length === 0}
                    >
                      MIDI
                    </button>
                  </div>
                </div>
                </div>
              </div>
              ) : null}

              <div className="music-reference-programs">
                <div className="music-inline-buttons" aria-label="Programs">
                  {PARITY_PROGRAMS.map((program) => (
                    <button
                      type="button"
                      key={program.value}
                      title={program.tooltip}
                      aria-label={program.tooltip}
                      className={musicSettings.programMode === program.value ? 'is-active' : ''}
                      aria-pressed={musicSettings.programMode === program.value}
                      onClick={() => updateMusicSetting('programMode', program.value)}
                    >
                      {program.label}
                    </button>
                  ))}
                </div>
                <div className="music-inline-buttons" aria-label="Accompaniment">
                  {PARITY_ACCOMPANIMENT_CONTROLS.map((control) => {
                    const active = musicSettings[control.setting];
                    return (
                      <button
                        type="button"
                        key={control.setting}
                        title={control.tooltip}
                        aria-label={control.tooltip}
                        className={active ? 'is-active' : ''}
                        aria-pressed={active}
                        onClick={() =>
                          setMusicSettings((current) => ({
                            ...current,
                            [control.setting]: !current[control.setting],
                          }))
                        }
                      >
                        {control.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="music-palette" aria-label="Палитра">
                {DEFAULT_MUSIC_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={musicColor === color ? 'music-color is-active' : 'music-color'}
                    style={{ background: color }}
                    aria-label={`Цвет ${color}`}
                    aria-pressed={musicColor === color}
                    onClick={() => setMusicColor(color)}
                  />
                ))}
                <label
                  className={musicColor === musicCustomColor ? 'music-color-add is-active' : 'music-color-add'}
                  title="Свой цвет"
                  aria-label="Добавить свой цвет"
                >
                  <span>+</span>
                  <input
                    type="color"
                    value={musicCustomColor}
                    onChange={(e) => {
                      setMusicCustomColor(e.target.value);
                      setMusicColor(e.target.value);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={isTakeRecording ? 'button-secondary music-record is-active' : 'button-secondary music-record'}
                  onClick={() => {
                    if (isTakeRecording) stopTakeRecording();
                    else void startTakeRecording();
                  }}
                >
                  {isTakeRecording ? 'stop' : 'record'}
                </button>
                {takeUrl ? (
                  <button type="button" className="button-secondary" onClick={downloadTake}>
                    Скачать take
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setShowSharePanel((current) => !current);
                    setShareStatus('idle');
                    setShareError(null);
                  }}
                >
                  share
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setShowGallery((current) => !current);
                    if (!showGallery) void refreshGallery();
                  }}
                >
                  gallery
                </button>
                <button type="button" className="button-secondary" onClick={clearMusic} disabled={activeMusicEvents.length === 0}>
                  Очистить
                </button>
              </div>

              {showSharePanel ? (
                <div className="music-share-panel">
                  <label>
                    <span>title</span>
                    <input
                      type="text"
                      maxLength={48}
                      value={shareTitle}
                      onChange={(e) => {
                        setShareTitle(e.target.value);
                        setShareStatus('idle');
                      }}
                    />
                  </label>
                  <label>
                    <span>your name / handle</span>
                    <input
                      type="text"
                      maxLength={120}
                      value={shareAuthor}
                      onChange={(e) => {
                        setShareAuthor(e.target.value);
                        setShareStatus('idle');
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={!shareTitle.trim() || !shareAuthor.trim() || shareStatus === 'publishing'}
                    onClick={() => void publishCurrentProject()}
                  >
                    {shareStatus === 'publishing' ? 'Публикация…' : 'Опубликовать'}
                  </button>
                  {publishedPieceId ? (
                    <button type="button" className="button-secondary" onClick={() => void copyPublishedLink()}>
                      Скопировать ссылку
                    </button>
                  ) : null}
                  {shareError ? <span className="error-banner">{shareError}</span> : null}
                  {shareStatus === 'published' ? <span>Опубликовано</span> : null}
                </div>
              ) : null}

              {showGallery ? (
                <div className="music-gallery">
                  <div className="music-gallery__header">
                    <strong>Gallery</strong>
                    <button type="button" className="button-secondary" onClick={() => void refreshGallery()}>
                      Обновить
                    </button>
                  </div>
                  {galleryLoading ? <span>Загрузка…</span> : null}
                  {galleryError ? <span className="error-banner">{galleryError}</span> : null}
                  {!galleryLoading && galleryItems.length === 0 && !galleryError ? <span>Пока нет опубликованных работ.</span> : null}
                  <div className="music-gallery__items">
                    {galleryItems.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className="music-gallery__item"
                        onClick={() => void openSharedPiece(item.id)}
                      >
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt=""
                            aria-hidden="true"
                            className="music-gallery__thumbnail"
                          />
                        ) : (
                          <div className="music-gallery__thumbnail music-gallery__thumbnail--empty" aria-hidden="true">
                            ♪
                          </div>
                        )}
                        <span className="music-gallery__meta">
                          <strong>{item.title}</strong>
                          <span>{item.author}</span>
                          <small>{new Date(item.created_at).toLocaleString()}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <MusicCanvas
                settings={musicSettings}
                strokes={musicStrokes}
                activeColor={musicColor}
                background={musicCanvasBackground}
                playheadProgress={realtimeMusic.progress}
                showGrid={showMusicGrid}
                onCanvasReady={handleMusicCanvasReady}
                onChange={handleMusicStrokesChange}
              />

              <div className="music-event-summary">
                <span>Линий: <strong>{musicStrokes.length}</strong></span>
                <span>Событий: <strong>{canvasMusicEvents.length}</strong></span>
                <span>BPM: <strong>{musicSettings.bpm}</strong></span>
                <span>MIDI: <strong>{midiInput.status}</strong></span>
                {midiInput.devices.length > 0 ? <span>Устройства: <strong>{midiInput.devices.join(', ')}</strong></span> : null}
                <span>MIDI-событий: <strong>{midiRecordedEvents.length}</strong></span>
                <span>Автосохранение: <strong>{musicDraftStatus === 'saved' ? 'сохранено' : musicDraftStatus === 'error' ? 'ошибка' : '…'}</strong></span>
                <span>Take: <strong>{isTakeRecording ? 'recording' : takeUrl ? 'готов' : '—'}</strong></span>
                {takeError ? <span className="error-banner">{takeError}</span> : null}
              </div>

              {showVirtualKeyboard ? (
              <div className="music-octaves">
                {keyboardOctaves.map((octave) => (
                  <div key={octave} className="music-octave">
                    <div className="music-octave__title">Октава {octave}</div>
                    <div className="music-piano">
                      <div className="music-piano__white">
                        {whiteKeys.map((key) => {
                          const note = `${key}${octave}`;
                          return (
                            <button
                              key={note}
                              type="button"
                              className="music-key music-key--white"
                              onPointerDown={(e) => {
                                e.currentTarget.setPointerCapture(e.pointerId);
                                handleVirtualNoteOn(note);
                              }}
                              onPointerUp={(e) => {
                                handleVirtualNoteOff(note);
                                if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                              }}
                              onPointerCancel={() => handleVirtualNoteOff(note)}
                              onKeyDown={(e) => {
                                if (!e.repeat && (e.key === 'Enter' || e.key === ' ')) handleVirtualNoteOn(note);
                              }}
                              onKeyUp={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') handleVirtualNoteOff(note);
                              }}
                            >
                              {note}
                            </button>
                          );
                        })}
                      </div>
                      <div className="music-piano__black">
                        {[{ key: 'C#', col: 1 }, { key: 'D#', col: 2 }, { key: 'F#', col: 4 }, { key: 'G#', col: 5 }, { key: 'A#', col: 6 }].map((item) => {
                          const note = `${item.key}${octave}`;
                          return (
                            <button
                              key={note}
                              type="button"
                              className="music-key music-key--black"
                              style={{ gridColumn: item.col }}
                              onPointerDown={(e) => {
                                e.currentTarget.setPointerCapture(e.pointerId);
                                handleVirtualNoteOn(note);
                              }}
                              onPointerUp={(e) => {
                                handleVirtualNoteOff(note);
                                if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                              }}
                              onPointerCancel={() => handleVirtualNoteOff(note)}
                              onKeyDown={(e) => {
                                if (!e.repeat && (e.key === 'Enter' || e.key === ' ')) handleVirtualNoteOn(note);
                              }}
                              onKeyUp={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') handleVirtualNoteOff(note);
                              }}
                            >
                              {note}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="error-banner">{error}</p> : null}
        </section>
        <main className="workspace-grid">
          {activePanel === 'text' ? (
            <section className="panel panel--fill authoring-panel">
              <div className="draw-panel__header"><h3 className="authoring-title">Текст</h3></div>
              <textarea
                value={formData.text}
                onChange={(e) => updateField('text', e.target.value)}
                rows={10}
                spellCheck={false}
                className="ascii-input text-input--full"
                aria-label="Текст для спектра"
              />
            </section>
          ) : null}

          {activePanel === 'upload' ? (
            <section className="panel panel--fill">
              <div className="draw-panel__header"><h3 className="authoring-title">Изображение</h3></div>
              <div className="upload-panel">
                <input type="file" accept="image/*" onChange={(e) => { void uploadImage(e.target.files?.[0] ?? null); }} />
                <button type="button" className="button-secondary" onClick={() => updateField('image_base64', null)} disabled={!formData.image_base64}>Очистить изображение</button>
              </div>
            </section>
          ) : null}

          {activePanel === 'draw' ? (
            <section className="panel panel--fill">
              <div className="draw-panel">
                <div className="draw-panel__header">
                  <h3 className="authoring-title">Рисование</h3>
                  <span className="draw-panel__height-label">Высота: {drawCanvasHeight}px</span>
                </div>
                <div ref={drawCanvasWrapRef} className="draw-canvas-wrap">
                  <canvas ref={drawCanvasRef} width={960} height={drawCanvasHeight} className="draw-canvas" onPointerDown={(e) => { setInputSource('draw'); drawState.current.active = true; const ctx = e.currentTarget.getContext('2d'); if (ctx) ctx.beginPath(); drawAt(e); }} onPointerMove={drawAt} onPointerUp={() => { drawState.current.active = false; const canvas = drawCanvasRef.current; const ctx = canvas?.getContext('2d'); ctx?.beginPath(); syncCanvasToPayload(); }} onPointerLeave={() => { if (drawState.current.active) { drawState.current.active = false; syncCanvasToPayload(); } }} />
                </div>
              </div>
            </section>
          ) : null}

          {activePanel === 'info' ? (
            <>
              <section className="panel action-card panel--compact panel--fill">
                <h2>Результат</h2>
                <p className="action-card__text">Параметры генерации</p>
                <ul className="summary-list summary-list--compact">
                  {summary.map((item) => (
                    <li key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </li>
                  ))}
                  {preview ? (
                    <>
                      <li><span>Линий</span><strong>{preview.bitmapShape.freqBins}</strong></li>
                      <li><span>Шагов</span><strong>{preview.bitmapShape.timeBins}</strong></li>
                      <li><span>Длина</span><strong>{preview.totalDuration.toFixed(2)} c</strong></li>
                      <li><span>Поля</span><strong>{preview.autoEdgePad}</strong></li>
                    </>
                  ) : null}
                </ul>
              </section>

              <section className="panel panel--fill">
                <h2>Живой предпросмотр</h2>
                <PreviewCard preview={preview} formData={formData} isLoading={isLoadingPreview} className="result-preview" />
              </section>
            </>
          ) : null}
        </main>

{showSettings ? <div className="settings-overlay" onClick={() => setShowSettings(false)}>
            <div className="settings-overlay__panel" onClick={(e) => e.stopPropagation()}>
              <div className="settings-overlay__header">
                <h2>Параметры генерации</h2>
                <button type="button" className="button-secondary hero__icon-btn" onClick={() => setShowSettings(false)}>✕</button>
              </div>
              <SettingsSection className="panel--fill" title="Параметры генерации">
            <div className="fields-grid fields-grid--compact">
              <FormField label="Длительность, сек"><input type="number" value={formData.signal_duration} onChange={(e) => updateField('signal_duration', Number(e.target.value))} /></FormField>
              <FormField label="Тишина до, сек"><input type="number" value={formData.leading_silence} onChange={(e) => updateField('leading_silence', Number(e.target.value))} /></FormField>
              <FormField label="Тишина после, сек"><input type="number" value={formData.trailing_silence} onChange={(e) => updateField('trailing_silence', Number(e.target.value))} /></FormField>
              <FormField label="Нижняя частота, Гц"><input type="number" value={formData.fmin} onChange={(e) => updateField('fmin', Number(e.target.value))} /></FormField>
              <FormField label="Верхняя частота, Гц"><input type="number" value={formData.fmax} onChange={(e) => updateField('fmax', Number(e.target.value))} /></FormField>
              <FormField label="Частота дискретизации"><input type="number" value={formData.samplerate} onChange={(e) => updateField('samplerate', Number(e.target.value))} /></FormField>
              <FormField label="Ориентация">
                <select value={formData.orientation} onChange={(e) => updateField('orientation', e.target.value as GenerationFormData['orientation'])}>
                  <option value="time-x">Время по X</option>
                  <option value="freq-x">Частота по X</option>
                </select>
              </FormField>
              <FormField label="Поворот режима">
                <select value={formData.freq_x_rotation} onChange={(e) => updateField('freq_x_rotation', e.target.value as GenerationFormData['freq_x_rotation'])}>
                  <option value="ccw">Против часовой</option>
                  <option value="cw">По часовой</option>
                </select>
              </FormField>
              <FormField label="Бегущая строка">
                <label className="toggle toggle--compact">
                  <input type="checkbox" checked={formData.freq_x_marquee} onChange={(e) => updateFreqXMarquee(e.target.checked)} disabled={!showFreqXFlowModes} />
                  <span>{showFreqXFlowModes ? 'Включить' : 'Доступно только для Частоты по X'}</span>
                </label>
              </FormField>
              <FormField label="Слова с новой строки">
                <label className="toggle toggle--compact">
                  <input type="checkbox" checked={formData.freq_x_word_rows} onChange={(e) => updateFreqXWordRows(e.target.checked)} disabled={!showFreqXFlowModes} />
                  <span>{showFreqXFlowModes ? 'Включить' : 'Доступно только для Частоты по X'}</span>
                </label>
              </FormField>
              <FormField label="Внутренние поля"><input type="number" value={formData.edge_pad_cols} onChange={(e) => updateField('edge_pad_cols', Number(e.target.value))} /></FormField>
              <FormField label="Ширина bitmap"><input type="number" value={formData.img_width} onChange={(e) => updateField('img_width', Number(e.target.value))} /></FormField>
              <FormField label="Высота bitmap"><input type="number" value={formData.img_height} onChange={(e) => updateField('img_height', Number(e.target.value))} /></FormField>
              <FormField label="Размер шрифта"><input type="number" value={formData.font_size} onChange={(e) => updateField('font_size', Number(e.target.value))} /></FormField>
              <FormField label="Поля по X"><input type="number" value={formData.margin} onChange={(e) => updateField('margin', Number(e.target.value))} /></FormField>
              <FormField label="Поля по Y"><input type="number" value={formData.vertical_margin} onChange={(e) => updateField('vertical_margin', Number(e.target.value))} /></FormField>
              <FormField label="Сглаживание"><input type="number" value={formData.smooth_freq} onChange={(e) => updateField('smooth_freq', Number(e.target.value))} /></FormField>
              <FormField label="Sigma"><input type="number" value={formData.smooth_sigma} onChange={(e) => updateField('smooth_sigma', Number(e.target.value))} /></FormField>
              <FormField label="Контраст"><input type="number" step="0.1" value={formData.contrast} onChange={(e) => updateField('contrast', Number(e.target.value))} /></FormField>
              <FormField label="Инверсия">
                <label className="toggle toggle--compact">
                  <input type="checkbox" checked={formData.invert} onChange={(e) => updateField('invert', e.target.checked)} />
                  <span>Включить</span>
                </label>
              </FormField>
              <FormField label="Фиксированная фаза">
                <label className="toggle toggle--compact">
                  <input type="checkbox" checked={formData.fixed_phase} onChange={(e) => updateField('fixed_phase', e.target.checked)} />
                  <span>Включить</span>
                </label>
              </FormField>
            </div>

            <div className="section-subblock">
              <div className="section-subblock__header">
                <h3>Инструментальный режим</h3>
                <p>Выберите режим синтеза и настройте профиль гармоник для piano, guitar, synth или custom.</p>
              </div>
              <div className="fields-grid fields-grid--compact">
                <FormField label="Режим тембра" hint="Pure даёт максимально читаемый waterfall, Harmonic добавляет инструментальный тембр и ADSR-огибающую.">
                  <select value={formData.timbre_mode} onChange={(e) => updateField('timbre_mode', e.target.value as GenerationFormData['timbre_mode'])}>
                    <option value="pure">Pure</option>
                    <option value="harmonic">Harmonic</option>
                    <option value="sample_masked" disabled>Sample masked (позже)</option>
                  </select>
                </FormField>
                <FormField label="Инструмент" hint="Preset задаёт готовый характер гармоник: piano, guitar или synth. Custom использует ваши веса.">
                  <select value={formData.instrument_type} onChange={(e) => updateField('instrument_type', e.target.value as GenerationFormData['instrument_type'])} disabled={!showHarmonicControls}>
                    <option value="piano">Piano</option>
                    <option value="guitar">Guitar</option>
                    <option value="synth">Synth</option>
                    <option value="custom">Custom</option>
                  </select>
                </FormField>
                <FormField label="Число гармоник" hint="Для preset-профилей можно ограничить число используемых гармоник.">
                  <input type="number" min={1} value={formData.num_harmonics} onChange={(e) => updateField('num_harmonics', Number(e.target.value))} disabled={!showHarmonicControls} />
                </FormField>
                <FormField label="Закон затухания" hint="Определяет, как быстро ослабляются верхние гармоники. Для preset-профилей влияет только custom_list.">
                  <select value={formData.harmonic_decay_mode} onChange={(e) => updateField('harmonic_decay_mode', e.target.value as GenerationFormData['harmonic_decay_mode'])} disabled={!showHarmonicControls}>
                    <option value="1/n">1/n</option>
                    <option value="1/n^2">1/n²</option>
                    <option value="custom_list">Custom list</option>
                  </select>
                </FormField>
              </div>

              {showHarmonicControls ? (
                <>
                  <div className="preset-notes">
                    <span><strong>Piano:</strong> 1.0, 0.65, 0.36, 0.16, 0.08</span>
                    <span><strong>Guitar:</strong> 1.0, 0.85, 0.6, 0.34, 0.18, 0.1</span>
                    <span><strong>Synth:</strong> 1.0, 1.0, 0.9, 0.72, 0.55, 0.4, 0.28</span>
                  </div>
                  <div className="fields-grid fields-grid--single fields-grid--tight">
                    <FormField
                      label="Пользовательские веса гармоник"
                      hint="Используются для instrument_type=custom или harmonic_decay_mode=custom_list. Введите числа через запятую или пробел."
                    >
                      <textarea
                        value={harmonicWeightsText}
                        onChange={(e) => updateField('harmonic_weights', parseWeights(e.target.value))}
                        rows={2}
                        placeholder="Например: 1, 0.7, 0.5, 0.3"
                        disabled={!showCustomWeights}
                      />
                    </FormField>
                  </div>
                  <div className="fields-grid fields-grid--compact">
                    <FormField label="ADSR Attack" hint="Доля сегмента, за которую звук набирает громкость."><input type="number" min={0} step="0.01" value={formData.adsr_attack} onChange={(e) => updateField('adsr_attack', Number(e.target.value))} /></FormField>
                    <FormField label="ADSR Decay" hint="Переход от пика к уровню sustain после атаки."><input type="number" min={0} step="0.01" value={formData.adsr_decay} onChange={(e) => updateField('adsr_decay', Number(e.target.value))} /></FormField>
                    <FormField label="ADSR Sustain" hint="Уровень удержания после decay, от 0 до 1."><input type="number" min={0} max={1} step="0.05" value={formData.adsr_sustain} onChange={(e) => updateField('adsr_sustain', Number(e.target.value))} /></FormField>
                    <FormField label="ADSR Release" hint="Доля сегмента, в течение которой звук затухает к нулю."><input type="number" min={0} step="0.01" value={formData.adsr_release} onChange={(e) => updateField('adsr_release', Number(e.target.value))} /></FormField>
                  </div>
                </>
              ) : null}
            </div>
              </SettingsSection>
            </div>
          </div> : null}

      </div>
    </div>
  );
}
