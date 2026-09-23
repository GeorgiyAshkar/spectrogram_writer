const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

const instruments = ['keys','pluck','bell','marimba','flute','strings','chime','bass','8bit'];

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    const proto = window.AudioNode?.prototype;
    if (!proto || proto.__envelopeProbePatched) return;
    Object.defineProperty(proto, '__envelopeProbePatched', { value: true });
    const originalConnect = proto.connect;

    proto.connect = function(destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__envelopeAnalyser &&
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
          window.__envelopeAnalyser = analyser;
        }
      } catch {}
      return originalConnect.call(this, destination, ...args);
    };
  });

  await page.goto('https://playmusictheory.net/play', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await new Promise((resolve) => setTimeout(resolve, 700));

  await page.evaluate(() => {
    const keyButton = document.getElementById('keyBtn');
    if (keyButton instanceof HTMLElement) keyButton.click();

    const play = document.getElementById('play');
    if (play instanceof HTMLElement && play.classList.contains('on')) play.click();

    const b1 = document.getElementById('b1');
    const b2 = document.getElementById('b2');
    const b3 = document.getElementById('b3');
    for (const el of [b1,b2,b3]) {
      if (el instanceof HTMLElement && el.classList.contains('on')) el.click();
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 250));
  return page;
}

async function keyboardTarget(page) {
  const candidates = ['#keys', '#octave'];
  for (const selector of candidates) {
    const el = await page.$(selector);
    const box = await el?.boundingBox();
    if (box && box.width > 40 && box.height > 30) {
      const display = await page.$eval(selector, node => getComputedStyle(node).display);
      if (display !== 'none') return { selector, box };
    }
  }
  return null;
}

async function selectInstrument(page, instrument) {
  const ok = await page.evaluate((label) => {
    const el = document.querySelector(`button[aria-label="${label}"]`);
    if (!(el instanceof HTMLButtonElement)) return false;
    el.click();
    return true;
  }, instrument);
  if (!ok) throw new Error(`Instrument swatch not found: ${instrument}`);
  await new Promise((resolve) => setTimeout(resolve, 90));
}

async function measureInstrument(page, instrument, target) {
  await selectInstrument(page, instrument);

  await page.evaluate(() => {
    window.__envelopeFrames = [];
    window.__envelopeReleaseMs = null;
    const analyser = window.__envelopeAnalyser;
    if (!analyser) return;
    const wave = new Float32Array(analyser.fftSize);
    const started = performance.now();

    const sample = () => {
      analyser.getFloatTimeDomainData(wave);
      let sumSq = 0;
      for (let i = 0; i < wave.length; i += 1) sumSq += wave[i] * wave[i];
      const elapsed = performance.now() - started;
      window.__envelopeFrames.push({
        ms: elapsed,
        rms: Math.sqrt(sumSq / wave.length),
      });
      if (elapsed < 1250) window.setTimeout(sample, 3);
    };
    sample();
  });

  const { box } = target;
  // Bottom part of the first white key, away from black-key hit areas.
  const x = box.x + box.width * 0.08;
  const y = box.y + box.height * 0.78;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await new Promise((resolve) => setTimeout(resolve, 420));
  await page.evaluate(() => {
    window.__envelopeReleaseMs = window.__envelopeFrames?.at(-1)?.ms ?? null;
  });
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 760));

  return page.evaluate((name) => {
    const frames = (window.__envelopeFrames ?? [])
      .filter((frame) => Number.isFinite(frame.rms))
      .map((frame) => ({ ms: frame.ms, rms: frame.rms }));
    const releaseMs = window.__envelopeReleaseMs;
    if (!frames.length) return { instrument: name, error: 'no-frames' };

    const baseline = frames.filter((f) => f.ms < 30).map((f) => f.rms);
    const baselineMax = baseline.length ? Math.max(...baseline) : 0;
    const active = frames.filter((f) => f.ms > 20 && f.ms < (releaseMs ?? 420));
    const peak = active.reduce(
      (best, frame) => frame.rms > best.rms ? frame : best,
      { ms: 0, rms: 0 },
    );
    const peakRms = peak.rms;

    const firstAbove = (ratio) => active.find((f) => f.rms >= peakRms * ratio)?.ms ?? null;
    const heldTail = active.filter((f) => f.ms >= Math.max(0, (releaseMs ?? 420) - 80));
    const sustainRms = heldTail.length
      ? heldTail.reduce((sum, f) => sum + f.rms, 0) / heldTail.length
      : null;

    const afterRelease = frames.filter((f) => releaseMs != null && f.ms >= releaseMs);
    const releaseBelow = (ratio) => {
      const hit = afterRelease.find((f) => f.rms <= peakRms * ratio);
      return hit && releaseMs != null ? hit.ms - releaseMs : null;
    };

    return {
      instrument: name,
      analyserAvailable: Boolean(window.__envelopeAnalyser),
      releaseMs: releaseMs == null ? null : Math.round(releaseMs * 10) / 10,
      peakMs: Math.round(peak.ms * 10) / 10,
      peakRms: Math.round(peakRms * 1e6) / 1e6,
      attack50Ms: firstAbove(0.5) == null ? null : Math.round(firstAbove(0.5) * 10) / 10,
      attack90Ms: firstAbove(0.9) == null ? null : Math.round(firstAbove(0.9) * 10) / 10,
      sustainRatio: sustainRms == null || !peakRms ? null : Math.round((sustainRms / peakRms) * 1000) / 1000,
      release50Ms: releaseBelow(0.5) == null ? null : Math.round(releaseBelow(0.5) * 10) / 10,
      release10Ms: releaseBelow(0.1) == null ? null : Math.round(releaseBelow(0.1) * 10) / 10,
      release02Ms: releaseBelow(0.02) == null ? null : Math.round(releaseBelow(0.02) * 10) / 10,
      compact: frames.filter((_, i) => i % 8 === 0).map((f) => ({
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
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });

  try {
    const page = await createPage(browser);
    try {
      const target = await keyboardTarget(page);
      if (!target) {
        const state = await page.evaluate(() => ({
          keyBtn: document.getElementById('keyBtn')?.className ?? null,
          keys: document.getElementById('keys')
            ? {
                tag: document.getElementById('keys').tagName,
                display: getComputedStyle(document.getElementById('keys')).display,
              }
            : null,
          octave: document.getElementById('octave')
            ? {
                tag: document.getElementById('octave').tagName,
                display: getComputedStyle(document.getElementById('octave')).display,
              }
            : null,
        }));
        console.log(JSON.stringify({ label: 'instrument-envelope', error: 'keyboard-unavailable', state }));
        return;
      }

      const results = [];
      for (const instrument of instruments) {
        results.push(await measureInstrument(page, instrument, target));
        await new Promise((resolve) => setTimeout(resolve, 120));
      }

      console.log(JSON.stringify({
        label: 'instrument-envelope',
        keyboard: {
          selector: target.selector,
          width: Math.round(target.box.width),
          height: Math.round(target.box.height),
        },
        results,
      }));
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
