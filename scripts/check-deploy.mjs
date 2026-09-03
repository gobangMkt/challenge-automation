#!/usr/bin/env node
/* 배포 전 대조 — 프론트가 호출하는 GAS 배포가 최신인지 확인한다.
   판정 로직은 src/lib/deploy-check.js(테스트로 고정), 여기는 파일·clasp 호출만 하는 어댑터. */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseEndpointId, parseDeployments, checkDeployAlignment } from '../src/lib/deploy-check.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// WHY: Windows에서 npx.cmd는 execFile로 직접 실행되지 않는다(Node의 .cmd 차단) — 셸을 경유한다.
const run = (cmd) => execSync(`npx ${cmd}`, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const endpointId = parseEndpointId(readFileSync(join(root, 'public/js/config.js'), 'utf8'));

let deployments;
let latestProjectVersion;
try {
  deployments = parseDeployments(run('clasp deployments'));
  const vs = run('clasp versions').match(/^\s*(\d+) -/gm);
  if (vs) latestProjectVersion = Math.max(...vs.map((v) => Number(v.match(/(\d+)/)[1])));
} catch (e) {
  const out = `${e.stdout || ''}${e.stderr || ''}${e.message || ''}`;
  if (/invalid_grant|reauth|not logged in/i.test(out)) {
    console.error('✖ clasp 인증이 만료됐다. `npx clasp login` 후 다시 실행할 것.');
    process.exit(2);
  }
  console.error('✖ clasp 호출 실패:', out.trim().split('\n').slice(-2).join(' '));
  process.exit(2);
}

const r = checkDeployAlignment({ endpointId, deployments, latestProjectVersion });
if (r.ok) {
  console.log(`✔ 배포 정렬 OK — 운영 URL(${endpointId.slice(0, 12)}…)이 @${r.currentVersion} 최신`);
  process.exit(0);
}
console.error(`✖ [${r.code}] ${r.message}`);
if (r.fixCommand) console.error(`  → 고치는 명령: ${r.fixCommand}`);
console.error('  → 운영 URL은 public/js/config.js의 GAS_ENDPOINT가 유일한 기준이다(메모리·문서 값 믿지 말 것).');
process.exit(1);
