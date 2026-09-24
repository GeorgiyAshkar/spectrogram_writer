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
    if (!proto || proto.__waveformProbePatchedV2) return;
    Object.defineProperty(proto, '__waveformProbePatchedV2', { value: true });

    const originalConnect = proto.connect;
    proto.connect = function(destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__waveformAnalyserV2 &&
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
          window.__waveformAnalyserV2 = analyser;
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

async function selectInstrument(page, instrument) {
  const ok = await page.evaluate((id) => {
    const clear = document.getElementById('clear');
    if (clear instanceof HTMLElement) clear.click();

    for (const beatId of ['b1','b2','b3']) {
      const el = document.getElementById(beatId);
      if (el instanceof HTMLElement && el.classList.contains('on')) el.click();
    }

    const swatch = [...document.querySelectorAll('.swatch')].find(
      (el) => el.getAttribute('aria-label') === id,
    );
    if (!(swatch instanceof HTMLElement)) return false;
    swatch.click();

    const play = document.getElementById('play');
    if (play instanceof HTMLElement && play.classList.contains('on')) play.click();
    return true;
  }, instrument);

  if (!ok) throw new Error(`Instrument not found: ${instrument}`);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function drawShortFlatLine(page) {
  const canvas = await page.$('#c');
  await canvas?.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'center' }));
  await new Promise((resolve) => setTimeout(resolve, 60));
  const box = await canvas?.boundingBox();
  if (!box) throw new Error('Canvas unavailable');

  const y = box.y + box.height * 0.50;
  const x0 = box.x + box.width * 0.12;
  const x1 = box.x + box.width * 0.42;

  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 28; i += 1) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 28, y, { steps: 1 });
  }
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function measure(browser, instrument) {
  const page = await createPage(browser);
  try {
    await selectInstrument(page, instrument);
    await drawShortFlatLine(page);

    await page.evaluate(() => {
      const analyser = window.__waveformAnalyserV2;
      window.__waveformProbeV2 = { frames: [], wave: null };
      if (!analyser) return;

      const time = new Float32Array(analyser.fftSize);
      const freq = new Float32Array(analyser.frequencyBinCount);
      const started = performance.now();

      const sample = () => {
        analyser.getFloatTimeDomainData(time);
        analyser.getFloatFrequencyData(freq);

        let sumSq = 0;
        for (let i = 0; i < time.length; i += 1) sumSq += time[i] * time[i];
        const rms = Math.sqrt(sumSq / time.length);
        const elapsed = performance.now() - started;

        let strongestIndex = -1;
        let strongestDb = -Infinity;
        for (let i = 2; i < freq.length; i += 1) {
          const hz = (i * analyser.context.sampleRate) / analyser.fftSize;
          if (hz < 70 || hz > 1800) continue;
          if (freq[i] > strongestDb) {
            strongestDb = freq[i];
            strongestIndex = i;
          }
        }

        const strongestHz = strongestIndex >= 0
          ? (strongestIndex * analyser.context.sampleRate) / analyser.fftSize
          : null;

        window.__waveformProbeV2.frames.push({ ms: elapsed, rms, strongestHz, strongestDb });

        // Capture a stable body frame after onset and before the note ends.
        if (!window.__waveformProbeV2.wave && elapsed >= 520 && rms > 0.01) {
          window.__waveformProbeV2.wave = {
            ms: elapsed,
            sampleRate: analyser.context.sampleRate,
            values: Array.from(time),
            strongestHz,
          };
        }

        if (elapsed < 1550) window.setTimeout(sample, 2);
      };

      sample();
      const play = document.getElementById('play');
      if (play instanceof HTMLElement) play.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 1650));

    return await page.evaluate((name) => {
      const probe = window.__waveformProbeV2 ?? { frames: [] };
      const frames = (probe.frames ?? []).filter((f) => Number.isFinite(f.rms));
      if (!frames.length) return { instrument: name, error: 'no-frames' };

      const peakFrame = frames.reduce(
        (best, f) => f.rms > best.rms ? f : best,
        { ms: 0, rms: 0, strongestHz: null },
      );
      const peakRms = peakFrame.rms;
      const threshold = Math.max(0.001, peakRms * 0.02);
      const audible = frames.filter((f) => f.rms >= threshold);
      const onset = audible[0] ?? null;

      const attack50 = onset
        ? frames.find((f) => f.ms >= onset.ms && f.rms >= peakRms * 0.5)
        : null;
      const attack90 = onset
        ? frames.find((f) => f.ms >= onset.ms && f.rms >= peakRms * 0.9)
        : null;

      const afterPeak = frames.filter((f) => f.ms >= peakFrame.ms);
      const release50 = afterPeak.find((f) => f.rms <= peakRms * 0.5) ?? null;
      const release10 = afterPeak.find((f) => f.rms <= peakRms * 0.1) ?? null;
      const release02 = afterPeak.find((f) => f.rms <= peakRms * 0.02) ?? null;

      // Median body level between 500–700 ms, before the expected line end.
      const bodyFrames = frames.filter((f) => f.ms >= 500 && f.ms <= 700 && f.rms > threshold);
      const bodyValues = bodyFrames.map((f) => f.rms).sort((a,b) => a-b);
      const bodyMedian = bodyValues.length
        ? bodyValues[Math.floor(bodyValues.length / 2)]
        : null;

      return {
        instrument: name,
        onsetMs: onset ? Math.round(onset.ms * 10) / 10 : null,
        peakMs: Math.round(peakFrame.ms * 10) / 10,
        peakRms: Math.round(peakRms * 1e6) / 1e6,
        attack50Ms: onset && attack50 ? Math.round((attack50.ms - onset.ms) * 10) / 10 : null,
        attack90Ms: onset && attack90 ? Math.round((attack90.ms - onset.ms) * 10) / 10 : null,
        bodyRatio: bodyMedian == null || peakRms <= 0
          ? null
          : Math.round((bodyMedian / peakRms) * 1000) / 1000,
        release50FromPeakMs: release50 ? Math.round((release50.ms - peakFrame.ms) * 10) / 10 : null,
        release10FromPeakMs: release10 ? Math.round((release10.ms - peakFrame.ms) * 10) / 10 : null,
        release02FromPeakMs: release02 ? Math.round((release02.ms - peakFrame.ms) * 10) / 10 : null,
        fundamentalHz: peakFrame.strongestHz
          ? Math.round(peakFrame.strongestHz * 100) / 100
          : null,
        waveform: probe.wave
          ? {
              ms: Math.round(probe.wave.ms * 10) / 10,
              sampleRate: probe.wave.sampleRate,
              strongestHz: probe.wave.strongestHz,
              values: probe.wave.values,
            }
          : null,
      };
    }, instrument);
  } finally {
    await page.close();
  }
}

function phaseSummary(result) {
  const wave = result.waveform;
  if (!wave?.values?.length || !wave.strongestHz || !wave.sampleRate) {
    return { ...result, waveform: undefined, phases: [] };
  }

  const values = wave.values;
  const sampleRate = wave.sampleRate;
  const f0 = wave.strongestHz;
  const phases = [];

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
    const amplitude = (2 / values.length) * Math.hypot(cos, sin);
    const phase = Math.atan2(sin, cos);
    phases.push({ n, amplitude, phase });
  }

  const phase1 = phases[0]?.phase ?? 0;
  const normalized = phases
    .filter((entry) => entry.amplitude > 1e-5)
    .map((entry) => ({
      n: entry.n,
      amplitude: Math.round(entry.amplitude * 1e6) / 1e6,
      relativePhaseRad: Math.round(
        wrapPhase(entry.phase - entry.n * phase1) * 1000,
      ) / 1000,
    }));

  return {
    ...result,
    waveform: undefined,
    waveformMs: wave.ms,
    waveformFundamentalHz: Math.round(f0 * 100) / 100,
    phases: normalized,
  };
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'],
  });

  try {
    const results = [];
    for (const instrument of instruments) {
      const measured = await measure(browser, instrument);
      results.push(phaseSummary(measured));
    }
    console.log(JSON.stringify({ label: 'instrument-waveform-envelope-v2', results }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
