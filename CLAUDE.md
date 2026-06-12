# 블로그 챌린지 앱 — 프로젝트 규칙

상위 `프로젝트/CLAUDE.md`와 전역 규칙을 상속한다. 아래는 이 프로젝트 고유 사항.

## 스택 / 구조
- 빌드리스 **바닐라 JS(ES모듈)** 정적 프론트 + **Google Apps Script** 백엔드 + **Google Sheets** DB + **SOLAPI** 알림톡 + **Notion API**(아티클 read).
- 순수 로직은 `src/lib/`에 두고 **node 내장 test runner로 테스트**(의존성 0). GAS/SpreadsheetApp/SOLAPI/Notion 호출 등 사이드이펙트는 `src/gas/` 어댑터에 얇게 격리.
- 프론트는 `public/`. 컬러/타이포는 **`design-system/MASTER.md` 토큰만** 사용(raw hex 금지).

## 빌드 / 테스트
- 테스트: `npm test` (`node --test`). TDD RED→GREEN→REFACTOR 준수.
- 로컬 프론트: `시작 3060.bat` (http://localhost:3060).
- 빌드 단계 없음(정적). 번들러 도입 금지(YAGNI).

## 배포
- 프론트: GitHub Pages. GAS: Apps Script Web App(모든 사용자 액세스).
- 시크릿은 **Script Properties**에만(코드/시트/깃에 값 금지): SOLAPI key/secret/발신·템플릿ID, Notion 토큰, operatorToken 해시.

## 도메인 규칙 (불변)
- 식별키 = 휴대폰번호. 신청=참가블로그 등록, 매주=게시물 URL 제출.
- 신청 ≠ 참가(선발 단계 존재). 회차 미션·아티클은 회차마다 다름.
- 정산: 제출수 × 단가, 우수활동자 2배.
- 단일 진실 소스: `docs/spec.md`. 진행: `docs/TODO.md`.

## 코딩 컨벤션
- 2칸 들여쓰기, 세미콜론, 싱글/백틱. 주석 최소(WHY만). 한국어 응답.
- @frontend-design 상시 적용, 정형 AI 스타일(보라 그라데이션·무분별 라운딩) 금지.
