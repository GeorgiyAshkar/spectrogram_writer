import { useState } from 'react';
import { FormField } from './components/FormField';
import { Header } from './components/Header';
import { PreviewCard } from './components/PreviewCard';
import { SettingsSection } from './components/SettingsSection';
import { useSpectrogramGenerator } from './hooks/useSpectrogramGenerator';
import type { GenerationFormData } from './types/config';
import './styles/app.css';

const initialState: GenerationFormData = {
  text: 'CQ CQ DE SPECTROGRAM',
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
  const { preview, error, summary, isLoadingPreview, isDownloading, generatePreview, exportWav } =
    useSpectrogramGenerator(formData);

  const updateField = <K extends keyof GenerationFormData>(key: K, value: GenerationFormData[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="app-shell">
      <Header />
      <main className="layout-grid">
        <div className="layout-grid__main">
          <SettingsSection title="Message" description="Введите текст и базовые параметры генерации сигнала.">
            <div className="fields-grid fields-grid--wide">
              <FormField label="Text">
                <textarea value={formData.text} onChange={(e) => updateField('text', e.target.value)} rows={3} />
              </FormField>
              <FormField label="Signal duration, s">
                <input type="number" value={formData.signal_duration} onChange={(e) => updateField('signal_duration', Number(e.target.value))} />
              </FormField>
              <FormField label="Leading silence, s">
                <input type="number" value={formData.leading_silence} onChange={(e) => updateField('leading_silence', Number(e.target.value))} />
              </FormField>
              <FormField label="Trailing silence, s">
                <input type="number" value={formData.trailing_silence} onChange={(e) => updateField('trailing_silence', Number(e.target.value))} />
              </FormField>
            </div>
          </SettingsSection>

          <SettingsSection title="Spectral layout" description="Настройка частотного диапазона и ориентации watermark на waterfall.">
            <div className="fields-grid">
              <FormField label="Fmin, Hz"><input type="number" value={formData.fmin} onChange={(e) => updateField('fmin', Number(e.target.value))} /></FormField>
              <FormField label="Fmax, Hz"><input type="number" value={formData.fmax} onChange={(e) => updateField('fmax', Number(e.target.value))} /></FormField>
              <FormField label="Sample rate"><input type="number" value={formData.samplerate} onChange={(e) => updateField('samplerate', Number(e.target.value))} /></FormField>
              <FormField label="Orientation">
                <select value={formData.orientation} onChange={(e) => updateField('orientation', e.target.value as GenerationFormData['orientation'])}>
                  <option value="time-x">time-x</option>
                  <option value="freq-x">freq-x</option>
                </select>
              </FormField>
              <FormField label="freq-x rotation">
                <select value={formData.freq_x_rotation} onChange={(e) => updateField('freq_x_rotation', e.target.value as GenerationFormData['freq_x_rotation'])}>
                  <option value="ccw">ccw</option>
                  <option value="cw">cw</option>
                </select>
              </FormField>
              <FormField label="Edge pad cols"><input type="number" value={formData.edge_pad_cols} onChange={(e) => updateField('edge_pad_cols', Number(e.target.value))} /></FormField>
            </div>
          </SettingsSection>

          <SettingsSection title="Bitmap tuning" description="Тонкая настройка рендера текста и спектрального сглаживания.">
            <div className="fields-grid">
              <FormField label="Image width"><input type="number" value={formData.img_width} onChange={(e) => updateField('img_width', Number(e.target.value))} /></FormField>
              <FormField label="Image height"><input type="number" value={formData.img_height} onChange={(e) => updateField('img_height', Number(e.target.value))} /></FormField>
              <FormField label="Font size"><input type="number" value={formData.font_size} onChange={(e) => updateField('font_size', Number(e.target.value))} /></FormField>
              <FormField label="Margin"><input type="number" value={formData.margin} onChange={(e) => updateField('margin', Number(e.target.value))} /></FormField>
              <FormField label="Vertical margin"><input type="number" value={formData.vertical_margin} onChange={(e) => updateField('vertical_margin', Number(e.target.value))} /></FormField>
              <FormField label="Smooth freq"><input type="number" value={formData.smooth_freq} onChange={(e) => updateField('smooth_freq', Number(e.target.value))} /></FormField>
              <FormField label="Smooth sigma"><input type="number" value={formData.smooth_sigma} onChange={(e) => updateField('smooth_sigma', Number(e.target.value))} /></FormField>
              <FormField label="Contrast"><input type="number" step="0.1" value={formData.contrast} onChange={(e) => updateField('contrast', Number(e.target.value))} /></FormField>
              <FormField label="Invert"><input type="checkbox" checked={formData.invert} onChange={(e) => updateField('invert', e.target.checked)} /></FormField>
              <FormField label="Fixed phase"><input type="checkbox" checked={formData.fixed_phase} onChange={(e) => updateField('fixed_phase', e.target.checked)} /></FormField>
            </div>
          </SettingsSection>
        </div>

        <aside className="layout-grid__sidebar">
          <section className="panel action-card">
            <h2>Output</h2>
            <ul className="summary-list">
              {summary.map((item) => (
                <li key={item.label}><span>{item.label}</span><strong>{item.value}</strong></li>
              ))}
            </ul>
            <div className="actions-row">
              <button onClick={() => void generatePreview()} disabled={isLoadingPreview}>{isLoadingPreview ? 'Generating…' : 'Generate preview'}</button>
              <button className="button-secondary" onClick={() => void exportWav()} disabled={isDownloading}>{isDownloading ? 'Exporting…' : 'Download WAV'}</button>
            </div>
            {error ? <p className="error-banner">{error}</p> : null}
          </section>
          <PreviewCard preview={preview} isLoading={isLoadingPreview} />
        </aside>
      </main>
    </div>
  );
}
