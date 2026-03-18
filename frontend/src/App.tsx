import { useState } from 'react';
import { FormField } from './components/FormField';
import { Header } from './components/Header';
import { PreviewCard } from './components/PreviewCard';
import { SettingsSection } from './components/SettingsSection';
import { useSpectrogramGenerator } from './hooks/useSpectrogramGenerator';
import type { GenerationFormData } from './types/config';
import './styles/app.css';

const initialState: GenerationFormData = {
  text: 'ПОЗЫВНОЙ DE SPECTROGRAM',
  fmin: 2000,
  fmax: 12000,
  signal_duration: 10,
  leading_silence: 0.5,
  trailing_silence: 0.5,
  samplerate: 48000,
  orientation: 'time-x',
  freq_x_rotation: 'ccw',
  edge_pad_cols: -1,
  img_width: 1000,
  img_height: 160,
  font_size: 180,
  margin: 12,
  vertical_margin: 8,
  smooth_freq: 5,
  smooth_sigma: 1,
  contrast: 1,
  invert: false,
  fixed_phase: false,
};

export default function App() {
  const [formData, setFormData] = useState<GenerationFormData>(initialState);
  const { preview, error, summary, logoUrl, isLoadingPreview, isDownloading, exportWav } =
    useSpectrogramGenerator(formData);

  const updateField = <K extends keyof GenerationFormData>(key: K, value: GenerationFormData[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="app-shell">
      <Header logoUrl={logoUrl} />
      <main className="layout-grid">
        <div className="layout-grid__main">
          <SettingsSection title="Текст и длительность" description="Введите сообщение и задайте базовые параметры итогового сигнала.">
            <div className="fields-grid fields-grid--wide">
              <FormField label="Текст" hint="Именно эта строка будет нарисована в спектрограмме.">
                <textarea value={formData.text} onChange={(e) => updateField('text', e.target.value)} rows={3} />
              </FormField>
              <FormField label="Длительность сигнала, сек" hint="Время только для полезной части с надписью.">
                <input type="number" value={formData.signal_duration} onChange={(e) => updateField('signal_duration', Number(e.target.value))} />
              </FormField>
              <FormField label="Тишина до, сек" hint="Пауза перед началом надписи.">
                <input type="number" value={formData.leading_silence} onChange={(e) => updateField('leading_silence', Number(e.target.value))} />
              </FormField>
              <FormField label="Тишина после, сек" hint="Пауза после окончания надписи.">
                <input type="number" value={formData.trailing_silence} onChange={(e) => updateField('trailing_silence', Number(e.target.value))} />
              </FormField>
            </div>
          </SettingsSection>

          <SettingsSection title="Частоты и ориентация" description="Настройте, в каком диапазоне и как именно будет отображаться надпись.">
            <div className="fields-grid">
              <FormField label="Нижняя частота, Гц" hint="Минимальная частота отображения текста."><input type="number" value={formData.fmin} onChange={(e) => updateField('fmin', Number(e.target.value))} /></FormField>
              <FormField label="Верхняя частота, Гц" hint="Максимальная частота отображения текста."><input type="number" value={formData.fmax} onChange={(e) => updateField('fmax', Number(e.target.value))} /></FormField>
              <FormField label="Частота дискретизации, Гц" hint="Должна быть выше удвоенной верхней частоты."><input type="number" value={formData.samplerate} onChange={(e) => updateField('samplerate', Number(e.target.value))} /></FormField>
              <FormField label="Ориентация" hint="Выберите, что будет по оси X: время или частота.">
                <select value={formData.orientation} onChange={(e) => updateField('orientation', e.target.value as GenerationFormData['orientation'])}>
                  <option value="time-x">Время по X</option>
                  <option value="freq-x">Частота по X</option>
                </select>
              </FormField>
              <FormField label="Поворот для режима «Частота по X»" hint="Используется только в режиме частоты по горизонтали.">
                <select value={formData.freq_x_rotation} onChange={(e) => updateField('freq_x_rotation', e.target.value as GenerationFormData['freq_x_rotation'])}>
                  <option value="ccw">Против часовой стрелки</option>
                  <option value="cw">По часовой стрелке</option>
                </select>
              </FormField>
              <FormField label="Внутренние поля" hint="-1 — подобрать автоматически, иначе укажите число колонок."><input type="number" value={formData.edge_pad_cols} onChange={(e) => updateField('edge_pad_cols', Number(e.target.value))} /></FormField>
            </div>
          </SettingsSection>

          <SettingsSection title="Настройка изображения" description="Тонкая подстройка рендера текста и сглаживания перед синтезом аудио.">
            <div className="fields-grid">
              <FormField label="Ширина bitmap, px" hint="Влияет на горизонтальную детализацию."><input type="number" value={formData.img_width} onChange={(e) => updateField('img_width', Number(e.target.value))} /></FormField>
              <FormField label="Высота bitmap, px" hint="Влияет на количество частотных линий."><input type="number" value={formData.img_height} onChange={(e) => updateField('img_height', Number(e.target.value))} /></FormField>
              <FormField label="Размер шрифта" hint="Начальный размер для подбора вписывания текста."><input type="number" value={formData.font_size} onChange={(e) => updateField('font_size', Number(e.target.value))} /></FormField>
              <FormField label="Горизонтальные поля" hint="Отступ текста от краёв слева и справа."><input type="number" value={formData.margin} onChange={(e) => updateField('margin', Number(e.target.value))} /></FormField>
              <FormField label="Вертикальные поля" hint="Отступ текста от верхней и нижней границы."><input type="number" value={formData.vertical_margin} onChange={(e) => updateField('vertical_margin', Number(e.target.value))} /></FormField>
              <FormField label="Сглаживание по частоте" hint="Размер ядра сглаживания по вертикали."><input type="number" value={formData.smooth_freq} onChange={(e) => updateField('smooth_freq', Number(e.target.value))} /></FormField>
              <FormField label="Sigma сглаживания" hint="Чем выше значение, тем мягче переходы."><input type="number" value={formData.smooth_sigma} onChange={(e) => updateField('smooth_sigma', Number(e.target.value))} /></FormField>
              <FormField label="Контраст" hint="Значение больше 1 усиливает яркость текста."><input type="number" step="0.1" value={formData.contrast} onChange={(e) => updateField('contrast', Number(e.target.value))} /></FormField>
              <FormField label="Инвертировать bitmap" hint="Полезно для нестандартного визуального результата.">
                <label className="toggle">
                  <input type="checkbox" checked={formData.invert} onChange={(e) => updateField('invert', e.target.checked)} />
                  <span>Включить инверсию</span>
                </label>
              </FormField>
              <FormField label="Фиксированная фаза" hint="Даёт более повторяемый результат без случайных фаз.">
                <label className="toggle">
                  <input type="checkbox" checked={formData.fixed_phase} onChange={(e) => updateField('fixed_phase', e.target.checked)} />
                  <span>Использовать фиксированные фазы</span>
                </label>
              </FormField>
            </div>
          </SettingsSection>
        </div>

        <aside className="layout-grid__sidebar">
          <section className="panel action-card">
            <h2>Результат</h2>
            <p className="action-card__text">Предпросмотр обновляется автоматически. Когда результат вас устроит, скачайте готовый WAV-файл.</p>
            <ul className="summary-list">
              {summary.map((item) => (
                <li key={item.label}><span>{item.label}</span><strong>{item.value}</strong></li>
              ))}
            </ul>
            <div className="actions-row">
              <button className="button-secondary" onClick={() => void exportWav()} disabled={isDownloading}>{isDownloading ? 'Подготовка файла…' : 'Скачать WAV'}</button>
            </div>
            {error ? <p className="error-banner">{error}</p> : null}
          </section>
          <PreviewCard preview={preview} isLoading={isLoadingPreview} />
        </aside>
      </main>
    </div>
  );
}
