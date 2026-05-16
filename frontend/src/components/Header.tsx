import { useEffect, useState } from 'react';

interface HeaderProps {
  logoUrl?: string | null;
  activePanel: 'text' | 'upload' | 'draw' | 'info';
  onPanelChange: (next: 'text' | 'upload' | 'draw' | 'info') => void;
  showSettings: boolean;
  onToggleSettings: () => void;
  controlsHidden: boolean;
  onLogoTripleClick: () => void;
}

const defaultIcons = {
  draw: '/icons/draw.svg',
  upload: '/icons/upload-image.svg',
  text: '/icons/text-input.svg',
  info: '/icons/info.svg',
  settings: '/icons/settings.svg',
};

const panelButtons: Array<{ key: 'text' | 'upload' | 'draw' | 'info'; label: string; iconKey: 'draw' | 'upload' | 'text' | 'info' }> = [
  { key: 'draw', label: 'Рисунок', iconKey: 'draw' },
  { key: 'upload', label: 'Изображение', iconKey: 'upload' },
  { key: 'text', label: 'Текст', iconKey: 'text' },
  { key: 'info', label: 'Результат и предпросмотр', iconKey: 'info' },
];

export function Header({ logoUrl, activePanel, onPanelChange, showSettings, onToggleSettings, controlsHidden, onLogoTripleClick }: HeaderProps) {
  const [icons, setIcons] = useState(defaultIcons);

  useEffect(() => {
    void fetch('/icon_config.json')
      .then((response) => response.json())
      .then((config) => {
        setIcons({
          draw: config.draw ?? defaultIcons.draw,
          upload: config.upload ?? defaultIcons.upload,
          text: config.text ?? defaultIcons.text,
          info: config.info ?? defaultIcons.info,
          settings: config.settings ?? defaultIcons.settings,
        });
      })
      .catch(() => setIcons(defaultIcons));
  }, []);

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
                <img src={icons[panel.iconKey]} alt="" aria-hidden="true" className="panel-tab__icon-image" />
              </button>
            ))}
            <button
              type="button"
              title="Параметры генерации"
              aria-label="Параметры генерации"
              className="button-secondary panel-tab panel-tab--icon"
              onClick={onToggleSettings}
            >
              <img src={icons.settings} alt="" aria-hidden="true" className="panel-tab__icon-image" />
            </button>
          </div> : null}
          {showSettings ? <div className="hero__dropdown-note">Параметры открыты ниже</div> : null}
        </div>
      </div>
    </header>
  );
}
