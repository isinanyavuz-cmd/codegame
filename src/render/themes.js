// Sektör görünümleri: her sektörün kendi gökyüzü, gezegeni, ızgara rengi ve ışığı var.
// 0 numara rota ekranı içindir (gezegensiz, sade).
//
// sky      gökyüzü geçişinin üç rengi
// nebula   bulutsu lekelerinin renkleri ("r,g,b")
// planet   soldaki gezegenin ton değeri (hue); `ring` halka ekler. null ise gezegen çizilmez
// extra    arka plana eklenen sektöre özgü öğe
// grid     ızgara çizgisi, kenar ve zemin renkleri
// light    ortam ışığı (gök, yer) ve arkadan vuran kenar ışığı
// rocks    meteor renkleri
// accent   arayüzde sektör adının rengi
export const THEMES = {
  0: {
    sky: ['#0a1238', '#080d2b', '#130b33'], nebula: ['70,70,210', '190,60,170', '20,130,210', '120,80,230'],
    planet: null, extra: null, grid: [0x4fd2ff, 0x7fe2ff, 0x2a6bff], light: [0xb9c8ff, 0x241446, 0x56e0ff],
    rocks: [0x9a857a, 0x857268, 0xa58e7c, 0x7d6c68], accent: '#7fd8ff',
  },
  1: {
    sky: ['#0a1238', '#080d2b', '#130b33'], nebula: ['70,70,210', '190,60,170', '20,130,210', '120,80,230'],
    planet: { hue: 185 }, extra: null, grid: [0x4fd2ff, 0x7fe2ff, 0x2a6bff], light: [0xb9c8ff, 0x241446, 0x56e0ff],
    rocks: [0x9a857a, 0x857268, 0xa58e7c, 0x7d6c68], accent: '#7fd8ff',
  },
  2: {
    sky: ['#1b1020', '#120b1a', '#24121a'], nebula: ['225,125,45', '170,70,35', '110,50,140', '240,170,70'],
    planet: { hue: 28, ring: true }, extra: 'belt', grid: [0xffb45e, 0xffd28f, 0x8a3c0c], light: [0xffd9b0, 0x2a1420, 0xffb060],
    rocks: [0xb08a62, 0x96714f, 0xc09a70, 0x86654a], accent: '#ffc27a',
  },
  3: {
    sky: ['#1d0b22', '#13091c', '#260b18'], nebula: ['220,50,90', '150,40,160', '240,110,60', '110,40,190'],
    planet: { hue: 345 }, extra: 'streaks', grid: [0xe08cff, 0xf0b8ff, 0x5a2090], light: [0xffc6d8, 0x2a0e2a, 0xff7ab0],
    rocks: [0xa0706a, 0x8a5c5a, 0xb4807a, 0x7a5052], accent: '#ff9ac0',
  },
  4: {
    sky: ['#070619', '#09071f', '#110a2a'], nebula: ['95,55,210', '55,30,140', '30,80,170', '130,60,190'],
    planet: { hue: 265 }, extra: 'clouds', grid: [0x9d8cff, 0xc3b8ff, 0x5a3cff], light: [0xb0a8ff, 0x100a30, 0x8a70ff],
    rocks: [0x6f6a88, 0x5d5876, 0x7e7898, 0x55506c], accent: '#c3b4ff',
  },
  5: {
    sky: ['#190a12', '#0f0810', '#200a0c'], nebula: ['200,40,60', '120,20,45', '230,120,40', '90,20,60'],
    planet: { hue: 4 }, extra: 'embers', grid: [0xffa37a, 0xffc9a8, 0x7a1c14], light: [0xffc8b8, 0x260a10, 0xff7050],
    rocks: [0x8a6a66, 0x735552, 0x9a7a72, 0x664a4a], accent: '#ffa08a',
  },
  6: {
    sky: ['#06151b', '#04101a', '#0a1c1c'], nebula: ['30,200,140', '20,120,165', '120,220,80', '20,90,120'],
    planet: { hue: 150, ring: true }, extra: 'aurora', grid: [0x57e6d0, 0x9ff5e6, 0x0a6a58], light: [0xb8ffe6, 0x06201c, 0x40ffb0],
    rocks: [0x6e8a82, 0x5a756e, 0x80998f, 0x4e6862], accent: '#8bf0c6',
  },
  7: {
    sky: ['#15110b', '#0e0c13', '#1c1509'], nebula: ['230,180,60', '200,120,40', '90,80,200', '250,210,110'],
    planet: { hue: 46, ring: true }, extra: 'rings', grid: [0xffd76a, 0xffe9a8, 0x6a4a08], light: [0xfff0c0, 0x201808, 0xffd060],
    rocks: [0x9a8a6a, 0x857556, 0xaa9a78, 0x74664c], accent: '#ffe08a',
  },
  8: {
    sky: ['#150a26', '#0c0820', '#200a30'], nebula: ['220,70,220', '120,60,230', '60,140,255', '250,110,200'],
    planet: null, extra: 'station', grid: [0xf08cff, 0xf8c4ff, 0x5a1890], light: [0xe8c8ff, 0x1a0a2e, 0xd070ff],
    rocks: [0x8a7a96, 0x756682, 0x9a8aa6, 0x645870], accent: '#f0a8ff',
  },
};

export const themeOf = (sector) => THEMES[sector] || THEMES[1];
