const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

const instruments = ['keys','pluck','bell','marimba','flute','strings','chime','bass','8bit'];

function wrapPhase(value) {
  let phase = value;
  while (phase <= -Math.PI) phase += Math.PI * 2;
  while (phase > Math.PI) phase -= Math.PI * 2;
  return phase;
}

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    const proto = window.AudioNode?.prototype;
    if (!proto || proto.__adsrPhaseProbePatched) return;
    Object.defineProperty(proto, '__adsrPhaseProbePatched', { value: true });

    const originalConnect = proto.connect;
    proto.connect = function(destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__adsrPhaseAnalyser &&
          this.context?.createAnalyser
        ) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 4096;
          analyser.smoothingTimeConstant = 0;
          const silent = this.context.createGain();
          silent.gain.value = 0;
          originalConnect.call(this, analyser);
          originalConnect.call(analyser, silent);
          originalConnect.call(silent, destination);
          window.__adsrPhaseAnalyser = analyser;
        }
      } catch {}
      return originalConnect.call(this, destination, ...args);
    };
  });
  await page.goto('https://playmusictheory.net/play', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 550));
  return page;
}

async function resetAndSelect(page, instrument) {
  await page.evaluate((id) => {
    const play = document.getElementById('play');
    if (play instanceof HTMLElement && play.classList.contains('on')) play.click();

    const clear = document.getElementById('clear');
    if (clear instanceof HTMLElement) clear.click();

    for (const beatId of ['b1','b2','b3']) {
      const el = document.getElementById(beatId);
      if (el instanceof HTMLElement && el.classList.contains('on')) el.click();
    }

    const swatch = [...document.querySelectorAll('.swatch')].find(
      (el) => el.getAttribute('aria-label') === id,
    );
    if (swatch instanceof HTMLElement) swatch.click();
  }, instrument);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function drawLine(page, xStart, xEnd) {
  const canvas = await page.$('#c');
  await canvas?.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'center' }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  const box = await canvas?.boundingBox();
  if (!box) throw new Error('Canvas unavailable');

  const y = box.y + box.height * 0.50;
  const x0 = box.x + box.width * xStart;
  const x1 = box.x + box.width * xEnd;

  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 24; i += 1) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 24, y);
  }
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 70));
}

async function envelopeMeasurement(browser, instrument) {
  const page = await createPage(browser);
  try {
    await resetAndSelect(page, instrument);
    await drawLine(page, 0.12, 0.30);

    await page.evaluate(() => {
      const analyser = window.__adsrPhaseAnalyser;
      window.__adsrFrames = [];
      if (!analyser) return;
      const time = new Float32Array(analyser.fftSize);
      const started = performance.now();

      const sample = () => {
        analyser.getFloatTimeDomainData(time);
        let sumSq = 0;
        for (let i = 0; i < time.length; i += 1) sumSq += time[i] * time[i];
        const elapsed = performance.now() - started;
        window.__adsrFrames.push({ ms: elapsed, rms: Math.sqrt(sumSq / time.length) });
        if (elapsed < 2300) window.setTimeout(sample, 2);
      };

      sample();
      const play = document.getElementById('play');
      if (play instanceof HTMLElement) play.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 2400));

    return page.evaluate((name) => {
      const frames = (window.__adsrFrames ?? []).filter((f) => Number.isFinite(f.rms));
      if (!frames.length) return { instrument: name, error: 'no-frames' };

      const peak = frames.reduce((best, f) => f.rms > best.rms ? f : best, { ms: 0, rms: 0 });
      const threshold = Math.max(0.0007, peak.rms * 0.02);
      const audible = frames.filter((f) => f.rms >= threshold);
      const onset = audible[0] ?? null;

      const attack50 = onset ? frames.find((f) => f.ms >= onset.ms && f.rms >= peak.rms * 0.5) : null;
      const attack90 = onset ? frames.find((f) => f.ms >= onset.ms && f.rms >= peak.rms * 0.9) : null;

      // Find the first stable downward transition after the peak.
      let releaseStart = null;
      for (let i = frames.findIndex((f) => f.ms >= peak.ms); i >= 0 && i < frames.length - 12; i += 1) {
        const block = frames.slice(i, i + 12);
        const below = block.filter((f) => f.rms <= peak.rms * 0.72).length;
        if (below >= 10) {
          releaseStart = frames[i];
          break;
        }
      }

      const release50 = releaseStart
        ? frames.find((f) => f.ms >= releaseStart.ms && f.rms <= peak.rms * 0.5)
        : null;
      const release10 = releaseStart
        ? frames.find((f) => f.ms >= releaseStart.ms && f.rms <= peak.rms * 0.1)
        : null;
      const release02 = releaseStart
        ? frames.find((f) => f.ms >= releaseStart.ms && f.rms <= peak.rms * 0.02)
        : null;

      const sustainWindow = releaseStart
        ? frames.filter((f) => f.ms >= peak.ms + 140 && f.ms <= releaseStart.ms - 60)
        : [];
      const sustainValues = sustainWindow.map((f) => f.rms / Math.max(1e-12, peak.rms)).sort((a,b)=>a-b);
      const sustainMedian = sustainValues.length
        ? sustainValues[Math.floor(sustainValues.length / 2)]
        : null;

      return {
        instrument: name,
        onsetMs: onset ? Math.round(onset.ms * 10) / 10 : null,
        peakMs: Math.round(peak.ms * 10) / 10,
        peakRms: Math.round(peak.rms * 1e6) / 1e6,
        attack50Ms: onset && attack50 ? Math.round((attack50.ms - onset.ms) * 10) / 10 : null,
        attack90Ms: onset && attack90 ? Math.round((attack90.ms - onset.ms) * 10) / 10 : null,
        releaseStartMs: releaseStart ? Math.round(releaseStart.ms * 10) / 10 : null,
        release50Ms: releaseStart && release50 ? Math.round((release50.ms - releaseStart.ms) * 10) / 10 : null,
        release10Ms: releaseStart && release10 ? Math.round((release10.ms - releaseStart.ms) * 10) / 10 : null,
        release02Ms: releaseStart && release02 ? Math.round((release02.ms - releaseStart.ms) * 10) / 10 : null,
        sustainRatio: sustainMedian == null ? null : Math.round(sustainMedian * 1000) / 1000,
      };
    }, instrument);
  } finally {
    await page.close();
  }
}

async function phaseMeasurement(browser, instrument) {
  const page = await createPage(browser);
  try {
    await resetAndSelect(page, instrument);
    await drawLine(page, 0.05, 0.92);

    await page.evaluate(() => {
      const analyser = window.__adsrPhaseAnalyser;
      window.__phaseSnapshots = [];
      if (!analyser) return;
      const time = new Float32Array(analyser.fftSize);
      const freq = new Float32Array(analyser.frequencyBinCount);
      const started = performance.now();

      const sample = () => {
        analyser.getFloatTimeDomainData(time);
        analyser.getFloatFrequencyData(freq);
        const elapsed = performance.now() - started;

        let sumSq = 0;
        for (let i = 0; i < time.length; i += 1) sumSq += time[i] * time[i];
        const rms = Math.sqrt(sumSq / time.length);

        let strongestIndex = -1;
        let strongestDb = -Infinity;
        for (let i = 2; i < freq.length; i += 1) {
          const hz = (i * analyser.context.sampleRate) / analyser.fftSize;
          if (hz < 100 || hz > 1000) continue;
          if (freq[i] > strongestDb) {
            strongestDb = freq[i];
            strongestIndex = i;
          }
        }

        if (elapsed >= 1250 && elapsed <= 1500 && rms > 0.01) {
          let f0 = null;
          if (strongestIndex >= 1 && strongestIndex < freq.length - 1) {
            const alpha = freq[strongestIndex - 1];
            const beta = freq[strongestIndex];
            const gamma = freq[strongestIndex + 1];
            const denominator = alpha - 2 * beta + gamma;
            let delta = 0;
            if (Number.isFinite(denominator) && Math.abs(denominator) > 1e-9) {
              delta = 0.5 * (alpha - gamma) / denominator;
              delta = Math.min(0.5, Math.max(-0.5, delta));
            }
            f0 =
              ((strongestIndex + delta) * analyser.context.sampleRate) /
              analyser.fftSize;
          }

          window.__phaseSnapshots.push({
            ms: elapsed,
            rms,
            sampleRate: analyser.context.sampleRate,
            f0,
            values: Array.from(time),
          });
        }

        if (elapsed < 1580) window.setTimeout(sample, 8);
      };

      sample();
      const play = document.getElementById('play');
      if (play instanceof HTMLElement) play.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 1680));
    return page.evaluate((name) => {
      const snapshots = window.__phaseSnapshots ?? [];
      const best = snapshots.reduce(
        (chosen, item) => !chosen || item.rms > chosen.rms ? item : chosen,
        null,
      );
      return {
        instrument: name,
        snapshot: best,
      };
    }, instrument);
  } finally {
    await page.close();
  }
}

function phaseSummary(measurement) {
  const snap = measurement.snapshot;
  if (!snap?.values?.length || !snap.f0 || !snap.sampleRate) {
    return { instrument: measurement.instrument, phases: [] };
  }

  const values = snap.values;
  const f0 = snap.f0;
  const sampleRate = snap.sampleRate;
  const raw = [];

  for (let n = 1; n <= 9; n += 1) {
    const freq = f0 * n;
    if (freq >= sampleRate / 2) break;
    let cos = 0;
    let sin = 0;
    for (let i = 0; i < values.length; i += 1) {
      const angle = 2 * Math.PI * freq * i / sampleRate;
      cos += values[i] * Math.cos(angle);
      sin -= values[i] * Math.sin(angle);
    }
    raw.push({
      n,
      amplitude: (2 / values.length) * Math.hypot(cos, sin),
      phase: Math.atan2(sin, cos),
    });
  }

  const p1 = raw[0]?.phase ?? 0;
  const phases = raw
    .filter((x) => x.amplitude > 1e-5)
    .map((x) => ({
      n: x.n,
      amplitude: Math.round(x.amplitude * 1e6) / 1e6,
      relativePhaseRad: Math.round(wrapPhase(x.phase - x.n * p1) * 1000) / 1000,
    }));

  return {
    instrument: measurement.instrument,
    f0: Math.round(f0 * 100) / 100,
    snapshotMs: Math.round(snap.ms * 10) / 10,
    rms: Math.round(snap.rms * 1e6) / 1e6,
    phases,
  };
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'],
  });

  try {
    const envelopes = [];
    const phases = [];
    for (const instrument of instruments) {
      envelopes.push(await envelopeMeasurement(browser, instrument));
      phases.push(phaseSummary(await phaseMeasurement(browser, instrument)));
    }
    console.log(JSON.stringify({ label: 'instrument-adsr-phase-v3', envelopes, phases }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
