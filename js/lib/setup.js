// S2 챌린지 생성·설정 순수 로직 (의존성 0, GAS Setup.gs와 미러)

const STATUS_VALUES = ['모집중', '선발중', '진행중', '종료'];
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

  if (input.status != null && String(input.status) !== '' && !STATUS_VALUES.includes(String(input.status))) {
    errors.status = '상태 값이 올바르지 않습니다.';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export const SETUP_STATUS_VALUES = STATUS_VALUES;
