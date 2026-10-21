import { Game, TICRATE } from './game/game.js';
import { draw, canvasSize, setTouchUI } from './render/render.js';
import { cardBlob } from './render/card.js';
import { setLang, getLang, t } from './app/i18n.js';
import { parseBoards, shareText } from './app/records.js';
import { Sfx, Music } from './app/sound.js';
import { isTouchDevice, setupTouch } from './ui/touch.js';

const MOVE_KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
const FIRE_KEYS = new Set(['Space', 'KeyZ', 'ArrowUp', 'KeyW']);
const ULT_KEYS = new Set(['KeyX', 'KeyB', 'ShiftLeft', 'ShiftRight']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const LANG_KEY = 'deepstrike.lang';
const REC_KEY = 'deepstrike.records';       // 점수판 (난이도별로 나뉘어 있던 예전 형식도 읽어 합친다)
const NAME_KEY = 'deepstrike.name';         // 마지막에 쓴 이름
const MUTE_KEY = 'deepstrike.mute';
const MUSIC_KEY = 'deepstrike.musicMute';   // 배경 음악만 따로 끄는 설정
const SHIP_KEY = 'deepstrike.ship';         // 마지막에 고른 잠수함 기체
const GOLD_KEY = 'deepstrike.gold';         // 히든 기체(황금 잠수함) 해금 여부
const ULT_ICON = { wave: '🌊', storm: '🎯', carpet: '💣', gold: '👑' };   // 기체별 필살기 버튼 그림

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 저장이 막힌 환경 */ } },
};

const game = new Game();
game.records = parseBoards(store.get(REC_KEY));
game.syncHi();
game.goldUnlocked = store.get(GOLD_KEY) === '1';
game.chooseShip(store.get(SHIP_KEY));
setLang(store.get(LANG_KEY) || (navigator.language?.startsWith('ko') ? 'ko' : 'en'));

const sfx = new Sfx();
sfx.muted = store.get(MUTE_KEY) === '1';
const music = new Music(sfx);
music.muted = store.get(MUSIC_KEY) === '1';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const size = canvasSize();
canvas.width = size.width;
canvas.height = size.height;

const $ = (id) => document.getElementById(id);
const langBtn = $('lang'), muteBtn = $('mute'), musicBtn = $('music'), shareBtn = $('share'), saveBtn = $('save'), ultBtn = $('ult'), toastEl = $('toast');
const nameForm = $('name'), nameInput = $('nameInput'), nameOk = $('nameOk');

/** 언어에 따라 바뀌는 버튼 글자 */
const showLabels = () => {
  langBtn.textContent = getLang() === 'ko' ? 'EN' : '한';
  shareBtn.textContent = t('btn.share');
  saveBtn.textContent = t('btn.save');
  muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
  musicBtn.textContent = '🎵';
  musicBtn.style.opacity = music.muted ? '.45' : '1';
  document.documentElement.lang = getLang();
  nameOk.textContent = t('name.ok');
  nameInput.placeholder = t('name.default');
  $('rotate').textContent = t('msg.rotate');
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
musicBtn.addEventListener('click', () => { toggleMusic(); musicBtn.blur(); });
function toggleMusic() {
  music.setMuted(!music.muted);
  store.set(MUSIC_KEY, music.muted ? '1' : '0');
  sfx.unlock();
  showLabels();
}
function toggleMute() {
  sfx.setMuted(!sfx.muted);
  store.set(MUTE_KEY, sfx.muted ? '1' : '0');
  sfx.unlock();
  showLabels();
}
if (isTouchDevice()) {
  setupTouch(game, canvas);
  setTouchUI(true);
  // 웹에서는 화면 회전을 막을 수 없어서, 휴대폰을 가로로 돌리면 게임을 멈추고 세로로 돌려 달라는 화면을 띄운다 (index.html 의 #rotate)
  const landscape = matchMedia('(orientation: landscape) and (max-height: 500px)');
  const onRotate = () => { if (landscape.matches) game.pause(); };
  landscape.addEventListener('change', onRotate);
  onRotate();
  // 전체 화면·홈 화면 앱처럼 허락되는 환경에서는 세로로 고정해 본다 (일반 브라우저 탭에서는 실패하고 넘어간다)
  addEventListener('pointerdown', () => screen.orientation?.lock?.('portrait').catch(() => {}), { once: true });
}

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
  if (game.phase === 'select' && e.code.startsWith('Arrow')) {   // 비밀 커맨드(↑↑↓↓←→←→): 열리면 황금 잠수함을 고른 채로 둔다. ↑ ↓ 는 출발하지 않는다
    if (!e.repeat && game.secretKey(e.code)) { e.preventDefault(); return; }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { e.preventDefault(); return; }
  }
  if (game.canPick && e.code in MOVE_KEYS) {                 // 기체 고르기·결과 화면에서 ← → 는 기체 고르기 (시작하지 않는다)
    e.preventDefault();
    if (!e.repeat) game.selectShip(MOVE_KEYS[e.code]);
    return;
  }
  if (e.code in MOVE_KEYS) { e.preventDefault(); moveHeld.add(e.code); syncKeys(); }
  if (FIRE_KEYS.has(e.code)) { e.preventDefault(); fireHeld.add(e.code); syncKeys(); }
  if (e.repeat) return;
  if (ULT_KEYS.has(e.code)) { e.preventDefault(); game.ult(); }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'KeyN') { toggleMusic(); return; }
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
  if (game.submitName(name, new Date().toISOString().slice(0, 10))) store.set(REC_KEY, JSON.stringify(game.records));
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
    const blob = await cardBlob(rec);      // 카드를 못 만들면(null) 글만 공유한다
    const file = blob && new File([blob], 'deep-strike.png', { type: 'image/png' });
    if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (err) {
    if (err?.name === 'AbortError') return;                  // 사용자가 공유 창을 닫았다
  }
  try { await navigator.clipboard.writeText(text); toast(t('msg.copied')); } catch { toast(text); }
}

async function saveCard() {
  const rec = game.lastRecord;
  if (!rec) return;
  const blob = await cardBlob(rec).catch(() => null);
  if (!blob) { toast(t('msg.savefail')); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `deep-strike-${rec.score}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
shareBtn.addEventListener('click', () => { shareRecord(); shareBtn.blur(); });
saveBtn.addEventListener('click', () => { saveCard(); saveBtn.blur(); });

let last = performance.now(), acc = 0, savedShip = game.pickId, savedGold = game.goldUnlocked;
function frame(now) {
  acc += Math.min(now - last, 250);       // 탭이 멈췄다 돌아와도 한꺼번에 몰아 돌리지 않게
  last = now;
  const step = 1000 / TICRATE;
  while (acc >= step) { game.tick(); acc -= step; }

  for (const name of game.events) sfx.play(name);
  game.events.length = 0;
  music.update(game.music, game.stage, game.paused);

  syncNameForm();

  shareBtn.hidden = saveBtn.hidden = !(game.phase === 'over' && game.lastRecord && !game.naming);
  ultBtn.classList.toggle('ready', game.bombs > 0 && !game.bonus);
  const icon = ULT_ICON[game.special];
  if (ultBtn.textContent !== icon) ultBtn.textContent = icon;
  if (savedShip !== game.pickId) { savedShip = game.pickId; store.set(SHIP_KEY, game.pickId); }
  if (savedGold !== game.goldUnlocked) { savedGold = game.goldUnlocked; store.set(GOLD_KEY, savedGold ? '1' : '0'); if (savedGold) toast(t('msg.unlock')); }

  draw(ctx, game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// 오프라인·홈 화면 설치용 서비스 워커 (개발 서버에서는 캐시가 개발을 방해해서 빌드본에서만)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}
window.__game = game;     // 개발 중 콘솔에서 상태 확인용
