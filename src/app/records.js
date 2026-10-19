import { t } from './i18n.js';

/** 내 기록: 점수가 높은 순으로 상위 10개만 남긴다 */
export const MAX_RECORDS = 10;

const valid = (r) => r && Number.isFinite(r.score) && r.score > 0 && Number.isFinite(r.stage);
const clean = (r) => ({
  score: r.score,
  stage: r.stage,
  ratio: Number.isFinite(r.ratio) ? r.ratio : 0,
  bosses: Number.isFinite(r.bosses) ? r.bosses : 0,
  diff: ['easy', 'normal', 'hard'].includes(r.diff) ? r.diff : 'normal',
  date: typeof r.date === 'string' ? r.date : '',
});

/** 저장된 문자열을 기록 목록으로. 깨졌거나 없으면 빈 목록 */
export function parseRecords(json) {
  try {
    const a = JSON.parse(json);
    if (!Array.isArray(a)) return [];
    return a.filter(valid).map(clean).sort((x, y) => y.score - x.score).slice(0, MAX_RECORDS);
  } catch { return []; }
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

/** 공유할 문구 (현재 언어) */
export function shareText(rec, url = '') {
  return `${t('title')} - ${t('share.text', { score: rec.score, stage: rec.stage, ratio: rec.ratio })} ${url}`.trim();
}
