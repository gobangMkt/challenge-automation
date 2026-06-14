/* 캠페인별 BI 테마 엔진 — 캠페인마다 색·디스플레이폰트가 달라지도록 변주.
   detail.theme(있으면) > 캠페인명 해시(자동) 순으로 1종 선택. 모든 프리셋은 '포스터급' 톤. */

/* 둥근 청키 한글 디스플레이 폰트 (noonnu CDN @font-face는 base.css에서 로드) */
export const DISPLAY_FONTS = {
  jalnan: `'Black Han Sans', 'Pretendard Variable', sans-serif`,
  jua: `'Jua', 'Pretendard Variable', sans-serif`,
  ssurround: `'Do Hyeon', 'Pretendard Variable', sans-serif`,
  tmoney: `'Gasoek One', 'Pretendard Variable', sans-serif`,
};

export const THEMES = [
  { id: 'cobalt', name: '코발트 네이비', heroBg: '#1B2350', heroBg2: '#232C63', primary: '#3D5AFE', pop: '#FFD60A', popInk: '#1B2350', ink: '#15172B', surface2: '#F1F3FF', display: 'jalnan' },
  { id: 'forest', name: '포레스트 라임', heroBg: '#143027', heroBg2: '#1B4032', primary: '#10B981', pop: '#D7FF4E', popInk: '#143027', ink: '#11221C', surface2: '#EAF7F0', display: 'jua' },
  { id: 'coral', name: '차콜 코랄', heroBg: '#1F2024', heroBg2: '#2A2C33', primary: '#FF5A4D', pop: '#FFD166', popInk: '#2A1A12', ink: '#1A1B1F', surface2: '#FFF0EE', display: 'ssurround' },
  { id: 'teal', name: '딥틸 선샤인', heroBg: '#0E2E33', heroBg2: '#143E45', primary: '#12B5C4', pop: '#FFE14D', popInk: '#0E2E33', ink: '#10262A', surface2: '#E8F7F9', display: 'tmoney' },
  { id: 'indigo', name: '인디고 핑크', heroBg: '#1E1B4B', heroBg2: '#2A2566', primary: '#4F46E5', pop: '#FB7185', popInk: '#FFFFFF', ink: '#19183A', surface2: '#EEF0FF', display: 'jalnan' },
  { id: 'pine', name: '파인 오렌지', heroBg: '#14241B', heroBg2: '#1C3326', primary: '#1F9D55', pop: '#FF8A3D', popInk: '#FFFFFF', ink: '#112019', surface2: '#EAF6EE', display: 'jua' },
  { id: 'wine', name: '와인 골드', heroBg: '#3A1726', heroBg2: '#4C1E32', primary: '#E0457B', pop: '#FFC24B', popInk: '#3A1726', ink: '#2A1119', surface2: '#FDEBF1', display: 'ssurround' },
  { id: 'mid', name: '미드나잇 스카이', heroBg: '#0F1B33', heroBg2: '#16264A', primary: '#2D8CFF', pop: '#5EEAD4', popInk: '#0F1B33', ink: '#101A2C', surface2: '#EAF1FB', display: 'tmoney' },
];

const hash = (s) => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };

export function pickTheme(name, themeId) {
  if (themeId) { const t = THEMES.find((x) => x.id === themeId); if (t) return t; }
  return THEMES[hash(name) % THEMES.length];
}

/* 테마 → CSS 변수 문자열 (랜딩 루트에 주입) */
export function themeVars(t) {
  return [
    `--lp-hero-bg:${t.heroBg}`, `--lp-hero-bg2:${t.heroBg2}`,
    `--lp-primary:${t.primary}`, `--lp-pop:${t.pop}`, `--lp-pop-ink:${t.popInk}`,
    `--lp-ink:${t.ink}`, `--lp-surface2:${t.surface2}`,
    `--lp-display:${DISPLAY_FONTS[t.display] || DISPLAY_FONTS.jalnan}`,
  ].join(';');
}
