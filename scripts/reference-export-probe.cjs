const puppeteer = require('/tmp/parity-probe/node_modules/puppeteer-core');

const executablePath = process.argv[2];
if (!executablePath) throw new Error('Chrome executable path is required.');

function readVarLen(buffer, state) {
  let value = 0;
  for (let i = 0; i < 4; i += 1) {
    const byte = buffer[state.offset++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  return value;
}

function parseMidi(base64) {
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.toString('ascii', 0, 4) !== 'MThd') {
    return { error: 'not-midi', bytes: buffer.length, prefix: buffer.subarray(0, 16).toString('hex') };
  }
  const headerLength = buffer.readUInt32BE(4);
  const format = buffer.readUInt16BE(8);
  const trackCount = buffer.readUInt16BE(10);
  const division = buffer.readUInt16BE(12);
  let offset = 8 + headerLength;
  const tracks = [];

  for (let trackIndex = 0; trackIndex < trackCount && offset + 8 <= buffer.length; trackIndex += 1) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32BE(offset + 4);
    offset += 8;
    const end = Math.min(buffer.length, offset + length);
    const state = { offset };
    let tick = 0;
    let runningStatus = null;
    const events = [];

    while (state.offset < end) {
      const delta = readVarLen(buffer, state);
      tick += delta;
      if (state.offset >= end) break;
      let status = buffer[state.offset++];
      if (status < 0x80) {
        if (runningStatus == null) break;
        state.offset -= 1;
        status = runningStatus;
      } else if (status < 0xf0) {
        runningStatus = status;
      }

      if (status === 0xff) {
        const type = buffer[state.offset++];
        const size = readVarLen(buffer, state);
        const data = buffer.subarray(state.offset, Math.min(end, state.offset + size));
        state.offset += size;
        if (type === 0x51 && data.length === 3) {
          const usPerQuarter = (data[0] << 16) | (data[1] << 8) | data[2];
          events.push({ tick, type: 'tempo', bpm: Math.round((60000000 / usPerQuarter) * 1000) / 1000 });
        } else if (type === 0x03) {
          events.push({ tick, type: 'track-name', value: data.toString('utf8') });
        } else if (type === 0x2f) {
          events.push({ tick, type: 'end' });
        }
        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        const size = readVarLen(buffer, state);
        state.offset += size;
        continue;
      }

      const command = status & 0xf0;
      const channel = status & 0x0f;
      if (command === 0x80 || command === 0x90) {
        const note = buffer[state.offset++];
        const velocity = buffer[state.offset++];
        const on = command === 0x90 && velocity > 0;
        events.push({ tick, type: on ? 'note-on' : 'note-off', channel: channel + 1, note, velocity });
      } else if (command === 0xa0 || command === 0xb0 || command === 0xe0) {
        state.offset += 2;
      } else if (command === 0xc0 || command === 0xd0) {
        state.offset += 1;
      } else {
        break;
      }
    }

    const noteEvents = events.filter((event) => event.type === 'note-on' || event.type === 'note-off');
    tracks.push({
      id,
      length,
      events,
      noteOns: noteEvents.filter((event) => event.type === 'note-on'),
      channels: [...new Set(noteEvents.map((event) => event.channel))],
      notes: [...new Set(noteEvents.filter((event) => event.type === 'note-on').map((event) => event.note))],
    });
    offset = end;
  }

  return {
    bytes: buffer.length,
    format,
    trackCount,
    division,
    tracks,
  };
}

function parseWav(base64) {
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return { error: 'not-wav', bytes: buffer.length, prefix: buffer.subarray(0, 16).toString('hex') };
  }
  let offset = 12;
  let channels = null;
  let sampleRate = null;
  let bitsPerSample = null;
  let data = null;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ' && size >= 16) {
      channels = buffer.readUInt16LE(start + 2);
      sampleRate = buffer.readUInt32LE(start + 4);
      bitsPerSample = buffer.readUInt16LE(start + 14);
    } else if (id === 'data') {
      data = buffer.subarray(start, Math.min(buffer.length, start + size));
      break;
    }
    offset = start + size + (size % 2);
  }

  let rms = null;
  let peak = null;
  if (data && bitsPerSample === 16) {
    let sumSq = 0;
    let max = 0;
    let count = 0;
    for (let i = 0; i + 1 < data.length; i += 2) {
      const sample = data.readInt16LE(i) / 32768;
      sumSq += sample * sample;
      max = Math.max(max, Math.abs(sample));
      count += 1;
    }
    rms = count ? Math.sqrt(sumSq / count) : 0;
    peak = max;
  }

  return {
    bytes: buffer.length,
    channels,
    sampleRate,
    bitsPerSample,
    dataBytes: data?.length ?? 0,
    rms: rms == null ? null : Math.round(rms * 1e6) / 1e6,
    peak: peak == null ? null : Math.round(peak * 1e6) / 1e6,
    pcmBase64: data?.toString('base64') ?? null,
  };
}

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    window.__capturedDownloads = [];
    const blobMap = new Map();
    const originalCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (blob) {
      const url = originalCreate(blob);
      if (blob instanceof Blob) blobMap.set(url, blob);
      return url;
    };

    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (...args) {
      const href = this.href;
      const name = this.download || 'download';
      const blob = blobMap.get(href);
      if (blob) {
        blob.arrayBuffer().then((arrayBuffer) => {
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          window.__capturedDownloads.push({
            name,
            type: blob.type,
            size: blob.size,
            base64: btoa(binary),
          });
        });
        return;
      }
      return originalClick.apply(this, args);
    };
  });
  await page.goto('https://playmusictheory.net/play', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 700));
  return page;
}

async function waitForDownload(page, previousCount, timeoutMs = 6000) {
  await page.waitForFunction(
    (count) => Array.isArray(window.__capturedDownloads) && window.__capturedDownloads.length > count,
    { timeout: timeoutMs },
    previousCount,
  );
  return page.evaluate(() => window.__capturedDownloads[window.__capturedDownloads.length - 1]);
}

async function clickId(page, id) {
  const result = await page.evaluate((target) => {
    const el = document.getElementById(target);
    if (!(el instanceof HTMLElement)) return { found: false, display: null, disabled: null };
    const display = getComputedStyle(el).display;
    const disabled = 'disabled' in el ? Boolean(el.disabled) : false;
    if (display !== 'none' && !disabled) el.click();
    return { found: true, display, disabled, className: el.className, text: el.textContent?.trim() ?? '' };
  }, id);
  return result;
}

async function enableInstrumentIfPossible(page) {
  const before = await page.evaluate(() => {
    const el = document.getElementById('proswitch');
    return el ? {
      className: el.className,
      text: el.textContent?.trim() ?? '',
      ariaPressed: el.getAttribute('aria-pressed'),
    } : null;
  });
  const click = await clickId(page, 'proswitch');
  await new Promise((resolve) => setTimeout(resolve, 180));
  const after = await page.evaluate(() => {
    const el = document.getElementById('proswitch');
    const dialogs = [...document.querySelectorAll('[role="dialog"], dialog, .modal, .paywall, .purchase')]
      .filter((node) => getComputedStyle(node).display !== 'none')
      .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240));
    return el ? {
      className: el.className,
      text: el.textContent?.trim() ?? '',
      ariaPressed: el.getAttribute('aria-pressed'),
      dialogs,
    } : { dialogs };
  });
  return { before, click, after };
}

async function captureMidiCase(browser, label, enableId) {
  const page = await createPage(browser);
  try {
    const instrumentSwitchState = await enableInstrumentIfPossible(page);
    await clickId(page, 'clear');
    if (enableId) await clickId(page, enableId);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const state = await page.evaluate(() => ({
      bass: document.getElementById('b1')?.className ?? null,
      drums: document.getElementById('b2')?.className ?? null,
      arpeggio: document.getElementById('b3')?.className ?? null,
      exportDisplay: getComputedStyle(document.getElementById('midiExportBtn')).display,
    }));
    const before = await page.evaluate(() => window.__capturedDownloads.length);
    const click = await clickId(page, 'midiExportBtn');
    let download = null;
    try {
      download = await waitForDownload(page, before);
    } catch {}
    console.log(JSON.stringify({
      label: 'midi-export-case',
      case: label,
      instrumentSwitchState,
      state,
      click,
      captured: Boolean(download),
      midi: download ? parseMidi(download.base64) : null,
    }));
  } finally {
    await page.close();
  }
}

async function captureWavClickPolicy(browser) {
  const page = await createPage(browser);
  try {
    const instrumentSwitchState = await enableInstrumentIfPossible(page);
    await clickId(page, 'shuffle');
    await new Promise((resolve) => setTimeout(resolve, 120));

    const exportWav = async (label) => {
      const before = await page.evaluate(() => window.__capturedDownloads.length);
      const click = await clickId(page, 'wavBtn');
      let download = null;
      try {
        download = await waitForDownload(page, before, 8000);
      } catch {}
      return { label, click, download };
    };

    const off = await exportWav('click-off');
    const clickBefore = await page.evaluate(() => document.getElementById('clickBtn')?.textContent?.trim() ?? null);
    await clickId(page, 'clickBtn');
    await new Promise((resolve) => setTimeout(resolve, 100));
    const clickAfter = await page.evaluate(() => document.getElementById('clickBtn')?.textContent?.trim() ?? null);
    const on = await exportWav('click-on');

    const offParsed = off.download ? parseWav(off.download.base64) : null;
    const onParsed = on.download ? parseWav(on.download.base64) : null;
    let pcmEqual = null;
    let meanAbsDiff = null;
    if (offParsed?.pcmBase64 && onParsed?.pcmBase64) {
      const a = Buffer.from(offParsed.pcmBase64, 'base64');
      const b = Buffer.from(onParsed.pcmBase64, 'base64');
      const n = Math.min(a.length, b.length);
      let total = 0;
      let count = 0;
      for (let i = 0; i + 1 < n; i += 2) {
        const av = a.readInt16LE(i);
        const bv = b.readInt16LE(i);
        total += Math.abs(av - bv);
        count += 1;
      }
      pcmEqual = a.equals(b);
      meanAbsDiff = count ? Math.round((total / count) * 1000) / 1000 : 0;
    }

    console.log(JSON.stringify({
      label: 'wav-click-policy',
      instrumentSwitchState,
      clickBefore,
      clickAfter,
      offCaptured: Boolean(off.download),
      onCaptured: Boolean(on.download),
      off: offParsed ? { ...offParsed, pcmBase64: undefined } : null,
      on: onParsed ? { ...onParsed, pcmBase64: undefined } : null,
      pcmEqual,
      meanAbsDiff,
    }));
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });

  try {
    await captureMidiCase(browser, 'empty', null);
    await captureMidiCase(browser, 'bass-only', 'b1');
    await captureMidiCase(browser, 'drums-only', 'b2');
    await captureMidiCase(browser, 'arpeggio-only', 'b3');
    await captureWavClickPolicy(browser);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
