// Sesli okuma: görev metnini, ipuçlarını ve Bip'in söylediklerini tarayıcının
// kendi sesiyle okur (Web Speech). Okumayı yeni söken çocuk için metin engel olmasın.
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let on = false, picked = null;

function pick() {
  if (!synth) return null;
  const voices = synth.getVoices().filter((v) => /^tr\b/i.test(v.lang));
  // Cihazın kendi sesi (çevrimdışı çalışır) ağ gerektirenlerden önce gelir.
  return voices.find((v) => v.localService) || voices[0] || null;
}
if (synth) {
  picked = pick();
  synth.addEventListener?.('voiceschanged', () => { picked = pick(); });
}

/** **kalın** işaretlerini ve okunmayacak simgeleri atar. */
export const plain = (text) => String(text).replace(/<[^>]+>/g, ' ').replace(/\*\*/g, '').replace(/[→✓★]/g, ' ').replace(/\s+/g, ' ').trim();

export const voice = {
  /** Tarayıcı konuşabiliyor mu? (Türkçe ses yoksa da dener; çoğu cihaz dil etiketine göre ses seçer.) */
  get supported() { return !!synth && typeof SpeechSynthesisUtterance !== 'undefined'; },
  get enabled() { return on; },
  set enabled(v) { on = !!v; if (!on) this.stop(); },
  /** Metni okur; önceki okuma kesilir. `force` kapalıyken de okutur (hoparlör düğmesi). */
  say(text, { force = false } = {}) {
    if (!this.supported || (!on && !force)) return false;
    const line = plain(text);
    if (!line) return false;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(line);
      u.lang = 'tr-TR'; u.rate = 0.92; u.pitch = 1.05;
      if (picked) u.voice = picked;
      synth.speak(u);
      return true;
    } catch (e) { return false; }
  },
  stop() { try { synth?.cancel(); } catch (e) { /* konuşma yok */ } },
};
