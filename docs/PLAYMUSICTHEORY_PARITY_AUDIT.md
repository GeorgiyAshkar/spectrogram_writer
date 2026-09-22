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

# 18. Что удалось снять из VERIFY

| Пункт | Новый статус | Результат |
|---|---|---|
| 1/2/3 | PARTIALLY CONFIRMED | drawing resolution/pixelization presets, не layers |
| Background | CONFIRMED | paper / sky / photo, cloud entry control |
| Undo | CONFIRMED | last line, Cmd-Z on iPad |
| Record/take | CONFIRMED high-level | take сохраняется после окончания перед sharing |
| The instrument | CONFIRMED | advanced paid feature bundle |
| Major/Minor | CONFIRMED | официальный changelog |
| Three-octave keyboard | CONFIRMED | официальный changelog |
| Gallery | CONFIRMED | публичная gallery существует |
| Palette | CONFIRMED visually | ряд готовых swatches + selected state |
| •/••/••• | STRONG OBSERVATION | rhythm-related, exact mapping pending |

---

# 19. Остающиеся VERIFY-пункты

До окончательного parity sign-off все еще нужно получить интерактивным замером:

- exact Key options;
- exact Scale options кроме Major/Minor;
- Range options;
- Octave min/max;
- Tune semantics и диапазон;
- Quantize option values;
- Swing option values;
- BPM min/max/default;
- Tap averaging behavior;
- Click timbre/accent;
- точное поведение `3` в drawing resolution;
- exact mapping `•/••/•••`;
- точное назначение `+`;
- custom color flow;
- exact behavior `Key` button;
- color → audio mapping;
- список timbres/instruments;
- MIDI input → scale mapping;
- WAV metronome policy;
- MIDI file track structure;
- browser record container/codec;
- share validation;
- gallery item open/edit behavior.

---

# 20. Ограничение текущего аудита

Текущий web-indexer надежно показывает controls и text, но не раскрывает значения HTML `<option>` и не позволяет программно менять select/range values как полноценный interactive browser.

Поэтому exact option lists нельзя честно объявлять подтвержденными только по DOM extraction.

Следующая проверка должна выполняться в интерактивном browser session/DevTools либо вручную пользователем с фиксацией:

- screenshots каждого expanded select;
- min/max input;
- behavior before/after;
- audio comparison.

---

# 21. Решение для разработки до финального замера

Разработку core можно начинать без ожидания оставшихся значений, если:

1. все unknown values живут в конфигурации;
2. UI labels не зашиты в DSP;
3. `1/2/3` реализуются отдельным `DrawingQuantizer`;
4. `•/••/•••` реализуются через отдельный `RhythmPresetMapper`;
5. theory settings приходят в engine через typed model;
6. exact parity values можно заменить одной конфигурацией без переписывания canvas/audio engine.

Это позволяет двигаться к MVP, не превращая временные догадки в архитектурные ограничения.


---

# 22. Hardening update — 2026-09-19

После первого аудита реализация была повторно сверена с текущим web UI и официальным App Store version history.

Подтверждено и приведено в соответствие:

- `The instrument` по умолчанию закрыт и открывается отдельным переключателем;
- внутри панели присутствует собственный close `×`;
- WAV/MIDI Export находится внутри `The instrument`;
- отдельный `Key` control открывает трехоктавную экранную клавиатуру;
- Undo действует только на последнюю нарисованную линию;
- Cmd/Ctrl+Z отменяет последнюю линию;
- отдельная `?` справка реализована в music mode;
- tempo имеет числовое управление, Tap и связанный range-control;
- preset `2`/coarse drawing отображается как grid/pixel stroke, а не только координатный snap;
- `1/2/3` и `•/••/•••` остаются конфигурируемыми до exact interactive measurement.

Дополнительные источники подтверждают общий характер controls:

- https://80.lv/articles/this-website-turns-your-sketches-into-minecraft-like-music
- https://note.com/aoyamaan_h1/n/nc6318c5a8581

Exact HTML option values текущий публичный индексатор по-прежнему не раскрывает. Они не считаются подтвержденными и остаются в `parityConfig.ts`.
