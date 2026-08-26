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
| `--color-success` | #12B76A | 선발·완료 (면·아이콘·토글) |
| `--color-success-soft` | #E6F7EF | 완료 배지·칩 배경 |
| `--color-success-on` | #0B7A45 | success-soft/흰 배경 **위 텍스트** (4.87 / 5.41:1) |
| `--color-warning` | #F79009 | 운영·마감임박 (면·아이콘) |
| `--color-warning-soft` | #FEF0DC | 운영중 배지·칩 배경 |
| `--color-warning-on` | #B54708 | warning-soft/흰 배경 **위 텍스트** (4.84 / 5.43:1) |
| `--color-danger` | #F04438 | 미제출·오류·파괴 (면·아이콘) |
| `--color-danger-soft` | #FEECEB | 위험 배지·칩 배경 |
| `--color-danger-on` | #D3261D | danger-soft/흰 배경 **위 텍스트** (4.53 / 5.17:1) |
| `--color-on-primary` | #FFFFFF | 블루 채움 위 텍스트 (5.19:1) |

**시맨틱 3단 규칙**: 모든 시맨틱 색은 `base`(면·아이콘·토글 등 색 자체가 요소일 때) / `-soft`(배경) / `-on`(soft·흰 배경 위 텍스트) 3종으로 쓴다. **base 색을 텍스트에 직접 쓰지 않는다** — `#12B76A`·`#F79009`는 흰 배경에서 4.5:1 미달이다. 텍스트는 항상 `-on`.

규칙: raw hex 금지 → 토큰만. **웜톤(코랄/골드/크림) 사용 금지** — 이 금지는 장식·브랜드 용도에 대한 것이고, `--color-warning*` 시맨틱 3종(운영·마감임박)은 예외로 허용된다. 그 외 노랑·크림 계열(#FFF4D6·#FFD56B·#FFFCF2 등)을 새로 들이지 않는다. 블루는 액센트 1색만(남발 금지, CTA·링크·액티브·포커스). 큰 숫자·금액은 잉크(near-black) 모노. 다크모드 v2.

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
- **챌린지 상태 배지** (`.badge--ready` / `--recruiting` / `--running` / `--done`, hub.css): 형태는 4상태 **동일** — `.badge` 기본형(height 24px, radius-sm) + soft 배경 + 헤어라인. **채움(solid) 금지** — 채움은 primary CTA의 어휘이고, 상태는 읽는 것이지 누르는 것이 아니다. 색은 상태 의미를 따르고(준비=중립, 모집중=primary, 운영중=warning, 완료=success), 라벨 텍스트를 항상 동반한다(색만으로 의미 금지).

  | 상태 | 클래스 | 배경 / 텍스트 |
  |---|---|---|
  | 준비 | `.badge--ready` | `--color-surface-2` / `--color-ink-muted` + `--color-border` |
  | 모집중 | `.badge--recruiting` | `--color-primary-soft` / `--color-primary-hover` |
  | 운영중 | `.badge--running` | `--color-warning-soft` / `--color-warning-on` |
  | 완료 | `.badge--done` | `--color-success-soft` / `--color-success-on` |

  헤어라인은 `color-mix(in srgb, <시맨틱 base> 24%, transparent)`로 통일. 상태명은 **도메인 상태**로 짓는다(`--warning`이 아니라 `--running`) — 상태→색 매핑은 디자인 결정이므로 CSS가 소유하고 JS는 상태만 넘긴다.
  색 자체가 목적인 범용 배지는 기존 `.badge--primary` / `--success` / `--danger`(base.css)를 그대로 쓴다.
- **회차 상태** (`.s-wait` / `.s-open` / `.s-done`, hub.css): 배지(`.badge.s-*`)와 회차 칩(`.weekchip.s-* .weekchip__st`)이 **한 규칙을 공유**한다 — 같은 '대기'가 한쪽은 블루, 한쪽은 오렌지이던 분기를 폐기. 강도 순서는 **오픈(진행 중) > 종료(끝남) > 대기(아무 일 없음)**. 대기는 배경 없는 `--color-ink-faint`가 상한이다 — 아무 일도 일어나지 않은 상태를 강조하지 않는다.

  | 회차 상태 | 클래스 | 배경 / 텍스트 |
  |---|---|---|
  | 대기 | `.s-wait` | 없음 / `--color-ink-faint` |
  | 오픈 | `.s-open` | `--color-success-soft` / `--color-success-on` |
  | 종료(마감) | `.s-done` | `--color-surface-2` / `--color-ink-muted` |
- **stagebox** (`.stagebox`, hub.css): 캠페인 **단계 전이** 전용 박스. 좌측 정보(제목 + 상태 배지 + 설명) / 우측 액션. 준비 탭의 '모집 시작하기'와 운영 탭의 종료·재개가 **같은 컴포넌트**다(구 `.endbox` 일반화 — 종료 전용 박스는 폐기). 규칙:
  - 액션은 **전진 1개(주) + 되돌리기 1개(보조)를 넘지 않는다.** 전진=`btn--primary`(파괴적이면 `btn--danger`), 되돌리기=`btn--secondary`. 라벨은 상태 서술이 아니라 **결과**를 말한다('모집중으로 변경' ✗ → '모집 시작하기' ✓).
  - 모든 전이는 **confirmModal 경유**(비파괴 전이는 `danger:false` → `modal__icon--primary`). 허브의 비가역 행위는 예외 없이 확인창을 통과한다.
  - 노출할 전이는 `status.js`의 `canTransition`이 정한다. **appbar에 두지 않는다** — appbar 우측은 전역 유틸 영역이라 계층이 다르고, 거기 두면 4탭 어디서나 눌려 맥락이 사라진다.
- **notice** (`.notice`, hub.css): 화면 상단 **안내 배너**. 잠금·차단이 아니라 상태 안내다 — 배너를 띄운 탭도 전부 정상 조작할 수 있어야 한다(라우트 가드·disabled·lock 아이콘 금지). 중립 톤(`--color-surface-2` + 헤어라인 + `--color-ink-muted`)으로 두고 시맨틱 색으로 겁주지 않는다. 우측 이동 링크는 **어휘 ④(다른 화면으로 간다)** = 텍스트 + 화살표 SVG, **테두리 금지**이며 갈 곳이 하나로 정해질 때만 붙인다(없으면 문구만). 문구는 화면에서 새로 쓰지 말고 도메인 모듈이 단일 소스 — 준비 단계 안내는 `status.js`의 `tabNotice`, 모집마감 미입력 안내는 `statusui.js`의 `recruitEndNotice`. 마크업은 `admin.js`의 `noticeBox()` 한 곳에서만 만든다(안내가 늘어도 새 컴포넌트를 만들지 않는다).
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
