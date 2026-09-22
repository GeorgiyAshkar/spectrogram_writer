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
          analyser.smoothingTimeConstant = 0.15;
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

async function measureY(browser, yNorm, freehand) {
  const page = await createProbePage(browser);
  try {
    if (freehand) {
      await page.evaluate(() => {
        const free = document.getElementById('freeBtn');
        if (free instanceof HTMLElement) free.click();
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const canvas = await page.$('#c');
    const box = await canvas?.boundingBox();
    if (!box) throw new Error('Reference canvas unavailable.');

    const y = box.y + box.height * yNorm;
    const x0 = box.x + box.width * 0.04;
    const x1 = box.x + box.width * 0.96;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    for (let i = 1; i <= 64; i += 1) {
      await page.mouse.move(x0 + ((x1 - x0) * i) / 64, y);
    }
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 100));

    await page.click('#play');
    await new Promise((resolve) => setTimeout(resolve, 500));

    const result = await page.evaluate

async function measureYWithSettings(browser, yNorm, settings) {
  const page = await createProbePage(browser);
  try {
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
      if (free instanceof HTMLElement && !free.classList.contains('on')) free.click();
    }, settings);
    await new Promise((resolve) => setTimeout(resolve, 180));

    const canvas = await page.$('#c');
    const box = await canvas?.boundingBox();
    if (!box) throw new Error('Reference canvas unavailable.');

    const y = box.y + box.height * yNorm;
    const x0 = box.x + box.width * 0.04;
    const x1 = box.x + box.width * 0.96;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    for (let i = 1; i <= 64; i += 1) {
      await page.mouse.move(x0 + ((x1 - x0) * i) / 64, y);
    }
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await page.click('#play');
    await new Promise((resolve) => setTimeout(resolve, 500));

    const result = await page.evaluate(() => {
      const analyser = window.__freehandAnalyser;
      if (!analyser) return { analyserAvailable: false };
      const bins = new Float32Array(analyser.frequencyBinCount);
      const counts = new Map();
      for (let frame = 0; frame < 12; frame += 1) {
        analyser.getFloatFrequencyData(bins);
        const peaks = [];
        for (let i = 1; i < bins.length - 1; i += 1) {
          const db = bins[i];
          if (!Number.isFinite(db) || db < -80) continue;
          if (db < bins[i - 1] || db < bins[i + 1]) continue;
          peaks.push({ hz: (i * analyser.context.sampleRate) / analyser.fftSize, db });
        }
        peaks.sort((a, b) => b.db - a.db);
        for (const peak of peaks.slice(0, 6)) {
          if (peak.hz < 40) continue;
          const hz = Math.round(peak.hz * 100) / 100;
          const key = String(hz);
          const current = counts.get(key) ?? { hz, count: 0, bestDb: -Infinity };
          current.count += 1;
          current.bestDb = Math.max(current.bestDb, peak.db);
          counts.set(key, current);
        }
      }
      const candidates = [...counts.values()]
        .sort((a, b) => b.count - a.count || b.bestDb - a.bestDb || a.hz - b.hz);
      return {
        analyserAvailable: true,
        strongestStable: candidates.slice(0, 8),
      };
    });

    const state = await page.evaluate(() => ({
      key: document.getElementById('keySel')?.value ?? null,
      scale: document.getElementById('scaleSel')?.value ?? null,
      range: document.getElementById('rangeSel')?.value ?? null,
      freehandClass: document.getElementById('freeBtn')?.className ?? null,
    }));

    return { y: yNorm, settings, state, result };
  } finally {
    await page.close();
  }
}

(async () => {
      const analyser = window.__freehandAnalyser;
      if (!analyser) return { analyserAvailable: false };

      const bins = new Float32Array(analyser.frequencyBinCount);
      const frames = [];
      for (let frame = 0; frame < 12; frame += 1) {
        analyser.getFloatFrequencyData(bins);
        const peaks = [];
        for (let i = 1; i < bins.length - 1; i += 1) {
          const db = bins[i];
          if (!Number.isFinite(db) || db < -80) continue;
          if (db < bins[i - 1] || db < bins[i + 1]) continue;
          peaks.push({
            hz: (i * analyser.context.sampleRate) / analyser.fftSize,
            db,
          });
        }
        peaks.sort((a, b) => b.db - a.db);
        frames.push(peaks.slice(0, 12).map((p) => ({
          hz: Math.round(p.hz * 100) / 100,
          db: Math.round(p.db * 10) / 10,
        })));
        await new Promise((resolve) => setTimeout(resolve, 35));
      }

      const strongest = frames
        .flat()
        .sort((a, b) => b.db - a.db)
        .slice(0, 24);
      const lowCandidates = strongest
        .filter((p) => p.hz > 40)
        .sort((a, b) => a.hz - b.hz);
      return {
        analyserAvailable: true,
        sampleRate: analyser.context.sampleRate,
        strongest: strongest.slice(0, 16),
        lowestStrong: lowCandidates.slice(0, 8),
      };
    });

    return {
      y: yNorm,
      freehand,
      freehandClass: await page.$eval('#freeBtn', (el) => el.className),
      result,
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
    const freehandMeasurements = [];
    const discreteMeasurements = [];
    for (const y of [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98]) {
      freehandMeasurements.push(await measureY(browser, y, true));
      discreteMeasurements.push(await measureY(browser, y, false));
    }
    console.log(JSON.stringify({
      label: 'pitch-y-frequency-curve',
      freehandMeasurements,
      discreteMeasurements,
    }));

    const freehandSettingCases = [];
    const cases = [
      { name: 'C-range1', key: '0', range: '1' },
      { name: 'C-range2', key: '0', range: '2' },
      { name: 'C-range3', key: '0', range: '3' },
      { name: 'D-range3', key: '2', range: '3' },
      { name: 'Fsharp-range3', key: '6', range: '3' },
      { name: 'Bb-range3', key: '10', range: '3' },
    ];
    for (const settings of cases) {
      for (const y of [0.02, 0.5, 0.98]) {
        freehandSettingCases.push(
          await measureYWithSettings(browser, y, settings),
        );
      }
    }
    console.log(JSON.stringify({
      label: 'freehand-setting-dependence',
      measurements: freehandSettingCases,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
