// S2 챌린지 생성·설정 순수 로직 (GAS Setup.gs와 미러)

import { STORED_STATUS_VALUES, isKnownStatus, normalizeStatus } from './status.js';

const DEFAULT_ROUNDS = 10;

export function slugify(raw, suffix) {
  const base = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const core = base || `challenge-${Date.now().toString(36)}`;
  return suffix ? `${core}-${suffix}` : core;
}

function toRounds(n) {
  const r = Math.floor(Number(n));
  return Number.isFinite(r) && r >= 1 ? r : DEFAULT_ROUNDS;
}

export function buildEmptyMissions(challengeId, totalRounds) {
  const n = toRounds(totalRounds);
  const rows = [];
  for (let i = 1; i <= n; i += 1) {
    rows.push({
      challengeId,
      round: i,
      title: '',
      body: '',
      articleName: '',
      articleUrl: '',
      openDate: '',
      dueDate: '',
      status: '대기',
    });
  }
  return rows;
}

export function normalizeMissions(challengeId, missions, totalRounds) {
  const n = toRounds(totalRounds);
  const base = buildEmptyMissions(challengeId, n);
  const list = Array.isArray(missions) ? missions : [];
  list.forEach((m, i) => {
    const round = Number(m && m.round) >= 1 ? Math.floor(Number(m.round)) : i + 1;
    if (round < 1 || round > n) return;
    const row = base[round - 1];
    row.title = m.title != null ? String(m.title) : '';
    row.body = m.body != null ? String(m.body) : '';
    row.articleName = m.articleName != null ? String(m.articleName) : '';
    row.articleUrl = m.articleUrl != null ? String(m.articleUrl) : '';
  });
  return base;
}

export function validateSettings(input = {}) {
  const errors = {};
  if (!input.name || !String(input.name).trim()) errors.name = '챌린지명을 입력하세요.';

  const rounds = Math.floor(Number(input.totalRounds));
  if (!Number.isFinite(rounds) || rounds < 1) errors.totalRounds = '총회차는 1 이상이어야 합니다.';

  if (input.rewardPerPost != null && String(input.rewardPerPost) !== '') {
    const reward = Number(input.rewardPerPost);
    if (!Number.isFinite(reward) || reward < 0) errors.rewardPerPost = '활동비는 0 이상이어야 합니다.';
  }

  if (input.excellentMultiplier != null && String(input.excellentMultiplier) !== '') {
    const mult = Number(input.excellentMultiplier);
    if (!Number.isFinite(mult) || mult < 1) errors.excellentMultiplier = '우수 배수는 1 이상이어야 합니다.';
  }

  // 해석 가능한 상태(레거시 별칭 포함)면 통과. 저장 대상 3종으로 좁히는 일은
  // resolveSavedStatus가 쓰기 직전에 한다 — 파생값 '운영중'을 받아도 설정 저장을 막지 않는다.
  const status = input.status == null ? '' : String(input.status).trim();
  if (status !== '' && !isKnownStatus(status)) {
    errors.status = '상태 값이 올바르지 않습니다.';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

function isStorableStatus(raw) {
  return isKnownStatus(raw) && STORED_STATUS_VALUES.includes(normalizeStatus(raw));
}

// 시트에 쓸 status 결정.
// WHY: updateChallengeRow_가 17열을 통째로 덮어쓴다. status를 안 보낸 수정 저장이
// 기본값을 대입하면 모집중→준비로 역행하므로, 미지정이면 기존 행 값을 그대로 보존한다.
// 신규 생성은 기존 값이 없으니 자연히 '준비'가 된다.
export function resolveSavedStatus(inputStatus, prevStatus) {
  const raw = String(inputStatus == null ? '' : inputStatus).trim();
  if (raw && isStorableStatus(raw)) return normalizeStatus(raw);
  return normalizeStatus(prevStatus);
}

export const SETUP_STATUS_VALUES = STORED_STATUS_VALUES;
