/* API client + human-authority session (Iron Invariant 1). */

const TOKEN_KEY = 'partnerflow.session';

export const session = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get approver() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY + '.who') || 'null'); } catch { return null; }
  },
  set(token, approver) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY + '.who', JSON.stringify(approver));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY + '.who');
  }
};

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

async function call(method, path, body, opts = {}) {
  const headers = {};
  let payload;
  if (body !== undefined && body !== null) {
    if (body instanceof FormData) { payload = body; }
    else { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  }
  const token = session.token;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { method, headers, body: payload, signal: opts.signal });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { ok: false, error: { code: 'BAD_RESPONSE', message: text.slice(0, 400) } }; }

  if (!res.ok || (data && data.ok === false)) {
    const e = data && data.error ? data.error : { code: `HTTP_${res.status}`, message: res.statusText };
    throw new ApiError(res.status, e.code, e.message, data || {});
  }
  return data;
}

export const api = {
  get: (p, o) => call('GET', p, null, o),
  post: (p, b, o) => call('POST', p, b ?? {}, o),
  patch: (p, b, o) => call('PATCH', p, b ?? {}, o),
  del: (p, b, o) => call('DELETE', p, b ?? {}, o),

  health: () => call('GET', '/api/health'),
  config: () => call('GET', '/api/config'),
  stats: () => call('GET', '/api/stats'),
  submissions: (params = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '' && v !== 'all') q.set(k, v);
    return call('GET', `/api/submissions?${q}`);
  },
  submission: (id) => call('GET', `/api/submissions/${encodeURIComponent(id)}`),
  createSubmission: (body) => call('POST', '/api/submissions', body),
  deleteSubmission: (id, body) => call('DELETE', `/api/submissions/${encodeURIComponent(id)}`, body),
  clarify: (id, body) => call('POST', `/api/submissions/${encodeURIComponent(id)}/clarify`, body),
  decide: (id, action, body) => call('POST', `/api/submissions/${encodeURIComponent(id)}/${action}`, body),
  reprocess: (id) => call('POST', `/api/submissions/${encodeURIComponent(id)}/reprocess`),
  addComment: (id, body) => call('POST', `/api/submissions/${encodeURIComponent(id)}/comments`, body),

  approvers: () => call('GET', '/api/approvers'),
  signIn: (email) => call('POST', '/api/session', { email }),
  signOut: () => call('POST', '/api/session/end'),
  whoami: () => call('GET', '/api/session'),

  ledger: (partnerId) => call('GET', `/api/ledger${partnerId ? `?partner_id=${encodeURIComponent(partnerId)}` : ''}`),
  transactions: () => call('GET', '/api/ledger/transactions'),
  brain: () => call('GET', '/api/brain'),
  partners: (q) => call('GET', `/api/partners${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  tiers: () => call('GET', '/api/tiers'),
  rules: () => call('GET', '/api/rules'),
  checklist: (tier, type) => {
    const q = new URLSearchParams();
    if (tier) q.set('tier', tier);
    q.set('type', type || 'CLAIM');
    return call('GET', `/api/checklist?${q}`);
  },
  agents: () => call('GET', '/api/agents'),
  dashboards: () => call('GET', '/api/dashboards'),
  audit: (params = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    return call('GET', `/api/audit?${q}`);
  },
  setup: () => call('GET', '/api/setup'),
  saveSetup: (body) => call('POST', '/api/setup', body),
  patchTier: (id, body) => call('PATCH', `/api/brain/tiers/${encodeURIComponent(id)}`, body),
  ragSearch: (q, k) => call('GET', `/api/rag/search?q=${encodeURIComponent(q)}&k=${k || 8}`),
  ragAsk: (question, k) => call('POST', '/api/rag/ask', { question, k }),
  reindex: () => call('POST', '/api/brain/reindex')
};
