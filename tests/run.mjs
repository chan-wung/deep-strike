/** 전체 테스트 실행: 각 스크립트 출력에 FAIL/ERROR 가 있으면 실패로 끝낸다. 사용: npm test */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const suites = ['i18n', 'records', 'paths', 'formation', 'player', 'enemy', 'kraken', 'extras', 'game'];
let failed = 0;
for (const name of suites) {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL(`./${name}.mjs`, import.meta.url))], { encoding: 'utf8', timeout: 60000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const pass = (out.match(/^PASS/gm) || []).length;
  const bad = out.split('\n').filter((l) => /^FAIL|ERROR|Error:/.test(l));
  console.log(`${bad.length || r.status ? '✘' : '✔'} ${name.padEnd(9)} PASS ${pass}${bad.length ? `  FAIL ${bad.length}` : ''}`);
  for (const l of bad) console.log('    ' + l);
  if (bad.length || r.status) failed++;
}
process.exit(failed ? 1 : 0);
