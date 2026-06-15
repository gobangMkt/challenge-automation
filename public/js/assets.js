/* 썸네일·포스터 자동 생성 — 캠페인 데이터 + BI 테마로 HTML 합성 후 html2canvas로 PNG.
   인라인 스타일(html2canvas 안정성)·디스플레이폰트는 테마에서. */
import { pickTheme, DISPLAY_FONTS } from './themes.js';

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* 제목을 2줄로 분할 (공백 우선, 없으면 글자 절반) — 썸네일 강제 2줄용 */
const twoLine = (name) => {
  const s = String(name || '').trim();
  const w = s.split(/\s+/).filter(Boolean);
  if (w.length >= 2) { const m = Math.ceil(w.length / 2); return [w.slice(0, m).join(' '), w.slice(m).join(' ')]; }
  const a = [...s]; const m = Math.ceil(a.length / 2); return [a.slice(0, m).join(''), a.slice(m).join('')];
};
const twoLineHtml = (name) => twoLine(name).map(esc).join('<br>');
const tagOf = (c, d) => d.tagline || `${c.totalRounds || 10}주 블로그 챌린지`;
const hookOf = (d) => String(d.concept || '').split('\n').map((s) => s.trim()).filter(Boolean)[0] || '지금 바로 신청하세요';
const benefitsOf = (d) => (Array.isArray(d.benefits) ? d.benefits : []).map((b) => String(b).replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, '').trim()).filter(Boolean);

/* 자유 텍스트 → 마커 제거한 줄 배열 */
const linesOf = (s) => String(s == null ? '' : s).split('\n')
  .map((x) => x.replace(/^\s*(?:[-•*·–—▪◦‣★☆◆▶▷✓✔]|\d+[.)])\s+/, '').trim()).filter(Boolean);
const fmtMD = (s) => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[2]}.${+m[3]}` : ''; };
const addMD = (iso, n) => { const m = String(iso || '').match(/(\d{4})-(\d{2})-(\d{2})/); if (!m) return ''; const dt = new Date(+m[1], +m[2] - 1, +m[3] + n); return `${dt.getMonth() + 1}.${dt.getDate()}`; };

/* 누락 시 기본값 (자동 매핑 + 기본값 정책) */
const DEFAULT_ELIG = ['개인 블로그를 운영 중인 누구나'];
const DEFAULT_ACT = [
  '실무 자료가 담긴 스터디 자료 확인',
  '매주 예시용 실무 아티클 제공',
  '자료 참고하여 블로그 실습 진행',
  '실습 갯수에 따라 리워드 적립',
];
const DEFAULT_CAUTION = ['본인 명의 블로그 1개로만 참여 가능', '미션은 정해진 기간 내 제출 시 인정'];
const eligOf = (d) => { const v = linesOf(d.eligibility); return v.length ? v : DEFAULT_ELIG; };
const actOf = (d) => { const v = benefitsOf(d); return v.length ? v : DEFAULT_ACT; };
const cautionsOf = (d) => { const v = (Array.isArray(d.cautions) ? d.cautions : linesOf(d.cautions)).map((x) => String(x).replace(/^\s*(?:[-•*·–—▪◦‣★☆◆▶▷✓✔]|\d+[.)])\s+/, '').trim()).filter(Boolean); return v.length ? v : DEFAULT_CAUTION; };
function scheduleRows(c) {
  const rows = [];
  const rec = (c['모집시작'] && c['모집마감']) ? `${fmtMD(c['모집시작'])} - ${fmtMD(c['모집마감'])}`
    : c['모집마감'] ? `~ ${fmtMD(c['모집마감'])}` : '';
  if (rec) rows.push(['신청 접수', rec]);
  if (c['발표일']) rows.push(['참가자 발표', fmtMD(c['발표일'])]);
  if (c['시작일']) {
    const rounds = Number(c.totalRounds) || 10;
    rows.push(['실습 진행', `${fmtMD(c['시작일'])} - ${addMD(c['시작일'], rounds * 7)} (${rounds}주)`]);
  }
  return rows;
}

function tiersOf(d, c) {
  if (d.rewardType === 'grade' && Array.isArray(d.rewardTiers) && d.rewardTiers.length) {
    return d.rewardTiers.slice().sort((a, b) => a.min - b.min).filter((t) => t.amount > 0).map((t, i, arr) => {
      const next = arr[i + 1];
      const range = next ? `${t.min}~${next.min - 1}개` : `${t.min}개 이상`;
      return { range, amount: t.amount };
    });
  }
  const amt = Number(d.rewardAmount || c.rewardPerPost || 0);
  return amt ? [{ range: '활동 시', amount: amt }] : [];
}

const fontLink = () => DISPLAY_FONTS; // ensure import kept

/* 썸네일 1080×1080 */
export function thumbNode(c, d) {
  const t = pickTheme(c.name, d.theme);
  const disp = DISPLAY_FONTS[t.display];
  const reward = d.rewardAmount || c.rewardPerPost;
  const el = document.createElement('div');
  el.style.cssText = `width:1080px;height:1080px;position:relative;overflow:hidden;font-family:'Pretendard Variable',sans-serif;color:#fff;background:radial-gradient(120% 80% at 50% -10%, ${t.heroBg2}, ${t.heroBg});display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;box-sizing:border-box;text-align:center`;
  el.innerHTML = `
    <div style="position:absolute;top:-60px;right:-40px;width:300px;height:300px;border-radius:50%;background:${t.primary};opacity:.35"></div>
    <div style="position:absolute;bottom:60px;left:-50px;width:200px;height:200px;border-radius:50%;background:${t.pop};opacity:.22"></div>
    <div style="display:flex;gap:16px;margin-bottom:34px;position:relative">
      ${reward ? `<span style="font-weight:800;font-size:34px;padding:15px 32px;border-radius:999px;background:${t.pop};color:${t.popInk}">활동비 지급</span>` : ''}
      <span style="font-weight:700;font-size:34px;padding:15px 32px;border-radius:999px;background:rgba(255,255,255,.16)">${esc(c.totalRounds || 10)}주 과정</span>
    </div>
    <div style="background:#fff;border-radius:44px;padding:64px 60px;max-width:920px;position:relative">
      <div style="color:${t.primary};font-weight:800;font-size:42px;margin-bottom:22px">${esc(tagOf(c, d))}</div>
      <div style="font-family:${disp};color:${t.heroBg};font-size:118px;line-height:1.1;letter-spacing:-0.04em">${twoLineHtml(c.name)}</div>
    </div>
    <div style="margin-top:38px;background:rgba(255,255,255,.14);border-radius:24px;padding:30px 40px;font-size:40px;font-weight:700;line-height:1.4;max-width:880px;position:relative">${esc(hookOf(d))}</div>`;
  return el;
}

/* 포스터 1080×(동적) — 헤더 + 2컬럼 4섹션(참가자격·리워드 / 활동내용·상세안내) */
export function posterNode(c, d) {
  const t = pickTheme(c.name, d.theme);
  const disp = DISPLAY_FONTS[t.display];
  const reward = d.rewardAmount || c.rewardPerPost;
  const tiers = tiersOf(d, c);
  const elig = eligOf(d);
  const acts = actOf(d);
  const sched = scheduleRows(c);
  const cautions = cautionsOf(d);
  const line = 'rgba(0,0,0,.08)';

  const secTitle = (s) => `<div style="display:flex;align-items:center;gap:14px;font-weight:800;font-size:40px;color:${t.ink};margin:0 0 24px;letter-spacing:-.02em"><span style="color:${t.primary};font-size:34px;line-height:1">✻</span>${esc(s)}</div>`;
  const dot = `<span style="flex:none;width:14px;height:14px;margin-top:11px;border-radius:5px;background:${t.primary};transform:rotate(45deg)"></span>`;
  const bullet = (txt) => `<div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:16px">${dot}<span style="font-size:29px;line-height:1.42;color:${t.ink}">${esc(txt)}</span></div>`;
  const card = (inner) => `<div style="background:${t.surface2};border-radius:28px;padding:36px;margin-bottom:26px">${inner}</div>`;

  const rewardBlock = tiers.length
    ? tiers.map((r) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:2px solid ${line}"><span style="font-size:29px;color:${t.ink}">${esc(r.range)} 작성</span><b style="font-size:34px;color:${t.primary};font-variant-numeric:tabular-nums">${Number(r.amount).toLocaleString()}P</b></div>`).join('')
      + `<div style="margin-top:18px;font-size:24px;color:#8A8F98">작성 개수가 많을수록 리워드 ↑ · 우수활동자 ×2</div>`
    : reward
      ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:2px solid ${line}"><span style="font-size:29px;color:${t.ink}">활동 시</span><b style="font-size:34px;color:${t.primary}">${Number(reward).toLocaleString()}P</b></div><div style="margin-top:18px;font-size:24px;color:#8A8F98">우수활동자 ×2</div>`
      : bullet('참가자 전원 활동비 지급');

  const schedBlock = secTitle('상세안내')
    + sched.map(([k, v]) => `<div style="display:flex;gap:16px;align-items:baseline;margin-bottom:14px"><span style="flex:none;width:168px;font-size:28px;font-weight:700;color:${t.ink}">${esc(k)}</span><span style="flex:1;min-width:0;font-size:28px;line-height:1.4;color:${t.ink}">${esc(v)}</span></div>`).join('')
    + (c.openchatUrl ? `<div style="margin-top:18px;padding-top:18px;border-top:2px solid ${line};font-size:25px;color:#8A8F98;line-height:1.4">문의는 오픈카톡으로<br><span style="color:${t.primary};font-weight:700;word-break:break-all">${esc(c.openchatUrl)}</span></div>` : '');

  const el = document.createElement('div');
  el.style.cssText = `width:1080px;font-family:'Pretendard Variable',sans-serif;background:#fff;color:${t.ink};box-sizing:border-box`;
  el.innerHTML = `
    <div style="background:radial-gradient(120% 80% at 50% -10%, ${t.heroBg2}, ${t.heroBg});color:#fff;padding:72px 64px 84px;text-align:center;position:relative;overflow:hidden;border-radius:0 0 48px 48px">
      <div style="position:absolute;top:-50px;right:-30px;width:260px;height:260px;border-radius:50%;background:${t.primary};opacity:.3"></div>
      <div style="position:absolute;bottom:24px;left:-40px;width:170px;height:170px;border-radius:50%;background:${t.pop};opacity:.18"></div>
      <div style="display:flex;gap:14px;justify-content:center;margin-bottom:34px;position:relative">
        ${reward ? `<span style="font-weight:800;font-size:28px;padding:13px 28px;border-radius:999px;background:${t.pop};color:${t.popInk}">활동비 지급</span>` : ''}
        <span style="font-weight:700;font-size:28px;padding:13px 28px;border-radius:999px;background:rgba(255,255,255,.16)">${esc(c.totalRounds || 10)}주 과정</span>
      </div>
      <div style="background:#fff;border-radius:36px;padding:44px 56px;max-width:940px;margin:0 auto;position:relative">
        <div style="color:${t.primary};font-weight:800;font-size:31px;margin-bottom:14px">${esc(tagOf(c, d))}</div>
        <div style="font-family:${disp};color:${t.heroBg};font-size:88px;line-height:1.1;letter-spacing:-0.04em">${twoLineHtml(c.name)}</div>
      </div>
      <div style="margin:30px auto 0;max-width:940px;background:rgba(255,255,255,.12);border-radius:22px;padding:24px 34px;font-size:30px;font-weight:700;line-height:1.4;color:#fff;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;position:relative">${esc(hookOf(d))}</div>
    </div>
    <div style="padding:54px 44px 70px">
      <div style="display:flex;gap:28px;align-items:flex-start">
        <div style="flex:1;min-width:0">
          ${card(secTitle('참가자격') + elig.map(bullet).join(''))}
          ${card(secTitle('리워드') + rewardBlock)}
          ${card(secTitle('유의사항') + cautions.slice(0, 3).map(bullet).join(''))}
        </div>
        <div style="flex:1;min-width:0">
          ${card(secTitle('활동내용') + acts.slice(0, 6).map(bullet).join(''))}
          ${sched.length || c.openchatUrl ? card(schedBlock) : ''}
        </div>
      </div>
    </div>`;
  return el;
}

/* 노드 → PNG 다운로드 (html2canvas 전역 필요) */
export async function downloadNode(node, filename, scale = 1) {
  if (typeof window.html2canvas !== 'function') throw new Error('html2canvas 로드 안 됨');
  document.fonts && document.fonts.ready && (await document.fonts.ready);
  const stage = document.createElement('div');
  stage.style.cssText = 'position:fixed;left:-99999px;top:0;z-index:-1';
  stage.appendChild(node);
  document.body.appendChild(stage);
  try {
    const canvas = await window.html2canvas(node, { scale, backgroundColor: null, useCORS: true, logging: false });
    await new Promise((res) => canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); res();
    }, 'image/png'));
  } finally { stage.remove(); }
}
