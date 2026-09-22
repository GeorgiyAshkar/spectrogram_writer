const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

async function setupPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto('https://playmusictheory.net/play', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await new Promise((resolve) => setTimeout(resolve, 500));

  await page.evaluate(() => {
    const p2 = document.getElementById('p2');
    if (p2 instanceof HTMLElement) p2.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 120));
  return page;
}

async function setCase(page, config) {
  await page.evaluate((next) => {
    const setSelect = (id, value) => {
      const el = document.getElementById(id);
      if (!(el instanceof HTMLSelectElement)) return;
      el.value = String(value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setSelect('keySel', next.key);
    setSelect('scaleSel', next.scale);
    setSelect('rangeSel', next.range);
  }, config);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function clearAndStoreBaseline(page) {
  await page.evaluate(() => {
    const clear = document.getElementById('clear');
    if (clear instanceof HTMLElement) clear.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  await page.$eval('#c', (node) => {
    const ctx = node.getContext('2d');
    window.__pixelRowsBaseline = new Uint8ClampedArray(
      ctx.getImageData(0, 0, node.width, node.height).data,
    );
  });
}

async function measureSingleCell(page, box, yNorm) {
  await clearAndStoreBaseline(page);

  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * yNorm;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 1, y + 1);
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 22));

  return page.$eval('#c', (node) => {
    const before = window.__pixelRowsBaseline;
    const after = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;

    let minX = node.width;
    let maxX = -1;
    let minY = node.height;
    let maxY = -1;
    let changed = 0;

    for (let p = 0; p < after.length; p += 4) {
      const delta =
        Math.abs(after[p] - before[p]) +
        Math.abs(after[p + 1] - before[p + 1]) +
        Math.abs(after[p + 2] - before[p + 2]) +
        Math.abs(after[p + 3] - before[p + 3]);
      if (delta <= 30) continue;

      const pixel = p / 4;
      const px = pixel % node.width;
      const py = Math.floor(pixel / node.width);
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
      changed += 1;
    }

    if (!changed) return null;
    return {
      changed,
      bbox: {
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
      centerY: (minY + maxY) / 2,
      centerX: (minX + maxX) / 2,
    };
  });
}

function uniqueCenters(samples) {
  const sorted = samples
    .filter((sample) => sample.result?.centerY != null)
    .map((sample) => sample.result.centerY)
    .sort((a, b) => a - b);

  const unique = [];
  for (const value of sorted) {
    if (!unique.length || Math.abs(value - unique[unique.length - 1]) > 1) {
      unique.push(value);
    }
  }
  return unique;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const page = await setupPage(browser);
    const canvas = await page.$('#c');
    const box = await canvas?.boundingBox();
    if (!canvas || !box) throw new Error('Reference canvas unavailable.');

    const native = await page.$eval('#c', (node) => ({
      width: node.width,
      height: node.height,
      cssWidth: node.getBoundingClientRect().width,
      cssHeight: node.getBoundingClientRect().height,
    }));

    const cases = [
      { name: 'C-pentatonic-range1', key: '0', scale: 'pentatonic', range: '1' },
      { name: 'C-pentatonic-range3', key: '0', scale: 'pentatonic', range: '3' },
      { name: 'C-major-range3', key: '0', scale: 'major', range: '3' },
      { name: 'C-minor-range3', key: '0', scale: 'natural', range: '3' },
      { name: 'D-major-range3', key: '2', scale: 'major', range: '3' },
    ];

    const results = [];
    for (const config of cases) {
      await setCase(page, config);
      const samples = [];
      const sampleCount = 121;
      for (let index = 0; index < sampleCount; index += 1) {
        const y = 0.005 + (0.99 * index) / (sampleCount - 1);
        const result = await measureSingleCell(page, box, y);
        samples.push({
          y: Math.round(y * 10000) / 10000,
          result,
        });
      }

      const centers = uniqueCenters(samples);
      results.push({
        config,
        state: await page.evaluate(() => ({
          key: document.getElementById('keySel')?.value ?? null,
          scale: document.getElementById('scaleSel')?.value ?? null,
          range: document.getElementById('rangeSel')?.value ?? null,
        })),
        centerCount: centers.length,
        centers,
        deltas: centers.slice(1).map((value, index) =>
          Math.round((value - centers[index]) * 100) / 100
        ),
        normalizedCenters: centers.map((value) =>
          Math.round((value / native.height) * 100000) / 100000
        ),
      });
    }

    console.log(JSON.stringify({
      label: 'pixel-vertical-row-map',
      native,
      results,
    }));

    await page.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
