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
- **프로덕션 URL**: `배포 예정` (GitHub Pages, S1 이후 갱신)
- **GitHub repo**: `배포 예정` (생성 후 갱신)

## 현재 상태
1단계 스펙✅ · 2단계 디자인✅ · 3단계 슬라이스✅ · 3.5 리소스✅ · **4단계 구현 S1~S7 코드 완료**(순수로직 79 test pass, 멀티에이전트 병렬 구현 후 통합). 남은 건 사용자 GAS 배포·시크릿·트리거·E2E. 상세는 `docs/TODO.md`.
