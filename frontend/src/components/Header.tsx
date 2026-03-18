export function Header() {
  return (
    <header className="hero panel">
      <div className="hero__content">
        <div className="hero__brand-copy">
          <h1>Спектральный след</h1>
          <p>
            Светлый и аккуратный интерфейс для генерации текста, отображаемого на waterfall / spectrogram, с
            автоматическим предпросмотром и экспортом WAV-файла.
          </p>
        </div>
        <div className="hero__note">
          <strong>Предпросмотр обновляется автоматически</strong>
          <span>Изменяйте параметры — изображение пересчитывается сразу, без ручного запуска.</span>
        </div>
      </div>
    </header>
  );
}
