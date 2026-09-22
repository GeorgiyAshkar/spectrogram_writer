const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    const audioNodeProto = window.AudioNode?.prototype;
    if (!audioNodeProto || audioNodeProto.__accompanimentProbePatched) return;
    Object.defineProperty(audioNodeProto, '__accompanimentProbePatched', { value: true });

    const originalConnect = audioNodeProto.connect;
    audioNodeProto.connect = function (destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__accompanimentAnalyser &&
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
          window.__accompanimentAnalyser = analyser;
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

async function ensureStopped(page) {
  await page.evaluate(() => {
    const play = document.getElementById('play');
    if (play instanceof HTMLElement && play.classList.contains('on')) play.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function clearDrawing(page) {
  await page.evaluate(() => {
    const clear = document.getElementById('clear');
    if (clear instanceof HTMLElement) clear.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function setBeat(page, activeId) {
  await page.evaluate((target) => {
    for (const id of ['b1', 'b2', 'b3']) {
      const el = document.getElementById(id);
      if (!(el instanceof HTMLElement)) continue;
      const shouldBeOn = id === target;
      const isOn = el.classList.contains('on');
      if (isOn !== shouldBeOn) el.click();
    }
  }, activeId);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function captureLoop(page, activeId) {
  await ensureStopped(page);
  await clearDrawing(page);
  await setBeat(page, activeId);

  await page.evaluate(() => {
    window.__accompanimentFrames = [];
    const analyser = window.__accompanimentAnalyser;
    if (!analyser) return;

    const freq = new Float32Array(analyser.frequencyBinCount);
    const wave = new Float32Array(analyser.fftSize);
    const started = performance.now();

    const sample = () => {
      analyser.getFloatFrequencyData(freq);
      analyser.getFloatTimeDomainData(wave);

      let sumSq = 0;
      for (let i = 0; i < wave.length; i += 1) sumSq += wave[i] * wave[i];
      const rms = Math.sqrt(sumSq / wave.length);

      const peaks = [];
      for (let i = 1; i < freq.length - 1; i += 1) {
        const db = freq[i];
        if (!Number.isFinite(db) || db < -72) continue;
        if (db < freq[i - 1] || db < freq[i + 1]) continue;
        const hz = (i * analyser.context.sampleRate) / analyser.fftSize;
        if (hz < 35 || hz > 3500) continue;
        peaks.push({ hz, db });
      }
      peaks.sort((a, b) => b.db - a.db);

      const elapsed = performance.now() - started;
      window.__accompanimentFrames.push({
        ms: elapsed,
        rms,
        peaks: peaks.slice(0, 12),
      });

      if (elapsed < 2200) window.setTimeout(sample, 8);
    };
    sample();

    const play = document.getElementById('play');
    if (play instanceof HTMLElement) play.click();
  });

  await new Promise((resolve) => setTimeout(resolve, 2320));

  const result = await page.evaluate((id) => {
    const analyser = window.__accompanimentAnalyser;
    const frames = window.__accompanimentFrames ?? [];
    const binHz = analyser ? analyser.context.sampleRate / analyser.fftSize : null;

    const strongest = frames.map((frame) => {
      const maxDb = frame.peaks.length ? frame.peaks[0].db : -Infinity;
      const candidates = frame.peaks
        .filter((peak) => peak.db >= maxDb - 14)
        .sort((a, b) => a.hz - b.hz);
      const fundamental = candidates[0] ?? frame.peaks[0] ?? null;
      return {
        ms: Math.round(frame.ms * 10) / 10,
        rms: Math.round(frame.rms * 1e6) / 1e6,
        hz: fundamental ? Math.round(fundamental.hz * 100) / 100 : null,
        db: fundamental ? Math.round(fundamental.db * 10) / 10 : null,
      };
    });

    const rmsValues = strongest.map((frame) => frame.rms);
    const sortedRms = [...rmsValues].sort((a, b) => a - b);
    const medianRms = sortedRms.length ? sortedRms[Math.floor(sortedRms.length / 2)] : 0;
    const attackThreshold = Math.max(0.004, medianRms * 1.8);

    const attacks = [];
    let above = false;
    for (const frame of strongest) {
      const isAbove = frame.rms >= attackThreshold;
      if (isAbove && !above) attacks.push(frame.ms);
      above = isAbove;
    }

    const noteWindows = [];
    let current = null;
    for (const frame of strongest) {
      if (frame.hz == null || frame.rms < Math.max(0.002, medianRms * 0.9)) continue;
      const midi = 69 + 12 * Math.log2(frame.hz / 440);
      const roundedMidi = Math.round(midi);
      if (!current || Math.abs(current.midi - roundedMidi) > 0) {
        if (current) noteWindows.push(current);
        current = {
          midi: roundedMidi,
          startMs: frame.ms,
          endMs: frame.ms,
          samples: 1,
        };
      } else {
        current.endMs = frame.ms;
        current.samples += 1;
      }
    }
    if (current) noteWindows.push(current);

    return {
      activeId: id,
      state: ['b1','b2','b3'].map((beatId) => ({
        id: beatId,
        className: document.getElementById(beatId)?.className ?? null,
      })),
      bpm: document.getElementById('speed')?.value ?? null,
      quantize: document.getElementById('beatSel')?.value ?? null,
      binHz,
      frameCount: frames.length,
      medianRms,
      attackThreshold,
      attacks,
      noteWindows: noteWindows.filter((window) => window.samples >= 2),
      compactFrames: strongest.filter((_, index) => index % 3 === 0),
    };
  }, activeId);

  await ensureStopped(page);
  return result;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });

  try {
    const results = [];
    for (const id of ['b1', 'b2', 'b3']) {
      const page = await createPage(browser);
      try {
        results.push(await captureLoop(page, id));
      } finally {
        await page.close();
      }
    }

    console.log(JSON.stringify({
      label: 'accompaniment-loop-analysis',
      results,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
