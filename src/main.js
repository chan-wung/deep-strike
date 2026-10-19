import { Game, TICRATE, DIFFICULTIES } from './game/game.js';
import { draw, canvasSize } from './render/render.js';
import { cardBlob } from './render/card.js';
import { setLang, getLang, t } from './app/i18n.js';
import { parseBoards, parseClears, shareText } from './app/records.js';
import { Sfx } from './app/sound.js';
import { isTouchDevice, setupTouch } from './ui/touch.js';

const MOVE_KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
const FIRE_KEYS = new Set(['Space', 'KeyZ', 'ArrowUp', 'KeyW']);
const ULT_KEYS = new Set(['KeyX', 'KeyB', 'ShiftLeft', 'ShiftRight']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const LANG_KEY = 'deepstrike.lang';
const REC_KEY = 'deepstrike.records';       // 모드별 점수판 (예전 한 배열 형식도 읽는다)
const CLEARS_KEY = 'deepstrike.clears';     // 엔딩을 본 난이도
const NAME_KEY = 'deepstrike.name';         // 마지막에 쓴 이름
const DIFF_KEY = 'deepstrike.diff';
const MUTE_KEY = 'deepstrike.mute';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 저장이 막힌 환경 */ } },
};

const game = new Game();
game.boards = parseBoards(store.get(REC_KEY));
parseClears(store.get(CLEARS_KEY)).forEach((d) => game.clears.add(d));
if (DIFFICULTIES[store.get(DIFF_KEY)]) game.setDifficulty(store.get(DIFF_KEY));   // 클리어 기록을 읽은 뒤에 (무한은 해금돼야 고를 수 있다)
game.syncHi();
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
const nameForm = $('name'), nameInput = $('nameInput'), nameOk = $('nameOk');

const diffLabel = () => `${t('diff.label')}: ${t(`diff.${game.difficulty}`)}${game.clears.has(game.difficulty) ? ' ★' : ''}`;

/** 언어에 따라 바뀌는 버튼 글자 */
const showLabels = () => {
  langBtn.textContent = getLang() === 'ko' ? 'EN' : '한';
  shareBtn.textContent = t('btn.share');
  saveBtn.textContent = t('btn.save');
  diffBtn.textContent = diffLabel();
  muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
  nameOk.textContent = t('name.ok');
  nameInput.placeholder = t('name.default');
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
  if (game.naming) return;                                   // 이름을 쓰는 중에는 입력창이 키를 받는다 (타이핑이 게임 키로 새지 않게)
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

/** 이름을 받아 이번 기록을 점수판에 올리고 저장한다 */
function submitName(raw) {
  const name = raw.trim() || t('name.default');
  store.set(NAME_KEY, name);
  if (game.submitName(name, new Date().toISOString().slice(0, 10))) store.set(REC_KEY, JSON.stringify(game.boards));
  nameInput.blur();
}
nameForm.addEventListener('submit', (e) => { e.preventDefault(); submitName(nameInput.value); });
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); submitName(store.get(NAME_KEY) || ''); }   // Esc: 지난번 이름(없으면 기본 이름)으로 올린다
});

/** 이름 입력 칸은 점수판에 오르는 결과 화면에서만 보인다 */
function syncNameForm() {
  if (game.naming && nameForm.hidden) {
    nameForm.hidden = false;
    nameInput.value = store.get(NAME_KEY) || '';
    nameInput.focus();
    nameInput.select();
  } else if (!game.naming && !nameForm.hidden) nameForm.hidden = true;
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

let savedClears = game.clears.size;
function frame(now) {
  acc += Math.min(now - last, 250);       // 탭이 멈췄다 돌아와도 한꺼번에 몰아 돌리지 않게
  last = now;
  const step = 1000 / TICRATE;
  while (acc >= step) { game.tick(); acc -= step; }

  for (const name of game.events) sfx.play(name);
  game.events.length = 0;

  if (game.clears.size !== savedClears) { savedClears = game.clears.size; store.set(CLEARS_KEY, JSON.stringify([...game.clears])); }
  syncNameForm();

  const idle = (game.phase === 'title' || game.phase === 'over') && !game.naming;
  diffBtn.hidden = !idle;
  shareBtn.hidden = saveBtn.hidden = !(game.phase === 'over' && game.lastRecord && !game.naming);
  ultBtn.classList.toggle('ready', game.gaugeFull && !game.bonus);
  if (diffBtn.textContent !== diffLabel()) showLabels();

  draw(ctx, game);
  requestAnimationFrame(frame);
}
let last = performance.now(), acc = 0;
requestAnimationFrame(frame);
window.__game = game;     // 개발 중 콘솔에서 상태 확인용
