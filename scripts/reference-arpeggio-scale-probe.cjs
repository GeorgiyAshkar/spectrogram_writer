const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    const proto = window.AudioNode?.prototype;
    if (!proto || proto.__arpScalePatched) return;
    Object.defineProperty(proto, '__arpScalePatched', { value: true });

    const originalConnect = proto.connect;
    proto.connect = function (destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__arpAnalyser &&
          this.context?.createAnalyser
        ) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 16384;
          analyser.smoothingTimeConstant = 0.03;

          const silent = this.context.createGain();
          silent.gain.value = 0;
          originalConnect.call(this, analyser);
          originalConnect.call(analyser, silent);
          originalConnect.call(silent, destination);
          window.__arpAnalyser = analyser;
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

async function setCase(page, config) {
  await page.evaluate((cfg) => {
    const setSelect = (id, value) => {
      const el = document.getElementById(id);
      if (!(el instanceof HTMLSelectElement)) return;
      el.value = String(value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    setSelect('keySel', cfg.key);
    setSelect('scaleSel', cfg.scale);

    const clear = document.getElementById('clear');
    if (clear instanceof HTMLElement) clear.click();

    for (const id of ['b1', 'b2', 'b3']) {
      const el = document.getElementById(id);
      if (!(el instanceof HTMLElement)) continue;
      const shouldBeOn = id === 'b3';
      if (el.classList.contains('on') !== shouldBeOn) el.click();
    }

    const play = document.getElementById('play');
    if (play instanceof HTMLElement && play.classList.contains('on')) play.click();
  }, config);
  await new Promise((resolve) => setTimeout(resolve, 120));
}

async function capture(page) {
  await page.evaluate(() => {
    const analyser = window.__arpAnalyser;
    window.__arpFrames = [];
    if (!analyser) return;

    const bins = new Float32Array(analyser.frequencyBinCount);
    const started = performance.now();

    const sample = () => {
      analyser.getFloatFrequencyData(bins);
      let best = null;

      for (let i = 2; i < bins.length - 1; i += 1) {
        const db = bins[i];
        if (!Number.isFinite(db) || db < -68) continue;
        if (db < bins[i - 1] || db < bins[i + 1]) continue;

        const hz = (i * analyser.context.sampleRate) / analyser.fftSize;
        if (hz < 180 || hz > 1800) continue;

        // Pick the lowest strong spectral peak to prefer the fundamental.
        if (!best || hz < best.hz) {
          best = { hz, db };
        }
      }

      const elapsed = performance.now() - started;
      window.__arpFrames.push({
        ms: elapsed,
        hz: best?.hz ?? null,
        db: best?.db ?? null,
      });

      if (elapsed < 1650) window.setTimeout(sample, 10);
    };
    sample();

    const play = document.getElementById('play');
    if (play instanceof HTMLElement) play.click();
  });

  await new Promise((resolve) => setTimeout(resolve, 1750));

  const result = await page.evaluate(() => {
    const frames = window.__arpFrames ?? [];
    const notes = frames
      .filter((frame) => frame.hz && frame.db > -62)
      .map((frame) => ({
        ms: frame.ms,
        midi: Math.round(69 + 12 * Math.log2(frame.hz / 440)),
      }));

    const groups = [];
    for (const note of notes) {
      const last = groups[groups.length - 1];
      if (!last || last.midi !== note.midi || note.ms - last.endMs > 75) {
        groups.push({
          midi: note.midi,
          startMs: note.ms,
          endMs: note.ms,
          samples: 1,
        });
      } else {
        last.endMs = note.ms;
        last.samples += 1;
      }
    }

    return {
      key: document.getElementById('keySel')?.value ?? null,
      scale: document.getElementById('scaleSel')?.value ?? null,
      bpm: document.getElementById('speed')?.value ?? null,
      groups: groups
        .filter((group) => group.samples >= 2)
        .map((group) => ({
          midi: group.midi,
          startMs: Math.round(group.startMs * 10) / 10,
          endMs: Math.round(group.endMs * 10) / 10,
          samples: group.samples,
        })),
    };
  });

  await page.evaluate(() => {
    const play = document.getElementById('play');
    if (play instanceof HTMLElement && play.classList.contains('on')) play.click();
  });

  return result;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });

  const cases = [
    { name: 'C-major-pentatonic', key: '0', scale: 'pentatonic' },
    { name: 'D-major-pentatonic', key: '2', scale: 'pentatonic' },
    { name: 'C-major', key: '0', scale: 'major' },
    { name: 'C-minor', key: '0', scale: 'natural' },
    { name: 'C-harmonic-minor', key: '0', scale: 'harmonic' },
    { name: 'C-blues', key: '0', scale: 'blues' },
  ];

  try {
    const results = [];
    for (const config of cases) {
      const page = await createPage(browser);
      try {
        await setCase(page, config);
        results.push({ config, result: await capture(page) });
      } finally {
        await page.close();
      }
    }

    console.log(JSON.stringify({
      label: 'arpeggio-scale-analysis',
      results,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
