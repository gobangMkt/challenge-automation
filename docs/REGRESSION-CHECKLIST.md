# 회귀 방지 체크리스트 (배포 전 필수)

UI/JS를 만질 때마다 "고친 한 곳"이 "다른 코어 기능"을 깨는 회귀가 반복됐다.
원인은 **렌더 결과를 눈으로 확인하지 않고 배포**한 것. 아래를 지킨다.

## 0. 황금 규칙
- **landing.js / admin.js / *.css 를 수정하면, 배포 전 Playwright로 실제 렌더·인터랙션을 1회 이상 확인한다.** (`node --check`만으로는 클릭/레이아웃 회귀를 못 잡는다)
- 로컬 확인: `python -m http.server 3060 --directory public` → `index.html?c=<challengeId>#submit` / `admin.html`.
  - 로그인 없이 대시보드를 보려면 `window.fetch`를 목업해 `myStatus`/`boardData` 응답을 주입(또는 `localStorage`의 `challenge.status.<cid>` 캐시 시드)한다.
- 변경 영역과 **인접한 코어 플로우**를 반드시 같이 확인(아래 목록).

## 1. 코어 플로우 (절대 깨지면 안 됨)
### 참가자(landing)
- [ ] 신청 폼 제출(중복 블로그 차단 포함)
- [ ] submit 본인확인(휴대폰+블로그) → 대시보드
- [ ] **submit 주차 칩 클릭 → 해당 회차 카드 전환** ← 드래그 스크롤과 충돌 주의
- [ ] submit 주차 칩 가로 스크롤(휠/드래그) — 드래그 후 클릭은 무시되지만 단순 클릭은 동작
- [ ] 게시물 URL 제출/수정 토글
- [ ] 마무리(#wrapup) 폼 제출 — 성함/휴대폰/블로그/갯수/우수Y·N/동의
- [ ] 재방문 시 캐시(SWR) 즉시표시 + 백그라운드 갱신

### 운영자(admin)
- [ ] 탭 전환(마케팅/관리/운영/리워드) 내용 정확
- [ ] 관리: 선발/탈락 토글, 중복 표시, 우수=읽기전용
- [ ] 운영: 주차 저장→오픈, on/off 토글, 회차 칩 상태 동기화
- [ ] 운영: 제출 검수(반려 토글), **우수 ★ 토글** → 주차 칩/관리/리워드 반영
- [ ] 운영: 리워드 신청 알림(notifyWrapup) 칩
- [ ] 리워드 탭: 금액별 그룹 합계

## 2. 디자인 불변(BI)
- 색은 **design-system 토큰만**. raw hex/브랜드외 색(카카오 옐로우 등) 금지.
- 한글 텍스트에 `--font-mono`(JetBrains Mono, 한글 글리프 없음) 금지 → 시스템 폴백으로 글꼴이 깨진다. mono는 숫자/Latin 전용.
- 정형 AI 스타일(보라 그라데이션·무분별 라운딩) 금지.

## 3. 인터랙션 함정(겪은 것)
- **`setPointerCapture`를 클릭 가능한 요소의 드래그에 쓰지 말 것** → click 타깃이 컨테이너로 바뀌어 자식 click 핸들러가 죽는다. 드래그는 컨테이너 스코프 pointer 이벤트 + "이동 임계값 초과 시에만 클릭 무시"로 처리.
- 재렌더(SWR 등)로 `window`에 리스너를 누적 추가하지 말 것. 요소 스코프 리스너는 재렌더 시 노드와 함께 GC된다.

## 4. 배포 순서
1. `node --test` (lib) + `node --check public/js/*.js`
2. **Playwright 렌더/클릭 확인** (위 1번 중 변경 인접 항목)
3. master commit·push → `git subtree push --prefix public origin gh-pages`
4. GAS 변경 시 `clasp push` → `clasp deploy -i <prod deployment id>` 로 **운영 배포 갱신**(HEAD 아님)
