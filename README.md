# spectrogram_writer

Модульное приложение для генерации WAV-файлов, которые отображаются как текст на spectrogram / waterfall.

## Архитектура

Проект разделён на два независимых сервиса:

- `backend/` — FastAPI API и Python-ядро генерации сигнала.
- `frontend/` — React + TypeScript интерфейс для предпросмотра и экспорта WAV.
- `spec_writer` — CLI-обёртка, использующая то же ядро, что и backend.

Такое разделение позволяет:

- развивать UI и API независимо;
- масштабировать backend отдельно от frontend;
- добавлять новые transport-слои без переписывания DSP-логики.

## Backend

Установка зависимостей:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Запуск API:

```bash
uvicorn backend.main:app --reload
```

Основные endpoints:

- `GET /api/health`
- `POST /api/preview`
- `POST /api/render`

## Frontend

```bash
cd frontend
npm install
npm run dev
```

По умолчанию фронтенд ожидает API на `http://localhost:8000/api`.
При необходимости можно переопределить `VITE_API_BASE`.

## CLI

```bash
./spec_writer \
  --text "CQ TEST" \
  --fmin 2000 \
  --fmax 12000 \
  --signal-duration 10 \
  --output out.wav \
  --preview-png out.png
```
