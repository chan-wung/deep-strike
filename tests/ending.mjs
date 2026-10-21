import { Game, TICRATE, FINAL_STAGE, ENDING_SKIP } from '../src/game/game.js';
import { addRecord, cleanName, parseBoards, qualifies, MAX_NAME, MAX_RECORDS } from '../src/app/records.js';
import { check, done } from './lib.mjs';

const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };

/** 마지막 보스 스테이지에서 보스를 쓰러뜨리고 clear 타이머까지 돌린다 */
function beatFinalBoss({ lives = 3, score = 1000 } = {}) {
  const g = new Game({ bonusPlan: {} });
  g.start();
  g.stage = FINAL_STAGE; g.startStage();
  g.lives = lives; g.score = score; g.extraAt = 1e9;          // 보스 점수로 목숨이 느는 일은 따로 본다
  g.phase = 'play';
  g.boss.state = 'fight'; g.boss.y = 74;
  g.damageBoss(9999);
  run(g, 330);                         // 쓰러지는 연출(2초) → clear → clear 타이머(2초)
  return g;
}

check('마지막 보스는 20 스테이지의 리바이어던', FINAL_STAGE === 20 && new Game({ bonusPlan: {} }).constructor === Game);
{
  const q = new Game({ bonusPlan: {} }); q.start(); q.stage = FINAL_STAGE; q.startStage();
  check('20 스테이지는 리바이어던 보스 스테이지', q.boss && q.boss.kind === 'leviathan' && !q.bonus);
}

const g = beatFinalBoss({ lives: 2, score: 1000 });
check('마지막 보스를 잡으면 엔딩', g.phase === 'ending' && g.cleared === true, g.phase);
check('엔딩 보너스는 남은 잠수함 한 대당 10000', g.ending.bonus === 20000 && g.score >= 21000, `score=${g.score}`);
check('엔딩 기록에 cleared 가 붙고 난이도는 없다', g.lastRecord && g.lastRecord.cleared === true && g.lastRecord.diff === undefined && g.lastRecord.stage === 20);
check('엔딩 중에는 일시정지가 의미 없다', g.canPause === false);
g.start();
check('엔딩이 막 시작했을 때는 키로 넘어가지 않는다', g.phase === 'ending');
run(g, ENDING_SKIP);
g.start();
check('잠시 뒤 키를 누르면 결과 화면', g.phase === 'over' && g.naming === true);
g.start();
check('이름을 쓰는 중에는 새 게임이 시작되지 않는다', g.phase === 'over');
check('이름을 내면 점수판에 오른다', g.submitName('  Kim  ', '2026-02-02') && g.naming === false && g.records[0].name === 'Kim' && g.records[0].cleared === true && g.rank === 1);
check('두 번 내도 한 번만 올라간다', g.submitName('X') === false && g.records.length === 1);
for (let i = 0; i < 60; i++) g.tick();
g.start();
check('이름을 낸 뒤 키를 누르면 새 게임', g.phase === 'ready' && g.stage === 1 && g.cleared === false);

// 마지막 스테이지 앞의 보스는 엔딩이 아니다
const g15 = new Game({ bonusPlan: {} }); g15.start(); g15.stage = 15; g15.startStage(); g15.phase = 'play';
g15.boss.state = 'fight'; g15.boss.y = 74; g15.damageBoss(9999); run(g15, 330);
check('15 스테이지 보스를 잡으면 엔딩 없이 16 스테이지', g15.phase === 'ready' && g15.stage === 16 && !g15.cleared, `${g15.phase} ${g15.stage}`);

// 게임 오버와 점수판
const go = new Game({ bonusPlan: {} });
go.start();
go.score = 500; go.stats = { shots: 4, hits: 5, bosses: 0 };
go.finish();
check('명중이 쏜 수보다 많아도 명중률은 100% 까지', go.lastRecord.ratio === 100);
check('기록은 하나뿐인 점수판에 오른다', go.naming && go.submitName('Z', '') && go.records.length === 1 && go.records[0].score === 500);

const g0 = new Game({ bonusPlan: {} }); g0.start(); g0.score = 0; g0.finish();
check('0점은 이름을 묻지 않는다', g0.naming === false && g0.phase === 'over');
const gl = new Game({ bonusPlan: {} });
gl.records = Array.from({ length: MAX_RECORDS }, (_, i) => ({ name: 'a', score: 1000 + i, stage: 1 })).sort((a, b) => b.score - a.score);
gl.start(); gl.score = 1000; gl.finish();
check('10위 점수와 같거나 낮으면 이름을 묻지 않는다', gl.naming === false);
const gm = new Game({ bonusPlan: {} }); gm.records = gl.records; gm.start(); gm.score = 1001; gm.finish();
check('10위 점수보다 높으면 이름을 묻는다', gm.naming === true);

// records.js
check('이름은 앞뒤 공백을 떼고 8글자까지', cleanName('  abcdefghijkl ') === 'abcdefgh' && MAX_NAME === 8);
check('한글 이름도 글자 수대로 자른다', cleanName('가나다라마바사아자차') === '가나다라마바사아');
check('이름이 비면 ---', cleanName('   ') === '---' && cleanName(null) === '---' && cleanName(undefined) === '---');
check('qualifies: 빈 판이면 1점부터, 0점은 안 된다', qualifies([], 1) && !qualifies([], 0));
check('addRecord 가 이름을 정리해 넣는다', addRecord([], { name: ' Bob ', score: 5, stage: 1 }).list[0].name === 'Bob');

const legacy = JSON.stringify([
  { score: 300, stage: 3, diff: 'hard' }, { score: 900, stage: 5, diff: 'easy' }, { score: 100, stage: 1 }, { score: 700, stage: 2, diff: 'hard', name: 'Old' },
]);
const lb = parseBoards(legacy);
check('옛 기록(한 배열)을 모두 한 점수판으로', lb.map((r) => r.score).join() === '900,700,300,100');
check('옛 기록의 이름은 ---, 새 이름은 그대로', lb[3].name === '---' && lb[1].name === 'Old');
const nb = parseBoards(JSON.stringify(lb));
check('새 저장 형식도 그대로 읽는다', nb.length === 4 && nb[0].score === 900);
check('깨진 저장값은 빈 점수판', ['{{', null, '7', '"x"'].every((s) => parseBoards(s).length === 0));
check('상위 10개만', (() => { const many = Array.from({ length: 15 }, (_, i) => ({ score: i + 1, stage: 1 })); return parseBoards(JSON.stringify(many)).length === MAX_RECORDS; })());

void TICRATE;
done();
