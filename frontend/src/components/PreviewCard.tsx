import type { PreviewResponse } from '../types/config';

interface PreviewCardProps {
  preview: PreviewResponse | null;
  isLoading: boolean;
}

export function PreviewCard({ preview, isLoading }: PreviewCardProps) {
  return (
    <section className="panel preview-card">
      <div className="section__header">
        <h2>Live preview</h2>
        <p>Сначала проверьте визуальный отпечаток текста в спектрограмме, затем экспортируйте WAV.</p>
      </div>
      <div className="preview-card__body">
        {isLoading ? <div className="empty-state">Generating preview…</div> : null}
        {!isLoading && preview ? (
          <>
            <img className="preview-card__image" src={preview.previewImage} alt="Spectrogram preview" />
            <dl className="stats-grid">
              <div><dt>Freq bins</dt><dd>{preview.bitmapShape.freqBins}</dd></div>
              <div><dt>Time bins</dt><dd>{preview.bitmapShape.timeBins}</dd></div>
              <div><dt>Total duration</dt><dd>{preview.totalDuration.toFixed(2)}s</dd></div>
              <div><dt>Auto edge pad</dt><dd>{preview.autoEdgePad}</dd></div>
            </dl>
          </>
        ) : null}
        {!isLoading && !preview ? <div className="empty-state">Нажмите Generate preview, чтобы увидеть результат.</div> : null}
      </div>
    </section>
  );
}
