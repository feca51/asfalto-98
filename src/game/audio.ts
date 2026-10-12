let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let padNodes: OscillatorNode[] = [];
let muted = false;
let fanfareTimer = 0;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    master.gain.value = 0.9;
    musicBus.gain.value = 0.7;
    sfxBus.gain.value = 0.85;
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio() {
  const audio = ensure();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
}

export function resumeAudio() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  if (!master || !ctx) return;
  master.gain.setTargetAtTime(next ? 0 : 0.9, ctx.currentTime, 0.03);
}

function envGain(bus: GainNode, start: number, peak: number, attack: number, hold: number, release: number) {
  if (!ctx) return null;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), start + attack);
  gain.gain.setValueAtTime(Math.max(0.001, peak), start + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
  gain.connect(bus);
  return gain;
}

function tone(
  bus: GainNode,
  freq: number,
  when: number,
  dur: number,
  type: OscillatorType,
  peak: number,
) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  const gain = envGain(bus, when, peak, 0.015, Math.max(0.02, dur - 0.08), 0.07);
  if (!gain) return;
  osc.connect(gain);
  osc.start(when);
  osc.stop(when + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

export function startRaceAudio() {
  const audio = ensure();
  if (!audio || !sfxBus || !musicBus) return;
  stopRaceAudio();
  engineOsc = audio.createOscillator();
  engineOsc.type = "sawtooth";
  engineOsc.frequency.value = 48;
  engineGain = audio.createGain();
  engineGain.gain.value = 0.0001;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  engineOsc.connect(filter);
  filter.connect(engineGain);
  engineGain.connect(sfxBus);
  engineOsc.start();

  const base = audio.currentTime + 0.05;
  const roots = [82.4, 98, 73.4, 110];
  padNodes = roots.slice(0, 2).map((freq, index) => {
    const osc = audio.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq * (index === 0 ? 1 : 1.5);
    const gain = audio.createGain();
    gain.gain.value = 0.018;
    osc.connect(gain);
    gain.connect(musicBus!);
    osc.start(base);
    return osc;
  });
}

export function setEngineSpeed(speed: number, throttle: number) {
  if (!ctx || !engineOsc || !engineGain) return;
  const freq = 42 + speed * 2.4 + throttle * 18;
  engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
  const level = 0.02 + Math.min(0.08, speed * 0.0014) + throttle * 0.02;
  engineGain.gain.setTargetAtTime(muted ? 0 : level, ctx.currentTime, 0.05);
}

export function playFanfare() {
  const audio = ensure();
  if (!audio || !musicBus || !sfxBus || muted) return;
  if (engineGain) engineGain.gain.setTargetAtTime(0.01, audio.currentTime, 0.05);
  for (const osc of padNodes) {
    try {
      osc.stop(audio.currentTime + 0.05);
    } catch {
      /* already stopped */
    }
  }
  padNodes = [];

  const now = audio.currentTime + 0.02;
  const line: [number, number, number][] = [
    [0, 523.25, 0.16],
    [0.16, 659.25, 0.16],
    [0.32, 783.99, 0.18],
    [0.5, 1046.5, 0.42],
    [0.98, 783.99, 0.14],
    [1.14, 1046.5, 0.14],
    [1.3, 1318.5, 0.5],
    [1.88, 1046.5, 0.16],
    [2.06, 1174.66, 0.16],
    [2.24, 1318.5, 0.62],
  ];
  for (const [at, freq, dur] of line) {
    tone(musicBus, freq, now + at, dur, "square", 0.07);
    tone(musicBus, freq / 2, now + at, dur, "triangle", 0.04);
  }
  tone(musicBus, 523.25, now + 2.9, 0.7, "triangle", 0.05);
  tone(musicBus, 659.25, now + 2.9, 0.7, "triangle", 0.04);
  tone(musicBus, 783.99, now + 2.9, 0.7, "square", 0.035);

  const len = Math.floor(audio.sampleRate * 0.45);
  const buffer = audio.createBuffer(1, len, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(sfxBus);
  noise.start(now);
  noise.stop(now + 0.55);
  fanfareTimer = now;
}

export function stopRaceAudio() {
  if (engineOsc) {
    try {
      engineOsc.stop();
    } catch {
      /* already stopped */
    }
    engineOsc.disconnect();
    engineOsc = null;
  }
  if (engineGain) {
    engineGain.disconnect();
    engineGain = null;
  }
  for (const osc of padNodes) {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
    osc.disconnect();
  }
  padNodes = [];
  fanfareTimer = 0;
}
