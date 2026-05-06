interface HeaderProps {
  logoUrl?: string | null;
  activePanel: 'text' | 'upload' | 'draw' | 'result' | 'preview';
  onPanelChange: (next: 'text' | 'upload' | 'draw' | 'result' | 'preview') => void;
  showSettings: boolean;
  onToggleSettings: () => void;
}

export function Header({ logoUrl, activePanel, onPanelChange, showSettings, onToggleSettings }: HeaderProps) {
  return (
    <header className="hero panel">
      <div className="hero__content hero__content--row">
        <div className="hero__brand-copy hero__brand-copy--row">
          {logoUrl ? <img src={logoUrl} alt="Логотип компании" className="hero__logo" /> : null}
          <h1>Спектральный след</h1>
        </div>
        <div className="hero__controls">
          <div className="source-mode-options">
            <button type="button" className={`button-secondary panel-tab ${activePanel === 'text' ? 'is-active' : ''}`} onClick={() => onPanelChange('text')}>Текст</button>
            <button type="button" className={`button-secondary panel-tab ${activePanel === 'upload' ? 'is-active' : ''}`} onClick={() => onPanelChange('upload')}>Изображение</button>
            <button type="button" className={`button-secondary panel-tab ${activePanel === 'draw' ? 'is-active' : ''}`} onClick={() => onPanelChange('draw')}>Рисунок</button>
            <button type="button" className={`button-secondary panel-tab ${activePanel === 'result' ? 'is-active' : ''}`} onClick={() => onPanelChange('result')}>Результат</button>
            <button type="button" className={`button-secondary panel-tab ${activePanel === 'preview' ? 'is-active' : ''}`} onClick={() => onPanelChange('preview')}>Живой предпросмотр</button>
          </div>
          <div className="hero__file-row">
            <button type="button" className="button-secondary hero__icon-btn" onClick={onToggleSettings} aria-label="Параметры">⚙</button>
          </div>
          {showSettings ? <div className="hero__dropdown-note">Параметры открыты ниже</div> : null}
        </div>
      </div>
    </header>
  );
}
