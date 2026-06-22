# VoC → 에이전트 자동 개선 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VoC를 구글시트에 수집하고, Claude Code 세션이 voc-router→PO→하위 에이전트를 구동해 PO 사인오프까지 자동 개선하는 파이프라인 구축.

**Architecture:** 순수 로직은 `public/js/lib/voc.js`(node --test), GAS는 미러+어댑터(`src/gas/Voc.gs`), 프론트 피드백 버튼은 `public/js`. 에이전트는 `.claude/agents/*.md` 정의(개선=글로벌, PO+하위=프로젝트). 텔레그램은 세션 구동 헬퍼(`scripts/telegram.mjs`).

**Tech Stack:** 바닐라 JS(ES모듈), Google Apps Script, Google Sheets, node --test, Telegram Bot API, Claude Code 서브에이전트.

## Global Constraints
- 들여쓰기 2칸, 세미콜론, 싱글/백틱. 주석 최소(WHY만). 한국어.
- 컬러/타이포는 `design-system/MASTER.md` 토큰만 (raw hex 금지).
- 순수 로직만 `public/js/lib/`에서 테스트, 사이드이펙트는 GAS 어댑터에 격리.
- 시크릿(텔레그램 토큰 포함)은 git·시트·코드에 값 금지. 로컬 untracked 파일/Script Properties만.
- 식별키=휴대폰번호. 안티클리셰(보라 그라데이션·과한 라운딩·border-left 도배) 금지.

---

### Task 1: VoC 순수 로직 (`public/js/lib/voc.js`)

**Files:**
- Create: `public/js/lib/voc.js`
- Test: `tests/voc.test.js`

**Interfaces:**
- Produces: `buildVocRecord({project, message, phone?, channel?}, now)` → `{id, ts, project, channel, phone, message, status:'new', assignee:'', resolution:'', commit:''}`; `validateVoc(input)` → `{ok, errors}`; `dedupKey(rec)` → `string`.

- [ ] **Step 1: 실패 테스트 작성** — `tests/voc.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVocRecord, validateVoc, dedupKey } from '../public/js/lib/voc.js';

test('VoC 레코드를 생성한다', () => {
  const rec = buildVocRecord({ project: 'blog-challenge', message: '버튼이 안 눌려요' }, 1750000000000);
  assert.equal(rec.project, 'blog-challenge');
  assert.equal(rec.status, 'new');
  assert.equal(rec.message, '버튼이 안 눌려요');
  assert.ok(rec.id && rec.ts);
});

test('빈 메시지는 거부한다', () => {
  assert.equal(validateVoc({ project: 'x', message: '' }).ok, false);
  assert.equal(validateVoc({ project: 'x', message: '정상' }).ok, true);
});

test('같은 프로젝트+메시지는 같은 dedup 키', () => {
  const a = buildVocRecord({ project: 'p', message: '동일' }, 1);
  const b = buildVocRecord({ project: 'p', message: '동일' }, 2);
  assert.equal(dedupKey(a), dedupKey(b));
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test`. Expected: FAIL (voc.js 없음).

- [ ] **Step 3: 구현** — `public/js/lib/voc.js`

```js
export function validateVoc(input) {
  input = input || {};
  const errors = {};
  if (!input.project || !String(input.project).trim()) errors.project = 'project 필요';
  if (!input.message || !String(input.message).trim()) errors.message = '내용을 입력하세요.';
  return { ok: Object.keys(errors).length === 0, errors };
}

export function dedupKey(rec) {
  return `${rec.project}::${String(rec.message).trim().toLowerCase()}`;
}

export function buildVocRecord(input, now) {
  const ts = new Date(now).toISOString();
  const id = `voc_${now}_${Math.abs(hash_(dedupKey({ project: input.project, message: input.message })))}`;
  return {
    id, ts,
    project: input.project,
    channel: input.channel || 'app',
    phone: input.phone || '',
    message: String(input.message).trim(),
    status: 'new', assignee: '', resolution: '', commit: '',
  };
}

function hash_(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test`. Expected: PASS.
- [ ] **Step 5: 커밋** — `git add public/js/lib/voc.js tests/voc.test.js && git commit -m "feat: VoC 순수 로직(buildVocRecord/validateVoc/dedupKey)"`

---

### Task 2: GAS VoC 어댑터 (`src/gas/Voc.gs`)

**Files:**
- Create: `src/gas/Voc.gs`
- Modify: `src/gas/Code.gs` (doPost/doGet action 라우팅에 `submitVoc`/`getVoc` 추가)

**Interfaces:**
- Consumes: Task1의 로직을 GAS 인라인 미러(ES import 불가).
- Produces: GAS action `submitVoc({project, message, phone?})` → `{ok, id}`; `getVoc({status?})` → `{ok, items:[...]}`. 시트 `VoC` 헤더 `[id, ts, project, channel, phone, message, status, assignee, resolution, commit]`.

- [ ] **Step 1: `Voc.gs` 작성** — `validateVoc_`/`dedupKey_`/`buildVocRecord_` 미러 + `submitVoc`/`getVoc`(getSheet_/rowsAsObjects_ 재사용, 신규 시 헤더 생성, dedup 시 기존 id 반환).
- [ ] **Step 2: `Code.gs` 라우팅** — doPost action 스위치에 `submitVoc`, doGet에 `getVoc` 연결 (기존 패턴 모방).
- [ ] **Step 3: 수동 검증** — clasp/스크립트 에디터에서 `getVoc()` 실행 → `VoC` 탭 자동 생성 확인. (GAS는 단위테스트 비대상, 어댑터 얇게.)
- [ ] **Step 4: 커밋** — `git add src/gas/Voc.gs src/gas/Code.gs && git commit -m "feat: GAS submitVoc/getVoc + VoC 시트탭"`

---

### Task 3: 앱 피드백 버튼 (프론트)

**Files:**
- Modify: `public/index.html` (피드백 모달 마크업), `public/js/landing.js` (버튼·제출 핸들러), `public/js/api.js` (`submitVoc` fetch)
- 참조: `public/css/` (MASTER 토큰)

**Interfaces:**
- Consumes: GAS `submitVoc` (Task2).
- Produces: 랜딩 우하단 플로팅 '피드백' 버튼 → 모달(내용 textarea + 선택 휴대폰) → 제출 → 토스트.

- [ ] **Step 1: `api.js`에 `submitVoc(payload)`** — 기존 fetch 패턴 모방, `CONFIG.GAS_ENDPOINT` POST.
- [ ] **Step 2: `index.html` 모달 + `landing.js` 버튼/핸들러** — MASTER 토큰만, 안티클리셰 금지.
- [ ] **Step 3: Playwright 검증** — http://localhost:3060 에서 버튼 렌더·클릭·모달 열림·제출(네트워크 호출) 확인 (메모리 회귀규칙).
- [ ] **Step 4: 커밋** — `git add public/index.html public/js/landing.js public/js/api.js && git commit -m "feat: 앱 피드백 버튼→VoC 적재"`

---

### Task 4: 텔레그램 헬퍼 (`scripts/telegram.mjs`)

**Files:**
- Create: `scripts/telegram.mjs`, `scripts/lib/telegram-format.js`
- Test: `tests/telegram-format.test.js`
- Create(예시): `scripts/.telegram.example.json` (값 없음. 실제는 `~/.claude/.telegram`, untracked)

**Interfaces:**
- Produces: `formatVocApproval({voc, plan})` → string; `formatDone({voc, summary, checks})` → string (순수, 테스트). `telegram.mjs notify <text>` / `telegram.mjs wait-approval` (getUpdates 폴링, '승인'/'반려' 텍스트 감지).

- [ ] **Step 1: 실패 테스트** — `formatVocApproval`이 VoC 원문+개선안 요약 문자열 포함하는지 assert.
- [ ] **Step 2: 실패 확인** — `npm test`.
- [ ] **Step 3: `telegram-format.js` 구현** + `telegram.mjs`(토큰을 `~/.claude/.telegram`에서 read, fetch Bot API; 없으면 명확한 안내 출력).
- [ ] **Step 4: 통과 확인** — `npm test`.
- [ ] **Step 5: 커밋** — `git add scripts/ tests/telegram-format.test.js && git commit -m "feat: 텔레그램 알림/승인 헬퍼"`

---

### Task 5: voc-router 에이전트 (글로벌)

**Files:**
- Create: `~/.claude/agents/voc-router.md` (글로벌)
- Create: `~/.claude/agents/voc-router.registry.md` (프로젝트↔PO 매핑: `blog-challenge → po-blog-challenge`)

**Interfaces:** 입력=VoC(new) 목록(시트/CSV/사용자 붙여넣기). 출력=구조화 항목 + 담당 PO. 프로젝트 무지, 레지스트리만 참조.

- [ ] **Step 1: `voc-router.md` 작성** — frontmatter(name, description: VoC 수집·분류·배정 시 사용), 본문: read 방법(GAS getVoc)·중복제거(dedupKey)·심각도 분류·레지스트리로 PO 배정·출력 포맷 규정.
- [ ] **Step 2: 레지스트리 작성** — blog-challenge 매핑 1줄.
- [ ] **Step 3: 로드 확인** — `/agents`(또는 Agent 타입 목록)에 voc-router 노출 확인.
- [ ] **Step 4: 커밋** — 글로벌(`~/.claude`)은 별도 관리. blog-challenge repo에는 커밋 안 함. (전역 dotfiles 위치 안내만.)

---

### Task 6: po-blog-challenge 에이전트 (프로젝트)

**Files:**
- Create: `블로그-챌린지/.claude/agents/po-blog-challenge.md`

**Interfaces:** 입력=배정 VoC. 출력=PRD·납품조건 + dev/design/qa 작업지시 + 사인오프. 코어가치·`docs/spec.md`·`design-system/MASTER.md`(BI) 품음.

- [ ] **Step 1: 작성** — frontmatter + 본문: 불변 기준(핵심가치/스펙/BI) 명시, 절차(파악→브레인스토밍→PRD→업무분배→검수→사인오프), DoD(=사인오프, 근거로 npm test 그린·해당 qa PASS·UI변경시 Playwright 검증 요구), "통과까지 재지시" 책임, 안티클리셰·MASTER 토큰 강제.
- [ ] **Step 2: 커밋** — `git add .claude/agents/po-blog-challenge.md && git commit -m "feat: PO 에이전트(blog-challenge)"`

---

### Task 7: 하위 에이전트 3종 (프로젝트)

**Files:**
- Create: `블로그-챌린지/.claude/agents/dev-blog-challenge.md`, `design-blog-challenge.md`, `qa-blog-challenge.md`

**Interfaces:** 입력=PO 작업지시. 출력=산출물+검증결과. dev=바닐라JS/GAS/시트 TDD, design=기획/디자인 MASTER 토큰, qa=npm test+Playwright+글로벌 qa-* 위임.

- [ ] **Step 1: dev 작성** — TDD(RED→GREEN→REFACTOR), src/lib 순수로직+GAS 미러 규칙, 컨벤션.
- [ ] **Step 2: design 작성** — MASTER 토큰만, 안티클리셰 금지, 디자인 게이트(옵션 2~3 제시) 인지.
- [ ] **Step 3: qa 작성** — npm test, Playwright 렌더·클릭(회귀규칙), 글로벌 qa-code/e2e/perf/security 위임 기준.
- [ ] **Step 4: 커밋** — `git add .claude/agents/dev-blog-challenge.md .claude/agents/design-blog-challenge.md .claude/agents/qa-blog-challenge.md && git commit -m "feat: 하위 에이전트 3종(blog-challenge)"`

---

### Task 8: 오케스트레이션 런북 (`docs/voc-runbook.md`)

**Files:**
- Create: `docs/voc-runbook.md`

**Interfaces:** 사용자/세션이 따르는 7단계 실행 순서 + 사람 개입 2지점(승인·커밋).

- [ ] **Step 1: 작성** — "VoC 처리" 지시 시 세션이 voc-router→PO→하위 팬아웃→텔레그램 승인→루프→완료보고→커밋 순으로 도는 절차, 명령 예시 포함.
- [ ] **Step 2: 커밋** — `git add docs/voc-runbook.md && git commit -m "docs: VoC 처리 런북"`

---

## Self-Review
- **스펙 커버리지**: §3 에이전트(T5~7) · §4 VoC저장(T1~2) · §흐름 수집(T3) · §5 텔레그램(T4) · §6 흐름(T8 런북) · §7 DoD(T6에 명시). 전 항목 태스크 존재.
- **타입 일관성**: `buildVocRecord/validateVoc/dedupKey`(T1) ↔ GAS 미러(T2) ↔ router 참조(T5) 일치. 시트 헤더 10컬럼 T2·spec §4 일치.
- **플레이스홀더**: 에이전트 md 본문은 구현 시 전문 작성(프로즈라 계획엔 구조 규정). 코드 태스크(T1,T4)는 실제 코드 포함.
