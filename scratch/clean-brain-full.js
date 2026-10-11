const fs = require('fs');
const path = require('path');

const brainPath = path.join(__dirname, '..', 'server', 'data', 'brain.json');
const d = JSON.parse(fs.readFileSync(brainPath, 'utf8'));

// Update l3_rag_sources
d.l3_rag_sources = [
  {
    "doc_id": "SRC-01",
    "filename": "01-pre-approval-form.pdf",
    "category": "Forms",
    "importance": "Mandatory",
    "status": "active",
    "size_mb": 0.35,
    "rules_extracted": 4,
    "extraction_target": "Pre-approval form structure, mandatory fields, applicant details, planned budget lines",
    "extract_summary": "Extracted form schema and 12 mandatory fields, applicant block, and budget line tables as Agent 1 validation basis.",
    "refcheck": { "valid": true, "last_checked": "2026-10-10" }
  },
  {
    "doc_id": "SRC-02",
    "filename": "02-claim-reimbursement-form.pdf",
    "category": "Forms",
    "importance": "Mandatory",
    "status": "active",
    "size_mb": 0.42,
    "rules_extracted": 5,
    "extraction_target": "Claim form structure, invoice line items, payout accounts, parent pre-approval lineage",
    "extract_summary": "Extracted invoice line items table, recipient banking information, and parent_pre_approval_id lineage field.",
    "refcheck": { "valid": true, "last_checked": "2026-10-10" }
  },
  {
    "doc_id": "SRC-03",
    "filename": "03-partner-incentive-and-coop-policy.pdf",
    "category": "Policy",
    "importance": "Mandatory",
    "status": "active",
    "size_mb": 1.20,
    "rules_extracted": 14,
    "extraction_target": "Entry criteria, activity types, matching ratios, single-event caps, filing deadlines",
    "extract_summary": "Extracted 4 tier benefits, 3 claim window rules, and 18 document requirements; Gold RM 10,000 cap resolved under ADR-003.",
    "refcheck": { "valid": true, "last_checked": "2026-10-10" }
  },
  {
    "doc_id": "SRC-04",
    "filename": "04-partner-master-and-budget-tracker.xlsx",
    "category": "Data",
    "importance": "Mandatory",
    "status": "active",
    "size_mb": 0.85,
    "rules_extracted": 6,
    "extraction_target": "Partner directory, annual budget pool, allocated funds, transaction ledger",
    "extract_summary": "Extracted partner roster and budget pools; flagged worksheet Q3_Allocations cell F14 for administrator review under CF-002.",
    "refcheck": { "valid": true, "last_checked": "2026-10-10" }
  },
  {
    "doc_id": "SRC-05",
    "filename": "05-sample-historical-cases.pdf",
    "category": "Cases",
    "importance": "Recommended",
    "status": "active",
    "size_mb": 0.95,
    "rules_extracted": 5,
    "extraction_target": "Historical case precedents (standard approval, missing items, variances, rejections)",
    "extract_summary": "Ingested 5 benchmark precedent cases (case-01-normal to case-05-rejected-or-exception) as L3 evidence anchors.",
    "refcheck": { "valid": true, "last_checked": "2026-10-10" }
  },
  {
    "doc_id": "SRC-06",
    "filename": "06-current-workflow-sop.pdf",
    "category": "Process",
    "importance": "Mandatory",
    "status": "active",
    "size_mb": 0.65,
    "rules_extracted": 8,
    "extraction_target": "As-is approval workflow, reviewer roles, SLA timelines, escalation boundaries",
    "extract_summary": "Extracted role assignments, escalations, and 48-hour ops review SLA for pipeline alignment.",
    "refcheck": { "valid": true, "last_checked": "2026-10-10" }
  },
  {
    "doc_id": "SRC-07",
    "filename": "07-supporting-document-checklist.pdf",
    "category": "Checklist",
    "importance": "Mandatory",
    "status": "active",
    "size_mb": 0.50,
    "rules_extracted": 7,
    "extraction_target": "Mandatory document checklist: invoices, sign-in sheets, event photos, payment proofs",
    "extract_summary": "Extracted 4 required document types and verification standards for submission gating.",
    "refcheck": { "valid": true, "last_checked": "2026-10-10" }
  },
  {
    "doc_id": "SRC-08",
    "filename": "08-reporting-templates.xlsx",
    "category": "Templates",
    "importance": "Recommended",
    "status": "active",
    "size_mb": 0.40,
    "rules_extracted": 3,
    "extraction_target": "Weekly and monthly dashboard report layouts for operations, finance, and executive views",
    "extract_summary": "Archived and mapped reporting layout schemas for dashboard widgets.",
    "refcheck": { "valid": true, "last_checked": "2026-10-10" }
  },
  {
    "doc_id": "SRC-09",
    "filename": "09-communication-templates.docx",
    "category": "Templates",
    "importance": "Recommended",
    "status": "active",
    "size_mb": 0.30,
    "rules_extracted": 4,
    "extraction_target": "Approval notices, partner information requests, and formal rejection correspondence",
    "extract_summary": "Extracted communication rules and neutral tone templates for partner follow-ups.",
    "refcheck": { "valid": true, "last_checked": "2026-10-10" }
  },
  {
    "doc_id": "SRC-10",
    "filename": "10-approval-authority-matrix.pdf",
    "category": "Governance",
    "importance": "Mandatory",
    "status": "active",
    "size_mb": 0.25,
    "rules_extracted": 3,
    "extraction_target": "Delegation of authority (DOA) financial sign-off thresholds for Managers, Directors, VPs",
    "extract_summary": "Extracted 3-tier financial DOA limits to validate approver limits against claim amounts.",
    "refcheck": { "valid": true, "last_checked": "2026-10-10" }
  }
];

// Update l4_mindset
d.l4_mindset = [
  {
    "principle_id": "MINDSET_001",
    "version": 1,
    "status": "approved",
    "effective_date": "2026-03-01",
    "approved_by": "Operations Director",
    "policy_override_allowed": false,
    "principle": "For claims exceeding RM 10,000 lacking event execution evidence, flag as HIGH_ATTENTION, prioritize in senior review queue, and highlight reduction options in briefing memos.",
    "scope": "Joint marketing claims > RM 10,000",
    "basis": "Historical audit findings show 82% of high-value discrepancies involve missing attendee sign-in or execution photos.",
    "authority": "Commercial Operations Committee Charter §4.2"
  },
  {
    "principle_id": "MINDSET_002",
    "version": 1,
    "status": "proposed",
    "effective_date": "2026-04-01",
    "approved_by": null,
    "policy_override_allowed": false,
    "principle": "When a Gold partner hosts an inaugural webinar and exceeds pre-approval by < 10% (under RM 1,000) with complete recordings and registration logs, offer a 1-click reduction option to ceiling rather than full rejection.",
    "scope": "Gold tier inaugural digital webinars",
    "basis": "Fosters channel partner adoption during quarterly digital transformation campaigns.",
    "authority": "Proposed by APAC Channel Growth Lead"
  }
];

// Update l5_communication
d.l5_communication = [
  {
    "audience": "external_partner",
    "tone": "Courteous, professional, objective",
    "rules": [
      "Itemize missing documents and deadlines with actionable next steps",
      "Never make unapproved payout promises; forbid 'Your claim is approved' or 'We guarantee payment'",
      "Standardize on neutral terms like 'Pending final approval' and 'Subject to committee review'",
      "Cite clause codes and policy links when explaining limits without exposing internal scoring"
    ],
    "template_id": "TPL-EXT-RFI",
    "subject_template": "Action Required: Supporting Documents Requested for {{submission_id}}",
    "body_template": "Dear {{partner_name}} Team, Our review of {{submission_id}} indicates that the following documents are pending: {{missing_items}}. Please provide these files by {{deadline}}. Final claim approval remains subject to authorized sign-off (Pending final approval). Policy reference: policies/claim-eligibility.md#sec-2."
  },
  {
    "audience": "internal_operations",
    "tone": "Efficient, structured, task-driven",
    "rules": [
      "Sort worklist by SLA urgency and ageing days, highlighting items dwell time > 48 hours",
      "Itemize defect checklists, missing fields, and blocking rule codes per case",
      "Batch clarification questions into single-round aggregates; ban repetitive back-and-forth",
      "Flag conflicting rules clearly with direct links to configuration resolution"
    ],
    "template_id": "TPL-INT-OPS",
    "subject_template": "Ops Queue Digest — {{count}} Pending, {{breached}} Exceeding 48h SLA",
    "body_template": "Daily Worklist: {{worklist}}. Primary friction driver: {{bottleneck_type}} ({{share}}% of backlog). Prioritize {{oldest_submission_id}} (Ageing: {{ageing_days}}d, Owner: {{owner}})."
  },
  {
    "audience": "internal_finance",
    "tone": "Precise, conservative, audit-ready",
    "rules": [
      "Emphasize variance amounts, invoice compliance, and four-state pool movements with 2-decimal formatting",
      "Reference transaction_type and idempotency_key for each ledger entry, traceable to audit logs",
      "Report reconciliation delta (declared vs computed) and conservation invariant status",
      "Prohibit AI summaries as formal policy evidence; cite source page coordinates"
    ],
    "template_id": "TPL-INT-FIN",
    "subject_template": "Finance Ledger Settlement Digest — {{submission_id}}",
    "body_template": "Four-State Pool: Allocated RM {{allocated}} | Committed RM {{committed}} | Approved RM {{approved}} | Paid RM {{paid}} | Available RM {{available}}. Conservation check passed under rule version {{rule_version}}."
  },
  {
    "audience": "executive_management",
    "tone": "Concise, strategic, decisive (BLUF)",
    "rules": [
      "Bottom Line Up Front (BLUF): opening lines state recommendation, financial impact, and decisions required",
      "Highlight commercial risks and exception amounts, providing 1-click sign-off options and policy anchors",
      "Never present exceptions as finalized; always use 'Pending formal executive sign-off'",
      "Metrics share single source of truth with PostgreSQL database; no competing spreadsheet figures"
    ],
    "template_id": "TPL-EXEC-BRIEF",
    "subject_template": "Executive Briefing — {{exception_count}} Exceptions Pending, Risk Exposure RM {{exposure}}",
    "body_template": "Recommendation: {{recommendation}}. Financial Impact: RM {{impact}} ({{burn_pct}}% of annual allocation). Decision Required: {{options}}. Policy Reference: {{policy_refs}}; Pending formal executive sign-off."
  }
];

fs.writeFileSync(brainPath, JSON.stringify(d, null, 2), 'utf8');
console.log('Successfully completed full brain.json cleanup!');
