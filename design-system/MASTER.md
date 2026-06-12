# 디자인 시스템 — 블로그 챌린지 앱 (테마 A: 갓생 코랄)

> 전역 단일 진실 소스. 모든 화면/컴포넌트가 상속. 페이지별 예외는 `design-system/pages/<name>.md`에 둠.
> 확정 2026-06-12. 톤: 친근·동기부여("갓생"), AI 보라 그라데이션 금지.

## 1. 컬러 토큰 (시맨틱)
| 토큰 | HEX | 용도 |
|---|---|---|
| `--color-primary` | #E8503F | CTA·강조·링크 (코랄) |
| `--color-primary-hover` | #D43F2E | 버튼 hover/active |
| `--color-primary-soft` | #FDEAE6 | 코랄 배경(태그·하이라이트) |
| `--color-accent` | #FFC83D | 배지·별·진행 강조 (선샤인 옐로) |
| `--color-accent-soft` | #FFF3D4 | 옐로 배경 |
| `--color-bg` | #FFF8F3 | 페이지 배경 (웜 오프화이트) |
| `--color-surface` | #FFFFFF | 카드·시트 |
| `--color-ink` | #2A2320 | 본문 텍스트 |
| `--color-ink-muted` | #6B6259 | 보조 텍스트 (대비 ≥4.5:1 확인) |
| `--color-border` | #ECE3DA | 구분선·테두리 |
| `--color-success` | #2BB673 | 제출완료·성공 |
| `--color-warning` | #E8A33D | 마감임박 |
| `--color-danger` | #D64545 | 미제출·오류·파괴 액션 |

규칙: 컴포넌트에 raw hex 금지 → 토큰만. 색만으로 의미 전달 금지(아이콘·텍스트 병행). 다크모드는 v2(현재 라이트 단일).

## 2. 타이포그래피
- **Display**: Gmarket Sans Bold (둥글·친근). 히어로·섹션 제목·큰 숫자.
- **Body/UI**: Pretendard (400 본문 / 500 라벨 / 600 강조 / 700 제목).
- 로딩: `font-display: swap`. CDN — Pretendard(jsdelivr), Gmarket Sans 웹폰트.
- 스케일(px): 12 · 14 · 16(base) · 18 · 24 · 32 · 44. line-height 본문 1.6.
- 숫자/표/정산/타이머는 **tabular-nums**(레이아웃 흔들림 방지).

## 3. 간격 · 레이아웃
- 4/8 간격 시스템. 섹션 리듬 16/24/32/48.
- 컨테이너 max-width: 참가자 480~640(모바일 우선), 운영자 대시보드 1200.
- 모바일 퍼스트. breakpoints 375/768/1024/1440. 가로 스크롤 금지, `min-h-dvh`.
- 본문 16px 이상(iOS 오토줌 방지). 줄길이 모바일 35~60자.

## 4. 형태 · 효과
- radius: sm 8 / md 12 / lg 16 / pill 999. (과한 라운딩·랜덤 그림자 금지)
- elevation 일관 스케일: card `0 1px 2px rgba(42,35,32,.06)`, popover `0 8px 24px rgba(42,35,32,.12)`.
- border 1px `--color-border`.

## 5. 컴포넌트 규칙
- **버튼**: Primary=코랄 채움(흰 텍스트, 대비 OK), Secondary=코랄 외곽선, Ghost=텍스트. 1화면 1 Primary CTA. 비동기 중 disabled+스피너. 터치 ≥44px.
- **배지/태그**: 회차·우수활동자=옐로(accent-soft 배경+ink), 상태=시맨틱색+아이콘.
- **진행바**: 트랙 `--color-border`, 채움 코랄, 완주 라벨 tabular-nums.
- **폼**: 가시 라벨(placeholder-only 금지), 에러는 필드 하단+`role=alert`, blur 시 검증, `type=tel`(휴대폰)/적절 inputmode, 필수 표시.
- **테이블(운영자)**: 헤더 고정, 정렬 `aria-sort`, 셀 tabular-nums, 미제출=danger 점+텍스트, 매트릭스 셀 ≥44px 탭영역.
- **토스트**: 3~5s 자동소멸, focus 안 뺏음, `aria-live=polite`.
- **모달**: scrim 40~60% black, ESC/닫기, 트리거에서 확장 애니메이션.

## 6. 아이콘
- **이모지 아이콘 금지** → SVG 아이콘 세트 1종(Lucide 권장). stroke 1.5~2 일관. 아이콘 사이즈 토큰(sm16/md20/lg24). 아이콘only 버튼엔 aria-label.
- 예외: 마케팅 카피의 ★(별)·🔥는 장식 텍스트로만 허용, 기능 아이콘으로는 금지.

## 7. 애니메이션
- 150~300ms, transform/opacity만. ease-out 진입/ease-in 퇴장. 1화면 1~2개만.
- 리스트 stagger 30~50ms. `prefers-reduced-motion` 존중.

## 8. 접근성 (필수)
- 대비 본문 4.5:1 / 큰글 3:1. 포커스 링 유지(2~4px). 키보드 탭순=시각순.
- 모든 의미 이미지 alt, 폼 라벨+에러 명확, 색 외 단서 병행.

## 9. 안티패턴 (금지)
- AI식 보라 그라데이션 / 무분별 라운딩 / 이모지 기능아이콘 / placeholder-only 라벨 / 색만으로 의미 / 상단에만 에러 / 0ms 즉시 전환 / raw hex.

## 10. 출처
- 테마 선택: 사용자 컨펌(3안 중 A). 포스터(핑크/코랄/옐로/별)에서 톤 계승하되 대비·시맨틱화로 재설계.
- 디자인 원칙: ui-ux-pro-max 스킬 Quick Reference(§1~10) 적용.
