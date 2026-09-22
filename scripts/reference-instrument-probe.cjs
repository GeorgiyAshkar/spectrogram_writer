const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

const instruments = ['keys', 'pluck', 'bell', 'marimba', 'flute', 'strings', 'chime', 'bass', '8bit'];

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    const proto = window.AudioNode?.prototype;
    if (!proto || proto.__instrumentProbeV2Patched) return;
    Object.defineProperty(proto, '__instrumentProbeV2Patched', { value: true });

    const originalConnect = proto.connect;
    proto.connect = function (destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__instrumentAnalyserV2 &&
          this.context?.createAnalyser
        ) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 16384;
          analyser.smoothingTimeConstant = 0.04;

          const silent = this.context.createGain();
          silent.gain.value = 0;

          originalConnect.call(this, analyser);
          originalConnect.call(analyser, silent);
          originalConnect.call(silent, destination);
          window.__instrumentAnalyserV2 = analyser;
        }
      } catch {}

      return originalConnect.call(this, destination, ...args);
    };
  });

  await page.goto('https://playmusictheory.net/play', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await new Promise((resolve) => setTimeout(resolve, 550));
  return page;
}

async function drawFlatLine(page) {
  const canvas = await page.$('#c');
  await canvas?.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'center' }));
  await new Promise((resolve) => setTimeout(resolve, 80));
  const box = await canvas?.boundingBox();
  if (!box) throw new Error('Reference canvas unavailable.');

  const y = box.y + box.height * 0.5;
  const x0 = box.x + box.width * 0.08;
  const x1 = box.x + box.width * 0.92;

  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 36; i += 1) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 36, y, { steps: 1 });
  }
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function measure(browser, instrument) {
  const page = await createPage(browser);

  try {
    await page.evaluate((id) => {
      const clear = document.getElementById('clear');
      if (clear instanceof HTMLElement) clear.click();

      const swatch = [...document.querySelectorAll('.swatch')].find(
        (el) => el.getAttribute('aria-label') === id,
      );
      if (swatch instanceof HTMLElement) swatch.click();

      const play = document.getElementById('play');
      if (play instanceof HTMLElement && play.classList.contains('on')) play.click();
    }, instrument);

    await drawFlatLine(page);

    const canvasSignal = await page.$eval('#c', (canvas) => {
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonTransparent = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) nonTransparent += 1;
      }
      return {
        width: canvas.width,
        height: canvas.height,
        nonTransparent,
      };
    });

    await page.evaluate(() => {
      const analyser = window.__instrumentAnalyserV2;
      window.__instrumentFramesV2 = [];
      if (!analyser) return;

      const freq = new Float32Array(analyser.frequencyBinCount);
      const time = new Float32Array(analyser.fftSize);
      const started = performance.now();

      const sample = () => {
        analyser.getFloatFrequencyData(freq);
        analyser.getFloatTimeDomainData(time);

        let sumSq = 0;
        for (let i = 0; i < time.length; i += 1) sumSq += time[i] * time[i];
        const rms = Math.sqrt(sumSq / time.length);

        const peaks = [];
        for (let i = 2; i < freq.length - 1; i += 1) {
          const db = freq[i];
          if (!Number.isFinite(db) || db < -92) continue;
          if (db < freq[i - 1] || db < freq[i + 1]) continue;
          const hz = (i * analyser.context.sampleRate) / analyser.fftSize;
          if (hz < 70 || hz > 7000) continue;
          peaks.push({ hz, db });
        }
        peaks.sort((a, b) => b.db - a.db);

        window.__instrumentFramesV2.push({
          ms: performance.now() - started,
          rms,
          peaks: peaks.slice(0, 24),
        });

        if (performance.now() - started < 1550) {
          window.setTimeout(sample, 8);
        }
      };

      sample();
      const play = document.getElementById('play');
      if (play instanceof HTMLElement) play.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 1650));

    const result = await page.evaluate(() => {
      const analyser = window.__instrumentAnalyserV2;
      const frames = window.__instrumentFramesV2 ?? [];
      if (!analyser) return { analyserAvailable: false };

      const active = frames.filter((frame) => frame.rms > 0.001 && frame.peaks.length > 0);
      const peakFrame = active.reduce(
        (best, frame) => frame.rms > (best?.rms ?? -Infinity) ? frame : best,
        null,
      );

      const representative =
        active[Math.min(active.length - 1, Math.floor(active.length * 0.28))] ??
        peakFrame ??
        frames[0] ??
        null;

      let fundamental = null;
      if (representative?.peaks?.length) {
        const strongestDb = representative.peaks[0].db;
        fundamental = representative.peaks
          .filter((peak) => peak.db >= strongestDb - 28)
          .sort((a, b) => a.hz - b.hz)[0] ?? representative.peaks[0];
      }

      const harmonics = [];
      if (fundamental && representative) {
        for (let n = 1; n <= 10; n += 1) {
          const target = fundamental.hz * n;
          const nearest = representative.peaks
            .map((peak) => ({ ...peak, delta: Math.abs(peak.hz - target) }))
            .sort((a, b) => a.delta - b.delta)[0];

          if (nearest && nearest.delta <= Math.max(8, target * 0.02)) {
            harmonics.push({
              n,
              hz: Math.round(nearest.hz * 100) / 100,
              db: Math.round(nearest.db * 10) / 10,
              relativeDb: Math.round((nearest.db - fundamental.db) * 10) / 10,
            });
          }
        }
      }

      const activeStart = active[0]?.ms ?? null;
      const peakMs = peakFrame?.ms ?? null;
      const peakRms = peakFrame?.rms ?? 0;
      const decay = active
        .filter((frame) => peakMs == null || frame.ms >= peakMs)
        .filter((_, index) => index % 4 === 0)
        .slice(0, 24)
        .map((frame) => ({
          msFromPeak: peakMs == null ? null : Math.round((frame.ms - peakMs) * 10) / 10,
          rmsRatio: peakRms > 0 ? Math.round((frame.rms / peakRms) * 1000) / 1000 : null,
        }));

      return {
        analyserAvailable: true,
        sampleRate: analyser.context.sampleRate,
        fftSize: analyser.fftSize,
        activeFrames: active.length,
        activeStartMs: activeStart == null ? null : Math.round(activeStart * 10) / 10,
        peakMs: peakMs == null ? null : Math.round(peakMs * 10) / 10,
        peakRms: Math.round(peakRms * 1e6) / 1e6,
        fundamental: fundamental
          ? {
              hz: Math.round(fundamental.hz * 100) / 100,
              db: Math.round(fundamental.db * 10) / 10,
              midi: Math.round((69 + 12 * Math.log2(fundamental.hz / 440)) * 100) / 100,
            }
          : null,
        harmonics,
        decay,
        swatchClass: [...document.querySelectorAll('.swatch')]
          .find((el) => el.getAttribute('aria-label') === window.__instrumentProbeId)
          ?.className ?? null,
      };
    });

    console.log(JSON.stringify({
      label: 'instrument-spectrum-v2',
      instrument,
      canvasSignal,
      result,
    }));
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
    for (const instrument of instruments) {
      await measure(browser, instrument);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
