const puppeteer = require('/tmp/music-ui-smoke/node_modules/puppeteer-core');

(async () => {
  const executablePath = process.argv[2];
  const baseUrl = process.argv[3] || 'http://127.0.0.1:4173';
  if (!executablePath) throw new Error('Chrome executable path is required.');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const clickByAria = async (label) => {
      const clicked = await page.evaluate((target) => {
        const element = [...document.querySelectorAll('button')].find(
          (button) => button.getAttribute('aria-label') === target,
        );
        if (!(element instanceof HTMLButtonElement)) return false;
        element.click();
        return true;
      }, label);
      if (!clicked) throw new Error(`Button with aria-label "${label}" not found.`);
    };

    const clickByText = async (text) => {
      const clicked = await page.evaluate((target) => {
        const element = [...document.querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === target,
        );
        if (!(element instanceof HTMLButtonElement)) return false;
        element.click();
        return true;
      }, text);
      if (!clicked) throw new Error(`Button with text "${text}" not found.`);
    };

    await clickByAria('Музыкальный режим');
    await page.waitForSelector('.music-panel', { timeout: 5000 });
    await page.waitForSelector('.music-draw-canvas', { timeout: 5000 });

    const canvas = await page.$('.music-draw-canvas');
    await canvas?.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'center' }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    const box = await canvas?.boundingBox();
    if (!box) throw new Error('Music canvas is not measurable.');

    const y = box.y + box.height * 0.38;
    const startX = box.x + box.width * 0.12;
    const endX = box.x + box.width * 0.72;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    for (let i = 1; i <= 24; i += 1) {
      await page.mouse.move(startX + ((endX - startX) * i) / 24, y + Math.sin(i / 4) * 14);
    }
    await page.mouse.up();

    try {
      await page.waitForFunction(
        () => [...document.querySelectorAll('.music-event-summary span')].some(
          (node) => /Линий:\s*1/.test(node.textContent || ''),
        ),
        { timeout: 5000 },
      );
    } catch (error) {
      const diagnostics = await page.evaluate(() => ({
        summary: [...document.querySelectorAll('.music-event-summary span')].map((node) => node.textContent),
        canvasRect: document.querySelector('.music-draw-canvas')?.getBoundingClientRect().toJSON?.() ?? null,
        scrollY: window.scrollY,
      }));
      throw new Error(`Drawing did not create a stroke: ${JSON.stringify(diagnostics)}; ${error}`);
    }

    const undoButton = await page.$('button[title="Undo the last drawing action"]');
    if (!undoButton) throw new Error('Undo button not found.');
    await undoButton.click();
    await page.waitForFunction(
      () => [...document.querySelectorAll('.music-event-summary span')].some(
        (node) => /Линий:\s*0/.test(node.textContent || ''),
      ),
      { timeout: 5000 },
    );

    const redoButton = await page.$('button[title="Redo a drawing action"]');
    if (!redoButton) throw new Error('Redo button not found.');
    await redoButton.click();
    await page.waitForFunction(
      () => [...document.querySelectorAll('.music-event-summary span')].some(
        (node) => /Линий:\s*1/.test(node.textContent || ''),
      ),
      { timeout: 5000 },
    );

    await clickByAria('Pixel mode');
    const pixelActive = await page.evaluate(
      () => [...document.querySelectorAll('button')].some(
        (button) => button.getAttribute('aria-label') === 'Pixel mode' && button.classList.contains('is-active'),
      ),
    );
    if (!pixelActive) throw new Error('Pixel mode did not become active.');

    await clickByAria('Freehand');
    const freehandActive = await page.evaluate(
      () => [...document.querySelectorAll('button')].some(
        (button) => button.getAttribute('aria-label') === 'Freehand' && button.classList.contains('is-active'),
      ),
    );
    if (!freehandActive) throw new Error('Freehand did not become active.');

    await clickByText('The instrument');
    await page.waitForSelector('.music-instrument-panel', { timeout: 5000 });
    const instrumentSelects = await page.$$('.music-instrument-panel select');
    if (instrumentSelects.length < 4) {
      throw new Error(`The instrument opened with only ${instrumentSelects.length} selects.`);
    }

    await clickByText('Recolor');
    await page.evaluate(() => {
      const swatch = document.querySelector('button[aria-label="keys"]');
      if (!(swatch instanceof HTMLButtonElement)) throw new Error('keys swatch missing');
      swatch.click();
    });
    await page.waitForSelector('.music-recolor-picker', { timeout: 5000 });
    const presetCount = await page.$$eval('.music-recolor-preset:not(.music-recolor-preset--custom)', (nodes) => nodes.length);
    if (presetCount !== 27) throw new Error(`Expected 27 recolor presets, got ${presetCount}.`);

    await clickByText('Shuffle');
    await page.waitForFunction(
      () => [...document.querySelectorAll('.music-event-summary span')].some((node) => {
        const match = /Линий:\s*(\d+)/.exec(node.textContent || '');
        return Boolean(match && Number(match[1]) >= 5);
      }),
      { timeout: 5000 },
    );

    if (pageErrors.length) {
      throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
    }

    console.log('music-ui-smoke: passed');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
