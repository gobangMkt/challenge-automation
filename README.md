# 블로그 챌린지 앱

블로그 챌린지("취준 블로그 마스터즈 / 방학스펙업")의 신청·주차운영·정산을 한 곳에서 처리하고, 매주 진행을 자동화하는 웹앱. 참가자(신청·주차제출)와 운영자(대시보드·정산) 양쪽이 쓴다.

## 개요
- **무엇**: 흩어진 구글폼 4종 + 노션 수작업을 앱으로 통합. 매주 회차 오픈·알림톡·미제출 리마인드를 스케줄 자동화.
- **누구를 위해**: 챌린지 운영팀(고방 마케팅) + 참가 취준생.
- **왜**: 운영 공수↓, 참가자 UX↑(본인 진행현황·미션·아티클 한 화면).

## 코어
- **스택**: GitHub Pages(정적 SPA, 빌드리스 바닐라 JS) + Google Apps Script(API·시간트리거) + Google Sheets(DB) + SOLAPI(카카오 알림톡) + Notion API(아티클 read).
- **식별**: 로그인 없음. **휴대폰번호 = 키**. 챌린지별 링크 `?c=<challengeId>`.
- **데이터(시트 6탭)**: Challenges / WeekMissions / Participants / Submissions / Wrapup / NotifyLog.
- **자동화**: GAS 시간트리거 매일 1회 — 회차 오픈+알림톡, 마감 D-1 미제출 리마인드, 마감→다음회차.
- **아티클**: 노션 「작성기록」 DB에서 `type=혼잘주거` read-only. 회차별 수동 배정 + 미배정 시 최신순 자동.
- **정산**: 제출 갯수 × 단가, 우수활동자 2배.

## VoC 자동 개선 파이프라인
참가자 피드백을 모아 에이전트가 개선까지 끌고 가는 흐름. 실행은 Claude Code 세션이 오케스트레이터.
- **수집**: 운영자 admin 상단바 **신고하기**(로그아웃 옆, 상시, 카테고리: 버그/기능추가/개선/기타) → GAS `submitVoc`(channel=operator, project 태그) → **전 서비스 공통 중앙 VoC 시트**(바운드 시트 아님, Script Property `VOC_SHEET_ID`). 운영자 대상 — 참가자 landing엔 없음. 읽기(`getVoc`)는 운영토큰 필요.
- **에이전트**: `voc-router`(글로벌, 수집·분류·배정) → `po-blog-challenge`(PO, PRD·검수·사인오프) → `dev/design/qa-blog-challenge`(구현·디자인·검증).
- **승인·알림**: 텔레그램 양방향(`scripts/telegram.mjs`) + 터미널. 사람 개입 2지점(개선안 승인 / 최종 커밋).
- **절차 상세**: `docs/voc-runbook.md`. 설계: `docs/superpowers/specs/2026-06-22-voc-agent-pipeline-design.md`.

## 디렉토리
```
src/lib/     순수 로직 (GAS·프론트 공용, node --test 대상)
src/gas/     GAS 어댑터 (doGet/doPost, SpreadsheetApp, 트리거)
public/      정적 프론트 (참가자 + 운영자)
tests/       단위 테스트
docs/        spec.md · TODO.md · context.md
design-system/ MASTER.md (테마: 갓생 코랄)
```

## 실행 / 개발
- **로컬 프론트 미리보기**: `시작 3060.bat` → http://localhost:3060 (python http.server)
- **테스트**: `npm test` (node 내장 test runner, 의존성 0)
- **GAS 배포**: Apps Script Web App 배포(모든 사용자). 시크릿은 Script Properties(SOLAPI 키/템플릿ID, Notion 토큰, operatorToken).
- **포트**: 3060 (로컬 정적 서버)

## 배포링크
- **운영자 허브(admin)**: https://gobangmkt.github.io/challenge-automation/admin.html
  - 사이드바 hub: 캠페인 허브 · 캠페인 생성 · 관리·마케팅 · 운영(주차). 운영 토큰으로 인증.
- **참가자 신청 상세페이지**: https://gobangmkt.github.io/challenge-automation/?c=`<challengeId>`
  - 리치 랜딩(태그라인·혜택·일정·활동비) + 신청. `#submit` 주차제출 · `#wrapup` 마무리.
- **GitHub repo**: https://github.com/gobangMkt/challenge-automation
- **GAS Web App 엔드포인트**: `public/js/config.js`의 `GAS_ENDPOINT` (시트 바인딩 Apps Script, 익명 접근)
- **데이터 시트**: container-bound 스프레드시트 (Participants/Challenges/WeekMissions/Submissions/Wrapup/NotifyLog/Campaigns)

## 현재 상태
**Admin Hub 재설계 완료** (2026-06-13) — 0.CS도움앱식 사이드바 레지스트리 hub 차용.
- 캠페인 생성(노션 상세데이터→신청 상세랜딩 자동생성) / 관리·마케팅(명단·선발·우수선정·배포링크·QR) / 운영(주차 오픈·검수).
- GAS 신규 액션: campaigns·campaignDetail·saveCampaign·setExcellent·missions·openWeek·weekSubmissions·reviewSubmission.
- 풀 E2E 11단계 통과: 캠페인생성→랜딩→신청→선발→우수→주차오픈→제출→검수→집계.
- ⚠️ 함수명 충돌 주의: Automation.gs의 `openWeek_(c,week)`와 분리 위해 hub용은 `hubOpenWeek_`.

**남은 2차 작업**: SOLAPI 알림톡 템플릿 승인·시크릿, Notion 토큰·DB공유, `dailyTrigger` 시간트리거 등록. 상세 `docs/TODO.md`.
