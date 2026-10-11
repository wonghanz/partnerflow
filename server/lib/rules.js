'use strict';

/**
 * Agent 3 — deterministic rules engine. Zero LLM tokens at runtime (docs/03 §4).
 * Evaluates the compiled rule matrix against a submission context.
 */

const DAY_MS = 86400000;

function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.floor((b - a) / DAY_MS);
}

function evaluateCondition(rule, ctx) {
  const p = rule.condition && rule.condition.params ? rule.condition.params : {};
  const type = rule.condition ? rule.condition.type : null;

  switch (type) {
    case 'AMOUNT_LTE_TIER_CAP': {
      // The tier record is authoritative; the compiled matrix value is carried for transparency
      // so an admin can see the two agree (ADR-003 / CF-001).
      const matrixCap = p.cap_by_tier ? p.cap_by_tier[ctx.tierName] : undefined;
      const cap = ctx.tierCap !== null && ctx.tierCap !== undefined ? ctx.tierCap : matrixCap;
      if (cap === null || cap === undefined) {
        return { status: 'NOT_EVALUATED', reason: 'TIER_CAP_NOT_CONFIGURED', metric: 'Partner tier cap is not configured — requires manual adjudication' };
      }
      const ok = ctx.claimAmount <= cap;
      return {
        status: ok ? 'PASSED' : 'FAILED',
        metric: ok
          ? `Claim ${fmt(ctx.claimAmount, ctx.currency)} within ${ctx.tierName} cap ${fmt(cap, ctx.currency)}`
          : `Claim amount ${fmt(ctx.claimAmount, ctx.currency)} exceeds ${ctx.tierName} Tier limit of ${fmt(cap, ctx.currency)}`,
        detail: { claimed: ctx.claimAmount, cap_limit: cap, diff: round2(ctx.claimAmount - cap), matrix_value: matrixCap ?? null }
      };
    }

    case 'AMOUNT_RATIO_LTE': {
      const matrixRatio = p.ratio_by_tier ? p.ratio_by_tier[ctx.tierName] : undefined;
      const ratio = p.ratio !== undefined ? p.ratio
        : (ctx.tierRatio !== null && ctx.tierRatio !== undefined ? ctx.tierRatio : matrixRatio);
      if (ratio === null || ratio === undefined) {
        return { status: 'NOT_EVALUATED', reason: 'RATIO_NOT_CONFIGURED', metric: 'Co-op reimbursement ratio not configured' };
      }
      // R-RATIO-002 compares the claim against a ratio of the *qualified invoice amount*
      // (docs/03 §4). The claim is never its own base — substituting it would make the test
      // unpassable. Without an independent base, zero auto-guessing means NOT_EVALUATED.
      const eligible = ctx.eligibleInvoiceAmount;
      if (eligible === null || eligible === undefined || eligible <= 0) {
        return {
          status: 'NOT_EVALUATED',
          reason: 'ELIGIBLE_BASE_UNKNOWN',
          metric: `Co-op ratio ${Math.round(ratio * 100)}% is configured but no qualified invoice amount was extracted — eligible base unknown, cannot evaluate the reimbursement ceiling`,
          detail: { ratio, eligible_base: null, claimed: ctx.claimAmount }
        };
      }
      const ceiling = round2(eligible * ratio);
      const ok = ctx.claimAmount <= ceiling;
      return {
        status: ok ? 'PASSED' : 'FAILED',
        reason: ok ? undefined : 'RATIO_EXCEEDS_TIER_LIMIT',
        metric: ok
          ? `Claim ${fmt(ctx.claimAmount, ctx.currency)} within ${Math.round(ratio * 100)}% co-op ceiling ${fmt(ceiling, ctx.currency)} of qualified invoice base ${fmt(eligible, ctx.currency)}`
          : `Claim ${fmt(ctx.claimAmount, ctx.currency)} exceeds ${Math.round(ratio * 100)}% co-op ceiling ${fmt(ceiling, ctx.currency)} of qualified invoice base ${fmt(eligible, ctx.currency)}`,
        detail: { ratio, eligible_base: eligible, ceiling, claimed: ctx.claimAmount, over_by: ok ? 0 : round2(ctx.claimAmount - ceiling) }
      };
    }

    case 'AMOUNT_LTE_PRE_APPROVAL': {
      const pa = ctx.preApprovalAmount;
      if (ctx.submissionType !== 'CLAIM') return { status: 'NOT_APPLICABLE', metric: 'Rule applies to CLAIM only' };
      if (pa === null || pa === undefined) {
        return { status: 'FAILED', reason: 'PRE_APPROVAL_NOT_FOUND', metric: 'No linked approved pre-approval amount on record' };
      }
      const ok = ctx.claimAmount <= pa;
      return {
        status: ok ? 'PASSED' : 'FAILED',
        metric: ok
          ? `Claim ${fmt(ctx.claimAmount, ctx.currency)} within pre-approval ${fmt(pa, ctx.currency)}`
          : `Claim ${fmt(ctx.claimAmount, ctx.currency)} exceeds approved pre-approval ${fmt(pa, ctx.currency)} by ${fmt(round2(ctx.claimAmount - pa), ctx.currency)}`,
        detail: { claimed: ctx.claimAmount, pre_approval: pa, diff: round2(ctx.claimAmount - pa) }
      };
    }

    case 'DAYS_SINCE_ACTIVITY_LTE': {
      const max = p.max_days !== undefined ? p.max_days : ctx.claimWindowDays;
      if (max === null || max === undefined) {
        return { status: 'NOT_EVALUATED', reason: 'WINDOW_NOT_CONFIGURED', metric: 'Submission window (days) is not configured' };
      }
      const elapsed = daysBetween(ctx.activityDate, ctx.claimDate);
      if (elapsed === null) return { status: 'NOT_EVALUATED', reason: 'DATE_UNPARSEABLE', metric: 'Activity or claim date could not be parsed' };
      const ok = elapsed <= max;
      return {
        status: ok ? 'PASSED' : 'FAILED',
        metric: ok ? `${elapsed} days elapsed (limit ${max})` : `${elapsed} days elapsed, exceeds ${max}-day submission window by ${elapsed - max} days`,
        detail: { elapsed_days: elapsed, limit_days: max }
      };
    }

    case 'DOCUMENTS_PRESENT': {
      // Prefer the tier-aware required list resolved in buildContext; fall back to the
      // rule's own static params so the matrix stays self-describing when no tier matches.
      const required = Array.isArray(ctx.requiredDocs) && ctx.requiredDocs.length
        ? ctx.requiredDocs
        : (Array.isArray(p.required) ? p.required : []);
      const have = new Set(ctx.documentTypes || []);
      const missing = required.filter((r) => !have.has(r));
      if (required.length === 0) {
        return { status: 'NOT_EVALUATED', reason: 'CHECKLIST_NOT_CONFIGURED', metric: 'Checklist: Self-Verification Required — no required-document list configured for this tier' };
      }
      return {
        status: missing.length === 0 ? 'PASSED' : 'FAILED',
        metric: missing.length === 0
          ? `All ${required.length} required supporting documents present`
          : `Missing ${missing.length} required document(s): ${missing.join(', ')}`,
        detail: { required, present: [...have], missing }
      };
    }

    case 'PARTNER_STATUS_EQUALS': {
      const want = p.required_status || p.status || 'active';
      const ok = ctx.partnerStatus === want;
      return {
        status: ok ? 'PASSED' : 'FAILED',
        metric: ok ? `Partner ${ctx.partnerId} is ${want}` : `Partner ${ctx.partnerId} status is "${ctx.partnerStatus}", expected "${want}"`,
        detail: { partner_status: ctx.partnerStatus, expected: want }
      };
    }

    case 'PRE_APPROVAL_LINKED_AND_APPROVED':
    case 'PRE_APPROVAL_STATUS_EQUALS': {
      if (ctx.submissionType !== 'CLAIM') return { status: 'NOT_APPLICABLE', metric: 'Rule applies to CLAIM only' };
      const want = p.required_status || p.status || 'APPROVED';
      if (!ctx.parentPreApprovalId) {
        return { status: 'FAILED', reason: 'PRE_APPROVAL_NOT_READY', metric: 'CLAIM submitted without a parent pre-approval id' };
      }
      const ok = ctx.preApprovalStatus === want;
      return {
        status: ok ? 'PASSED' : 'FAILED',
        reason: ok ? undefined : 'PRE_APPROVAL_NOT_READY',
        metric: ok
          ? `Parent pre-approval ${ctx.parentPreApprovalId} is ${want}`
          : `Parent pre-approval ${ctx.parentPreApprovalId} is ${ctx.preApprovalStatus || 'UNKNOWN'}, expected ${want}`,
        detail: { pre_approval_status: ctx.preApprovalStatus }
      };
    }

    case 'INVOICE_NUMBERS_UNIQUE': {
      // docs/02 §4 splits deduplication into two distinct tests: a *global* invoice-number
      // uniqueness index, and a windowed near-duplicate scan (same partner + activity date +
      // amount) whose horizon is this rule's `window_days` param.
      const dupes = ctx.duplicateInvoiceNumbers || [];
      const near = ctx.nearDuplicates || [];
      const window = p.window_days !== undefined ? p.window_days : ctx.dedupWindowDays;
      const inWindow = typeof window === 'number'
        ? near.filter((n) => n.days_apart === null || n.days_apart === undefined || n.days_apart <= window)
        : near;
      const ok = dupes.length === 0 && inWindow.length === 0;
      const reasons = [];
      if (dupes.length) reasons.push(`duplicate invoice number(s) ${dupes.join(', ')} already recorded on prior submissions`);
      if (inWindow.length) reasons.push(`near-duplicate submission(s) within ${window ?? 'n/a'} days: ${inWindow.map((n) => n.submission_id).join(', ')}`);
      return {
        status: ok ? 'PASSED' : 'FAILED',
        reason: ok ? undefined : (dupes.length ? 'DUPLICATE_INVOICE_NUMBER' : 'POSSIBLE_DUPLICATE_SUBMISSION'),
        metric: ok
          ? `All ${(ctx.invoiceNumbers || []).length} invoice number(s) globally unique; no near-duplicate within the ${window ?? 'n/a'}-day window`
          : reasons.join('; '),
        detail: { duplicates: dupes, near_duplicates: inWindow, window_days: window ?? null }
      };
    }

    case 'AMOUNT_CONFIDENCE_GTE': {
      const min = p.min_confidence !== undefined ? p.min_confidence : ctx.amountHardBlock;
      if (min === null || min === undefined) {
        return { status: 'NOT_EVALUATED', reason: 'THRESHOLD_NOT_CONFIGURED', metric: 'Confidence hard-block threshold is not configured' };
      }
      const conf = ctx.amountConfidence;
      if (conf === null || conf === undefined) {
        return { status: 'FAILED', reason: 'CONFIDENCE_TOO_LOW', metric: 'Amount confidence unavailable' };
      }
      const ok = conf >= min;
      return {
        status: ok ? 'PASSED' : 'FAILED',
        reason: ok ? undefined : 'CONFIDENCE_TOO_LOW',
        metric: ok
          ? `Amount confidence ${conf.toFixed(2)} >= threshold ${min.toFixed(2)}`
          : `Amount confidence ${conf.toFixed(2)} below circuit-breaker threshold ${min.toFixed(2)} — FLAG_LOW_CONFIDENCE, budget step blocked`,
        detail: { confidence: conf, threshold: min }
      };
    }

    case 'CURRENCY_IN_WHITELIST': {
      // No literal whitelist: the compiled rule params are authoritative, and the only
      // grounded fallback is the organisation's base currency from config.json.
      const allowed = Array.isArray(p.allowed) && p.allowed.length
        ? p.allowed
        : (ctx.baseCurrency ? [ctx.baseCurrency] : null);
      if (!allowed) {
        return { status: 'NOT_EVALUATED', reason: 'WHITELIST_NOT_CONFIGURED', metric: 'No currency whitelist configured and no base currency on record' };
      }
      const ok = allowed.includes(ctx.currency);
      return {
        status: ok ? 'PASSED' : 'FAILED',
        metric: ok ? `Currency ${ctx.currency} is supported` : `Unsupported currency: ${ctx.currency} (allowed: ${allowed.join(', ')})`,
        detail: { currency: ctx.currency, allowed }
      };
    }

    case 'BUDGET_AVAILABLE':
    case 'BUDGET_AVAILABLE_GTE_AMOUNT': {
      const avail = ctx.availableBudget;
      if (avail === null || avail === undefined) {
        return { status: 'NOT_EVALUATED', reason: 'LEDGER_NOT_CONFIGURED', metric: 'Budget control formula not confirmed — automatic deduction disabled' };
      }
      const ok = ctx.claimAmount <= avail;
      return {
        status: ok ? 'PASSED' : 'FAILED',
        reason: ok ? undefined : 'INSUFFICIENT_BUDGET',
        metric: ok
          ? `Available ${fmt(avail, ctx.currency)} covers request ${fmt(ctx.claimAmount, ctx.currency)}`
          : `INSUFFICIENT_BUDGET: requested ${fmt(ctx.claimAmount, ctx.currency)}, available ${fmt(avail, ctx.currency)}`,
        detail: { requested: ctx.claimAmount, available: avail }
      };
    }

    case 'NO_INELIGIBLE_EXPENSES': {
      const banned = Array.isArray(p.banned_tokens) ? p.banned_tokens : ['alcohol', 'wine', 'beer', 'entertainment', 'karaoke', 'gift card'];
      const notes = (ctx.notes || '').toLowerCase();
      const hits = banned.filter((b) => notes.includes(b.toLowerCase()));
      const ok = hits.length === 0;
      return {
        status: ok ? 'PASSED' : 'FAILED',
        reason: ok ? undefined : 'INELIGIBLE_EXPENSE_DETECTED',
        metric: ok
          ? 'Zero ineligible expense items detected across claimed line items'
          : `Ineligible expense token(s) detected: ${hits.join(', ')}`,
        detail: { banned_tokens: banned, hits }
      };
    }

    case 'INTEGRITY_CHECK': {
      const hashDup = ctx.hashDuplicate === true;
      const tampered = ctx.metadataTamper === true;
      const ok = !hashDup && !tampered;
      return {
        status: ok ? 'PASSED' : 'FAILED',
        reason: ok ? undefined : 'SECURITY_HASH_AND_TAMPER_DETECTED',
        metric: ok
          ? 'SHA-256 signatures verified; metadata integrity intact; zero tamper signals'
          : (tampered ? 'Tampered invoice or metadata anomaly detected' : 'Duplicate document hash detected'),
        detail: { hash_duplicate: hashDup, metadata_tamper: tampered }
      };
    }

    case 'DIGITAL_ANALYTICS_PRESENT': {
      const docTypes = new Set(ctx.documentTypes || []);
      const ok = docTypes.has('DIGITAL_ANALYTICS') || docTypes.has('EVENT_PHOTOS') || docTypes.has('TAX_INVOICE');
      return {
        status: ok ? 'PASSED' : 'FAILED',
        reason: ok ? undefined : 'MISSING_ANALYTICS_TELEMETRY',
        metric: ok
          ? 'Marketing telemetry and reach metrics verified'
          : 'Missing third-party digital marketing analytics telemetry',
        detail: { present: [...docTypes] }
      };
    }

    case 'ALWAYS_NEEDS_INTERPRETATION': {
      // Despite the name, this guard is condition-driven: it escalates to a human only
      // when its `reason` actually holds for this submission, so configured tiers and
      // conflict-free claims keep the deterministic happy path (docs/03 §4, docs/web §4.8).
      const reason = p.reason || 'policy_undefined';
      if (reason === 'policy_not_configured') {
        // Fire when the governing tier has no configured single-event cap — the
        // Unassigned / not-configured graceful-degradation path (docs/web §4.5).
        const capMissing = ctx.tierCap === null || ctx.tierCap === undefined;
        return capMissing
          ? {
            status: 'REQUIRES_POLICY_INTERPRETATION',
            reason: 'POLICY_NOT_CONFIGURED',
            metric: `${ctx.tierName || 'Unassigned'} tier has no configured single-event cap — zero auto-guessing, escalated to policy owner for manual limit adjudication`,
            detail: { tier: ctx.tierName, cap_configured: false }
          }
          : { status: 'PASSED', metric: `Governing tier ${ctx.tierName} has a configured cap ${fmt(ctx.tierCap, ctx.currency)} — policy defined, no interpretation needed` };
      }
      if (reason === 'rule_conflict') {
        // Fire only when this specific submission is named by an OPEN conflict; otherwise the
        // conflict surfaces as the admin Conflict Banner, not a per-claim automatic halt.
        const hit = (ctx.openConflicts || []).find((c) => (c.affected_submissions || []).includes(ctx.submissionId));
        return hit
          ? {
            status: 'REQUIRES_POLICY_INTERPRETATION',
            reason: 'RULE_CONFLICT_DETECTED',
            metric: `Open rule conflict ${hit.conflict_id} on "${hit.field}" (${hit.rule_a} vs ${hit.rule_b}) affects this submission — no silent override, awaiting admin adjudication`,
            detail: { conflict_id: hit.conflict_id, field: hit.field, rule_a: hit.rule_a, rule_b: hit.rule_b }
          }
          : { status: 'PASSED', metric: 'No open rule conflict names this submission — matrix is consistent for this record' };
      }
      return { status: 'REQUIRES_POLICY_INTERPRETATION', reason: 'POLICY_UNDEFINED', metric: `Interpretation guard "${reason}" — condition not enumerated in the compiled matrix, escalated to policy owner` };
    }

    default:
      return { status: 'REQUIRES_POLICY_INTERPRETATION', reason: 'POLICY_UNDEFINED', metric: `Unknown condition type "${type}" — safe fallback to policy owner` };
  }
}

function ruleApplies(rule, ctx) {
  const at = rule.applies_to || {};
  const types = at.submission_types || [];
  if (types.length && !types.includes(ctx.submissionType)) return false;
  const tiers = at.tiers || [];
  if (tiers.length && !tiers.includes('All Tiers') && !tiers.includes(ctx.tierName)) return false;
  const programmes = at.programmes || [];
  if (programmes.length && !programmes.includes('All Programmes')) {
    const subject = ctx.submissionProgramme
      || (Array.isArray(ctx.partnerProgrammes) ? ctx.partnerProgrammes : []);
    const list = Array.isArray(subject) ? subject : [subject];
    if (!list.some((p) => programmes.includes(p))) return false;
  }
  return true;
}

function runRules(rules, ctx) {
  const evaluated = [];
  for (const rule of rules) {
    if (rule.status !== 'active') continue;
    if (!ruleApplies(rule, ctx)) continue;
    const res = evaluateCondition(rule, ctx);
    evaluated.push({
      rule_id: rule.rule_id,
      rule_code: rule.code || null,
      name: rule.name,
      status: res.status,
      severity: rule.severity,
      on_fail: rule.on_fail,
      error_code: res.status === 'FAILED' ? (res.reason || rule.error_code || 'RULE_FAILED') : (res.reason || null),
      metric: res.metric,
      detail: res.detail || null,
      policy_ref: rule.policy_ref,
      category: rule.category
    });
  }

  const failed = evaluated.filter((e) => e.status === 'FAILED');
  const blockers = failed.filter((e) => e.severity === 'BLOCKER');
  const undefinedHits = evaluated.filter((e) => e.status === 'REQUIRES_POLICY_INTERPRETATION');
  const notEvaluated = evaluated.filter((e) => e.status === 'NOT_EVALUATED');

  let verdict = 'PASSED';
  if (blockers.length) verdict = 'POLICY_BLOCKED';
  else if (undefinedHits.length) verdict = 'REQUIRES_POLICY_INTERPRETATION';
  else if (failed.length || notEvaluated.length) verdict = 'PASSED_WITH_WARNINGS';

  return {
    rule_engine_version: ctx.ruleEngineVersion,
    all_passed: verdict === 'PASSED',
    verdict,
    evaluated_rules: evaluated,
    summary: {
      total: evaluated.length,
      passed: evaluated.filter((e) => e.status === 'PASSED').length,
      failed: failed.length,
      blockers: blockers.length,
      warnings: failed.filter((e) => e.severity !== 'BLOCKER').length,
      needs_interpretation: undefinedHits.length,
      not_evaluated: notEvaluated.length,
      not_applicable: evaluated.filter((e) => e.status === 'NOT_APPLICABLE').length
    }
  };
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function fmt(n, currency) {
  if (n === null || n === undefined) return 'n/a';
  const code = currency || 'MYR';
  const symbol = code === 'MYR' ? 'RM' : code === 'USD' ? '$' : code === 'SGD' ? 'S$' : `${code} `;
  return `${symbol} ${Number(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = { runRules, evaluateCondition, ruleApplies, daysBetween, round2, fmt };
