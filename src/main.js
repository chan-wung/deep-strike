import { Game, TICRATE, DIFFICULTIES } from './game/game.js';
import { draw, canvasSize } from './render/render.js';
import { cardBlob } from './render/card.js';
import { setLang, getLang, t } from './app/i18n.js';
import { addRecord, parseRecords, shareText } from './app/records.js';
import { Sfx } from './app/sound.js';
import { isTouchDevice, setupTouch } from './ui/touch.js';

const MOVE_KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
const FIRE_KEYS = new Set(['Space', 'KeyZ', 'ArrowUp', 'KeyW']);
const ULT_KEYS = new Set(['KeyX', 'KeyB', 'ShiftLeft', 'ShiftRight']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const HI_KEY = 'deepstrike.hi';
const LANG_KEY = 'deepstrike.lang';
const REC_KEY = 'deepstrike.records';
const DIFF_KEY = 'deepstrike.diff';
const MUTE_KEY = 'deepstrike.mute';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 저장이 막힌 환경 */ } },
};

const game = new Game();
game.hiScore = Number(store.get(HI_KEY)) || 0;
game.records = parseRecords(store.get(REC_KEY));
game.hiScore = Math.max(game.hiScore, game.records[0]?.score || 0);
if (DIFFICULTIES[store.get(DIFF_KEY)]) game.setDifficulty(store.get(DIFF_KEY));
setLang(store.get(LANG_KEY) || (navigator.language?.startsWith('ko') ? 'ko' : 'en'));

const sfx = new Sfx();
sfx.muted = store.get(MUTE_KEY) === '1';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const size = canvasSize();
canvas.width = size.width;
canvas.height = size.height;

const $ = (id) => document.getElementById(id);
const langBtn = $('lang'), muteBtn = $('mute'), diffBtn = $('diff'), shareBtn = $('share'), saveBtn = $('save'), ultBtn = $('ult'), toastEl = $('toast');

/** 언어에 따라 바뀌는 버튼 글자 */
const showLabels = () => {
  langBtn.textContent = getLang() === 'ko' ? 'EN' : '한';
  shareBtn.textContent = t('btn.share');
  saveBtn.textContent = t('btn.save');
  diffBtn.textContent = `${t('diff.label')}: ${t(`diff.${game.difficulty}`)}`;
  muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
};
showLabels();

let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

langBtn.addEventListener('click', () => {
  setLang(getLang() === 'ko' ? 'en' : 'ko');
  store.set(LANG_KEY, getLang());
  showLabels();
  langBtn.blur();
});
muteBtn.addEventListener('click', () => { toggleMute(); muteBtn.blur(); });
function toggleMute() {
  sfx.setMuted(!sfx.muted);
  store.set(MUTE_KEY, sfx.muted ? '1' : '0');
  sfx.unlock();
  showLabels();
}
function cycleDifficulty(step = 1) {
  game.cycleDifficulty(step);
  store.set(DIFF_KEY, game.difficulty);
  showLabels();
}
diffBtn.addEventListener('click', () => { cycleDifficulty(1); diffBtn.blur(); });

if (isTouchDevice()) setupTouch(game, canvas);

const moveHeld = new Set(), fireHeld = new Set();
const syncKeys = () => {
  let m = 0;
  for (const c of moveHeld) m += MOVE_KEYS[c];
  game.setMove(Math.sign(m));
  game.setFire(fireHeld.size > 0);
};

addEventListener('keydown', (e) => {
  if (e.code === 'F5' || e.metaKey || e.ctrlKey || e.altKey) return;
  sfx.unlock();                                              // 브라우저 정책상 첫 입력 뒤에야 소리를 낼 수 있다
  const idle = game.phase === 'title' || game.phase === 'over';
  if (idle && e.code in MOVE_KEYS) {                         // 타이틀·게임 오버에서 좌우 키는 난이도 선택
    e.preventDefault();
    if (!e.repeat) cycleDifficulty(MOVE_KEYS[e.code]);
    return;
  }
  if (e.code in MOVE_KEYS) { e.preventDefault(); moveHeld.add(e.code); syncKeys(); }
  if (FIRE_KEYS.has(e.code)) { e.preventDefault(); fireHeld.add(e.code); syncKeys(); }
  if (e.repeat) return;
  if (ULT_KEYS.has(e.code)) { e.preventDefault(); game.ult(); }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (PAUSE_KEYS.has(e.code)) { e.preventDefault(); game.togglePause(); }   // 타이틀·게임 오버에서는 아무 일 없이 start 로 넘어간다
  game.start();
});
addEventListener('keyup', (e) => {
  moveHeld.delete(e.code);
  fireHeld.delete(e.code);
  syncKeys();
});
addEventListener('blur', () => { moveHeld.clear(); fireHeld.clear(); syncKeys(); });
addEventListener('pointerdown', () => sfx.unlock());

const pauseBtn = $('pause');
pauseBtn.addEventListener('click', () => { game.togglePause(); pauseBtn.blur(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });   // 다른 탭으로 가면 자동으로 멈춘다

/** 게임 오버로 만들어진 이번 판 기록을 내 기록에 넣고 저장한다 (판마다 한 번) */
let handled = null;
function saveRecord(r) {
  const rec = { ...r, date: new Date().toISOString().slice(0, 10) };
  const { list, rank } = addRecord(game.records, rec);
  game.records = list;
  game.rank = rank;
  game.lastRecord = rec;
  handled = rec;
  store.set(REC_KEY, JSON.stringify(list));
}

const shareUrl = () => location.origin + location.pathname;

async function shareRecord() {
  const rec = game.lastRecord;
  if (!rec) return;
  const text = shareText(rec, shareUrl());
  try {
    const blob = await cardBlob(rec);
    const file = new File([blob], 'deep-strike.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (err) {
    if (err?.name === 'AbortError') return;                  // 사용자가 공유 창을 닫았다
  }
  try { await navigator.clipboard.writeText(text); toast(t('msg.copied')); } catch { toast(text); }
}

async function saveCard() {
  const rec = game.lastRecord;
  if (!rec) return;
  const blob = await cardBlob(rec);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `deep-strike-${rec.score}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
shareBtn.addEventListener('click', () => { shareRecord(); shareBtn.blur(); });
saveBtn.addEventListener('click', () => { saveCard(); saveBtn.blur(); });

let last = performance.now(), acc = 0, savedHi = game.hiScore;
function frame(now) {
  acc += Math.min(now - last, 250);       // 탭이 멈췄다 돌아와도 한꺼번에 몰아 돌리지 않게
  last = now;
  const step = 1000 / TICRATE;
  while (acc >= step) { game.tick(); acc -= step; }

  for (const name of game.events) sfx.play(name);
  game.events.length = 0;

  if (game.phase === 'over' && game.lastRecord && game.lastRecord !== handled) saveRecord(game.lastRecord);
  if (game.hiScore !== savedHi && game.phase !== 'play') { savedHi = game.hiScore; store.set(HI_KEY, String(savedHi)); }

  const idle = game.phase === 'title' || game.phase === 'over';
  diffBtn.hidden = !idle;
  shareBtn.hidden = saveBtn.hidden = !(game.phase === 'over' && game.lastRecord);
  ultBtn.classList.toggle('ready', game.gaugeFull && !game.bonus);
  if (diffBtn.textContent !== `${t('diff.label')}: ${t(`diff.${game.difficulty}`)}`) showLabels();

  draw(ctx, game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__game = game;     // 개발 중 콘솔에서 상태 확인용
