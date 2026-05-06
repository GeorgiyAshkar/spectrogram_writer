import { AudioPlayer } from './AudioPlayer';
interface HeaderProps {
  onPlayAudio: () => Promise<void>;
  isPreparingAudio: boolean;
  audioUrl: string | null;
  logoUrl?: string | null;
  activePanel: 'text' | 'upload' | 'draw' | 'result' | 'preview';
  onPanelChange: (next: 'text' | 'upload' | 'draw' | 'result' | 'preview') => void;
  showSettings: boolean;
  onToggleSettings: () => void;
}

const panelButtons: Array<{ key: 'text' | 'upload' | 'draw' | 'result' | 'preview'; label: string; icon: string }> = [
  { key: 'text', label: 'Текст', icon: '🅣' },
  { key: 'upload', label: 'Изображение', icon: '🖼️' },
  { key: 'draw', label: 'Рисунок', icon: '🎨' },
  { key: 'result', label: 'Результат', icon: '🏁' },
  { key: 'preview', label: 'Живой предпросмотр', icon: '👁️' },
];

export function Header({ logoUrl, activePanel, onPanelChange, showSettings, onToggleSettings, onPlayAudio, isPreparingAudio, audioUrl }: HeaderProps) {
  return (
    <header className="hero panel">
      <div className="hero__content hero__content--row">
        <div className="hero__brand-copy hero__brand-copy--row">
          {logoUrl ? <img src={logoUrl} alt="Логотип компании" className="hero__logo" /> : null}
          <h1>Спектральный след</h1>
        </div>
        <div className="hero__controls hero__controls--row">
          <div className="source-mode-options source-mode-options--row">
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
            <AudioPlayer audioUrl={audioUrl} isPreparingAudio={isPreparingAudio} onRequestAudio={onPlayAudio} />
          </div>
          {showSettings ? <div className="hero__dropdown-note">Параметры открыты ниже</div> : null}
        </div>
      </div>
    </header>
  );
}
