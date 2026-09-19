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

    const capture = async () => page.$eval('#c', (node) =>
      Array.from(node.getContext('2d').getImageData(0, 0, node.width, node.height).data)
    );

    const diff = async (before) => page.$eval('#c', (node, previous) => {
      const after = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
      const xs = [];
      const ys = [];
      let changed = 0;
      for (let p = 0; p < after.length; p += 4) {
        const delta =
          Math.abs(after[p] - previous[p]) +
          Math.abs(after[p + 1] - previous[p + 1]) +
          Math.abs(after[p + 2] - previous[p + 2]) +
          Math.abs(after[p + 3] - previous[p + 3]);
        if (delta > 30) {
          const pixel = p / 4;
          xs.push(pixel % node.width);
          ys.push(Math.floor(pixel / node.width));
          changed += 1;
        }
      }
      if (!changed) return { changed: 0, bbox: null, distinctX: 0, distinctY: 0 };
      const xSet = new Set(xs);
      const ySet = new Set(ys);
      return {
        changed,
        bbox: {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
          width: Math.max(...xs) - Math.min(...xs) + 1,
          height: Math.max(...ys) - Math.min(...ys) + 1,
        },
        distinctX: xSet.size,
        distinctY: ySet.size,
      };
    }, before);

    const probes = [];
    for (const [index, point] of [
      [0, { x: 0.24, y: 0.28 }],
      [1, { x: 0.51, y: 0.53 }],
      [2, { x: 0.77, y: 0.72 }],
    ]) {
      const before = await capture();
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
        result: await diff(before),
      });
    }

    // Horizontal drag reveals the step spacing between adjacent pixel cells.
    const beforeDrag = await capture();
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

    const horizontal = await page.$eval('#c', (node, previous) => {
      const after = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
      const byX = new Map();
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
    }, beforeDrag);

    console.log(JSON.stringify({
      label: 'pixel-mode-geometry',
      native,
      program2Class: await page.$eval('#p2', (el) => el.className),
      probes,
      horizontal,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
