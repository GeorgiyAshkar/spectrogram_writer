const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    await page.goto('https://playmusictheory.net/play', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await new Promise((resolve) => setTimeout(resolve, 650));

    const result = await page.evaluate(() => {
      const primitiveWindowState = () => {
        const out = {};
        for (const key of Object.getOwnPropertyNames(window)) {
          if (key.startsWith('webkit') || key.startsWith('on')) continue;
          try {
            const value = window[key];
            if (
              value === null ||
              typeof value === 'boolean' ||
              typeof value === 'number' ||
              typeof value === 'string'
            ) {
              out[key] = value;
            }
          } catch {}
        }
        return out;
      };

      const button = document.getElementById('lockBtn');
      if (!(button instanceof HTMLElement)) {
        return { error: 'lockBtn missing' };
      }

      const handlerText = typeof button.onclick === 'function'
        ? Function.prototype.toString.call(button.onclick)
        : '';
      const identifiers = [...new Set(
        (handlerText.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [])
          .filter((token) => ![
            'function','return','if','else','true','false','null','undefined',
            'const','let','var','classList','toggle','contains','add','remove',
            'document','window','this'
          ].includes(token))
      )].slice(0, 80);

      const octave = document.getElementById('octave');
      const captureCanvas = () => {
        if (!(octave instanceof HTMLCanvasElement)) return null;
        const ctx = octave.getContext('2d');
        if (!ctx) return null;
        const data = ctx.getImageData(0, 0, octave.width, octave.height).data;
        return {
          width: octave.width,
          height: octave.height,
          rgba: Array.from(data),
        };
      };

      const drawOps = [];
      const ctxProto = CanvasRenderingContext2D.prototype;
      const originalFillRect = ctxProto.fillRect;
      const originalStrokeRect = ctxProto.strokeRect;
      const originalFillText = ctxProto.fillText;

      ctxProto.fillRect = function(x, y, w, h) {
        if (this.canvas?.id === 'octave') {
          drawOps.push({ kind: 'fillRect', x, y, w, h, style: String(this.fillStyle) });
        }
        return originalFillRect.call(this, x, y, w, h);
      };
      ctxProto.strokeRect = function(x, y, w, h) {
        if (this.canvas?.id === 'octave') {
          drawOps.push({ kind: 'strokeRect', x, y, w, h, style: String(this.strokeStyle) });
        }
        return originalStrokeRect.call(this, x, y, w, h);
      };
      ctxProto.fillText = function(text, x, y, maxWidth) {
        if (this.canvas?.id === 'octave') {
          drawOps.push({ kind: 'fillText', text: String(text), x, y, style: String(this.fillStyle) });
        }
        return maxWidth === undefined
          ? originalFillText.call(this, text, x, y)
          : originalFillText.call(this, text, x, y, maxWidth);
      };

      const eventIdentifiers = {};
      if (octave instanceof HTMLElement) {
        for (const prop of ['onclick','onmousedown','onmouseup','onmousemove','onpointerdown','onpointerup','onpointermove','ontouchstart','ontouchend']) {
          const fn = octave[prop];
          if (typeof fn !== 'function') continue;
          const text = Function.prototype.toString.call(fn);
          eventIdentifiers[prop] = [...new Set(
            (text.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [])
              .filter((token) => !['function','return','if','else','true','false','null','undefined','const','let','var','this'].includes(token))
          )].slice(0, 80);
        }
      }

      const beforeCanvas = captureCanvas();
      const before = primitiveWindowState();
      const beforeClass = button.className;
      button.click();
      const after = primitiveWindowState();
      const afterClass = button.className;
      const afterCanvas = captureCanvas();

      ctxProto.fillRect = originalFillRect;
      ctxProto.strokeRect = originalStrokeRect;
      ctxProto.fillText = originalFillText;

      const changedWindow = [];
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (Object.is(before[key], after[key])) continue;
        changedWindow.push({ key, before: before[key], after: after[key] });
      }

      let canvasDiff = null;
      if (beforeCanvas && afterCanvas && beforeCanvas.rgba.length === afterCanvas.rgba.length) {
        let changedPixels = 0;
        const perX = new Array(beforeCanvas.width).fill(0);
        let minX = beforeCanvas.width;
        let maxX = -1;
        let minY = beforeCanvas.height;
        let maxY = -1;
        for (let i = 0; i < beforeCanvas.rgba.length; i += 4) {
          let changed = false;
          for (let channel = 0; channel < 4; channel += 1) {
            if (beforeCanvas.rgba[i + channel] !== afterCanvas.rgba[i + channel]) {
              changed = true;
              break;
            }
          }
          if (!changed) continue;
          const pixel = i / 4;
          const x = pixel % beforeCanvas.width;
          const y = Math.floor(pixel / beforeCanvas.width);
          changedPixels += 1;
          perX[x] += 1;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        canvasDiff = {
          width: beforeCanvas.width,
          height: beforeCanvas.height,
          changedPixels,
          bounds: changedPixels ? { minX, maxX, minY, maxY } : null,
          activeColumns: perX
            .map((count, x) => ({ x, count }))
            .filter((entry) => entry.count > 0),
        };
      }

      const attrs = {};
      for (const attr of button.attributes) attrs[attr.name] = attr.value;

      return {
        handlerAssigned: typeof button.onclick === 'function',
        handlerIdentifiers: identifiers,
        handlerLength: handlerText.length,
        beforeClass,
        afterClass,
        changedWindow,
        attrs,
        octaveEventIdentifiers: eventIdentifiers,
        canvasDiff,
        drawOps: drawOps.slice(0, 160),
      };
    });

    console.log(JSON.stringify({
      label: 'freestyle-handler-state',
      result,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
