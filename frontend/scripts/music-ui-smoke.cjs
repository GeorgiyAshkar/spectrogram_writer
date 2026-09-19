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

    const gridInitial = await page.evaluate(
      () => [...document.querySelectorAll('button')].some(
        (button) => button.getAttribute('aria-label') === 'Grid' && button.classList.contains('is-active'),
      ),
    );
    if (!gridInitial) throw new Error('Grid must start enabled.');

    await clickByAria('Grid');
    const gridDisabled = await page.evaluate(
      () => [...document.querySelectorAll('button')].some(
        (button) => button.getAttribute('aria-label') === 'Grid' && !button.classList.contains('is-active'),
      ),
    );
    if (!gridDisabled) throw new Error('Grid did not toggle off.');
    await clickByAria('Grid');

    for (const accompaniment of ['Bass', 'Drums', 'Arpeggio']) {
      await clickByAria(accompaniment);
      const active = await page.evaluate(
        (label) => [...document.querySelectorAll('button')].some(
          (button) => button.getAttribute('aria-label') === label && button.classList.contains('is-active'),
        ),
        accompaniment,
      );
      if (!active) throw new Error(`${accompaniment} did not become active.`);
    }

    await clickByText('The instrument');
    await page.waitForSelector('.music-instrument-panel', { timeout: 5000 });
    const instrumentSelects = await page.$('.music-instrument-panel select');
    if (instrumentSelects.length < 4) {
      throw new Error(`The instrument opened with only ${instrumentSelects.length} selects.`);
    }

    const parityDefaults = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('.music-instrument-panel label')];
      const byCaption = (caption) => {
        const label = labels.find((node) => node.querySelector('span')?.textContent?.trim() === caption);
        const control = label?.querySelector('select, input');
        if (!control) return null;
        return {
          value: control.value,
          readOnly: control instanceof HTMLInputElement ? control.readOnly : undefined,
          options: control instanceof HTMLSelectElement
            ? [...control.options].map((option) => option.textContent?.trim())
            : undefined,
        };
      };

      return {
        key: byCaption('Key'),
        scale: byCaption('Scale'),
        range: byCaption('Range'),
        quantize: byCaption('Quantize'),
        swing: byCaption('Swing'),
        tempoInputs: [...document.querySelectorAll('.music-instrument-panel input[aria-label="Tempo BPM"]')]
          .map((input) => ({
            value: input.value,
            readOnly: input.readOnly,
          })),
      };
    });

    if (parityDefaults.key?.value !== 'C') throw new Error(`Unexpected default Key: ${parityDefaults.key?.value}`);
    if (parityDefaults.scale?.value !== 'majorPentatonic') throw new Error(`Unexpected default Scale: ${parityDefaults.scale?.value}`);
    if (parityDefaults.range?.value !== '3') throw new Error(`Unexpected default Range: ${parityDefaults.range?.value}`);
    if (parityDefaults.quantize?.options?.join('|') !== '1/4|1/8|1/8 triplet|1/16|1/16 triplet|1/32') {
      throw new Error(`Unexpected Quantize options: ${parityDefaults.quantize?.options?.join('|')}`);
    }
    if (parityDefaults.swing?.options?.join('|') !== 'Off|Light|Medium|Hard') {
      throw new Error(`Unexpected Swing options: ${parityDefaults.swing?.options?.join('|')}`);
    }
    if (!parityDefaults.tempoInputs.some((input) => input.value === '120' && input.readOnly)) {
      throw new Error(`Readonly Tempo 120 display missing: ${JSON.stringify(parityDefaults.tempoInputs)}`);
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

    const mobilePage = await browser.newPage();
    const mobileErrors = [];
    mobilePage.on('pageerror', (error) => mobileErrors.push(String(error)));
    await mobilePage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await mobilePage.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const mobileClickByAria = async (label) => {
      const clicked = await mobilePage.evaluate((target) => {
        const element = [...document.querySelectorAll('button')].find(
          (button) => button.getAttribute('aria-label') === target,
        );
        if (!(element instanceof HTMLButtonElement)) return false;
        element.click();
        return true;
      }, label);
      if (!clicked) throw new Error(`Mobile button with aria-label "${label}" not found.`);
    };

    const mobileClickByText = async (text) => {
      const clicked = await mobilePage.evaluate((target) => {
        const element = [...document.querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === target,
        );
        if (!(element instanceof HTMLButtonElement)) return false;
        element.click();
        return true;
      }, text);
      if (!clicked) throw new Error(`Mobile button with text "${text}" not found.`);
    };

    await mobileClickByAria('Музыкальный режим');
    await mobilePage.waitForSelector('.music-panel', { timeout: 5000 });
    await mobilePage.waitForSelector('.music-draw-canvas', { timeout: 5000 });

    const mobileLayout = await mobilePage.evaluate(() => {
      const canvas = document.querySelector('.music-draw-canvas')?.getBoundingClientRect();
      const panel = document.querySelector('.music-panel')?.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        canvasWidth: canvas?.width ?? null,
        panelWidth: panel?.width ?? null,
      };
    });

    if (mobileLayout.documentWidth > mobileLayout.viewportWidth + 2) {
      throw new Error(`Mobile document overflows horizontally: ${JSON.stringify(mobileLayout)}`);
    }
    if (mobileLayout.canvasWidth && mobileLayout.canvasWidth > mobileLayout.viewportWidth + 2) {
      throw new Error(`Mobile music canvas exceeds viewport: ${JSON.stringify(mobileLayout)}`);
    }

    for (const label of ['Grid', 'Freehand', 'Pen', 'Eraser', 'Undo', 'Redo', 'Restart', 'Shuffle']) {
      const exists = await mobilePage.evaluate(
        (target) => [...document.querySelectorAll('button')].some(
          (button) => button.getAttribute('aria-label') === target,
        ),
        label,
      );
      if (!exists) throw new Error(`Mobile control missing: ${label}`);
    }

    await mobileClickByText('The instrument');
    await mobilePage.waitForSelector('.music-instrument-panel', { timeout: 5000 });
    const instrumentPanelLayout = await mobilePage.$eval('.music-instrument-panel', (node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        viewportWidth: window.innerWidth,
      };
    });
    if (instrumentPanelLayout.left < -2 || instrumentPanelLayout.right > instrumentPanelLayout.viewportWidth + 2) {
      throw new Error(`Mobile instrument panel escapes viewport: ${JSON.stringify(instrumentPanelLayout)}`);
    }

    await mobileClickByText('Recolor');
    await mobilePage.evaluate(() => {
      const swatch = document.querySelector('button[aria-label="keys"]');
      if (swatch instanceof HTMLButtonElement) swatch.click();
    });
    await mobilePage.waitForSelector('.music-recolor-picker', { timeout: 5000 });
    const recolorLayout = await mobilePage.$eval('.music-recolor-picker', (node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        viewportWidth: window.innerWidth,
      };
    });
    if (recolorLayout.left < -2 || recolorLayout.right > recolorLayout.viewportWidth + 2) {
      throw new Error(`Mobile recolor picker escapes viewport: ${JSON.stringify(recolorLayout)}`);
    }

    if (mobileErrors.length) {
      throw new Error(`Mobile browser page errors: ${mobileErrors.join(' | ')}`);
    }

    await mobilePage.close();
    console.log('music-ui-smoke: desktop + mobile passed');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
