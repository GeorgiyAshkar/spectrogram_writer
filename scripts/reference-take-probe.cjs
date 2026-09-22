const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

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
      window.__takeProbe = [];
      const NativeMediaRecorder = window.MediaRecorder;
      if (!NativeMediaRecorder) return;

      const Wrapped = new Proxy(NativeMediaRecorder, {
        construct(target, args, newTarget) {
          const recorder = Reflect.construct(target, args, newTarget);
          const options = args[1] ?? null;
          window.__takeProbe.push({
            kind: 'construct',
            requestedMimeType: options?.mimeType ?? null,
            requestedBitsPerSecond: options?.bitsPerSecond ?? null,
            actualMimeType: recorder.mimeType || null,
            state: recorder.state,
          });

          recorder.addEventListener('start', () => {
            window.__takeProbe.push({
              kind: 'start',
              actualMimeType: recorder.mimeType || null,
              state: recorder.state,
            });
          });
          recorder.addEventListener('dataavailable', (event) => {
            window.__takeProbe.push({
              kind: 'dataavailable',
              type: event.data?.type || null,
              size: event.data?.size ?? null,
              state: recorder.state,
            });
          });
          recorder.addEventListener('stop', () => {
            window.__takeProbe.push({
              kind: 'stop',
              actualMimeType: recorder.mimeType || null,
              state: recorder.state,
            });
          });
          recorder.addEventListener('error', (event) => {
            window.__takeProbe.push({
              kind: 'error',
              name: event.error?.name ?? null,
              message: event.error?.message ?? null,
            });
          });

          return recorder;
        },
        get(target, prop, receiver) {
          return Reflect.get(target, prop, receiver);
        },
      });

      try {
        Object.defineProperty(window, 'MediaRecorder', {
          configurable: true,
          writable: true,
          value: Wrapped,
        });
      } catch {}
    });

    await page.goto('https://playmusictheory.net/play', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await new Promise((resolve) => setTimeout(resolve, 700));

    const initial = await page.evaluate(() => ({
      record: {
        className: document.getElementById('recpill')?.className ?? null,
        text: document.getElementById('recpill')?.textContent?.trim() ?? null,
        display: document.getElementById('recpill')
          ? getComputedStyle(document.getElementById('recpill')).display
          : null,
      },
      share: {
        hidden: document.getElementById('sharepill')?.hidden ?? null,
        display: document.getElementById('sharepill')
          ? getComputedStyle(document.getElementById('sharepill')).display
          : null,
      },
      supported: typeof MediaRecorder !== 'undefined',
      mimeSupport: typeof MediaRecorder !== 'undefined'
        ? [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4',
          ].map((type) => ({ type, supported: MediaRecorder.isTypeSupported(type) }))
        : [],
    }));

    const canvas = await page.$('#c');
    const box = await canvas?.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.35);
      await page.mouse.down();
      for (let i = 1; i <= 20; i += 1) {
        await page.mouse.move(
          box.x + box.width * (0.15 + 0.65 * (i / 20)),
          box.y + box.height * (0.35 + 0.18 * Math.sin(i / 3)),
        );
      }
      await page.mouse.up();
    }

    const clickRecord = async () => page.evaluate(() => {
      const el = document.getElementById('recpill');
      if (!(el instanceof HTMLElement)) return { found: false };
      const state = {
        found: true,
        className: el.className,
        text: el.textContent?.trim() ?? null,
        display: getComputedStyle(el).display,
      };
      el.click();
      return state;
    });

    const firstClick = await clickRecord();
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const mid = await page.evaluate(() => ({
      events: window.__takeProbe ?? [],
      recordClass: document.getElementById('recpill')?.className ?? null,
      recordText: document.getElementById('recpill')?.textContent?.trim() ?? null,
      shareHidden: document.getElementById('sharepill')?.hidden ?? null,
    }));

    const secondClick = await clickRecord();
    await new Promise((resolve) => setTimeout(resolve, 900));
    const final = await page.evaluate(() => ({
      events: window.__takeProbe ?? [],
      recordClass: document.getElementById('recpill')?.className ?? null,
      recordText: document.getElementById('recpill')?.textContent?.trim() ?? null,
      shareHidden: document.getElementById('sharepill')?.hidden ?? null,
      shareDisplay: document.getElementById('sharepill')
        ? getComputedStyle(document.getElementById('sharepill')).display
        : null,
    }));

    console.log(JSON.stringify({
      label: 'take-recorder-policy',
      initial,
      firstClick,
      mid,
      secondClick,
      final,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
