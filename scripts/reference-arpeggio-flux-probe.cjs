const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

const STEP_MS = 1000 / 6; // 1/3 beat at 120 BPM.

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    const proto = window.AudioNode?.prototype;
    if (!proto || proto.__arpFluxPatched) return;
    Object.defineProperty(proto, '__arpFluxPatched', { value: true });

    const originalConnect = proto.connect;
    proto.connect = function (destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__arpFluxAnalyser &&
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
          window.__arpFluxAnalyser = analyser;
        }
      } catch {}
      return originalConnect.call(this, destination, ...args);
    };
  });

  await page.goto('https://playmusictheory.net/play', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await new Promise((resolve) => setTimeout(resolve, 520));
  return page;
}

async function runCase(browser, config) {
  const page = await createPage(browser);
  try {
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
    await new Promise((resolve) => setTimeout(resolve, 100));

    await page.evaluate(() => {
      const analyser = window.__arpFluxAnalyser;
      window.__arpFluxFrames = [];
      if (!analyser) return;

      const bins = new Float32Array(analyser.frequencyBinCount);
      const wave = new Float32Array(analyser.fftSize);
      const started = performance.now();

      const sample = () => {
        analyser.getFloatFrequencyData(bins);
        analyser.getFloatTimeDomainData(wave);

        let sumSq = 0;
        for (let i = 0; i < wave.length; i += 1) sumSq += wave[i] * wave[i];

        const candidateDb = {};
        for (let midi = 68; midi <= 90; midi += 1) {
          const hz = 440 * 2 ** ((midi - 69) / 12);
          const center = Math.round((hz * analyser.fftSize) / analyser.context.sampleRate);
          let best = -Infinity;
          for (let bin = Math.max(1, center - 1); bin <= Math.min(bins.length - 1, center + 1); bin += 1) {
            best = Math.max(best, bins[bin]);
          }
          candidateDb[midi] = best;
        }

        const elapsed = performance.now() - started;
        window.__arpFluxFrames.push({
          ms: elapsed,
          rms: Math.sqrt(sumSq / wave.length),
          candidateDb,
        });

        if (elapsed < 1550) window.setTimeout(sample, 6);
      };
      sample();

      const play = document.getElementById('play');
      if (play instanceof HTMLElement) play.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 1630));

    return await page.evaluate((stepMs) => {
      const frames = window.__arpFluxFrames ?? [];
      if (!frames.length) return { error: 'no-frames' };

      const onsetFrame = frames.find((frame) => frame.rms > 0.008);
      const onsetMs = onsetFrame?.ms ?? 0;

      const nearest = (target) => {
        let best = frames[0];
        let distance = Math.abs(best.ms - target);
        for (const frame of frames) {
          const d = Math.abs(frame.ms - target);
          if (d < distance) {
            best = frame;
            distance = d;
          }
        }
        return best;
      };

      const steps = [];
      for (let index = 0; index < 9; index += 1) {
        const start = onsetMs + index * stepMs;
        const before = nearest(Math.max(0, start - 24));
        const after = nearest(start + 34);

        const candidates = [];
        for (let midi = 68; midi <= 90; midi += 1) {
          const beforeDb = Number(before.candidateDb[midi]);
          const afterDb = Number(after.candidateDb[midi]);
          if (!Number.isFinite(beforeDb) || !Number.isFinite(afterDb)) continue;
          candidates.push({
            midi,
            beforeDb,
            afterDb,
            riseDb: afterDb - beforeDb,
          });
        }
        candidates.sort((a, b) => b.riseDb - a.riseDb);

        steps.push({
          index,
          expectedMs: Math.round(start * 10) / 10,
          beforeMs: Math.round(before.ms * 10) / 10,
          afterMs: Math.round(after.ms * 10) / 10,
          topRises: candidates.slice(0, 5).map((item) => ({
            midi: item.midi,
            riseDb: Math.round(item.riseDb * 10) / 10,
            afterDb: Math.round(item.afterDb * 10) / 10,
          })),
        });
      }

      return {
        onsetMs: Math.round(onsetMs * 10) / 10,
        key: document.getElementById('keySel')?.value ?? null,
        scale: document.getElementById('scaleSel')?.value ?? null,
        steps,
      };
    }, STEP_MS);
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

  const cases = [
    { name: 'C-pentatonic', key: '0', scale: 'pentatonic' },
    { name: 'D-pentatonic', key: '2', scale: 'pentatonic' },
    { name: 'C-minor-pentatonic', key: '0', scale: 'minor' },
    { name: 'C-major', key: '0', scale: 'major' },
    { name: 'C-minor', key: '0', scale: 'natural' },
    { name: 'C-harmonic-minor', key: '0', scale: 'harmonic' },
    { name: 'C-dorian', key: '0', scale: 'dorian' },
    { name: 'C-phrygian', key: '0', scale: 'phrygian' },
    { name: 'C-lydian', key: '0', scale: 'lydian' },
    { name: 'C-mixolydian', key: '0', scale: 'mixolydian' },
    { name: 'C-blues', key: '0', scale: 'blues' },
  ];

  try {
    const results = [];
    for (const config of cases) {
      results.push({ config, result: await runCase(browser, config) });
    }
    console.log(JSON.stringify({ label: 'arpeggio-spectral-flux', results }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
