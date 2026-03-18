import type { PreviewResponse } from '../types/config';

interface PreviewCardProps {
  preview: PreviewResponse | null;
  isLoading: boolean;
}

export function PreviewCard({ preview, isLoading }: PreviewCardProps) {
  return (
    <section className="panel preview-card panel--compact">
      <div className="section__header section__header--compact">
        <h2>Живой предпросмотр</h2>
        <p>Изображение имеет фиксированную область отображения и не растягивает страницу.</p>
      </div>
      <div className="preview-card__body">
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
