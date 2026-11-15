#!/usr/bin/env node
/* Uygulamayı tek bir HTML dosyasında toplar (CSS ve JS gömülü).
 *   node bilsem/tools/tek-dosya.js cikti.html            -> çift tıklayınca açılan tam sayfa
 *   node bilsem/tools/tek-dosya.js cikti.html --govde    -> yalnızca gövde (bir sayfanın içine gömmek için)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = process.argv[2];
const bodyOnly = process.argv.includes('--govde');
if (!out) { console.error('Kullanım: node tek-dosya.js <çıktı.html> [--govde]'); process.exit(1); }

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const scripts = Array.from(html.matchAll(/<script src="([^"]+)"><\/script>/g)).map((m) => m[1]);
const js = scripts.map((s) => fs.readFileSync(path.join(root, s), 'utf8').replace(/<\/script/g, '<\\/script')).join('\n');
const fonts = (html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/) || [''])[0];
const title = (html.match(/<title>[^<]*<\/title>/) || ['<title>Zekâ Kâşifi</title>'])[0];

const core = fonts + '\n<style>\n' + css + '</style>\n<div id="app"></div>\n<script>\n' + js + '</script>\n';
const page = bodyOnly
  ? title + '\n<meta name="claude:viewport-fit-sides" content="cover">\n' + core
  : '<!DOCTYPE html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    title + '\n</head>\n<body>\n' + core + '</body>\n</html>\n';

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, page);
console.log(out + ' yazıldı (' + Math.round(page.length / 1024) + ' KB, ' + scripts.length + ' betik)');
