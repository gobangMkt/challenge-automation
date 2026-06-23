#!/usr/bin/env node
// VoC 데몬 — 텔레그램 폴링 → "처리" 명령 감지 → Claude Code 파이프라인 자동 실행
// 실행: OPERATOR_TOKEN=gobangMKT node scripts/voc-daemon.mjs
// 또는: node scripts/voc-daemon.mjs <OPERATOR_TOKEN>

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, '..');
const CONFIG_PATH = join(homedir(), '.claude', '.telegram');
const API = 'https://api.telegram.org';
const POLL_INTERVAL_MS = 5000;
const HEALTH_PORT = 3061;
const startedAt = new Date().toISOString();

async function loadConfig() {
  const raw = await readFile(CONFIG_PATH, 'utf8');
  const cfg = JSON.parse(raw);
  if (!cfg.botToken || !cfg.chatId) throw new Error('botToken/chatId 누락');
  return cfg;
}

async function tgCall(botToken, method, params = {}) {
  const res = await fetch(`${API}/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`telegram ${method}: ${JSON.stringify(data)}`);
  return data.result;
}

async function send(botToken, chatId, text) {
  await tgCall(botToken, 'sendMessage', { chat_id: chatId, text });
}

async function fetchVocs(vocEndpoint, operatorToken, status) {
  try {
    const url = `${vocEndpoint}?action=getVoc&status=${status}&token=${operatorToken}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.ok ? (data.items || []) : [];
  } catch {
    return [];
  }
}

// updateVoc로 상태 전이(예: queued → in_progress). 재선택 방지.
async function markStatus(vocEndpoint, operatorToken, id, status) {
  try {
    await fetch(vocEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'updateVoc', token: operatorToken, id, status }),
    });
  } catch { /* 전이 실패해도 파이프라인은 진행 */ }
}

function runPipeline(voc) {
  const project = voc.project || 'blog-challenge';
  const prompt =
    `voc-router를 호출해서 다음 VoC를 처리해줘.\n` +
    `ID: ${voc.id}\n내용: ${voc.message}\n카테고리: ${voc.category || '기타'}\nproject: ${project}\n\n` +
    `voc-router가 project로 담당 PO를 찾아 배정·개선안 작성, 텔레그램 승인 요청까지 진행해.`;

  return new Promise((resolve) => {
    console.log(`[voc-daemon] 파이프라인 시작: ${voc.id}`);
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY; // claude.ai 로그인 사용 (API 키 우선순위 제거)
    const proc = spawn('claude', ['--dangerously-skip-permissions', '-p', prompt], {
      cwd: PROJECT_DIR,
      stdio: 'inherit',
      shell: true,
      env,
    });
    proc.on('error', (e) => {
      console.error('[voc-daemon] claude 실행 오류:', e.message);
      resolve();
    });
    proc.on('close', (code) => {
      console.log(`[voc-daemon] 파이프라인 종료 (exit=${code})`);
      resolve();
    });
  });
}

function startHealthServer() {
  const srv = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, uptime: Math.floor(process.uptime()), startedAt }));
    } else if (req.url === '/stop' && req.method === 'POST') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      setTimeout(() => process.exit(0), 100);
    } else {
      res.writeHead(404);
      res.end('{}');
    }
  });
  srv.listen(HEALTH_PORT, '127.0.0.1');
}

async function main() {
  const operatorToken = process.env.OPERATOR_TOKEN || process.argv[2];
  if (!operatorToken) {
    console.error(
      'OPERATOR_TOKEN이 필요합니다.\n' +
      '실행: OPERATOR_TOKEN=gobangMKT node scripts/voc-daemon.mjs',
    );
    process.exit(1);
  }

  const { botToken, chatId } = await loadConfig();

  // config.js에서 GAS 엔드포인트 읽기
  const configJs = await readFile(join(PROJECT_DIR, 'public', 'js', 'config.js'), 'utf8');
  const match = configJs.match(/GAS_ENDPOINT:\s*'([^']+)'/);
  if (!match) {
    console.error('config.js에서 GAS_ENDPOINT를 읽을 수 없습니다.');
    process.exit(1);
  }
  const gasEndpoint = match[1];
  // VoC 엔드포인트: 전용 VoC GAS(분리 후). 미지정 시 기존 blog-challenge GAS로 폴백.
  const vocEndpoint = process.env.VOC_GAS_ENDPOINT || gasEndpoint;

  // 시작 시점 이전 업데이트 무시
  let offset = 0;
  const init = await tgCall(botToken, 'getUpdates', { timeout: 0 });
  if (init.length) offset = init[init.length - 1].update_id + 1;

  startHealthServer();
  console.log(`[voc-daemon] 시작. 텔레그램 폴링 중... (health: http://127.0.0.1:${HEALTH_PORT}/health)`);
  await send(botToken, chatId,
    '🤖 VoC 데몬 시작\n새 신고 접수 시 알림드립니다.\n처리 명령: "처리" 또는 "voc_xxx 처리"',
  );

  while (true) {
    try {
      const updates = await tgCall(botToken, 'getUpdates', { offset, timeout: 0 });

      for (const u of updates) {
        offset = u.update_id + 1;
        const text = (u.message?.text ?? '').trim();
        if (!text) continue;

        const isProcess = /처리/.test(text);
        if (!isProcess) continue;

        // 특정 VoC ID 지정 여부 확인
        const idMatch = text.match(/(voc_\d+_\d+)/i);
        const vocs = await fetchVocs(vocEndpoint, operatorToken, 'new');

        let target = null;
        if (idMatch) {
          target = vocs.find((v) => v.id === idMatch[1]) ?? null;
        } else {
          // 가장 최근 new VoC
          target = vocs[vocs.length - 1] ?? null;
        }

        if (!target) {
          await send(botToken, chatId, '⚠️ 처리할 VoC가 없습니다. 시트를 확인해주세요.');
          continue;
        }

        await send(botToken, chatId,
          `⚙️ 처리 시작\nID: ${target.id}\n내용: ${target.message}\n\nClaude Code가 파이프라인을 실행합니다. 잠시 후 승인 요청이 옵니다.`,
        );

        // claude 실행 중엔 폴링 중단 → wait-approval과 충돌 방지
        await runPipeline(target);

        await send(botToken, chatId, `✅ 파이프라인 종료: ${target.id}`);
      }

      // 대시보드 "처리" 버튼 → 시트 status=queued. 데몬이 감지해 자동 실행.
      const queued = await fetchVocs(vocEndpoint, operatorToken, 'queued');
      for (const target of queued) {
        await markStatus(vocEndpoint, operatorToken, target.id, 'in_progress');
        await send(botToken, chatId,
          `⚙️ 대시보드 처리 시작\nID: ${target.id}\n서비스: ${target.project || '-'}\n내용: ${target.message}`,
        );
        await runPipeline(target);
        await send(botToken, chatId, `✅ 파이프라인 종료: ${target.id}`);
      }
    } catch (e) {
      console.error('[voc-daemon] 오류:', e.message);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error('[voc-daemon] 치명적 오류:', e.message);
  process.exit(1);
});
