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

async function measureY(browser, yNorm) {
  const page = await createProbePage(browser);
  try {
    await page.evaluate(() => {
      const free = document.getElementById('freeBtn');
      if (free instanceof HTMLElement) free.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

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

    const result = await page.evaluate(async () => {
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
    const measurements = [];
    for (const y of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      measurements.push(await measureY(browser, y));
    }
    console.log(JSON.stringify({ label: 'freehand-y-frequency-curve', measurements }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
