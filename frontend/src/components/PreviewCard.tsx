import type { PreviewResponse } from '../types/config';

interface PreviewCardProps {
  preview: PreviewResponse | null;
  isLoading: boolean;
  className?: string;
}

export function PreviewCard({ preview, isLoading, className = '' }: PreviewCardProps) {
  return (
    <section className={`panel preview-card panel--compact panel--fill ${className}`.trim()}>
      <div className="section__header section__header--compact">
        <h2>Живой предпросмотр</h2>
      </div>
      <div className="preview-card__body preview-card__body--fill">
        {isLoading ? <div className="empty-state preview-frame">Предпросмотр обновляется…</div> : null}
        {!isLoading && preview ? (
          <>
            <div className="preview-frame">
              <img className="preview-card__image" src={preview.previewImage} alt="Предпросмотр спектрограммы" />
            </div>
            <dl className="stats-grid stats-grid--compact">
              <div><dt>Линий</dt><dd>{preview.bitmapShape.freqBins}</dd></div>
              <div><dt>Шагов</dt><dd>{preview.bitmapShape.timeBins}</dd></div>
              <div><dt>Длина</dt><dd>{preview.totalDuration.toFixed(2)} c</dd></div>
              <div><dt>Поля</dt><dd>{preview.autoEdgePad}</dd></div>
            </dl>
          </>
        ) : null}
        {!isLoading && !preview ? <div className="empty-state preview-frame">Введите параметры — предпросмотр появится автоматически.</div> : null}
      </div>
    </section>
  );
}
