import { addRecord, parseRecords, shareText, MAX_RECORDS } from '../src/app/records.js';
import { setLang } from '../src/app/i18n.js';
import { check, done } from './lib.mjs';

const rec = (score, stage = 1, extra = {}) => ({ score, stage, ratio: 50, bosses: 0, date: '2026-01-01', ...extra });

let r = addRecord([], rec(1000));
check('첫 기록은 1위', r.rank === 1 && r.list.length === 1);
r = addRecord(r.list, rec(5000));
check('높은 점수가 위로', r.rank === 1 && r.list[0].score === 5000 && r.list[1].score === 1000);
r = addRecord(r.list, rec(3000));
check('중간에 끼어들면 그 순위', r.rank === 2 && r.list.map((x) => x.score).join() === '5000,3000,1000');
r = addRecord(r.list, rec(3000, 4));
check('같은 점수는 먼저 낸 기록이 위', r.rank === 3 && r.list[1].stage === 1 && r.list[2].stage === 4);
check('0점은 저장하지 않는다', addRecord(r.list, rec(0)).rank === null && addRecord(r.list, rec(0)).list === r.list);

let full = [];
for (let i = 1; i <= 12; i++) full = addRecord(full, rec(i * 100)).list;
check('상위 10개만 남는다', full.length === MAX_RECORDS && full[0].score === 1200 && full[9].score === 300);
const low = addRecord(full, rec(50));
check('10위 밖이면 순위 없음 + 목록 그대로', low.rank === null && low.list.length === MAX_RECORDS && low.list[9].score === 300);
check('꼴찌 자리를 밀어내는 기록은 10위', addRecord(full, rec(350)).rank === 9 || addRecord(full, rec(350)).rank === 10);

check('깨진 저장값은 빈 목록', parseRecords('{{') .length === 0 && parseRecords(null).length === 0 && parseRecords('{"a":1}').length === 0);
const p = parseRecords(JSON.stringify([rec(10), { score: 'x' }, rec(30), null, rec(20, 2, { bosses: 'n' })]));
check('저장값에서 잘못된 항목은 버리고 정렬', p.map((x) => x.score).join() === '30,20,10' && p[1].bosses === 0);

setLang('ko');
check('공유 문구(한국어)', shareText(rec(12340, 7, { ratio: 62 }), 'https://x.test/').includes('12340') && shareText(rec(1), '').includes('딥 스트라이크'));
setLang('en');
check('공유 문구(영어)', shareText(rec(12340, 7, { ratio: 62 }), 'https://x.test/') === 'DEEP STRIKE - Score 12340 · Stage 7 · Hit 62% https://x.test/');
done();
