const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

(async () => {

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

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
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const snapshot = async (label) => {
    const state = await page.evaluate(() => {
      const info = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return {
          id,
          tag: el.tagName,
          className: el.className,
          text: (el.textContent || '').trim(),
          value: 'value' in el ? el.value : undefined,
          ariaLabel: el.getAttribute('aria-label'),
          dataTip: el.getAttribute('data-tip'),
          dataHint: el.getAttribute('data-hint'),
          hidden: el.hidden,
          display: getComputedStyle(el).display,
        };
      };

      const select = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return {
          value: el.value,
          selectedText: el.selectedOptions?.[0]?.textContent?.trim() ?? null,
          options: [...el.options].map((option) => ({
            value: option.value,
            text: option.textContent.trim(),
          })),
        };
      };

      return {
        key: select('keySel'),
        scale: select('scaleSel'),
        range: select('rangeSel'),
        quantize: select('beatSel'),
        swing: select('swingSel'),
        tune: info('tuneIn'),
        tempoRange: info('speed'),
        tempoNumber: info('bpmIn'),
        programs: ['p1', 'p2', 'p3'].map(info),
        beats: ['b1', 'b2', 'b3'].map(info),
        tools: ['pen', 'erase', 'undo', 'redo', 'clear', 'shuffle', 'recolorBtn', 'gridBtn'].map(info),
        modes: ['lockBtn', 'freeBtn', 'keyBtn'].map(info),
        backgrounds: ['sky', 'tileSky', 'tilePhoto', 'tilePlus'].map(info),
        fit: [...document.querySelectorAll('.fitopt')].map((el) => ({
          fit: el.getAttribute('data-fit'),
          className: el.className,
          ariaLabel: el.getAttribute('aria-label'),
        })),
        swatches: [...document.querySelectorAll('.swatch')].map((el) => ({
          ariaLabel: el.getAttribute('aria-label'),
          className: el.className,
          background: getComputedStyle(el).backgroundColor,
        })),
        canvas: info('c'),
      };
    });
    console.log(JSON.stringify({ label, state }));
    return state;
  };

  const domClick = async (selector) => page.evaluate((target) => {
    const element = document.querySelector(target);
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  }, selector);

  const canvasSwatchHistogram = async () => page.evaluate(() => {
    const canvas = document.getElementById('c');
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const swatches = [...document.querySelectorAll('.swatch')].map((el) => {
      const color = getComputedStyle(el).backgroundColor;
      const match = color.match(/\d+/g)?.map(Number) ?? [];
      return {
        label: el.getAttribute('aria-label') ?? '',
        rgb: match.slice(0, 3),
      };
    });
    const counts = Object.fromEntries(swatches.map((swatch) => [swatch.label, 0]));
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    for (let index = 0; index < pixels.length; index += 4) {
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      for (const swatch of swatches) {
        if (swatch.rgb[0] === r && swatch.rgb[1] === g && swatch.rgb[2] === b) {
          counts[swatch.label] += 1;
          break;
        }
      }
    }
    return counts;
  });

  const canvasDigest = async () => page.evaluate(() => {
    const canvas = document.getElementById('c');
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let hash = 2166136261 >>> 0;
    let nonTransparent = 0;
    let nonWhite = 0;
    const stride = Math.max(4, Math.floor(data.length / 25000 / 4) * 4);
    for (let i = 0; i < data.length; i += stride) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      if (a > 0) nonTransparent += 1;
      if (a > 0 && (r < 245 || g < 245 || b < 245)) nonWhite += 1;
      hash ^= r | (g << 8) | (b << 16) | (a << 24);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return { width, height, hash, nonTransparent, nonWhite };
  });

  await snapshot('initial');

  const readOctaveState = async () => page.evaluate(() => {
    const down = document.getElementById('octDown');
    const up = document.getElementById('octUp');
    const parent = down?.parentElement;
    return {
      text: parent?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      downDisabled: down instanceof HTMLButtonElement ? down.disabled : null,
      upDisabled: up instanceof HTMLButtonElement ? up.disabled : null,
    };
  });

  const octaveStates = [];
  octaveStates.push({ step: 'initial', ...(await readOctaveState()) });
  for (let i = 0; i < 12; i += 1) {
    await page.click('#octDown');
    await new Promise((resolve) => setTimeout(resolve, 30));
    octaveStates.push({ step: `down-${i + 1}`, ...(await readOctaveState()) });
  }
  for (let i = 0; i < 24; i += 1) {
    await page.click('#octUp');
    await new Promise((resolve) => setTimeout(resolve, 30));
    octaveStates.push({ step: `up-${i + 1}`, ...(await readOctaveState()) });
  }
  console.log(JSON.stringify({ label: 'octave-clamp', states: octaveStates }));


  for (const id of ['p1', 'p2', 'p3']) {
    const el = await page.$('#' + id);
    if (!el) continue;
    const visible = await el.evaluate((node) => getComputedStyle(node).display !== 'none');
    if (!visible) {
      console.log(JSON.stringify({ label: 'program-click', id, visible: false }));
      continue;
    }
    await domClick('#' + id);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const state = await page.evaluate(() => ({
      programs: ['p1', 'p2', 'p3'].map((id) => {
        const el = document.getElementById(id);
        return el ? { id, className: el.className } : null;
      }),
      canvasClass: document.getElementById('c')?.className ?? null,
      bodyClass: document.body.className,
      documentClass: document.documentElement.className,
    }));
    console.log(JSON.stringify({ label: 'program-click', id, visible: true, state }));
  }

  const gridBefore = await page.$eval('#gridBtn', (el) => el.className);
  await domClick('#gridBtn');
  await new Promise((resolve) => setTimeout(resolve, 100));
  const gridAfter = await page.$eval('#gridBtn', (el) => el.className);
  console.log(JSON.stringify({ label: 'grid-toggle', before: gridBefore, after: gridAfter }));

  const colorsBefore = await page.$$eval('.swatch', (els) => els.map((el) => getComputedStyle(el).backgroundColor));
  const canvasBeforeShuffle = await canvasDigest();
  await domClick('#shuffle');
  await new Promise((resolve) => setTimeout(resolve, 180));
  const colorsAfter = await page.$$eval('.swatch', (els) => els.map((el) => getComputedStyle(el).backgroundColor));
  const canvasAfterShuffle = await canvasDigest();
  console.log(JSON.stringify({
    label: 'shuffle',
    colorsBefore,
    colorsAfter,
    canvasBefore: canvasBeforeShuffle,
    canvasAfter: canvasAfterShuffle,
  }));

  const recolorBefore = await canvasDigest();
  const recolorHistogramBefore = await canvasSwatchHistogram();
  await domClick('#recolorBtn');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const recolorState = await page.$eval('#recolorBtn', (el) => el.className);
  await domClick('.swatch[aria-label="pluck"]');
  await new Promise((resolve) => setTimeout(resolve, 120));
  const recolorAfter = await canvasDigest();
  const recolorHistogramAfter = await canvasSwatchHistogram();
  console.log(JSON.stringify({
    label: 'recolor-existing-drawing',
    buttonClassAfterArm: recolorState,
    before: recolorBefore,
    after: recolorAfter,
    histogramBefore: recolorHistogramBefore,
    histogramAfter: recolorHistogramAfter,
  }));

  for (const id of ['lockBtn', 'freeBtn']) {
    const before = await page.$eval('#' + id, (el) => ({
      className: el.className,
      ariaLabel: el.getAttribute('aria-label'),
      display: getComputedStyle(el).display,
    }));
    const clicked = await domClick('#' + id);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const after = await page.evaluate(() => ({
      lock: {
        className: document.getElementById('lockBtn')?.className,
        ariaLabel: document.getElementById('lockBtn')?.getAttribute('aria-label'),
      },
      free: {
        className: document.getElementById('freeBtn')?.className,
        ariaLabel: document.getElementById('freeBtn')?.getAttribute('aria-label'),
      },
    }));
    console.log(JSON.stringify({ label: 'mode-click', id, clicked, before, after }));
  }

  const octaveState = async () => page.evaluate(() => {
    const down = document.getElementById('octDown');
    const up = document.getElementById('octUp');
    const parent = down?.parentElement;
    return {
      parentText: parent?.innerText?.replace(/\s+/g, ' ').trim() ?? null,
      downDisabled: down instanceof HTMLButtonElement ? down.disabled : null,
      upDisabled: up instanceof HTMLButtonElement ? up.disabled : null,
    };
  });

  const octaveInitial = await octaveState();
  for (let i = 0; i < 20; i += 1) await domClick('#octDown');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const octaveMin = await octaveState();
  for (let i = 0; i < 40; i += 1) await domClick('#octUp');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const octaveMax = await octaveState();
  console.log(JSON.stringify({ label: 'octave-bounds', initial: octaveInitial, min: octaveMin, max: octaveMax }));



  async function measureDrawVariant(label, toggleId) {
    await page.goto('https://playmusictheory.net/play', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (toggleId) {
      const visible = await page.$eval('#' + toggleId, (el) => getComputedStyle(el).display !== 'none');
      if (visible) await page.click('#' + toggleId);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    const canvas = await page.$('#c');
    if (!canvas) throw new Error('Reference canvas not found.');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Reference canvas has no bounding box.');

    const before = await page.$eval('#c', (node) => {
      const ctx = node.getContext('2d');
      return Array.from(ctx.getImageData(0, 0, node.width, node.height).data);
    });

    const path = [];
    const steps = 28;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = box.x + box.width * (0.12 + 0.76 * t);
      const yNorm = 0.23 + 0.46 * t + 0.055 * Math.sin(t * Math.PI * 5);
      const y = box.y + box.height * yNorm;
      path.push({ x, y });
    }

    await page.mouse.move(path[0].x, path[0].y);
    await page.mouse.down();
    for (const point of path.slice(1)) {
      await page.mouse.move(point.x, point.y, { steps: 2 });
    }
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 150));

    const result = await page.$eval('#c', (node, beforePixels) => {
      const ctx = node.getContext('2d');
      const after = ctx.getImageData(0, 0, node.width, node.height).data;
      const width = node.width;
      const height = node.height;
      const changed = [];
      for (let p = 0; p < after.length; p += 4) {
        const delta =
          Math.abs(after[p] - beforePixels[p]) +
          Math.abs(after[p + 1] - beforePixels[p + 1]) +
          Math.abs(after[p + 2] - beforePixels[p + 2]) +
          Math.abs(after[p + 3] - beforePixels[p + 3]);
        if (delta > 24) {
          const pixel = p / 4;
          changed.push({ x: pixel % width, y: Math.floor(pixel / width) });
        }
      }

      if (!changed.length) return { changed: 0, samples: [] };

      const minX = Math.min(...changed.map((p) => p.x));
      const maxX = Math.max(...changed.map((p) => p.x));
      const minY = Math.min(...changed.map((p) => p.y));
      const maxY = Math.max(...changed.map((p) => p.y));
      const samples = [];
      for (let i = 0; i <= 12; i += 1) {
        const targetX = Math.round(minX + ((maxX - minX) * i) / 12);
        const ys = changed
          .filter((p) => Math.abs(p.x - targetX) <= 2)
          .map((p) => p.y);
        samples.push({
          x: targetX,
          y: ys.length ? Math.round(ys.reduce((a, b) => a + b, 0) / ys.length) : null,
          count: ys.length,
        });
      }
      return {
        changed: changed.length,
        bbox: { minX, maxX, minY, maxY },
        samples,
      };
    }, before);

    const modeState = await page.evaluate(() => ({
      freestyle: document.getElementById('lockBtn')?.className ?? null,
      freehand: document.getElementById('freeBtn')?.className ?? null,
      program: ['p1', 'p2', 'p3'].map((id) => document.getElementById(id)?.className ?? null),
    }));

    console.log(JSON.stringify({ label: 'draw-variant', variant: label, toggleId, modeState, result }));
  }

  await measureDrawVariant('default', null);
  await measureDrawVariant('freestyle', 'lockBtn');
  await measureDrawVariant('freehand', 'freeBtn');


  await snapshot('final');
} finally {
  await browser.close();
}

})().catch((error) => {
  console.error(error);
  process.exit(1);
});
