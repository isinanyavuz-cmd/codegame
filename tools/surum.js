#!/usr/bin/env node
// index.html içindeki dosya adreslerine içerik damgası ekler: css/style.css?v=1a2b3c4d
//
// Yayın sunucusu (GitHub Pages) tarayıcının dosyaları on dakika boyunca yeniden
// kullanmasına izin verir. Dosya adları hiç değişmediği için sayfa yenilense bile
// eski sürüm görünebilir. Damga dosyanın içeriğinden üretilir: dosya değişince
// adresi de değişir ve tarayıcı yenisini indirir.
//
// JS modülleri birbirini göreli yolla içe aktarır; onların adresleri kaynak
// dosyalara dokunmadan, index.html içindeki "importmap" ile damgalanır.
//
//   npm run surum      her değişiklikten sonra çalıştırılır; index.html güncellenir
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sha = (data) => createHash('sha1').update(data).digest('hex');

function listModules(dir = 'src') {
  const out = [];
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...listModules(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out.sort();
}

/** html → damgaları güncel html, sürüm kodu ve damgalanan dosya sayısı. */
export function stamp(html, read = (f) => readFileSync(join(root, f)), modules = [...listModules(), 'vendor/three.bundle.min.js']) {
  const h = (f) => sha(read(f)).slice(0, 8);
  const css = h('css/style.css');
  const imports = {};
  for (const f of modules) imports[`./${f}`] = `./${f}?v=${h(f)}`;
  const code = sha(css + Object.values(imports).join('')).slice(0, 7);
  const head = `<meta name="surum" content="${code}">\n<script type="importmap">\n${JSON.stringify({ imports }, null, 1)}\n</script>\n</head>`;
  const out = html
    .replace(/<meta name="surum"[^>]*>\n/, '')
    .replace(/<script type="importmap">[\s\S]*?<\/script>\n/, '')
    .replace(/(href="css\/style\.css)(?:\?v=[0-9a-f]*)?(")/, `$1?v=${css}$2`)
    .replace(/(<script type="module" src="src\/main\.js)(?:\?v=[0-9a-f]*)?(")/, `$1?v=${h('src/main.js')}$2`)
    .replace('</head>', head);
  return { html: out, code, files: modules.length + 1 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = join(root, 'index.html');
  const before = readFileSync(file, 'utf8');
  const res = stamp(before);
  if (res.html !== before) writeFileSync(file, res.html);
  console.log(`sürüm ${res.code} · ${res.files} dosya${res.html !== before ? ' · index.html güncellendi' : ' · değişiklik yok'}`);
}
