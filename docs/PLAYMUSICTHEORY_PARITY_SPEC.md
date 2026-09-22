# Спецификация функционального воспроизведения play_music_theory

**Репозиторий:** `GeorgiyAshkar/spectrogram_writer`  
**Целевая ветка:** `playmusictheory`  
**Статус документа:** Product + UX + Functional Specification  
**Дата фиксации эталона:** 2026-09-19  
**Эталон:** https://playmusictheory.net/play  
**Parity audit:** [PLAYMUSICTHEORY_PARITY_AUDIT.md](./PLAYMUSICTHEORY_PARITY_AUDIT.md)

---

## 1. Назначение документа

Цель — описать достаточно подробно функциональность и пользовательский интерфейс визуального музыкального инструмента, аналогичного `playmusictheory.net/play`, чтобы по этому документу можно было:

1. реализовать функционально эквивалентный пользовательский сценарий в `spectrogram_writer`;
2. не зависеть от исходного кода оригинального продукта;
3. разбить разработку на независимые задачи frontend/audio/MIDI/export/share;
4. написать автоматические и ручные acceptance-тесты;
5. после реализации выполнить parity-проверку оригинал ↔ наша версия.

Документ описывает **поведение и UX-модель**, а не копирование исходного кода, графических ресурсов, логотипа, шрифтов или фирменного оформления оригинального продукта.

---

## 2. Источники и уровень достоверности

### 2.1. Первичные источники

- Оригинальный web-инструмент: https://playmusictheory.net/play
- Главная страница: https://playmusictheory.net/
- Галерея: https://playmusictheory.net/gallery
- Официальная страница приложения: https://apps.apple.com/us/app/play-music-theory/id6800616114

### 2.2. Подтвержденные оригиналом возможности

На web-странице непосредственно наблюдаются:

- Key;
- Scale;
- Range;
- Octave с кнопками `-` / `+`;
- Paper;
- Tune;
- Quantize;
- Swing;
- Click On/Off;
- MIDI in On/Off;
- Export WAV;
- Export MIDI;
- панель/раздел `The instrument`;
- справочное окно;
- tempo/tap-блок;
- кнопки `1`, `2`, `3`;
- кнопки `•`, `••`, `•••`;
- кнопка `+`;
- input, связанный с настройкой цвета/параметра;
- кнопка `Key`;
- поля `title` и `your name / handle`;
- действие отправки;
- `record`;
- `share`;
- ссылка `Get the app`;
- ссылка на Instagram `@play_music_theory`.

Официальное описание приложения дополнительно подтверждает:

- рисование преобразуется в звук;
- keys;
- major/minor;
- octaves;
- quantize ticks;
- tempo;
- three-octave keyboard;
- loop export;
- undo;
- background card: paper / sky / photo;
- поддержку нескольких линий;
- сохранение take;
- встроенную справку по контролам.

### 2.3. Маркировка требований

В документе используются статусы:

- **[CONFIRMED]** — подтверждено оригинальным web UI или официальной страницей приложения;
- **[DERIVED]** — логически следует из подтвержденного поведения;
- **[VERIFY]** — элемент наблюдается, но точная семантика/набор значений требуют ручной проверки в эталоне перед финальным parity sign-off.

---

# 3. Продуктовая модель

## 3.1. Главная идея

Пользователь рисует на двумерном полотне. Нарисованная геометрия одновременно является музыкальной последовательностью.

Базовое отображение:

- X → время;
- Y → высота звука;
- выбранные Key + Scale → разрешенный набор нот;
- выбранный Range + Octave → вертикальный диапазон;
- цвет/слой → тембр или музыкальный голос;
- геометрия линии → последовательность нот во времени;
- loop → повторяет получившуюся последовательность.

Главный UX-принцип: пользователь должен получить музыкальный результат **сразу**, без знания нотной грамоты.

## 3.2. Основной пользовательский цикл

`выбрать звук/цвет → нарисовать → Play/Loop → изменить рисунок → изменить музыкальные параметры → послушать → экспортировать/записать/поделиться`.

Ни одно изменение не должно требовать отдельного "Generate".

---

# 4. Компоновка интерфейса

## 4.1. Desktop

Рекомендуемая структура:

```
┌──────────────────────────────────────────────────────────────┐
│ ?                @play_music_theory / branding             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    DRAWING / MUSIC CANVAS                    │
│                                                              │
│                 grid + note labels + playhead                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ transport / layer / brush controls                           │
├──────────────────────────────────────────────────────────────┤
│ optional THE INSTRUMENT panel                                │
├──────────────────────────────────────────────────────────────┤
│ record · share · Get the app · footer                        │
└──────────────────────────────────────────────────────────────┘
```

Точная раскладка может адаптироваться под существующую архитектуру `spectrogram_writer`, но:

- canvas должен оставаться главным визуальным объектом;
- музыкальные настройки не должны вытеснять canvas;
- часто используемые действия должны быть доступны максимум за 1 действие;
- панель расширенных настроек должна сворачиваться.

## 4.2. Mobile / tablet

- canvas получает приоритет по высоте;
- touch targets ≥ 44×44 CSS px;
- горизонтальные группы можно переводить в горизонтальный scroll;
- модальные/выдвижные панели занимают ширину экрана;
- недопустим обязательный hover;
- pointer events должны одинаково работать для mouse, pen и touch;
- preventDefault применять только на самом canvas, чтобы не ломать page scroll вне него.

---

# 5. Canvas

## 5.1. Поведение рисования

### Drawing input [CONFIRMED/DERIVED]

Поддержать:

- `pointerdown` — начало stroke;
- `pointermove` — продолжение;
- `pointerup` / `pointercancel` — завершение;
- mouse;
- touch;
- Apple Pencil / stylus через Pointer Events.

Каждый stroke хранится в векторной форме, а не только как raster bitmap:

```ts
type Point = {
  x: number;          // normalized 0..1
  y: number;          // normalized 0..1
  t: number;          // ms from stroke start
  pressure?: number;  // 0..1
}

type Stroke = {
  id: string;
  layerId: string;
  color: string;
  brushSize: number;
  points: Point[];
  createdAt: number;
}
```

Normalized coordinates обязательны для корректного resize.

## 5.2. Отображение музыкальной сетки [CONFIRMED]

При выбранных Key/Scale grid должен подписывать доступные ноты.

Требования:

- горизонтальные pitch-зоны;
- note label соответствует фактической ноте audio engine;
- изменение Key/Scale/Range/Octave мгновенно обновляет подписи;
- ранее нарисованные strokes не исчезают;
- визуальное положение stroke сохраняется;
- музыкальная интерпретация после изменения строя пересчитывается.

## 5.3. X → time

Для normalized координаты `x ∈ [0,1]`:

```
absoluteBeat = x * loopLengthBeats
timeSec = absoluteBeat * 60 / bpm
```

Если quantize выключен, используется непрерывное значение.

Если quantize включен, onset округляется к активной rhythmic grid.

## 5.4. Y → pitch

`y=0` — верх canvas = высокая нота.  
`y=1` — низ canvas = низкая нота.

Алгоритм:

1. получить разрешенный pitch pool для Key + Scale;
2. расширить его на текущий Range и Octave;
3. инвертировать Y;
4. сопоставить координату ближайшему pitch bucket;
5. получить MIDI number;
6. вычислить частоту:

```
f = 440 * 2^((midi - 69) / 12)
```

## 5.5. Линия как музыкальное событие

Не следует создавать отдельную ноту на каждый raw pointer sample.

Pipeline:

```
raw points
→ resampling by X/time
→ pitch mapping
→ optional quantization
→ merge identical adjacent pitches
→ note events
→ playback
```

Цель — стабильный звук независимо от частоты pointer events конкретного устройства.

## 5.6. Пересечения и полифония

- несколько strokes в одном временном диапазоне играют одновременно;
- несколько слоев могут звучать одновременно;
- один stroke может менять pitch непрерывно или ступенчато в зависимости от выбранного режима интерпретации;
- polyphony limit должен быть конфигурируемым;
- voice stealing — oldest/quietest voice, без щелчка.

---

# 6. Undo / clear / edit

## 6.1. Undo [CONFIRMED]

- отдельная кнопка back-arrow;
- undo удаляет последнее пользовательское изменение;
- минимум: последний stroke;
- desktop shortcut: `Ctrl/Cmd + Z`;
- история минимум 50 действий.

Рекомендуется сразу реализовать redo:

- `Ctrl/Cmd + Shift + Z`;
- UI может быть добавлен позднее;
- data model должен redo поддерживать.

## 6.2. Clear

Перед полным удалением насыщенного canvas желательно confirmation, если undo stack не способен надежно восстановить работу.

## 6.3. Eraser [VERIFY]

Если эталон поддерживает стирание частями stroke — повторить.

Если нет — в parity-версии достаточно удаления stroke целиком через undo/selection, но архитектура должна позволять segmented erase позднее.

---

# 7. Слои, цвета и голоса

## 7.1. Buttons 1 / 2 / 3 [PARTIALLY CONFIRMED]

Parity audit снял первоначальную гипотезу о слоях.

Официальные screenshots показывают:

- `1` — continuous/freehand baseline;
- `2` — выраженный grid/pixelized drawing;
- `3` — третий selectable preset того же семейства; exact resolution пока требует интерактивной проверки.

Вторичный hands-on обзор независимо описывает numeric controls как режимы, позволяющие превращать рисунок в pixel-art-like представление.

Использовать отдельную модель:

```ts
type DrawingResolutionPreset = 1 | 2 | 3;
```

Эти buttons **не должны использоваться как layer selector**.

Drawing layers/voices, если они нужны нашей архитектуре, существуют отдельно от визуального parity-control `1/2/3`.

## 7.2. Color

- выбранный цвет виден до рисования;
- новый stroke получает snapshot текущего цвета;
- изменение цвета не должно автоматически менять старые strokes, если специально не выбран режим recolor;
- color input должен иметь доступный fallback для touch.

## 7.3. Add `+` [VERIFY]

Наблюдается отдельная кнопка `+`, рядом с ней DOM показывает дополнительный input, а help говорит “Make the colors your own”.

Наиболее сильная текущая гипотеза — custom-color workflow: добавить/настроить цвет палитры.

До интерактивной проверки:

- не связывать `+` со слоями;
- color customization хранить отдельно от audio layer count;
- UI adapter должен позволять заменить exact semantics без изменения Project model.

---

# 8. Brush controls

## 8.1. Buttons • / •• / ••• [STRONG OBSERVATION, exact mapping VERIFY]

Первичная гипотеза “brush thickness” больше не считается основной.

Внешний hands-on review текущего web-инструмента сообщает, что эта группа меняет/добавляет rhythm. Сами labels из одного, двух и трех dots также согласуются с rhythmic density/subdivision preset.

При этом точный mapping пока не измерен интерактивно, поэтому в domain model использовать нейтральную абстракцию:

```ts
type RhythmPreset = 1 | 2 | 3;
```

Не зашивать названия “thin / medium / thick” и не связывать preset напрямую с CSS brush width.

Если финальный интерактивный замер покажет комбинированное влияние на brush + rhythm, mapper расширяется без изменения сохраненного проекта.

---

# 9. The instrument panel

## 9.1. Открытие/закрытие [CONFIRMED]

- entry control с названием `The instrument`;
- panel/dialog;
- close `×`;
- настройки внутри не должны пропадать после закрытия;
- playback продолжает корректно работать при закрытой панели.

## 9.2. Help text [CONFIRMED]

Оригинал сообщает:

- choose your key and scale;
- grid names the notes;
- quantize/swing/tap tempo/metronome;
- color customization;
- MIDI keyboard input;
- WAV/MIDI export.

Наша help-панель должна объяснять тот же workflow собственным текстом.

---

# 10. Key

## 10.1. UI [CONFIRMED]

Select `Key`.

Базовый набор:

`C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab, A, A#/Bb, B`.

Если оригинал использует только sharps либо только flats — parity UI корректируется после ручной проверки.

## 10.2. Behavior

Изменение Key:

- обновляет pitch pool;
- обновляет note grid labels;
- не удаляет strokes;
- меняет воспроизведение существующего рисунка;
- не меняет BPM/quantize/instrument.

---

# 11. Scale

## 11.1. UI [CONFIRMED]

Select `Scale`.

Официально подтверждены как минимум:

- Major;
- Minor.

Для parity v1 реализовать Major + Natural Minor.

Дополнительные scale types допустимы только как расширение после режима `Original parity`.

## 11.2. Note generation

Major intervals:

`0, 2, 4, 5, 7, 9, 11`

Natural minor:

`0, 2, 3, 5, 7, 8, 10`

---

# 12. Range

## 12.1. UI [CONFIRMED, values VERIFY]

Select `Range`.

Точная номенклатура опций эталона должна быть вручную зафиксирована перед финальной реализацией.

Семантика: количество/ширина нотного диапазона, отображаемого по вертикали.

Рекомендуемая внутренняя модель:

```ts
rangeOctaves: number
```

В качестве implementation fallback: 1 / 2 / 3 octaves.

---

# 13. Octave

## 13.1. UI [CONFIRMED]

- label `Octave`;
- кнопка `-`;
- числовое значение;
- кнопка `+`.

## 13.2. Behavior

Octave выполняет транспонирование диапазона на 12 semitones за один шаг.

Ограничение следует задавать MIDI-границами audio engine, а не только UI.

Кнопки disabled при достижении границы.

---

# 14. Paper / background

## 14.1. Web UI [CONFIRMED]

Наблюдается `Paper`. Официальные screenshots также показывают отдельную cloud-button как entry control фоновой карточки.

## 14.2. Official app behavior [CONFIRMED]

Официальная версия описывает background card:

- paper;
- sky;
- user photo.

Для web parity:

- базовый `Paper`;
- архитектура background provider;
- optional `Sky`;
- optional user image upload;
- user image обрабатывается локально в браузере, если серверное хранение не требуется.

Background не влияет на звук.

---

# 15. Tune

## 15.1. UI [CONFIRMED, semantics VERIFY]

Label `Tune` + input.

Не фиксировать музыкальную семантику до ручной проверки.

Архитектура должна поддерживать глобальный tuning offset:

```ts
tuningCents: number
```

Частота с detune:

```
f2 = f * 2^(cents / 1200)
```

Если эталон окажется настроен иначе, адаптировать UI mapper без изменения DSP abstraction.

---

# 16. Tempo

## 16.1. UI [CONFIRMED]

Наблюдаются tempo inputs и кнопка `Tap`.

Требуется:

- numeric BPM control;
- range/slider control, если он присутствует в эталоне;
- Tap button;
- единое состояние BPM.

## 16.2. Tap tempo

- timestamp последних 4–8 taps;
- игнорировать явные outliers;
- BPM = 60 / median tap interval;
- min/max clamp;
- UI обновляется сразу.

Рекомендуемый range: 30–300 BPM, если parity-проверка не покажет другой диапазон.

## 16.3. Playback change

Изменение BPM во время playback применяется без полного пересоздания canvas и без заметного audio gap.

---

# 17. Quantize

## 17.1. UI [CONFIRMED]

Select `Quantize`.

## 17.2. Behavior

Quantize меняет временную позицию note-on.

Data model должен поддержать:

- Off;
- beat;
- 1/2 beat;
- 1/4 beat;
- finer subdivisions при необходимости.

Точный список UI options — [VERIFY].

Внутри хранить subdivision как beats per grid step, а не строку UI.

---

# 18. Swing

## 18.1. UI [CONFIRMED]

Select `Swing`.

## 18.2. Behavior

Swing применяется после quantization.

Он смещает every second subdivision позже относительно straight grid.

Пример модели:

```
straight: ratio 0.50
medium:   ratio 0.58
heavy:    ratio 0.66
```

Точные значения оригинала — [VERIFY].

При Quantize=Off swing либо disabled, либо не влияет на playback.

---

# 19. Metronome Click

## 19.1. UI [CONFIRMED]

`Click` + toggle `Off/On`.

## 19.2. Audio

- click синхронизирован с transport;
- первый beat цикла может иметь accent;
- click не попадает в MIDI export;
- вопрос включения click в WAV export должен соответствовать эталону [VERIFY], default для нашей версии — не включать.

---

# 20. Play / transport / loop

## 20.1. Playback

Нужны состояния:

```ts
type TransportState =
  | "stopped"
  | "playing"
  | "recording"
```

## 20.2. Loop

- рисунок трактуется как loop;
- playhead движется слева направо;
- после конца canvas возвращается в начало;
- отсутствие strokes не вызывает ошибку;
- stop возвращает playhead в start либо сохраняет позицию — согласно эталону [VERIFY];
- start должен быть sample-accurate настолько, насколько позволяет Web Audio clock.

## 20.3. Scheduling

Нельзя планировать audio через `setTimeout` как основной clock.

Использовать:

- `AudioContext.currentTime`;
- look-ahead scheduler;
- UI animation через `requestAnimationFrame`.

---

# 21. Instrument / timbre

## 21.1. Functional requirement

Каждый активный visual layer должен иметь воспроизводимый тембр.

Secondary observation указывает на возможные варианты:

- keys;
- pluck;
- bell;
- marimba;
- flute;
- strings;
- chime;
- bass;
- 8bit.

Этот перечень **не считать окончательным parity requirement**, пока не проверен непосредственно в оригинальном UI.

## 21.2. Synthesis

Допустимые реализации:

- Web Audio oscillators + envelopes;
- AudioWorklet;
- bundled legal samples.

Запрещено зависеть от network round-trip для каждой ноты.

---

# 22. MIDI input

## 22.1. UI [CONFIRMED]

`MIDI in` + On/Off.

## 22.2. Browser API

Использовать Web MIDI API при наличии:

```js
navigator.requestMIDIAccess()
```

## 22.3. States

- unsupported;
- permission-required;
- off;
- on/no devices;
- on/device connected;
- device disconnected;
- permission denied.

## 22.4. Note behavior [CONFIRMED high-level]

Оригинал описывает возможность `play a MIDI keyboard into the loop`.

Требования:

- note-on воспроизводится с минимальной задержкой;
- note-off завершает voice;
- velocity учитывается;
- channel может игнорироваться в v1;
- при записи MIDI-событие привязывается ко времени transport;
- quantize применяется согласно текущим настройкам;
- входные pitch можно либо оставить chromatic, либо привести к scale — точное behavior [VERIFY].

---

# 23. Virtual keyboard

Официальное приложение подтверждает three-octave keyboard.

Для web-версии предусмотреть optional экранную клавиатуру:

- white + black keys;
- минимум 3 октавы;
- pointer/touch;
- multi-touch;
- активная нота визуально подсвечивается;
- keyboard следует текущему octave/range;
- MIDI и virtual keyboard проходят через один `NoteInputService`.

---

# 24. WAV export

## 24.1. UI [CONFIRMED]

Button `WAV`.

## 24.2. Behavior

Экспортирует минимум один полный loop.

Рекомендуемые параметры:

- 44.1 или 48 kHz;
- PCM16 baseline;
- stereo или mono согласно audio graph;
- небольшой release tail после loop end;
- нормализация без hard clipping;
- deterministic duration.

Экспорт должен учитывать:

- BPM;
- Key/Scale;
- Octave/Range;
- quantize;
- swing;
- layer instrument;
- mute/gain;
- текущий рисунок.

---

# 25. MIDI export

## 25.1. UI [CONFIRMED]

Button `MIDI`.

## 25.2. File

Standard MIDI File.

Минимум:

- format 0 или 1;
- tempo meta event;
- note-on;
- note-off;
- velocity;
- ticks per quarter;
- loop notes в пределах одного цикла.

Если слои различаются инструментами, предпочтителен format 1 / separate tracks.

MIDI export не должен пытаться точно воспроизвести Web Audio timbre.

---

# 26. Record

## 26.1. UI [CONFIRMED]

Action `record`.

## 26.2. Behavior [CONFIRMED high-level]

Официальный changelog использует термин `take` и подтверждает, что завершенный take сохраняется в Photos **до sharing**. Это указывает на materialized media recording, а не только сохранение project state.

Для web:

- start recording;
- визуальное состояние recording;
- stop;
- capture canvas + audio при необходимости;
- отдельный audio-only fallback.

Если эталон записывает video/canvas take, реализовать через:

- `canvas.captureStream()`;
- `MediaStreamAudioDestinationNode`;
- `MediaRecorder`.

Exact container/codec depends on browser.

---

# 27. Share

## 27.1. UI [CONFIRMED]

- `share`;
- title;
- your name / handle;
- submit arrow.

## 27.2. Share entity

```ts
type SharedPiece = {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  projectVersion: number;
  settings: MusicSettings;
  layers: Layer[];
  strokes: Stroke[];
  preview?: string;
}
```

## 27.3. Validation

- title trim;
- author trim;
- sensible max lengths;
- empty author may be allowed only if parity confirms;
- offensive-content moderation is out of scope for local MVP but required for public gallery deployment.

---

# 28. Gallery

## 28.1. Existing original [CONFIRMED]

У оригинала существует публичный `/gallery`.

## 28.2. Our parity version

Gallery card:

- title;
- author;
- visual preview;
- open/play action.

Opening a shared piece must not silently overwrite unsaved local work.

Required flow:

`Open shared piece → preview/read-only or confirm replace → load editable copy`.

---

# 29. Help

## 29.1. UI [CONFIRMED]

Button `?`.

## 29.2. Contents

Help должен кратко объяснять:

1. draw;
2. X=time;
3. Y=pitch;
4. Key/Scale;
5. Range/Octave;
6. colors/layers;
7. tempo;
8. quantize;
9. swing;
10. click;
11. MIDI;
12. export;
13. record/share.

Help закрывается `×`, Escape и кликом по backdrop, если это modal.

---

# 30. Upgrade / paid feature state

Оригинальный web UI содержит `Upgrade · $4.99` и code input.

Для нашего проекта payment parity не входит в обязательный MVP.

Но компоненты должны поддерживать feature flags:

```ts
type Entitlements = {
  advancedInstrument: boolean;
  midi: boolean;
  exports: boolean;
  customBackground: boolean;
}
```

В dev/parity build все функции могут быть unlocked.

Нельзя копировать оригинальный purchase code flow.

---

# 31. Footer / service navigation

Наблюдаемые элементы:

- `Get the app`;
- creator attribution;
- Instagram link.

В нашей версии заменить на собственные brand/repository links.

Функциональную структуру можно сохранить, бренд оригинала не копировать.

---

# 32. State model

Рекомендуемая единая модель:

```ts
type MusicSettings = {
  key: string;
  scale: "major" | "minor" | string;
  octaveOffset: number;
  rangeOctaves: number;

  bpm: number;
  quantize: string | null;
  swing: number;
  metronomeEnabled: boolean;

  tuningCents: number;
  background: BackgroundConfig;

  activeLayerId: string;
}

type Project = {
  version: number;
  title: string;
  author: string;
  settings: MusicSettings;
  layers: Layer[];
  strokes: Stroke[];
}
```

Single source of truth обязателен.

Audio engine не должен читать значения напрямую из DOM.

---

# 33. Persistence

Минимум:

- autosave current draft в localStorage/IndexedDB;
- versioned schema;
- safe migration;
- восстановление после reload;
- corruption fallback.

Не сохранять raw AudioContext/AudioNode objects.

---

# 34. URL / project sharing

Для небольших проектов допустим encoded URL state.

Для production gallery предпочтительно server ID.

Share URL должен быть immutable snapshot либо явно versioned.

---

# 35. Accessibility

Минимальные требования:

- все icon-only buttons имеют `aria-label`;
- keyboard focus;
- visible focus ring;
- controls доступны Tab;
- select/input имеют label;
- состояние toggle отражается через `aria-pressed`;
- reduced-motion учитывается для playhead/animations;
- canvas имеет текстовое accessible description;
- основные операции доступны без precision pointer.

---

# 36. Keyboard shortcuts

Рекомендуемый набор:

- Space — play/stop;
- Ctrl/Cmd+Z — undo;
- Ctrl/Cmd+Shift+Z — redo;
- Escape — close dialog;
- R — record, только если фокус не находится в input;
- M — metronome toggle, optional.

Shortcuts не должны перехватываться при наборе текста.

---

# 37. Audio lifecycle

## 37.1. Browser autoplay

AudioContext создается/возобновляется после явного user gesture.

Если audio suspended:

- показывать понятное действие `Enable audio`;
- не показывать ошибку как crash.

## 37.2. Device changes

При background/foreground:

- корректно обрабатывать suspended context;
- transport state не должен "убегать" визуально относительно audio clock.

---

# 38. Performance

Цели:

- drawing: 60 FPS на типичном desktop;
- drawing: ≥ 30 FPS на mid-range mobile;
- UI event → audible response: желательно < 30 ms;
- MIDI note-on → sound: желательно < 20 ms при нормальной системе;
- canvas с 500 strokes не должен подвисать;
- playback scheduling не должен деградировать от количества raw points.

Требуется resampling/compaction strokes.

---

# 39. Error states

Явно обработать:

- Web Audio unsupported;
- AudioContext blocked/suspended;
- MIDI unsupported;
- MIDI permission denied;
- no MIDI devices;
- export failed;
- unsupported MediaRecorder codec;
- share server unavailable;
- invalid/corrupted project;
- out-of-memory при чрезмерно большом export;
- local persistence quota exceeded.

Ошибки должны быть recoverable и не очищать canvas.

---

# 40. Responsive behavior

Breakpoints не должны определять бизнес-логику.

Desktop:
- canvas + controls visible;
- advanced instrument panel может быть side/bottom sheet.

Mobile:
- canvas first;
- instrument = bottom sheet;
- export/share = separate sheet;
- keyboard может горизонтально прокручиваться;
- landscape использует максимальную ширину canvas.

---

# 41. Mapping на текущий spectrogram_writer

Ветка создана от `codex/add-musical-mode-with-piano-keys`, потому что там уже присутствуют:

- React frontend;
- музыкальный режим;
- MIDI-style note → frequency mapping;
- несколько октав;
- экранная piano keyboard;
- PCM synthesis.

Рефакторинг должен разделить существующий большой компонент на домены:

```
frontend/src/features/music/
  model/
  canvas/
  transport/
  theory/
  instruments/
  midi/
  export/
  share/
  help/

frontend/src/audio/
  AudioEngine.ts
  Transport.ts
  Scheduler.ts
  InstrumentRack.ts
  OfflineRenderer.ts
```

Backend нужен только для gallery/share/optional export processing. Live sound должен оставаться client-side.

---

# 42. Необходимые сервисные интерфейсы

## MusicTheoryService

```ts
getScaleNotes(key, scale): PitchClass[]
buildPitchRange(key, scale, octave, range): MidiNote[]
mapYToMidi(y, pitchRange): number
```

## Transport

```ts
play()
stop()
setTempo(bpm)
setLoop(startBeat, endBeat)
getPosition()
```

## StrokeCompiler

```ts
compile(strokes, settings): NoteEvent[]
```

## NoteInputService

Объединяет:

- canvas;
- virtual keyboard;
- MIDI.

## ExportService

```ts
exportWav(project): Promise<Blob>
exportMidi(project): Promise<Blob>
```

---

# 43. Event model

```ts
type NoteEvent = {
  id: string;
  layerId: string;
  midi: number;
  velocity: number;
  startBeat: number;
  durationBeats: number;
}
```

Audio renderer должен работать с `NoteEvent[]`, а не со strokes напрямую.

Это позволит одинаково экспортировать WAV и MIDI.

---

# 44. Quantize pipeline

Порядок операций:

```
stroke coordinates
→ normalized time
→ raw beat
→ quantize
→ swing
→ event merge
→ schedule
```

Swing не должен менять визуальную X-координату исходного рисунка.

---

# 45. Visual playhead

Во время playback:

- вертикальная линия или аналогичный indicator;
- движется по X;
- синхронизация от AudioContext;
- loop restart без заметного прыжка;
- при hidden tab animation может замереть, но audio scheduling продолжает работать корректно.

---

# 46. Sound continuity

При движущейся линии возможны два режима:

### Discrete-note
Каждый временной bucket создает ноту selected scale.

### Legato/glide
Соседние pitch значения могут быть связаны portamento.

Для parity default использовать discrete scale notes, поскольку grid именует ноты.

Legato можно добавить как расширение.

---

# 47. Project versioning

Каждый сохраненный/share project содержит:

```
schemaVersion: 1
```

Любые изменения структуры требуют migration.

---

# 48. Telemetry

Для локальной/частной версии telemetry не требуется.

Если приложение публикуется:

можно считать без содержимого пользовательского рисунка:

- play;
- export;
- MIDI enabled;
- share;
- errors.

Не отправлять stroke coordinates без явной необходимости/согласия.

---

# 49. Security

- uploaded background не исполняется как HTML/SVG script;
- MIME/type validation;
- gallery text escaping;
- rate limits для share API;
- generated filenames server-controlled;
- никаких API secrets во frontend bundle.

---

# 50. Acceptance criteria — Canvas

Готово, если:

- можно нарисовать минимум 20 strokes;
- mouse/touch/stylus создают одинаковый результат;
- resize не искажает normalized geometry;
- X однозначно задает position in loop;
- Y однозначно задает pitch;
- note grid соответствует реальному playback;
- undo работает;
- смена Key/Scale пересчитывает звук без потери рисунка.

---

# 51. Acceptance criteria — Transport

- play стартует после user gesture;
- loop повторяется без накопления timing drift;
- BPM меняется;
- Tap меняет BPM;
- click синхронен;
- quantize слышимо и измеримо изменяет onset;
- swing воздействует только на соответствующие subdivisions;
- stop не оставляет hanging notes.

---

# 52. Acceptance criteria — MIDI

- permission flow корректен;
- подключенная клавиша вызывает звук;
- note-off гасит звук;
- velocity учитывается;
- disconnect не ломает приложение;
- MIDI input можно выключить;
- записанные MIDI notes попадают в loop.

---

# 53. Acceptance criteria — Export

WAV:

- файл открывается стандартным player;
- duration ожидаемая;
- no clipping;
- соответствует текущему project.

MIDI:

- импортируется в DAW;
- BPM корректен;
- pitch корректен;
- note timing соответствует quantize/swing;
- note duration не нулевая.

---

# 54. Acceptance criteria — Share

- title + author валидируются;
- share не изменяет local original;
- shared project открывается;
- неизвестная schemaVersion дает понятную ошибку;
- gallery item можно прослушать/открыть.

---

# 55. Parity checklist с оригиналом

Статус на 2026-09-22. Пункты `[x]` закрыты rendered-DOM, interaction, spectral или production-browser измерениями.

- [ ] внешний порядок основных controls — functional parity есть, exact visual order еще hardening;
- [x] Key options;
- [x] Scale options;
- [x] Range options;
- [ ] Octave min/max — public entitlement state не дает изменить offset;
- [x] Paper / Sky / Photo behavior;
- [x] Tune semantics и диапазон;
- [x] Quantize option values;
- [x] Swing option values;
- [x] BPM min/max/default;
- [x] Tap меняет BPM в нашей production flow; exact averaging window reference остается внутренней деталью;
- [x] Click control + first-beat-higher reference hint;
- [x] buttons 1/2/3 = Drawing / Pixel / hidden Video mode;
- [x] Pixel geometry = 48 columns + pitch-dependent rows;
- [x] buttons •/••/••• = Bass / Drums / Arpeggio;
- [x] default Bass pattern;
- [x] default Drums triplet pattern;
- [x] default Major-pentatonic Arpeggio pattern;
- [x] custom recolor flow: 27 presets + custom + original colors;
- [x] instrument list: keys / pluck / bell / marimba / flute / strings / chime / bass / 8bit;
- [x] instrument identity отделена от color;
- [x] Grid default On;
- [x] Freehand continuous pitch behavior;
- [x] Freehand C curve + signed Key transpose measured;
- [ ] Freestyle exact semantics;
- [x] three-octave virtual keyboard;
- [x] Web MIDI input flow в нашей версии;
- [ ] exact reference MIDI input → scale/freehand mapping;
- [x] realtime loop restart без hanging notes в production smoke/domain tests;
- [x] WAV export нашей версии;
- [ ] WAV includes/excludes reference metronome click — entitlement-locked export не materialize;
- [x] MIDI export нашей версии, включая Freehand pitch bend;
- [ ] exact reference MIDI file track/channel structure — entitlement-locked export не materialize;
- [x] record output policy: request video/mp4; Chromium actual video/mp4;codecs=vp9,opus;
- [x] share title maxlength 48;
- [x] share name/handle maxlength 120;
- [x] shared-project safe-open flow в нашей версии;
- [ ] exact original gallery ownership/edit lifecycle;
- [x] mobile production layout smoke 390×844 без horizontal overflow.

Точный measured status и ограничения measurement harness находятся в
`PARITY_EVIDENCE_MATRIX.md` и `IMPLEMENTATION_STATUS.md`.

---

# 56. Фазы реализации

## Phase 1 — Core parity

- Canvas;
- strokes;
- X→time;
- Y→pitch;
- Key;
- Major/Minor;
- Range;
- Octave;
- Play/loop;
- basic instrument;
- Undo.

## Phase 2 — Rhythm

- BPM;
- Tap;
- Quantize;
- Swing;
- Click;
- playhead.

## Phase 3 — Voices/UI

- color/voice model;
- DrawingResolutionPreset 1/2/3;
- RhythmPreset •/••/••• с конфигурируемым mapping;
- instrument panel;
- background/Paper.

## Phase 4 — MIDI

- Web MIDI;
- virtual keyboard;
- loop recording.

## Phase 5 — Export

- offline WAV render;
- MIDI export.

## Phase 6 — Sharing

- record/take;
- title/author;
- share;
- gallery.

## Phase 7 — Parity hardening

- exact option values;
- mobile;
- accessibility;
- performance;
- regression suite.

---

# 57. Definition of Done

Функция считается готовой только если одновременно выполнено:

1. UX работает mouse + touch;
2. есть unit test для чистой бизнес-логики;
3. есть integration test для основного сценария;
4. нет console errors в нормальном workflow;
5. состояние сохраняется/восстанавливается;
6. изменение не ломает WAV/MIDI;
7. mobile layout не блокирует canvas;
8. behavior сверено с parity checklist.

---

# 58. Что не следует копировать из оригинала

Для clean-room реализации не копировать:

- JavaScript/source code;
- proprietary samples;
- изображения;
- logo;
- фирменные иллюстрации;
- название продукта как название нашего продукта;
- exact CSS/visual assets.

Повторяем функциональную модель и UX-паттерн, используя собственную реализацию и оформление.

---

# 59. Ключевой архитектурный принцип

**Canvas не является аудио. Canvas является редактором музыкальных событий.**

Правильная цепочка:

```
Stroke[] 
  ↓
StrokeCompiler
  ↓
NoteEvent[]
  ├──→ Realtime Audio Engine
  ├──→ Offline WAV Renderer
  ├──→ MIDI Exporter
  └──→ Share/Persistence
```

Именно эта граница позволит развивать проект дальше без повторного переписывания DSP и UI.

---

# 60. Статус Parity Audit

Первый DOM/screenshot аудит выполнен 2026-09-19. К 2026-09-22 он расширен интерактивным clean-room browser harness:

- rendered DOM;
- control state before/after;
- canvas geometry;
- Web Audio spectral measurements;
- MediaRecorder policy observation;
- production desktop/mobile browser smoke.

Актуальные результаты:

- `docs/PLAYMUSICTHEORY_PARITY_AUDIT.md`;
- `docs/PARITY_EVIDENCE_MATRIX.md`;
- `docs/IMPLEMENTATION_STATUS.md`.

Критичные старые гипотезы сняты:

- `1/2/3` = Drawing / Pixel / Video, не layers и не три pixel-density preset;
- `•/••/•••` = Bass / Drums / Arpeggio;
- exact Key/Scale/Range/Tune/Tempo/Quantize/Swing options измерены;
- Pixel geometry измерена;
- Freehand continuous-pitch curve измерена;
- Take container policy измерена;
- default accompaniment patterns измерены.

# 61. Следующий шаг hardening

Core parity уже реализован. Дальнейшая работа концентрируется на небольшом наборе объективно недоступных или еще измеряемых деталей:

1. завершить scale-dependent Arpeggio measurement;
2. определить Freestyle semantics без догадок;
3. уточнить original instrument spectra/envelopes, если black-box analyser даст устойчивые данные;
4. определить Octave min/max при доступном entitlement state;
5. проверить reference WAV metronome policy и MIDI layout, если export materialization станет доступна;
6. продолжать regression/browser/mobile hardening.

Оставшиеся VERIFY не должны менять уже стабилизированные границы:
`Stroke[] → NoteEvent[] → realtime/WAV/MIDI/share`.
