const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

function findPeaks(frames, key, minDistanceMs, threshold) {
  const peaks = [];
  let lastMs = -Infinity;

  for (let i = 1; i < frames.length - 1; i += 1) {
    const prev = frames[i - 1][key];
    const value = frames[i][key];
    const next = frames[i + 1][key];
    if (!(value >= prev && value > next && value >= threshold)) continue;

    if (frames[i].ms - lastMs < minDistanceMs) {
      const last = peaks[peaks.length - 1];
      if (last && value > last.value) {
        peaks[peaks.length - 1] = { ms: frames[i].ms, value };
        lastMs = frames[i].ms;
      }
      continue;
    }

    peaks.push({ ms: frames[i].ms, value });
    lastMs = frames[i].ms;
  }

  return peaks;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

    await page.evaluateOnNewDocument(() => {
      const audioNodeProto = window.AudioNode?.prototype;
      if (!audioNodeProto || audioNodeProto.__drumsTransientPatched) return;
      Object.defineProperty(audioNodeProto, '__drumsTransientPatched', { value: true });

      const originalConnect = audioNodeProto.connect;
      audioNodeProto.connect = function (destination, ...args) {
        try {
          if (
            destination instanceof AudioDestinationNode &&
            !window.__drumsAnalyser &&
            this.context?.createAnalyser
          ) {
            const analyser = this.context.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0;

            const silent = this.context.createGain();
            silent.gain.value = 0;
            originalConnect.call(this, analyser);
            originalConnect.call(analyser, silent);
            originalConnect.call(silent, destination);
            window.__drumsAnalyser = analyser;
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

    await page.evaluate(() => {
      const clear = document.getElementById('clear');
      if (clear instanceof HTMLElement) clear.click();

      for (const id of ['b1', 'b2', 'b3']) {
        const el = document.getElementById(id);
        if (!(el instanceof HTMLElement)) continue;
        const shouldBeOn = id === 'b2';
        if (el.classList.contains('on') !== shouldBeOn) el.click();
      }

      const play = document.getElementById('play');
      if (play instanceof HTMLElement && play.classList.contains('on')) play.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    await page.evaluate(() => {
      const analyser = window.__drumsAnalyser;
      window.__drumsTransientFrames = [];
      if (!analyser) return;

      const wave = new Float32Array(analyser.fftSize);
      const freq = new Float32Array(analyser.frequencyBinCount);
      const started = performance.now();
      const sampleRate = analyser.context.sampleRate;
      const fftSize = analyser.fftSize;

      const bandPower = (fromHz, toHz) => {
        const from = Math.max(1, Math.floor((fromHz * fftSize) / sampleRate));
        const to = Math.min(freq.length - 1, Math.ceil((toHz * fftSize) / sampleRate));
        let power = 0;
        for (let i = from; i <= to; i += 1) {
          const db = freq[i];
          if (!Number.isFinite(db) || db < -120) continue;
          power += 10 ** (db / 10);
        }
        return power;
      };

      const sample = () => {
        analyser.getFloatTimeDomainData(wave);
        analyser.getFloatFrequencyData(freq);

        let sumSq = 0;
        for (let i = 0; i < wave.length; i += 1) sumSq += wave[i] * wave[i];

        const elapsed = performance.now() - started;
        window.__drumsTransientFrames.push({
          ms: elapsed,
          rms: Math.sqrt(sumSq / wave.length),
          low: bandPower(35, 140),
          mid: bandPower(140, 1800),
          high: bandPower(3000, 12000),
        });

        if (elapsed < 2150) window.setTimeout(sample, 4);
      };
      sample();

      const play = document.getElementById('play');
      if (play instanceof HTMLElement) play.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 2250));

    const raw = await page.evaluate(() => ({
      frames: window.__drumsTransientFrames ?? [],
      bpm: document.getElementById('speed')?.value ?? null,
      quantize: document.getElementById('beatSel')?.value ?? null,
      state: ['b1','b2','b3'].map((id) => ({
        id,
        className: document.getElementById(id)?.className ?? null,
      })),
    }));

    const frames = raw.frames.map((frame) => ({
      ms: Math.round(frame.ms * 10) / 10,
      rms: frame.rms,
      low: frame.low,
      mid: frame.mid,
      high: frame.high,
    }));

    const sorted = (key) => frames.map((f) => f[key]).sort((a, b) => a - b);
    const percentile = (key, q) => {
      const values = sorted(key);
      return values.length ? values[Math.min(values.length - 1, Math.floor(values.length * q))] : 0;
    };

    const peaks = {
      rms: findPeaks(frames, 'rms', 70, percentile('rms', 0.72)),
      low: findPeaks(frames, 'low', 110, percentile('low', 0.76)),
      mid: findPeaks(frames, 'mid', 80, percentile('mid', 0.76)),
      high: findPeaks(frames, 'high', 70, percentile('high', 0.74)),
    };

    const compactFrames = frames
      .filter((_, index) => index % 4 === 0)
      .map((frame) => ({
        ms: frame.ms,
        rms: Math.round(frame.rms * 1e6) / 1e6,
        low: Number(frame.low.toExponential(4)),
        mid: Number(frame.mid.toExponential(4)),
        high: Number(frame.high.toExponential(4)),
      }));

    console.log(JSON.stringify({
      label: 'drums-transient-analysis',
      bpm: raw.bpm,
      quantize: raw.quantize,
      state: raw.state,
      frameCount: frames.length,
      thresholds: {
        rms: percentile('rms', 0.72),
        low: percentile('low', 0.76),
        mid: percentile('mid', 0.76),
        high: percentile('high', 0.74),
      },
      peaks,
      compactFrames,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
