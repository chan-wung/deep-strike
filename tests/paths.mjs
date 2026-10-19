import { W, H, BEAM_Y, makePath, pathAt, mirror, ENTRY_PATHS, BONUS_PATHS, divePath, beamPath } from '../src/game/paths.js';
import { check, done } from './lib.mjs';

const line = makePath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }]);
check('직선 경로의 길이', Math.abs(line.length - 30) < 0.01, `len=${line.length}`);
const mid = pathAt(line, 15);
check('경로 중간 위치와 방향', Math.abs(mid.x - 15) < 0.01 && mid.y === 0 && mid.a === 0 && !mid.end);
check('경로 끝을 넘으면 end', pathAt(line, 31).end && Math.abs(pathAt(line, 31).x - 30) < 0.01);
check('경로 시작 앞은 시작점', pathAt(line, -5).x === 0);

const m = mirror([{ x: 10, y: 5 }]);
check('좌우 뒤집기', m[0].x === W - 10 && m[0].y === 5);

check('입장 경로는 4종, 모두 화면 위나 옆에서 시작', ENTRY_PATHS.length === 4 && ENTRY_PATHS.every((p) => {
  const s = p.points[0];
  return s.y < 0 || s.x < 0 || s.x > W;
}));
check('입장 경로는 모두 대열 높이 근처에서 끝난다', ENTRY_PATHS.every((p) => { const e = p.points.at(-1); return e.y > 80 && e.y < 180 && e.x > 0 && e.x < W; }));
check('보너스 경로는 화면 밖에서 끝난다', BONUS_PATHS.every((p) => { const e = p.points.at(-1); return e.x < 0 || e.x > W || e.y < 0 || e.y > H; }));

const dive = divePath(112, 60, 150, 1);
check('급강하는 플레이어 쪽 x 를 지나 화면 아래로 빠진다', dive.points.at(-1).y > H && dive.points.some((p) => Math.abs(p.x - 150) < 2 && p.y > 150));
const beam = beamPath(112, 44, 80, -1);
const be = beam.points.at(-1);
check('소용돌이 경로는 목표 x, BEAM_Y 에서 끝난다', be.x === 80 && be.y === BEAM_Y);
done();
