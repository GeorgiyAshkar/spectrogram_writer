const url = 'https://playmusictheory.net/play';

const response = await fetch(url, {
  headers: {
    'user-agent': 'spectrogram-writer-parity-probe/1.0',
    accept: 'text/html,application/xhtml+xml',
  },
});

console.log('status:', response.status);
console.log('content-type:', response.headers.get('content-type'));

const html = await response.text();
console.log('html-bytes:', Buffer.byteLength(html, 'utf8'));

function decode(value) {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function stripTags(value) {
  return decode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function attrs(tag) {
  const out = {};
  const re = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g;
  for (const match of tag.matchAll(re)) {
    const [, key, dquoted, squoted, bare] = match;
    if (key.toLowerCase() === tag.match(/^<\/?\s*([\w-]+)/)?.[1]?.toLowerCase()) continue;
    out[key] = decode(dquoted ?? squoted ?? bare ?? true);
  }
  return out;
}

console.log('\n=== SELECTS ===');
const selects = [...html.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)];
if (!selects.length) console.log('(none in server HTML)');
selects.forEach((match, index) => {
  const block = match[0];
  const opening = block.match(/<select\b[^>]*>/i)?.[0] ?? '<select>';
  const options = [...block.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((option) => ({
    attrs: attrs('<option ' + option[1] + '>'),
    text: stripTags(option[2]),
  }));
  const start = Math.max(0, (match.index ?? 0) - 140);
  const context = stripTags(html.slice(start, match.index ?? 0)).slice(-100);
  console.log(JSON.stringify({ index, context, attrs: attrs(opening), options }));
});

console.log('\n=== INPUTS ===');
const inputs = [...html.matchAll(/<input\b[^>]*>/gi)];
if (!inputs.length) console.log('(none in server HTML)');
inputs.forEach((match, index) => {
  const start = Math.max(0, (match.index ?? 0) - 100);
  const end = Math.min(html.length, (match.index ?? 0) + match[0].length + 100);
  console.log(JSON.stringify({
    index,
    context: stripTags(html.slice(start, end)).slice(0, 180),
    attrs: attrs(match[0]),
  }));
});

console.log('\n=== BUTTONS ===');
const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
buttons.forEach((match, index) => {
  console.log(JSON.stringify({
    index,
    attrs: attrs('<button ' + match[1] + '>'),
    text: stripTags(match[2]),
  }));
});
