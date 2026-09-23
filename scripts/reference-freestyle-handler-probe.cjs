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

      const before = primitiveWindowState();
      const beforeClass = button.className;
      button.click();
      const after = primitiveWindowState();
      const afterClass = button.className;

      const changedWindow = [];
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (Object.is(before[key], after[key])) continue;
        changedWindow.push({ key, before: before[key], after: after[key] });
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
