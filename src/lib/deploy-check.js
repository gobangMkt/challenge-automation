/* 배포 정렬 판정 — 프론트가 실제로 호출하는 GAS 배포가 최신 버전인지 대조한다.
   WHY: 2026-08-28 메모리에 적힌 옛 deploymentId를 믿고 배포해, fix가 프론트가 호출하지 않는
   슬롯에 붙었다. 실운영은 6일간 옛 버전을 서빙했고 유실 버그가 계속 재현됐다.
   URL 눈대중 대조를 사람에게 맡기지 않기 위해 판정을 여기 고정한다. */

export function parseEndpointId(configSource) {
  const m = String(configSource || '').match(/macros\/s\/([A-Za-z0-9_-]+)\/exec/);
  return m ? m[1] : null;
}

// `- <id> @<version> - <설명>` 형식. @HEAD는 개발용이라 버전 없음(null)으로 둔다.
export function parseDeployments(claspOutput) {
  const out = [];
  for (const line of String(claspOutput || '').split(/\r?\n/)) {
    const m = line.match(/^-\s+([A-Za-z0-9_-]+)\s+@(\d+|HEAD)/);
    if (m) out.push({ id: m[1], version: m[2] === 'HEAD' ? null : Number(m[2]) });
  }
  return out;
}

const fix = (id, v) => `npx clasp deploy -i ${id} -V ${v} -d "운영 URL 슬롯을 @${v}로 정렬"`;

export function checkDeployAlignment({ endpointId, deployments, latestProjectVersion }) {
  if (!endpointId) {
    return { ok: false, code: 'no-endpoint', message: 'config.js의 GAS_ENDPOINT가 설정되지 않았다.' };
  }
  const mine = (deployments || []).find((d) => d.id === endpointId);
  if (!mine) {
    return {
      ok: false,
      code: 'unknown-deployment',
      message: `config.js가 가리키는 배포(${endpointId})가 이 스크립트 프로젝트의 배포 목록에 없다.`
        + ' 다른 프로젝트를 가리키거나 삭제된 배포다.',
    };
  }
  // 다른 슬롯에 더 높은 버전이 붙어 있으면, 그쪽에 배포하고 운영은 방치된 상태다(8/28 사고).
  const versions = (deployments || []).map((d) => d.version).filter((v) => typeof v === 'number');
  const latestDeployed = versions.length ? Math.max(...versions) : null;
  if (latestDeployed != null && mine.version != null && mine.version < latestDeployed) {
    return {
      ok: false,
      code: 'stale-endpoint',
      currentVersion: mine.version,
      latestVersion: latestDeployed,
      message: `운영 URL은 @${mine.version}인데 @${latestDeployed}가 다른 슬롯에 배포돼 있다.`
        + ' 프론트가 호출하지 않는 곳에 배포된 상태다.',
      fixCommand: fix(endpointId, latestDeployed),
    };
  }
  if (typeof latestProjectVersion === 'number' && mine.version != null && mine.version < latestProjectVersion) {
    return {
      ok: false,
      code: 'undeployed-version',
      currentVersion: mine.version,
      latestVersion: latestProjectVersion,
      message: `버전 @${latestProjectVersion}이 만들어졌지만 운영 URL은 아직 @${mine.version}이다.`,
      fixCommand: fix(endpointId, latestProjectVersion),
    };
  }
  return { ok: true, code: 'aligned', currentVersion: mine.version, latestVersion: latestDeployed };
}
