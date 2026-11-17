// Bip: geminin yardımcı robotu. İpuçlarını, hata mesajlarını ve hikâyeyi o söyler.
// (BİLSEM uygulamasındaki robotla aynı çizim; orada da çocuğa o eşlik ediyor.)
export const COPILOT = 'Bip';

const EYES = {
  idle: '<circle cx="19" cy="26" r="3.5" fill="#7cf7ff"/><circle cx="31" cy="26" r="3.5" fill="#7cf7ff"/>',
  happy: '<path d="M15.2 27.5q3.6-5.4 7.2 0M27.6 27.5q3.6-5.4 7.2 0" fill="none" stroke="#7cf7ff" stroke-width="3" stroke-linecap="round"/>',
  sad: '<circle cx="19" cy="25" r="3" fill="#7cf7ff"/><circle cx="31" cy="25" r="3" fill="#7cf7ff"/><path d="M21 31.2q4-2.4 8 0" fill="none" stroke="#7cf7ff" stroke-width="2.2" stroke-linecap="round"/>',
  think: '<circle cx="20.5" cy="24.5" r="3.2" fill="#7cf7ff"/><circle cx="32.5" cy="24.5" r="3.2" fill="#7cf7ff"/><path d="M22 31h7" stroke="#7cf7ff" stroke-width="2.2" stroke-linecap="round"/>',
  wow: '<path d="M19 21.5l1.3 3 3.2.3-2.4 2.1.7 3.1-2.8-1.6-2.8 1.6.7-3.1-2.4-2.1 3.2-.3zM31 21.5l1.3 3 3.2.3-2.4 2.1.7 3.1-2.8-1.6-2.8 1.6.7-3.1-2.4-2.1 3.2-.3z" fill="#ffd53d"/>',
  alarm: '<path d="M15.5 23.5l6 3M34.5 23.5l-6 3" stroke="#ff6b7f" stroke-width="2.6" stroke-linecap="round"/><circle cx="19" cy="28" r="2.6" fill="#ff8d9f"/><circle cx="31" cy="28" r="2.6" fill="#ff8d9f"/>',
};

/** Robotun çizimi. mood: idle, happy, sad, think, wow, alarm */
export function robot(mood = 'idle', cls = '') {
  return `<svg class="robot ${mood} ${cls}" viewBox="0 0 56 56" aria-hidden="true"><g transform="translate(3 5)">`
    + '<path d="M25 5.5v8" stroke="#1d2b4a" stroke-width="3.4" stroke-linecap="round"/><circle class="ant" cx="25" cy="5.5" r="4" fill="#ffc93c" stroke="#1d2b4a" stroke-width="2.6"/>'
    + '<rect x="6" y="12" width="38" height="32" rx="12" fill="#3d8ef7" stroke="#1d2b4a" stroke-width="3.4"/>'
    + `<rect x="11.5" y="18" width="27" height="16" rx="8" fill="#1d2b4a"/>${EYES[mood] || EYES.idle}</g></svg>`;
}

/** Mürettebatın kasklı yüzü. `hue` kask rengi; `lost` henüz kurtarılmamış (gri siluet). */
export function face(hue, { lost = false, cls = '' } = {}) {
  const shell = lost ? '#3a4468' : `hsl(${hue} 72% 56%)`, glass = lost ? '#262f52' : '#1d2b4a';
  return `<svg class="face ${lost ? 'lost' : ''} ${cls}" viewBox="0 0 56 56" aria-hidden="true">`
    + `<circle cx="28" cy="28" r="23" fill="${shell}" stroke="#1d2b4a" stroke-width="3.4"/><rect x="12" y="17" width="32" height="22" rx="11" fill="${glass}"/>`
    + (lost ? '<path d="M24.500 24.500a3.800 3.800 0 1 1 5.500 3.400c-1.400.800-2 1.500-2 3M28 34.500v.200" fill="none" stroke="#6b78a8" stroke-width="2.800" stroke-linecap="round"/>'
      : '<circle cx="22" cy="27" r="3" fill="#fff"/><circle cx="34" cy="27" r="3" fill="#fff"/><path d="M23 32.500q5 3.600 10 0" fill="none" stroke="#fff" stroke-width="2.400" stroke-linecap="round"/><path d="M16.500 22q4-3.600 9-3" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2.200" stroke-linecap="round"/>')
    + '</svg>';
}

/** Gizli görevlerde bulunan küçük robot. */
export function miniBot(hue, { lost = false, cls = '' } = {}) {
  const body = lost ? '#3a4468' : `hsl(${hue} 78% 58%)`, eye = lost ? '#55618f' : '#eaffff';
  return `<svg class="face mini ${lost ? 'lost' : ''} ${cls}" viewBox="0 0 56 56" aria-hidden="true">`
    + `<path d="M28 8v7" stroke="#1d2b4a" stroke-width="3.400" stroke-linecap="round"/><circle cx="28" cy="7" r="3.600" fill="${lost ? '#55618f' : '#ffc93c'}" stroke="#1d2b4a" stroke-width="2.400"/>`
    + `<rect x="11" y="15" width="34" height="30" rx="13" fill="${body}" stroke="#1d2b4a" stroke-width="3.400"/><circle cx="21.500" cy="29" r="4.200" fill="${eye}"/><circle cx="34.500" cy="29" r="4.200" fill="${eye}"/>`
    + (lost ? '' : '<circle cx="22.500" cy="29.500" r="1.900" fill="#1d2b4a"/><circle cx="35.500" cy="29.500" r="1.900" fill="#1d2b4a"/><path d="M24 37.500h8" stroke="#1d2b4a" stroke-width="2.400" stroke-linecap="round"/>')
    + '</svg>';
}
