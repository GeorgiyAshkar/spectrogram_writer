# Parity Audit — play_music_theory

**Эталон:** https://playmusictheory.net/play  
**Дата аудита:** 2026-09-19  
**Связанный документ:** `docs/PLAYMUSICTHEORY_PARITY_SPEC.md`  
**Evidence matrix:** `docs/PARITY_EVIDENCE_MATRIX.md`

## 1. Цель

Этот документ фиксирует результаты проверки оригинального web-инструмента и официального iOS-приложения после первичного составления спецификации. Его задача — отделить подтвержденное поведение от предположений и снять неоднозначности до начала большого рефакторинга.

Используется clean-room подход: анализируется только наблюдаемое поведение, публичный UI, официальные описания и публичные screenshots. Исходный код оригинального продукта не используется.

## 2. Источники

### Первичные

1. https://playmusictheory.net/play — текущий web UI.
2. https://playmusictheory.net/gallery — публичная gallery.
3. https://apps.apple.com/us/app/play-music-theory/id6800616114 — официальная App Store page и version history.
4. Официальные App Store screenshots, опубликованные разработчиком.

### Вторичные

Использовались только как дополнительная проверка наблюдаемого поведения:

- обзор 80.lv от 2026-09-14;
- японский обзор aoyamaan.jp от 2026-09-14;
- пользовательские App Store reviews.

Вторичный источник сам по себе не переводит требование в CONFIRMED.

---

# 3. Текущий web UI — прямой DOM-аудит

На `/play` напрямую наблюдаются следующие controls:

- `?` — help;
- Key — select;
- Scale — select;
- Range — select;
- Octave — `-`, текущее числовое смещение, `+`;
- Paper;
- Tune — input;
- Quantize — select;
- Swing — select;
- Click — Off/On;
- MIDI in — Off/On;
- Export — WAV / MIDI;
- The instrument — отдельная панель с `×`;
- Upgrade · $4.99 + code input;
- два tempo-related input и `Tap`;
- кнопки `1`, `2`, `3`;
- кнопки `•`, `••`, `•••`;
- `+`;
- дополнительный input;
- `Key` button;
- `title`;
- `your name / handle`;
- submit arrow;
- `record`;
- `share`.

Help самого оригинала прямо говорит:

- выбрать key и scale;
- grid показывает названия нот;
- доступны quantize, swing, tap tempo и metronome click;
- цвета настраиваются;
- можно играть MIDI-клавиатурой в loop;
- loop экспортируется в WAV и MIDI.

---

# 4. Визуальный UI — официальные screenshots

Официальные screenshots подтверждают базовую геометрию интерфейса.

## 4.1. Canvas

- крупный canvas занимает центральную часть экрана;
- присутствует регулярная координатная/grid-разметка;
- во время playback видна вертикальная линия playhead;
- рисунок располагается позади/внутри той же области;
- минималистичная панель управления находится сразу под canvas.

## 4.2. Tool row

На screenshots визуально присутствуют:

- play/pause;
- активный drawing tool;
- дополнительные drawing/edit controls;
- undo-like control;
- дополнительное действие очистки/перестройки.

Точные семантики всех icon-only controls нужно отдельно проверить интерактивно. В спецификации не следует присваивать им поведение только по пиктограмме.

## 4.3. Палитра

Наблюдается ряд примерно из десяти готовых цветовых swatches.

Подтверждено:

- один цвет имеет selected state с внешним кольцом;
- stroke рисуется выбранным цветом;
- выбор цвета не требует открытия отдельного dialog.

Текущий web help говорит “Make the colors your own”, а DOM дополнительно содержит `+` и input рядом с нижними controls. Это сильный признак custom-color workflow, но точная последовательность `+` → picker → add/replace требует интерактивной проверки.

## 4.4. Background

Официальные screenshots показывают как минимум:

- бумажный/нейтральный фон;
- sky background;
- user photo background.

Version history официально подтверждает:

- tap cloud → background card;
- paper;
- sky;
- photo;
- hold cloud → выбрать свою фотографию в более ранней версии.

На screenshots отдельная cloud-button находится справа от нижних controls.

**Вывод:** cloud/background control не связан с `1/2/3`.

---

# 5. Кнопки 1 / 2 / 3 — измерено интерактивно

Первичная гипотеза о трех вариантах drawing resolution была уточнена интерактивным DOM/browser-аудитом.

Текущий reference UI показывает:

- `1` — **Drawing mode**;
- `2` — **Pixel mode**;
- `3` — **Video mode**, hint: “Map a photo to each instrument.”

В текущем публичном rendered UI `3` присутствует в DOM, но скрыт через `display:none`.

### Parity requirement

```ts
type ProgramMode = 1 | 2 | 3;
```

- Program 1 сохраняет свободную векторную геометрию stroke.
- Program 2 использует измеренную pixel/grid геометрию: 48 horizontal columns; число vertical rows следует текущему discrete pitch range.
- Program 3 сохраняется в domain model, но не должен отображаться как доступный control, пока текущий reference сам его скрывает.

Не трактовать `1/2/3` как audio layers или три степени pixelization.

---

# 6. Кнопки • / •• / ••• — измерено интерактивно

Rendered DOM и black-box audio analysis подтвердили точную семантику:

- `•` — **Bass**;
- `••` — **Drums**;
- `•••` — **Arpeggio**.

Controls независимы и могут быть включены одновременно.

Для default C / Major pentatonic / 120 BPM также измерено:

- Bass: tonic C3 / MIDI 48, retrigger каждый beat;
- Drums: closed hi-hat каждые 1/3 beat, kick на beats 0/2, snare на beats 1/3;
- Arpeggio: triplet-grid sequence C5–E5–G5–A5–C6–A5–G5–E5.

### Parity requirement

В domain model это три независимых boolean layer-controls:

```ts
bassEnabled: boolean;
drumsEnabled: boolean;
arpeggioEnabled: boolean;
```

Не использовать старую абстракцию `RhythmPreset = 1 | 2 | 3`.

---

# 7. Drawing → sound

Подтверждено несколькими источниками и визуальным поведением:

- страница проигрывает рисунок слева направо;
- верх canvas соответствует более высоким pitch;
- низ canvas — более низким;
- playhead движется вертикальной линией слева направо;
- grid после включения instrument может именовать ноты;
- рисунок не является просто декоративным слоем — его spatial position определяет звук.

Точный sample density / number of time buckets оригинала пока не подтвержден.

Не переносить “32 steps” из независимого `playmusictheory.top`: это другая реализация.

---

# 8. Key / Scale / Range / Octave

### Confirmed

- Key существует как select.
- Scale существует как select.
- официальная version history явно подтверждает Major и Minor.
- Range существует как select.
- Octave имеет `-`, numeric offset и `+`.
- текущий visible offset по умолчанию — `0`.

### Не подтверждено

- полный список keys;
- enharmonic spelling (C# vs Db);
- exact Range options;
- min/max Octave;
- является ли Range количеством octaves, количеством scale rows или иной величиной.

В коде сохранять domain model независимой от UI labels.

---

# 9. Tempo / Tap / speed

Подтверждено:

- exact tempo относится к “The instrument”;
- web DOM содержит tempo-related inputs и `Tap`;
- официальный App Store changelog говорит о tempo;
- внешний hands-on review отдельно подтверждает slider изменения скорости.

Точные значения min/max/default еще не получены.

Не hard-code 30–300 BPM как parity fact; это допустимый engineering fallback до замера.

---

# 10. Quantize / Swing / Click

Подтверждено:

- Quantize select;
- Swing select;
- Click Off/On;
- help напрямую связывает их с rhythm;
- changelog подтверждает “quantize ticks”.

Не подтверждено:

- exact quantize values;
- exact swing values/ratios;
- metronome accent pattern;
- включается ли click в WAV export.

---

# 11. Undo

Официальная версия 1.1.1:

- back arrow отменяет последнюю line;
- на iPad работает Command-Z.

Это означает, что parity behavior должен быть **stroke-level undo**.

App Store review после релиза сообщает о неудобном/ошибочном поведении undo в одном из состояний, поэтому наша реализация должна дополнительно гарантировать:

- одно нажатие undo не очищает весь canvas;
- undo действует на последний stroke/action;
- redo можно добавить как наше улучшение, но это не current-original parity requirement.

---

# 12. Background / Paper

Уточнение терминов:

- web advanced UI показывает `Paper`;
- app history описывает background card: paper / sky / photo;
- screenshot показывает cloud-button как entry control.

Для нашей модели:

```ts
type BackgroundMode =
  | { kind: "paper" }
  | { kind: "sky" }
  | { kind: "photo"; assetId: string };
```

Web UI может показывать label `Paper` внутри instrument panel, но основной background trigger может быть icon-only.

---

# 13. Record / Take

Официальный changelog подтверждает:

- существует “take”;
- take сохраняется в Photos сразу после завершения;
- сохранение происходит до sharing.

Это сильный признак **аудиовизуальной записи исполнения**, а не простого сохранения project JSON.

Parity architecture должна поддерживать:

- start take;
- playback/drawing visual stream;
- audio mix;
- stop/end;
- materialized media artifact;
- далее share.

Для browser implementation предпочтителен `canvas.captureStream + WebAudio destination + MediaRecorder`, если browser capabilities позволяют.

---

# 14. Share / Gallery

Подтверждено:

- web UI имеет `share`;
- share form содержит `title` и `your name / handle`;
- есть submit action;
- `/gallery` публично содержит большое количество пользовательских работ;
- gallery индексирует как минимум title/author-facing metadata.

Не подтверждено:

- ограничения длины;
- обязательность author;
- возможность повторного редактирования gallery item;
- immutable ли snapshot;
- хранится ли WAV/video вместе с drawing data.

Наша data model может быть богаче оригинала, но parity UI не должен заставлять пользователя заполнять больше полей.

---

# 15. “The instrument” и entitlement

Подтверждено:

- web показывает `Upgrade · $4.99`;
- App Store IAP называется `the instrument`, $4.99 в US store;
- official changelog описывает purchase как one purchase / yours forever;
- feature set: keys, major/minor, octaves, quantize ticks, tempo, three-octave keyboard, loop export.

Следовательно, “The instrument” — это не отдельный timbre. Это **advanced feature panel / entitlement bundle**.

В нашей версии payment не обязателен, но архитектурный feature gate остается полезным.

---

# 16. Virtual keyboard и кнопка Key

Официальный changelog подтверждает three-octave keyboard.

DOM одновременно показывает отдельный `Key` button рядом с нижними controls.

Сильная гипотеза: этот button открывает/переключает экранную keyboard.

Но без интерактивного click-through статус остается:

**[LIKELY, VERIFY]**

В коде не следует путать:

- `Key` select = musical tonic;
- `Key` button = вероятный keyboard control.

---

# 17. Цвет ↔ звук

Подтверждено, что:

- есть множество color swatches;
- цвета можно настраивать;
- strokes сохраняют выбранный цвет.

Сильные косвенные признаки указывают, что разные цвета связаны с различным звуковым поведением/voice, но прямой официальный текст текущего web help не перечисляет mapping color → instrument.

Поэтому:

- data model должна позволять `colorId → voice/instrument profile`;
- конкретный mapping не считать parity fact до прямого прослушивания;
- не переносить названия `Soft keys / Marimba / Warm synth / Bells` из независимого сайта `playmusictheory.top` — это не оригинал.

---

# 18. Что удалось снять из VERIFY — update 2026-09-23

После первичного аудита был добавлен интерактивный clean-room browser harness на headless Chrome. Он позволяет:

- читать rendered DOM и реальные `option/min/max/default`;
- нажимать controls и сравнивать state before/after;
- измерять canvas geometry;
- анализировать выход reference через Web Audio `AnalyserNode`;
- наблюдать `MediaRecorder` policy;
- запускать отдельные production browser smoke tests нашей реализации.

Текущий статус:

| Пункт | Статус | Измеренный результат |
|---|---|---|
| Key | CONFIRMED | C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B |
| Scale | CONFIRMED | Major pentatonic, Minor pentatonic, Major, Minor, Harmonic minor, Dorian, Phrygian, Lydian, Mixolydian, Blues |
| Default Scale | CONFIRMED | Major pentatonic |
| Range | CONFIRMED | 1 / 2 / 3 octaves, default 3 |
| Tune | CONFIRMED | -50..+50 cents, default 0 |
| Tempo | CONFIRMED | 60..200 BPM, default 120 |
| Quantize | CONFIRMED | 1/4, 1/8, 1/8 triplet, 1/16, 1/16 triplet, 1/32; default 1/8 triplet |
| Swing | CONFIRMED | Off / Light / Medium / Hard = 0 / 0.1 / 0.2 / 0.33 |
| Swing + triplet | CONFIRMED | triplet grids не получают дополнительный swing |
| 1 | CONFIRMED | Drawing mode |
| 2 | CONFIRMED | Pixel mode |
| 3 | CONFIRMED label | Video mode; “Map a photo to each instrument”; control скрыт в текущем public UI |
| Pixel geometry | CONFIRMED | 48 horizontal columns; vertical rows следуют active discrete pitch range |
| • | CONFIRMED | Bass |
| •• | CONFIRMED | Drums |
| ••• | CONFIRMED | Arpeggio |
| Default Bass | MEASURED | C3/MIDI48 для Key=C, retrigger каждый beat |
| Default Drums | MEASURED | hi-hat каждые 1/3 beat; kick 0/2; snare 1/3 |
| Default Arpeggio | MEASURED | C5-E5-G5-A5-C6-A5-G5-E5, 1/3 beat step |
| All-scale Arpeggio | MEASURED | major-family 0/4/7/9/12/9/7/4; minor-family 0/3/7/10/12/10/7/3 |
| Instrument harmonics | MEASURED | relative harmonic spectra measured for all 9 instrument IDs |
| Freestyle | STRONG RUNTIME EVIDENCE | handler toggles freestyle, releases held notes via noteUp, redraws lock/keys; drawing listeners independent |
| Freehand | MEASURED | geometry неизменна; pitch continuous; Scale/Range не влияют |
| Freehand curve | MEASURED | при C: примерно MIDI = 79 - 31*y; Key транспонирует signed pitch-class offset |
| Grid | CONFIRMED | default On |
| Instruments | CONFIRMED IDs | keys, pluck, bell, marimba, flute, strings, chime, bass, 8bit |
| Recolor | CONFIRMED | 27 preset colors + custom + original colors reset |
| Background | CONFIRMED | Paper / Sky / Photo |
| Photo fit | CONFIRMED | Fill / Fit / Stretch |
| Record container | CONFIRMED | request video/mp4; Chromium actual video/mp4;codecs=vp9,opus |
| Share limits | CONFIRMED | title maxlength 48; name/handle maxlength 120 |
| Mobile implementation | VERIFIED | production smoke 390×844 без horizontal document overflow |

---

# 19. Остающиеся VERIFY-пункты

После интерактивных измерений осталось значительно меньше неопределенностей:

- Octave min/max: current public entitlement state не позволяет наблюдать изменение offset;
- точный effect Octave на Freehand за пределами принятой conventional ±12 semitone модели;
- Tap averaging/window behavior;
- exact Click timbre и включение/исключение click в WAV export;
- exact MIDI file layout reference, включая reference policy для Freehand pitch bend;
- exact original envelopes/phase для 9 instruments; harmonic spectra уже measured;
- direct entitled-reference verification of keyboard highlighting/availability under Freestyle;
- gallery item open/edit/ownership lifecycle.

Freestyle прошел отдельный runtime probe:

- forward/backtracking drawing geometry = default;
- drawing pointer listeners не содержат зависимости от Freestyle;
- tested drawing pitch spectrum ≈ default;
- onset timing не показывает Quantize bypass;
- `lockBtn` handler toggles `freestyle`, releases every `held` note through `noteUp`, then calls `drawLock` and `drawKeys`.

На этой основе clone реализует Freestyle как scale-lock toggle для virtual keyboard/Web MIDI, при этом drawing/Freehand остаются независимыми.

---

# 20. Ограничения текущего аудита

Browser harness снимает существенно больше данных, чем первоначальный DOM-indexer, но остаются объективные ограничения:

1. часть `The instrument` actions в public reference entitlement-locked;
2. WAV/MIDI buttons видимы, но в такой session не materialize download;
3. Octave +/- визуально доступны, но не меняют offset в текущем entitlement state;
4. прямой захват некоторых instrument-specific audio paths зависит от browser/audio backend;
5. black-box spectral measurement имеет FFT/time-resolution error и не используется как “точный исходный DSP”.

Поэтому каждый measured fact хранится отдельно от clean-room approximation.

---

# 21. Решение для дальнейшей разработки

Архитектура уже не зависит от старых временных mapper-гипотез:

1. `ProgramMode` отделен от audio accompaniment;
2. Bass / Drums / Arpeggio — независимые boolean layers;
3. exact theory options находятся в `parityConfig.ts`;
4. Freehand имеет отдельный continuous-pitch mapper;
5. Pixel mode имеет отдельную measured grid geometry;
6. instrument identity отделена от цвета;
7. realtime / WAV / MIDI используют общий canonical `NoteEvent[]`;
8. все ещё неизвестные детали изолированы в конфигурируемых слоях.

Это позволяет продолжать hardening без повторного переписывания canvas/audio domain.

---

# 22. Hardening update — 2026-09-23

К этому этапу в ветке `playmusictheory` реализованы и проверены:

- realtime Web Audio loop scheduler;
- measured Key/Scale/Range/Tune/Tempo/Quantize/Swing defaults;
- Drawing + measured Pixel mode;
- continuous measured Freehand mapping;
- measured Bass/Drums и Arpeggio для всех 10 Scale options;
- Freestyle scale-lock для virtual keyboard/Web MIDI + held-note cleanup;
- 9 stable instrument IDs, exact reference colors и measured harmonic spectra;
- Recolor workflow;
- Paper/Sky/Photo + Fill/Fit/Stretch;
- Web MIDI input;
- three-octave virtual keyboard;
- WAV export;
- MIDI export с Freehand pitch bend;
- Take recording с MP4-first reference policy;
- Web Share take flow;
- autosave/versioned project state;
- share/gallery backend;
- desktop + mobile production browser smoke.

Текущий authoritative measured-status находится в:

- `docs/PARITY_EVIDENCE_MATRIX.md`;
- `docs/IMPLEMENTATION_STATUS.md`.

Этот audit теперь отражает текущую measured baseline, а не состояние первого DOM-only прохода.
