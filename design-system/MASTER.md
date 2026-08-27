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
- **golink** (`.golink`, hub.css): 어휘 ④(다른 화면으로 간다)의 **정본** — 텍스트 + 화살표 SVG(`ICON.arrowRight`), 배경·테두리 금지. 새 탭으로 나가는 이동은 전부 이것을 쓴다 — 준비 탭 배포 카드의 '열기' 3개가 `btn--primary`(채움)였던 것을 여기로 돌렸다. 채움은 그 화면의 전진 CTA 1개에만 남긴다(준비 탭은 stagebox의 '모집 시작하기'). 배치만 다를 땐 수식자로 붙인다(`예: .notice__go`는 `margin-left: auto`만 갖는다) — 화면마다 복제본을 만들지 않는다.
- **배포 카드** (`.deploy` / `.linkrow`, hub.css): 준비 탭의 배포 카드는 **좌: 신청 페이지 상시 iframe 미리보기 / 우: 4칸 2×2 그리드**(참가 신청·주차 제출·마무리 폼·썸네일·포스터) 한 장이다. 칸 높이는 `grid-auto-rows: 1fr`로 맞추고 액션은 `margin-top: auto`로 바닥에 붙여 **4칸의 하단선을 일치**시킨다. iframe은 GAS 응답이 느려 로드 전에 **높이를 먼저 잡고**(스켈레톤 오버레이) 모바일 폭 그대로 내부 스크롤시킨다 — `transform: scale` 축소 금지(검수용 미리보기라 글자가 읽힐 크기여야 한다).
- **캠페인 카드** (`.camp-card`, hub.css): 허브 홈의 캠페인 1장. 줄 순서는 **제목+액션 / 상태+진행기간 / 스탯 4 / 진행바** 고정이다.
  - 제목은 **1줄 고정 + `…`**(`white-space: nowrap`) — 카드 높이가 제목 길이에 따라 들쭉날쭉해지면 그리드가 무너진다. 잘린 전문은 `title` 속성으로 준다.
  - 카드 액션(수정·삭제)은 **어휘 ③(반복·부수) = 아이콘만** — `.btn--icon`을 그대로 쓰고 `title`+`aria-label`로 라벨을 준다. 삭제를 **색으로만** 구분하지 않는다(빨강은 hover 보조 신호일 뿐, 구분의 근거는 라벨).
  - **진행기간**(`.camp-card__period`)은 상태에 따라 지금 의미 있는 구간 **하나만** 보여준다 — 모집 단계는 `모집 ~ M.D`, 운영 단계는 `운영 M.D ~ M.D`. 모집기간과 운영기간은 다른 구간이라 한 줄에 섞지 않는다. 날짜 표기는 `M.D`(예 `8.13 ~ 8.28`)로 통일.
- **조회 조건 드롭다운** (`.sortsel` + `.select--inline`, hub.css): 어휘 ⑤(조회 조건 = 드롭다운)의 정본. 폼용 `.select`(min-height 50, 100% 폭)의 **인라인 축소판**이지 별개 컴포넌트가 아니다 — 목록 위 컨트롤이라 폭은 내용만큼, 배경은 `--color-surface`. **바(줄)를 새로 쌓지 않는다** — 역할이 같은 기존 줄(`.statbar`)에 `.statbar__act`로 얹는다. 선택값은 `localStorage`(`challenge.<화면>.<항목>`)에 기억한다.
- **완료 그룹** (`.donegroup`, hub.css): 파생 상태 `완료`인 캠페인을 **구분선(`border-top`) 아래 접이식(`<details>`)**으로 내린다. 기본 접힘, 펼침 상태는 `localStorage` 기억. 0건이면 그룹도 구분선도 **마크업 자체를 만들지 않는다**(빈 껍데기 금지). 회색 처리는 카드가 아니라 그릇(`.grid--done`)이 소유한다 — 같은 `.camp-card` 마크업을 활성/완료가 공유한다. 상태 판정은 `status.js`의 `STATUS` 상수를 경유하고 화면에서 상태 문자열을 직접 비교하지 않는다.
- **접이식 카드** (`.foldcard`, hub.css): 카드 한 장을 통째로 접는 **정본 어휘**. 운영 탭 전역 설정 · 준비 탭 캠페인 정보/업로드 사이트가 **같은 컴포넌트**를 쓴다 — 화면마다 다른 접기 방식을 만들지 않는다. `<details>` + `.foldcard__sum`(요약줄) + `.foldcard__body`. 요약줄은 `chev › · 제목(.card__title) · 부연(.foldcard__note) · 우측(.foldcard__act)` 순이고, **접힌 상태에서도 알아야 하는 것만 우측에 올린다**(건수 `.foldcard__n`, '미입력 N' 배지, 이동 링크). 요약줄 안의 링크·버튼은 클릭이 summary까지 가지 않게 `stopPropagation` — 이동하려다 접히면 안 된다. 기본 펼침 여부는 **내용이 정한다**: 읽는 정보는 접힘, 진행 상황이 보여야 하는 체크리스트는 펼침. 상태는 `localStorage`(`challenge.<화면>.<항목>Open`)에 기억한다. 카드 묶음을 접는 것(`.donegroup`)은 그릇이 카드가 아니라 목록이라 별개다.
- **라벨-값 목록** (`.kv`, hub.css): 폼에 입력한 것을 **읽기 전용으로 되비추는** 그릇(준비 탭 캠페인 정보). 항목·순서·라벨은 폼과 1:1로 맞춘다 — 다른 이름을 붙이면 어디를 고쳐야 할지 대응이 끊긴다. **빈 값을 감추지 않는다**: `.kv__miss`로 '미입력'을 찍고 개수를 요약줄 배지로 올린다(배포 전 점검이 목적이므로 빠진 것이 화면의 정보다). 좁은 화면에서는 1열로 눕는다.
- **목록 전환 필터** (`.filterseg`, hub.css): 같은 화면 안에서 **두 목록을 갈아 끼우는** 컨트롤(운영 탭 제출/미제출). 어휘 ⑤(조회 조건=드롭다운)는 값이 여럿일 때의 어휘이고, 여기는 값이 둘뿐이면서 **양쪽 건수가 동시에 보여야** 하므로 드롭다운을 쓰지 않는다(닫힌 드롭다운은 비선택 값의 건수를 감춘다). 형태를 셋과 구분한다 — 앱바 탭(`.appbar__tab`)은 **화면 이동**이라 밑줄+풀폭 바, 이건 카드 안 인셋 트랙; `.seg`(선발/탈락)는 **쓰기**라 활성색이 success/danger, 이건 조회라 활성색이 중립(`--color-surface`)이다. 전환은 다시 그리지 않고 `hidden`만 바꾼다 — 목록을 지웠다 만들면 검수·우수 지정 핸들러가 함께 사라진다.
- **카드 머리** (`.cardhead`, hub.css): 제목 좌 / 컨트롤 우 한 줄. 기능을 더할 때 **바(줄)를 새로 쌓지 않는다** — 역할이 같으면 이 줄에 얹는다(`.statbar__act`와 같은 규칙).
- **명단·정산표의 식별 단서** (`.blogid` / `.dupbadge`, hub.css): **휴대폰번호는 화면에 띄우지 않는다** — 내보내기 CSV에만 남긴다(마스킹도 하지 않는다. `010-****-1234`는 이름과 붙는 순간 사실상 개인 식별이라 '노출 안 함'을 절반만 지킨다). 화면에서 참가자를 가르는 단서는 **블로그 아이디**다(`.blogid`, 참가자당 고유 → 동명이인 구분). 표시값은 판정 정본 `normalizeBlogUrl`을 그대로 통과시킨다 — 표시용 사본을 두면 '중복' 배지와 눈에 보이는 값이 어긋난다. 중복 판정과 선발·삭제는 계속 휴대폰번호(식별키)로 하되 값은 `data-phone`에만 두고, 무엇이 겹쳤는지는 배지 라벨(`번호 중복` / `중복`)이 말한다.
- **좁은 화면 라벨 숨김** (`.btn__t` / `.brand__t`, hub.css): appbar는 **좁아도 줄을 늘리지 않는다**(홈 1줄 / 작업공간 2줄). 폭이 모자라면 줄을 쌓는 대신 ①컨트롤 치수를 줄이고 ②아이콘이 있는 버튼의 텍스트 라벨(`.btn__t`)을 숨겨 어휘 ③으로 낮추고 ③브레드크럼에서는 브랜드 텍스트(`.brand__t`)만 접어 로고 마크를 남긴다. 라벨을 숨긴 자리는 `title`+`aria-label`이 대신한다. 텍스트를 `white-space: normal`로 흘려 세로로 쪼개는 처리는 금지.
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
