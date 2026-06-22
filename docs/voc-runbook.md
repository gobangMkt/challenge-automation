# VoC 처리 런북

VoC → 에이전트 자동 개선 파이프라인의 실행 절차. 설계: `docs/superpowers/specs/2026-06-22-voc-agent-pipeline-design.md`.

## 사전 준비 (1회)
- **텔레그램**: `~/.claude/.telegram`(JSON `{"botToken":"","chatId":""}`) 생성. 값 채움. git·시트에 값 금지.
- **GAS 재배포**: `submitVoc`/`getVoc` 액션 반영 위해 Apps Script Web App 새 버전 배포. `VoC` 탭은 최초 호출 시 자동 생성.
- **에이전트 확인**: 글로벌 `voc-router`(+ registry), 프로젝트 `po/dev/design/qa-blog-challenge` 로드 확인.

## 실행 (Claude Code 세션에서 "VoC 처리" 지시 시)

1. **수집**: 운영자가 admin 상단바 **신고하기**(로그아웃 옆, 상시) → 시트 `VoC` 탭(`status=new`, channel=operator). 운영자 대상 기능 — 참가자 landing엔 없음. (시트에 직접 행 추가도 가능.)
2. **파악·배정**: `voc-router` 호출 → `getVoc(status=new)` read → 중복제거·분류·심각도 → registry로 담당 PO 배정.
3. **개선안**: 배정된 `po-blog-challenge` 호출 → 스펙확인·브레인스토밍 → PRD·납품조건.
4. **승인요청 푸시** ⛔게이트: `node scripts/telegram.mjs notify "<formatVocApproval 결과>"` — VoC 원문 + 개선안 전송.
5. **승인 대기**: `node scripts/telegram.mjs wait-approval` (폰에서 '승인'/'반려') **또는** 터미널 입력. 먼저 오는 응답 채택. 반려 시 3단계로.
6. **실행 루프**: PO가 `dev/design/qa-blog-challenge`에 업무분배(독립=병렬, 의존=직렬) → 검수 → **PO 사인오프(DoD)까지 재지시**. 동일 실패 3회 시 중단·사람에게 가이드 요청.
7. **완료보고 푸시**: `node scripts/telegram.mjs notify "<formatDone 결과>"` — 변경요약·검증결과(test/qa/ui).
8. **커밋**: 사용자가 변경 확인 후 commit·push(전역 git 규칙 — add -A 금지, 코드/설정만 선별). VoC `status=committed`, `commit` 컬럼에 해시 기록.

## 사람 개입 2지점
- **승인(4~5단계)**: 개선안 실행 전.
- **커밋(8단계)**: 완료 후 push.

## 새 프로젝트 확장
1. 그 프로젝트 `.claude/agents/`에 `po-<프로젝트>` + `dev/design/qa-<프로젝트>` 추가.
2. 앱에 피드백 버튼 + GAS `submitVoc`/`getVoc`(또는 해당 저장소) 연결.
3. `~/.claude/agents/voc-router.registry.md`에 `project → po-<프로젝트>` 한 줄 추가.
