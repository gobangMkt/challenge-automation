// 텔레그램 메시지 포맷 — 순수 함수(사이드이펙트 없음). 전송은 telegram.mjs가 담당.

// checks 객체/문자열을 사람이 읽기 좋은 한 줄들로 변환
function formatChecks(checks) {
  if (checks == null) return '(없음)';
  if (typeof checks === 'string') return checks;
  return Object.entries(checks)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
}

// VoC 개선안 승인 요청 메시지
export function formatVocApproval({ voc, plan }) {
  const id = voc?.id ?? '(no-id)';
  const message = voc?.message ?? '';
  return [
    '🔔 VoC 개선안 승인 요청',
    `ID: ${id}`,
    '',
    '📨 원문',
    message,
    '',
    '🛠 개선안',
    plan ?? '',
    '',
    "승인하려면 '승인', 반려하려면 '반려'로 답장하세요.",
  ].join('\n');
}

// 작업 완료 보고 메시지
export function formatDone({ voc, summary, checks }) {
  const id = voc?.id ?? '(no-id)';
  return [
    '✅ 작업 완료',
    `ID: ${id}`,
    '',
    '📝 변경 요약',
    summary ?? '',
    '',
    '🔍 검증 결과',
    formatChecks(checks),
  ].join('\n');
}
