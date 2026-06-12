function phoneKey(raw) {
  if (raw == null) return '';
  return String(raw).replace(/\D/g, '');
}

function isExcellent(v) {
  return String(v == null ? '' : v).trim().toUpperCase() === 'Y';
}

export function calcSettlement(participants = [], submissions = [], wrapups = [], policy = {}) {
  const rewardPerPost = Number(policy.rewardPerPost) || 0;
  const excellentMultiplier = Number(policy.excellentMultiplier) || 2;

  const countByPhone = new Map();
  for (const s of submissions) {
    const k = phoneKey(s.phone);
    if (!k) continue;
    countByPhone.set(k, (countByPhone.get(k) || 0) + 1);
  }
  const excellentByPhone = new Map();
  for (const w of wrapups) {
    const k = phoneKey(w.phone);
    if (!k) continue;
    excellentByPhone.set(k, isExcellent(w.excellent));
  }

  return participants.map((p) => {
    const k = phoneKey(p.phone);
    const submitCount = countByPhone.get(k) || 0;
    const excellent = excellentByPhone.get(k) || false;
    const base = submitCount * rewardPerPost;
    const amount = excellent ? base * excellentMultiplier : base;
    return { phone: p.phone, name: p.name, submitCount, excellent, amount };
  });
}

const CSV_HEADER = ['휴대폰', '성함', '제출수', '우수활동자', '활동비'];

function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows = []) {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) {
    lines.push([
      csvCell(r.phone),
      csvCell(r.name),
      csvCell(r.submitCount),
      csvCell(r.excellent ? 'Y' : 'N'),
      csvCell(r.amount),
    ].join(','));
  }
  return lines.join('\n');
}
