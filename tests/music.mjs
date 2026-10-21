import { Game } from '../src/game/game.js';
import { Music } from '../src/app/sound.js';
import { begin, check, done } from './lib.mjs';

/** 소리를 내지 않고 만들어진 노드 수만 세는 가짜 AudioContext */
function fakeCtx() {
  const node = () => ({ connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {}, value: 0 }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 } });
  const ctx = {
    currentTime: 0, sampleRate: 100, notes: 0,
    createGain: node, createBiquadFilter: node, createBufferSource: node,
    createOscillator: () => { ctx.notes++; return node(); },
    createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
    destination: {},
  };
  return ctx;
}

// 게임이 알려 주는 곡 이름
const g = new Game({ bonusPlan: { 2: 'school' } });
check('타이틀은 조용하다', g.music === null);
begin(g);
check('일반 스테이지는 stage 곡', g.music === 'stage');
g.stage = 5; g.startStage();
check('보스 스테이지는 boss 곡', g.music === 'boss');
g.stage = 2; g.startStage();
check('보너스 스테이지는 bonus 곡', g.music === 'bonus');
g.phase = 'clear';
check('클리어 연출 중에는 조용하다', g.music === null);
g.phase = 'ending';
check('엔딩은 ending 곡', g.music === 'ending');
g.phase = 'over';
check('게임 오버는 조용하다', g.music === null);

// 음악 스케줄러
const sfx = { ctx: null };
const m = new Music(sfx);
m.update('stage', 1);
check('AudioContext 가 없으면 아무 일도 없다', m.timer === 0);
sfx.ctx = fakeCtx();
m.update('stage', 1);
check('곡을 틀면 예약 타이머가 돈다', m.timer !== 0 && m.name === 'stage');
m.pump();
check('0.25초 앞까지 음을 예약한다', sfx.ctx.notes > 0 && m.step > 0, `notes=${sfx.ctx.notes} step=${m.step}`);
const before = m.step;
sfx.ctx.currentTime = 10;
m.update('stage', 1);
m.pump();
check('시간이 지나면 이어서 예약한다', m.step > before);
m.update('stage', 1, true);
check('일시정지하면 타이머가 멈춘다', m.timer === 0 && m.name === 'stage');
const kept = m.step;
m.update('stage', 1, false);
check('다시 하면 곡 위치를 이어 간다', m.timer !== 0 && m.step === kept);
m.update('boss', 5);
check('곡이 바뀌면 처음부터', m.name === 'boss' && m.step === 0);
m.setMuted(true);
m.update('boss', 5);
check('음소거하면 예약을 멈춘다', m.timer === 0);
m.setMuted(false);
m.update(null);
check('곡이 없으면 멈추고 이름을 비운다', m.timer === 0 && m.name === null);

// 스테이지가 깊을수록 빠르다
let slow = 0, fast = 0;
{
  const run = (stage) => {
    const c = fakeCtx(), mu = new Music({ ctx: c });
    mu.update('stage', stage); c.currentTime = 2; mu.pump();   // 2초 동안 몇 칸이 예약되나
    mu.halt();
    return mu.step;
  };
  slow = run(1); fast = run(19);
}
check('깊은 스테이지는 템포가 빠르다 (같은 시간에 더 많은 칸)', fast > slow, `slow=${slow} fast=${fast}`);
done();
