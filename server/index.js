/**
 * PartnerFlow — zero-dependency localhost server.
 *
 * Serves the glassmorphism SPA from ./public and a REST API backed by a JSON
 * datastore. All business logic (Agent 3 rules, Agent 4 four-state ledger,
 * state machine, immutable audit trail) is deterministic code compiled from
 * the source documentation; all business *content* (policies, tiers, rules,
 * partners, cases, memos) is AI-authored into ./data.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const store = require('./lib/store');
const ledger = require('./lib/ledger');
const rules = require('./lib/rules');
const rag = require('./lib/rag');
const ai = require('./lib/ai');
const upload = require('./lib/upload');
const pdf = require('./lib/pdf');
const P = require('./lib/pipeline');
const db = require('./lib/db');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '127.0.0.1';

/* ------------------------------------------------------------------ */
/* Human authority session (Iron Invariant 1)                          */
/* ------------------------------------------------------------------ */

const SESSION_SECRET = crypto.randomBytes(32);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();

function approvers() {
  const config = store.read('config.json');
  const list = Array.isArray(config.approvers) && config.approvers.length
    ? config.approvers
    : (config.operator ? [config.operator] : []);
  return list.map((a) => ({
    name: a.name, email: a.email, role: a.role,
    approval_limit: a.approval_limit ?? null,
    can_final_approve: a.can_final_approve !== false
  }));
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  if (!sessions.has(payload.sid)) return null;
  return payload;
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.map': 'application/json; charset=utf-8', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8'
};

function send(res, status, payload, headers = {}) {
  const isBuffer = Buffer.isBuffer(payload);
  const body = isBuffer ? payload
    : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2), 'utf8');
  const type = isBuffer ? (headers['Content-Type'] || 'application/octet-stream')
    : typeof payload === 'string' ? (headers['Content-Type'] || 'text/plain; charset=utf-8')
      : 'application/json; charset=utf-8';
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    ...headers
  });
  res.end(body);
}

function fail(res, status, code, message, extra = {}) {
  send(res, status, { ok: false, error: { code, message }, ...extra });
}

function serveStatic(res, urlPath) {
  const rel = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const root = path.resolve(PUBLIC_DIR);
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) {
    return fail(res, 403, 'PATH_TRAVERSAL_BLOCKED', 'Request path escapes the public root.');
  }
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) {
      const index = path.join(root, 'index.html');
      if (!fs.existsSync(index)) return fail(res, 404, 'NOT_FOUND', `No resource at /${rel}`);
      const html = fs.readFileSync(index);
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Content-Length': html.length, 'Cache-Control': 'no-store' });
      return res.end(html);
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
    fs.createReadStream(full).pipe(res);
  });
}

function readJson(req, limit = 32 * 1024 * 1024) {
  return upload.readBody(req, limit).then((buf) => {
    if (!buf.length) return {};
    const ct = String(req.headers['content-type'] || '');
    if (ct.startsWith('multipart/form-data')) {
      // Field values are flattened to the top level so the same handler serves JSON and
      // form uploads; file `data` stays a Buffer, which is why base64-in-JSON is lossy.
      const { fields, files } = upload.parseMultipart(buf, ct);
      return { ...fields, files };
    }
    try { return JSON.parse(buf.toString('utf8')); } catch { throw Object.assign(new Error('INVALID_JSON_BODY'), { status: 400 }); }
  });
}

/* ------------------------------------------------------------------ */
/* Data readiness                                                      */
/* ------------------------------------------------------------------ */

const REQUIRED_DATA = ['config.json', 'tiers.json', 'rules.json', 'partners.json', 'ledger.json', 'brain.json'];

function readiness() {
  const present = {};
  const missing = [];
  for (const f of REQUIRED_DATA) {
    const ok = store.exists(f);
    present[f] = ok;
    if (!ok) missing.push(f);
  }
  return { ready: missing.length === 0, missing, present, ai_provider: ai.status(), rag: rag.stats() };
}

function submissions() {
  return store.read('submissions.json').filter((s) => !s.deleted);
}

function saveSubmissions(list) {
  const all = store.read('submissions.json');
  const byId = new Map(all.map((s) => [s.submission_id, s]));
  for (const s of list) byId.set(s.submission_id, s);
  store.write('submissions.json', [...byId.values()]);
}

function comments() { return store.read('comments.json'); }

/* ------------------------------------------------------------------ */
/* Stats — computed live from the ledger of submissions                */
/* ------------------------------------------------------------------ */

function computeStats() {
  const list = submissions();
  const by = (pred) => list.filter(pred).length;
  const sum = (pred) => list.filter(pred).reduce((a, s) => a + Number(s.amount || 0), 0);
  const accepted = by((s) => ['APPROVED', 'PAID', 'ARCHIVED'].includes(s.state));
  const rejected = by((s) => ['REJECTED', 'POLICY_BLOCKED', 'BUDGET_REJECTED', 'SECURITY_QUARANTINE'].includes(s.state));
  const pending = list.length - accepted - rejected;

  const byTier = {};
  const byState = {};
  const byType = {};
  for (const s of list) {
    const t = s.partner_tier || 'Unassigned';
    byTier[t] = byTier[t] || { tier: t, count: 0, amount: 0 };
    byTier[t].count += 1; byTier[t].amount += Number(s.amount || 0);
    byState[s.state] = (byState[s.state] || 0) + 1;
    const ty = s.submission_type || 'CLAIM';
    byType[ty] = byType[ty] || { type: ty, count: 0, amount: 0 };
    byType[ty].count += 1; byType[ty].amount += Number(s.amount || 0);
  }

  const ageing = list.filter((s) => s.ui_status === 'pending');
  const slaBreached = ageing.filter((s) => s.sla_breached).length;
  const avgAgeing = ageing.length ? rules.round2(ageing.reduce((a, s) => a + (s.ageing_days || 0), 0) / ageing.length) : 0;

  return {
    cards: [
      { key: 'total', label: 'Total Submissions', value: list.length, accent: 'brand' },
      { key: 'accepted', label: 'Accepted', value: accepted, accent: 'approved', amount: rules.round2(sum((s) => ['APPROVED', 'PAID', 'ARCHIVED'].includes(s.state))) },
      { key: 'pending', label: 'Pending', value: pending, accent: 'pending', amount: rules.round2(sum((s) => !['APPROVED', 'PAID', 'ARCHIVED', 'REJECTED', 'POLICY_BLOCKED', 'BUDGET_REJECTED', 'SECURITY_QUARANTINE'].includes(s.state))) },
      { key: 'rejected', label: 'Rejected', value: rejected, accent: 'rejected', amount: rules.round2(sum((s) => ['REJECTED', 'POLICY_BLOCKED', 'BUDGET_REJECTED', 'SECURITY_QUARANTINE'].includes(s.state))) }
    ],
    totals: {
      total: list.length, accepted, pending, rejected,
      declared_amount: rules.round2(sum(() => true)),
      approved_amount: rules.round2(sum((s) => ['APPROVED', 'PAID', 'ARCHIVED'].includes(s.state))),
      sla_breached: slaBreached,
      average_ageing_days: avgAgeing
    },
    by_tier: Object.values(byTier).map((t) => ({ ...t, amount: rules.round2(t.amount) })),
    by_state: byState,
    by_type: Object.values(byType).map((t) => ({ ...t, amount: rules.round2(t.amount) })),
    states: P.STATES,
    ui_status_map: P.UI_STATUS
  };
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

async function route(req, res, url) {
  const method = req.method.toUpperCase();
  const p = url.pathname.replace(/\/+$/, '') || '/';

  /* ---- health / readiness ---- */
  if (method === 'GET' && p === '/api/health') {
    return send(res, 200, { ok: true, service: 'partnerflow', uptime_s: Math.round(process.uptime()), node: process.version, ...readiness() });
  }

  if (method === 'GET' && p === '/api/config') {
    const c = store.read('config.json');
    return send(res, 200, { ok: true, config: c, approvers: approvers(), ai: ai.status() });
  }

  /* ---- direct SQL execution endpoint (SQLite engine) ---- */
  if (method === 'POST' && p === '/api/sql') {
    const body = await readJson(req);
    const sqlQuery = String(body.query || '').trim();
    if (!sqlQuery) return fail(res, 400, 'EMPTY_QUERY', 'SQL query cannot be empty.');
    try {
      const isSelect = /^\s*SELECT/i.test(sqlQuery);
      if (isSelect) {
        const rows = db.query(sqlQuery);
        return send(res, 200, { ok: true, is_select: true, count: rows.length, rows });
      } else {
        db.execute(sqlQuery);
        return send(res, 200, { ok: true, is_select: false, message: 'Statement executed and database synchronized.' });
      }
    } catch (err) {
      return fail(res, 400, 'SQL_EXECUTION_ERROR', err.message);
    }
  }

  /* ---- session (human authority) ---- */
  if (method === 'GET' && p === '/api/approvers') {
    return send(res, 200, { ok: true, approvers: approvers() });
  }

  if (method === 'POST' && p === '/api/session') {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const match = approvers().find((a) => String(a.email || '').toLowerCase() === email);
    if (!match) return fail(res, 401, 'UNKNOWN_APPROVER', 'No authorised approver matches that email. Iron Invariant 1: final approval authority is never delegated to an AI agent.');
    const sid = crypto.randomBytes(8).toString('hex');
    const exp = Date.now() + SESSION_TTL_MS;
    sessions.set(sid, { email, exp });
    const token = sign({ sid, email, name: match.name, role: match.role, approval_limit: match.approval_limit, exp });
    P.appendAudit({
      submission_id: null, run_id: null, actor: match.email, actor_type: 'HUMAN_APPROVER',
      previous_state: null, new_state: null, error_code: null, rule_id: null, evidence_refs: [],
      details: { event: 'SESSION_ISSUED', role: match.role, expires_at: new Date(exp).toISOString() }, rule_version: null
    });
    return send(res, 200, { ok: true, token, expires_at: new Date(exp).toISOString(), approver: match });
  }

  if (method === 'POST' && p === '/api/session/end') {
    const s = verify(bearer(req));
    if (s) sessions.delete(s.sid);
    return send(res, 200, { ok: true });
  }

  if (method === 'GET' && p === '/api/session') {
    const s = verify(bearer(req));
    if (!s) return send(res, 200, { ok: true, authenticated: false });
    const a = approvers().find((x) => String(x.email).toLowerCase() === s.email);
    return send(res, 200, { ok: true, authenticated: true, approver: a || { email: s.email, name: s.email }, expires_at: new Date(s.exp).toISOString() });
  }

  /* ---- listing history ---- */
  if (method === 'GET' && p === '/api/stats') return send(res, 200, { ok: true, ...computeStats() });

  if (method === 'GET' && p === '/api/submissions') {
    const q = url.searchParams;
    let list = submissions();
    const status = q.get('status');
    const type = q.get('type');
    const tier = q.get('tier');
    const search = (q.get('q') || '').trim().toLowerCase();
    const state = q.get('state');
    if (status && status !== 'all') list = list.filter((s) => s.ui_status === status);
    if (state && state !== 'all') list = list.filter((s) => s.state === state);
    if (type && type !== 'all') list = list.filter((s) => (s.submission_type || '').toUpperCase() === type.toUpperCase());
    if (tier && tier !== 'all') list = list.filter((s) => (s.partner_tier || 'Unassigned') === tier);
    if (search) {
      list = list.filter((s) => JSON.stringify({
        id: s.submission_id, name: s.partner_name, tier: s.partner_tier, title: s.title,
        activity: s.activity_type, state: s.state, invoices: s.invoice_numbers, amount: s.amount
      }).toLowerCase().includes(search));
    }
    const sort = q.get('sort') || 'newest';
    list.sort((a, b) => sort === 'oldest'
      ? String(a.submitted_at).localeCompare(String(b.submitted_at))
      : sort === 'amount_desc' ? Number(b.amount || 0) - Number(a.amount || 0)
        : sort === 'amount_asc' ? Number(a.amount || 0) - Number(b.amount || 0)
          : String(b.submitted_at).localeCompare(String(a.submitted_at)));

    const limit = Math.min(Number(q.get('limit') || 200), 500);
    const page = Math.max(Number(q.get('page') || 1), 1);
    const total = list.length;
    const slice = list.slice((page - 1) * limit, page * limit);
    return send(res, 200, { ok: true, total, page, limit, pages: Math.ceil(total / limit) || 1, submissions: slice.map(cardView) });
  }

  const detail = p.match(/^\/api\/submissions\/([^/]+)$/);
  if (detail && method === 'GET') {
    const s = submissions().find((x) => x.submission_id === detail[1]);
    if (!s) return fail(res, 404, 'SUBMISSION_NOT_FOUND', `No submission with id ${detail[1]}`);
    const cmts = comments().filter((c) => c.submission_id === s.submission_id);
    const audit = store.read('audit-events.json').filter((e) => e.submission_id === s.submission_id);
    const txs = store.read('budget-transactions.json').filter((t) => t.submission_id === s.submission_id);
    const clar = store.read('clarifications.json').filter((c) => c.submission_id === s.submission_id);
    let budget = null;
    try { budget = ledger.snapshot(s.partner_id, store.read('config.json').org?.fiscal_year); } catch { budget = null; }
    return send(res, 200, { ok: true, submission: s, comments: cmts, audit_events: audit, budget_transactions: txs, clarifications: clar, budget_snapshot: budget });
  }

  if (detail && method === 'DELETE') {
    const actor = verify(bearer(req));
    const body = await readJson(req);
    const confirm = String(body.confirm_text || body.confirmText || '');
    const all = store.read('submissions.json');
    const s = all.find((x) => x.submission_id === detail[1] && !x.deleted);
    if (!s) return fail(res, 404, 'SUBMISSION_NOT_FOUND', `No active submission with id ${detail[1]}`);
    if (confirm && confirm !== s.submission_id && confirm !== 'DELETE') {
      return fail(res, 400, 'CONFIRM_TEXT_MISMATCH', 'Confirmation text does not match the submission id.');
    }
    s.deleted = true;
    s.deleted_at = P.nowISO ? P.nowISO() : new Date().toISOString();
    s.deleted_by = actor ? actor.email : (body.operator_email || 'unknown');
    store.write('submissions.json', all);
    P.appendAudit({
      submission_id: s.submission_id, run_id: s.run_id, actor: s.deleted_by, actor_type: actor ? 'HUMAN_APPROVER' : 'HUMAN',
      previous_state: s.state, new_state: s.state, error_code: null, rule_id: null, evidence_refs: [],
      details: { event: 'SOFT_DELETE', reason: body.reason || null }, rule_version: s.rule_version
    });
    return send(res, 200, { ok: true, submission_id: s.submission_id, deleted: true, note: 'Soft delete only — the immutable audit trail is preserved (Iron Invariant 4).' });
  }

  /* ---- create submission: runs the real Agent 1-7 pipeline ---- */
  if (method === 'POST' && p === '/api/submissions') {
    const rd = readiness();
    if (!rd.ready) return fail(res, 503, 'DATA_NOT_READY', `Company Brain corpus still initialising. Missing: ${rd.missing.join(', ')}`, rd);

    const body = await readJson(req);
    const rawFileList = Array.isArray(body.files) ? body.files : (Array.isArray(body.attachments) ? body.attachments : []);
    const files = rawFileList.map((f) => {
      let data;
      const raw = f.data !== undefined && f.data !== null ? f.data : (f.base64 !== undefined && f.base64 !== null ? f.base64 : f.content);
      if (Buffer.isBuffer(raw)) {
        data = raw;
      } else if (typeof raw === 'string') {
        if (raw.startsWith('JVBERi') || /^[A-Za-z0-9+/=]{40,}$/.test(raw.replace(/\s+/g, ''))) {
          data = Buffer.from(raw, 'base64');
        } else if (raw.startsWith('%PDF-')) {
          data = Buffer.from(raw, 'latin1');
        } else {
          data = Buffer.from(raw, 'utf8');
        }
      } else {
        data = Buffer.from('');
      }
      const saved = store.saveUpload(data, f.filename || 'upload.bin');
      const parsed = pdf.parse(data, f.filename || '');
      return {
        doc_id: `doc_${parsed.sha256.slice(0, 8)}`,
        filename: f.filename || 'upload.bin',
        category: f.category || null,
        mime: f.mime || f.content_type || 'application/pdf',
        size_bytes: data.length,
        sha256: parsed.sha256,
        stored: saved.stored,
        // Real parse output — declared_confidence stays undefined so Agent 1 uses
        // the cross-consistency score computed from the document itself.
        declared_confidence: typeof f.declared_confidence === 'number' ? f.declared_confidence : undefined,
        parsed_confidence: typeof parsed.amount_confidence === 'number' ? parsed.amount_confidence : undefined,
        parsed_amount: parsed.parsed_amount,
        parse_engine: parsed.parse_engine,
        confidence_basis: parsed.confidence_basis,
        invoice_numbers: parsed.invoice_numbers,
        dates_found: parsed.dates_found,
        text_preview: parsed.text_preview,
        scanned_image_only: parsed.scanned_image_only
      };
    });

    const existing = store.read('submissions.json');
    const config = store.read('config.json');
    const now = new Date().toISOString();
    const type = String(body.submission_type || 'CLAIM').toUpperCase();

    const sub = {
      submission_id: P.nextSubmissionId(existing),
      run_id: P.newRunId(),
      submission_type: type === 'PRE_APPROVAL' || type === 'PRE-APPROVAL' ? 'PRE_APPROVAL' : 'CLAIM',
      partner_id: String(body.partner_id || '').trim() || null,
      partner_name: body.partner_name || null,
      partner_tier: null,
      title: body.title || body.activity_type || 'Untitled submission',
      activity_type: body.activity_type || null,
      activity_date: body.activity_date || null,
      submitted_at: now,
      updated_at: now,
      amount: body.amount === '' || body.amount === undefined || body.amount === null ? null : Number(body.amount),
      currency: body.currency || config.org?.base_currency || 'MYR',
      invoice_numbers: Array.isArray(body.invoice_numbers) ? body.invoice_numbers : (body.invoice_numbers ? String(body.invoice_numbers).split(/[,\s]+/).filter(Boolean) : []),
      invoice_line_total: body.invoice_line_total === undefined || body.invoice_line_total === null || body.invoice_line_total === '' ? null : Number(body.invoice_line_total),
      parent_pre_approval_id: body.parent_pre_approval_id || null,
      bank_account: body.bank_account || null,
      contact_name: body.contact_name || null,
      contact_email: body.contact_email || null,
      submitted_by: body.submitted_by || body.contact_name || body.contact_email || 'partner_portal',
      notes: body.notes || null,
      amount_confidence: body.amount_confidence === undefined || body.amount_confidence === null || body.amount_confidence === '' ? null : Number(body.amount_confidence),
      attachments_count: files.length,
      state: 'SUBMITTED',
      ui_status: 'pending',
      rule_version: null,
      state_history: [],
      extracted_evidence: [],
      document_types: [],
      evidence_refs: [],
      source: 'web_submission_form',
      deleted: false
    };

    if (!sub.partner_id) return fail(res, 400, 'MISSING_REQUIRED_FIELD', 'partner_id is required — the system never guesses which partner a claim belongs to (Iron Invariant 3).');
    if (sub.amount === null && sub.submission_type === 'CLAIM') {
      // Zero auto-guessing: keep the record but let Agent 1 decide from the invoice.
      sub.amount = null;
    }

    existing.push(sub);
    store.write('submissions.json', existing);

    P.appendAudit({
      submission_id: sub.submission_id, run_id: sub.run_id, actor: sub.contact_email || 'partner_portal', actor_type: 'EXTERNAL_PARTNER',
      previous_state: null, new_state: 'SUBMITTED', error_code: null, rule_id: null, evidence_refs: [],
      details: { event: 'SUBMISSION_CREATED', attachments: files.map((f) => f.filename) }, rule_version: null
    });

    // If no amount was declared, take it from the highest-confidence invoice parse.
    try {
      await P.runPipeline(sub, { files });
    } catch (err) {
      sub.state = 'RECOVERABLE_ERROR';
      sub.ui_status = 'pending';
      sub.pipeline_error = { code: err.code || 'PIPELINE_ERROR', message: String(err.message || err) };
      P.appendAudit({
        submission_id: sub.submission_id, run_id: sub.run_id, actor: 'orchestrator', actor_type: 'SYSTEM_AGENT',
        previous_state: sub.state, new_state: 'RECOVERABLE_ERROR', error_code: 'PIPELINE_EXCEPTION', rule_id: null,
        evidence_refs: [], details: { message: String(err.message || err) }, rule_version: sub.rule_version
      });
    }
    saveSubmissions([sub]);
    return send(res, 201, { ok: true, submission: sub, message: 'Report submitted successfully!' });
  }

  /* ---- clarifications (Grill-Me resume, docs/02 §4) ---- */
  const clarify = p.match(/^\/api\/submissions\/([^/]+)\/clarify$/);
  if (clarify && method === 'POST') {
    const body = await readJson(req);
    const list = store.read('submissions.json');
    const sub = list.find((x) => x.submission_id === clarify[1] && !x.deleted);
    if (!sub) return fail(res, 404, 'SUBMISSION_NOT_FOUND', `No submission ${clarify[1]}`);
    if (sub.state !== 'NEEDS_CLARIFICATION') return fail(res, 409, 'INVALID_STATE', `Submission is in ${sub.state}; clarifications are only accepted while NEEDS_CLARIFICATION.`);

    const answers = body.answers || {};
    const records = store.read('clarifications.json');
    const open = sub.validation_result?.open_questions || [];
    for (const q of open) {
      const answer = answers[q.question_id];
      if (answer === undefined) continue;
      records.push({
        clarification_id: `CLR-${q.question_id}-${Date.now().toString(36)}`,
        submission_id: sub.submission_id, run_id: sub.run_id, question_id: q.question_id,
        question: q.question, answer, answered_by: body.answered_by || 'operations_officer',
        answered_at: new Date().toISOString(), status: 'RESOLVED'
      });
      if (q.field && answer !== null && answer !== '') {
        if (q.field === 'invoice_numbers') sub.invoice_numbers = Array.isArray(answer) ? answer : String(answer).split(/[,\s]+/).filter(Boolean);
        else sub[q.field] = answer;
      }
    }
    store.write('clarifications.json', records);
    sub.clarifications_resolved = (sub.clarifications_resolved || 0) + 1;

    P.transition(sub, 'NEEDS_CLARIFICATION', 'VALIDATING', {
      actor: body.answered_by || 'operations_officer', actor_type: 'HUMAN',
      details: { event: 'CLARIFICATION_RESUMED', answers: Object.keys(answers) }
    });
    try { await P.runPipeline(sub, { resumeFrom: 'VALIDATING' }); } catch (err) {
      sub.state = 'RECOVERABLE_ERROR';
      sub.pipeline_error = { code: 'PIPELINE_EXCEPTION', message: String(err.message || err) };
    }
    saveSubmissions([sub]);
    return send(res, 200, { ok: true, submission: sub });
  }

  /* ---- human decisions (Invariant 1: credential required) ---- */
  const decision = p.match(/^\/api\/submissions\/([^/]+)\/(approve|reject|mark-paid|release)$/);
  if (decision && method === 'POST') {
    const [, id, action] = decision;
    const actor = verify(bearer(req));
    if (!actor) {
      return fail(res, 401, 'HUMAN_AUTHORITY_REQUIRED',
        'Iron Invariant 1 — final approval authority is never delegated to an AI agent. Sign in as an authorised approver first (POST /api/session).');
    }
    const body = await readJson(req);
    const list = store.read('submissions.json');
    const sub = list.find((x) => x.submission_id === id && !x.deleted);
    if (!sub) return fail(res, 404, 'SUBMISSION_NOT_FOUND', `No submission ${id}`);

    const approver = approvers().find((a) => String(a.email).toLowerCase() === actor.email) || { email: actor.email, name: actor.email, approval_limit: null };
    const decisionAmount = body.approved_amount !== undefined && body.approved_amount !== null && body.approved_amount !== ''
      ? Number(body.approved_amount) : Number(sub.amount || 0);

    if (approver.approval_limit != null && decisionAmount > Number(approver.approval_limit)) {
      return fail(res, 403, 'DOA_LIMIT_EXCEEDED',
        `Delegation of Authority: ${approver.name || approver.email} may approve up to ${rules.fmt(approver.approval_limit, sub.currency)}; this decision is ${rules.fmt(decisionAmount, sub.currency)}. Escalate per the approval authority matrix.`);
    }

    let result;
    try {
      result = await P.applyHumanDecision(sub, action, {
        approver,
        approvedAmount: body.approved_amount,
        reason: body.reason || null,
        paymentReference: body.payment_reference || null
      });
    } catch (err) {
      return fail(res, 409, 'LEDGER_ERROR', String(err.message || err));
    }
    if (!result.ok) {
      return fail(res, result.code === 'INVALID_STATE' ? 409 : 400, result.code, result.message);
    }

    saveSubmissions([sub]);
    return send(res, 200, { ok: true, submission: sub });
  }

  /* ---- comments ---- */
  const comment = p.match(/^\/api\/submissions\/([^/]+)\/comments$/);
  if (comment && method === 'GET') {
    return send(res, 200, { ok: true, comments: comments().filter((c) => c.submission_id === comment[1]) });
  }
  if (comment && method === 'POST') {
    const body = await readJson(req);
    const text = String(body.text || '').trim();
    if (!text) return fail(res, 400, 'EMPTY_COMMENT', 'Comment body cannot be empty.');
    const subs = submissions();
    if (!subs.some((s) => s.submission_id === comment[1])) return fail(res, 404, 'SUBMISSION_NOT_FOUND', `No submission ${comment[1]}`);
    const actor = verify(bearer(req));
    const list = comments();
    const rec = {
      comment_id: `CMT-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      submission_id: comment[1],
      author: actor ? actor.email : (body.author || 'Operations Officer'),
      author_role: body.author_role || (actor ? actor.role : 'Operations Initial Reviewer'),
      text, created_at: new Date().toISOString(),
      commitment_filter: P.commitmentFilter(text)
    };
    list.push(rec);
    store.write('comments.json', list);
    P.appendAudit({
      submission_id: comment[1], run_id: null, actor: rec.author, actor_type: actor ? 'HUMAN_APPROVER' : 'HUMAN',
      previous_state: null, new_state: null, error_code: null, rule_id: null, evidence_refs: [],
      details: { event: 'COMMENT_ADDED', comment_id: rec.comment_id }, rule_version: null
    });
    return send(res, 201, { ok: true, comment: rec });
  }

  /* ---- reprocess (re-run the deterministic pipeline) ---- */
  const reprocess = p.match(/^\/api\/submissions\/([^/]+)\/reprocess$/);
  if (reprocess && method === 'POST') {
    const list = store.read('submissions.json');
    const sub = list.find((x) => x.submission_id === reprocess[1] && !x.deleted);
    if (!sub) return fail(res, 404, 'SUBMISSION_NOT_FOUND', `No submission ${reprocess[1]}`);
    if (['APPROVED', 'PAID', 'ARCHIVED', 'REJECTED'].includes(sub.state)) {
      return fail(res, 409, 'TERMINAL_STATE', `${sub.state} is terminal; historical decisions are immutable (Iron Invariant 4).`);
    }
    sub.state = 'SUBMITTED';
    sub.state_history = [];
    sub.run_id = P.newRunId();
    await P.runPipeline(sub, {});
    saveSubmissions([sub]);
    return send(res, 200, { ok: true, submission: sub });
  }

  const subAudit = p.match(/^\/api\/submissions\/([^/]+)\/audit$/);
  if (subAudit && method === 'GET') {
    return send(res, 200, { ok: true, events: store.read('audit-events.json').filter((e) => e.submission_id === subAudit[1]) });
  }

  /* ---- ledger ---- */
  if (method === 'GET' && p === '/api/ledger') {
    try {
      const snap = ledger.snapshot(url.searchParams.get('partner_id') || null, store.read('config.json').org?.fiscal_year);
      const rec = ledger.reconcile();
      const raw = store.read('ledger.json');
      return send(res, 200, { ok: true, ...snap, reconcile: rec, rows: raw.rows || [], declared_totals: raw.company_totals || null, invariant_formula: raw.invariant || null });
    } catch (err) {
      return send(res, 200, { ok: false, error: { code: err.code || 'LEDGER_NOT_CONFIGURED', message: String(err.message || err) } });
    }
  }

  if (method === 'GET' && p === '/api/ledger/transactions') {
    let txs = store.read('budget-transactions.json');
    const pid = url.searchParams.get('partner_id');
    if (pid) txs = txs.filter((t) => t.partner_id === pid);
    return send(res, 200, { ok: true, count: txs.length, transactions: txs.slice(-200).reverse() });
  }

  /* ---- company brain ---- */
  if (method === 'GET' && p === '/api/brain') {
    const brain = store.read('brain.json');
    const rawAgents = store.read('agents.json');
    const agentsList = Array.isArray(rawAgents) ? rawAgents : (rawAgents?.agents || brain.agents || []);
    return send(res, 200, {
      ok: true, brain,
      tiers: store.read('tiers.json'),
      rules: store.read('rules.json'),
      conflicts: store.read('rule-conflicts.json'),
      partners: store.read('partners.json'),
      checklist: store.read('checklist.json'),
      agents: agentsList,
      raw_agents: rawAgents,
      index_stats: rag.stats(),
      ai: ai.status(),
      setup: store.read('setup-wizard.json')
    });
  }

  if (method === 'GET' && p === '/api/partners') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    let list = store.read('partners.json');
    if (q) list = list.filter((x) => JSON.stringify(x).toLowerCase().includes(q));
    return send(res, 200, { ok: true, count: list.length, partners: list });
  }

  if (method === 'GET' && p === '/api/tiers') return send(res, 200, { ok: true, tiers: store.read('tiers.json') });

  if (method === 'GET' && p === '/api/rules') {
    return send(res, 200, { ok: true, rule_engine_version: store.read('config.json').rule_engine_version, rules: store.read('rules.json') });
  }

  if (method === 'GET' && p === '/api/checklist') {
    const tier = url.searchParams.get('tier');
    const type = (url.searchParams.get('type') || 'CLAIM').toUpperCase();
    const tiers = store.read('tiers.json');
    const t = tiers.find((x) => x.name === tier || x.tier_id === tier);
    const required = t ? (t.required_documents || []) : [];
    const checklist = store.read('checklist.json') || {};
    // checklist.json is keyed by submission type; each item carries item_id (not doc_type).
    const items = Array.isArray(checklist) ? checklist : (checklist[type] || []);
    const capConfigured = t?.programme_limits?.cap_configured === true;
    const rows = items.map((item) => {
      const requiredByTier = required.length ? required.includes(item.item_id) : null;
      // A tier with no configured cap cannot auto-decide requiredness (zero auto-guessing);
      // fall back to the item's own required flag.
      const isRequired = requiredByTier === null ? item.required !== false : requiredByTier;
      return {
        ...item,
        required: isRequired,
        required_by_tier: requiredByTier === null ? null : requiredByTier,
        configured: !!t && (capConfigured || required.length > 0)
      };
    });
    return send(res, 200, { ok: true, tier: tier || null, submission_type: type, tier_found: !!t, cap_configured: capConfigured, checklist: rows });
  }

  /* ---- tier / rule configuration (Programme Setup writes) ---- */
  const tierPatch = p.match(/^\/api\/brain\/tiers\/([^/]+)$/);
  if (tierPatch && (method === 'POST' || method === 'PATCH')) {
    const actor = verify(bearer(req));
    if (!actor) return fail(res, 401, 'HUMAN_AUTHORITY_REQUIRED', 'Iron Invariant 1 — policy configuration requires an authorised human administrator session.');
    const body = await readJson(req);
    const tiers = store.read('tiers.json');
    const t = tiers.find((x) => x.tier_id === tierPatch[1] || x.name === tierPatch[1]);
    if (!t) return fail(res, 404, 'TIER_NOT_FOUND', `No tier ${tierPatch[1]}`);
    const before = JSON.parse(JSON.stringify(t));
    if (body.single_event_cap !== undefined) {
      const v = body.single_event_cap === null || body.single_event_cap === '' ? null : Number(body.single_event_cap);
      if (v !== null && (Number.isNaN(v) || v < 0)) return fail(res, 400, 'INVALID_CAP', 'single_event_cap must be a non-negative number or null.');
      t.programme_limits.single_event_cap = v;
      t.programme_limits.cap_configured = v !== null;
    }
    if (body.coop_reimbursement_ratio !== undefined) {
      const v = body.coop_reimbursement_ratio === null || body.coop_reimbursement_ratio === '' ? null : Number(body.coop_reimbursement_ratio);
      if (v !== null && (Number.isNaN(v) || v < 0 || v > 1)) return fail(res, 400, 'INVALID_RATIO', 'coop_reimbursement_ratio must be between 0 and 1, or null.');
      t.programme_limits.coop_reimbursement_ratio = v;
    }
    if (Array.isArray(body.required_documents)) t.required_documents = body.required_documents;
    if (body.status) t.status = body.status;
    t.effective_date = body.effective_date || new Date().toISOString().slice(0, 10);
    t.approved_by = `${actor.name || actor.email} (console)`;
    t.provenance = 'human_configured';
    store.write('tiers.json', tiers);
    rag.reindex();
    P.appendAudit({
      submission_id: null, run_id: null, actor: actor.email, actor_type: 'HUMAN_ADMIN',
      previous_state: null, new_state: null, error_code: null, rule_id: null, evidence_refs: [],
      details: { event: 'TIER_CONFIG_UPDATED', tier_id: t.tier_id, before: before.programme_limits, after: t.programme_limits },
      rule_version: store.read('config.json').rule_engine_version
    });
    return send(res, 200, { ok: true, tier: t, note: 'Existing submissions keep the rule version bound at submission time (Iron Invariant 4).' });
  }

  /* ---- RAG / brain Q&A ---- */
  if (method === 'GET' && p === '/api/rag/search') {
    const q = url.searchParams.get('q') || '';
    if (!q.trim()) return fail(res, 400, 'EMPTY_QUERY', 'Query parameter q is required.');
    return send(res, 200, { ok: true, query: q, results: rag.retrieve(q, { k: Number(url.searchParams.get('k') || 8) }) });
  }

  if (method === 'POST' && p === '/api/rag/ask') {
    const body = await readJson(req);
    const q = String(body.question || body.q || '').trim();
    if (!q) return fail(res, 400, 'EMPTY_QUERY', 'A question is required.');
    const result = await rag.ask(q, { k: Number(body.k || 6) });
    const log = store.read('ai-log.json');
    log.push({ at: new Date().toISOString(), question: q, mode: result.mode, citations: result.citations.length, provider: result.provider.provider });
    store.write('ai-log.json', log.slice(-500));
    return send(res, 200, { ok: true, ...result });
  }

  /* ---- dashboards / agents / audit ---- */
  if (method === 'GET' && p === '/api/dashboards') {
    const stats = computeStats();
    let led = null;
    try { led = ledger.snapshot(null, store.read('config.json').org?.fiscal_year); } catch { led = null; }
    const declared = store.read('dashboards.json');
    return send(res, 200, { ok: true, live: stats, ledger: led, documented: declared });
  }

  if (method === 'GET' && p === '/api/agents') {
    const rawAgents = store.read('agents.json');
    const brain = store.read('brain.json');
    const agentsList = Array.isArray(rawAgents) ? rawAgents : (rawAgents?.agents || brain.agents || []);
    return send(res, 200, {
      ok: true,
      agents: agentsList,
      state_machine: rawAgents?.state_machine || [],
      event_contract_fields: rawAgents?.event_contract_fields || [],
      skill_router: brain.l1_skill_router || null
    });
  }

  if (method === 'GET' && p === '/api/audit') {
    let events = store.read('audit-events.json');
    const sid = url.searchParams.get('submission_id');
    const actorType = url.searchParams.get('actor_type');
    if (sid) events = events.filter((e) => e.submission_id === sid);
    if (actorType) events = events.filter((e) => e.actor_type === actorType);
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);
    return send(res, 200, { ok: true, total: events.length, events: events.slice(-limit).reverse(), immutable: true });
  }

  /* ---- setup wizard ---- */
  if (method === 'GET' && p === '/api/setup') {
    const wiz = store.read('setup-wizard.json');
    const rd = readiness();
    return send(res, 200, { ok: true, wizard: wiz, readiness: rd, manifest: rd.present });
  }

  if (method === 'POST' && p === '/api/setup') {
    const actor = verify(bearer(req));
    if (!actor) return fail(res, 401, 'HUMAN_AUTHORITY_REQUIRED', 'Setup changes require an authorised human administrator session.');
    const body = await readJson(req);
    const wiz = store.read('setup-wizard.json');
    const next = Array.isArray(wiz) ? wiz : (wiz && typeof wiz === 'object' ? wiz : {});
    Object.assign(next, body);
    store.write('setup-wizard.json', next);
    return send(res, 200, { ok: true, wizard: next });
  }

  /* ---- uploads ---- */
  if (method === 'POST' && p === '/api/upload') {
    const body = await readJson(req);
    const out = (body.files || []).map((f) => {
      const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data || '');
      return store.saveUpload(data, f.filename || 'upload.bin', f.mime || f.content_type);
    });
    return send(res, 201, { ok: true, files: out });
  }

  const up = p.match(/^\/api\/uploads\/([^/]+)$/);
  if (up && method === 'GET') {
    const safe = path.basename(decodeURIComponent(up[1]));
    const buf = store.readUpload(safe);
    const ext = path.extname(safe).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    return send(res, 200, buf, { 'Content-Type': contentType, 'Content-Disposition': `inline; filename="${safe}"` });
  }

  if (method === 'POST' && p === '/api/brain/reindex') {
    const stats = rag.reindex();
    return send(res, 200, { ok: true, ...rag.stats() });
  }

  return null; // not an API route
}

function cardView(s) {
  const cmts = comments().filter((c) => c.submission_id === s.submission_id);
  const latest = cmts.length ? cmts[cmts.length - 1] : null;
  const rulesSum = s.rules_result?.summary
    ? `${s.rules_result.summary.passed ?? 0}/${s.rules_result.summary.total ?? 0} rules passed`
    : null;

  return {
    submission_id: s.submission_id, submission_type: s.submission_type, title: s.title,
    partner_id: s.partner_id, partner_name: s.partner_name, partner_tier: s.partner_tier || 'Unassigned',
    amount: s.amount, approved_amount: s.approved_amount ?? null, currency: s.currency,
    state: s.state, ui_status: s.ui_status, owner: s.owner, ageing_days: s.ageing_days,
    sla_breached: !!s.sla_breached, submitted_at: s.submitted_at, updated_at: s.updated_at,
    activity_type: s.activity_type, activity_date: s.activity_date,
    attachments_count: s.attachments_count || (s.extracted_evidence || []).length,
    document_types: s.document_types || [], amount_confidence: s.amount_confidence ?? null,
    rule_version: s.rule_version, run_id: s.run_id,
    rules_summary: rulesSum,
    verdict: s.rules_result?.verdict || null,
    exception_type: s.exception_result?.exception_type || null,
    security_findings: (s.exception_result?.security_findings || []).length,
    open_questions: (s.validation_result?.open_questions || []).length,
    recommended_action: s.review_memo?.recommended_action?.headline || null,
    parent_pre_approval_id: s.parent_pre_approval_id || null,
    latest_comment: latest ? {
      comment_id: latest.comment_id,
      author: latest.author,
      author_role: latest.author_role || latest.role || null,
      badge: latest.badge || latest.author_role || 'AI Agent',
      text: latest.text,
      created_at: latest.created_at
    } : null,
    comments_count: cmts.length
  };
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await route(req, res, url);
      if (handled === null && !res.writableEnded) {
        return fail(res, 404, 'NO_SUCH_ENDPOINT', `${req.method} ${url.pathname} is not a known API endpoint.`);
      }
      return;
    }
    serveStatic(res, url.pathname);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(`[error] ${req.method} ${url.pathname}`, err);
    if (!res.writableEnded) fail(res, status, err.code || 'INTERNAL_ERROR', String(err.message || err));
  }
});

// Ledger ops must never interleave — the in-process equivalent of SELECT ... FOR UPDATE.
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

server.listen(PORT, HOST, () => {
  try {
    db.initSchema();
    db.syncFromJson();
  } catch (err) {
    console.error('[db error] Failed to initialize SQLite:', err.message);
  }
  const rd = readiness();
  console.log('');
  console.log('  PartnerFlow · UMochi Squad — localhost runtime');
  console.log('  ------------------------------------------------');
  console.log(`  Web UI     http://${HOST}:${PORT}`);
  console.log(`  API        http://${HOST}:${PORT}/api/health`);
  console.log(`  Node       ${process.version} (zero external dependencies)`);
  console.log(`  SQLite DB  server/data/partnerflow.db (active SQL engine)`);
  console.log(`  LLM        ${rd.ai_provider.available ? `${rd.ai_provider.provider} / ${rd.ai_provider.model}` : 'none configured (RAG retrieval still grounded in the AI-authored corpus)'}`);
  console.log(`  RAG index  ${rd.rag.chunks} chunks ${JSON.stringify(rd.rag.by_layer)}`);
  console.log(`  Data       ${rd.ready ? 'ready' : `initialising — missing ${rd.missing.join(', ')}`}`);
  console.log('');
});
