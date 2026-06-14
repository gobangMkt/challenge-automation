# 디자인 시스템 — 블로그 챌린지 앱 (테마 C: 모던 프리미엄)

> 전역 단일 진실 소스. 모든 화면/컴포넌트가 상속. 페이지별 예외는 `design-system/pages/<name>.md`.
> 리뉴얼 확정 2026-06-14 (테마 A 갓생코랄 → B 에디토리얼 → **C 모던 프리미엄**). 피드백: 웜톤(코랄/크림/골드)+한글 세리프가 올드함 → 폐기.
> 톤: 모노크롬 잉크 + 일렉트릭 블루 1액센트 + Pretendard 산세리프 + 모노 마이크로 라벨. 토스/리니어식 클린·프리미엄. Flat Design.

## 1. 컬러 토큰 (시맨틱) — 모노크롬 + 블루 1액센트
| 토큰 | HEX | 용도 |
|---|---|---|
| `--color-primary` | #2C5BFF | CTA·링크·액티브·포커스 (일렉트릭 블루, **유일 액센트**) |
| `--color-primary-hover` | #1E45E0 | hover/active |
| `--color-primary-soft` | #ECF0FF | 블루 배경(태그·배지·포커스링·아이콘칩) |
| `--color-bg` | #FBFBFC | 페이지 배경 (쿨 오프화이트) |
| `--color-surface` | #FFFFFF | 카드·시트 |
| `--color-surface-2` | #F4F5F7 | 보조 면(테이블헤더·hover) |
| `--color-ink` | #0A0A0B | 본문·헤드라인 (near-black) |
| `--color-ink-muted` | #585C64 | 보조 텍스트 (대비 ≥4.5:1) |
| `--color-ink-faint` | #9AA0AA | 캡션·플레이스홀더 |
| `--color-border` | #ECEDEF | 헤어라인 |
| `--color-border-strong` | #DDDFE3 | 인풋·버튼 보더 |
| `--color-success` | #12B76A | 선발·완료 |
| `--color-warning` | #F79009 | 운영·마감임박 |
| `--color-danger` | #F04438 | 미제출·오류·파괴 |

규칙: raw hex 금지 → 토큰만. **웜톤(코랄/골드/크림) 사용 금지.** 블루는 액센트 1색만(남발 금지, CTA·링크·액티브·포커스). 큰 숫자·금액은 잉크(near-black) 모노. 다크모드 v2.

## 2. 타이포그래피 (산세리프 + 모노 시그니처)
- **Display/Body**: `Pretendard` 단일 패밀리. 헤드라인 800 + 강한 음수 자간(-0.025~-0.035em), 본문 400, 라벨 500~600. **세리프 금지**.
- **모노 시그니처**: `JetBrains Mono`(400/500/600) — 이브로우·배지·테이블헤더·스탯 라벨·큰 숫자/금액. 모던 프로덕트 텍스처.
- 로딩 `font-display: swap`. CDN — Pretendard(jsdelivr), JetBrains Mono(Google).
- 스케일(px): 11(모노라벨) · 13 · 14 · 16(base) · 18 · 22 · clamp 히어로 32→52. line-height 본문 1.6, 헤드라인 1.12.
- 마이크로 라벨 = 모노 대문자 letter-spacing .02~.06em. 본문/헤드라인은 음수 자간으로 타이트하게.
- 숫자/표/금액 tabular-nums.

## 3. 간격 · 레이아웃
- 4/8 간격. 섹션 리듬 16/24/44. 넉넉한 화이트스페이스.
- 컨테이너: 참가자 600(모바일 우선), 운영자 1400.
- 모바일 퍼스트. breakpoints 375/768/1024/1440. 가로 스크롤 금지, `min-h-dvh`.
- 본문 16px↑. 줄길이 본문 ≤46ch.

## 4. 형태 · 효과 (Flat)
- radius: sm 8 / md 10 / lg 14 / pill 999.
- **그림자 최소** — 헤어라인 보더 위주. card `0 1px 2px rgba(10,10,11,.04)`, popover/overlay `0 16px 40px rgba(10,10,11,.12)`. CTA hover만 블루 글로우.
- 그라데이션 금지(스티키 CTA 페이드 제외). 텍스처·도트 금지.

## 5. 컴포넌트 규칙
- **버튼**: Primary=블루 채움(흰 텍스트). Secondary=화이트+보더. Ghost=텍스트. press=scale .985. 1화면 1 Primary CTA. 비동기 disabled+스피너. 터치 ≥44px.
- **배지/태그**: 모노 대문자, soft 배경 또는 헤어라인. 상태=시맨틱 soft.
- **히어로**: 모노 이브로우(블루 pill) → Pretendard 800 헤드라인(잉크, 타이트) → 서브카피. 별·이모지·세리프 금지.
- **로고 마크**: ★ 글리프 폐기 → 블루 라운드 스퀘어 마크(inset 화이트).
- **폼**: 가시 라벨, 에러 필드 하단+`role=alert`, blur 검증, `type=tel`/inputmode, 필수 표시. 포커스=블루 보더+4px soft 링.
- **테이블**: 모노 대문자 헤더·고정, 정렬 `aria-sort`, 셀 tabular-nums, 미제출=danger 점+텍스트.
- **통계 숫자**: 모노 600, near-black.
- **토스트**: 3~5s, focus 안 뺏음, `aria-live=polite`.
- **모달**: scrim 40~60% black, ESC/닫기.

## 6. 아이콘
- **이모지 아이콘 금지**(⚡·🎉·★ 포함) → SVG 세트 1종(Lucide, stroke 2). 사이즈 토큰 sm16/md20/lg24. 아이콘only 버튼 aria-label.

## 7. 애니메이션
- 150~300ms, transform/opacity만. ease-out 진입. 1화면 1~2개. 리스트 stagger 30~50ms(reveal-1~4). `prefers-reduced-motion` 존중.

## 8. 접근성 (필수)
- 대비 본문 4.5:1 / 큰글 3:1. 블루 #2C5BFF on 흰색 ≈ 5.0:1. 포커스 링 유지(2px solid 블루).
- 의미 이미지 alt, 폼 라벨+에러 명확, 색 외 단서 병행.

## 9. 안티패턴 (금지)
- 웜톤(코랄/골드/크림) / 한글 세리프 / AI 보라 그라데이션 / 이모지·별 아이콘 / 무분별 라운딩 / placeholder-only 라벨 / 색만으로 의미 / 블루 남발 / raw hex / 텍스처·도트 배경.

## 10. 출처
- 사용자 피드백: 테마 B(웜+세리프) "촌스럽다" → 모던 프리미엄 재구성.
- 스킬 근거: ui-ux-pro-max `--design-system` "Flat Design" + "Monochrome + blue accent"(#18181B/#2563EB→ 블루 CTA로 재배치). frontend-design 원칙(비-generic, 단일 시그니처, 절제). Quick Reference §1~10.
