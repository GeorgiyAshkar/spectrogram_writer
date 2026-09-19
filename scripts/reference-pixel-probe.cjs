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
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.evaluate(() => {
      const p2 = document.getElementById('p2');
      if (p2 instanceof HTMLElement) p2.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 150));

    const canvas = await page.$('#c');
    const box = await canvas?.boundingBox();
    if (!canvas || !box) throw new Error('Reference canvas unavailable.');

    const native = await page.$eval('#c', (node) => ({
      width: node.width,
      height: node.height,
      cssWidth: node.getBoundingClientRect().width,
      cssHeight: node.getBoundingClientRect().height,
    }));

    const storeBaseline = async () => page.$eval('#c', (node) => {
      const ctx = node.getContext('2d');
      window.__pixelProbeBaseline = new Uint8ClampedArray(
        ctx.getImageData(0, 0, node.width, node.height).data,
      );
      return true;
    });

    const diffFromBaseline = async () => page.$eval('#c', (node) => {
      const previous = window.__pixelProbeBaseline;
      const after = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
      if (!previous || previous.length !== after.length) {
        window.__pixelProbeBaseline = new Uint8ClampedArray(after);
        return { changed: 0, bbox: null, distinctX: 0, distinctY: 0 };
      }

      let changed = 0;
      let minX = node.width;
      let maxX = -1;
      let minY = node.height;
      let maxY = -1;
      const xSet = new Set();
      const ySet = new Set();

      for (let p = 0; p < after.length; p += 4) {
        const delta =
          Math.abs(after[p] - previous[p]) +
          Math.abs(after[p + 1] - previous[p + 1]) +
          Math.abs(after[p + 2] - previous[p + 2]) +
          Math.abs(after[p + 3] - previous[p + 3]);
        if (delta <= 30) continue;

        const pixel = p / 4;
        const x = pixel % node.width;
        const y = Math.floor(pixel / node.width);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        xSet.add(x);
        ySet.add(y);
        changed += 1;
      }

      window.__pixelProbeBaseline = new Uint8ClampedArray(after);
      if (!changed) return { changed: 0, bbox: null, distinctX: 0, distinctY: 0 };
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
        distinctX: xSet.size,
        distinctY: ySet.size,
      };
    });

    const probes = [];
    for (const [index, point] of [
      [0, { x: 0.24, y: 0.28 }],
      [1, { x: 0.51, y: 0.53 }],
      [2, { x: 0.77, y: 0.72 }],
    ]) {
      await storeBaseline();
      const x = box.x + box.width * point.x;
      const y = box.y + box.height * point.y;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 1, y + 1);
      await page.mouse.up();
      await new Promise((resolve) => setTimeout(resolve, 80));
      probes.push({
        index,
        normalized: point,
        result: await diffFromBaseline(),
      });
    }

    // Probe vertical snap centers at a fixed X.
    const verticalSnapMap = [];
    for (let step = 0; step <= 20; step += 1) {
      const yNorm = 0.02 + (0.96 * step) / 20;
      await storeBaseline();
      const x = box.x + box.width * 0.5;
      const y = box.y + box.height * yNorm;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 1, y + 1);
      await page.mouse.up();
      await new Promise((resolve) => setTimeout(resolve, 30));
      const result = await diffFromBaseline();
      verticalSnapMap.push({
        y: Math.round(yNorm * 1000) / 1000,
        bbox: result.bbox,
        centerY: result.bbox ? (result.bbox.minY + result.bbox.maxY) / 2 : null,
      });
    }

    // Probe horizontal snap centers at a fixed Y.
    const horizontalSnapMap = [];
    for (let step = 0; step <= 24; step += 1) {
      const xNorm = 0.02 + (0.96 * step) / 24;
      await storeBaseline();
      const x = box.x + box.width * xNorm;
      const y = box.y + box.height * 0.5;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 1, y + 1);
      await page.mouse.up();
      await new Promise((resolve) => setTimeout(resolve, 25));
      const result = await diffFromBaseline();
      horizontalSnapMap.push({
        x: Math.round(xNorm * 1000) / 1000,
        bbox: result.bbox,
        centerX: result.bbox ? (result.bbox.minX + result.bbox.maxX) / 2 : null,
      });
    }

    // Horizontal drag reveals the step spacing between adjacent pixel cells.
    await storeBaseline();
    const y = box.y + box.height * 0.42;
    const x0 = box.x + box.width * 0.12;
    const x1 = box.x + box.width * 0.88;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    for (let i = 1; i <= 80; i += 1) {
      await page.mouse.move(x0 + ((x1 - x0) * i) / 80, y);
    }
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const horizontal = await page.$eval('#c', (node) => {
      const previous = window.__pixelProbeBaseline;
      const after = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
      const byX = new Map();
      if (!previous || previous.length !== after.length) {
        return { activeXCount: 0, runs: [] };
      }
      for (let p = 0; p < after.length; p += 4) {
        const delta =
          Math.abs(after[p] - previous[p]) +
          Math.abs(after[p + 1] - previous[p + 1]) +
          Math.abs(after[p + 2] - previous[p + 2]) +
          Math.abs(after[p + 3] - previous[p + 3]);
        if (delta <= 30) continue;
        const pixel = p / 4;
        const x = pixel % node.width;
        byX.set(x, (byX.get(x) ?? 0) + 1);
      }
      const activeX = [...byX.entries()]
        .filter(([, count]) => count >= 2)
        .map(([x]) => x)
        .sort((a, b) => a - b);

      const runs = [];
      for (const x of activeX) {
        const last = runs[runs.length - 1];
        if (!last || x > last.end + 1) runs.push({ start: x, end: x });
        else last.end = x;
      }
      return {
        activeXCount: activeX.length,
        runs: runs.map((run) => ({
          ...run,
          width: run.end - run.start + 1,
        })).slice(0, 100),
      };
    });

    console.log(JSON.stringify({
      label: 'pixel-mode-geometry',
      native,
      program2Class: await page.$eval('#p2', (el) => el.className),
      probes,
      verticalSnapMap,
      horizontalSnapMap,
      horizontal,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
