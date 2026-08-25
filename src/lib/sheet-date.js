// 시트 셀 값 정규화 — Date 객체를 스크립트 타임존 기준 텍스트로 바꾼다.
// WHY: raw Date를 JSON에 실으면 UTC ISO로 직렬화돼 KST 자정이 전날 15:00Z가 된다.
// 소비자(프론트 toDateInput·fmtMD·dday, GAS schedule 로직)는 모두 'YYYY-MM-DD' 텍스트를
// 앞에서 잘라 쓰기 때문에 날짜가 하루 밀린다.

const p2 = (n) => String(n).padStart(2, '0');

export function sheetDateToText(v) {
  if (!(v instanceof Date)) return v;
  const t = v.getTime();
  if (Number.isNaN(t)) return '';
  const ymd = `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}`;
  const hasTime = v.getHours() || v.getMinutes() || v.getSeconds() || v.getMilliseconds();
  return hasTime ? `${ymd} ${p2(v.getHours())}:${p2(v.getMinutes())}:${p2(v.getSeconds())}` : ymd;
}

// 'YYYY-MM-DD ...' 텍스트/Date에서 날짜 부분만 뽑는다(시각 무시).
export function dateOnlyText(v) {
  const s = String(sheetDateToText(v) ?? '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : s;
}
