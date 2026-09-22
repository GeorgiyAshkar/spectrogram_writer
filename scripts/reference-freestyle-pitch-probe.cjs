const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    const proto = window.AudioNode?.prototype;
    if (!proto || proto.__freestylePitchPatched) return;
    Object.defineProperty(proto, '__freestylePitchPatched', { value: true });

    const originalConnect = proto.connect;
    proto.connect = function (destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__freestylePitchAnalyser &&
          this.context?.createAnalyser
        ) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 16384;
          analyser.smoothingTimeConstant = 0.08;
          const silent = this.context.createGain();
          silent.gain.value = 0;
          originalConnect.call(this, analyser);
          originalConnect.call(analyser, silent);
          originalConnect.call(silent, destination);
          window.__freestylePitchAnalyser = analyser;
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

async function measure(browser, freestyle, yNorm) {
  const page = await createPage(browser);
  try {
    await page.evaluate((enabled) => {
      const clear = document.getElementById('clear');
      if (clear instanceof HTMLElement) clear.click();

      const freehand = document.getElementById('freeBtn');
      if (freehand instanceof HTMLElement && freehand.classList.contains('on')) freehand.click();

      const freestyleBtn = document.getElementById('lockBtn');
      if (freestyleBtn instanceof HTMLElement) {
        const on = freestyleBtn.classList.contains('on');
        if (on !== enabled) freestyleBtn.click();
      }

      const play = document.getElementById('play');
      if (play instanceof HTMLElement && play.classList.contains('on')) play.click();
    }, freestyle);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const canvas = await page.$('#c');
    const box = await canvas?.boundingBox();
    if (!box) throw new Error('Reference canvas unavailable.');

    const y = box.y + box.height * yNorm;
    const x0 = box.x + box.width * 0.08;
    const x1 = box.x + box.width * 0.92;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    for (let i = 1; i <= 30; i += 1) {
      await page.mouse.move(x0 + ((x1 - x0) * i) / 30, y);
    }
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 80));

    await page.evaluate(() => {
      const play = document.getElementById('play');
      if (play instanceof HTMLElement) play.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 430));

    const result = await page.evaluate(() => {
      const analyser = window.__freestylePitchAnalyser;
      if (!analyser) return { analyserAvailable: false };

      const bins = new Float32Array(analyser.frequencyBinCount);
      const values = [];
      for (let frame = 0; frame < 8; frame += 1) {
        analyser.getFloatFrequencyData(bins);
        let strongest = null;
        for (let i = 1; i < bins.length - 1; i += 1) {
          const db = bins[i];
          if (!Number.isFinite(db) || db < -70) continue;
          if (db < bins[i - 1] || db < bins[i + 1]) continue;
          const hz = (i * analyser.context.sampleRate) / analyser.fftSize;
          if (hz < 80 || hz > 1600) continue;
          if (!strongest || db > strongest.db) strongest = { hz, db };
        }
        if (strongest) values.push(strongest.hz);
      }

      values.sort((a, b) => a - b);
      const median = values.length ? values[Math.floor(values.length / 2)] : null;
      return {
        analyserAvailable: true,
        medianHz: median == null ? null : Math.round(median * 100) / 100,
        midi: median == null ? null : Math.round((69 + 12 * Math.log2(median / 440)) * 100) / 100,
        freestyleClass: document.getElementById('lockBtn')?.className ?? null,
      };
    });

    return { freestyle, yNorm, result };
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
    for (const y of [0.13, 0.21, 0.37, 0.58, 0.73, 0.87]) {
      results.push(await measure(browser, false, y));
      results.push(await measure(browser, true, y));
    }
    console.log(JSON.stringify({ label: 'freestyle-pitch-grid', results }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
