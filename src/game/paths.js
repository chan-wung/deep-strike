/** 논리 화면 크기 (아케이드 비율). 렌더에서 배율을 곱해 canvas 에 그린다 */
export const W = 224;
export const H = 288;
/** 문어가 소용돌이를 펼치려고 멈추는 높이 */
export const BEAM_Y = 170;

const pts = (flat) => {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
};

export function cubic(a, b, c, d, t) {
  const u = 1 - t;
  const k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
  return { x: k0 * a.x + k1 * b.x + k2 * c.x + k3 * d.x, y: k0 * a.y + k1 * b.y + k2 * c.y + k3 * d.y };
}

/** 점 목록 [p0, c1, c2, p1, c1, c2, p2 ...] 을 3차 베지어 조각들로 이어 n 등분 표본으로 만든다 */
export function sample(points, n = 24) {
  const out = [points[0]];
  for (let i = 0; i + 3 < points.length; i += 3) {
    for (let k = 1; k <= n; k++) out.push(cubic(points[i], points[i + 1], points[i + 2], points[i + 3], k / n));
  }
  return out;
}

/** 경로: 표본점과 누적 길이. pathAt(path, 거리) 로 그 거리만큼 간 위치를 얻는다 */
export function makePath(points, n = 24) {
  const p = sample(points, n);
  const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y));
  return { points: p, cum, length: cum[cum.length - 1] };
}

/** d 만큼 간 위치와 진행 방향(a, 라디안). 끝을 넘으면 end: true */
export function pathAt(path, d) {
  const { points, cum, length } = path;
  const end = d >= length;
  const dd = Math.min(Math.max(d, 0), length);
  let lo = 0, hi = cum.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= dd) lo = mid; else hi = mid - 1;
  }
  const a = points[lo], b = points[lo + 1];
  const seg = cum[lo + 1] - cum[lo] || 1;
  const k = (dd - cum[lo]) / seg;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, a: Math.atan2(b.y - a.y, b.x - a.x), end };
}

export const mirror = (points) => points.map((p) => ({ x: W - p.x, y: p.y }));

const A = pts([70, -16, 70, 50, 20, 80, 30, 120, 40, 160, 100, 160, 100, 120]);       // 위 왼쪽에서 내려와 한 바퀴
const C = pts([-16, 210, 50, 230, 90, 190, 100, 150, 110, 110, 50, 90, 60, 130]);     // 왼쪽 옆에서 올라와 한 바퀴
/** 편대 입장 경로 4종: 위 왼쪽 · 위 오른쪽 · 왼쪽 옆 · 오른쪽 옆 */
export const ENTRY_PATHS = [A, mirror(A), C, mirror(C)].map((p) => makePath(p));

const B0 = pts([40, -16, 40, 110, 190, 90, 190, 170, 190, 250, 60, 250, 40, 170, 30, 100, 120, 60, 240, 60]);
const B2 = pts([-16, 60, 100, 40, 150, 120, 112, 160, 70, 200, 40, 260, 112, 310]);
/** 보너스 스테이지: 물고기가 화면을 크게 가로지르다 사라지는 경로 */
export const BONUS_PATHS = [B0, mirror(B0), B2, mirror(B2)].map((p) => makePath(p));

/** 급강하: 바깥쪽으로 한 번 감았다가 플레이어 쪽으로 내려와 화면 아래로 빠진다. d 는 감는 방향(-1/1) */
export function divePath(x, y, tx, d) {
  return makePath(pts([
    x, y, x - d * 36, y + 6, x - d * 36, y + 56, x - d * 8, y + 64,
    x + d * 20, y + 100, tx, y + 120, tx, 190,
    tx, 230, tx - d * 30, 260, tx - d * 50, H + 24,
  ]));
}

/** 문어가 소용돌이를 펼칠 자리(tx, BEAM_Y)까지 가는 경로 */
export function beamPath(x, y, tx, d) {
  return makePath(pts([
    x, y, x - d * 36, y + 6, x - d * 36, y + 56, x - d * 8, y + 64,
    x + d * 20, y + 100, tx, y + 110, tx, BEAM_Y,
  ]));
}

/** 전기뱀장어: 대열에서 내려와 화면을 가로로 길게 가로지른다 (tx 에 따라 가로지르는 높이가 달라진다) */
export function sweepPath(x, y, tx) {
  const dir = x < W / 2 ? 1 : -1;
  const sy = 130 + (Math.round(tx) % 60);
  const endX = dir > 0 ? W + 24 : -24;
  return makePath(pts([
    x, y, x, y + (sy - y) * 0.3, x, y + (sy - y) * 0.7, x + dir * 10, sy,
    x + dir * 70, sy - 36, x + dir * 120, sy + 36, endX, sy,
  ]));
}

/** 가오리: 좌우로 지그재그 내려오다 플레이어 쪽으로 빠진다. d 는 처음 꺾는 방향(-1/1) */
export function zigzagPath(x, y, tx, d) {
  return makePath(pts([
    x, y, x + d * 10, y + 20, x + d * 45, y + 30, x + d * 45, y + 55,
    x + d * 45, y + 80, x - d * 30, y + 80, x - d * 30, y + 110,
    x - d * 30, y + 140, tx + d * 25, 160, tx + d * 25, 190,
    tx + d * 25, 230, tx, 260, tx, H + 24,
  ]));
}

/** 꺾은선 (점 목록을 직선으로 잇는다) 경로 */
export function polyPath(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) out.push(points[i - 1], points[i], points[i]);
  return makePath(out, 2);
}

/** 보너스 소용돌이: (cx, cy) 근처에서 시작해 arm 방향(시작 각도)으로 나선을 그리며 화면 밖까지 퍼진다. dir 은 감는 방향(-1/1) */
export function spiralPath(cx, cy, a0, dir) {
  const pts = [];
  for (let r = 6; r <= 190; r += 6) pts.push({ x: cx + Math.cos(a0 + dir * r * 0.032) * r, y: cy + Math.sin(a0 + dir * r * 0.032) * r * 0.9 });
  return polyPath(pts);
}

/** 황금 고래: 위쪽 바다를 천천히 가로질러 갔다가 돌아온다. dir 은 처음 가는 방향(-1/1) */
export function whalePath(dir) {
  const xa = dir > 0 ? -30 : W + 30, xb = W - xa;
  return makePath(pts([
    xa, 70, xa + (xb - xa) * 0.25, 40, xa + (xb - xa) * 0.5, 110, xb, 80,
    xb + (xa - xb) * 0.2, 150, xb + (xa - xb) * 0.6, 40, xa, 120,
  ]));
}
