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
    await page.evaluateOnNewDocument(() => {
      window.__listenerProbe = [];
      const original = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        try {
          if (typeof listener === 'function') {
            const source = Function.prototype.toString.call(listener);
            const target = this;
            const id = target && 'id' in target ? target.id || '' : '';
            const tag = target && 'tagName' in target ? target.tagName || '' : '';
            const aria = target && typeof target.getAttribute === 'function'
              ? target.getAttribute('aria-label') || ''
              : '';
            const interesting =
              source.includes('freestyle') ||
              ['lockBtn','octave','keyBtn','c'].includes(id) ||
              /key|octave|freestyle/i.test(aria);
            if (interesting) {
              const identifiers = [...new Set(
                (source.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [])
                  .filter((token) => ![
                    'function','return','if','else','true','false','null','undefined',
                    'const','let','var','this','event','preventDefault','stopPropagation'
                  ].includes(token))
              )].slice(0, 120);
              window.__listenerProbe.push({
                type,
                id,
                tag,
                aria,
                sourceHasFreestyle: source.includes('freestyle'),
                identifiers,
                length: source.length,
              });
            }
          }
        } catch {}
        return original.call(this, type, listener, options);
      };
    });

    await page.goto('https://playmusictheory.net/play', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await new Promise((resolve) => setTimeout(resolve, 700));

    const result = await page.evaluate(() => ({
      listeners: window.__listenerProbe ?? [],
      lockClass: document.getElementById('lockBtn')?.className ?? null,
    }));

    console.log(JSON.stringify({
      label: 'freestyle-listener-dependencies',
      result,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
