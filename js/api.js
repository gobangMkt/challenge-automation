import { CONFIG } from './config.js';

const configured = () => CONFIG.GAS_ENDPOINT && !CONFIG.GAS_ENDPOINT.startsWith('PASTE_');

// GAS는 application/json POST 시 CORS preflight 문제가 있어 text/plain으로 보낸다.
export async function apiPost(payload) {
  if (!configured()) throw new Error('GAS_ENDPOINT 미설정');
  const res = await fetch(CONFIG.GAS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function apiGet(params) {
  if (!configured()) throw new Error('GAS_ENDPOINT 미설정');
  const url = new URL(CONFIG.GAS_ENDPOINT);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

export async function submitVoc({ project, message, phone }) {
  return apiPost({ action: 'submitVoc', project, message, phone });
}

export const isConfigured = configured;
