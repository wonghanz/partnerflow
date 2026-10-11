'use strict';

/**
 * Agent 4 — deterministic four-state budget ledger (docs/04).
 * Invariant: Available = Allocated - (Committed + Approved + Paid) >= 0
 * Idempotency keys prevent retry double-deduction. Node is single-threaded per
 * request handler, so the in-process mutex below is the FOR UPDATE equivalent.
 */

const store = require('./store');
const { round2 } = require('./rules');

const LEDGER_FILE = 'ledger.json';

let queue = Promise.resolve();
function serialise(fn) {
  const run = queue.then(fn, fn);
  queue = run.then(() => {}, () => {});
  return run;
}

function load() {
  const ledger = store.read(LEDGER_FILE);
  if (!ledger || !Array.isArray(ledger.rows)) {
    throw Object.assign(new Error('BUDGET_LEDGER_NOT_CONFIGURED'), { code: 'BUDGET_LEDGER_NOT_CONFIGURED' });
  }
  return ledger;
}

function availableOf(row) {
  return round2(row.allocated_amount - (row.committed_amount + row.approved_amount + row.paid_amount));
}

function computeTotals(rows) {
  const sum = (k) => round2(rows.reduce((a, r) => a + (Number(r[k]) || 0), 0));
  const allocated = sum('allocated_amount');
  const committed = sum('committed_amount');
  const approved = sum('approved_amount');
  const paid = sum('paid_amount');
  return { allocated, committed, approved, paid, available: round2(allocated - (committed + approved + paid)) };
}

function findRow(ledger, partnerId, fiscalYear) {
  return ledger.rows.find((r) => r.partner_id === partnerId && Number(r.fiscal_year) === Number(fiscalYear)) || null;
}

function transactions() {
  const t = store.read('budget-transactions.json');
  return Array.isArray(t) ? t : [];
}

function pushTransaction(tx) {
  const list = transactions();
  list.push(tx);
  store.write('budget-transactions.json', list);
}

function idempotencyKey(submissionId, action, runId) {
  return `${submissionId}:${action}:${runId}`;
}

/**
 * RESERVE_COMMIT — pre-approval approved: freeze funds into committed.
 */
function reserveCommit({ submissionId, partnerId, amount, runId, ruleVersion, fiscalYear }) {
  return serialise(() => {
    const key = idempotencyKey(submissionId, 'RESERVE_COMMIT', runId);
    const existing = transactions().find((t) => t.idempotency_key === key);
    if (existing) return { status: 'ALREADY_PROCESSED', tx_id: existing.transaction_id, idempotency_key: key };

    const ledger = load();
    const row = findRow(ledger, partnerId, fiscalYear);
    if (!row) {
      return { status: 'NO_BUDGET_ALLOCATED', partner_id: partnerId, fiscal_year: fiscalYear, message: `Partner ${partnerId} has no budget allocated for ${fiscalYear}.` };
    }
    const available = availableOf(row);
    if (amount > available) {
      return { status: 'INSUFFICIENT_BUDGET', available, requested: round2(amount), shortfall: round2(amount - available) };
    }
    row.committed_amount = round2(row.committed_amount + amount);
    row.updated_at = new Date().toISOString();
    assertInvariant(ledger);
    ledger.company_totals = computeTotals(ledger.rows);
    store.write(LEDGER_FILE, ledger);

    const tx = {
      transaction_id: uuid(),
      idempotency_key: key,
      submission_id: submissionId,
      partner_id: partnerId,
      transaction_type: 'RESERVE_COMMIT',
      amount: round2(amount),
      rule_version: ruleVersion,
      created_at: new Date().toISOString()
    };
    pushTransaction(tx);
    return { status: 'SUCCESS', tx_id: tx.transaction_id, new_available: round2(available - amount), ledger_row: row };
  });
}

/**
 * COMMIT_TO_APPROVE — claim approved: atomic transfer committed -> approved.
 */
function commitToApprove({ submissionId, partnerId, amount, runId, ruleVersion, fiscalYear }) {
  return serialise(() => {
    const key = idempotencyKey(submissionId, 'COMMIT_TO_APPROVE', runId);
    const existing = transactions().find((t) => t.idempotency_key === key);
    if (existing) return { status: 'ALREADY_PROCESSED', tx_id: existing.transaction_id };

    const ledger = load();
    const row = findRow(ledger, partnerId, fiscalYear);
    if (!row) return { status: 'NO_BUDGET_ALLOCATED', partner_id: partnerId };
    const amt = round2(amount);
    if (amt > round2(row.committed_amount)) {
      return { status: 'INSUFFICIENT_COMMIT', committed: row.committed_amount, requested: amt };
    }
    row.committed_amount = round2(row.committed_amount - amt);
    row.approved_amount = round2(row.approved_amount + amt);
    row.updated_at = new Date().toISOString();
    assertInvariant(ledger);
    ledger.company_totals = computeTotals(ledger.rows);
    store.write(LEDGER_FILE, ledger);
    const tx = {
      transaction_id: uuid(), idempotency_key: key, submission_id: submissionId, partner_id: partnerId,
      transaction_type: 'COMMIT_TO_APPROVE', amount: amt, rule_version: ruleVersion, created_at: new Date().toISOString()
    };
    pushTransaction(tx);
    return { status: 'SUCCESS', tx_id: tx.transaction_id, ledger_row: row };
  });
}

/**
 * APPROVE_TO_PAID — finance disburses: atomic transfer approved -> paid.
 */
function approveToPaid({ submissionId, partnerId, amount, runId, ruleVersion, fiscalYear }) {
  return serialise(() => {
    const key = idempotencyKey(submissionId, 'PAY', runId);
    const existing = transactions().find((t) => t.idempotency_key === key);
    if (existing) return { status: 'ALREADY_PROCESSED', tx_id: existing.transaction_id };

    const ledger = load();
    const row = findRow(ledger, partnerId, fiscalYear);
    if (!row) return { status: 'NO_BUDGET_ALLOCATED', partner_id: partnerId };
    const amt = round2(amount);
    if (amt > round2(row.approved_amount)) {
      return { status: 'INSUFFICIENT_APPROVED', approved: row.approved_amount, requested: amt };
    }
    row.approved_amount = round2(row.approved_amount - amt);
    row.paid_amount = round2(row.paid_amount + amt);
    row.updated_at = new Date().toISOString();
    assertInvariant(ledger);
    ledger.company_totals = computeTotals(ledger.rows);
    store.write(LEDGER_FILE, ledger);
    const tx = {
      transaction_id: uuid(), idempotency_key: key, submission_id: submissionId, partner_id: partnerId,
      transaction_type: 'PAY', amount: amt, rule_version: ruleVersion, created_at: new Date().toISOString()
    };
    pushTransaction(tx);
    return { status: 'SUCCESS', tx_id: tx.transaction_id, ledger_row: row };
  });
}

/**
 * RELEASE_COMMIT — rejected / reduced claim: unfreeze committed funds.
 */
function releaseCommit({ submissionId, partnerId, amount, runId, ruleVersion, fiscalYear, reason }) {
  return serialise(() => {
    const key = idempotencyKey(submissionId, 'RELEASE_COMMIT', runId);
    const existing = transactions().find((t) => t.idempotency_key === key);
    if (existing) return { status: 'ALREADY_PROCESSED', tx_id: existing.transaction_id };

    const ledger = load();
    const row = findRow(ledger, partnerId, fiscalYear);
    if (!row) return { status: 'NO_BUDGET_ALLOCATED', partner_id: partnerId };
    const amt = round2(Math.min(amount, row.committed_amount));
    if (amt <= 0) return { status: 'NOTHING_TO_RELEASE', committed: row.committed_amount };
    row.committed_amount = round2(row.committed_amount - amt);
    row.updated_at = new Date().toISOString();
    assertInvariant(ledger);
    ledger.company_totals = computeTotals(ledger.rows);
    store.write(LEDGER_FILE, ledger);
    const tx = {
      transaction_id: uuid(), idempotency_key: key, submission_id: submissionId, partner_id: partnerId,
      transaction_type: 'RELEASE_COMMIT', amount: amt, rule_version: ruleVersion, reason: reason || null, created_at: new Date().toISOString()
    };
    pushTransaction(tx);
    return { status: 'SUCCESS', tx_id: tx.transaction_id, released: amt, ledger_row: row };
  });
}

function assertInvariant(ledger) {
  for (const row of ledger.rows) {
    if (availableOf(row) < 0) {
      throw Object.assign(
        new Error(`Financial invariant violated for ${row.partner_id}: Available < 0`),
        { code: 'INVARIANT_VIOLATION', row }
      );
    }
  }
  const totals = computeTotals(ledger.rows);
  if (totals.available < 0) {
    throw Object.assign(new Error('Financial invariant violated at company level: Available < 0'), { code: 'INVARIANT_VIOLATION', totals });
  }
}

function uuid() {
  return require('crypto').randomUUID();
}

function snapshot(partnerId, fiscalYear) {
  const ledger = load();
  const row = partnerId ? findRow(ledger, partnerId, fiscalYear || ledger.fiscal_year) : null;
  return {
    fiscal_year: ledger.fiscal_year,
    currency: ledger.currency,
    invariant: ledger.invariant,
    company_totals: ledger.company_totals || computeTotals(ledger.rows),
    computed_totals: computeTotals(ledger.rows),
    row: row ? { ...row, available: availableOf(row) } : null,
    cashflow_forecast_14d: ledger.cashflow_forecast_14d || [],
    provenance: ledger.provenance || 'derived'
  };
}

function reconcile() {
  const ledger = load();
  const totals = computeTotals(ledger.rows);
  const declared = ledger.company_totals || {};
  const drift = ['allocated', 'committed', 'approved', 'paid', 'available']
    .map((k) => ({ bucket: k, declared: declared[k], computed: totals[k], delta: round2((totals[k] || 0) - (declared[k] || 0)) }))
    .filter((d) => Math.abs(d.delta) > 0.005);
  return { balanced: drift.length === 0, totals, declared, drift, rows: ledger.rows.length };
}

module.exports = {
  reserveCommit, commitToApprove, approveToPaid, releaseCommit,
  snapshot, reconcile, computeTotals, availableOf, idempotencyKey, serialise
};
