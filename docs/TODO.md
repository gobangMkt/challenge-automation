# 개발 TODO — 블로그 챌린지 앱 (수직 슬라이스)

> 트레이서불릿 원칙: 각 슬라이스는 **프론트→GAS→시트**를 관통하는 "동작하는 가장 얇은 조각". 슬라이스 끝마다 실제로 쓸 수 있어야 함.
> 스펙: `docs/spec.md` · 디자인: `design-system/MASTER.md` · 출처: `docs/context.md`
> 진행: TDD(RED→GREEN→REFACTOR) + @frontend-design 상시.

## 슬라이스 순서 & 의존성
```
S1 신청 ──> S2 챌린지설정 ──> S3 선발 ──┐
                │                        ├─> S5 운영대시보드 ──> S7 마무리·정산
                └──> S4 주차제출 ────────┘         │
                                          S6 스케줄자동화(알림톡·노션) ┘
```

---

## S1. 신청 (엔드투엔드 첫 조각) ⭐먼저 — 코드 완료(서버배포 대기)
**목표**: 참가자가 신청폼을 채워 제출하면 시트에 저장되고, 운영자가 명단을 조회할 수 있다.
- [x] 순수로직 TDD: normalizePhone/validateApplication/upsertParticipant (10 tests pass)
- [x] GAS: `Participants` 시트 생성, `doPost(action=apply)` 검증·저장(휴대폰 중복=업서트)
- [x] GAS: `doGet(action=participants)` 명단 조회(operatorToken 검증)
- [x] 프론트: 랜딩+신청폼(성함/휴대폰/참가블로그URL/동의) — MASTER 토큰 적용
- [x] 프론트: 운영자 명단 화면(최소 표)
- [x] 검증: 휴대폰 형식, 필수, 동의, 모집상태(마감 시 차단)
- [ ] **사용자 작업**: 스프레드시트 생성 + GAS 배포(Web App) + Script Property `OPERATOR_TOKEN` 설정 + `public/js/config.js`의 `GAS_ENDPOINT` 교체 → 그 후 E2E 검증
**수용기준(AC)**
- 신청 제출 → 시트에 1행, 화면에 완료 피드백.
- 동일 휴대폰 재신청 시 중복행 없이 갱신.
- 운영자 토큰 없으면 명단 403.
- 필수 누락/형식오류 시 필드 하단 에러.

## S2. 챌린지 생성·설정
**목표**: 운영자가 챌린지를 만들고 일정·회차 골격을 설정한다.
- [ ] GAS: `Challenges`·`WeekMissions` 시트, `doPost(action=createChallenge / saveSettings)`
- [ ] 회차 미션 편집(제목/본문), 모집·발표·시작일·요일·총회차·리워드·오픈카톡·노션DB소스
- [ ] 프론트: 운영자 설정 화면, challengeId 발급 → 참가자 링크 `?c=`
**AC**: 챌린지 생성→고유 링크 동작. 설정 저장·재로딩 일치. 회차 N개 미션행 자동 생성.

## S3. 선발
**목표**: 신청자 중 선발/탈락을 처리하고 상태가 반영된다.
- [ ] GAS: `doPost(action=select)` Participants.status 변경(신청→선발/탈락)
- [ ] 프론트: 선발 처리 화면(토글/일괄), 발표일 가드
- [ ] (S6 연동 전까지) 선발 알림톡은 stub/로그
**AC**: 선발/탈락 토글→시트 status 갱신. 선발자만 이후 제출 가능.

## S4. 주차 제출 + 본인 진행현황
**목표**: 선발 참가자가 휴대폰으로 식별해 현재 회차 게시물 URL을 제출하고 진행현황을 본다.
- [ ] GAS: `Submissions` 시트, `doPost(action=submit)` 현재 오픈회차 자동판별·저장(회차 중복=갱신)
- [ ] GAS: `doGet(action=myStatus&phone=)` 본인 회차별 제출 현황
- [ ] 프론트: 제출 화면(휴대폰→식별→게시물URL), 이번주 미션/아티클 노출, 진행 N/총 + 회차 뱃지
**AC**: 제출→시트 저장, 진행바·뱃지 갱신. 미선발/미오픈 시 차단+안내. 회차 재제출 갱신.

## S5. 운영 대시보드 (제출현황 매트릭스)
**목표**: 운영자가 참가자×회차 제출현황을 한눈에 본다.
- [ ] GAS: `doGet(action=matrix)` 집계(참가자×회차, 완주율)
- [ ] 프론트: 매트릭스 표(미제출=danger 표시), 정렬, 완주율 요약
**AC**: 제출 데이터가 매트릭스에 정확 반영. 미제출 셀 식별. 정렬 동작.

## S6. 스케줄 자동화 + SOLAPI + 노션 아티클
**목표**: 매주 자동으로 회차 오픈·알림톡 발송, 미제출 리마인드, 아티클 read.
- [ ] GAS: Notion API read(`type contains 혼잘주거`) → 회차 아티클 자동 fallback 채움
- [ ] GAS: SOLAPI 알림톡(오픈/리마인드/선발/완주 템플릿), `NotifyLog` 기록
- [ ] GAS: 시간트리거 핸들러(매일 1회): 오픈일→오픈+발송, 마감D-1→미제출 리마인드, 마감→다음회차
- [ ] 프론트: 알림 로그 화면 + 수동 재발송
**AC**: 트리거 모의실행 시 오픈/리마인드 분기 정확. 알림톡 발송→NotifyLog 성공/실패 기록. 아티클 미배정 회차 최신순 자동 채움.
**선행 리소스**: SOLAPI 채널·템플릿 승인, Notion Integration 토큰+DB공유 (3.5 리소스 체크리스트).

## S7. 마무리 + 정산
**목표**: 마무리폼 수집 후 활동비를 정산한다.
- [ ] GAS: `Wrapup` 시트, `doPost(action=wrapup)`
- [ ] GAS: `doGet(action=settlement)` 제출수×단가, 우수활동자 2배 계산
- [ ] 프론트: 마무리폼(작성갯수/우수활동자), 운영자 정산표 + CSV export
**AC**: 마무리 제출 저장. 정산표 금액=제출수×단가(우수 2배) 정확. CSV 내려받기.

---
## 통합 상태 (2026-06-12)
- **S1~S7 코드 전부 완료.** 순수로직 테스트 **79 pass**. GAS 7파일 합본 문법 OK. 프론트 뷰 9개 import·라우트 정상 렌더(테마 일관).
- 멀티에이전트 병렬 구현(S2~S7) 후 메인 통합 완료:
  - Code.gs doPost/doGet에 전 액션 배선(apply/createChallenge/saveSettings/saveMissions/select/submit/wrapup/resend · participants/myStatus/matrix/notifyLog/settlement)
  - app.js 라우터 9뷰(#/admin/setup·select·matrix·notify·settlement, #/admin, #/submit, #/wrapup, ?c= 신청)
  - theme.css에 S2/S4/S7 컴포넌트 클래스 추가
  - **시트 헤더 표준 = 한글로 통일**(Automation.gs 영문→한글 교정, admin-notify.js 키 교정). WeekMissions/Submissions/NotifyLog/Challenges 정합.
  - 전역 중복 제거(WEEKMISSION_HEADERS·NOTIFYLOG_HEADERS·findChallengeRow_)
  - 알림톡 제출링크를 `?c=...#/submit`(쿼리 우선)로 수정

## 남은 일 (사용자 작업 — 코드 아님)
1. 구글 스프레드시트 생성 → Apps Script에 `src/gas/*.gs` 7개 붙여넣고 **Web App 배포**(액세스=모든 사용자)
2. Script Properties 설정: `OPERATOR_TOKEN`, `APP_BASE_URL`(Pages URL), `NOTION_TOKEN`, `SOLAPI_KEY/SECRET/SENDER/PFID`, `SOLAPI_TPL_OPEN/REMIND/SELECT/DONE`
3. `public/js/config.js`의 `GAS_ENDPOINT` 교체
4. `dailyTrigger` 시간트리거 매일 1회 등록
5. SOLAPI 채널·알림톡 템플릿 4종 승인 / Notion Integration에 「작성기록」 DB 공유
→ 그 후 전체 E2E(신청→선발→제출→대시보드→자동알림→마무리→정산) 검증
