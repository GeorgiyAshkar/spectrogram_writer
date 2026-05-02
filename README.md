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
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Основные endpoints:

- `GET /api/health`
- `POST /api/preview`
- `POST /api/render`

## Frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

По умолчанию фронтенд обращается к `/api` на том же origin и в dev-режиме проксирует запросы на backend (`http://127.0.0.1:8000`).
Можно переопределить:
- `VITE_BACKEND_ORIGIN` — куда Vite проксирует `/api` в dev-режиме;
- `VITE_API_BASE` — явный базовый URL API (если нужен обход прокси).

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

## Логотип компании

Если в корень проекта положить файл `logo.png`, backend автоматически начнёт отдавать его на `GET /api/branding/logo`, а интерфейс покажет логотип в шапке приложения.
