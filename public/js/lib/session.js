/* 운영 세션 판정 — GAS 응답 하나를 두고 "세션이 끊겼나 / 서버가 안 되나 / 토큰이 틀렸나"를 가른다.
   WHY: 호출부 20여 곳이 각자 `r.ok ? r.rows : []`로 실패를 삼켜, 인증이 끊겨도 데이터가 0건인
   정상 화면처럼 보였다. 판정을 여기 한 곳에 모아 화면 코드가 다시 제멋대로 해석하지 못하게 한다. */

const GATE_NET = '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const GATE_BAD_TOKEN = '토큰이 올바르지 않습니다.';

// 이미 로그인된(저장 토큰 보유) 상태에서만 forbidden을 '만료'로 본다.
// 게이트에서 막 입력한 값이 틀린 것은 만료가 아니라 입력 실패다.
export function isAuthExpired(res, hasStoredToken) {
  if (!res || !hasStoredToken) return false;
  return res.ok === false && res.error === 'forbidden';
}

export function gateErrorMessage(res) {
  if (!res || res.netError) return GATE_NET;
  if (res.error && res.error !== 'forbidden') return `로그인 실패: ${res.error}`;
  return GATE_BAD_TOKEN;
}
