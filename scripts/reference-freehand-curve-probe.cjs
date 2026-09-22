const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

async function createProbePage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    const audioNodeProto = window.AudioNode?.prototype;
    if (!audioNodeProto || audioNodeProto.__freehandCurvePatched) return;

    Object.defineProperty(audioNodeProto, '__freehandCurvePatched', { value: true });
    const originalConnect = audioNodeProto.connect;

    audioNodeProto.connect = function (destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__freehandAnalyser &&
          this.context?.createAnalyser
        ) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 16384;
          analyser.smoothingTimeConstant = 0.12;

          const silent = this.context.createGain();
          silent.gain.value = 0;

          originalConnect.call(this, analyser);
          originalConnect.call(analyser, silent);
          originalConnect.call(silent, destination);
          window.__freehandAnalyser = analyser;
        }
      } catch {}

      return originalConnect.call(this, destination, ...args);
    };
  });

  await page.goto('https://playmusictheory.net/play', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
  return page;
}

async function setReferenceSettings(page, settings) {
  await page.evaluate((next) => {
    const setSelect = (id, value) => {
      const el = document.getElementById(id);
      if (!(el instanceof HTMLSelectElement)) return;
      el.value = String(value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    if (next.key !== undefined) setSelect('keySel', next.key);
    if (next.scale !== undefined) setSelect('scaleSel', next.scale);
    if (next.range !== undefined) setSelect('rangeSel', next.range);

    const free = document.getElementById('freeBtn');
    if (free instanceof HTMLElement && !free.classList.contains('on')) {
      free.click();
    }
  }, settings);

  await new Promise((resolve) => setTimeout(resolve, 120));
}

async function clearReferenceDrawing(page) {
  await page.evaluate(() => {
    const clear = document.getElementById('clear');
    if (clear instanceof HTMLElement) clear.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function drawFlatStroke(page, yNorm) {
  const canvas = await page.$('#c');
  const box = await canvas?.boundingBox();
  if (!box) throw new Error('Reference canvas unavailable.');

  const y = box.y + box.height * yNorm;
  const x0 = box.x + box.width * 0.08;
  const x1 = box.x + box.width * 0.92;

  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 36; i += 1) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 36, y);
  }
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function sampleFundamental(page) {
  await page.evaluate(() => {
    const play = document.getElementById('play');
    if (play instanceof HTMLElement) play.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 420));

  const result = await page.evaluate(async () => {
    const analyser = window.__freehandAnalyser;
    if (!analyser) return { analyserAvailable: false };

    const bins = new Float32Array(analyser.frequencyBinCount);
    const strongestPerFrame = [];

    for (let frame = 0; frame < 10; frame += 1) {
      analyser.getFloatFrequencyData(bins);
      let bestIndex = -1;
      let bestDb = -Infinity;

      for (let i = 1; i < bins.length - 1; i += 1) {
        const db = bins[i];
        if (!Number.isFinite(db) || db < -75) continue;
        if (db < bins[i - 1] || db < bins[i + 1]) continue;
        if (db > bestDb) {
          bestDb = db;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        strongestPerFrame.push({
          hz: (bestIndex * analyser.context.sampleRate) / analyser.fftSize,
          db: bestDb,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 28));
    }

    const frequencies = strongestPerFrame
      .map((entry) => entry.hz)
      .filter((value) => Number.isFinite(value) && value > 40)
      .sort((a, b) => a - b);

    const median = frequencies.length
      ? frequencies[Math.floor(frequencies.length / 2)]
      : null;

    return {
      analyserAvailable: true,
      sampleRate: analyser.context.sampleRate,
      fftSize: analyser.fftSize,
      binHz: analyser.context.sampleRate / analyser.fftSize,
      medianHz: median == null ? null : Math.round(median * 100) / 100,
      frameHz: frequencies.map((value) => Math.round(value * 100) / 100),
    };
  });

  await page.evaluate(() => {
    const play = document.getElementById('play');
    if (play instanceof HTMLElement) play.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 80));

  return result;
}

async function measureCase(browser, settings) {
  const page = await createProbePage(browser);
  try {
    await setReferenceSettings(page, settings);

    const measurements = [];
    for (const y of settings.ys ?? [0.02, 0.5, 0.98]) {
      await clearReferenceDrawing(page);
      await drawFlatStroke(page, y);
      const result = await sampleFundamental(page);
      measurements.push({ y, result });
    }

    const state = await page.evaluate(() => ({
      key: document.getElementById('keySel')?.value ?? null,
      scale: document.getElementById('scaleSel')?.value ?? null,
      range: document.getElementById('rangeSel')?.value ?? null,
      freehandClass: document.getElementById('freeBtn')?.className ?? null,
    }));

    return {
      settings,
      state,
      measurements,
    };
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });

  try {
    const cases = [
      { name: 'C-pentatonic-range1', key: '0', scale: 'pentatonic', range: '1' },
      { name: 'C-pentatonic-range3', key: '0', scale: 'pentatonic', range: '3' },
      { name: 'D-pentatonic-range3', key: '2', scale: 'pentatonic', range: '3' },
      { name: 'Fsharp-pentatonic-range3', key: '6', scale: 'pentatonic', range: '3', ys: [0.5] },
      { name: 'G-pentatonic-range3', key: '7', scale: 'pentatonic', range: '3', ys: [0.5] },
      { name: 'A-pentatonic-range3', key: '9', scale: 'pentatonic', range: '3', ys: [0.5] },
      { name: 'Bb-pentatonic-range3', key: '10', scale: 'pentatonic', range: '3' },
      { name: 'B-pentatonic-range3', key: '11', scale: 'pentatonic', range: '3', ys: [0.5] },
      { name: 'C-major-range3', key: '0', scale: 'major', range: '3', ys: [0.5] },
      { name: 'C-minor-range3', key: '0', scale: 'natural', range: '3', ys: [0.5] },
      { name: 'C-blues-range3', key: '0', scale: 'blues', range: '3', ys: [0.5] },
    ];

    const measurements = [];
    for (const settings of cases) {
      measurements.push(await measureCase(browser, settings));
    }

    console.log(JSON.stringify({
      label: 'freehand-setting-dependence',
      measurements,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
