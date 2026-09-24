const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

const instruments = ['keys','pluck','bell','marimba','flute','strings','chime','bass','8bit'];

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    const proto = window.AudioNode?.prototype;
    if (!proto || proto.__waveformProbePatched) return;
    Object.defineProperty(proto, '__waveformProbePatched', { value: true });

    const originalConnect = proto.connect;
    proto.connect = function(destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__waveformAnalyser &&
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
          window.__waveformAnalyser = analyser;
        }
      } catch {}
      return originalConnect.call(this, destination, ...args);
    };
  });

  await page.goto('https://playmusictheory.net/play', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await new Promise((resolve) => setTimeout(resolve, 650));
  return page;
}

async function stopAndClear(page) {
  await page.evaluate(() => {
    const play = document.getElementById('play');
    if (play instanceof HTMLElement && play.classList.contains('on')) play.click();
    const clear = document.getElementById('clear');
    if (clear instanceof HTMLElement) clear.click();
    for (const id of ['b1','b2','b3']) {
      const el = document.getElementById(id);
      if (el instanceof HTMLElement && el.classList.contains('on')) el.click();
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function selectInstrument(page, instrument) {
  const ok = await page.evaluate((label) => {
    const swatch = document.querySelector(`button[aria-label="${label}"]`);
    if (!(swatch instanceof HTMLButtonElement)) return false;
    swatch.click();
    return true;
  }, instrument);
  if (!ok) throw new Error(`Instrument not found: ${instrument}`);
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function drawLongHorizontalNote(page) {
  const canvas = await page.$('#c');
  const box = await canvas?.boundingBox();
  if (!box) throw new Error('Canvas unavailable');

  const y = box.y + box.height * 0.47;
  const x0 = box.x + box.width * 0.10;
  const x1 = box.x + box.width * 0.62;

  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 36; i += 1) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 36, y, { steps: 1 });
  }
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function measure(page, instrument) {
  await stopAndClear(page);
  await selectInstrument(page, instrument);
  await drawLongHorizontalNote(page);

  await page.evaluate(() => {
    const analyser = window.__waveformAnalyser;
    window.__waveformProbe = { frames: [], wave: null };
    if (!analyser) return;

    const time = new Float32Array(analyser.fftSize);
    const started = performance.now();

    const sample = () => {
      analyser.getFloatTimeDomainData(time);
      let sumSq = 0;
      let peak = 0;
      for (let i = 0; i < time.length; i += 1) {
        const v = time[i];
        sumSq += v * v;
        peak = Math.max(peak, Math.abs(v));
      }
      const elapsed = performance.now() - started;
      const rms = Math.sqrt(sumSq / time.length);

      window.__waveformProbe.frames.push({ ms: elapsed, rms, peak });

      // Capture a steady-state waveform after note onset but before release.
      if (!window.__waveformProbe.wave && elapsed >= 650 && rms > 0.001) {
        window.__waveformProbe.wave = {
          ms: elapsed,
          sampleRate: analyser.context.sampleRate,
          values: Array.from(time),
        };
      }

      if (elapsed < 1750) {
        window.setTimeout(sample, 2);
      }
    };
    sample();

    const play = document.getElementById('play');
    if (play instanceof HTMLElement) play.click();
  });

  await new Promise((resolve) => setTimeout(resolve, 1850));

  return page.evaluate((name) => {
    const probe = window.__waveformProbe ?? { frames: [] };
    const frames = (probe.frames ?? []).filter((f) => Number.isFinite(f.rms));
    if (!frames.length) return { instrument: name, error: 'no-frames' };

    const sorted = [...frames].sort((a,b) => b.rms - a.rms);
    const peakFrame = sorted[0] ?? { ms: 0, rms: 0 };
    const peakRms = peakFrame.rms;
    const audible = frames.filter((f) => f.rms > Math.max(0.0007, peakRms * 0.02));
    const onset = audible[0] ?? null;
    const end = audible[audible.length - 1] ?? null;

    const attack50 = onset
      ? frames.find((f) => f.ms >= onset.ms && f.rms >= peakRms * 0.5)
      : null;
    const attack90 = onset
      ? frames.find((f) => f.ms >= onset.ms && f.rms >= peakRms * 0.9)
      : null;

    // Release starts after the strongest continuous body; find first sustained fall.
    let releaseStart = null;
    for (let i = Math.max(1, frames.findIndex((f) => f.ms >= peakFrame.ms)); i < frames.length - 6; i += 1) {
      const windowFrames = frames.slice(i, i + 6);
      if (windowFrames.every((f) => f.rms < peakRms * 0.65)) {
        releaseStart = frames[i];
        break;
      }
    }

    const release50 = releaseStart
      ? frames.find((f) => f.ms >= releaseStart.ms && f.rms <= peakRms * 0.5)
      : null;
    const release10 = releaseStart
      ? frames.find((f) => f.ms >= releaseStart.ms && f.rms <= peakRms * 0.1)
      : null;

    return {
      instrument: name,
      analyser: Boolean(window.__waveformAnalyser),
      onsetMs: onset ? Math.round(onset.ms * 10) / 10 : null,
      peakMs: Math.round(peakFrame.ms * 10) / 10,
      peakRms: Math.round(peakRms * 1e6) / 1e6,
      attack50FromOnsetMs: onset && attack50 ? Math.round((attack50.ms - onset.ms) * 10) / 10 : null,
      attack90FromOnsetMs: onset && attack90 ? Math.round((attack90.ms - onset.ms) * 10) / 10 : null,
      releaseStartMs: releaseStart ? Math.round(releaseStart.ms * 10) / 10 : null,
      release50FromStartMs: releaseStart && release50 ? Math.round((release50.ms - releaseStart.ms) * 10) / 10 : null,
      release10FromStartMs: releaseStart && release10 ? Math.round((release10.ms - releaseStart.ms) * 10) / 10 : null,
      audibleEndMs: end ? Math.round(end.ms * 10) / 10 : null,
      waveform: probe.wave
        ? {
            ms: Math.round(probe.wave.ms * 10) / 10,
            sampleRate: probe.wave.sampleRate,
            values: probe.wave.values,
          }
        : null,
      compact: frames.filter((_,i) => i % 10 === 0).map((f) => ({
        ms: Math.round(f.ms * 10) / 10,
        rms: Math.round(f.rms * 1e6) / 1e6,
      })),
    };
  }, instrument);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'],
  });

  try {
    const page = await createPage(browser);
    try {
      const results = [];
      for (const instrument of instruments) {
        results.push(await measure(page, instrument));
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      console.log(JSON.stringify({ label: 'instrument-waveform-envelope', results }));
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
