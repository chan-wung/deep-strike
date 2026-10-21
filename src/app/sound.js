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

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

/**
 * 배경 음악 곡. 한 마디는 16분음표 16칸이고 bars 를 돌아가며 반복한다.
 * bass/kick/snare/hat 은 칸마다 0·1, arp 는 코드 음 번호(0~2, 3 이상은 한 옥타브 위) 또는 -1(쉼)
 */
const SONGS = {
  stage: {                                           // 일반 스테이지: 스테이지가 깊을수록 빠르고 어둡다
    bpm: (s) => Math.min(150, 104 + s * 2), cutoff: (s) => Math.max(900, 3600 - s * 130),
    bars: [{ root: 45, chord: [57, 60, 64] }, { root: 41, chord: [53, 57, 60] }, { root: 43, chord: [55, 59, 62] }, { root: 40, chord: [52, 56, 59] }],
    bassWave: 'triangle', arpWave: 'square',
    bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    arp: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 3, -1],
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  },
  boss: {                                            // 보스: 빠른 16분 베이스와 톱니파
    bpm: () => 150, cutoff: () => 3200,
    bars: [{ root: 38, chord: [50, 53, 57] }, { root: 34, chord: [46, 50, 53] }, { root: 36, chord: [48, 52, 55] }, { root: 33, chord: [45, 49, 52] }],
    bassWave: 'sawtooth', arpWave: 'sawtooth',
    bass: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
    arp: [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 2, 3, 4, 3],
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  bonus: {                                           // 보너스: 밝은 장조
    bpm: () => 132, cutoff: () => 5000,
    bars: [{ root: 48, chord: [60, 64, 67] }, { root: 53, chord: [65, 69, 72] }, { root: 55, chord: [67, 71, 74] }, { root: 48, chord: [60, 64, 67] }],
    bassWave: 'triangle', arpWave: 'square',
    bass: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    arp: [0, 1, 2, 3, 2, 1, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  },
  ending: {                                          // 엔딩: 느리고 잔잔하게
    bpm: () => 76, cutoff: () => 4200,
    bars: [{ root: 36, chord: [60, 64, 67] }, { root: 43, chord: [59, 62, 67] }, { root: 45, chord: [60, 64, 69] }, { root: 41, chord: [60, 65, 69] }],
    bassWave: 'sine', arpWave: 'triangle', sustain: 3,
    bass: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    arp: [0, -1, -1, 1, -1, -1, 2, -1, -1, 1, -1, -1, 3, -1, -1, -1],
    kick: [], snare: [], hat: [],
  },
};

/**
 * 배경 음악: 곡 이름만 받아 WebAudio 로 합성해 반복한다(파일 없음). 효과음(Sfx)과 같은 AudioContext 를 쓰고,
 * 음소거도 따로 한다. 미리 0.25초 앞까지만 예약하는 방식이라 탭이 느려져도 박자가 밀리지 않는다.
 */
export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.muted = false;
    this.name = null;
    this.stage = 1;
    this.step = 0;
    this.next = 0;
    this.timer = 0;
    this.out = null;
    this.noiseBuf = null;
  }

  /** 첫 입력으로 AudioContext 가 만들어진 뒤에야 쓸 수 있다 */
  ready() {
    const { ctx } = this.sfx;
    if (!ctx) return false;
    if (!this.out) {
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.out = ctx.createGain();
      this.out.gain.value = this.muted ? 0 : 0.5;
      this.filter.connect(this.out);
      this.out.connect(ctx.destination);
    }
    return true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.out) this.out.gain.value = m ? 0 : 0.5;
  }

  /** 매 프레임: 지금 틀 곡(없으면 null)과 스테이지, 일시정지 여부 */
  update(name, stage = 1, paused = false) {
    if (!this.ready()) return;
    if (!name || paused || this.muted) {              // 멈춘 동안은 예약을 끊는다 (곡 위치는 그대로)
      this.halt();
      if (!name) this.name = null;
      return;
    }
    const now = this.sfx.ctx.currentTime;
    if (name !== this.name) { this.name = name; this.step = 0; this.next = now + 0.05; }
    this.stage = stage;
    if (!this.timer) {
      this.next = Math.max(this.next, now + 0.05);
      this.timer = setInterval(() => this.pump(), 40);
    }
  }

  halt() {
    if (this.timer) { clearInterval(this.timer); this.timer = 0; }
  }

  pump() {
    const song = SONGS[this.name];
    if (!song) { this.halt(); return; }
    const { ctx } = this.sfx;
    const dur = 60 / song.bpm(this.stage) / 4;
    this.filter.frequency.value = song.cutoff(this.stage);
    while (this.next < ctx.currentTime + 0.25) {
      this.playStep(song, this.step, this.next, dur);
      this.next += dur;
      this.step++;
    }
  }

  playStep(song, step, t0, dur) {
    const bar = song.bars[Math.floor(step / 16) % song.bars.length], i = step % 16;
    if (song.bass[i]) this.note(song.bassWave, mtof(bar.root), t0, dur * 1.8, 0.2);
    const a = song.arp[i];
    if (a >= 0) this.note(song.arpWave, mtof(bar.chord[a % 3] + 12 * Math.floor(a / 3)), t0, dur * (song.sustain ?? 1.4), 0.07);
    if (song.kick[i]) this.drum(t0, 0.12, 0.35, 400);
    if (song.snare[i]) this.drum(t0, 0.1, 0.2, 3000);
    if (song.hat[i]) this.drum(t0, 0.03, 0.06, 8000);
  }

  note(type, f, t0, dur, vol) {
    const { ctx } = this.sfx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.filter);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  /** 북소리: 잡음에 필터를 걸어 짧게 (lp 가 낮을수록 둔탁한 큰북) */
  drum(t0, dur, vol, lp) {
    const { ctx } = this.sfx;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noiseBuf;
    f.type = lp < 1000 ? 'lowpass' : 'highpass';
    f.frequency.value = lp < 1000 ? lp : lp / 2;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.filter);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
}

const SOUNDS = {
  select: (s, t) => s.tone('square', 660, 880, t, 0.06, 0.1),
  storm: (s, t) => { s.tone('sawtooth', 200, 1400, t, 0.5, 0.18); s.noise(t, 0.6, 0.18, 3500); for (let i = 0; i < 4; i++) s.tone('square', 900, 500, t + 0.1 + i * 0.08, 0.1, 0.08); },
  carpet: (s, t) => { s.tone('sine', 90, 35, t, 0.8, 0.3); s.noise(t, 0.5, 0.25, 700); },
  unlock: (s, t) => s.run([784, 988, 1175, 1568, 1976], t, 0.08, 'triangle', 0.25, 0.16),
  combo: (s, t) => s.run([784, 988, 1175], t, 0.04, 'square', 0.08, 0.1),
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
