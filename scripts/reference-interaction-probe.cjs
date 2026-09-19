const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

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

  await snapshot('initial');

  for (const id of ['p1', 'p2', 'p3']) {
    const el = await page.$('#' + id);
    if (!el) continue;
    const visible = await el.evaluate((node) => getComputedStyle(node).display !== 'none');
    if (!visible) {
      console.log(JSON.stringify({ label: 'program-click', id, visible: false }));
      continue;
    }
    await el.click();
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
  await page.click('#gridBtn');
  const gridAfter = await page.$eval('#gridBtn', (el) => el.className);
  console.log(JSON.stringify({ label: 'grid-toggle', before: gridBefore, after: gridAfter }));

  const colorsBefore = await page.$$eval('.swatch', (els) => els.map((el) => getComputedStyle(el).backgroundColor));
  await page.click('#shuffle');
  await new Promise((resolve) => setTimeout(resolve, 100));
  const colorsAfter = await page.$$eval('.swatch', (els) => els.map((el) => getComputedStyle(el).backgroundColor));
  console.log(JSON.stringify({ label: 'shuffle-colors', before: colorsBefore, after: colorsAfter }));

  for (const id of ['lockBtn', 'freeBtn']) {
    const before = await page.$eval('#' + id, (el) => ({ className: el.className, ariaLabel: el.getAttribute('aria-label') }));
    await page.click('#' + id);
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
    console.log(JSON.stringify({ label: 'mode-click', id, before, after }));
  }

  await snapshot('final');
} finally {
  await browser.close();
}
