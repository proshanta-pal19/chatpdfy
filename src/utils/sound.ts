let audioCtx: AudioContext | null = null;
let soundEnabled = true;

try {
  const saved = localStorage.getItem('chatpdfy-sound');
  if (saved === 'off') soundEnabled = false;
} catch {
  // ignore storage errors
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  try {
    localStorage.setItem('chatpdfy-sound', enabled ? 'on' : 'off');
  } catch {
    // ignore storage errors
  }
}

function getContext(): AudioContext | null {
  if (!soundEnabled || typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainPeak = 0.06,
  delay = 0,
  endFreq?: number,
) {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playSelectSound(): void {
  playTone(540, 0.075, 'sine', 0.055, 0, 680);
}

export function playTransitionSound(): void {
  playTone(320, 0.11, 'triangle', 0.045, 0, 520);
  playTone(640, 0.09, 'sine', 0.03, 0.03, 760);
}

export function playUploadSuccessSound(): void {
  playTone(440, 0.12, 'sine', 0.05, 0);
  playTone(554.37, 0.14, 'sine', 0.05, 0.07);
  playTone(659.25, 0.2, 'sine', 0.055, 0.14);
}

export function playQuizCompleteSound(passed: boolean): void {
  if (passed) {
    playTone(523.25, 0.14, 'sine', 0.06, 0);
    playTone(659.25, 0.14, 'sine', 0.06, 0.09);
    playTone(783.99, 0.16, 'sine', 0.06, 0.18);
    playTone(1046.5, 0.28, 'sine', 0.065, 0.27);
  } else {
    playTone(440, 0.15, 'triangle', 0.05, 0);
    playTone(392, 0.22, 'triangle', 0.05, 0.12);
  }
}

export function playAlertSound(): void {
  playTone(300, 0.12, 'sawtooth', 0.03, 0, 240);
}
