interface HeaderProps {
  inputSource: 'text' | 'upload' | 'draw';
  onSourceChange: (next: 'text' | 'upload' | 'draw') => void;
  onImageSelect: (file: File | null) => void;
  onClearImage: () => void;
  hasImage: boolean;
  showSettings: boolean;
  onToggleSettings: () => void;
}

export function Header({
  inputSource,
  onSourceChange,
  onImageSelect,
  onClearImage,
  showSettings,
  onToggleSettings,
  hasImage,
}: HeaderProps) {
  return (
    <header className="hero panel">
      <div className="hero__content hero__content--row">
        <div className="hero__brand-copy">
          <h1>Спектральный след</h1>
        </div>
        <div className="hero__controls">
          <div className="source-mode-options">
            <label><input type="radio" name="source-mode" checked={inputSource === 'text'} onChange={() => onSourceChange('text')} /> Текст</label>
            <label><input type="radio" name="source-mode" checked={inputSource === 'upload'} onChange={() => onSourceChange('upload')} /> Изображение</label>
            <label><input type="radio" name="source-mode" checked={inputSource === 'draw'} onChange={() => onSourceChange('draw')} /> Рисунок</label>
          </div>
          <div className="hero__file-row">
            <input type="file" accept="image/*" onChange={(e) => onImageSelect(e.target.files?.[0] ?? null)} />
            <button type="button" className="button-secondary hero__icon-btn" onClick={onClearImage} disabled={!hasImage}>✕</button>
            <button type="button" className="button-secondary hero__icon-btn" onClick={onToggleSettings} aria-label="Параметры">⚙</button>
          </div>
          {showSettings ? <div className="hero__dropdown-note">Параметры открыты ниже</div> : null}
        </div>
      </div>
    </header>
  );
}
