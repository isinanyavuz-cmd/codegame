#!/usr/bin/env node
/* index.html içindeki CSS ve JS adreslerine içerik damgası ekler: js/app.js?v=1a2b3c4d
 * Dosya değişince adresi de değişir; tarayıcı eski kopyayı kullanamaz, sayfayı yenilemek yeter.
 * Ayrıca bütün damgalardan tek bir sürüm kodu üretip <div id="app" data-surum="..."> içine yazar;
 * uygulama bu kodu ana sayfanın altında gösterir.
 *
 *   node bilsem/tools/surum.js        -> index.html dosyasını günceller (her değişiklikten sonra çalıştırılır)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const sha = (text) => crypto.createHash('sha1').update(text).digest('hex');

/* html -> damgaları güncel html */
function stamp(html, read) {
  const hashes = [];
  let out = html.replace(/((?:href|src)=")((?:css|js)\/[^"?]+)(?:\?v=[0-9a-f]*)?(")/g, (_, pre, file, post) => {
    const h = sha(read(file)).slice(0, 8);
    hashes.push(h);
    return pre + file + '?v=' + h + post;
  });
  const code = sha(hashes.join('')).slice(0, 7);
  out = out.replace(/<div id="app"[^>]*>/, '<div id="app" data-surum="' + code + '">');
  return { html: out, code: code, files: hashes.length };
}

module.exports = { stamp: stamp };

if (require.main === module) {
  const file = path.join(root, 'index.html');
  const before = fs.readFileSync(file, 'utf8');
  const res = stamp(before, (f) => fs.readFileSync(path.join(root, f), 'utf8'));
  if (res.html !== before) fs.writeFileSync(file, res.html);
  console.log('sürüm ' + res.code + ' · ' + res.files + ' dosya' + (res.html !== before ? ' · index.html güncellendi' : ' · değişiklik yok'));
}
