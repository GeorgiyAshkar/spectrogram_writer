interface HeaderProps {
  logoUrl: string | null;
}

export function Header({ logoUrl }: HeaderProps) {
  return (
    <header className="hero panel">
      <div className="hero__brand">
        {logoUrl ? (
          <div className="hero__logo-wrap">
            <img className="hero__logo" src={logoUrl} alt="Логотип компании" />
          </div>
        ) : null}
        <div>
          <h1>Студия спектрограмм</h1>
          <p>
            Удобный интерфейс для генерации текста, который отображается на waterfall / spectrogram, с быстрым
            предпросмотром и экспортом WAV-файла.
          </p>
        </div>
      </div>
      <div className="hero__note">
        <strong>Предпросмотр обновляется автоматически</strong>
        <span>Изменяйте параметры — изображение спектрограммы будет пересчитываться без ручного запуска.</span>
      </div>
    </header>
  );
}
