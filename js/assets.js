/* 썸네일·포스터 자동 생성 — 캠페인 데이터 + BI 테마로 HTML 합성 후 html2canvas로 PNG.
   인라인 스타일(html2canvas 안정성)·디스플레이폰트는 테마에서. */
import { pickTheme, DISPLAY_FONTS } from './themes.js';

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tagOf = (c, d) => d.tagline || `${c.totalRounds || 10}주 블로그 챌린지`;
const hookOf = (d) => String(d.concept || '').split('\n').map((s) => s.trim()).filter(Boolean)[0] || '지금 바로 신청하세요';
const benefitsOf = (d) => (Array.isArray(d.benefits) ? d.benefits : []).map((b) => String(b).replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, '').trim()).filter(Boolean);

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
  el.style.cssText = `width:1080px;height:1080px;position:relative;overflow:hidden;font-family:'Pretendard Variable',sans-serif;color:#fff;background:radial-gradient(120% 80% at 50% -10%, ${t.heroBg2}, ${t.heroBg});display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;box-sizing:border-box;text-align:center`;
  el.innerHTML = `
    <div style="position:absolute;top:-60px;right:-40px;width:300px;height:300px;border-radius:50%;background:${t.primary};opacity:.35"></div>
    <div style="position:absolute;bottom:60px;left:-50px;width:200px;height:200px;border-radius:50%;background:${t.pop};opacity:.22"></div>
    <div style="display:flex;gap:16px;margin-bottom:40px;position:relative">
      ${reward ? `<span style="font-weight:800;font-size:30px;padding:14px 30px;border-radius:999px;background:${t.pop};color:${t.popInk}">활동비 지급</span>` : ''}
      <span style="font-weight:700;font-size:30px;padding:14px 30px;border-radius:999px;background:rgba(255,255,255,.16)">${esc(c.totalRounds || 10)}주 과정</span>
    </div>
    <div style="background:#fff;border-radius:48px;padding:56px 56px;max-width:880px;box-shadow:0 30px 70px rgba(0,0,0,.3);position:relative">
      <div style="color:${t.primary};font-weight:800;font-size:34px;margin-bottom:18px">${esc(tagOf(c, d))}</div>
      <div style="font-family:${disp};color:${t.heroBg};font-size:104px;line-height:1.08">${esc(c.name)}</div>
    </div>
    <div style="margin-top:44px;background:rgba(255,255,255,.14);border-radius:24px;padding:26px 36px;font-size:34px;font-weight:700;line-height:1.4;position:relative">${esc(hookOf(d))}</div>`;
  return el;
}

/* 포스터 1080×(동적, 콘텐츠 높이) */
export function posterNode(c, d) {
  const t = pickTheme(c.name, d.theme);
  const disp = DISPLAY_FONTS[t.display];
  const reward = d.rewardAmount || c.rewardPerPost;
  const benefits = benefitsOf(d);
  const tiers = tiersOf(d, c);
  const sectionTitle = (s) => `<div style="font-weight:800;font-size:46px;letter-spacing:-.02em;color:${t.ink};margin:0 0 28px;display:flex;align-items:center;gap:18px"><span style="width:26px;height:26px;border-radius:9px;background:${t.primary};transform:rotate(45deg);display:inline-block"></span>${esc(s)}</div>`;
  const el = document.createElement('div');
  el.style.cssText = `width:1080px;font-family:'Pretendard Variable',sans-serif;background:#fff;color:${t.ink};box-sizing:border-box`;
  el.innerHTML = `
    <div style="background:radial-gradient(120% 80% at 50% -10%, ${t.heroBg2}, ${t.heroBg});color:#fff;padding:80px 70px 90px;text-align:center;position:relative;overflow:hidden;border-radius:0 0 56px 56px">
      <div style="position:absolute;top:-50px;right:-30px;width:260px;height:260px;border-radius:50%;background:${t.primary};opacity:.3"></div>
      <div style="display:flex;gap:16px;justify-content:center;margin-bottom:36px;position:relative">
        ${reward ? `<span style="font-weight:800;font-size:28px;padding:13px 28px;border-radius:999px;background:${t.pop};color:${t.popInk}">활동비 지급</span>` : ''}
        <span style="font-weight:700;font-size:28px;padding:13px 28px;border-radius:999px;background:rgba(255,255,255,.16)">${esc(c.totalRounds || 10)}주 과정</span>
      </div>
      <div style="background:#fff;border-radius:40px;padding:48px;max-width:840px;margin:0 auto;box-shadow:0 24px 60px rgba(0,0,0,.28)">
        <div style="color:${t.primary};font-weight:800;font-size:32px;margin-bottom:16px">${esc(tagOf(c, d))}</div>
        <div style="font-family:${disp};color:${t.heroBg};font-size:88px;line-height:1.08">${esc(c.name)}</div>
      </div>
      <div style="margin-top:36px;font-size:32px;font-weight:700;line-height:1.5;color:rgba(255,255,255,.92)">${esc(hookOf(d))}</div>
    </div>
    <div style="padding:64px 70px 80px">
      ${benefits.length ? `<div style="background:${t.heroBg};color:#fff;border-radius:32px;padding:48px;margin-bottom:48px">
        <div style="font-weight:800;font-size:42px;margin-bottom:30px;display:flex;align-items:center;gap:16px"><span style="width:22px;height:22px;border-radius:8px;background:${t.pop};transform:rotate(45deg);display:inline-block"></span>참가 혜택</div>
        ${benefits.slice(0, 5).map((b) => `<div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:22px"><span style="width:40px;height:40px;flex:none;border-radius:50%;background:${t.pop};color:${t.popInk};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px">✓</span><span style="font-size:32px;line-height:1.45;padding-top:3px">${esc(b)}</span></div>`).join('')}
      </div>` : ''}
      ${tiers.length ? `<div style="background:${t.heroBg};color:#fff;border-radius:32px;padding:48px;margin-bottom:48px">
        <div style="font-weight:800;font-size:42px;margin-bottom:24px;display:flex;align-items:center;gap:16px"><span style="width:22px;height:22px;border-radius:8px;background:${t.pop};transform:rotate(45deg);display:inline-block"></span>리워드</div>
        ${tiers.map((r) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:22px 0;border-bottom:2px solid rgba(255,255,255,.14)"><span style="font-size:32px;color:rgba(255,255,255,.92)">${esc(r.range)} 작성</span><b style="font-size:40px;color:${t.pop};font-variant-numeric:tabular-nums">${Number(r.amount).toLocaleString()}P</b></div>`).join('')}
        <div style="margin-top:22px;font-size:26px;color:rgba(255,255,255,.7)">작성 개수가 많을수록 ↑ · 우수활동자 ×2</div>
      </div>` : ''}
      <div style="text-align:center;margin-top:16px">
        <div style="font-weight:800;font-size:40px;color:${t.ink};margin-bottom:24px">지금 신청하세요</div>
        <div style="display:inline-block;background:${t.primary};color:#fff;font-weight:800;font-size:36px;padding:28px 64px;border-radius:20px">참가 신청하기 →</div>
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
