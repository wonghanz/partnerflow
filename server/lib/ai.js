/**
 * Pluggable LLM provider adapter (OpenAI-compatible /chat/completions).
 *
 * Credentials are resolved at runtime from server/.env or the process
 * environment and are never logged, echoed or returned by status().
 * When no provider is configured the module reports `available: false` and
 * every caller degrades gracefully to deterministic, corpus-grounded output.
 */

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

let envCache = null;
function env() {
  if (envCache) return envCache;
  envCache = {};
  try {
    const raw = fs.readFileSync(ENV_PATH, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      envCache[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env — fall back to process env only */ }
  return envCache;
}

function pick(...names) {
  const e = env();
  for (const n of names) {
    const v = e[n] || process.env[n];
    if (v && String(v).trim() && !/^(changeme|your[_-]?key|xxx+|<.*>)$/i.test(String(v).trim())) return String(v).trim();
  }
  return null;
}

function resolve() {
  const apiKey = pick('PARTNERFLOW_LLM_API_KEY', 'OPENAI_API_KEY', 'LLM_API_KEY', 'GROQ_API_KEY', 'DEEPSEEK_API_KEY', 'MOONSHOT_API_KEY');
  const baseURL = pick('PARTNERFLOW_LLM_BASE_URL', 'OPENAI_BASE_URL', 'LLM_BASE_URL') || 'https://api.openai.com/v1';
  const model = pick('PARTNERFLOW_LLM_MODEL', 'OPENAI_MODEL', 'LLM_MODEL') || 'gpt-4o-mini';
  return { apiKey, baseURL: baseURL.replace(/\/+$/, ''), model };
}

function status() {
  const { apiKey, baseURL, model } = resolve();
  return {
    available: !!apiKey,
    provider: apiKey ? 'openai-compatible' : 'none',
    model: apiKey ? model : null,
    base_url: apiKey ? baseURL : null,
    reason: apiKey ? null : 'NO_PROVIDER_CONFIGURED — add PARTNERFLOW_LLM_API_KEY to server/.env to enable grounded generation; retrieval stays fully functional without it.',
    env_file_present: fs.existsSync(ENV_PATH)
  };
}

async function chat(messages, { temperature = 0.2, max_tokens = 1500 } = {}) {
  const { apiKey, baseURL, model } = resolve();
  if (!apiKey) throw new Error('LLM_PROVIDER_UNAVAILABLE');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature, max_tokens }),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM_HTTP_${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    const text = msg?.content || msg?.reasoning_content;
    if (!text) throw new Error('LLM_EMPTY_RESPONSE');
    return String(text).trim();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { status, chat, resolve };
