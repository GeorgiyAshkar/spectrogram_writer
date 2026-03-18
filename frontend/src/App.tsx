import { useState } from 'react';
import defaults from '../../defaults.json';
import { FormField } from './components/FormField';
import { Header } from './components/Header';
import { LogoSidebar } from './components/LogoSidebar';
import { PreviewCard } from './components/PreviewCard';
import { SettingsSection } from './components/SettingsSection';
import { useSpectrogramGenerator } from './hooks/useSpectrogramGenerator';
import type { GenerationFormData } from './types/config';
import './styles/app.css';

const initialState: GenerationFormData = defaults as GenerationFormData;

export default function App() {
  const [formData, setFormData] = useState<GenerationFormData>(initialState);
  const { preview, error, summary, logoUrl, isLoadingPreview, isDownloading, exportWav } =
    useSpectrogramGenerator(formData);

  const updateField = <K extends keyof GenerationFormData>(key: K, value: GenerationFormData[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="page-shell">
      {logoUrl ? <LogoSidebar logoUrl={logoUrl} /> : null}
      <div className="app-shell">
        <Header />
        <main className="workspace-grid">
          <SettingsSection
            className="panel--fill"
            title="Текст и тайминг"
            description="Основные параметры сообщения и длительности сигнала."
          >
            <div className="fields-grid fields-grid--wide fields-grid--tight">
              <FormField label="Текст" hint="Надпись для отображения на спектрограмме.">
                <textarea value={formData.text} onChange={(e) => updateField('text', e.target.value)} rows={2} />
              </FormField>
              <FormField label="Длительность, сек" hint="Полезная часть с надписью.">
                <input type="number" value={formData.signal_duration} onChange={(e) => updateField('signal_duration', Number(e.target.value))} />
              </FormField>
              <FormField label="Тишина до, сек" hint="Пауза перед сигналом.">
                <input type="number" value={formData.leading_silence} onChange={(e) => updateField('leading_silence', Number(e.target.value))} />
              </FormField>
              <FormField label="Тишина после, сек" hint="Пауза после сигнала.">
                <input type="number" value={formData.trailing_silence} onChange={(e) => updateField('trailing_silence', Number(e.target.value))} />
              </FormField>
            </div>
          </SettingsSection>

          <section className="panel action-card panel--compact panel--fill">
            <h2>Результат</h2>
            <p className="action-card__text">Ключевые параметры генерации и экспорт готового WAV-файла.</p>
            <ul className="summary-list summary-list--compact">
              {summary.map((item) => (
                <li key={item.label}><span>{item.label}</span><strong>{item.value}</strong></li>
              ))}
            </ul>
            <div className="actions-row actions-row--push">
              <button className="button-secondary" onClick={() => void exportWav()} disabled={isDownloading}>
                {isDownloading ? 'Подготовка файла…' : 'Скачать WAV'}
              </button>
            </div>
            {error ? <p className="error-banner">{error}</p> : null}
          </section>

          <SettingsSection
            className="panel--fill"
            title="Параметры генерации"
            description="Дополнительные настройки собраны в компактную и ровную сетку."
          >
            <div className="fields-grid fields-grid--compact">
              <FormField label="Нижняя частота, Гц" hint="Минимальная частота."><input type="number" value={formData.fmin} onChange={(e) => updateField('fmin', Number(e.target.value))} /></FormField>
              <FormField label="Верхняя частота, Гц" hint="Максимальная частота."><input type="number" value={formData.fmax} onChange={(e) => updateField('fmax', Number(e.target.value))} /></FormField>
              <FormField label="Частота дискретизации" hint="> 2 × верхняя частота."><input type="number" value={formData.samplerate} onChange={(e) => updateField('samplerate', Number(e.target.value))} /></FormField>
              <FormField label="Ориентация" hint="Что будет по оси X.">
                <select value={formData.orientation} onChange={(e) => updateField('orientation', e.target.value as GenerationFormData['orientation'])}>
                  <option value="time-x">Время по X</option>
                  <option value="freq-x">Частота по X</option>
                </select>
              </FormField>
              <FormField label="Поворот режима" hint="Для «Частота по X».">
                <select value={formData.freq_x_rotation} onChange={(e) => updateField('freq_x_rotation', e.target.value as GenerationFormData['freq_x_rotation'])}>
                  <option value="ccw">Против часовой</option>
                  <option value="cw">По часовой</option>
                </select>
              </FormField>
              <FormField label="Внутренние поля" hint="-1 = авто."><input type="number" value={formData.edge_pad_cols} onChange={(e) => updateField('edge_pad_cols', Number(e.target.value))} /></FormField>
              <FormField label="Ширина bitmap" hint="Горизонтальная детализация."><input type="number" value={formData.img_width} onChange={(e) => updateField('img_width', Number(e.target.value))} /></FormField>
              <FormField label="Высота bitmap" hint="Частотные линии."><input type="number" value={formData.img_height} onChange={(e) => updateField('img_height', Number(e.target.value))} /></FormField>
              <FormField label="Размер шрифта" hint="Стартовый размер рендера."><input type="number" value={formData.font_size} onChange={(e) => updateField('font_size', Number(e.target.value))} /></FormField>
              <FormField label="Поля по X" hint="Отступы слева и справа."><input type="number" value={formData.margin} onChange={(e) => updateField('margin', Number(e.target.value))} /></FormField>
              <FormField label="Поля по Y" hint="Отступы сверху и снизу."><input type="number" value={formData.vertical_margin} onChange={(e) => updateField('vertical_margin', Number(e.target.value))} /></FormField>
              <FormField label="Сглаживание" hint="Размер ядра по частоте."><input type="number" value={formData.smooth_freq} onChange={(e) => updateField('smooth_freq', Number(e.target.value))} /></FormField>
              <FormField label="Sigma" hint="Мягкость сглаживания."><input type="number" value={formData.smooth_sigma} onChange={(e) => updateField('smooth_sigma', Number(e.target.value))} /></FormField>
              <FormField label="Контраст" hint="Яркость текста."><input type="number" step="0.1" value={formData.contrast} onChange={(e) => updateField('contrast', Number(e.target.value))} /></FormField>
              <FormField label="Инверсия" hint="Инвертирует bitmap.">
                <label className="toggle toggle--compact">
                  <input type="checkbox" checked={formData.invert} onChange={(e) => updateField('invert', e.target.checked)} />
                  <span>Включить</span>
                </label>
              </FormField>
              <FormField label="Фиксированная фаза" hint="Повторяемый результат.">
                <label className="toggle toggle--compact">
                  <input type="checkbox" checked={formData.fixed_phase} onChange={(e) => updateField('fixed_phase', e.target.checked)} />
                  <span>Включить</span>
                </label>
              </FormField>
            </div>
          </SettingsSection>

          <PreviewCard preview={preview} isLoading={isLoadingPreview} className="panel--fill" />
        </main>
      </div>
    </div>
  );
}
