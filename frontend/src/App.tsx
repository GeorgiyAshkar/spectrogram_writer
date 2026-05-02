import { useEffect, useMemo, useRef, useState } from 'react';
import defaults from '../../defaults.json';
import { FormField } from './components/FormField';
import { Header } from './components/Header';
import { LogoSidebar } from './components/LogoSidebar';
import { PreviewCard } from './components/PreviewCard';
import { SettingsSection } from './components/SettingsSection';
import { useSpectrogramGenerator } from './hooks/useSpectrogramGenerator';
import type { GenerationFormData } from './types/config';
import './styles/app.css';

const EMOJI_OPTIONS = ['❤️', '😊', '😢', '😡', '⭐', '☀️', '🌙', '☁️', '⚡', '🎵'];

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
  const [inputSource, setInputSource] = useState<'text' | 'upload' | 'draw'>('text');
  const [showSettings, setShowSettings] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawState = useRef<{ active: boolean }>({ active: false });

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

  const appendEmoji = (emoji: string) => {
    setFormData((current) => ({
      ...current,
      text: current.text.trim() ? `${current.text.trim()} ${emoji}` : emoji,
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
    ctx.strokeStyle = '#000000';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  useEffect(() => {
    clearCanvas();
  }, []);

  const effectiveFormData = useMemo(
    () => ({
      ...formData,
      image_base64: inputSource === 'text' ? null : formData.image_base64,
    }),
    [formData, inputSource],
  );

  const { preview, error, summary, logoUrl, isLoadingPreview, isDownloading, exportWav } =
    useSpectrogramGenerator(effectiveFormData);

  return (
    <div className="page-shell">
      <LogoSidebar logoUrl={logoUrl} />
      <div className="app-shell">
        <Header
          inputSource={inputSource}
          onSourceChange={setInputSource}
          onImageSelect={(file) => {
            void uploadImage(file);
          }}
          onClearImage={() => {
            updateField('image_base64', null);
            setInputSource('text');
          }}
          hasImage={Boolean(formData.image_base64)}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings((s) => !s)}
        />
        <main className="workspace-grid">
          <SettingsSection className="panel--fill" title="Текст и рисунок">
            <div className="text-draw-grid">
              <div className="text-draw-grid__text">
                <FormField label="Текст">
                  <textarea
                    value={formData.text}
                    onChange={(e) => updateField('text', e.target.value)}
                    rows={10}
                    spellCheck={false}
                    className="ascii-input"
                  />
                </FormField>
                <div className="emoji-toolbar" aria-label="Базовые эмоди">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button key={emoji} type="button" className="emoji-chip" onClick={() => appendEmoji(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="draw-panel">
                  <div className="draw-panel__header">
                    <strong>Рисование</strong>
                    <button type="button" className="button-secondary" onClick={() => { clearCanvas(); setInputSource('draw'); }}>Очистить холст</button>
                  </div>
                  <canvas
                    ref={drawCanvasRef}
                    width={960}
                    height={340}
                    className="draw-canvas"
                    onPointerDown={(e) => {
                      setInputSource('draw');
                      drawState.current.active = true;
                      const ctx = e.currentTarget.getContext('2d');
                      if (ctx) {
                        ctx.beginPath();
                      }
                      drawAt(e);
                    }}
                    onPointerMove={drawAt}
                    onPointerUp={() => {
                      drawState.current.active = false;
                      const canvas = drawCanvasRef.current;
                      const ctx = canvas?.getContext('2d');
                      ctx?.beginPath();
                      syncCanvasToPayload();
                    }}
                    onPointerLeave={() => {
                      if (drawState.current.active) {
                        drawState.current.active = false;
                        syncCanvasToPayload();
                      }
                    }}
                  />
              </div>
            </div>
          </SettingsSection>

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
            <div className="actions-row actions-row--push">
              <button className="button-secondary" onClick={() => void exportWav()} disabled={isDownloading}>
                {isDownloading ? 'Подготовка файла…' : 'Скачать WAV'}
              </button>
            </div>
            {error ? <p className="error-banner">{error}</p> : null}
            <PreviewCard preview={preview} formData={formData} isLoading={isLoadingPreview} className="result-preview" />
          </section>

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

        </main>
      </div>
    </div>
  );
}
