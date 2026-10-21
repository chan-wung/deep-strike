import { t } from './i18n.js';

/** 내 기록: 점수 높은 순으로 상위 10개만 남긴다 */
export const MAX_RECORDS = 10;
export const MAX_NAME = 8;
/** 이름이 없는 옛 기록에 붙는 이름 */
export const NO_NAME = '---';

const valid = (r) => r && Number.isFinite(r.score) && r.score > 0 && Number.isFinite(r.stage);

/** 이름: 앞뒤 공백을 떼고 MAX_NAME 글자까지만. 비면 NO_NAME */
export function cleanName(name) {
  const s = typeof name === 'string' ? [...name.trim()].slice(0, MAX_NAME).join('') : '';
  return s || NO_NAME;
}

const clean = (r) => ({
  name: cleanName(r.name),
  score: r.score,
  stage: r.stage,
  ratio: Number.isFinite(r.ratio) ? r.ratio : 0,
  bosses: Number.isFinite(r.bosses) ? r.bosses : 0,
  cleared: r.cleared === true,
  date: typeof r.date === 'string' ? r.date : '',
});

const top = (a) => a.filter(valid).map(clean).sort((x, y) => y.score - x.score).slice(0, MAX_RECORDS);

/**
 * 저장된 문자열을 점수판으로. 예전에는 난이도마다 따로 있었으니(배열 하나이거나 난이도별 객체)
 * 어느 쪽이든 모든 기록을 합쳐 점수 높은 순 상위 10개만 남긴다
 */
export function parseBoards(json) {
  try {
    const data = JSON.parse(json);
    if (Array.isArray(data)) return top(data);
    if (data && typeof data === 'object') return top(Object.values(data).filter(Array.isArray).flat());
  } catch { /* 깨진 저장값은 빈 점수판 */ }
  return [];
}

/**
 * 기록 하나를 넣는다. 같은 점수는 먼저 낸 기록이 위. 0점은 저장하지 않는다.
 * 돌려주는 rank 는 1부터 시작하는 순위이고, 10위 밖이거나 저장하지 않았으면 null
 */
export function addRecord(list, rec) {
  if (!valid(rec)) return { list, rank: null };
  const r = clean(rec);
  const next = [...list];
  let i = next.findIndex((x) => x.score < r.score);
  if (i < 0) i = next.length;
  next.splice(i, 0, r);
  return { list: next.slice(0, MAX_RECORDS), rank: i < MAX_RECORDS ? i + 1 : null };
}

/** 이 점수가 점수판에 오를 수 있나 (이름을 물어볼지 정한다). 10위와 같은 점수는 못 오른다 */
export function qualifies(list, score) {
  if (!(score > 0)) return false;
  return list.length < MAX_RECORDS || score > list[list.length - 1].score;
}

/** 공유할 문구 (현재 언어) */
export function shareText(rec, url = '') {
  const who = rec.name && rec.name !== NO_NAME ? `${rec.name} · ` : '';
  return `${t('title')} - ${who}${t('share.text', { score: rec.score, stage: rec.stage, ratio: rec.ratio })} ${url}`.trim();
}
