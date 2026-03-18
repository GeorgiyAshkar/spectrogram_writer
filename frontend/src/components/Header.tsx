export function Header() {
  return (
    <header className="hero panel">
      <div>
        <span className="badge">React + FastAPI</span>
        <h1>Spectrogram Writer Studio</h1>
        <p>
          UI-оболочка для генерации waterfall / spectrogram текста с разделением на независимые frontend и backend сервисы.
        </p>
      </div>
      <div className="hero__note">
        <strong>Microservice-ready</strong>
        <span>Фронтенд работает как самостоятельный клиент, а Python-ядро вынесено в API-слой для дальнейшего масштабирования.</span>
      </div>
    </header>
  );
}
