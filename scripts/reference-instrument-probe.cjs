const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

async function main() {
const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

const instruments = ['keys', 'pluck', 'bell', 'marimba', 'flute', 'strings', 'chime', 'bass', '8bit'];

const browser = await puppeteer.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-gpu'],
});

async function openProbePage() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    const audioNodeProto = window.AudioNode?.prototype;
    if (!audioNodeProto || audioNodeProto.__instrumentProbePatched) return;
    Object.defineProperty(audioNodeProto, '__instrumentProbePatched', { value: true });

    const originalConnect = audioNodeProto.connect;
    audioNodeProto.connect = function (destination, ...args) {
      try {
        if (
          destination instanceof AudioDestinationNode &&
          !window.__instrumentAnalyser &&
          this.context?.createAnalyser
        ) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 16384;
          analyser.smoothingTimeConstant = 0;
          const silent = this.context.createGain();
          silent.gain.value = 0;
          originalConnect.call(this, analyser);
          originalConnect.call(analyser, silent);
          originalConnect.call(silent, destination);
          window.__instrumentAnalyser = analyser;
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
  return page;
}

async function measure(instrument) {
  const page = await openProbePage();
  try {
    await page.evaluate((id) => {
      const swatch = [...document.querySelectorAll('.swatch')].find(
        (el) => el.getAttribute('aria-label') === id,
      );
      if (swatch instanceof HTMLElement) swatch.click();
    }, instrument);

    const canvas = await page.$('#c');
    const box = await canvas?.boundingBox();
    if (!box) throw new Error('Reference canvas unavailable.');

    const y = box.y + box.height * 0.5;
    const startX = box.x + box.width * 0.16;
    const endX = box.x + box.width * 0.86;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    for (let i = 1; i <= 40; i += 1) {
      const x = startX + ((endX - startX) * i) / 40;
      await page.mouse.move(x, y, { steps: 1 });
    }
    await page.mouse.up();

    await page.click('#play');
    // The line starts ~0.64 beats into the loop at 120 BPM.
    await new Promise((resolve) => setTimeout(resolve, 380));

    const result = await page.evaluate(async () => {
      const analyser = window.__instrumentAnalyser;
      if (!analyser) return { analyserAvailable: false };

      const fft = new Float32Array(analyser.frequencyBinCount);
      const time = new Float32Array(analyser.fftSize);
      const frames = [];

      for (let frame = 0; frame < 30; frame += 1) {
        analyser.getFloatFrequencyData(fft);
        analyser.getFloatTimeDomainData(time);

        let rms = 0;
        for (let i = 0; i < time.length; i += 1) rms += time[i] * time[i];
        rms = Math.sqrt(rms / Math.max(1, time.length));

        const peaks = [];
        for (let i = 2; i < fft.length; i += 1) {
          const db = fft[i];
          if (!Number.isFinite(db) || db < -100) continue;
          if (db >= fft[i - 1] && db >= fft[i + 1]) {
            peaks.push({
              bin: i,
              hz: (i * analyser.context.sampleRate) / analyser.fftSize,
              db,
            });
          }
        }
        peaks.sort((a, b) => b.db - a.db);
        frames.push({
          elapsedMs: frame * 25,
          rms,
          peaks: peaks.slice(0, 14).map((peak) => ({
            hz: Math.round(peak.hz * 10) / 10,
            db: Math.round(peak.db * 10) / 10,
          })),
        });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      const activeFrames = frames.filter((frame) => frame.rms > 0.0005 && frame.peaks.length > 0);
      const representative = activeFrames[Math.min(activeFrames.length - 1, 5)] ?? frames[0];
      const fundamental =
        representative?.peaks
          ?.filter((peak) => peak.hz >= 70 && peak.hz <= 1500)
          .sort((a, b) => a.hz - b.hz)
          .find((peak) => {
            const strongest = representative.peaks[0]?.db ?? -Infinity;
            return peak.db >= strongest - 25;
          }) ?? representative?.peaks?.[0] ?? null;

      const harmonics = [];
      if (fundamental) {
        for (let n = 1; n <= 8; n += 1) {
          const target = fundamental.hz * n;
          const nearest = representative.peaks
            .map((peak) => ({ ...peak, delta: Math.abs(peak.hz - target) }))
            .sort((a, b) => a.delta - b.delta)[0];
          if (nearest && nearest.delta <= Math.max(8, target * 0.025)) {
            harmonics.push({
              n,
              hz: nearest.hz,
              db: nearest.db,
              relativeDb: Math.round((nearest.db - fundamental.db) * 10) / 10,
            });
          }
        }
      }

      return {
        analyserAvailable: true,
        sampleRate: analyser.context.sampleRate,
        fundamental,
        harmonics,
        rmsEnvelope: frames.map((frame) => ({
          ms: frame.elapsedMs,
          rms: Math.round(frame.rms * 100000) / 100000,
        })),
        frames: frames.slice(0, 12),
      };
    });

    console.log(JSON.stringify({ instrument, result }));
  } finally {
    await page.close();
  }
}

try {
  for (const instrument of instruments) {
    await measure(instrument);
  }
} finally {
  await browser.close();
}


}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
