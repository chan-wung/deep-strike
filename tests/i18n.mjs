import { dictKeys, dictValue, LANGS, setLang, t } from '../src/app/i18n.js';
import { dragTarget } from '../src/ui/touch.js';
import { check, done } from './lib.mjs';

const en = dictKeys('en'), ko = dictKeys('ko');
check('영어·한국어 사전의 키가 같다', en.length === ko.length && en.every((k) => ko.includes(k)), `en=${en.length} ko=${ko.length}`);
check('빈 문구가 없다', LANGS.every((l) => dictKeys(l).every((k) => String(dictValue(l, k)).trim())));
setLang('ko');
check('한국어: 변수 치환', t('hud.stage', { n: 3 }) === '3 스테이지');
setLang('en');
check('영어: 변수 치환', t('hud.stage', { n: 3 }) === 'STAGE 3');
check('없는 키는 키 그대로', t('nope') === 'nope');

check('터치: 오른쪽으로 화면 너비만큼 끌면 논리 너비만큼 간다', dragTarget(100, 448, 448) === 324);
check('터치: 안 끌면 제자리', dragTarget(100, 0, 300) === 100);
check('터치: 왼쪽으로 끌면 작아진다', dragTarget(100, -112, 448) === 44);
done();
