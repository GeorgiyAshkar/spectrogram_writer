const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

(async () => {

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

const browser = await puppeteer.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-gpu'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto('https://playmusictheory.net/play', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const snapshot = async (label) => {
    const state = await page.evaluate(() => {
      const info = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return {
          id,
          tag: el.tagName,
          className: el.className,
          text: (el.textContent || '').trim(),
          value: 'value' in el ? el.value : undefined,
          ariaLabel: el.getAttribute('aria-label'),
          dataTip: el.getAttribute('data-tip'),
          dataHint: el.getAttribute('data-hint'),
          hidden: el.hidden,
          display: getComputedStyle(el).display,
        };
      };

      const select = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return {
          value: el.value,
          selectedText: el.selectedOptions?.[0]?.textContent?.trim() ?? null,
          options: [...el.options].map((option) => ({
            value: option.value,
            text: option.textContent.trim(),
          })),
        };
      };

      return {
        key: select('keySel'),
        scale: select('scaleSel'),
        range: select('rangeSel'),
        quantize: select('beatSel'),
        swing: select('swingSel'),
        tune: info('tuneIn'),
        tempoRange: info('speed'),
        tempoNumber: info('bpmIn'),
        programs: ['p1', 'p2', 'p3'].map(info),
        beats: ['b1', 'b2', 'b3'].map(info),
        tools: ['pen', 'erase', 'undo', 'redo', 'clear', 'shuffle', 'recolorBtn', 'gridBtn'].map(info),
        modes: ['lockBtn', 'freeBtn', 'keyBtn'].map(info),
        backgrounds: ['sky', 'tileSky', 'tilePhoto', 'tilePlus'].map(info),
        fit: [...document.querySelectorAll('.fitopt')].map((el) => ({
          fit: el.getAttribute('data-fit'),
          className: el.className,
          ariaLabel: el.getAttribute('aria-label'),
        })),
        swatches: [...document.querySelectorAll('.swatch')].map((el) => ({
          ariaLabel: el.getAttribute('aria-label'),
          className: el.className,
          background: getComputedStyle(el).backgroundColor,
        })),
        canvas: info('c'),
      };
    });
    console.log(JSON.stringify({ label, state }));
    return state;
  };

  const domClick = async (selector) => page.evaluate((target) => {
    const element = document.querySelector(target);
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  }, selector);

  const canvasSwatchHistogram = async () => page.evaluate(() => {
    const canvas = document.getElementById('c');
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const swatches = [...document.querySelectorAll('.swatch')].map((el) => {
      const color = getComputedStyle(el).backgroundColor;
      const match = color.match(/\d+/g)?.map(Number) ?? [];
      return {
        label: el.getAttribute('aria-label') ?? '',
        rgb: match.slice(0, 3),
      };
    });
    const counts = Object.fromEntries(swatches.map((swatch) => [swatch.label, 0]));
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    for (let index = 0; index < pixels.length; index += 4) {
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      for (const swatch of swatches) {
        if (swatch.rgb[0] === r && swatch.rgb[1] === g && swatch.rgb[2] === b) {
          counts[swatch.label] += 1;
          break;
        }
      }
    }
    return counts;
  });

  const canvasDigest = async () => page.evaluate(() => {
    const canvas = document.getElementById('c');
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let hash = 2166136261 >>> 0;
    let nonTransparent = 0;
    let nonWhite = 0;
    const stride = Math.max(4, Math.floor(data.length / 25000 / 4) * 4);
    for (let i = 0; i < data.length; i += stride) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      if (a > 0) nonTransparent += 1;
      if (a > 0 && (r < 245 || g < 245 || b < 245)) nonWhite += 1;
      hash ^= r | (g << 8) | (b << 16) | (a << 24);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return { width, height, hash, nonTransparent, nonWhite };
  });

  await snapshot('initial');

  const readOctaveState = async () => page.evaluate(() => {
    const down = document.getElementById('octDown');
    const up = document.getElementById('octUp');
    const parent = down?.parentElement;
    return {
      text: parent?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      downDisabled: down instanceof HTMLButtonElement ? down.disabled : null,
      upDisabled: up instanceof HTMLButtonElement ? up.disabled : null,
    };
  });

  const octaveStates = [];
  octaveStates.push({ step: 'initial', ...(await readOctaveState()) });
  for (let i = 0; i < 12; i += 1) {
    await page.click('#octDown');
    await new Promise((resolve) => setTimeout(resolve, 30));
    octaveStates.push({ step: `down-${i + 1}`, ...(await readOctaveState()) });
  }
  for (let i = 0; i < 24; i += 1) {
    await page.click('#octUp');
    await new Promise((resolve) => setTimeout(resolve, 30));
    octaveStates.push({ step: `up-${i + 1}`, ...(await readOctaveState()) });
  }
  console.log(JSON.stringify({ label: 'octave-clamp', states: octaveStates }));


  for (const id of ['p1', 'p2', 'p3']) {
    const el = await page.$('#' + id);
    if (!el) continue;
    const visible = await el.evaluate((node) => getComputedStyle(node).display !== 'none');
    if (!visible) {
      console.log(JSON.stringify({ label: 'program-click', id, visible: false }));
      continue;
    }
    await domClick('#' + id);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const state = await page.evaluate(() => ({
      programs: ['p1', 'p2', 'p3'].map((id) => {
        const el = document.getElementById(id);
        return el ? { id, className: el.className } : null;
      }),
      canvasClass: document.getElementById('c')?.className ?? null,
      bodyClass: document.body.className,
      documentClass: document.documentElement.className,
    }));
    console.log(JSON.stringify({ label: 'program-click', id, visible: true, state }));
  }

  const gridBefore = await page.$eval('#gridBtn', (el) => el.className);
  await domClick('#gridBtn');
  await new Promise((resolve) => setTimeout(resolve, 100));
  const gridAfter = await page.$eval('#gridBtn', (el) => el.className);
  console.log(JSON.stringify({ label: 'grid-toggle', before: gridBefore, after: gridAfter }));

  const colorsBefore = await page.$$eval('.swatch', (els) => els.map((el) => getComputedStyle(el).backgroundColor));
  const canvasBeforeShuffle = await canvasDigest();
  await domClick('#shuffle');
  await new Promise((resolve) => setTimeout(resolve, 180));
  const colorsAfter = await page.$$eval('.swatch', (els) => els.map((el) => getComputedStyle(el).backgroundColor));
  const canvasAfterShuffle = await canvasDigest();
  console.log(JSON.stringify({
    label: 'shuffle',
    colorsBefore,
    colorsAfter,
    canvasBefore: canvasBeforeShuffle,
    canvasAfter: canvasAfterShuffle,
  }));

  const recolorBefore = await canvasDigest();
  const recolorHistogramBefore = await canvasSwatchHistogram();
  await domClick('#recolorBtn');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const recolorState = await page.$eval('#recolorBtn', (el) => el.className);
  await domClick('.swatch[aria-label="pluck"]');
  await new Promise((resolve) => setTimeout(resolve, 120));
  const recolorAfter = await canvasDigest();
  const recolorHistogramAfter = await canvasSwatchHistogram();
  console.log(JSON.stringify({
    label: 'recolor-existing-drawing',
    buttonClassAfterArm: recolorState,
    before: recolorBefore,
    after: recolorAfter,
    histogramBefore: recolorHistogramBefore,
    histogramAfter: recolorHistogramAfter,
  }));

  for (const id of ['lockBtn', 'freeBtn']) {
    const before = await page.$eval('#' + id, (el) => ({
      className: el.className,
      ariaLabel: el.getAttribute('aria-label'),
      display: getComputedStyle(el).display,
    }));
    const clicked = await domClick('#' + id);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const after = await page.evaluate(() => ({
      lock: {
        className: document.getElementById('lockBtn')?.className,
        ariaLabel: document.getElementById('lockBtn')?.getAttribute('aria-label'),
      },
      free: {
        className: document.getElementById('freeBtn')?.className,
        ariaLabel: document.getElementById('freeBtn')?.getAttribute('aria-label'),
      },
    }));
    console.log(JSON.stringify({ label: 'mode-click', id, clicked, before, after }));
  }

  const octaveState = async () => page.evaluate(() => {
    const down = document.getElementById('octDown');
    const up = document.getElementById('octUp');
    const parent = down?.parentElement;
    return {
      parentText: parent?.innerText?.replace(/\s+/g, ' ').trim() ?? null,
      downDisabled: down instanceof HTMLButtonElement ? down.disabled : null,
      upDisabled: up instanceof HTMLButtonElement ? up.disabled : null,
    };
  });

  const octaveInitial = await octaveState();
  for (let i = 0; i < 20; i += 1) await domClick('#octDown');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const octaveMin = await octaveState();
  for (let i = 0; i < 40; i += 1) await domClick('#octUp');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const octaveMax = await octaveState();
  console.log(JSON.stringify({ label: 'octave-bounds', initial: octaveInitial, min: octaveMin, max: octaveMax }));



  async function measureDrawVariant(label, toggleId) {
    await page.goto('https://playmusictheory.net/play', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (toggleId) {
      const toggleState = await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el) return { found: false, visible: false };
        const visible = getComputedStyle(el).display !== 'none';
        if (visible && el instanceof HTMLElement) el.click();
        return { found: true, visible };
      }, toggleId);
      if (!toggleState.found || !toggleState.visible) {
        console.log(JSON.stringify({ label: 'draw-variant-skip', variant: label, toggleId, toggleState }));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    const canvas = await page.$('#c');
    if (!canvas) throw new Error('Reference canvas not found.');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Reference canvas has no bounding box.');

    const before = await page.$eval('#c', (node) => {
      const ctx = node.getContext('2d');
      return Array.from(ctx.getImageData(0, 0, node.width, node.height).data);
    });

    const path = [];
    const steps = 28;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = box.x + box.width * (0.12 + 0.76 * t);
      const yNorm = 0.23 + 0.46 * t + 0.055 * Math.sin(t * Math.PI * 5);
      const y = box.y + box.height * yNorm;
      path.push({ x, y });
    }

    await page.mouse.move(path[0].x, path[0].y);
    await page.mouse.down();
    for (const point of path.slice(1)) {
      await page.mouse.move(point.x, point.y, { steps: 2 });
    }
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 150));

    const result = await page.$eval('#c', (node, beforePixels) => {
      const ctx = node.getContext('2d');
      const after = ctx.getImageData(0, 0, node.width, node.height).data;
      const width = node.width;
      const height = node.height;
      const changed = [];
      for (let p = 0; p < after.length; p += 4) {
        const delta =
          Math.abs(after[p] - beforePixels[p]) +
          Math.abs(after[p + 1] - beforePixels[p + 1]) +
          Math.abs(after[p + 2] - beforePixels[p + 2]) +
          Math.abs(after[p + 3] - beforePixels[p + 3]);
        if (delta > 24) {
          const pixel = p / 4;
          changed.push({ x: pixel % width, y: Math.floor(pixel / width) });
        }
      }

      if (!changed.length) return { changed: 0, samples: [] };

      const minX = Math.min(...changed.map((p) => p.x));
      const maxX = Math.max(...changed.map((p) => p.x));
      const minY = Math.min(...changed.map((p) => p.y));
      const maxY = Math.max(...changed.map((p) => p.y));
      const samples = [];
      for (let i = 0; i <= 12; i += 1) {
        const targetX = Math.round(minX + ((maxX - minX) * i) / 12);
        const ys = changed
          .filter((p) => Math.abs(p.x - targetX) <= 2)
          .map((p) => p.y);
        samples.push({
          x: targetX,
          y: ys.length ? Math.round(ys.reduce((a, b) => a + b, 0) / ys.length) : null,
          count: ys.length,
        });
      }
      return {
        changed: changed.length,
        bbox: { minX, maxX, minY, maxY },
        samples,
      };
    }, before);

    const modeState = await page.evaluate(() => ({
      freestyle: document.getElementById('lockBtn')?.className ?? null,
      freehand: document.getElementById('freeBtn')?.className ?? null,
      program: ['p1', 'p2', 'p3'].map((id) => document.getElementById(id)?.className ?? null),
    }));

    console.log(JSON.stringify({ label: 'draw-variant', variant: label, toggleId, modeState, result }));
  }

  await measureDrawVariant('default', null);
  await measureDrawVariant('freestyle', 'lockBtn');
  await measureDrawVariant('freehand', 'freeBtn');




  async function measureAudioVariant(label, toggleId) {
    const audioPage = await browser.newPage();
    await audioPage.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    await audioPage.evaluateOnNewDocument(() => {
      window.__probeAudio = [];
      window.__probeAudioSeq = 0;

      const patchContext = (Ctor) => {
        if (!Ctor?.prototype || Ctor.prototype.__parityProbePatched) return;
        const proto = Ctor.prototype;
        Object.defineProperty(proto, '__parityProbePatched', { value: true });

        const originalCreateOscillator = proto.createOscillator;
        if (typeof originalCreateOscillator === 'function') {
          proto.createOscillator = function (...args) {
            const oscillator = originalCreateOscillator.apply(this, args);
            const id = ++window.__probeAudioSeq;
            const frequency = oscillator.frequency;

            const record = (kind, value, time) => {
              window.__probeAudio.push({
                kind,
                id,
                value: Number(value),
                time: Number(time),
                type: oscillator.type,
              });
            };

            for (const method of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) {
              const original = frequency?.[method];
              if (typeof original !== 'function') continue;
              try {
                frequency[method] = function (value, time, ...rest) {
                  record('frequency-' + method, value, time);
                  return original.call(this, value, time, ...rest);
                };
              } catch {}
            }

            const originalStart = oscillator.start.bind(oscillator);
            oscillator.start = function (when = 0, ...rest) {
              record('osc-start', oscillator.frequency.value, when);
              return originalStart(when, ...rest);
            };
            return oscillator;
          };
        }

        const originalCreateBufferSource = proto.createBufferSource;
        if (typeof originalCreateBufferSource === 'function') {
          proto.createBufferSource = function (...args) {
            const source = originalCreateBufferSource.apply(this, args);
            const id = ++window.__probeAudioSeq;
            const originalStart = source.start.bind(source);
            source.start = function (when = 0, ...rest) {
              window.__probeAudio.push({
                kind: 'buffer-start',
                id,
                value: Number(source.playbackRate?.value ?? 1),
                time: Number(when),
              });
              return originalStart(when, ...rest);
            };
            return source;
          };
        }
      };

      patchContext(window.AudioContext);
      patchContext(window.webkitAudioContext);
      patchContext(window.OfflineAudioContext);
      patchContext(window.webkitOfflineAudioContext);

      const audioNodeProto = window.AudioNode?.prototype;
      if (audioNodeProto && !audioNodeProto.__parityDestinationPatched) {
        Object.defineProperty(audioNodeProto, '__parityDestinationPatched', { value: true });
        const originalConnect = audioNodeProto.connect;
        audioNodeProto.connect = function (destination, ...args) {
          try {
            if (
              destination instanceof AudioDestinationNode &&
              !window.__probeAnalyser &&
              this.context?.createAnalyser
            ) {
              const analyser = this.context.createAnalyser();
              analyser.fftSize = 8192;
              analyser.smoothingTimeConstant = 0;
              const silent = this.context.createGain();
              silent.gain.value = 0;
              originalConnect.call(this, analyser);
              originalConnect.call(analyser, silent);
              originalConnect.call(silent, destination);
              window.__probeAnalyser = analyser;
            }
          } catch {}
          return originalConnect.call(this, destination, ...args);
        };
      }
    });

    try {
      await audioPage.goto('https://playmusictheory.net/play', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, 600));

      if (toggleId) {
        await audioPage.evaluate((id) => {
          const el = document.getElementById(id);
          if (el instanceof HTMLElement) el.click();
        }, toggleId);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const canvas = await audioPage.$('#c');
      const box = await canvas?.boundingBox();
      if (!box) throw new Error('Audio probe canvas unavailable.');

      const points = [];
      const steps = 24;
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        points.push({
          x: box.x + box.width * (0.12 + 0.76 * t),
          y: box.y + box.height * (0.17 + 0.63 * t),
        });
      }

      await audioPage.mouse.move(points[0].x, points[0].y);
      await audioPage.mouse.down();
      for (const point of points.slice(1)) {
        await audioPage.mouse.move(point.x, point.y, { steps: 2 });
      }
      await audioPage.mouse.up();
      await new Promise((resolve) => setTimeout(resolve, 120));

      const playVisible = await audioPage.$eval('#play', (el) => getComputedStyle(el).display !== 'none');
      if (playVisible) {
        await audioPage.click('#play');
        await new Promise((resolve) => setTimeout(resolve, 1600));
      }

      const result = await audioPage.evaluate(async () => {
        const events = window.__probeAudio ?? [];
        const frequencyEvents = events.filter((event) =>
          String(event.kind).startsWith('frequency-') || event.kind === 'osc-start'
        );
        const values = frequencyEvents
          .map((event) => Number(event.value))
          .filter((value) => Number.isFinite(value) && value > 0);
        const unique = [...new Set(values.map((value) => Math.round(value * 1000) / 1000))];

        const spectralPeaks = [];
        const analyser = window.__probeAnalyser;
        if (analyser) {
          const bins = new Float32Array(analyser.frequencyBinCount);
          for (let sample = 0; sample < 28; sample += 1) {
            analyser.getFloatFrequencyData(bins);
            const candidates = [];
            for (let i = 1; i < bins.length; i += 1) {
              const db = bins[i];
              if (!Number.isFinite(db) || db < -90) continue;
              candidates.push({
                hz: (i * analyser.context.sampleRate) / analyser.fftSize,
                db,
              });
            }
            candidates.sort((a, b) => b.db - a.db);
            spectralPeaks.push(
              candidates.slice(0, 8).map((item) => ({
                hz: Math.round(item.hz * 10) / 10,
                db: Math.round(item.db * 10) / 10,
              })),
            );
            await new Promise((resolve) => setTimeout(resolve, 35));
          }
        }

        const peakFrequencySet = [...new Set(
          spectralPeaks.flat().map((item) => item.hz),
        )].sort((a, b) => a - b);

        return {
          totalEvents: events.length,
          oscillatorEvents: frequencyEvents.length,
          bufferStarts: events.filter((event) => event.kind === 'buffer-start').length,
          uniqueFrequencies: unique.slice(0, 80),
          analyserAvailable: Boolean(analyser),
          peakFrequencySet: peakFrequencySet.slice(0, 120),
          spectralPeaks: spectralPeaks.slice(0, 16),
          firstEvents: events.slice(0, 60),
          modeState: {
            freestyle: document.getElementById('lockBtn')?.className ?? null,
            freehand: document.getElementById('freeBtn')?.className ?? null,
          },
        };
      });

      console.log(JSON.stringify({ label: 'audio-variant', variant: label, toggleId, result }));
    } finally {
      await audioPage.close();
    }
  }

  await measureAudioVariant('default', null);
  await measureAudioVariant('freestyle', 'lockBtn');
  await measureAudioVariant('freehand', 'freeBtn');




  async function measureBacktrackVariant(label, freestyle) {
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    try {
      await page2.goto('https://playmusictheory.net/play', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, 600));

      if (freestyle) {
        await page2.evaluate(() => {
          const el = document.getElementById('lockBtn');
          if (el instanceof HTMLElement) el.click();
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const canvas = await page2.$('#c');
      const box = await canvas?.boundingBox();
      if (!box) throw new Error('Backtrack probe canvas unavailable.');

      const anchors = [
        { x: 0.15, y: 0.25 },
        { x: 0.68, y: 0.43 },
        { x: 0.34, y: 0.66 },
        { x: 0.86, y: 0.78 },
      ];

      const points = [];
      for (let segment = 0; segment < anchors.length - 1; segment += 1) {
        const a = anchors[segment];
        const b = anchors[segment + 1];
        for (let i = segment === 0 ? 0 : 1; i <= 20; i += 1) {
          const t = i / 20;
          points.push({
            x: box.x + box.width * (a.x + (b.x - a.x) * t),
            y: box.y + box.height * (a.y + (b.y - a.y) * t),
          });
        }
      }

      await page2.mouse.move(points[0].x, points[0].y);
      await page2.mouse.down();
      for (const point of points.slice(1)) {
        await page2.mouse.move(point.x, point.y, { steps: 1 });
      }
      await page2.mouse.up();
      await new Promise((resolve) => setTimeout(resolve, 140));

      const result = await page2.$eval('#c', (node) => {
        const data = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
        let hash = 2166136261;
        let nonWhite = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a > 0 && (r < 245 || g < 245 || b < 245)) nonWhite += 1;
          hash ^= r; hash = Math.imul(hash, 16777619);
          hash ^= g; hash = Math.imul(hash, 16777619);
          hash ^= b; hash = Math.imul(hash, 16777619);
          hash ^= a; hash = Math.imul(hash, 16777619);
        }
        return {
          width: node.width,
          height: node.height,
          hash: hash >>> 0,
          nonWhite,
          freestyleClass: document.getElementById('lockBtn')?.className ?? null,
        };
      });

      console.log(JSON.stringify({
        label: 'backtrack-variant',
        variant: label,
        freestyle,
        result,
      }));
    } finally {
      await page2.close();
    }
  }

  await measureBacktrackVariant('default', false);
  await measureBacktrackVariant('freestyle', true);




  const freestyleControlState = async () => page.evaluate(() => {
    const inspect = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        id,
        tag: el.tagName,
        className: el.className,
        value: 'value' in el ? el.value : undefined,
        disabled: 'disabled' in el ? Boolean(el.disabled) : undefined,
        readOnly: 'readOnly' in el ? Boolean(el.readOnly) : undefined,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        display: style.display,
        visibility: style.visibility,
        ariaDisabled: el.getAttribute('aria-disabled'),
      };
    };

    return {
      freestyle: inspect('lockBtn'),
      freehand: inspect('freeBtn'),
      key: inspect('keySel'),
      scale: inspect('scaleSel'),
      range: inspect('rangeSel'),
      octaveDown: inspect('octDown'),
      octaveUp: inspect('octUp'),
      octaveCanvas: inspect('octave'),
      quantize: inspect('beatSel'),
      swing: inspect('swingSel'),
      tempo: inspect('speed'),
      tune: inspect('tuneIn'),
      piano: inspect('keys'),
      keyButton: inspect('keyBtn'),
      program1: inspect('p1'),
      program2: inspect('p2'),
      bass: inspect('b1'),
      drums: inspect('b2'),
      arpeggio: inspect('b3'),
    };
  });

  await page.goto('https://playmusictheory.net/play', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const freestyleBefore = await freestyleControlState();
  await page.evaluate(() => {
    const el = document.getElementById('lockBtn');
    if (el instanceof HTMLElement) el.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
  const freestyleAfter = await freestyleControlState();
  console.log(JSON.stringify({
    label: 'freestyle-control-state',
    before: freestyleBefore,
    after: freestyleAfter,
  }));


  await snapshot('final');
} finally {
  await browser.close();
}

})().catch((error) => {
  console.error(error);
  process.exit(1);
});
