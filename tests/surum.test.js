import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stamp } from '../tools/surum.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('index.html sürüm damgaları güncel', () => {
  assert.equal(stamp(html).html, html, 'Dosyalar değişmiş ama damgalar eski: "npm run surum" çalıştır');
});

test('damga dosya içeriğine bağlıdır ve tekrar çalıştırınca değişmez', () => {
  const files = { 'css/style.css': 'a{}', 'src/main.js': 'import "./x.js"', 'src/x.js': '1' };
  const read = (f) => files[f];
  const page = '<head>\n<link rel="stylesheet" href="css/style.css">\n</head>\n<script type="module" src="src/main.js"></script>\n';
  const one = stamp(page, read, ['src/main.js', 'src/x.js']);
  assert.match(one.html, /href="css\/style\.css\?v=[0-9a-f]{8}"/);
  assert.match(one.html, /src="src\/main\.js\?v=[0-9a-f]{8}"/);
  assert.match(one.html, /"\.\/src\/x\.js": "\.\/src\/x\.js\?v=[0-9a-f]{8}"/);
  assert.equal(stamp(one.html, read, ['src/main.js', 'src/x.js']).html, one.html);
  files['src/x.js'] = '2';
  const two = stamp(one.html, read, ['src/main.js', 'src/x.js']);
  assert.notEqual(two.html, one.html);
  assert.notEqual(two.code, one.code);
});
