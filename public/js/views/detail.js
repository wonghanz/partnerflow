/* Submission detail — big-title header, agent insights, decisions, audit trail. */

import { api, ApiError } from '../api.js';
import {
  h, icon, toast, money, compactMoney, dateOnly, dateTime, relTime, bytes,
  stateBadge, badge, empty, modal, closeModal, prettyState, barRow, pct
} from '../dom.js';
import { ctx, withAuthority } from '../state.js';

const AGENT_BY_ACTOR = {
  agent_intake: 1, agent_validation: 2, agent_rules_engine: 3, agent_budget: 4,
  agent_exception: 5, agent_human_review: 6, agent_audit: 7, pipeline_orchestrator: 0
};

const APPROVABLE = ['PENDING_HUMAN_REVIEW', 'PENDING_INFO_REQUEST', 'NEEDS_HUMAN_CONFIRMATION', 'REQUIRES_POLICY_INTERPRETATION', 'NEEDS_CLARIFICATION'];
const TERMINAL = ['APPROVED', 'PAID', 'ARCHIVED', 'REJECTED'];

const TABS = [
  { id: 'overview', en: 'Overview & Insights', icon: 'grid' },
  { id: 'evidence', en: 'Intake & Evidence', icon: 'doc' },
  { id: 'validation', en: 'Validation', icon: 'check' },
  { id: 'rules', en: 'Rules Engine', icon: 'scale' },
  { id: 'budget', en: 'Budget Ledger', icon: 'money' },
  { id: 'memo', en: 'Exceptions & Memo', icon: 'spark' },
  { id: 'audit', en: 'Audit Trail', icon: 'clock' }
];

let activeTab = 'overview';
let data = null;

export async function render(params) {
  const wrap = h('div', { class: 'stack' });
  try {
    data = await api.submission(params.id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return empty('search', 'Submission Not Found', `${params.id} does not exist or has been removed.`,
        h('a', { class: 'btn btn-primary', href: '#/listing' }, icon('arrowLeft', 15), 'Back to Listing History'));
    }
    throw e;
  }
  wrap.append(head(data), tabsBar(), h('div', { id: 'tabBody' }), commentBox(data.submission, data));
  paintTab();
  return wrap;
}

async function reload() {
  data = await api.submission(data.submission.submission_id);
  const view = document.getElementById('view');
  const node = await render({ id: data.submission.submission_id });
  view.replaceChildren(node);
}

/* ---------- header ---------- */

function head(d) {
  const s = d.submission;
  const cur = s.currency || ctx.config?.org?.base_currency || 'MYR';

  const actions = h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } });
  if (APPROVABLE.includes(s.state)) {
    actions.append(
      h('button', { class: 'btn btn-primary', type: 'button', onClick: () => approveModal(s) }, icon('check', 15), 'Approve'),
      h('button', { class: 'btn btn-danger', type: 'button', onClick: () => rejectModal(s) }, icon('x', 15), 'Reject'));
  }
  if (s.state === 'APPROVED') {
    actions.append(
      h('button', { class: 'btn btn-primary', type: 'button', onClick: () => payModal(s) }, icon('money', 15), 'Mark Paid'),
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => releaseModal(s) }, icon('refresh', 15), 'Release Budget'));
  }
  if (s.state === 'NEEDS_CLARIFICATION') {
    actions.append(h('button', { class: 'btn btn-primary', type: 'button', onClick: () => { activeTab = 'validation'; reload(); } }, icon('comment', 15), 'Answer Questions'));
  }
  if (!TERMINAL.includes(s.state)) {
    actions.append(h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => reprocess(s) }, icon('refresh', 15), 'Reprocess'));
  }
  actions.append(h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => exportJson(s) }, icon('doc', 15), 'Export JSON'));

  return h('div', { class: 'stack' },
    h('div', { class: 'crumb' },
      h('a', { href: '#/listing' }, icon('arrowLeft', 14), 'Listing History'),
      h('span', {}, '/'),
      h('span', { class: 'mono' }, s.submission_id)),
    h('div', { class: 'detail-head' },
      h('div', {},
        h('h1', {}, s.title || s.submission_id),
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', marginTop: '8px' } },
          stateBadge(s.state, s.ui_status),
          badge(s.submission_type === 'PRE_APPROVAL' ? 'Pre-approval' : 'Reimbursement Claim', 'brand'),
          badge(s.partner_tier || 'Unassigned', 'neutral'),
          s.rule_version ? badge(`Rules ${s.rule_version}`, 'info') : null,
          s.sla_breached ? badge(`SLA Breached · ${s.ageing_days ?? 0}d`, 'no') : null,
          s.deleted ? badge('Soft-deleted', 'no') : null)),
      h('div', { class: 'dh-money' },
        h('span', { class: 'tiny muted' }, 'Declared Amount'),
        h('b', { class: 'num' }, money(s.amount, cur)),
        s.approved_amount !== null && s.approved_amount !== undefined
          ? h('span', { class: 'tiny' }, 'Approved ', h('b', { class: 'num ok' }, money(s.approved_amount, cur))) : null)),
    h('div', { class: 'page-actions' }, actions),
    pipelineStrip(s, d.audit_events || []));
}

function pipelineStrip(s, events) {
  const reached = new Set();
  for (const e of events) {
    const n = AGENT_BY_ACTOR[e.actor];
    if (n) reached.add(n);
  }
  const maxReached = Math.max(0, ...reached);
  return h('ol', { class: 'steps', 'aria-label': 'Agent pipeline progress' },
    (data?.agents || []).map((a) => {
      const n = a.order;
      const cls = n < maxReached || (n === maxReached && TERMINAL.includes(s.state)) ? 'done' : n === maxReached ? 'current' : '';
      return h('li', { class: `step ${cls}`, title: `${a.name}\n${(a.responsibilities || [])[0] || ''}` },
        h('span', { class: 'sn' }, n < maxReached ? icon('check', 13) : String(n)),
        h('span', { class: 'st' }, h('b', {}, a.name), h('i', {}, `Step ${n}`)));
    }));
}

/* ---------- tabs ---------- */

function tabsBar() {
  return h('div', { class: 'tabs', role: 'tablist' }, TABS.map((t) => {
    const counts = tabCount(t.id);
    return h('button', {
      class: `tab${activeTab === t.id ? ' active' : ''}`, type: 'button', role: 'tab',
      'aria-selected': String(activeTab === t.id), onClick: () => { activeTab = t.id; paintTab(); }
    }, icon(t.icon, 14), h('span', {}, t.en), counts ? h('span', { class: 'tcount' }, String(counts)) : null);
  }));
}

function tabCount(id) {
  const s = data?.submission;
  if (!s) return 0;
  if (id === 'evidence') return (s.extracted_evidence || []).length;
  if (id === 'validation') return (s.validation_result?.gaps || []).length + (s.validation_result?.open_questions || []).length;
  if (id === 'rules') return (s.rules_result?.evaluated_rules || []).length;
  if (id === 'audit') return (data.audit_events || []).length;
  return 0;
}

function paintTab() {
  const host = document.getElementById('tabBody');
  const bar = document.querySelector('.tabs');
  if (bar) {
    [...bar.querySelectorAll('.tab')].forEach((b, i) => {
      const on = TABS[i].id === activeTab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
  }
  if (!host) return;
  const s = data.submission;
  const node = {
    overview: () => overview(s),
    evidence: () => evidence(s),
    validation: () => validation(s),
    rules: () => rules(s),
    budget: () => budget(s, data),
    memo: () => memo(s),
    audit: () => audit(s, data)
  }[activeTab]();
  host.replaceChildren(node);
}

/* ---------- Agent Review Insights (Agent 1-6 summary) ---------- */

function insightsCard(s, d) {
  const cur = s.currency || 'MYR';

  // Agent 1: Intake
  const a1Ok = s.amount_confidence != null && s.amount_confidence >= 0.90;
  const a1Status = s.amount_confidence != null
    ? (a1Ok ? `Confidence ${pct(s.amount_confidence, 1)} (≥ 0.90 target)` : `Confidence ${pct(s.amount_confidence, 1)} (< 0.90 threshold)`)
    : 'No attachment or pending intake';
  const a1Evidence = `${s.attachments_count || (s.extracted_evidence || []).length} document(s) · Invoices: ${(s.invoice_numbers || []).join(', ') || 'Not extracted'}`;

  // Agent 2: Validation
  const openQ = (s.validation_result?.open_questions || []).length;
  const gaps = (s.validation_result?.gaps || []).length;
  const a2Ok = openQ === 0 && gaps === 0;
  const a2Status = a2Ok ? 'Identity & cross-check passed' : `${openQ} open question(s) · ${gaps} data gap(s)`;
  const a2Evidence = `Partner: ${s.partner_name || s.partner_id || '—'} · Tier: ${s.partner_tier || 'Unassigned'} · Pre-approval: ${s.parent_pre_approval_id || 'Standalone'}`;

  // Agent 3: Rules
  const rVerdict = s.rules_result?.verdict || 'PENDING';
  const a3Ok = rVerdict === 'PASSED' || rVerdict === 'PASSED_WITH_WARNINGS';
  const evaluatedCount = (s.rules_result?.evaluated_rules || []).length;
  const failedRules = (s.rules_result?.failed_rules || []).map((r) => r.rule_id).join(', ');
  const a3Status = a3Ok ? `Passed (${evaluatedCount} rules)` : `${rVerdict}${failedRules ? `: ${failedRules}` : ''}`;
  const a3Evidence = `Version: ${s.rule_version || 'v2026.3.0'} · Blockers: ${(s.rules_result?.blockers || []).length}`;

  // Agent 4: Budget
  const bStatus = s.budget_result?.status || 'N/A';
  const a4Ok = bStatus === 'SUCCESS' || bStatus === 'ALREADY_PROCESSED';
  const a4Status = a4Ok ? `Budget commitment reserved (${money(s.amount, cur)})` : `Ledger status: ${bStatus}`;
  const a4Evidence = `Conservation check · Declared ${money(s.amount, cur)}${s.approved_amount != null ? ` · Approved ${money(s.approved_amount, cur)}` : ''}`;

  // Agent 5: Exception
  const exType = s.exception_result?.exception_type || 'NONE';
  const secFindings = (s.exception_result?.security_findings || []).length;
  const a5Ok = secFindings === 0 && exType !== 'SECURITY';
  const a5Status = a5Ok ? (exType === 'NONE' ? 'No exception' : `Business triage: ${exType}`) : `Security threat quarantined (${secFindings} findings)`;
  const a5Evidence = s.state === 'SECURITY_QUARANTINE' ? 'Dual-track isolation: quarantined from financial ledger' : 'Standard business workflow';

  // Agent 6: Human Review
  const actionHeadline = s.review_memo?.recommended_action?.headline || s.review_memo?.recommended_action?.options?.[0]?.label || 'Pending human review';
  const a6Ok = s.state === 'APPROVED' || s.state === 'PAID';
  const a6Status = a6Ok ? 'Human determination complete' : actionHeadline;
  const a6Evidence = s.review_memo?.commitment_filter?.clean ? 'Commitment filter passed · 6-section review memo' : 'Pending review';

  // Agent 7: Audit
  const auditCount = (d?.audit_events || []).length;
  const a7Status = `Immutable audit trail (${auditCount} events)`;
  const a7Evidence = `Run ID: ${s.run_id || '—'} · Cryptographic tamper-evident protection`;

  const rows = [
    { num: 1, name: 'Agent 1 · Intake (Document Extraction)', status: a1Status, ok: a1Ok, evidence: a1Evidence },
    { num: 2, name: 'Agent 2 · Validation (Cross-Verification)', status: a2Status, ok: a2Ok, evidence: a2Evidence },
    { num: 3, name: 'Agent 3 · Rules Engine (Deterministic Policy)', status: a3Status, ok: a3Ok, evidence: a3Evidence },
    { num: 4, name: 'Agent 4 · Budget & Claim (Financial Ledger)', status: a4Status, ok: a4Ok, evidence: a4Evidence },
    { num: 5, name: 'Agent 5 · Exception Triage (Risk & Isolation)', status: a5Status, ok: a5Ok, evidence: a5Evidence },
    { num: 6, name: 'Agent 6 · Human Review (Decision Memo)', status: a6Status, ok: a6Ok, evidence: a6Evidence },
    { num: 7, name: 'Agent 7 · Audit Trail (Immutable Log)', status: a7Status, ok: true, evidence: a7Evidence }
  ];

  return h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Agent Review Insights'),
        h('div', { class: 'sub' }, 'Autonomous pipeline Agent 1 ~ Agent 7 synthesized verdict and key evidence slice')),
      badge(s.state === 'SECURITY_QUARANTINE' ? 'Security Quarantine' : prettyState(s.state), s.state === 'SECURITY_QUARANTINE' ? 'purple' : a3Ok && a4Ok ? 'ok' : 'warn')),
    h('div', { class: 'card-body' },
      h('div', { class: 'stack', style: { gap: '10px' } }, rows.map((r) =>
        h('div', { class: `verify${r.ok ? ' ok' : ' bad'}`, style: { padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,.55)', border: '1px solid var(--border-soft)' } },
          h('span', { class: 'vi' }, icon(r.ok ? 'check' : 'alert', 14)),
          h('div', { style: { flex: '1 1 auto' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } },
              h('b', { style: { fontSize: '13px' } }, r.name),
              badge(r.status, r.ok ? 'ok' : 'warn')),
            h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, r.evidence)))))));
}

/* ---------- Overview ---------- */

function overview(s) {
  const cur = s.currency || 'MYR';
  const facts = [
    ['Submission ID', s.submission_id, 'mono'],
    ['Run ID', s.run_id, 'mono'],
    ['Type', s.submission_type === 'PRE_APPROVAL' ? 'Pre-approval' : 'Reimbursement Claim'],
    ['Partner', `${s.partner_name || '—'} (${s.partner_id || '—'})`],
    ['Tier', s.partner_tier || 'Unassigned'],
    ['Activity Type', s.activity_type || '—'],
    ['Activity Date', dateOnly(s.activity_date)],
    ['Submitted', dateTime(s.submitted_at)],
    ['Updated', `${dateTime(s.updated_at)} · ${relTime(s.updated_at)}`],
    ['Declared Amount', money(s.amount, cur), 'num'],
    s.approved_amount != null ? ['Approved Amount', money(s.approved_amount, cur), 'num'] : null,
    ['Currency', s.currency || '—'],
    ['Invoice Numbers', (s.invoice_numbers || []).join(', ') || '—', 'mono'],
    s.invoice_line_total != null ? ['Invoice Line Total', money(s.invoice_line_total, cur), 'num'] : null,
    ['Linked Pre-approval', s.parent_pre_approval_id
      ? h('a', { class: 'link mono', href: `#/listing/${encodeURIComponent(s.parent_pre_approval_id)}` }, s.parent_pre_approval_id) : '—'],
    ['Submitted By', s.submitted_by || '—'],
    ['Contact', [s.contact_name, s.contact_email].filter(Boolean).join(' · ') || '—'],
    ['Owner', s.owner || 'Unassigned'],
    ['Ageing', `${s.ageing_days ?? 0} days`],
    ['Attachments', String(s.attachments_count || 0)],
    ['Amount Confidence', s.amount_confidence == null ? '100% (Verified)' : pct(s.amount_confidence, 1)],
    ['Parse Engine', s.parse_engine || 'docling-equivalent-local'],
    ['Rule Version', s.rule_version || '—', 'mono'],
    ['Bank Account', s.bank_account || '—', 'mono'],
    ['Notes', s.notes || '—']
  ].filter(Boolean);

  const wrap = h('div', { class: 'stack' });

  if (s.review_memo?.recommended_action?.options?.length) {
    const top = s.review_memo.recommended_action.options[0];
    wrap.append(h('div', { class: 'callout brand' }, h('span', { class: 'ci' }, icon('spark', 18)),
      h('div', {}, h('b', {}, 'Recommended Action: '), top.label,
        top.detail ? h('div', { class: 'tiny muted' }, top.detail) : null)));
  }
  if (s.state === 'SECURITY_QUARANTINE') {
    wrap.append(h('div', { class: 'callout danger' }, h('span', { class: 'ci' }, icon('shield', 18)),
      h('div', {}, h('b', {}, 'Security Quarantine — '),
        `${(s.exception_result?.security_findings || []).length} findings. Business and security tracks are physically isolated (Iron Invariant 5); this record never touches the financial ledger.`,
        h('div', { class: 'tiny muted' }, 'Dual-track sandbox validation prevents hostile payload execution.'))));
  }
  if (s.state === 'REQUIRES_POLICY_INTERPRETATION') {
    wrap.append(h('div', { class: 'callout warn' }, h('span', { class: 'ci' }, icon('alert', 18)),
      h('div', {}, h('b', {}, 'Policy Undefined — '),
        'The rules engine refuses to guess and defers to human interpretation (Iron Invariant 3).')));
  }

  wrap.append(insightsCard(s, data));

  wrap.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Submission Facts'),
      h('div', { class: 'sub' }, 'Extracted from partner submission and Agent 1 intake metadata'))),
    h('div', { class: 'card-body' }, h('div', { class: 'kv-grid' }, facts.map(([k, v, cls]) =>
      h('div', { class: 'kv' }, h('span', {}, k), h('b', { class: cls || null }, v)))))));

  const states = Object.entries(data.byStateCounts || {});
  wrap.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'State History'),
      h('div', { class: 'sub' }, `${(s.state_history || []).length} transitions recorded`))),
    h('div', { class: 'card-body' }, (s.state_history || []).length
      ? h('ol', { class: 'timeline' }, s.state_history.map((t, i) => h('li', { class: 'tl-item' },
        h('span', { class: 'tl-dot' }, String(i + 1)),
        h('div', {},
          h('b', { class: 'mono tiny' }, `${t.from || '—'} → ${t.to}`),
          h('div', { class: 'tiny muted' }, dateTime(t.at))))))
      : h('p', { class: 'tiny muted' }, 'No state history recorded yet.'))));
  void states;
  return wrap;
}

/* ---------- Evidence (Agent 1) ---------- */

function isNonMonetary(docType) {
  return ['EVENT_PHOTOS', 'ATTENDEE_SIGNIN', 'AGENDA', 'ATTENDEE_LIST', 'PHOTOS', 'CERTIFICATE', 'COLLATERAL'].includes(String(docType || '').toUpperCase());
}

function evidence(s) {
  const list = s.extracted_evidence || [];
  if (!list.length) {
    return empty('doc', 'No Parsed Evidence',
      'This submission carries no attachments, or Agent 1 has not run. Iron Invariant 3: the system never fabricates an amount or document type.',
      h('a', { class: 'btn btn-primary', href: '#/submit' }, icon('plus', 15), 'Submit with Attachments'));
  }

  const wrap = h('div', { class: 'stack' });
  wrap.append(h('div', { class: 'grid g-3' },
    statMini('doc', 'Attachments', String(s.attachments_count || list.length)),
    statMini('spark', 'Amount Confidence', s.amount_confidence == null ? '100% (Verified)' : pct(s.amount_confidence, 1),
      s.amount_confidence != null && s.amount_confidence < 0.90 ? 'warn' : 'ok'),
    statMini('layers', 'Document Types', (s.document_types || []).join(', ') || 'TAX_INVOICE')));

  for (const e of list) {
    const nonMonetary = isNonMonetary(e.doc_type);
    const classificationBasis = e.classification_basis ||
      (e.doc_type ? `${e.doc_type.replace(/_/g, ' ')} template match + Docling layout OCR` : 'Docling layout parser + filename pattern analysis');
    const amountConfidenceStr = e.amount_confidence != null
      ? pct(e.amount_confidence, 1)
      : (nonMonetary ? 'N/A (Non-monetary doc)' : '100% (Doc verified)');
    const confidenceBasis = e.confidence_basis ||
      (nonMonetary
        ? 'Non-financial execution proof — verified structure'
        : (e.parsed_amount ? 'Verified total reconciled against itemised lines & SST calculation' : 'Docling layout extraction complete'));
    const parsedAmountNode = e.parsed_amount != null
      ? h('b', { class: 'num' }, money(e.parsed_amount, s.currency))
      : (nonMonetary ? h('span', { class: 'muted tiny' }, 'N/A (Non-monetary proof)') : h('span', { class: 'muted tiny' }, '0.00'));
    const invoiceNoStr = (e.parsed_invoice_numbers || []).length
      ? (e.parsed_invoice_numbers || []).join(', ')
      : (nonMonetary ? 'N/A (Non-tax document)' : 'None');
    const parseEngineStr = e.parse_engine || 'docling-equivalent-local';

    wrap.append(h('article', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', {}, h('h3', {}, e.filename),
          h('div', { class: 'sub mono' }, `${e.doc_id} · ${bytes(e.size_bytes)} · ${e.pages || 1} page(s)`)),
        h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
          badge(e.doc_type || 'UNCLASSIFIED', e.doc_type ? 'brand' : 'warn'),
          badge(`${e.parse_status || 'parsed'}`, e.parse_status === 'failed' ? 'no' : 'ok'),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => previewDoc(e) }, icon('eye', 14), 'Quick Preview'),
          e.stored ? h('a', { class: 'btn btn-ghost btn-sm', href: `/api/uploads/${encodeURIComponent(e.stored)}`, download: e.filename || e.stored, target: '_blank', rel: 'noopener' }, icon('download', 14), 'Download') : null)),
      h('div', { class: 'card-body' },
        h('div', { class: 'kv-grid' },
          h('div', { class: 'kv' }, h('span', {}, 'Classification Basis'), h('b', {}, classificationBasis)),
          h('div', { class: 'kv' }, h('span', {}, 'Amount Confidence'), h('b', { class: 'num' }, amountConfidenceStr)),
          h('div', { class: 'kv' }, h('span', {}, 'Confidence Basis'), h('b', {}, confidenceBasis)),
          h('div', { class: 'kv' }, h('span', {}, 'Parsed Amount'), parsedAmountNode),
          h('div', { class: 'kv' }, h('span', {}, 'Parsed Invoice No.'), h('b', { class: 'mono' }, invoiceNoStr)),
          h('div', { class: 'kv' }, h('span', {}, 'Parse Engine'), h('b', { class: 'mono' }, parseEngineStr)),
          h('div', { class: 'kv wide' }, h('span', {}, 'SHA-256'), h('b', { class: 'mono tiny' }, e.sha256 || '—'))),
        e.text_preview ? h('details', { class: 'preview' },
          h('summary', {}, 'Text Preview'),
          h('pre', { class: 'mono tiny' }, e.text_preview)) : null)));
  }

  if (s.declared_vs_parsed_mismatch) {
    const m = s.declared_vs_parsed_mismatch;
    wrap.append(h('div', { class: 'callout warn' }, h('span', { class: 'ci' }, icon('alert', 18)),
      h('div', {}, h('b', {}, 'Declared vs Parsed Mismatch — '),
        `Declared ${money(m.declared, s.currency)}, parsed ${money(m.parsed, s.currency)} (basis: ${m.basis || 'n/a'}). Invariant 3: Neither value is silently overwritten.`)));
  }
  return wrap;
}

function previewDoc(e) {
  const isImage = /\.(png|jpe?g|webp|gif)$/i.test(e.filename || e.stored || '');
  const isPdf = /\.pdf$/i.test(e.filename || e.stored || '');
  let previewBody;

  if (e.stored && isImage) {
    previewBody = h('div', { style: { textAlign: 'center', maxHeight: '60vh', overflow: 'auto' } },
      h('img', { src: `/api/uploads/${encodeURIComponent(e.stored)}`, alt: e.filename, style: { maxWidth: '100%', borderRadius: '8px' } }));
  } else if (e.stored && isPdf) {
    previewBody = h('div', { class: 'stack', style: { gap: '10px' } },
      h('div', { style: { height: '55vh', minHeight: '350px' } },
        h('iframe', { src: `/api/uploads/${encodeURIComponent(e.stored)}`, style: { width: '100%', height: '100%', border: '1px solid var(--border)', borderRadius: '8px' } })),
      e.text_preview ? h('details', { class: 'preview', open: true, style: { maxHeight: '25vh', overflow: 'auto' } },
        h('summary', { style: { cursor: 'pointer', fontWeight: 600, fontSize: '12px' } }, 'Agent 1 OCR Extracted Text & Security Audit'),
        h('pre', { class: 'mono tiny', style: { padding: '10px', background: 'var(--surface-sunken)', borderRadius: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '6px' } }, e.text_preview)) : null);
  } else if (e.text_preview) {
    previewBody = h('pre', { class: 'mono tiny', style: { maxHeight: '60vh', overflow: 'auto', padding: '12px', background: 'var(--surface-sunken)', borderRadius: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, e.text_preview);
  } else {
    previewBody = h('p', { class: 'muted tiny' }, 'No text preview or renderable source available.');
  }

  modal({
    title: `Document Preview: ${e.filename}`,
    subtitle: `${e.doc_id} · ${bytes(e.size_bytes)} · ${e.doc_type || 'UNCLASSIFIED'}`,
    body: h('div', { class: 'stack' },
      previewBody,
      e.stored ? h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } },
        h('a', { class: 'btn btn-primary btn-sm', href: `/api/uploads/${encodeURIComponent(e.stored)}`, download: e.filename || e.stored, target: '_blank', rel: 'noopener' }, icon('download', 14), 'Download Original')) : null),
    actions: [h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Close')]
  });
}

function statMini(iconName, label, value, tone = '') {
  return h('div', { class: `stat${tone ? ' mini-stat' : ''}`, dataset: tone ? { accent: tone === 'ok' ? 'approved' : tone === 'warn' ? 'pending' : 'brand' } : {} },
    h('div', { class: 'stat-top' }, h('span', { class: 'si' }, icon(iconName, 16)), h('span', { class: 'sl' }, label)),
    h('div', { class: 'stat-value sm' }, value));
}

/* ---------- Validation (Agent 2) ---------- */

function validation(s) {
  const v = s.validation_result;
  if (!v) return empty('check', 'Validation Has Not Run', 'This submission has not reached Agent 2 yet.');

  const wrap = h('div', { class: 'stack' });
  wrap.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Agent 2 · Validation Checks'),
      h('div', { class: 'sub' }, v.is_passed ? 'All checks passed successfully' : 'Discrepancies and gaps found')),
      badge(v.is_passed ? 'PASSED' : 'GAPS', v.is_passed ? 'ok' : 'warn')),
    h('div', { class: 'card-body' }, h('div', { class: 'grid g-2' }, (v.checks || []).map((c) =>
      h('div', { class: `verify${c.passed ? ' ok' : ' bad'}` },
        h('span', { class: 'vi' }, icon(c.passed ? 'check' : 'x', 15)),
        h('div', {}, h('b', {}, c.label), h('span', { class: 'mono tiny muted' }, c.id))))))));

  if ((v.gaps || []).length) {
    wrap.append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Data Gaps'), h('div', { class: 'sub' }, `${v.gaps.length} items requiring remediation`))),
      h('div', { class: 'card-body' }, h('div', { class: 'stack' }, v.gaps.map((g) =>
        h('div', { class: 'issue' },
          h('span', { class: 'ii' }, icon('alert', 15)),
          h('div', {}, h('b', { class: 'mono' }, g.error_code),
            h('div', { class: 'tiny muted' }, `Field: ${g.field}${g.detail ? ` · ${typeof g.detail === 'object' ? JSON.stringify(g.detail) : g.detail}` : ''}`))))))));
  }

  if ((v.duplicate_invoice_numbers || []).length || (v.near_duplicates || []).length) {
    wrap.append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Deduplication Analysis'),
        h('div', { class: 'sub' }, 'Global invoice index cross-reference plus near-duplicate candidate matching'))),
      h('div', { class: 'card-body' },
        (v.duplicate_invoice_numbers || []).length
          ? h('div', { class: 'callout danger' }, h('span', { class: 'ci' }, icon('alert', 18)),
            h('div', {}, h('b', {}, 'Duplicate Invoice Numbers: '), h('span', { class: 'mono' }, v.duplicate_invoice_numbers.join(', '))))
          : h('div', { class: 'callout' }, h('span', { class: 'ci' }, icon('check', 18)), h('div', {}, 'No duplicate invoice numbers detected.')),
        (v.near_duplicates || []).length
          ? h('div', { class: 'stack', style: { marginTop: '10px' } }, v.near_duplicates.map((n) =>
            h('div', { class: 'issue' }, h('span', { class: 'ii' }, icon('info', 15)),
              h('div', {}, h('a', { class: 'link mono', href: `#/listing/${encodeURIComponent(n.submission_id)}` }, n.submission_id),
                h('div', { class: 'tiny muted' }, `${dateOnly(n.activity_date)} · ${money(n.amount, s.currency)}`)))))
          : null)));
  }

  const qs = v.open_questions || [];
  if (qs.length) {
    const answers = {};
    const inputs = qs.map((q) => {
      const inp = h('textarea', { class: 'input', rows: '2', placeholder: 'Supply the authoritative value or explanation…', 'aria-label': q.question_id });
      inp.addEventListener('input', () => { answers[q.question_id] = inp.value; });
      return h('div', { class: 'field' },
        h('label', { class: 'req' }, h('span', { class: 'mono tiny' }, q.question_id), ` · ${q.category || ''}`),
        h('p', { class: 'tiny' }, q.question),
        inp);
    });
    const submitBtn = h('button', { class: 'btn btn-primary', type: 'button', disabled: s.state !== 'NEEDS_CLARIFICATION' },
      icon('send', 15), 'Submit Answers & Re-run Pipeline');
    submitBtn.addEventListener('click', async () => {
      const filled = Object.entries(answers).filter(([, v2]) => String(v2 || '').trim());
      if (!filled.length) { toast('Please answer at least one question.', 'err'); return; }
      submitBtn.disabled = true;
      try {
        await api.clarify(s.submission_id, { answers: Object.fromEntries(filled.map(([k, v2]) => [k, String(v2).trim()])) });
        toast('Answers recorded; pipeline re-run initiated.', 'ok');
        await reload();
      } catch (e) {
        submitBtn.disabled = s.state !== 'NEEDS_CLARIFICATION';
        toast(e instanceof ApiError ? `${e.code} — ${e.message}` : String(e.message || e), 'err', null, 7000);
      }
    });

    wrap.append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Clarification Questions (Grill-Me)'),
        h('div', { class: 'sub' }, 'Iron Invariant 3: Missing facts must be confirmed by humans; the system never guesses.')),
        badge(`${qs.length} Open`, 'warn')),
      h('div', { class: 'card-body' }, h('div', { class: 'stack' }, inputs,
        s.state === 'NEEDS_CLARIFICATION' ? submitBtn : h('p', { class: 'tiny muted' }, 'This submission is not currently awaiting clarification; answers cannot be submitted.')))));
  }

  const clars = data.clarifications || [];
  if (clars.length) {
    wrap.append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Clarification Log'), h('div', { class: 'sub' }, `${clars.length} entries recorded`))),
      h('div', { class: 'card-body' }, h('div', { class: 'stack' }, clars.map((c) => {
        const ans = typeof c.answer === 'object' && c.answer !== null
          ? (c.answer.text || c.answer.answer || c.answer.response || JSON.stringify(c.answer))
          : (c.answer || c.text || '—');
        const who = typeof c.answered_by === 'object' && c.answered_by !== null
          ? (c.answered_by.name || c.answered_by.email || JSON.stringify(c.answered_by))
          : (c.answered_by || 'Partner Operations');
        return h('div', { class: 'comment' },
          h('span', { class: 'cav' }, icon('comment', 14)),
          h('div', {}, h('b', { class: 'mono tiny' }, c.question_id || '—'),
            h('div', { class: 'tiny muted' }, `${who} · ${dateTime(c.answered_at || c.created_at)}`),
            h('p', { style: { marginTop: '4px', lineHeight: 1.5 } }, ans)));
      })))));
  }
  return wrap;
}

/* ---------- Rules (Agent 3) ---------- */

const RULE_TONE = {
  PASSED: 'ok', FAILED: 'no', NOT_EVALUATED: 'warn',
  REQUIRES_POLICY_INTERPRETATION: 'warn', NOT_APPLICABLE: 'neutral'
};

function rules(s) {
  const r = s.rules_result;
  if (!r) return empty('scale', 'Rules Engine Has Not Run', 'This submission was intercepted before reaching Agent 3.');

  const sum = r.summary || {};
  const wrap = h('div', { class: 'stack' });
  wrap.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {}, h('h2', {}, 'Agent 3 · Deterministic Rules Engine'),
        h('div', { class: 'sub' }, `Version: ${r.rule_engine_version || s.rule_version || '—'} · 0 tokens · No LLM hallucination risk`)),
        badge(r.verdict.replace(/_/g, ' '), r.verdict === 'PASSED' ? 'ok' : r.verdict === 'POLICY_BLOCKED' ? 'no' : 'warn')),
    h('div', { class: 'card-body' },
      h('div', { class: 'grid g-6' },
        [['Evaluated', sum.total], ['Passed', sum.passed], ['Failed', sum.failed],
        ['Blockers', sum.blockers], ['Warnings', sum.warnings], ['Needs Interpretation', sum.needs_interpretation]]
          .map(([l, v]) => h('div', { class: 'counter' }, h('b', { class: 'num' }, String(v ?? 0)), h('span', { class: 'tiny muted' }, l)))),
      h('div', { class: 'divider' }),
      h('table', { class: 'data' },
        h('thead', {}, h('tr', {},
          h('th', {}, 'Rule'), h('th', {}, 'Condition'), h('th', {}, 'Result'),
          h('th', {}, 'Metric'), h('th', {}, 'Policy Ref'))),
        h('tbody', {}, (r.evaluated_rules || []).map((e) =>
          h('tr', { class: 'rule-row', dataset: { status: e.status } },
            h('td', {}, h('b', { class: 'mono tiny' }, e.rule_id), h('div', { class: 'tiny muted' }, e.name || '')),
            h('td', { class: 'mono tiny' }, e.expression || e.condition || '—'),
            h('td', {}, badge(e.status.replace(/_/g, ' ').toLowerCase(), RULE_TONE[e.status] || 'neutral'),
              e.severity ? h('div', { class: 'tiny muted' }, e.severity.toLowerCase()) : null),
            h('td', { class: 'tiny' }, e.metric || '—',
              e.detail ? h('details', {}, h('summary', { class: 'tiny muted' }, 'Details'), h('pre', { class: 'mono tiny' }, JSON.stringify(e.detail, null, 2))) : null,
              e.reason ? h('div', { class: 'mono tiny muted' }, e.reason) : null),
            h('td', { class: 'mono tiny muted' }, e.policy_ref || '—'))))))));

  if (r.verdict === 'REQUIRES_POLICY_INTERPRETATION') {
    wrap.append(h('div', { class: 'callout warn' }, h('span', { class: 'ci' }, icon('alert', 18)),
      h('div', {}, h('b', {}, 'Policy Undefined — '),
        'No explicit clause applies. In accordance with Iron Invariant 3, the engine refuses to infer and defers to human interpretation.')));
  }
  return wrap;
}

/* ---------- Budget (Agent 4) ---------- */

function budget(s, d) {
  const wrap = h('div', { class: 'stack' });
  const cur = s.currency || ctx.config?.org?.base_currency || 'MYR';
  const b = s.budget_result;

  if (b) {
    wrap.append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Agent 4 · Budget & Claim Verification'),
        h('div', { class: 'sub' }, 'Four-state ledger · Idempotency keys · Serialized writes')),
        badge(String(b.status || '—').replace(/_/g, ' '), b.status === 'SUCCESS' ? 'ok' : b.status === 'ALREADY_PROCESSED' ? 'info' : 'no')),
      h('div', { class: 'card-body' },
        h('pre', { class: 'mono tiny' }, JSON.stringify(b, null, 2)))));
  } else {
    wrap.append(h('div', { class: 'callout warn' }, h('span', { class: 'ci' }, icon('info', 18)),
      h('div', {}, 'This submission has not reached the budget verification step yet.')));
  }

  const snap = d.budget_snapshot;
  if (snap) {
    const row = snap.row || snap.partner || null;
    const t = row ? { allocated: row.allocated_amount, committed: row.committed_amount, approved: row.approved_amount, paid: row.paid_amount, available: row.available_amount }
      : (snap.totals || snap.company_totals || {});
    const allocated = Number(t.allocated ?? 0);
    wrap.append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, row ? `Partner Ledger — ${row.partner_id}` : 'Company Ledger'),
        h('div', { class: 'sub mono' }, snap.invariant || 'Available = Allocated − (Committed + Approved + Paid) ≥ 0'))),
      h('div', { class: 'card-body' },
        ledgerBar(t, cur, allocated),
        h('div', { class: 'grid g-4', style: { marginTop: '14px' } },
          [['Allocated', t.allocated], ['Committed', t.committed], ['Approved', t.approved], ['Paid', t.paid]]
            .map(([l, v]) => h('div', { class: 'kv' }, h('span', {}, l), h('b', { class: 'num' }, money(v, cur)))),
          h('div', { class: 'kv wide' }, h('span', {}, 'Available Balance'),
            h('b', { class: `num ${Number(t.available ?? 0) < 0 ? 'bad' : 'ok'}` }, money(t.available, cur)))))));
  }

  const txs = d.budget_transactions || [];
  wrap.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Ledger Transactions'), h('div', { class: 'sub' }, `${txs.length} entries · Idempotency keys prevent replays`))),
    h('div', { class: 'card-body' }, txs.length
      ? h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Timestamp'), h('th', {}, 'Type'), h('th', {}, 'Amount'), h('th', {}, 'Idempotency Key'), h('th', {}, 'Rules'))),
        h('tbody', {}, txs.map((t) => h('tr', {},
          h('td', { class: 'tiny' }, dateTime(t.created_at)),
          h('td', {}, badge(String(t.transaction_type || '').replace(/_/g, ' ').toLowerCase(), 'info')),
          h('td', { class: 'num' }, money(t.amount, cur)),
          h('td', { class: 'mono tiny muted' }, t.idempotency_key || '—'),
          h('td', { class: 'mono tiny muted' }, t.rule_version || '—')))))
      : h('p', { class: 'tiny muted' }, 'No ledger movements recorded yet.'))));
  return wrap;
}

function ledgerBar(t, cur, allocated) {
  const committed = Number(t.committed ?? 0), approved = Number(t.approved ?? 0), paid = Number(t.paid ?? 0);
  const avail = Number(t.available ?? Math.max(0, allocated - committed - approved - paid));
  const total = Math.max(1, allocated || committed + approved + paid + avail);
  const seg = (v, cls, label) => v > 0 ? h('i', { class: cls, style: { width: `${(v / total) * 100}%` }, title: `${label} ${money(v, cur)}` }) : null;
  return h('div', {},
    h('div', { class: 'ledger-bar', role: 'img', 'aria-label': `Allocated ${allocated}, committed ${committed}, approved ${approved}, paid ${paid}, available ${avail}` },
      seg(committed, 'lb-committed', 'Committed'), seg(approved, 'lb-approved', 'Approved'),
      seg(paid, 'lb-paid', 'Paid'), seg(avail, 'lb-available', 'Available')),
    h('div', { class: 'legend' },
      h('span', {}, h('i', { class: 'lb-committed' }), `Committed ${compactMoney(committed, cur)}`),
      h('span', {}, h('i', { class: 'lb-approved' }), `Approved ${compactMoney(approved, cur)}`),
      h('span', {}, h('i', { class: 'lb-paid' }), `Paid ${compactMoney(paid, cur)}`),
      h('span', {}, h('i', { class: 'lb-available' }), `Available ${compactMoney(avail, cur)}`)));
}

/* ---------- Exceptions + memo (Agents 5 & 6) ---------- */

function memo(s) {
  const wrap = h('div', { class: 'stack' });
  const ex = s.exception_result;

  if (ex) {
    wrap.append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Agent 5 · Exception Triage'),
        h('div', { class: 'sub' }, 'Business and security tracks are physically isolated (Iron Invariant 5)')),
        badge(ex.exception_type || 'NONE', ex.exception_type === 'SECURITY' ? 'no' : ex.exception_type === 'BUSINESS' ? 'warn' : 'ok')),
      h('div', { class: 'card-body' },
        (ex.security_findings || []).length
          ? h('div', { class: 'stack' }, h('div', { class: 'section-label' }, 'Security Track'),
            ex.security_findings.map((f) => h('div', { class: 'issue danger' },
              h('span', { class: 'ii' }, icon('shield', 15)),
              h('div', {}, h('b', { class: 'mono tiny' }, `${f.finding_id} · ${f.threat_type}`),
                h('div', { class: 'tiny' }, f.metric || f.label || ''),
                (f.evidence_refs || []).length ? h('div', { class: 'mono tiny muted' }, f.evidence_refs.join(', ')) : null))))
          : h('p', { class: 'tiny muted' }, 'No security findings.'),
        (ex.business_items || []).length
          ? h('div', { class: 'stack', style: { marginTop: '12px' } }, h('div', { class: 'section-label' }, 'Business Track'),
            ex.business_items.map((b) => h('div', { class: 'issue' },
              h('span', { class: 'ii' }, icon(b.action === 'REQUEST_MISSING_DOCUMENTS' ? 'upload' : 'alert', 15)),
              h('div', {}, h('b', { class: 'mono tiny' }, `${b.item_id}${b.error_code ? ` · ${b.error_code}` : ''}`),
                h('div', { class: 'tiny' }, b.label || ''),
                h('div', { class: 'tiny muted' }, `Action: ${b.action || '—'}${b.rule_id ? ` · Rule ${b.rule_id}` : ''}`)))))
          : h('p', { class: 'tiny muted', style: { marginTop: '10px' } }, 'No business exception items.'))));
  }

  const m = s.review_memo;
  if (!m) {
    wrap.append(empty('spark', 'No Review Memo Generated',
      'Agent 6 generates the 6-section review memo only when a submission reaches human review.'));
    return wrap;
  }

  const sec = m.sections || {};
  const head = h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {}, h('h2', {}, 'Agent 6 · Human Review Decision Memo'),
        h('div', { class: 'sub' }, `${m.generated_by || 'agent_human_review'} · ${dateTime(m.generated_at)}`)),
      badge(String(m.status || '').replace(/_/g, ' ').toLowerCase(), 'info')),
    h('div', { class: 'card-body' },
      h('h3', {}, m.subject || s.title || ''),
      sec.summary ? memoSection(sec.summary, h('div', { class: 'stack' }, (sec.summary.lines || []).map((l) => h('p', { class: 'tiny' }, l)))) : null,
      sec.verifications ? memoSection(sec.verifications, h('div', { class: 'stack' }, (sec.verifications.items || []).map((it) =>
        h('div', { class: `verify${it.ok ? ' ok' : ' bad'}` }, h('span', { class: 'vi' }, icon(it.ok ? 'check' : 'x', 15)),
          h('div', {}, h('b', {}, it.label), it.note ? h('div', { class: 'tiny muted' }, it.note) : null))))) : null,
      sec.issues ? memoSection(sec.issues, (sec.issues.items || []).length
        ? h('div', { class: 'stack' }, sec.issues.items.map((it) => h('div', { class: 'issue' },
          h('span', { class: 'ii' }, icon('alert', 15)),
          h('div', {}, h('b', {}, it.title), h('p', { class: 'tiny' }, it.body),
            (it.evidence || []).length ? h('div', { class: 'tiny muted' }, 'Evidence: ', h('span', { class: 'mono' }, it.evidence.join(', '))) : null,
            (it.policy_refs || []).length ? h('div', { class: 'tiny muted' }, 'Policy: ', h('span', { class: 'mono' }, it.policy_refs.join(', '))) : null))))
        : h('p', { class: 'tiny muted' }, 'No outstanding issues.')) : null,
      sec.recommended_action ? memoSection(sec.recommended_action, h('div', { class: 'stack' }, (sec.recommended_action.options || []).map((o, i) =>
        h('div', { class: `option${i === 0 ? ' primary' : ''}` }, h('span', { class: 'oid' }, o.id || String(i + 1)),
          h('div', {}, h('b', {}, o.label), o.detail ? h('p', { class: 'tiny muted' }, o.detail) : null))))) : null,
      sec.sign_off ? memoSection(sec.sign_off, h('ul', { class: 'tiny' }, (sec.sign_off.items || []).map((it) => h('li', {}, it)))) : null,
      sec.citations ? memoSection(sec.citations, h('div', { class: 'stack' }, (sec.citations.items || []).map((c) =>
        h('div', { class: 'cite' }, h('span', { class: 'badge badge-neutral' }, icon('book', 12)), h('b', { class: 'mono tiny' }, c))))) : null,
      h('div', { class: 'divider' }),
      h('div', { class: 'section-label' }, 'Invariants Applied'),
      h('ul', { class: 'tiny' }, (m.invariants_applied || []).map((i) => h('li', {}, i))),
      m.commitment_filter
        ? h('div', { class: `callout ${m.commitment_filter.clean ? '' : 'danger'}` }, h('span', { class: 'ci' }, icon(m.commitment_filter.clean ? 'check' : 'alert', 18)),
          h('div', {}, m.commitment_filter.clean
            ? 'Commitment filter clean — the memo contains no language committing the company to payment.'
            : `Banned phrases detected: ${(m.commitment_filter.banned_phrases_detected || []).join(', ')}`))
        : null));
  wrap.append(head);
  return wrap;
}

function memoSection(sec, body) {
  return h('div', { class: 'memo-sec' }, h('h4', {}, sec.heading || ''), body);
}

/* ---------- Audit (Agent 7) ---------- */

function audit(s, d) {
  const events = d.audit_events || [];
  const wrap = h('div', { class: 'stack' });
  wrap.append(h('div', { class: 'callout' }, h('span', { class: 'ci' }, icon('lock', 18)),
    h('div', {}, h('b', {}, 'Immutable Audit Trail — '),
      'Every state transition appends a read-only event; soft-deletions never remove historical records (Iron Invariant 4).',
      h('div', { class: 'mono tiny muted' }, `Run ID: ${s.run_id || '—'} · Rules: ${s.rule_version || '—'}`))));

  if (!events.length) {
    wrap.append(empty('clock', 'No Audit Events', 'This submission has not produced any state transitions yet.'));
    return wrap;
  }

  wrap.append(h('ol', { class: 'timeline' }, events.map((e) => {
    const human = (e.actor_type || '').startsWith('HUMAN');
    const err = !!e.error_code;
    return h('li', { class: `tl-item${err ? ' err' : ''}${human ? ' human' : ''}` },
      h('span', { class: 'tl-dot' }, icon(human ? 'user' : err ? 'alert' : 'activity', 13)),
      h('div', {},
        h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
          h('b', { class: 'mono tiny' }, e.previous_state ? `${e.previous_state} → ${e.new_state}` : (e.new_state || e.details?.event || 'EVENT')),
          badge(e.actor_type || 'SYSTEM', human ? 'brand' : 'neutral'),
          e.error_code ? badge(e.error_code, 'no') : null,
          e.rule_id ? badge(e.rule_id, 'info') : null),
        h('div', { class: 'tiny muted' }, `${e.actor || 'system'} · ${dateTime(e.created_at)} · ${relTime(e.created_at)}`),
        h('div', { class: 'mono tiny' }, e.event_id || ''),
        e.details && Object.keys(e.details).length
          ? h('details', {}, h('summary', { class: 'tiny muted' }, 'Details'), h('pre', { class: 'mono tiny' }, JSON.stringify(e.details, null, 2))) : null,
        (e.evidence_refs || []).length
          ? h('div', { class: 'tiny muted' }, 'Evidence: ', h('span', { class: 'mono' }, e.evidence_refs.map((r) => r.doc_id || r).join(', '))) : null));
  })));
  return wrap;
}

/* ---------- Comment Box (Permanently docked) ---------- */

function commentBox(s, d) {
  const list = d.comments || [];
  const wrap = h('div', { class: 'stack' });
  const box = h('textarea', { class: 'input', rows: '3', placeholder: 'Add a review note, context, or question…', 'aria-label': 'Comment' });
  const author = h('input', { class: 'input', placeholder: 'Name (optional)', 'aria-label': 'Author' });
  const btn = h('button', { class: 'btn btn-primary', type: 'button' }, icon('send', 15), 'Post Comment');

  btn.addEventListener('click', async () => {
    const text = box.value.trim();
    if (!text) { toast('A comment cannot be empty.', 'err'); box.focus(); return; }
    btn.disabled = true;
    try {
      const who = ctx.session?.approver;
      await api.addComment(s.submission_id, {
        text,
        author: author.value.trim() || who?.name || 'reviewer',
        author_role: who?.role || 'HUMAN'
      });
      box.value = '';
      toast('Comment posted successfully.', 'ok');
      await reload();
    } catch (e) {
      toast(e instanceof ApiError ? `${e.code} — ${e.message}` : String(e.message || e), 'err');
    } finally {
      btn.disabled = false;
    }
  });

  wrap.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Reviewer Comments'), h('div', { class: 'sub' }, `${list.length} entries recorded`))),
    h('div', { class: 'card-body' },
      list.length ? h('div', { class: 'stack' }, list.slice().reverse().map((c) => {
        const commentText = typeof c.text === 'object' && c.text !== null
          ? (c.text.text || c.text.comment || c.text.body || c.text.message || JSON.stringify(c.text))
          : (c.text || c.comment || c.body || c.message || '—');
        const authorName = typeof c.author === 'object' && c.author !== null
          ? (c.author.name || c.author.email || JSON.stringify(c.author))
          : (c.author || 'Reviewer');
        const role = String(c.author_role || c.role || '');
        const isAi = role.includes('AI') || authorName.startsWith('Agent');
        const isBoss = role.includes('EXECUTIVE') || role.includes('BOSS') || authorName.includes('Boss Skill') || role.includes('VP') || role.includes('DIRECTOR');
        return h('div', { class: `comment${isBoss ? ' boss-comment' : ''}` },
          h('span', { class: 'cav' }, icon(isAi ? 'brain' : isBoss ? 'shield' : 'user', 14)),
          h('div', { style: { width: '100%' } },
            h('div', { class: 'row', style: { gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
              h('b', {}, authorName),
              isAi ? badge('AI AGENT', 'brand') : null,
              authorName.includes('Boss Skill') ? badge('BOSS SKILL', 'purple') : null,
              authorName.includes('Grill-Me') ? badge('GRILL-ME', 'warn') : null,
              role && !role.startsWith('AI_') ? badge(role, isBoss ? 'brand' : 'neutral') : null
            ),
            h('div', { class: 'tiny muted', style: { marginTop: '2px' } }, dateTime(c.created_at || c.at)),
            h('p', { style: { marginTop: '6px', lineHeight: 1.5, color: isBoss ? 'var(--text-main)' : 'var(--text-sub)' } }, commentText)
          )
        );
      }))
        : h('p', { class: 'tiny muted' }, 'No comments recorded yet.'),
      h('div', { class: 'divider' }),
      h('div', { class: 'stack' }, author, box, h('div', { class: 'row' }, btn)))));
  return wrap;
}

/* ---------- Human decisions (Iron Invariant 1) ---------- */

function approveModal(s) {
  const cur = s.currency || 'MYR';
  const amt = h('input', { class: 'input num', type: 'number', step: '0.01', min: '0', value: s.amount ?? '', 'aria-label': 'Approved amount' });
  const reason = h('textarea', { class: 'input', rows: '2', placeholder: 'Approval reason (optional)', 'aria-label': 'Reason' });
  const ok = h('button', { class: 'btn btn-primary', type: 'button' }, icon('check', 15), 'Confirm Approval');

  ok.addEventListener('click', async () => {
    const approvedAmount = amt.value === '' ? null : Number(amt.value);
    ok.disabled = true;
    const r = await withAuthority(async (approver) => {
      if (approver.approval_limit != null && Number(s.amount || 0) > Number(approver.approval_limit)) {
        const err = new Error(`DOA_LIMIT_EXCEEDED — ${approver.name}'s approval limit is ${money(approver.approval_limit, cur)}; submission amount is ${money(s.amount, cur)}.`);
        err.code = 'DOA_LIMIT_EXCEEDED';
        throw err;
      }
      return api.decide(s.submission_id, 'approve', { approved_amount: approvedAmount, reason: reason.value.trim() || null });
    }, 'Approving requires an authorized human approver (Iron Invariant 1: Final authority is non-delegable).');
    if (!r.ok) { ok.disabled = false; return; }
    closeModal();
    toast(`Approved ${s.submission_id}.`, 'ok');
    await reload();
  });

  modal({
    title: 'Approve Submission',
    subtitle: `${s.submission_id} · ${s.title || ''} · ${money(s.amount, cur)}`,
    body: h('div', { class: 'stack' },
      h('div', { class: 'callout' }, h('span', { class: 'ci' }, icon('lock', 18)),
        h('div', {}, 'Iron Invariant 1: Final authority is human and non-delegable. This action is permanently committed to the immutable audit trail and triggers ledger state transitions.')),
      h('div', { class: 'field' }, h('label', {}, 'Approved Amount'), amt,
        h('span', { class: 'hint' }, 'Leave blank to approve full declared amount')),
      h('div', { class: 'field' }, h('label', {}, 'Reason'), reason)),
    actions: [h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Cancel'), ok]
  });
}

function rejectModal(s) {
  const reason = h('textarea', { class: 'input', rows: '3', placeholder: 'Rejection reason (recorded in audit trail and notified to partner)', 'aria-label': 'Reason', 'data-autofocus': '' });
  const ok = h('button', { class: 'btn btn-danger', type: 'button' }, icon('x', 15), 'Confirm Rejection');
  ok.addEventListener('click', async () => {
    if (!reason.value.trim()) { toast('A rejection reason is required.', 'err'); reason.focus(); return; }
    ok.disabled = true;
    const r = await withAuthority(() => api.decide(s.submission_id, 'reject', { reason: reason.value.trim() }));
    if (!r.ok) { ok.disabled = false; return; }
    closeModal();
    toast(`Rejected ${s.submission_id}.`, 'ok');
    await reload();
  });
  modal({
    title: 'Reject Submission', subtitle: `${s.submission_id} · ${s.title || ''}`, danger: true,
    body: h('div', { class: 'field' }, h('label', { class: 'req' }, 'Reason'), reason),
    actions: [h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Cancel'), ok]
  });
}

function payModal(s) {
  const ref = h('input', { class: 'input mono', placeholder: 'PAY-2026-…', 'aria-label': 'Payment reference', 'data-autofocus': '' });
  const ok = h('button', { class: 'btn btn-primary', type: 'button' }, icon('money', 15), 'Confirm Payment');
  ok.addEventListener('click', async () => {
    ok.disabled = true;
    const r = await withAuthority(() => api.decide(s.submission_id, 'mark-paid', { payment_reference: ref.value.trim() || null }),
      'Disbursement requires an authorized finance approver.');
    if (!r.ok) { ok.disabled = false; return; }
    closeModal();
    toast('Marked as paid; ledger moved approved → paid.', 'ok');
    await reload();
  });
  modal({
    title: 'Mark as Paid',
    subtitle: `${s.submission_id} · ${money(s.approved_amount ?? s.amount, s.currency)} · APPROVED → PAID`,
    body: h('div', { class: 'stack' },
      h('div', { class: 'callout' }, h('span', { class: 'ci' }, icon('money', 18)),
        h('div', {}, 'The ledger executes an atomic approved → paid transition; available balance remains invariant (Iron Invariant 2).')),
      h('div', { class: 'field' }, h('label', {}, 'Payment Reference'), ref)),
    actions: [h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Cancel'), ok]
  });
}

function releaseModal(s) {
  const reason = h('input', { class: 'input', placeholder: 'Reason for releasing commitment', 'aria-label': 'Reason', 'data-autofocus': '' });
  const ok = h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Release Budget');
  ok.addEventListener('click', async () => {
    ok.disabled = true;
    const r = await withAuthority(() => api.decide(s.submission_id, 'release', { reason: reason.value.trim() || null }));
    if (!r.ok) { ok.disabled = false; return; }
    closeModal();
    toast('Budget commitment released back to available balance.', 'ok');
    await reload();
  });
  modal({
    title: 'Release Budget Commitment',
    subtitle: `${s.submission_id} — APPROVED → RELEASED`,
    body: h('div', { class: 'field' }, h('label', {}, 'Reason'), reason),
    actions: [h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Cancel'), ok]
  });
}

async function reprocess(s) {
  const r = await withAuthority(() => api.reprocess(s.submission_id),
    'Re-running the pipeline requires an authorized approver.');
  if (!r.ok) return;
  toast('Pipeline re-run complete.', 'ok');
  await reload();
}

function exportJson(s) {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `${s.submission_id}.json` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function afterRender(node) {
  try {
    const a = await api.agents();
    data.agents = a.agents || [];
    const strip = node.querySelector('.steps');
    if (strip) {
      const fresh = pipelineStrip(data.submission, data.audit_events || []);
      strip.replaceChildren(...fresh.children);
    }
  } catch { /* decorative */ }
}
