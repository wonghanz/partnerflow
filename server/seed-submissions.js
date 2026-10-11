'use strict';

/**
 * Corpus builder — turns the AI-authored *intake facts* in
 * `server/data/submissions-seed.json` into a live workspace by running the real
 * Agent 1-7 pipeline over every record.
 *
 * Division of labour (docs/09 §1, docs/11 §3):
 *   - A real AI authored the inputs: partner, amounts, dates, invoices, what the
 *     document parser read, and the OCR confidence.
 *   - This script authors nothing. Every state, verdict, gap, ledger movement,
 *     exception triage, memo and audit event is COMPUTED by pipeline.js / rules.js
 *     / ledger.js, so a seeded record is indistinguishable from one submitted
 *     through POST /api/submissions.
 *   - Human decisions are replayed through pipeline.applyHumanDecision, the same
 *     Iron Invariant 1 code path the HTTP route uses.
 *
 * Usage: node server/seed-submissions.js [--keep-ledger]
 */

const fs = require('fs');
const path = require('path');

const store = require('./lib/store');
const P = require('./lib/pipeline');
const ledger = require('./lib/ledger');

const DATA_DIR = path.join(__dirname, 'data');
const BASELINE_DIR = path.join(DATA_DIR, '_baseline');
const SEED_FILE = path.join(DATA_DIR, 'submissions-seed.json');

const FOUNDATION = ['config.json', 'tiers.json', 'rules.json', 'rule-conflicts.json',
  'partners.json', 'ledger.json', 'checklist.json', 'brain.json', 'agents.json', 'dashboards.json'];

const RUNTIME = ['submissions.json', 'audit-events.json', 'comments.json',
  'clarifications.json', 'budget-transactions.json', 'ai-log.json', 'uploads.json'];

const COMPUTED_FIELDS = ['state', 'ui_status', 'validation_result', 'rules_result', 'budget_result',
  'exception_result', 'review_memo', 'state_history', 'ageing_days', 'sla_breached', 'run_id',
  'partner_tier', 'evidence_refs', 'approved_amount', 'decided_by', 'decided_at', 'reduction_amount'];

function die(code, message) {
  console.error(`\n[seed] ${code}: ${message}\n`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* 1. Preconditions                                                    */
/* ------------------------------------------------------------------ */

for (const f of FOUNDATION) {
  if (!fs.existsSync(path.join(DATA_DIR, f))) {
    die('DATA_NOT_READY', `server/data/${f} is missing. The foundation corpus must be authored from the documentation first (see docs/DATA-CONTRACT.md).`);
  }
}
if (!fs.existsSync(SEED_FILE)) {
  die('SEED_MISSING', 'server/data/submissions-seed.json is missing — no intake facts to compute a corpus from.');
}

const seedFacts = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
if (!Array.isArray(seedFacts) || !seedFacts.length) die('SEED_INVALID', 'submissions-seed.json must be a non-empty JSON array.');

const config = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config.json'), 'utf8'));
for (const rec of seedFacts) {
  const authored = COMPUTED_FIELDS.filter((k) => rec[k] !== undefined);
  if (authored.length) {
    die('SEED_FABRICATED_VERDICT', `${rec.submission_id || '?'} carries engine-owned field(s): ${authored.join(', ')}. The AI authors inputs only; verdicts must be computed.`);
  }
}

/* ------------------------------------------------------------------ */
/* 2. Reset runtime state, restore the pristine ledger                 */
/* ------------------------------------------------------------------ */

const keepLedger = process.argv.includes('--keep-ledger');

if (!keepLedger) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  const baseline = path.join(BASELINE_DIR, 'ledger.json');
  if (!fs.existsSync(baseline)) fs.copyFileSync(path.join(DATA_DIR, 'ledger.json'), baseline);
  fs.copyFileSync(baseline, path.join(DATA_DIR, 'ledger.json'));
}

for (const f of RUNTIME) {
  const p = path.join(DATA_DIR, f);
  if (f === 'ledger.json') continue;
  if (fs.existsSync(p)) fs.rmSync(p);
  store.invalidate(f);
}
store.invalidate('ledger.json');

/* The engine's own reads go through store's cache — reload the restored ledger. */
const approvers = (Array.isArray(config.approvers) && config.approvers.length)
  ? config.approvers
  : (config.operator ? [config.operator] : []);
if (!approvers.length) die('NO_HUMAN_AUTHORITY', 'config.json declares no approver; Iron Invariant 1 requires a named human for every seeded decision.');

const fiscalYear = config.org?.fiscal_year || 2026;
const submissions = [];

function persist() { store.write('submissions.json', submissions); }

/** Build a record in exactly the shape POST /api/submissions would create. */
function toRecord(fact) {
  const type = String(fact.submission_type || 'CLAIM').toUpperCase() === 'PRE_APPROVAL' ? 'PRE_APPROVAL' : 'CLAIM';
  return {
    submission_id: fact.submission_id,
    run_id: P.newRunId(),
    submission_type: type,
    partner_id: fact.partner_id,
    partner_name: null,
    partner_tier: null,
    title: fact.title || 'Untitled submission',
    activity_type: fact.activity_type || null,
    activity_date: fact.activity_date || null,
    submitted_at: fact.submitted_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    amount: fact.amount === null || fact.amount === undefined ? null : Number(fact.amount),
    currency: fact.currency || config.org?.base_currency || 'MYR',
    invoice_numbers: Array.isArray(fact.invoice_numbers) ? fact.invoice_numbers : [],
    invoice_amounts: Array.isArray(fact.invoice_amounts) ? fact.invoice_amounts : [],
    invoice_line_total: fact.invoice_line_total === null || fact.invoice_line_total === undefined ? null : Number(fact.invoice_line_total),
    programme: fact.programme || null,
    parent_pre_approval_id: type === 'CLAIM' ? (fact.parent_pre_approval_id || null) : null,
    bank_account: fact.bank_account || null,
    contact_name: fact.contact_name || null,
    contact_email: fact.contact_email || null,
    submitted_by: fact.submitted_by || fact.contact_name || fact.contact_email || 'partner_portal',
    notes: fact.notes || null,
    amount_confidence: fact.amount_confidence === null || fact.amount_confidence === undefined ? null : Number(fact.amount_confidence),
    confidence_basis: fact.confidence_basis || null,
    attachments_count: Number(fact.attachments_count || (fact.extracted_evidence || []).length),
    document_types: Array.isArray(fact.document_types) ? fact.document_types : [],
    extracted_evidence: Array.isArray(fact.extracted_evidence) ? fact.extracted_evidence : [],
    evidence_refs: [],
    state: 'SUBMITTED',
    ui_status: 'pending',
    rule_version: fact._seed?.historical_rule_version || null,
    state_history: [],
    amount_source: 'partner_declared',
    source: fact.source || 'seed_corpus',
    provenance: fact.provenance || 'derived',
    scenario: fact._seed?.scenario || null,
    scenario_doc_ref: fact._seed?.doc_ref || null,
    deleted: false
  };
}

/* ------------------------------------------------------------------ */
/* 3. Run the pipeline in dependency order                             */
/* ------------------------------------------------------------------ */

const byId = new Map();
const rows = [];

async function processFact(fact) {
  const sub = toRecord(fact);
  byId.set(sub.submission_id, sub);
  submissions.push(sub);
  persist();

  P.appendAudit({
    submission_id: sub.submission_id, run_id: sub.run_id,
    actor: sub.contact_email || sub.submitted_by, actor_type: 'EXTERNAL_PARTNER',
    previous_state: null, new_state: 'SUBMITTED', error_code: null, rule_id: null,
    evidence_refs: [], rule_version: null,
    details: { event: 'SUBMISSION_CREATED', channel: 'seed_corpus', attachments: sub.extracted_evidence.map((e) => e.filename) }
  });

  const before = ledgerReconcile();
  try {
    await P.runPipeline(sub, {});
  } catch (err) {
    sub.state = 'RECOVERABLE_ERROR';
    sub.pipeline_error = { code: err.code || 'PIPELINE_EXCEPTION', message: String(err.message || err) };
  }

  const seed = fact._seed || {};
  const trail = [];

  /* Grill-Me resume: the partner/ops answer, then validate again (docs/02 §4). */
  if (seed.clarify_answers && sub.state === 'NEEDS_CLARIFICATION') {
    const records = store.read('clarifications.json') || [];
    for (const q of sub.validation_result?.open_questions || []) {
      const answer = seed.clarify_answers[q.question_id];
      if (answer === undefined) continue;
      records.push({
        clarification_id: `CLR-${q.question_id}-${Date.now().toString(36)}`,
        submission_id: sub.submission_id, run_id: sub.run_id, question_id: q.question_id,
        question: q.question, answer, answered_by: approvers[0].email,
        answered_at: new Date().toISOString(), status: 'RESOLVED', provenance: 'seed_corpus'
      });
    }
    store.write('clarifications.json', records);
    trail.push('clarified');
    try { await P.runPipeline(sub, { resumeFrom: 'VALIDATING' }); } catch (err) {
      sub.pipeline_error = { code: 'PIPELINE_EXCEPTION', message: String(err.message || err) };
    }
  }

  /* Human decision through the shared Iron Invariant 1 path. */
  if (seed.decision) {
    const approver = approvers.find((a) => a.email === seed.decided_by) || approvers[0];
    const res = await P.applyHumanDecision(sub, seed.decision, {
      approver,
      approvedAmount: seed.approved_amount ?? null,
      reason: seed.reason || null,
      paymentReference: seed.payment_reference || null
    });
    if (!res.ok) {
      sub.decision_failed = { action: seed.decision, ...res };
      trail.push(`${seed.decision}:refused@${sub.state}`);
    } else {
      trail.push(seed.decision);
      if (seed.decision === 'approve' && seed.approved_amount != null) {
        sub.decision_note = `Human approver ${approver.email} adjudicated ${config.org?.base_currency || 'MYR'} ${seed.approved_amount}; reason recorded in the audit trail.`;
      }
    }
  }

  persist();
  const after = ledgerReconcile();
  rows.push({
    id: sub.submission_id,
    type: sub.submission_type,
    partner: sub.partner_id,
    tier: sub.partner_tier || '-',
    amount: sub.amount,
    conf: sub.amount_confidence,
    verdict: sub.rules_result?.verdict || '-',
    state: sub.state,
    ui: sub.ui_status,
    budget: sub.budget_result?.status || '-',
    memo: sub.review_memo ? (sub.review_memo.commitment_filter?.clean ? 'clean' : 'HITS') : '-',
    audit: after.events - before.events,
    trail: trail.join(' > ') || '-'
  });
}

function ledgerReconcile() {
  const events = (store.read('audit-events.json') || []).length;
  return { events };
}

/* Pre-approvals must exist (and be approved) before the claims that link to them. */
const preApprovals = seedFacts.filter((f) => String(f.submission_type).toUpperCase() !== 'CLAIM');
const claims = seedFacts.filter((f) => String(f.submission_type).toUpperCase() === 'CLAIM');

console.log(`\nPartnerFlow corpus builder — ${seedFacts.length} AI-authored intake facts, engine-computed verdicts\n`);

(async () => {
  for (const fact of preApprovals) await processFact(fact);
  for (const fact of claims) await processFact(fact);

  /* ---------------------------------------------------------------- */
  /* 4. Post-checks: the invariants the docs demand                    */
  /* ---------------------------------------------------------------- */
  const recon = ledger.reconcile();
  const auditCount = (store.read('audit-events.json') || []).length;
  const orphanClaims = submissions.filter((s) => s.submission_type === 'CLAIM' && s.parent_pre_approval_id && !byId.has(s.parent_pre_approval_id));
  const reachedTerminal = submissions.filter((s) => ['ARCHIVED', 'REJECTED', 'POLICY_BLOCKED', 'BUDGET_REJECTED', 'SECURITY_QUARANTINE'].includes(s.state)).length;

  const pad = (v, n) => String(v ?? '').padEnd(n);
  console.log(pad('SUBMISSION', 17) + pad('TYPE', 13) + pad('PARTNER', 13) + pad('TIER', 11) + pad('AMOUNT', 11) + pad('CONF', 6) + pad('VERDICT', 30) + pad('STATE', 30) + 'BUDGET');
  console.log('-'.repeat(131));
  for (const r of rows) {
    console.log(pad(r.id, 17) + pad(r.type, 13) + pad(r.partner, 13) + pad(r.tier, 11) +
      pad(r.amount === null ? 'null' : r.amount.toFixed(2), 11) + pad(r.conf ?? '-', 6) +
      pad(r.verdict, 30) + pad(r.state, 30) + r.budget);
  }
  console.log('-'.repeat(131));
  console.log(rows.map((r) => `${r.id} ${r.trail}`).join('\n'));

  console.log(`\nLedger: balanced=${recon.balanced} rows=${recon.rows} totals=${JSON.stringify(recon.totals)}`);
  if (!recon.balanced) console.log('Drift: ' + JSON.stringify(recon.drift));
  console.log(`Audit events: ${auditCount}   Submissions: ${submissions.length}   Terminal: ${reachedTerminal}`);
  if (orphanClaims.length) console.log(`WARNING orphan parents: ${orphanClaims.map((s) => `${s.submission_id}->${s.parent_pre_approval_id}`).join(', ')}`);

  const failedDecisions = submissions.filter((s) => s.decision_failed);
  if (failedDecisions.length) {
    console.log(`\nRefused seeded decisions (state at decision time):`);
    for (const s of failedDecisions) console.log(`  ${s.submission_id}: ${s.decision_failed.action} refused — ${s.decision_failed.code} @ ${s.state}`);
  }

  if (!recon.balanced) die('INVARIANT_VIOLATION', 'Four-state ledger does not conserve after seeding.');
  console.log('\nCorpus ready. Start the app:  node server/index.js\n');
})().catch((err) => die('SEED_ABORTED', err.stack || String(err)));
