import { Game, TICRATE, FINAL_STAGE, ENDING_SKIP, DIFFICULTIES } from '../src/game/game.js';
import { addRecord, cleanName, parseBoards, parseClears, qualifies, MAX_NAME, MAX_RECORDS } from '../src/app/records.js';
import { check, done } from './lib.mjs';

const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };

/** 마지막 보스 스테이지에서 보스를 쓰러뜨리고 clear 타이머까지 돌린다 */
function beatFinalBoss(difficulty, { lives = 3, score = 1000 } = {}) {
  const g = new Game();
  if (difficulty === 'endless') ['easy', 'normal', 'hard'].forEach((d) => g.clears.add(d));
  g.setDifficulty(difficulty);
  g.start();
  g.stage = FINAL_STAGE; g.startStage();
  g.lives = lives; g.score = score;
  g.phase = 'play';
  g.boss.state = 'fight'; g.boss.y = 74;
  g.damageBoss(9999);
  run(g, 330);                         // 쓰러지는 연출(2초) → clear → clear 타이머(2초)
  return g;
}

check('마지막 보스는 15 스테이지', FINAL_STAGE === 15);

const g = beatFinalBoss('normal', { lives: 2, score: 1000 });
check('보통: 마지막 보스를 잡으면 엔딩', g.phase === 'ending' && g.cleared === true, g.phase);
check('엔딩 보너스는 남은 잠수함 한 대당 10000', g.ending.bonus === 20000 && g.score >= 21000, `score=${g.score}`);
check('깬 난이도가 기록된다', g.clears.has('normal') && !g.clears.has('easy'));
check('엔딩 기록에 cleared 가 붙는다', g.lastRecord && g.lastRecord.cleared === true && g.lastRecord.diff === 'normal' && g.lastRecord.stage === 15);
check('엔딩 중에는 일시정지가 의미 없다', g.canPause === false);
g.start();
check('엔딩이 막 시작했을 때는 키로 넘어가지 않는다', g.phase === 'ending');
run(g, ENDING_SKIP);
g.start();
check('잠시 뒤 키를 누르면 결과 화면', g.phase === 'over' && g.naming === true);
g.start();
check('이름을 쓰는 중에는 새 게임이 시작되지 않는다', g.phase === 'over');
check('이름을 쓰는 동안은 모드를 못 바꾼다', (() => { g.cycleDifficulty(1); return g.difficulty === 'normal'; })());
check('이름을 내면 이번 모드 점수판에 오른다', g.submitName('  Kim  ', '2026-02-02') && g.naming === false && g.records[0].name === 'Kim' && g.records[0].cleared === true && g.rank === 1 && g.rankMode === 'normal');
check('다른 모드 점수판은 그대로', g.boards.easy.length === 0 && g.boards.hard.length === 0);
check('두 번 내도 한 번만 올라간다', g.submitName('X') === false && g.records.length === 1);
for (let i = 0; i < 60; i++) g.tick();
g.start();
check('이름을 낸 뒤 키를 누르면 새 게임', g.phase === 'ready' && g.stage === 1 && g.cleared === false);

// 무한 모드 해금
const gu = new Game();
check('처음에는 무한 모드가 잠겨 있다', !gu.endlessUnlocked && gu.modes.length === 3);
gu.setDifficulty('endless');
check('잠겼을 때 무한을 고를 수 없다', gu.difficulty === 'normal');
for (let i = 0; i < 6; i++) gu.cycleDifficulty(1);
check('잠겼을 때 난이도를 돌려도 무한이 나오지 않는다', gu.difficulty !== 'endless');
gu.clears.add('easy'); gu.clears.add('normal');
check('두 개만 깨서는 아직 잠김', !gu.endlessUnlocked);
gu.clears.add('hard');
check('세 난이도를 모두 깨면 열린다', gu.endlessUnlocked && gu.modes.join() === 'easy,normal,hard,endless');
gu.setDifficulty('endless');
check('무한 모드를 고를 수 있다', gu.difficulty === 'endless' && gu.cfg === DIFFICULTIES.endless);
gu.cycleDifficulty(1);
check('무한 다음은 쉬움으로 돈다', gu.difficulty === 'easy');
gu.cycleDifficulty(-1);
check('거꾸로 돌면 무한', gu.difficulty === 'endless');

// 무한 모드는 15 스테이지에서 끝나지 않는다
const ge = beatFinalBoss('endless');
check('무한: 15 스테이지 보스를 잡아도 엔딩 없이 16 스테이지', ge.phase === 'ready' && ge.stage === 16 && !ge.cleared && !ge.clears.has('endless'), `${ge.phase} ${ge.stage}`);

// 게임 오버와 모드별 점수판
const go = new Game();
go.clears.add('easy'); go.clears.add('normal'); go.clears.add('hard');
go.setDifficulty('endless'); go.start();
go.score = 500; go.stats = { shots: 4, hits: 5, bosses: 0 };
go.finish();
check('명중이 쏜 수보다 많아도 명중률은 100% 까지', go.lastRecord.ratio === 100);
check('무한 모드 기록은 무한 점수판에 오른다', go.naming && go.submitName('Z', '') && go.boards.endless.length === 1 && go.boards.normal.length === 0);
go.setDifficulty('normal');
check('모드를 바꾸면 그 모드의 점수판과 최고 점수가 보인다', go.records.length === 0 && go.hiScore === 0);
go.setDifficulty('endless');
check('무한으로 돌아오면 무한의 최고 점수', go.hiScore === 500);

const g0 = new Game(); g0.start(); g0.score = 0; g0.finish();
check('0점은 이름을 묻지 않는다', g0.naming === false && g0.phase === 'over');
const gl = new Game();
gl.boards.normal = Array.from({ length: MAX_RECORDS }, (_, i) => ({ name: 'a', score: 1000 + i, stage: 1, diff: 'normal' })).sort((a, b) => b.score - a.score);
gl.start(); gl.score = 1000; gl.finish();
check('10위 점수와 같거나 낮으면 이름을 묻지 않는다', gl.naming === false);
const gm = new Game(); gm.boards.normal = gl.boards.normal; gm.start(); gm.score = 1001; gm.finish();
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
check('옛 기록(한 배열)을 난이도별 점수판으로 나눈다', lb.easy.length === 1 && lb.hard.length === 2 && lb.normal.length === 1 && lb.endless.length === 0 && lb.hard[0].score === 700);
check('옛 기록의 이름은 ---, 새 이름은 그대로', lb.easy[0].name === '---' && lb.hard[0].name === 'Old');
const nb = parseBoards(JSON.stringify(lb));
check('새 저장 형식도 그대로 읽는다', nb.hard.length === 2 && nb.easy[0].score === 900);
check('깨진 저장값은 빈 점수판 넷', ['{{', null, '7', '"x"'].every((s) => Object.values(parseBoards(s)).every((l) => l.length === 0)));
check('모드마다 상위 10개', (() => { const many = Array.from({ length: 15 }, (_, i) => ({ score: i + 1, stage: 1, diff: 'easy' })); return parseBoards(JSON.stringify(many)).easy.length === MAX_RECORDS; })());
check('깬 난이도 목록을 읽는다 (무한과 엉뚱한 값은 버림)', parseClears('["easy","hard","endless","x"]').join() === 'easy,hard' && parseClears('{{').length === 0);

void TICRATE;
done();
