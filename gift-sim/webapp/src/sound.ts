// Звуки игры: синтезируются через Web Audio прямо в браузере (без файлов, ничего не грузится).
// Включение и выключение хранится в localStorage; звук и вибрация — отдельные настройки.

import { signal } from "@preact/signals";

const read = (k: string) => {
  try { return localStorage.getItem(k) !== "0"; } catch { return true; }
};
export const soundOn = signal(read("sound"));
export const vibroOn = signal(read("vibro"));

export function setSound(v: boolean) { soundOn.value = v; try { localStorage.setItem("sound", v ? "1" : "0"); } catch { /* приватный режим */ } }
export function setVibro(v: boolean) { vibroOn.value = v; try { localStorage.setItem("vibro", v ? "1" : "0"); } catch { /* приватный режим */ } }

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (!soundOn.value) return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// браузер разрешает звук только после касания — «будим» контекст при первом же нажатии
if (typeof window !== "undefined") {
  const wake = () => { ac(); window.removeEventListener("pointerdown", wake); };
  window.addEventListener("pointerdown", wake);
}

function tone(freq: number, dur: number, { type = "sine" as OscillatorType, vol = 0.2, at = 0, slide = 0, attack = 0.004 } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, { vol = 0.3, at = 0, freq = 1200, q = 0.8, type = "lowpass" as BiquadFilterType } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + at;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

let lastTick = 0;

export const sound = {
  // щелчок, когда под маркером проходит подарок / сектор колеса
  tick() {
    const now = performance.now();
    if (now - lastTick < 38) return;
    lastTick = now;
    tone(2100 + Math.random() * 300, 0.035, { type: "triangle", vol: 0.09 });
  },
  click() { tone(900, 0.05, { type: "triangle", vol: 0.08 }); },
  start() { tone(220, 0.25, { type: "sawtooth", vol: 0.05, slide: 2.2 }); noise(0.25, { vol: 0.08, freq: 2400, type: "bandpass" }); },
  // выигрыш: чем реже подарок, тем длиннее и выше аккорд
  win(rarity: string) {
    const steps: Record<string, number[]> = {
      common: [523, 659],
      rare: [523, 659, 784],
      epic: [523, 659, 784, 1047],
      legendary: [523, 659, 784, 1047, 1319],
      mythic: [523, 659, 784, 1047, 1319, 1568],
    };
    const notes = steps[rarity] ?? steps.common;
    notes.forEach((f, i) => tone(f, 0.35, { type: "triangle", vol: 0.14, at: i * 0.07 }));
    if (rarity === "legendary" || rarity === "mythic") {
      notes.forEach((f, i) => tone(f * 2, 0.5, { type: "sine", vol: 0.05, at: 0.08 + i * 0.07 }));
      noise(0.6, { vol: 0.04, freq: 6000, type: "highpass", at: 0.1 });
    }
  },
  coins() { [1568, 1976, 2349].forEach((f, i) => tone(f, 0.12, { type: "square", vol: 0.04, at: i * 0.05 })); },
  lose() { tone(330, 0.3, { type: "triangle", vol: 0.1, slide: 0.6 }); },
  boom() { noise(0.7, { vol: 0.5, freq: 600 }); tone(90, 0.6, { type: "sine", vol: 0.35, slide: 0.4 }); },
  gem() { tone(1319, 0.18, { type: "sine", vol: 0.12 }); tone(1976, 0.22, { type: "sine", vol: 0.06, at: 0.04 }); },
  flip() { noise(0.18, { vol: 0.1, freq: 3000, type: "bandpass", q: 2 }); },
  land() { tone(1800, 0.25, { type: "square", vol: 0.03 }); tone(2700, 0.3, { type: "sine", vol: 0.05, at: 0.01 }); },
  peg() { tone(1200 + Math.random() * 500, 0.04, { type: "sine", vol: 0.07 }); },
  seal() { tone(140, 0.2, { type: "sine", vol: 0.3, slide: 0.5 }); noise(0.12, { vol: 0.15, freq: 900 }); },
};
