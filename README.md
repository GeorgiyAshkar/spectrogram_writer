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


### Параметры `defaults.json`

Ниже перечислены все параметры из `defaults.json`, их смысл и допустимые значения (по валидации backend).

| Параметр | Тип | Значение по умолчанию | Допустимые значения / ограничения |
|---|---:|---:|---|
| `text` | string | `ПОЗЫВНОЙ DE SPECTROGRAM...` | Непустая строка, `1..20000` символов в API. |
| `fmin` | number | `500` | `> 0`, и `fmax > fmin`. |
| `fmax` | number | `3700` | `> fmin` и `< samplerate / 2`. |
| `signal_duration` | number | `30` | `> 0` секунд. |
| `leading_silence` | number | `0.5` | `>= 0` секунд. |
| `trailing_silence` | number | `0.5` | `>= 0` секунд. |
| `samplerate` | integer | `8000` | `>= 8000` Гц. |
| `orientation` | enum | `time-x` | `time-x` или `freq-x`. |
| `freq_x_rotation` | enum | `ccw` | `ccw` или `cw`. |
| `freq_x_marquee` | boolean | `false` | `true/false`, нельзя одновременно с `freq_x_word_rows=true`. |
| `freq_x_word_rows` | boolean | `false` | `true/false`, нельзя одновременно с `freq_x_marquee=true`. |
| `edge_pad_cols` | integer | `-1` | Целое; `-1` = авто-подбор. |
| `img_width` | integer | `1000` | `>= 8`. |
| `img_height` | integer | `160` | `>= 8`. |
| `font_size` | integer | `180` | `>= 8`. |
| `margin` | integer | `12` | Целое (практически неотрицательное). |
| `vertical_margin` | integer | `8` | Целое (практически неотрицательное). |
| `smooth_freq` | integer | `5` | `>= 1`. |
| `smooth_sigma` | number | `1` | `> 0`. |
| `contrast` | number | `1` | `> 0`. |
| `invert` | boolean | `false` | `true/false`. |
| `fixed_phase` | boolean | `false` | `true/false`. |
| `timbre_mode` | enum | `pure` | `pure`, `harmonic`, `sample_masked` (но `sample_masked` сейчас не реализован). |
| `instrument_type` | enum | `piano` | `piano`, `guitar`, `synth`, `custom`. |
| `num_harmonics` | integer | `5` | `>= 1`. |
| `harmonic_decay_mode` | enum | `1/n` | `1/n`, `1/n^2`, `custom_list`. |
| `harmonic_weights` | number[] \| null | `[1,0.65,0.36,0.16,0.08]` | Неотрицательные числа; обязательны при `harmonic_decay_mode=custom_list` или `instrument_type=custom`. |
| `adsr_attack` | number | `0.02` | `>= 0`. |
| `adsr_decay` | number | `0.08` | `>= 0`. |
| `adsr_sustain` | number | `0.9` | Диапазон `[0, 1]`. |
| `adsr_release` | number | `0.05` | `>= 0`. |
| `sample_masked` | boolean | `false` | При `true` генерация отклоняется: режим пока не реализован. |
| `image_base64` | string \| null | `null` | Base64 PNG/JPEG для режима рисования/загрузки или `null`. |

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