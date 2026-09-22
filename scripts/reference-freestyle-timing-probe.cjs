const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    const audioNodeProto = window.AudioNode?.prototype;
    if (!audioNodeProto || audioNodeProto.__freestyleTimingPatched) return;
    Object.defineProperty(audioNodeProto, '__freestyleTimingPatched', { value: true });

    const originalConnect = audioNodeProto.connect;
    audioNodeProto.connect = function (destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__freestyleAnalyser &&
          this.context?.createAnalyser
        ) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0;

          const silent = this.context.createGain();
          silent.gain.value = 0;

          originalConnect.call(this, analyser);
          originalConnect.call(analyser, silent);
          originalConnect.call(silent, destination);
          window.__freestyleAnalyser = analyser;
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

async function setFreestyle(page, enabled) {
  await page.evaluate((next) => {
    const el = document.getElementById('lockBtn');
    if (!(el instanceof HTMLElement)) return;
    const on = el.classList.contains('on');
    if (on !== next) el.click();
  }, enabled);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function clearDrawing(page) {
  await page.evaluate(() => {
    const clear = document.getElementById('clear');
    if (clear instanceof HTMLElement) clear.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function ensureStopped(page) {
  await page.evaluate(() => {
    const play = document.getElementById('play');
    if (!(play instanceof HTMLElement)) return;
    if (play.classList.contains('on')) play.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function drawShortStroke(page, xNorm, yNorm = 0.48) {
  const canvas = await page.$('#c');
  const box = await canvas?.boundingBox();
  if (!box) throw new Error('Reference canvas unavailable.');

  const x0 = box.x + box.width * xNorm;
  const x1 = box.x + box.width * Math.min(0.99, xNorm + 0.018);
  const y = box.y + box.height * yNorm;

  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i += 1) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 6, y);
  }
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function measureOnset(page) {
  await page.evaluate(() => {
    window.__freestyleTiming = [];
    const analyser = window.__freestyleAnalyser;
    if (!analyser) return;

    const data = new Float32Array(analyser.fftSize);
    const started = performance.now();
    const sample = () => {
      analyser.getFloatTimeDomainData(data);
      let sumSq = 0;
      for (let i = 0; i < data.length; i += 1) {
        sumSq += data[i] * data[i];
      }
      const rms = Math.sqrt(sumSq / data.length);
      window.__freestyleTiming.push({
        ms: performance.now() - started,
        rms,
      });
      if (performance.now() - started < 1250) {
        window.setTimeout(sample, 4);
      }
    };
    sample();

    const play = document.getElementById('play');
    if (play instanceof HTMLElement) play.click();
  });

  await new Promise((resolve) => setTimeout(resolve, 1350));

  const result = await page.evaluate(() => {
    const samples = window.__freestyleTiming ?? [];
    const baseline = samples
      .filter((entry) => entry.ms < 120)
      .map((entry) => entry.rms);
    const baselineMax = baseline.length ? Math.max(...baseline) : 0;
    const threshold = Math.max(0.0015, baselineMax * 4);

    const onset = samples.find((entry) => entry.ms > 120 && entry.rms > threshold) ?? null;
    const peak = samples.reduce(
      (best, entry) => entry.rms > best.rms ? entry : best,
      { ms: 0, rms: 0 },
    );
    return {
      threshold,
      onsetMs: onset ? Math.round(onset.ms * 10) / 10 : null,
      peakMs: Math.round(peak.ms * 10) / 10,
      peakRms: Math.round(peak.rms * 1e6) / 1e6,
      sampleCount: samples.length,
      freestyleClass: document.getElementById('lockBtn')?.className ?? null,
      quantize: document.getElementById('beatSel')?.value ?? null,
      bpm: document.getElementById('speed')?.value ?? null,
    };
  });

  await ensureStopped(page);
  return result;
}

async function measureCase(browser, freestyle, xNorm) {
  const page = await createPage(browser);
  try {
    await ensureStopped(page);
    await clearDrawing(page);
    await setFreestyle(page, freestyle);
    await drawShortStroke(page, xNorm);
    const runs = [];
    for (let i = 0; i < 3; i += 1) {
      runs.push(await measureOnset(page));
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return { freestyle, xNorm, runs };
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
    const results = [];
    for (const xNorm of [0.19, 0.23, 0.29]) {
      results.push(await measureCase(browser, false, xNorm));
      results.push(await measureCase(browser, true, xNorm));
    }

    console.log(JSON.stringify({
      label: 'freestyle-onset-timing',
      results,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
