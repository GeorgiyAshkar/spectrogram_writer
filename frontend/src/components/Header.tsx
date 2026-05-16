interface HeaderProps {
  logoUrl?: string | null;
  activePanel: 'text' | 'upload' | 'draw' | 'info';
  onPanelChange: (next: 'text' | 'upload' | 'draw' | 'info') => void;
  showSettings: boolean;
  onToggleSettings: () => void;
  controlsHidden: boolean;
  onLogoTripleClick: () => void;
}

const panelButtons: Array<{ key: 'text' | 'upload' | 'draw' | 'info'; label: string; icon: string }> = [
  { key: 'draw', label: 'Рисунок', icon: '🎨' },
  { key: 'upload', label: 'Изображение', icon: '🖼️' },
  { key: 'text', label: 'Текст', icon: '🅣' },
  { key: 'info', label: 'Результат и предпросмотр', icon: 'ℹ️' },
];

export function Header({ logoUrl, activePanel, onPanelChange, showSettings, onToggleSettings, controlsHidden, onLogoTripleClick }: HeaderProps) {
  return (
    <header className="hero panel">
      <div className="hero__content hero__content--row">
        <div className="hero__brand-copy hero__brand-copy--row">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Логотип компании"
              className="hero__logo hero__logo--interactive"
              onClick={(event) => {
                if (event.detail === 3) onLogoTripleClick();
              }}
            />
          ) : null}
          <h1>Спектральный след</h1>
        </div>
        <div className="hero__controls hero__controls--row">
          {!controlsHidden ? <div className="source-mode-options source-mode-options--row">
            {panelButtons.map((panel) => (
              <button
                key={panel.key}
                type="button"
                title={panel.label}
                aria-label={panel.label}
                className={`button-secondary panel-tab panel-tab--icon ${activePanel === panel.key ? 'is-active' : ''}`}
                onClick={() => onPanelChange(panel.key)}
              >
                <span aria-hidden="true">{panel.icon}</span>
              </button>
            ))}
            <button
              type="button"
              title="Параметры генерации"
              aria-label="Параметры генерации"
              className="button-secondary panel-tab panel-tab--icon"
              onClick={onToggleSettings}
            >
              <span aria-hidden="true">⚙️</span>
            </button>
          </div> : null}
          {showSettings ? <div className="hero__dropdown-note">Параметры открыты ниже</div> : null}
        </div>
      </div>
    </header>
  );
}
