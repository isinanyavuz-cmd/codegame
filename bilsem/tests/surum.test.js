const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { stamp } = require('../tools/surum.js');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('index.html içindeki sürüm damgaları güncel (değilse: node bilsem/tools/surum.js)', () => {
  const res = stamp(html, read);
  assert.strictEqual(res.html, html, 'bir dosya değişmiş ama damgası yenilenmemiş');
  assert.ok(res.files >= 12, 'bütün css ve js dosyaları damgalı');
  assert.match(html, /<div id="app" data-surum="[0-9a-f]{7}">/);
});

test('dosya içeriği değişince adresi ve sürüm kodu da değişir', () => {
  const a = stamp(html, read), b = stamp(html, (f) => read(f) + (f === 'js/app.js' ? '\n// değişti' : ''));
  assert.notStrictEqual(a.code, b.code);
  const urls = (h) => h.match(/js\/[a-z-]+\.js\?v=[0-9a-f]{8}/g);
  const changed = urls(a.html).filter((u, i) => u !== urls(b.html)[i]);
  assert.deepStrictEqual(changed.map((u) => u.split('?')[0]), ['js/app.js'], 'yalnız değişen dosyanın adresi değişir');
});
