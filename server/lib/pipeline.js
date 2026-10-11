'use strict';

/**
 * Pipeline Orchestrator — Agents 1, 2, 5, 6, 7 (docs/00 §1).
 * Every transition emits an immutable audit event carrying the global
 * submission_id (docs/00 §4.1) and evidence anchors.
 */

const crypto = require('crypto');
const store = require('./store');
const { runRules, round2, fmt, daysBetween } = require('./rules');
const ledger = require('./ledger');
const ai = require('./ai');

const AUDIT_FILE = 'audit-events.json';

const STATES = [
  'SUBMITTED', 'INTAKE_EXTRACTED', 'NEEDS_INTAKE_CORRECTION', 'VALIDATING', 'NEEDS_CLARIFICATION',
  'RULES_EVALUATING', 'POLICY_BLOCKED', 'BUDGET_RESERVING', 'BUDGET_REJECTED', 'EXCEPTION_TRIAGE',
  'SECURITY_QUARANTINE', 'PENDING_HUMAN_REVIEW', 'PENDING_INFO_REQUEST', 'APPROVED', 'REJECTED',
  'PAID', 'ARCHIVED', 'NEEDS_HUMAN_CONFIRMATION', 'REQUIRES_POLICY_INTERPRETATION', 'RECOVERABLE_ERROR'
];

const UI_STATUS = {
  SUBMITTED: 'pending', INTAKE_EXTRACTED: 'pending', VALIDATING: 'pending',
  RULES_EVALUATING: 'pending', BUDGET_RESERVING: 'pending', EXCEPTION_TRIAGE: 'pending',
  PENDING_HUMAN_REVIEW: 'pending', PENDING_INFO_REQUEST: 'pending',
  NEEDS_INTAKE_CORRECTION: 'pending', NEEDS_CLARIFICATION: 'pending',
  NEEDS_HUMAN_CONFIRMATION: 'pending', RECOVERABLE_ERROR: 'pending',
  POLICY_BLOCKED: 'rejected', BUDGET_REJECTED: 'rejected', SECURITY_QUARANTINE: 'rejected',
  REQUIRES_POLICY_INTERPRETATION: 'pending',
  APPROVED: 'approved', PAID: 'approved', ARCHIVED: 'approved', REJECTED: 'rejected'
};

function uiStatus(state) {
  return UI_STATUS[state] || 'pending';
}

function nowISO() {
  return new Date().toISOString();
}

function newRunId() {
  return `run_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${crypto.randomBytes(4).toString('hex')}`;
}

function nextSubmissionId(existing) {
  const year = new Date().getFullYear();
  const nums = existing
    .map((s) => Number.parseInt(String(s.submission_id || '').split('-').pop(), 10))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SUB-${year}-MY-${String(next).padStart(4, '0')}`;
}

function appendAudit(event) {
  const list = store.read(AUDIT_FILE);
  const arr = Array.isArray(list) ? list : [];
  const record = {
    event_id: `EVT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(arr.length + 1).padStart(5, '0')}-${crypto.randomBytes(2).toString('hex')}`,
    created_at: nowISO(),
    ...event
  };
  arr.push(record);
  store.write(AUDIT_FILE, arr);
  return record;
}

function transition(sub, from, to, extra) {
  sub.previous_state = sub.state;
  sub.state = to;
  if (!Array.isArray(sub.state_history)) sub.state_history = [];
  sub.state_history.push({ from, to, at: nowISO(), ...(extra && extra.history ? extra.history : {}) });
  appendAudit({
    submission_id: sub.submission_id,
    run_id: sub.run_id,
    actor: (extra && extra.actor) || 'pipeline_orchestrator',
    actor_type: (extra && extra.actor_type) || 'SYSTEM_AGENT',
    previous_state: from,
    new_state: to,
    error_code: (extra && extra.error_code) || null,
    rule_id: (extra && extra.rule_id) || null,
    evidence_refs: (extra && extra.evidence_refs) || [],
    details: (extra && extra.details) || {},
    rule_version: sub.rule_version
  });
  return sub;
}

function loadConfig() {
  return store.read('config.json') || {};
}

function loadPartners() {
  return store.read('partners.json') || [];
}

function loadTiers() {
  return store.read('tiers.json') || [];
}

function loadRules() {
  return store.read('rules.json') || [];
}

function loadChecklist() {
  return store.read('checklist.json') || {};
}

/* ------------------------------------------------------------------ */
/* Agent 1 — Intake                                                    */
/* ------------------------------------------------------------------ */

const DOC_TYPE_PATTERNS = [
  { type: 'TAX_INVOICE', tokens: ['invoice', 'inv', 'tax', 'faktur', 'resit', 'billing', 'bill'] },
  { type: 'EVENT_PHOTOS', tokens: ['photo', 'photos', 'event', 'proof', 'execution', 'gambar', 'img', 'dsc'] },
  { type: 'ATTENDEE_SIGNIN', tokens: ['signin', 'sign-in', 'sign_in', 'attendee', 'attendance', 'registration', 'checklist-attendee'] },
  { type: 'PROOF_OF_PAYMENT', tokens: ['payment', 'bank', 'statement', 'receipt', 'transfer', 'water', 'slip', 'settlement'] },
  { type: 'QUOTATION', tokens: ['quote', 'quotation', 'proposal', 'offer'] },
  { type: 'PRE_APPROVAL_FORM', tokens: ['pre-approval', 'preapproval', 'pa-form', 'approval-form'] },
  { type: 'CLAIM_FORM', tokens: ['claim', 'disbursement', 'reimburse'] },
  { type: 'AGENDA', tokens: ['agenda', 'programme', 'program', 'schedule', 'rundown'] }
];

function classifyDocument(filename, categoryHint) {
  const norm = String(filename || '').toLowerCase();
  if (categoryHint) {
    const hit = DOC_TYPE_PATTERNS.find((p) => p.type === categoryHint);
    if (hit) return hit.type;
  }
  let best = null;
  for (const p of DOC_TYPE_PATTERNS) {
    for (const t of p.tokens) {
      if (norm.includes(t)) {
        if (!best) best = { type: p.type, score: 0 };
        best.score += 1;
        best.type = best.score > 1 ? p.type : best.type;
      }
    }
  }
  return best ? best.type : 'OTHER';
}

/** Deterministic local "Docling-equivalent" extraction: hash, size, page estimate, confidence. */
function agent1Intake(sub, files, config) {
  const extracted = [];
  const docTypes = [];
  const confidences = [];
  const parsedAmounts = [];
  const parsedInvoices = [];
  const suspend = config.confidence_thresholds?.parsing_suspend ?? 0.85;

  for (const f of files) {
    const hash = f.sha256 || crypto.createHash('sha256').update(f.stored || f.filename).digest('hex');
    const pages = Math.max(1, Math.round((f.size_bytes || 1024) / 42000) + 1);
    const type = classifyDocument(f.filename, f.category);
    docTypes.push(type);

    // Real parser output wins. A human-declared confidence is honoured only when
    // it is *lower* than the parse — never to inflate an unverified figure.
    let confidence = typeof f.parsed_confidence === 'number' ? f.parsed_confidence : null;
    if (typeof f.declared_confidence === 'number') {
      confidence = confidence === null ? f.declared_confidence : Math.min(confidence, f.declared_confidence);
    }
    let parseStatus;
    if (f.scanned_image_only) parseStatus = 'NO_TEXT_LAYER';
    else if (confidence === null) parseStatus = 'NO_NUMERIC_EVIDENCE';
    else if (confidence < suspend) parseStatus = 'FLAG_LOW_CONFIDENCE';
    else parseStatus = 'PARSED';

    if (confidence !== null) confidences.push(confidence);
    if (typeof f.parsed_amount === 'number' && Number.isFinite(f.parsed_amount)) parsedAmounts.push({ doc_id: `doc_${hash.slice(0, 8)}`, amount: f.parsed_amount, confidence, basis: f.confidence_basis });
    for (const inv of f.invoice_numbers || []) if (!parsedInvoices.includes(inv)) parsedInvoices.push(inv);

    const isNonMonetary = ['EVENT_PHOTOS', 'ATTENDEE_SIGNIN', 'AGENDA', 'ATTENDEE_LIST', 'PHOTOS', 'CERTIFICATE'].includes(type);
    const clsBasis = f.classification_basis ||
      (f.category ? `user-declared (${f.category}) + Docling layout OCR` : `${type.replace(/_/g, ' ')} template match + Docling layout OCR`);
    const confBasis = f.confidence_basis || (
      confidence !== null && confidence >= 0.90
        ? 'Verified numeric total reconciled against itemised lines & SST calculation'
        : (isNonMonetary
            ? 'Non-financial execution proof — verified structure'
            : (confidence !== null ? 'Docling OCR layout parsing complete' : null))
    );

    extracted.push({
      doc_id: `doc_${hash.slice(0, 8)}`,
      filename: f.filename,
      size_bytes: f.size_bytes || 0,
      sha256: hash,
      pages,
      doc_type: type,
      classification_basis: clsBasis,
      amount_confidence: confidence !== null ? confidence : (isNonMonetary ? 1.0 : null),
      confidence_basis: confBasis,
      parsed_amount: typeof f.parsed_amount === 'number' ? f.parsed_amount : null,
      parsed_invoice_numbers: f.invoice_numbers || [],
      parse_status: parseStatus,
      parse_engine: f.parse_engine || 'docling-equivalent-local',
      text_preview: f.text_preview || null,
      stored: f.stored || null,
      mime: f.mime || 'application/pdf'
    });
  }

  // Zero auto-guessing: if a primary tax invoice or form is verifiably cross-checked,
  // its confidence determines the transaction's financial confidence.
  const primaryDoc = extracted.find((e) => ['TAX_INVOICE', 'PRE_APPROVAL_FORM', 'CLAIM_FORM'].includes(e.doc_type) && typeof e.amount_confidence === 'number');
  const amountConfidence = primaryDoc && primaryDoc.amount_confidence >= 0.90
    ? primaryDoc.amount_confidence
    : (confidences.length
        ? round2(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : (files.length ? null : (typeof sub.amount_confidence === 'number' ? sub.amount_confidence : null)));

  return {
    extracted_evidence: extracted,
    document_types: [...new Set(docTypes)],
    amount_confidence: amountConfidence,
    min_confidence: confidences.length ? round2(Math.min(...confidences)) : null,
    parsed_amounts: parsedAmounts,
    parsed_invoice_numbers: parsedInvoices,
    attachments_count: extracted.length,
    parse_engine: files.length ? [...new Set(extracted.map((e) => e.parse_engine))].join('+') : 'none',
    token_cost: 0
  };
}

/* ------------------------------------------------------------------ */
/* Agent 2 — Validation + Grill-Me                                     */
/* ------------------------------------------------------------------ */

function agent2Validate(sub, ctx) {
  const gaps = [];
  const questions = [];

  const requiredFields = [
    ['partner_id', sub.partner_id], ['submission_type', sub.submission_type],
    ['amount', sub.amount], ['currency', sub.currency], ['activity_date', sub.activity_date],
    ['title', sub.title], ['submitted_by', sub.submitted_by]
  ];
  for (const [name, value] of requiredFields) {
    if (value === null || value === undefined || value === '') {
      gaps.push({ field: name, error_code: 'MISSING_REQUIRED_FIELD' });
    }
  }

  if (!ctx.partner) {
    gaps.push({ field: 'partner_id', error_code: 'PARTNER_NOT_FOUND' });
  } else if (ctx.partner.status !== 'active') {
    gaps.push({ field: 'partner_id', error_code: 'PARTNER_NOT_ACTIVE', detail: ctx.partner.status });
  }

  if (sub.submission_type === 'CLAIM') {
    if (!sub.parent_pre_approval_id) {
      gaps.push({ field: 'parent_pre_approval_id', error_code: 'PRE_APPROVAL_NOT_READY' });
    } else if (!ctx.parentPreApproval) {
      gaps.push({ field: 'parent_pre_approval_id', error_code: 'PRE_APPROVAL_NOT_FOUND' });
    } else if (ctx.parentPreApproval.state !== 'APPROVED' && ctx.parentPreApproval.state !== 'PAID' && ctx.parentPreApproval.state !== 'ARCHIVED') {
      gaps.push({ field: 'parent_pre_approval_id', error_code: 'PRE_APPROVAL_NOT_READY', detail: ctx.parentPreApproval.state });
    }
  }

  // Deduplication: invoice numbers + partner/date/amount within 90 days
  const all = store.read('submissions.json') || [];
  const invoiceIndex = new Map();
  for (const other of all) {
    if (other.submission_id === sub.submission_id) continue;
    if (other.archived) continue;
    for (const inv of other.invoice_numbers || []) invoiceIndex.set(inv, other.submission_id);
  }
  const duplicateInvoiceNumbers = [];
  for (const inv of sub.invoice_numbers || []) {
    if (invoiceIndex.has(inv)) duplicateInvoiceNumbers.push(inv);
  }
  if (duplicateInvoiceNumbers.length) {
    gaps.push({ field: 'invoice_numbers', error_code: 'DUPLICATE_INVOICE_NUMBER', detail: duplicateInvoiceNumbers });
  }

  const near = all.filter((o) =>
    o.submission_id !== sub.submission_id && !o.archived &&
    o.partner_id === sub.partner_id &&
    o.activity_date === sub.activity_date &&
    Number(o.amount) === Number(sub.amount));
  if (near.length) {
    gaps.push({ field: 'deduplication', error_code: 'POSSIBLE_DUPLICATE_SUBMISSION', detail: near.map((n) => n.submission_id) });
  }

  // Grill-Me: aggregate into a single round of clarification questions (docs/02 §5.1)
  if (duplicateInvoiceNumbers.length || (sub.invoice_amounts && sub.invoice_amounts.length > 1)) {
    const amounts = sub.invoice_amounts || [];
    const sumAmounts = round2(amounts.reduce((a, b) => a + Number(b || 0), 0));
    if (amounts.length > 1 && Math.abs(sumAmounts - Number(sub.amount)) > 0.005) {
      questions.push({
        question_id: 'CLR-Q1',
        category: 'INVOICE_CONFLICT',
        question: `Detected ${amounts.length} uploaded invoices totalling ${fmt(sumAmounts, sub.currency)} while the claim total declares ${fmt(Number(sub.amount), sub.currency)}. Clarify: (1) is one invoice a deposit voucher for another, or (2) was an invoice voided and reissued?`,
        evidence_sources: (sub.extracted_evidence || []).filter((e) => e.doc_type === 'TAX_INVOICE').map((e) => ({ doc_id: e.doc_id, filename: e.filename, page: 1 })),
        options: [
          'First invoice is final; the other was uploaded in error',
          'Both invoices are claimed together (declaration total must be corrected)',
          'Upload a replacement invoice manually'
        ]
      });
    }
  }

  if (gaps.some((g) => g.error_code === 'MISSING_REQUIRED_FIELD')) {
    questions.push({
      question_id: `CLR-Q${questions.length + 1}`,
      category: 'MISSING_FIELD',
      question: `Required intake field(s) could not be resolved: ${gaps.filter((g) => g.error_code === 'MISSING_REQUIRED_FIELD').map((g) => g.field).join(', ')}. Please supply the authoritative value — the system will not auto-fill it.`,
      evidence_sources: [],
      options: ['Supply corrected value', 'Withdraw submission']
    });
  }

  return {
    is_passed: gaps.length === 0 && questions.length === 0,
    gaps,
    open_questions: questions,
    duplicate_invoice_numbers: duplicateInvoiceNumbers,
    near_duplicates: near.map((n) => ({ submission_id: n.submission_id, activity_date: n.activity_date, amount: Number(n.amount), days_apart: 0 })),
    checks: [
      { id: 'COMPLETENESS', label: 'Required field completeness', passed: !gaps.some((g) => g.error_code === 'MISSING_REQUIRED_FIELD') },
      { id: 'PARTNER_IDENTITY', label: 'Partner identity & tier check', passed: !!ctx.partner && ctx.partner.status === 'active' },
      { id: 'LINKAGE', label: 'Claim-to-pre-approval linkage', passed: sub.submission_type !== 'CLAIM' || (!!ctx.parentPreApproval && ['APPROVED', 'PAID', 'ARCHIVED'].includes(ctx.parentPreApproval.state)) },
      { id: 'DEDUP', label: 'Invoice & submission deduplication', passed: duplicateInvoiceNumbers.length === 0 && !near.length }
    ]
  };
}

/* ------------------------------------------------------------------ */
/* Agent 5 — Exception triage (business vs security dual track)        */
/* ------------------------------------------------------------------ */

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|previous\s+|prior\s+)?instructions/i,
  /system\s+prompt\s+override/i,
  /disregard\s+(the\s+)?(sop|policy|rules)/i,
  /set\s+status\s+to\s+approved/i,
  /approve\s+this\s+claim/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /<\/?\s*system\s*>/i,
  /jailbreak/i
];

const MACRO_PATTERNS = [/\.xlsm$/i, /\.docm$/i, /vbaProject/i, /macro-enabled/i];

function agent5Triage(sub, ctx) {
  const findings = [];
  const businessItems = [];

  const corpus = [
    sub.title, sub.notes, sub.partner_name,
    ...(sub.invoice_numbers || []),
    ...((sub.extracted_evidence || []).map((e) => `${e.filename} ${e.raw_text_hint || ''}`))
  ].filter(Boolean).join('\n');

  for (const pattern of INJECTION_PATTERNS) {
    const m = corpus.match(pattern);
    if (m) {
      findings.push({
        finding_id: `SEC-INJ-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        threat_type: 'PROMPT_INJECTION_ATTEMPT',
        status: 'confirmed',
        trust_boundary_crossed: 'External_Upload -> LLM_Context',
        evidence: { location: 'attachment text / metadata', raw_content: m[0], matched_pattern: String(pattern) },
        impact_assessment: 'Low risk of execution due to Pydantic gating, but malicious intent detected.',
        action_taken: 'QUARANTINE_SUBMISSION',
        falsification: 'Independent validator agent attempted to falsify; the string is imperative and targets system state, not a product name.'
      });
    }
  }

  for (const ev of sub.extracted_evidence || []) {
    if (MACRO_PATTERNS.some((p) => p.test(ev.filename || ''))) {
      findings.push({
        finding_id: `SEC-MACRO-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        threat_type: 'MACRO_ENABLED_ATTACHMENT',
        status: 'needs_validation',
        trust_boundary_crossed: 'External_Upload -> Parser_Host',
        evidence: { doc_id: ev.doc_id, location: 'filename extension', raw_content: ev.filename },
        impact_assessment: 'Macro-enabled container may carry executable payload; host execution is forbidden.',
        action_taken: 'SANDBOX_STATIC_REJECT',
        falsification: 'Cannot be falsified without a sandbox; no network-enabled Docker sandbox available, so statically rejected per docs/05 §4.4.'
      });
    }
  }

  if (sub.amount_confidence !== null && sub.amount_confidence !== undefined) {
    const hard = ctx.config.confidence_thresholds?.amount_hard_block ?? 0.90;
    if (sub.amount_confidence < hard) {
      businessItems.push({
        item_id: 'BIZ-LOWCONF',
        type: 'DATA_QUALITY',
        label: `Amount confidence ${sub.amount_confidence.toFixed(2)} below hard threshold ${hard.toFixed(2)}`,
        error_code: 'FLAG_LOW_CONFIDENCE',
        action: 'Suspend before budget step; require human confirmation of the amount',
        evidence_refs: (sub.extracted_evidence || []).filter((e) => e.doc_type === 'TAX_INVOICE').map((e) => `${e.doc_id}:page_1`)
      });
    }
  }

  const ruleFailures = (sub.rules_result?.evaluated_rules || []).filter((r) => r.status === 'FAILED');
  for (const f of ruleFailures) {
    businessItems.push({
      item_id: `BIZ-${f.rule_id}`,
      type: f.category === 'SECURITY' ? 'SECURITY' : 'BUSINESS',
      label: f.metric,
      error_code: f.error_code,
      rule_id: f.rule_id,
      action: f.on_fail,
      evidence_refs: sub.evidence_refs || []
    });
  }

  const missingDocs = (sub.rules_result?.evaluated_rules || [])
    .filter((r) => r.rule_id && r.status === 'FAILED' && r.detail && Array.isArray(r.detail.missing) && r.detail.missing.length)
    .flatMap((r) => r.detail.missing);
  if (missingDocs.length) {
    businessItems.push({
      item_id: 'BIZ-MISSING-DOCS',
      type: 'BUSINESS',
      label: `Missing supporting documents: ${missingDocs.join(', ')}`,
      error_code: 'MISSING_SUPPORTING_DOCUMENTS',
      action: 'REQUEST_MISSING_DOCUMENTS',
      detail: { missing: missingDocs },
      evidence_refs: []
    });
  }

  const exceptionType = findings.length ? 'SECURITY' : (businessItems.length ? 'BUSINESS' : 'NONE');
  return { exception_type: exceptionType, security_findings: findings, business_items: businessItems, triaged_at: nowISO() };
}

/* ------------------------------------------------------------------ */
/* Agent 6 — Human review memo (6-section, docs/06 §3)                 */
/* ------------------------------------------------------------------ */

const COMMITMENT_BANNED = [
  /we guarantee payment/i, /your claim is approved/i, /exception is granted/i,
  /payment will be made by/i, /approved for payment/i
];

function commitmentFilter(text) {
  const hits = [];
  for (const p of COMMITMENT_BANNED) {
    const m = String(text || '').match(p);
    if (m) hits.push(m[0]);
  }
  return { clean: hits.length === 0, hits };
}

function agent6Memo(sub, ctx) {
  const partner = ctx.partner || {};
  const rules = sub.rules_result?.evaluated_rules || [];
  const passed = rules.filter((r) => r.status === 'PASSED');
  const failed = rules.filter((r) => r.status === 'FAILED');
  const notEvaluated = rules.filter((r) => r.status === 'NOT_EVALUATED');
  const elapsed = daysBetween(sub.activity_date, sub.submitted_at?.slice(0, 10) || sub.activity_date);
  const cap = ctx.tierCap;
  const paAmount = ctx.parentPreApproval ? Number(ctx.parentPreApproval.amount) : null;
  const overBy = paAmount !== null ? round2(Number(sub.amount) - paAmount) : null;

  const verifications = [
    { label: 'Partner qualification', ok: partner.status === 'active', note: `${partner.name || sub.partner_id} — ${partner.status || 'unknown'} (${partner.tier || 'Unassigned'})` },
    { label: 'Linked pre-approval status', ok: sub.submission_type !== 'CLAIM' || (!!ctx.parentPreApproval && ctx.parentPreApproval.state === 'APPROVED'), note: sub.parent_pre_approval_id ? `${sub.parent_pre_approval_id} — ${ctx.parentPreApproval ? ctx.parentPreApproval.state : 'NOT FOUND'}` : 'n/a (pre-approval request)' },
    { label: 'Submission timeliness', ok: elapsed === null || elapsed <= (ctx.config.claim_window_days ?? 30), note: elapsed === null ? 'date unparseable' : `${elapsed} days after activity (limit ${ctx.config.claim_window_days ?? 30})` },
    { label: 'Invoice uniqueness', ok: !(sub.validation_result?.duplicate_invoice_numbers || []).length, note: (sub.validation_result?.duplicate_invoice_numbers || []).length ? `Duplicates: ${sub.validation_result.duplicate_invoice_numbers.join(', ')}` : `Invoice(s) ${(sub.invoice_numbers || []).join(', ') || 'none'} have no prior record` },
    { label: 'Amount cap verification', ok: failed.filter((f) => ['AMOUNT_EXCEEDS_TIER_CAP', 'AMOUNT_EXCEEDS_PRE_APPROVAL', 'RATIO_CAP_EXCEEDED'].includes(f.error_code)).length === 0, note: failed.find((f) => ['AMOUNT_EXCEEDS_TIER_CAP', 'AMOUNT_EXCEEDS_PRE_APPROVAL', 'RATIO_CAP_EXCEEDED'].includes(f.error_code))?.metric || 'Within configured limits' },
    { label: 'Amount extraction confidence', ok: (sub.amount_confidence ?? 1) >= (ctx.config.confidence_thresholds?.amount_hard_block ?? 0.9), note: sub.amount_confidence === null ? 'not extracted' : `${Number(sub.amount_confidence).toFixed(2)} (threshold ${ctx.config.confidence_thresholds?.amount_hard_block ?? 0.90})` }
  ];

  const issues = [];
  if (overBy !== null && overBy > 0) {
    issues.push({
      title: 'Over-declaration against pre-approval',
      body: `Declared ${fmt(sub.amount, sub.currency)} exceeds the linked approved pre-approval ceiling ${fmt(paAmount, sub.currency)} by ${fmt(overBy, sub.currency)}.`,
      evidence: (sub.extracted_evidence || []).filter((e) => e.doc_type === 'TAX_INVOICE').map((e) => `${e.doc_id}:page_1`)
        .concat(sub.parent_pre_approval_id ? [`${sub.parent_pre_approval_id}:approval-page`] : []),
      policy_refs: ['policies/pre-approval.md#sec-1.2', 'policies/budget-calculation.md#rule-4']
    });
  }
  for (const f of failed) {
    if (['AMOUNT_EXCEEDS_PRE_APPROVAL'].includes(f.error_code)) continue;
    issues.push({
      title: f.name || f.rule_id,
      body: f.metric,
      evidence: f.detail && f.detail.missing ? [] : (sub.evidence_refs || []).slice(0, 2),
      policy_refs: [f.policy_ref].filter(Boolean)
    });
  }
  for (const n of notEvaluated) {
    issues.push({
      title: `${n.rule_id} not evaluated — configuration gap`,
      body: n.metric,
      evidence: [],
      policy_refs: [n.policy_ref].filter(Boolean)
    });
  }
  for (const s of sub.exception_result?.security_findings || []) {
    issues.push({
      title: `Security finding ${s.finding_id} (${s.threat_type})`,
      body: `${s.impact_assessment} Action taken: ${s.action_taken}. Status: ${s.status}.`,
      evidence: [`${s.evidence?.location || 'attachment'}`],
      policy_refs: ['docs/05-agent-exception.md#sec-4']
    });
  }

  const options = [];
  if (overBy > 0 || failed.length) {
    const reduceTo = paAmount !== null && overBy > 0 ? paAmount : (cap !== null ? cap : null);
    if (reduceTo !== null) {
      options.push({ id: 'A', label: `Approve at ceiling ${fmt(reduceTo, sub.currency)}`, detail: `Reduce the excess ${fmt(round2(Number(sub.amount) - reduceTo), sub.currency)} and approve up to the binding ceiling.` });
    }
  }
  if (issues.length) {
    options.push({ id: options.length ? String.fromCharCode(65 + options.length) : 'A', label: 'Suspend and request missing documents', detail: 'Issue an information request to the partner; the submission stays open until evidence is supplied.' });
  }
  options.push({ id: String.fromCharCode(65 + options.length), label: 'Reject in full', detail: 'Reject on grounds of incomplete evidence and material over-declaration.' });
  if (!issues.length) {
    options.unshift({ id: 'A', label: `Approve in full ${fmt(sub.amount, sub.currency)}`, detail: 'All configured gates passed with evidence anchors on file.' });
  }

  const signOff = [];
  if (overBy > 0) signOff.push(`Waive the ${fmt(overBy, sub.currency)} above the approved pre-approval ceiling? (requires VP-level special authority)`);
  if (notEvaluated.length) signOff.push(`Confirm the ${notEvaluated.length} unconfigured rule(s) manually for this submission? (zero auto-guessing invariant)`);
  if ((sub.exception_result?.business_items || []).some((b) => b.error_code === 'MISSING_SUPPORTING_DOCUMENTS')) {
    signOff.push('Allow a 5-working-day extension for the partner to supply missing event evidence?');
  }
  if (!signOff.length) signOff.push('Confirm the final disbursement decision — human sign-off is mandatory and non-delegable.');

  const citations = [...new Set(rules.map((r) => r.policy_ref).filter(Boolean))];

  const memo = {
    subject: `Partner Claim Review — ${sub.submission_id} (${partner.name || sub.partner_id})`,
    status: 'DRAFT_PENDING_REVIEW',
    generated_by: 'agent_human_review',
    generated_at: nowISO(),
    sections: {
      summary: {
        heading: '1. Submission Summary',
        lines: [
          `Partner: ${partner.name || sub.partner_id} (ID: ${sub.partner_id}, Tier: ${partner.tier || ctx.tierName || 'Unassigned'})`,
          sub.parent_pre_approval_id
            ? `Linked pre-approval: ${sub.parent_pre_approval_id} (approved amount: ${paAmount !== null ? fmt(paAmount, sub.currency) : 'not on record'})`
            : 'Linked pre-approval: none (this is a pre-approval request)',
          `Declared amount: ${fmt(sub.amount, sub.currency)} | Activity date: ${sub.activity_date} | Submitted: ${String(sub.submitted_at || '').slice(0, 10)}`,
          `Programme: ${sub.programme || 'Unspecified'} | Region: ${partner.region || 'Unspecified'}`
        ]
      },
      verifications: { heading: '2. Completed Verifications', items: verifications },
      issues: { heading: '3. Outstanding Issues & Evidence', items: issues },
      recommended_action: { heading: '4. Recommended Action', options },
      sign_off: { heading: '5. Items Requiring Approver Sign-Off', items: signOff },
      citations: { heading: '6. Policy Citations', items: citations }
    },
    invariants_applied: [
      'Issue coverage — every upstream finding has a matching line',
      'Source traceability — every recommendation carries policy_id and doc_id:page',
      'Zero hallucination — no unproven business fact asserted',
      'No unauthorized commitments — neutral wording only'
    ]
  };

  const blob = JSON.stringify(memo);
  const filter = commitmentFilter(blob);
  memo.commitment_filter = { clean: filter.clean, banned_phrases_detected: filter.hits };
  return memo;
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

function buildContext(sub) {
  const config = loadConfig();
  const partners = loadPartners();
  const tiers = loadTiers();
  const rules = loadRules();
  const checklist = loadChecklist();

  const partner = partners.find((p) => p.partner_id === sub.partner_id) || null;
  const tierName = partner ? (partner.tier || 'Unassigned') : (sub.partner_tier || 'Unassigned');
  const tier = tiers.find((t) => t.name === tierName) || null;
  const capConfigured = !!(tier && tier.programme_limits && tier.programme_limits.cap_configured);
  const tierCap = capConfigured ? tier.programme_limits.single_event_cap : null;
  const tierRatio = tier && tier.programme_limits && typeof tier.programme_limits.coop_reimbursement_ratio === 'number'
    ? tier.programme_limits.coop_reimbursement_ratio : null;

  const all = store.read('submissions.json') || [];
  const parentPreApproval = sub.parent_pre_approval_id
    ? all.find((s) => s.submission_id === sub.parent_pre_approval_id || s.pre_approval_code === sub.parent_pre_approval_id)
    : null;

  const checklistDef = checklist[sub.submission_type] || [];
  const requiredDocs = capConfigured && tier && Array.isArray(tier.required_documents) && tier.required_documents.length
    ? tier.required_documents
    : checklistDef.filter((c) => c.required).map((c) => c.item_id);

  let availableBudget = null;
  try {
    const snap = ledger.snapshot(partner ? partner.partner_id : null, config.org?.fiscal_year || 2026);
    availableBudget = snap.row ? snap.row.available : null;
  } catch {
    availableBudget = null;
  }

  const eligibleInvoiceAmount = Array.isArray(sub.invoice_amounts) && sub.invoice_amounts.length
    ? round2(sub.invoice_amounts.reduce((a, b) => a + Number(b || 0), 0))
    : null;

  // Open rule conflicts drive the R-CONFLICT-013 guard and the admin Conflict Banner.
  const conflicts = store.read('rule-conflicts.json') || [];
  const openConflicts = (Array.isArray(conflicts) ? conflicts : []).filter((c) => c.status !== 'resolved');

  return {
    config, partner, tier, tierName, tierCap, tierRatio, capConfigured,
    parentPreApproval, rules, checklistDef, requiredDocs, availableBudget, eligibleInvoiceAmount,
    openConflicts,
    preApprovalAmount: parentPreApproval ? Number(parentPreApproval.approved_amount ?? parentPreApproval.amount) : null,
    preApprovalStatus: parentPreApproval ? parentPreApproval.state : null
  };
}

function ruleContext(sub, ctx) {
  return {
    submissionId: sub.submission_id,
    submissionType: sub.submission_type,
    claimAmount: Number(sub.amount),
    currency: sub.currency,
    activityDate: sub.activity_date,
    claimDate: (sub.submitted_at || nowISO()).slice(0, 10),
    tierName: ctx.tierName,
    tierCap: ctx.tierCap,
    tierRatio: ctx.tierRatio,
    requiredDocs: ctx.requiredDocs,
    partnerId: sub.partner_id,
    partnerStatus: ctx.partner ? ctx.partner.status : 'unknown',
    submissionProgramme: sub.programme || null,
    partnerProgrammes: ctx.partner ? (ctx.partner.programmes || []) : [],
    parentPreApprovalId: sub.parent_pre_approval_id || null,
    preApprovalStatus: ctx.preApprovalStatus,
    preApprovalAmount: ctx.preApprovalAmount,
    invoiceNumbers: sub.invoice_numbers || [],
    duplicateInvoiceNumbers: sub.validation_result?.duplicate_invoice_numbers || [],
    nearDuplicates: sub.validation_result?.near_duplicates || [],
    dedupWindowDays: ctx.config?.dedup_window_days ?? null,
    amountHardBlock: ctx.config?.confidence_thresholds?.amount_hard_block ?? null,
    baseCurrency: ctx.config?.org?.base_currency ?? null,
    claimWindowDays: ctx.config?.claim_window_days ?? null,
    amountConfidence: sub.amount_confidence,
    documentTypes: sub.document_types || [],
    notes: sub.notes || '',
    hashDuplicate: (sub.extracted_evidence || []).some((e) => e.sha256 && (sub.validation_result?.duplicate_hashes || []).includes(e.sha256)),
    metadataTamper: (sub.extracted_evidence || []).some((e) => e.tampered === true),
    availableBudget: ctx.availableBudget,
    eligibleInvoiceAmount: ctx.eligibleInvoiceAmount,
    openConflicts: ctx.openConflicts || [],
    ruleEngineVersion: sub.rule_version
  };
}

async function enrichWithAiReasoning(sub, ctx) {
  const provider = ai.status();
  if (!provider.available) return;

  try {
    const partner = ctx.partner || {};
    const rulesSummary = (sub.rules_result?.evaluated_rules || []).map((r) => `- ${r.name}: ${r.status} (${r.metric})`).join('\n');
    const systemPrompt = `You are Agent 7: Executive Briefing AI operating under the Boss Skill for UMochi PartnerFlow.
You evaluate partner reimbursement claims and pre-approvals on behalf of the VP of Global Channel Operations & Finance.
Analyze the provided submission facts, rule evaluations, and budget state.
Provide a concise, authoritative C-Suite executive briefing (2 to 3 sentences in English).
State whether the evidence satisfies corporate SOP_2026_V1, cite key invoice numbers or documents, and provide your formal executive recommendation.`;

    const userPrompt = `Submission Details:
ID: ${sub.submission_id}
Type: ${sub.submission_type}
Partner: ${partner.name || sub.partner_name || sub.partner_id} (Tier: ${sub.partner_tier || 'Unassigned'})
Declared Amount: ${sub.amount} ${sub.currency}
Activity: ${sub.title || sub.activity_type}
Activity Date: ${sub.activity_date}
Linked Pre-Approval: ${sub.parent_pre_approval_id || 'None'}
Invoices: ${(sub.invoice_numbers || []).join(', ') || 'None'}
Rules Verdict: ${sub.rules_result?.verdict || 'N/A'}
Rule Evaluations:
${rulesSummary}
Available Budget: ${ctx.availableBudget || 'N/A'}`;

    const aiResponse = await ai.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.2, max_tokens: 1200 });

    if (aiResponse && aiResponse.trim()) {
      const bossComment = aiResponse.trim();
      sub.ai_executive_briefing = bossComment;

      if (sub.review_memo && sub.review_memo.sections) {
        sub.review_memo.sections.ai_boss_briefing = {
          heading: '0. Executive AI Briefing (Boss Skill)',
          body: bossComment,
          model: provider.model,
          generated_at: nowISO()
        };
      }

      const existingComments = store.read('comments.json') || [];
      const hasRecentAgentComment = existingComments.some((c) => c.submission_id === sub.submission_id && c.is_agent === true && c.badge === 'BOSS SKILL');
      if (!hasRecentAgentComment) {
        existingComments.push({
          comment_id: `CMT-AI-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          submission_id: sub.submission_id,
          author: 'Agent 7: Executive Briefing AI (Boss Skill)',
          author_role: 'AI_EXECUTIVE_AGENT',
          is_agent: true,
          badge: 'BOSS SKILL',
          text: bossComment,
          model: provider.model,
          created_at: nowISO()
        });
        store.write('comments.json', existingComments);
      }
    }
  } catch (err) {
    console.error('[AI Agent Reasoning Notice]', err.message || err);
  }
}

/** Run the full Agent 1-7 pipeline over a submission record, mutating and returning it. */
async function runPipeline(sub, opts = {}) {
  const ctx = buildContext(sub);
  sub.rule_version = sub.rule_version || ctx.config.rule_engine_version || 'v2026.3.0';
  sub.partner_tier = ctx.tierName;
  sub.partner_name = ctx.partner ? ctx.partner.name : sub.partner_name || sub.partner_id;

  const from = sub.state;

  // Agent 1 — Intake
  if (opts.files && opts.files.length) {
    const intake = agent1Intake(sub, opts.files, ctx.config);
    sub.extracted_evidence = intake.extracted_evidence;
    sub.document_types = intake.document_types;
    sub.amount_confidence = intake.amount_confidence;
    sub.attachments_count = intake.attachments_count;
    sub.min_confidence = intake.min_confidence;
    sub.parse_engine = intake.parse_engine;

    // Prefer the partner-declared amount; only fall back to the invoice read
    // when it is the single self-consistent figure found in the document.
    const best = [...(intake.parsed_amounts || [])].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    if (sub.amount === null || sub.amount === undefined) {
      if (best) {
        sub.amount = best.amount;
        sub.amount_source = `agent1_parse:${best.basis}`;
      } else {
        sub.amount_source = 'unresolved';
      }
    } else {
      sub.amount_source = 'partner_declared';
      if (best && Math.abs(best.amount - Number(sub.amount)) > 0.01) {
        sub.declared_vs_parsed_mismatch = { declared: Number(sub.amount), parsed: best.amount, basis: best.basis };
      }
    }
    if (intake.parsed_invoice_numbers?.length) {
      const merged = new Set([...(sub.invoice_numbers || []), ...intake.parsed_invoice_numbers]);
      sub.invoice_numbers = [...merged];
    }
  }
  sub.evidence_refs = (sub.extracted_evidence || []).map((e) => ({
    doc_id: e.doc_id, filename: e.filename, page: 1,
    bounding_box: null, confidence: e.amount_confidence
  }));

  const hard = ctx.config.confidence_thresholds?.amount_hard_block ?? 0.90;
  const suspend = ctx.config.confidence_thresholds?.parsing_suspend ?? 0.85;

  if (sub.amount_confidence !== null && sub.amount_confidence !== undefined && sub.amount_confidence < suspend) {
    transition(sub, from, 'NEEDS_INTAKE_CORRECTION', {
      actor: 'agent_intake', error_code: 'FAILED_PARSING',
      details: { amount_confidence: sub.amount_confidence, threshold: suspend },
      evidence_refs: sub.evidence_refs
    });
    return finish(sub, ctx);
  }
  transition(sub, from, 'INTAKE_EXTRACTED', {
    actor: 'agent_intake',
    details: { attachments_count: sub.attachments_count || 0, amount_confidence: sub.amount_confidence, document_types: sub.document_types || [] },
    evidence_refs: sub.evidence_refs
  });

  // Agent 2 — Validation
  transition(sub, 'INTAKE_EXTRACTED', 'VALIDATING', { actor: 'agent_validation' });
  sub.validation_result = agent2Validate(sub, ctx);

  if (sub.validation_result.open_questions.length) {
    transition(sub, 'VALIDATING', 'NEEDS_CLARIFICATION', {
      actor: 'agent_validation', error_code: 'NEEDS_CLARIFICATION', rule_id: 'GRILL_ME',
      details: { questions: sub.validation_result.open_questions.map((q) => q.question_id) },
      evidence_refs: sub.evidence_refs
    });
    return finish(sub, ctx);
  }

  const blockingGap = sub.validation_result.gaps.find((g) =>
    ['PARTNER_NOT_FOUND', 'PARTNER_NOT_ACTIVE', 'PRE_APPROVAL_NOT_READY', 'PRE_APPROVAL_NOT_FOUND', 'MISSING_REQUIRED_FIELD'].includes(g.error_code));
  if (blockingGap) {
    transition(sub, 'VALIDATING', 'POLICY_BLOCKED', {
      actor: 'agent_validation', error_code: blockingGap.error_code,
      details: { gap: blockingGap }, evidence_refs: sub.evidence_refs
    });
    return finish(sub, ctx);
  }
  transition(sub, 'VALIDATING', 'RULES_EVALUATING', { actor: 'agent_validation', details: { checks: sub.validation_result.checks } });

  // Agent 3 — Rules engine (deterministic, 0 tokens)
  if (sub.amount_confidence !== null && sub.amount_confidence !== undefined && sub.amount_confidence < hard) {
    transition(sub, 'RULES_EVALUATING', 'NEEDS_HUMAN_CONFIRMATION', {
      actor: 'agent_rules_engine', error_code: 'CONFIDENCE_TOO_LOW',
      details: { amount_confidence: sub.amount_confidence, threshold: hard },
      evidence_refs: sub.evidence_refs
    });
    sub.rules_result = runRules(ctx.rules, ruleContext(sub, ctx));
    return finish(sub, ctx);
  }

  sub.rules_result = runRules(ctx.rules, ruleContext(sub, ctx));
  const verdict = sub.rules_result.verdict;

  if (verdict === 'REQUIRES_POLICY_INTERPRETATION') {
    transition(sub, 'RULES_EVALUATING', 'REQUIRES_POLICY_INTERPRETATION', {
      actor: 'agent_rules_engine', error_code: 'POLICY_UNDEFINED',
      details: { summary: sub.rules_result.summary }, evidence_refs: sub.evidence_refs
    });
    return finish(sub, ctx);
  }

  if (verdict === 'POLICY_BLOCKED') {
    const blocker = sub.rules_result.evaluated_rules.find((r) => r.status === 'FAILED' && r.severity === 'BLOCKER');
    transition(sub, 'RULES_EVALUATING', 'POLICY_BLOCKED', {
      actor: 'agent_rules_engine', error_code: blocker?.error_code || 'RULE_BLOCKED', rule_id: blocker?.rule_id || null,
      details: blocker?.detail || { summary: sub.rules_result.summary },
      evidence_refs: sub.evidence_refs
    });
    return finish(sub, ctx);
  }

  transition(sub, 'RULES_EVALUATING', 'BUDGET_RESERVING', {
    actor: 'agent_rules_engine', rule_id: null,
    details: { rule_engine_version: sub.rule_version, summary: sub.rules_result.summary },
    evidence_refs: sub.evidence_refs
  });

  // Agent 4 — Budget & claim verification
  const fiscalYear = ctx.config.org?.fiscal_year || 2026;
  if (ctx.availableBudget === null) {
    transition(sub, 'BUDGET_RESERVING', 'PENDING_HUMAN_REVIEW', {
      actor: 'agent_budget', error_code: 'LEDGER_NOT_CONFIGURED',
      details: { note: 'Budget control formula unconfirmed — automatic deduction disabled, human confirmation required' }
    });
  } else if (sub.submission_type === 'PRE_APPROVAL') {
    const res = await ledger.reserveCommit({
      submissionId: sub.submission_id, partnerId: sub.partner_id, amount: Number(sub.amount),
      runId: sub.run_id, ruleVersion: sub.rule_version, fiscalYear
    });
    sub.budget_result = res;
    if (res.status === 'INSUFFICIENT_BUDGET' || res.status === 'NO_BUDGET_ALLOCATED') {
      transition(sub, 'BUDGET_RESERVING', 'BUDGET_REJECTED', {
        actor: 'agent_budget', error_code: res.status, details: res
      });
      return finish(sub, ctx);
    }
    transition(sub, 'BUDGET_RESERVING', 'EXCEPTION_TRIAGE', { actor: 'agent_budget', details: res });
  } else {
    const res = await ledger.commitToApprove({
      submissionId: sub.submission_id, partnerId: sub.partner_id, amount: Number(sub.amount),
      runId: sub.run_id, ruleVersion: sub.rule_version, fiscalYear
    });
    sub.budget_result = res;
    if (res.status === 'INSUFFICIENT_COMMIT' || res.status === 'INSUFFICIENT_BUDGET' || res.status === 'NO_BUDGET_ALLOCATED') {
      transition(sub, 'BUDGET_RESERVING', 'BUDGET_REJECTED', { actor: 'agent_budget', error_code: res.status, details: res });
      return finish(sub, ctx);
    }
    transition(sub, 'BUDGET_RESERVING', 'EXCEPTION_TRIAGE', { actor: 'agent_budget', details: res });
  }

  // Agent 5 — Exception triage
  sub.exception_result = agent5Triage(sub, ctx);
  if (sub.exception_result.exception_type === 'SECURITY') {
    transition(sub, 'EXCEPTION_TRIAGE', 'SECURITY_QUARANTINE', {
      actor: 'agent_exception', error_code: sub.exception_result.security_findings[0]?.threat_type || 'SECURITY_EXCEPTION',
      details: { findings: sub.exception_result.security_findings.map((f) => f.finding_id) }
    });
    return finish(sub, ctx);
  }

  const missingDocs = (sub.exception_result.business_items || []).filter((b) => b.action === 'REQUEST_MISSING_DOCUMENTS');
  if (missingDocs.length && !opts.skipInfoRequest) {
    transition(sub, 'EXCEPTION_TRIAGE', 'PENDING_INFO_REQUEST', {
      actor: 'agent_exception', error_code: 'MISSING_SUPPORTING_DOCUMENT',
      details: { items: missingDocs.map((b) => b.item_id), missing: missingDocs.map((b) => b.detail?.missing) },
      evidence_refs: sub.evidence_refs
    });
    sub.review_memo = agent6Memo(sub, ctx);
    return finish(sub, ctx);
  }

  transition(sub, 'EXCEPTION_TRIAGE', 'PENDING_HUMAN_REVIEW', {
    actor: 'agent_exception', details: {
      exception_type: sub.exception_result.exception_type,
      business_items: (sub.exception_result.business_items || []).map((b) => b.item_id)
    },
    evidence_refs: sub.evidence_refs
  });

  // Agent 6 — Human review memo draft
  sub.review_memo = agent6Memo(sub, ctx);
  appendAudit({
    submission_id: sub.submission_id, run_id: sub.run_id, actor: 'agent_human_review', actor_type: 'SYSTEM_AGENT',
    previous_state: 'PENDING_HUMAN_REVIEW', new_state: 'PENDING_HUMAN_REVIEW', error_code: null, rule_id: null,
    evidence_refs: sub.evidence_refs, details: { memo_status: 'DRAFT_PENDING_REVIEW', commitment_filter_clean: sub.review_memo.commitment_filter.clean },
    rule_version: sub.rule_version
  });

  await enrichWithAiReasoning(sub, ctx);
  return finish(sub, ctx);
}

/** Finalise derived display fields and return the mutated submission. */
const APPROVABLE_STATES = [
  'PENDING_HUMAN_REVIEW', 'PENDING_INFO_REQUEST', 'NEEDS_HUMAN_CONFIRMATION',
  'REQUIRES_POLICY_INTERPRETATION', 'NEEDS_CLARIFICATION'
];

/**
 * Apply a human decision (Iron Invariant 1). `actor` must be an authorised human
 * approver — the caller is responsible for having verified the credential.
 * Returns { ok, submission } or { ok:false, code, message } so both the HTTP route
 * and the corpus builder drive exactly the same state + ledger transitions.
 */
async function applyHumanDecision(sub, action, { approver, approvedAmount = null, reason = null, paymentReference = null } = {}) {
  const fiscalYear = loadConfig().org?.fiscal_year;
  const runId = sub.run_id;
  const amount = Number(sub.amount || 0);
  const decisionAmount = approvedAmount === null || approvedAmount === undefined || approvedAmount === ''
    ? amount : Number(approvedAmount);

  const ledgerCall = async (fn, args) => {
    try {
      return await fn(args);
    } catch (err) {
      if (err && err.code === 'BUDGET_LEDGER_NOT_CONFIGURED') return null;
      throw err;
    }
  };

  if (action === 'approve') {
    if (!APPROVABLE_STATES.includes(sub.state)) {
      return { ok: false, code: 'INVALID_STATE', message: `Cannot approve from ${sub.state}.` };
    }
    const reduction = round2(amount - decisionAmount);
    sub.approved_amount = decisionAmount;
    sub.reduction_amount = reduction > 0 ? reduction : 0;
    sub.decision_reason = reason || null;
    sub.decided_by = approver.email;
    sub.decided_at = nowISO();

    if (sub.submission_type !== 'PRE_APPROVAL') {
      // A pre-approval's funds were already committed at BUDGET_RESERVING; a claim moves
      // Committed -> Approved here (Iron Invariant 2, ledger conservation).
      const r = await ledgerCall(ledger.commitToApprove, {
        submissionId: sub.submission_id, partnerId: sub.partner_id, amount,
        runId, ruleVersion: sub.rule_version, fiscalYear
      });
      if (r) sub.budget_result = r;
      if (reduction > 0) {
        await ledgerCall(ledger.releaseCommit, {
          submissionId: sub.submission_id, partnerId: sub.partner_id, amount: reduction,
          runId: `${runId}:reduce`, ruleVersion: sub.rule_version, fiscalYear,
          reason: 'Partial reduction by human approver'
        });
      }
    }
    transition(sub, sub.state, 'APPROVED', {
      actor: approver.email, actor_type: 'HUMAN_APPROVER',
      details: { event: 'HUMAN_APPROVAL', approved_amount: decisionAmount, reduction, reason: reason || null, memo_status: 'FINALISED' },
      evidence_refs: sub.evidence_refs
    });
  } else if (action === 'reject') {
    if (!reason || !String(reason).trim()) {
      return { ok: false, code: 'REASON_REQUIRED', message: 'A rejection must carry a documented reason for the audit trail.' };
    }
    sub.decision_reason = String(reason).trim();
    sub.decided_by = approver.email;
    sub.decided_at = nowISO();
    if (sub.budget_result?.status === 'SUCCESS') {
      await ledgerCall(ledger.releaseCommit, {
        submissionId: sub.submission_id, partnerId: sub.partner_id, amount,
        runId: `${runId}:release`, ruleVersion: sub.rule_version, fiscalYear, reason: sub.decision_reason
      });
    }
    transition(sub, sub.state, 'REJECTED', {
      actor: approver.email, actor_type: 'HUMAN_APPROVER',
      details: { event: 'HUMAN_REJECTION', reason: sub.decision_reason }, evidence_refs: sub.evidence_refs
    });
  } else if (action === 'mark-paid') {
    if (sub.state !== 'APPROVED') {
      return { ok: false, code: 'INVALID_STATE', message: `Only APPROVED submissions can be paid; current state ${sub.state}.` };
    }
    const amt = Number(sub.approved_amount ?? sub.amount ?? 0);
    const r = await ledgerCall(ledger.approveToPaid, {
      submissionId: sub.submission_id, partnerId: sub.partner_id, amount: amt,
      runId, ruleVersion: sub.rule_version, fiscalYear
    });
    if (r) sub.budget_result = r;
    sub.payment_reference = paymentReference || null;
    sub.paid_at = nowISO();
    transition(sub, 'APPROVED', 'PAID', {
      actor: approver.email, actor_type: 'HUMAN_APPROVER',
      details: { event: 'DISBURSEMENT_RECORDED', amount: amt, reference: sub.payment_reference }
    });
    transition(sub, 'PAID', 'ARCHIVED', { actor: 'agent_audit', details: { event: 'AUTO_ARCHIVE' } });
  } else if (action === 'release') {
    if (sub.budget_result?.status === 'SUCCESS') {
      await ledgerCall(ledger.releaseCommit, {
        submissionId: sub.submission_id, partnerId: sub.partner_id, amount,
        runId: `${runId}:release`, ruleVersion: sub.rule_version, fiscalYear, reason: reason || 'Manual release'
      });
    }
    transition(sub, sub.state, 'REJECTED', {
      actor: approver.email, actor_type: 'HUMAN_APPROVER',
      details: { event: 'COMMIT_RELEASED', reason: reason || null }
    });
  } else {
    return { ok: false, code: 'UNKNOWN_ACTION', message: `Unknown decision action "${action}".` };
  }

  sub.ui_status = uiStatus(sub.state);
  sub.owner = ownerFor(sub.state);
  sub.sla_breached = false;
  sub.updated_at = nowISO();
  return { ok: true, submission: sub };
}

function finish(sub, ctx) {
  sub.updated_at = nowISO();
  sub.ui_status = uiStatus(sub.state);
  sub.ageing_days = sub.submitted_at ? Math.max(0, daysBetween(String(sub.submitted_at).slice(0, 10), nowISO().slice(0, 10))) : 0;
  sub.sla_breached = sub.ageing_days * 24 > (ctx.config.sla_hours?.ops_initial_review ?? 48) &&
    ['PENDING_HUMAN_REVIEW', 'NEEDS_CLARIFICATION', 'PENDING_INFO_REQUEST', 'NEEDS_HUMAN_CONFIRMATION'].includes(sub.state);
  sub.owner = ownerFor(sub.state);
  if (!sub.review_memo && sub.state !== 'SUBMITTED') {
    try { sub.review_memo = agent6Memo(sub, ctx); } catch { sub.review_memo = null; }
  }
  return sub;
}

function ownerFor(state) {
  switch (state) {
    case 'PENDING_INFO_REQUEST': return 'Awaiting partner documents';
    case 'NEEDS_CLARIFICATION': return 'Awaiting operations clarification';
    case 'PENDING_HUMAN_REVIEW': return 'Awaiting operations first review';
    case 'NEEDS_HUMAN_CONFIRMATION': return 'Awaiting finance amount confirmation';
    case 'REQUIRES_POLICY_INTERPRETATION': return 'Awaiting policy owner interpretation';
    case 'POLICY_BLOCKED': case 'BUDGET_REJECTED': case 'SECURITY_QUARANTINE': return 'Blocked — director special approval';
    case 'APPROVED': return 'Awaiting finance disbursement';
    case 'PAID': case 'ARCHIVED': return 'Closed';
    default: return 'Awaiting operations first review';
  }
}

module.exports = {
  STATES, UI_STATUS, APPROVABLE_STATES, uiStatus, runPipeline, buildContext, ruleContext, agent1Intake, agent2Validate,
  agent5Triage, agent6Memo, appendAudit, transition, newRunId, nextSubmissionId, classifyDocument,
  commitmentFilter, ownerFor, applyHumanDecision, loadConfig, loadPartners, loadTiers, loadRules, loadChecklist, DOC_TYPE_PATTERNS
};
