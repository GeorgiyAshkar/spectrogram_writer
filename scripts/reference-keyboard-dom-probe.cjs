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
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
    await page.goto('https://playmusictheory.net/play', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 600));

    await page.evaluate(() => {
      const keyButton = document.getElementById('keyBtn');
      if (keyButton instanceof HTMLElement) keyButton.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 220));

    const candidates = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('*')];
      return nodes
        .map((node) => {
          const el = node;
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
          const id = el.id || '';
          const cls = typeof el.className === 'string' ? el.className : '';
          const aria = el.getAttribute('aria-label') || '';
          const title = el.getAttribute('title') || '';
          const hay = `${id} ${cls} ${aria} ${title} ${text}`.toLowerCase();
          if (!/(key|octave|piano|note|keyboard)/.test(hay)) return null;
          if (style.display === 'none' || style.visibility === 'hidden') return null;
          if (rect.width < 15 || rect.height < 15) return null;
          return {
            tag: el.tagName,
            id,
            className: cls,
            aria,
            title,
            text,
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            left: Math.round(rect.left * 10) / 10,
            top: Math.round(rect.top * 10) / 10,
          };
        })
        .filter(Boolean)
        .slice(0, 120);
    });

    console.log(JSON.stringify({
      label: 'keyboard-dom-candidates',
      candidates,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
