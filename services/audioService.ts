
export const playNotificationSound = () => {
  try {
    // Cross-browser support for AudioContext
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    
    // Create oscillator (Tone generator)
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    // "Ding" sound parameters (Sine wave, mimicking a glass ping)
    osc.type = 'sine';
    const now = ctx.currentTime;
    
    // Frequency Sweep (High pitch 1200Hz dropping slightly)
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);

    // Volume Envelope (Quick attack, smooth decay)
    gainNode.gain.setValueAtTime(0.3, now); // Volume 30%
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc.start(now);
    osc.stop(now + 0.8);

  } catch (err) {
    console.error("Audio generation failed:", err);
  }
};
