import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEndpointId, parseDeployments, checkDeployAlignment } from '../src/lib/deploy-check.js';

/* WHY: 2026-08-28, 메모리에 적힌 옛 deploymentId를 믿고 배포해 fix가 프론트가 호출하지 않는
   슬롯에 붙었다. 실운영은 @38에 6일간 머물러 유실 버그가 계속 재현됐다.
   사람이 URL을 눈으로 대조하는 것에 의존하지 않도록 판정을 기계에 고정한다. */

const CLASP_OUT = `Found 4 deployments.
- AKfycbyhRwJG1r__YGDbb-MBDfkQQVHIThkGI1k8EA9rPARs @HEAD 
- AKfycbzAaBL6l4OFTPz @39 - fix: 캠페인 저장 시 detail 병합 — 작성가이드 유실 방지
- AKfycbxrzl11A5zi @38 - 상태 4단계 개편 + 자동화 복구 + 성능 개선
- AKfycbw55lHAEHUo @35 - VoC 파이프라인 완성`;

test('config.js에서 운영 deploymentId를 뽑는다', () => {
  const src = `export const CONFIG = {\n  GAS_ENDPOINT: 'https://script.google.com/macros/s/AKfycbxrzl11A5zi/exec',\n};`;
  assert.equal(parseEndpointId(src), 'AKfycbxrzl11A5zi');
});

test('엔드포인트가 미설정이면 null', () => {
  assert.equal(parseEndpointId(`GAS_ENDPOINT: 'PASTE_GAS_WEB_APP_URL',`), null);
});

test('clasp deployments 출력을 파싱하고 @HEAD는 버전에서 제외한다', () => {
  const d = parseDeployments(CLASP_OUT);
  assert.equal(d.length, 4);
  assert.deepEqual(d.find((x) => x.id === 'AKfycbxrzl11A5zi'), { id: 'AKfycbxrzl11A5zi', version: 38 });
  assert.equal(d.find((x) => x.id.startsWith('AKfycbyhRw')).version, null); // @HEAD
});

test('8/28 사고 재현: 운영 슬롯이 다른 슬롯보다 낮은 버전이면 stale로 잡는다', () => {
  const r = checkDeployAlignment({ endpointId: 'AKfycbxrzl11A5zi', deployments: parseDeployments(CLASP_OUT) });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'stale-endpoint');
  assert.equal(r.currentVersion, 38);
  assert.equal(r.latestVersion, 39);
  assert.match(r.fixCommand, /clasp deploy -i AKfycbxrzl11A5zi -V 39/);
});

test('운영 슬롯이 최신이면 통과', () => {
  const out = CLASP_OUT.replace('AKfycbxrzl11A5zi @38', 'AKfycbxrzl11A5zi @39');
  const r = checkDeployAlignment({ endpointId: 'AKfycbxrzl11A5zi', deployments: parseDeployments(out) });
  assert.equal(r.ok, true);
});

test('config가 목록에 없는 ID를 가리키면 unknown-deployment', () => {
  const r = checkDeployAlignment({ endpointId: 'AKfycbNOTHERE', deployments: parseDeployments(CLASP_OUT) });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'unknown-deployment');
});

test('새 버전을 만들고 배포를 안 했으면 undeployed-version', () => {
  const out = CLASP_OUT.replace('AKfycbxrzl11A5zi @38', 'AKfycbxrzl11A5zi @39');
  const r = checkDeployAlignment({
    endpointId: 'AKfycbxrzl11A5zi', deployments: parseDeployments(out), latestProjectVersion: 41,
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'undeployed-version');
  assert.match(r.fixCommand, /-V 41/);
});

test('엔드포인트 미설정은 판정 대상이 아니다', () => {
  const r = checkDeployAlignment({ endpointId: null, deployments: parseDeployments(CLASP_OUT) });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'no-endpoint');
});
