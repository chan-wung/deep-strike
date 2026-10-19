/**
 * 효과음: 파일 없이 WebAudio 로 합성한다. 브라우저 정책상 사용자의 첫 입력 뒤에야 소리가 나므로
 * main.js 가 첫 입력에서 unlock() 을 부른다. 게임 규칙(game.js)은 이벤트 이름만 남기고, 여기서 소리로 바꾼다.
 */
const MIN_GAP = 0.04;     // 같은 소리가 한꺼번에 겹쳐 시끄러워지지 않게 (초)

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.last = {};
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.3;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.3;
  }

  play(name) {
    const fn = SOUNDS[name];
    if (!fn || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - (this.last[name] ?? -1) < MIN_GAP) return;
    this.last[name] = now;
    fn(this, now);
  }

  /** f0 에서 f1 로 미끄러지는 음 */
  tone(type, f0, f1, t0, dur, vol = 0.3) {
    const { ctx } = this;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  /** 잡음(폭발·물살). lp 는 낮출수록 둔탁하다 */
  noise(t0, dur, vol = 0.3, lp = 2000) {
    const { ctx } = this;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf;
    f.type = 'lowpass'; f.frequency.value = lp;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  /** 음 높이 목록을 차례로 (아르페지오) */
  run(notes, t0, step, type = 'sine', dur = 0.18, vol = 0.22) {
    notes.forEach((f, i) => this.tone(type, f, f, t0 + i * step, dur, vol));
  }
}

const SOUNDS = {
  shot: (s, t) => s.tone('square', 900, 420, t, 0.07, 0.1),
  boom: (s, t) => { s.noise(t, 0.2, 0.22, 1800); s.tone('triangle', 240, 60, t, 0.18, 0.18); },
  dead: (s, t) => { s.noise(t, 0.7, 0.3, 900); s.tone('sawtooth', 420, 40, t, 0.7, 0.2); },
  bosshit: (s, t) => s.tone('square', 170, 110, t, 0.07, 0.12),
  bossdown: (s, t) => { s.noise(t, 1.3, 0.35, 700); s.tone('sawtooth', 300, 30, t, 1.2, 0.22); s.run([392, 523, 659, 784, 1047], t + 0.9, 0.12, 'triangle'); },
  ult: (s, t) => { s.tone('sawtooth', 70, 900, t, 0.8, 0.22); s.noise(t, 0.9, 0.22, 2500); },
  pickup: (s, t) => s.run([660, 880, 1320], t, 0.05, 'sine', 0.12),
  shield: (s, t) => s.tone('triangle', 300, 800, t, 0.18, 0.25),
  capture: (s, t) => s.tone('sawtooth', 900, 90, t, 1.2, 0.18),
  rescue: (s, t) => s.run([440, 554, 659, 880], t, 0.08, 'triangle', 0.2),
  clear: (s, t) => s.run([523, 659, 784, 1047], t, 0.1, 'triangle', 0.25),
  perfect: (s, t) => s.run([523, 659, 784, 1047, 1319, 1568], t, 0.09, 'square', 0.2, 0.15),
  life: (s, t) => s.run([1047, 1319], t, 0.1, 'sine', 0.3),
  warning: (s, t) => { for (let i = 0; i < 3; i++) s.tone('square', 110, 110, t + i * 0.45, 0.3, 0.2); },
  ending: (s, t) => {
    s.run([523, 659, 784, 1047, 784, 1047, 1319, 1568], t, 0.2, 'triangle', 0.35, 0.2);
    s.run([262, 330, 392], t + 0.1, 0.5, 'sine', 0.8, 0.12);
  },
  gameover: (s, t) => s.run([392, 330, 262, 196], t, 0.25, 'triangle', 0.4),
};
