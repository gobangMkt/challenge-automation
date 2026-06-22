#!/usr/bin/env node
// 텔레그램 알림/승인 CLI 헬퍼.
// 토큰은 ~/.claude/.telegram (JSON: {botToken, chatId})에서 읽는다. 코드/깃에 값 금지.
// 서브커맨드:
//   node scripts/telegram.mjs notify "<text>"
//   node scripts/telegram.mjs wait-approval [timeoutSec]
// 일반 node 스크립트라 Date.now()/setTimeout 사용 OK.

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
// 포맷 함수는 다른 스크립트가 import해 쓰도록 재노출
export { formatVocApproval, formatDone } from './lib/telegram-format.js';

const CONFIG_PATH = join(homedir(), '.claude', '.telegram');
const API = 'https://api.telegram.org';

async function loadConfig() {
  let raw;
  try {
    raw = await readFile(CONFIG_PATH, 'utf8');
  } catch {
    console.error(
      `텔레그램 설정 파일이 없습니다: ${CONFIG_PATH}\n` +
        `아래 형태로 생성하세요 (scripts/.telegram.example.json 참고):\n` +
        `  {"botToken":"<봇토큰>","chatId":"<채팅ID>"}`,
    );
    process.exit(1);
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch {
    console.error(`텔레그램 설정 파일이 올바른 JSON이 아닙니다: ${CONFIG_PATH}`);
    process.exit(1);
  }
  if (!cfg.botToken || !cfg.chatId) {
    console.error(`텔레그램 설정에 botToken/chatId가 비어 있습니다: ${CONFIG_PATH}`);
    process.exit(1);
  }
  return cfg;
}

async function tgCall(botToken, method, params) {
  const res = await fetch(`${API}/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`telegram ${method} 실패: ${JSON.stringify(data)}`);
  return data.result;
}

async function notify(text) {
  if (!text) {
    console.error('전송할 텍스트가 없습니다. 사용법: telegram.mjs notify "<text>"');
    process.exit(1);
  }
  const { botToken, chatId } = await loadConfig();
  await tgCall(botToken, 'sendMessage', { chat_id: chatId, text });
  console.log('sent');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// getUpdates 폴링으로 '승인'/'반려' 감지. 결과를 stdout에 출력.
async function waitApproval(timeoutSec) {
  const { botToken } = await loadConfig();
  const deadline = Date.now() + timeoutSec * 1000;
  let offset = 0;
  // 시작 시점 이전의 누적 업데이트는 무시 (최신 offset부터)
  const init = await tgCall(botToken, 'getUpdates', { timeout: 0 });
  if (init.length) offset = init[init.length - 1].update_id + 1;

  while (Date.now() < deadline) {
    const updates = await tgCall(botToken, 'getUpdates', { offset, timeout: 0 });
    for (const u of updates) {
      offset = u.update_id + 1;
      const text = u.message?.text ?? '';
      if (text.includes('승인')) {
        console.log('approved');
        return;
      }
      if (text.includes('반려')) {
        console.log('rejected');
        return;
      }
    }
    await sleep(2000);
  }
  console.log('timeout');
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'notify') {
    await notify(arg);
  } else if (cmd === 'wait-approval') {
    const timeoutSec = Number(arg) > 0 ? Number(arg) : 300;
    await waitApproval(timeoutSec);
  } else {
    console.error(
      '사용법:\n' +
        '  node scripts/telegram.mjs notify "<text>"\n' +
        '  node scripts/telegram.mjs wait-approval [timeoutSec]',
    );
    process.exit(1);
  }
}

// 직접 실행 시에만 main 동작 (import 시에는 포맷 함수만 노출)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('telegram.mjs')) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
