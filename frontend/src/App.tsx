import { useEffect, useMemo, useRef, useState } from 'react';
import defaults from '../../defaults.json';
import customNoteFrequencies from '../../note_frequencies.json';
import { FormField } from './components/FormField';
import { Header } from './components/Header';
import { AudioPlayer } from './components/AudioPlayer';
import { PreviewCard } from './components/PreviewCard';
import { SettingsSection } from './components/SettingsSection';
import { useSpectrogramGenerator } from './hooks/useSpectrogramGenerator';
import type { GenerationFormData } from './types/config';
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
  const [musicSequence, setMusicSequence] = useState<string[]>([]);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicAudioUrl, setMusicAudioUrl] = useState<string | null>(null);
  const MUSIC_REST_TOKEN = 'REST';

  const handlePanelChange = (next: 'text' | 'upload' | 'draw' | 'music' | 'info') => {
    setActivePanel(next);
    if (next === 'text' || next === 'upload' || next === 'draw') {
      setInputSource(next);
    }
  };
  const octaves = [1, 2, 3, 4, 5];
  const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  const noteFreq = customNoteFrequencies as Record<string, number>;




  const noteOrder = Array.from({ length: 5 }, (_, octaveOffset) => octaveOffset + 1)
    .flatMap((octave) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((note) => `${note}${octave}`));
  const noteYOffset = noteOrder.reduce<Record<string, number>>((acc, note, idx) => {
    acc[note] = 8 + idx * 1.35;
    return acc;
  }, {});

  const buildMusicWav = async () => {
    if (!musicSequence.length) return null;
    const sampleRate = 44100;
    const noteDuration = 0.42;
    const tail = 0.06;
    const totalDuration = musicSequence.length * noteDuration + tail;
    const totalSamples = Math.floor(totalDuration * sampleRate);
    const pcm = new Float32Array(totalSamples);

    musicSequence.forEach((note, noteIndex) => {
      if (note === MUSIC_REST_TOKEN) return;
      const freq = noteFreq[note];
      if (!freq) return;
      const startSample = Math.floor(noteIndex * noteDuration * sampleRate);
      const endSample = Math.min(totalSamples, startSample + Math.floor(noteDuration * sampleRate));
      for (let i = startSample; i < endSample; i += 1) {
        const t = (i - startSample) / sampleRate;
        const phase = 2 * Math.PI * freq * t;
        const envIn = Math.min(1, t / 0.03);
        const envOut = Math.max(0, (noteDuration - t) / 0.08);
        const env = Math.min(envIn, envOut);
        const loudnessComp = 0.42 * Math.pow(220 / freq, 0.45);
        pcm[i] += Math.sin(phase) * env * loudnessComp;
      }
    });

    const bytes = new ArrayBuffer(44 + totalSamples * 2);
    const view = new DataView(bytes);
    const writeStr = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + totalSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, totalSamples * 2, true);

    let offset = 44;
    for (let i = 0; i < totalSamples; i += 1) {
      const sample = Math.max(-1, Math.min(1, pcm[i]));
      view.setInt16(offset, sample * 32767, true);
      offset += 2;
    }

    return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  };

  const addMusicNote = (note: string) => setMusicSequence((current) => [...current, note]);
  const addMusicPause = () => setMusicSequence((current) => [...current, MUSIC_REST_TOKEN]);
  const removeLastMusicNote = () => setMusicSequence((current) => current.slice(0, -1));

  const playMusicSequence = async () => {
    if (!musicSequence.length || isMusicPlaying) return;
    setIsMusicPlaying(true);
    try {
      if (musicAudioUrl) URL.revokeObjectURL(musicAudioUrl);
      const nextUrl = await buildMusicWav();
      setMusicAudioUrl(nextUrl);
    } finally {
      setIsMusicPlaying(false);
    }
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
  const gridSteps = 8;
  const formatGridValue = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : Math.round(value).toString());
  const frequencyTicks = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const ratio = i / gridSteps;
    const freq = formData.fmax - ratio * (formData.fmax - formData.fmin);
    return { ratio, label: `${formatGridValue(freq)} Hz` };
  });
  const timeTicks = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const ratio = i / gridSteps;
    return { ratio, label: `${(formData.signal_duration * ratio).toFixed(1)} s` };
  });

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
            audioUrl={activePanel === 'music' ? musicAudioUrl : audioUrl}
            isPreparingAudio={isDownloading || isMusicPlaying}
            onRequestAudio={playAudio}
            onToggleEraser={toggleEraser}
            eraserEnabled={eraserEnabled}
            onDownloadSnapshot={downloadCanvasSnapshot}
            onClearCanvas={() => { clearCanvas(); setInputSource('draw'); }}
            musicModeEnabled={activePanel === 'music'}
            musicSequence={musicSequence}
            onRemoveLastMusicNote={removeLastMusicNote}
            onPlayMusicSequence={playMusicSequence}
          />
          {activePanel === 'music' ? (
            <div className="music-panel">
              <div className="music-staff" aria-label="Нотный стан">
                {[...Array(5)].map((_, index) => <span key={index} className="music-staff__line" />)}
                <div className="music-staff__notes">
                  {musicSequence.map((note, idx) => <span key={`${note}-${idx}`} className={`music-staff__note ${note === MUSIC_REST_TOKEN ? 'music-staff__note--rest' : ''}`} style={{ bottom: `${noteYOffset[note] ?? 12}px`, left: `${4 + idx * 3.2}%` }}>{note === MUSIC_REST_TOKEN ? '⏸' : note}</span>)}
                </div>
              </div>
              <div className="music-octaves">
                {octaves.map((octave) => (
                  <div key={octave} className="music-octave">
                    <div className="music-octave__title">Октава {octave}</div>
                    <div className="music-piano">
                      <div className="music-piano__white">
                        {whiteKeys.map((key) => {
                          const note = `${key}${octave}`;
                          return <button key={note} type="button" className="music-key music-key--white" onClick={() => addMusicNote(note)}>{note}</button>;
                        })}
                      </div>
                      <div className="music-piano__black">
                        {[{ key: 'C#', col: 1 }, { key: 'D#', col: 2 }, { key: 'F#', col: 4 }, { key: 'G#', col: 5 }, { key: 'A#', col: 6 }].map((item) => {
                          const note = `${item.key}${octave}`;
                          return <button key={note} type="button" className="music-key music-key--black" style={{ gridColumn: item.col }} onClick={() => addMusicNote(note)}>{note}</button>;
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" className="button-secondary music-rest-btn" onClick={addMusicPause}>Добавить паузу</button>
              </div>
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
                  <div className="draw-grid" aria-hidden>
                    {(formData.orientation === 'time-x' ? frequencyTicks : timeTicks).map((tick) => (
                      <div key={`h-${tick.ratio}`} className="draw-grid__line draw-grid__line--horizontal" style={{ top: `${tick.ratio * 100}%` }}>
                        <span className="draw-grid__label draw-grid__label--left">{tick.label}</span>
                      </div>
                    ))}
                    {(formData.orientation === 'time-x' ? timeTicks : frequencyTicks).map((tick) => (
                      <div key={`v-${tick.ratio}`} className="draw-grid__line draw-grid__line--vertical" style={{ left: `${tick.ratio * 100}%` }}>
                        <span className="draw-grid__label draw-grid__label--bottom">{tick.label}</span>
                      </div>
                    ))}
                  </div>
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
