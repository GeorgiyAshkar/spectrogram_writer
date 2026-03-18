import type { PreviewResponse } from '../types/config';

interface PreviewCardProps {
  preview: PreviewResponse | null;
  isLoading: boolean;
}

export function PreviewCard({ preview, isLoading }: PreviewCardProps) {
  return (
    <section className="panel preview-card">
      <div className="section__header">
        <h2>Живой предпросмотр</h2>
        <p>Проверьте, как надпись будет выглядеть на спектрограмме, прежде чем скачивать итоговый WAV.</p>
      </div>
      <div className="preview-card__body">
        {isLoading ? <div className="empty-state">Предпросмотр обновляется…</div> : null}
        {!isLoading && preview ? (
          <>
            <img className="preview-card__image" src={preview.previewImage} alt="Предпросмотр спектрограммы" />
            <dl className="stats-grid">
              <div><dt>Частотных линий</dt><dd>{preview.bitmapShape.freqBins}</dd></div>
              <div><dt>Временных шагов</dt><dd>{preview.bitmapShape.timeBins}</dd></div>
              <div><dt>Полная длина</dt><dd>{preview.totalDuration.toFixed(2)} c</dd></div>
              <div><dt>Автополя</dt><dd>{preview.autoEdgePad}</dd></div>
            </dl>
          </>
        ) : null}
        {!isLoading && !preview ? <div className="empty-state">Введите параметры — предпросмотр появится автоматически.</div> : null}
      </div>
    </section>
  );
}
