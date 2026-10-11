'use strict';
/* Isolated rule-matrix harness: exercises runRules against the real AI-authored corpus. */
const store = require('../server/lib/store');
const { runRules } = require('../server/lib/rules');

const config = store.read('config.json');
const rules = store.read('rules.json');
const tiers = store.read('tiers.json');

function tierCtx(name) {
  const t = tiers.find((x) => x.name === name);
  return {
    tierName: t ? t.name : name,
    tierCap: t ? (t.programme_limits?.single_event_cap ?? null) : null,
    tierRatio: t ? (t.programme_limits?.coop_reimbursement_ratio ?? null) : null,
    requiredDocs: t ? (t.required_documents || []) : []
  };
}

function ctx(label, over = {}) {
  return Object.assign({
    submissionId: 'SUB-TEST-0001',
    submissionType: 'CLAIM',
    claimAmount: 8000,
    currency: config.org.base_currency,
    activityDate: '2026-09-01',
    claimDate: '2026-09-18',
    partnerId: 'PTR-GLD-882',
    partnerStatus: 'active',
    parentPreApprovalId: 'PA-GOLD-1',
    preApprovalStatus: 'APPROVED',
    preApprovalAmount: 10000,
    invoiceNumbers: ['INV-88912'],
    duplicateInvoiceNumbers: [],
    nearDuplicates: [],
    dedupWindowDays: null,
    amountConfidence: 0.99,
    amountHardBlock: config.confidence_thresholds.amount_hard_block,
    baseCurrency: config.org.base_currency,
    claimWindowDays: config.claim_window_days,
    documentTypes: ['TAX_INVOICE', 'EVENT_PHOTOS', 'ATTENDEE_SIGNIN', 'PROOF_OF_PAYMENT'],
    availableBudget: 700000,
    eligibleInvoiceAmount: 20000,
    openConflicts: [],
    ruleEngineVersion: config.rule_engine_version
  }, tierCtx('Gold'), over);
}

const cases = [
  ['Gold happy path (claim 8000, base 20000)', ctx('g')],
  ['Gold over cap (claim 15000)', ctx('g', { claimAmount: 15000, preApprovalAmount: 15000 })],
  ['Gold over ratio (claim 12000 of base 20000)', ctx('g', { claimAmount: 12000, preApprovalAmount: 12000 })],
  ['Gold no invoice base extracted', ctx('g', { eligibleInvoiceAmount: null })],
  ['Gold over pre-approval', ctx('g', { preApprovalAmount: 5000 })],
  ['Gold pre-approval still pending', ctx('g', { preApprovalStatus: 'PENDING_HUMAN_REVIEW' })],
  ['Gold low confidence 0.72', ctx('g', { amountConfidence: 0.72 })],
  ['Gold late submission (48 days)', ctx('g', { claimDate: '2026-10-19' })],
  ['Gold missing sign-in sheet', ctx('g', { documentTypes: ['TAX_INVOICE', 'EVENT_PHOTOS', 'PROOF_OF_PAYMENT'] })],
  ['Gold suspended partner', ctx('g', { partnerStatus: 'suspended' })],
  ['Gold duplicate invoice number', ctx('g', { duplicateInvoiceNumbers: ['INV-88912'] })],
  ['Gold insufficient budget', ctx('g', { availableBudget: 1200 })],
  ['Elite cap unconfigured (graceful degradation)', ctx('e', Object.assign(tierCtx('Elite'), { claimAmount: 5000, eligibleInvoiceAmount: 10000, partnerId: 'PTR-ELT-101' }))],
  ['Unassigned tier cold start', ctx('u', Object.assign(tierCtx('Other / Unassigned'), { claimAmount: 900, eligibleInvoiceAmount: null, tierRatio: null, partnerId: 'PTR-UNA-901' }))],
  ['Silver ratio not configured', ctx('s', Object.assign(tierCtx('Silver'), { claimAmount: 1500, eligibleInvoiceAmount: 3000, partnerId: 'PTR-SLV-456' }))],
  ['Unsupported currency', ctx('g', { currency: 'IDR' })],
  ['PRE_APPROVAL (claim-only rules N/A)', ctx('g', { submissionType: 'PRE_APPROVAL', parentPreApprovalId: null, preApprovalStatus: null, preApprovalAmount: null })],
  ['Open conflict names this submission', ctx('g', { openConflicts: [{ conflict_id: 'CF-002', field: 'single_event_cap', rule_a: 'R-CAP-003', rule_b: 'xlsx', status: 'open', affected_submissions: ['SUB-TEST-0001'] }] })],
  ['Open conflict names another submission', ctx('g', { openConflicts: [{ conflict_id: 'CF-002', field: 'single_event_cap', rule_a: 'R-CAP-003', rule_b: 'xlsx', status: 'open', affected_submissions: ['SUB-OTHER'] }] })]
];

for (const [label, c] of cases) {
  const r = runRules(rules, c);
  const s = r.summary;
  console.log(`\n== ${label}\n   VERDICT ${r.verdict}  passed=${s.passed} failed=${s.failed} blockers=${s.blockers} warn=${s.warnings} interp=${s.needs_interpretation} notEval=${s.not_evaluated} na=${s.not_applicable}`);
  for (const e of r.evaluated_rules) {
    if (e.status === 'PASSED' || e.status === 'NOT_APPLICABLE') continue;
    console.log(`   ${e.status.padEnd(30)} ${e.rule_id} ${e.error_code || ''} | ${e.metric}`);
  }
}
