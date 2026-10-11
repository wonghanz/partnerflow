const fs = require('fs');
const path = require('path');

const brainPath = path.join(__dirname, '..', 'server', 'data', 'brain.json');
const d = JSON.parse(fs.readFileSync(brainPath, 'utf8'));

// 1. Skill router
d.l1_skill_router = [
  {
    "trigger": "Need to clarify new policy rules or address ambiguous conditions (e.g. invoice conflicts)",
    "skill": "grill-me",
    "skill_path": "skills/grill-me/SKILL.md",
    "used_by": "Agent 2",
    "purpose": "Generates structured clarification questions, pausing submission for confirmation",
    "provenance": "documented"
  },
  {
    "trigger": "Authoring or modifying policies, adjudicating conflicting rules",
    "skill": "grill-with-docs",
    "skill_path": "skills/grill-with-docs/SKILL.md",
    "used_by": "Agent 3",
    "purpose": "Conducts deep interrogation of rule designs, compiling glossary and ADR records",
    "provenance": "documented"
  },
  {
    "trigger": "Developing, debugging, or refactoring underlying agent code",
    "skill": "superpowers",
    "skill_path": "skills/superpowers/SKILL.md",
    "used_by": "Agent 7 (Engineering & QA)",
    "purpose": "Enforces TDD, systematic root-cause debugging, task breakdowns, and pre-release verification",
    "provenance": "documented"
  },
  {
    "trigger": "Security risks detected (Prompt injection, malicious attachments)",
    "skill": "security-audit",
    "skill_path": "skills/security-audit/SKILL.md",
    "used_by": "Agent 5",
    "purpose": "Independent validator falsification and isolated sandbox forensics",
    "provenance": "documented"
  },
  {
    "trigger": "Synthesizing long-term lessons from human approver feedback",
    "skill": "idea-refine",
    "skill_path": "skills/idea-refine/SKILL.md",
    "used_by": "Brain Layer L4 (Mindset Proposal Flow)",
    "purpose": "Clusters historical decision patterns to extract candidate mindset principles",
    "provenance": "derived"
  },
  {
    "trigger": "Synthesizing review opinions, decision memos, or information requests",
    "skill": "response-to-reviewers",
    "skill_path": "skills/response-to-reviewers/SKILL.md",
    "used_by": "Agent 6",
    "purpose": "Ensures complete issue coverage, absolute traceability, zero hallucination, and no unauthorized commitments",
    "provenance": "documented"
  },
  {
    "trigger": "Executive decision briefing, high-level risk assessment, and ROI synthesis",
    "skill": "boss-communication",
    "skill_path": "skills/boss-communication/SKILL.md",
    "used_by": "Agent 7 (Executive Briefing & Decision Desk)",
    "purpose": "Generates BLUF executive summary, financial impact rating, and strategic sign-off guidance",
    "provenance": "documented"
  }
];

// 2. Policy Wiki
d.l2_policy_wiki = [
  {
    "doc_id": "POL-PRE-APPROVAL",
    "title": "Pre-Approval Eligibility, Timeline & Delegation of Authority",
    "path": "policies/pre-approval.md",
    "version": "v2026.1",
    "effective_date": "2026-03-01",
    "sections": [
      {
        "anchor": "#sec-1.1",
        "heading": "Pre-Approval Form & Mandatory Fields",
        "body": "Every pre-approval request must be submitted using the standardized pre-approval template. Required fields comprise partner_id, event subject, applicant email, activity_date, programme budget line, and requested amount with currency. Any missing field triggers an immediate defect notice in Agent 2. The system never guesses or auto-completes fields.",
        "source_file": "01-pre-approval-form.pdf",
        "source_page": 1
      },
      {
        "anchor": "#sec-1.2",
        "heading": "Claim Amount Ceiling Matched to Pre-Approval",
        "body": "Reimbursement claim amounts must not exceed the pre-approval approved amount (claim_amount <= pre_approval_approved_amount), deterministically enforced by rule R-MATCH-004. If approved amount is RM 10,000 and claim is RM 15,000, excess RM 5,000 triggers an automated policy block with options to reduce to ceiling or escalate for special approval.",
        "source_file": "policies/pre-approval.md",
        "source_page": 2
      },
      {
        "anchor": "#sec-1.3",
        "heading": "Pre-Approval Lineage & Status Prerequisites",
        "body": "CLAIM submission types must reference a valid parent_pre_approval_id in APPROVED state. If the parent pre-approval is pending or rejected, rule R-LINK-007 blocks progression with PRE_APPROVAL_NOT_READY. No reimbursement may reserve or disburse funds without approved parental lineage.",
        "source_file": "policies/pre-approval.md",
        "source_page": 3
      },
      {
        "anchor": "#sec-1.4",
        "heading": "Committed Fund Reservation Upon Approval",
        "body": "Upon human approval of a pre-approval, Agent 4 executes RESERVE_COMMIT to move corresponding funds from Available into Committed. Atomic ledger isolation prevents race conditions and over-commitment.",
        "source_file": "04-partner-master-and-budget-tracker.xlsx",
        "source_page": 1
      },
      {
        "anchor": "#sec-1.5",
        "heading": "Vendor Quotation & Cost Estimates",
        "body": "Pre-approvals require vendor quotations and event agendas to substantiate planned expenditure. Absence of quotations flags the item for review but does not reject outright, generating an information request draft.",
        "source_file": "policies/pre-approval.md",
        "source_page": 4
      },
      {
        "anchor": "#sec-1.6",
        "heading": "Delegation of Authority (DOA) Thresholds",
        "body": "Approval authority thresholds govern sign-offs: Managers up to RM 10,000, Directors up to RM 50,000, and VPs above RM 50,000. All approvals require human credentials and are recorded in immutable audit logs.",
        "source_file": "10-approval-authority-matrix.pdf",
        "source_page": 1
      }
    ]
  },
  {
    "doc_id": "POL-CLAIM-ELIG",
    "title": "Claim Eligibility Scope, Evidence Requirements & Compliance Redlines",
    "path": "policies/claim-eligibility.md",
    "version": "v2026.2",
    "effective_date": "2026-03-01",
    "sections": [
      {
        "anchor": "#sec-2.1",
        "heading": "Eligible Marketing Activities",
        "body": "Eligible co-op marketing scopes are restricted to verified channel programs: Joint Marketing Events, Exhibition & Trade Show Subsidies, and Digital Advertising Lead Generation. All claims must correlate to approved pre-approvals.",
        "source_file": "03-partner-incentive-and-coop-policy.pdf",
        "source_page": 2
      },
      {
        "anchor": "#sec-2.2",
        "heading": "Four Mandatory Supporting Documents",
        "body": "Reimbursements require four core documents: Official Tax Invoice, Event Photos / Proof of Execution, Attendee Sign-in Sheet, and Proof of Payment (bank transfer / remittance). Deficiencies trigger business notices.",
        "source_file": "07-supporting-document-checklist.pdf",
        "source_page": 1
      },
      {
        "anchor": "#sec-2.3",
        "heading": "Event Execution Evidence Standards",
        "body": "Photos must demonstrate venue location and brand banners. Sign-in records must contain attendee identities. Missing items route to Agent 5 business exceptions, drafting partner notices.",
        "source_file": "07-supporting-document-checklist.pdf",
        "source_page": 2
      },
      {
        "anchor": "#sec-2.4",
        "heading": "Filing Deadline (30-Day Window)",
        "body": "Claims must be submitted within 30 calendar days following event completion (claim_date - activity_date <= 30), enforced by rule R-DATE-001. Overdue filings trigger a warning and require executive exception.",
        "source_file": "policies/claim-eligibility.md",
        "source_page": 3
      },
      {
        "anchor": "#sec-2.5",
        "heading": "Compliance Redlines & Non-Reimbursable Costs",
        "body": "Cash gift vouchers, personal expenses, unrelated travel, and duplicate claims violate compliance. Identified redlines immediately pause straight-through processing for investigation.",
        "source_file": "policies/claim-eligibility.md",
        "source_page": 4
      },
      {
        "anchor": "#sec-2.6",
        "heading": "Invoice Deduplication & Collision Prevention",
        "body": "Invoice numbers maintain a global unique index. Rule R-DUP-008 runs automated 90-day same-partner, same-date, same-amount collision scans to eliminate duplicate billing.",
        "source_file": "policies/claim-eligibility.md",
        "source_page": 5
      }
    ]
  },
  {
    "doc_id": "POL-BUDGET-CALC",
    "title": "Subsidy Caps, Matching Ratios & Four-State Ledger Accounting",
    "path": "policies/budget-calculation.md",
    "version": "v2026.3",
    "effective_date": "2026-03-01",
    "sections": [
      {
        "anchor": "#sec-3.1",
        "heading": "Four-State Budget Pool Definitions",
        "body": "Enterprise marketing budgets strictly differentiate four states: Allocated (annual allocation), Committed (frozen pre-approvals), Approved (verified claims awaiting payment), Paid (settled disbursements). Available = Allocated - (Committed + Approved + Paid).",
        "source_file": "policies/budget-calculation.md",
        "source_page": 1
      },
      {
        "anchor": "#sec-3.2",
        "heading": "Financial Conservation Invariant",
        "body": "Available headroom must remain >= 0 at all times. If any transaction produces negative available funds, the system triggers a hard rollback with INSUFFICIENT_BUDGET.",
        "source_file": "policies/budget-calculation.md",
        "source_page": 2
      },
      {
        "anchor": "#sec-3.3",
        "heading": "Budget Allocation & Fiscal Year Management",
        "body": "Allocated funds are recorded per partner and fiscal year. Adjustments are logged as audit rows rather than in-place overwrites to maintain historical integrity.",
        "source_file": "04-partner-master-and-budget-tracker.xlsx",
        "source_page": 2
      },
      {
        "anchor": "#sec-3.4",
        "heading": "Four Atomic Ledger Transaction Types",
        "body": "The ledger supports four atomic actions: RESERVE_COMMIT, COMMIT_TO_APPROVE, RELEASE_COMMIT, and PAY. Each write carries an idempotency key to prevent double posting.",
        "source_file": "policies/budget-calculation.md",
        "source_page": 3
      },
      {
        "anchor": "#sec-3.5",
        "heading": "Currency Whitelist & Tax Conversion",
        "body": "Base operating currency is MYR, supporting SGD, USD, and IDR with standard exchange rate indexing. Calculations round to 2 decimal places.",
        "source_file": "policies/budget-calculation.md",
        "source_page": 4
      },
      {
        "anchor": "#sec-3.6",
        "heading": "Gold Tier RM 10,000 Cap & 50% Ratio",
        "body": "Under ADR-003, Gold Tier partners are entitled to 50% co-op matching reimbursement capped at RM 10,000 per event. Claims exceeding caps trigger reduction options.",
        "source_file": "Partner_Incentive_2026_Q1.pdf",
        "source_page": 2
      },
      {
        "anchor": "#sec-3.7",
        "heading": "Elite Tier 70% Ratio Policy",
        "body": "Elite strategic partners receive 70% reimbursement matching ratios. Single-event caps are configured individually by executive committee sign-off.",
        "source_file": "policies/tier-benefits.md",
        "source_page": 1
      },
      {
        "anchor": "#sec-3.8",
        "heading": "Pre-Approval Surplus De-commitment",
        "body": "When a claim is approved below the pre-approval amount, the unutilized surplus executes RELEASE_COMMIT to return funds to Available.",
        "source_file": "policies/budget-calculation.md",
        "source_page": 5
      },
      {
        "anchor": "#sec-3.9",
        "heading": "Daily Balance Reconciliation",
        "body": "Automated reconciliation checks ledger transactions against pool state watermarks, raising alerts if any drift occurs.",
        "source_file": "policies/budget-calculation.md",
        "source_page": 6
      }
    ]
  },
  {
    "doc_id": "POL-TIER-BENEFITS",
    "title": "Partner Tiers, Entitlements & Thresholds",
    "path": "policies/tier-benefits.md",
    "version": "v2026.1",
    "effective_date": "2026-03-01",
    "sections": [
      {
        "anchor": "#sec-4.1",
        "heading": "Four-Tier Partner Ladder",
        "body": "Partners are categorized as Registered (0), Silver (1), Gold (2), or Elite (3). Unassigned partners fall back to baseline rules.",
        "source_file": "policies/tier-benefits.md",
        "source_page": 1
      },
      {
        "anchor": "#sec-4.2",
        "heading": "Tier Qualification & Re-certification",
        "body": "Tiers are reviewed annually based on sales volume and compliance. Status changes apply to future submissions without retroactively invalidating history.",
        "source_file": "policies/tier-benefits.md",
        "source_page": 2
      },
      {
        "anchor": "#sec-4.3",
        "heading": "Tier Documentation Exemptions",
        "body": "Elite partners are exempted from physical attendee sign-in sheets when high-resolution event photo proof is provided.",
        "source_file": "07-supporting-document-checklist.pdf",
        "source_page": 3
      },
      {
        "anchor": "#sec-4.4",
        "heading": "Administrative Configuration Boundary",
        "body": "Administrators configure tier caps and ratios via the Company Brain interface without requiring codebase changes.",
        "source_file": "policies/tier-benefits.md",
        "source_page": 4
      }
    ]
  },
  {
    "doc_id": "WFS-LIFECYCLE",
    "title": "Application Lifecycle State Machine",
    "path": "policies/lifecycle.md",
    "version": "v2026.1",
    "effective_date": "2026-03-01",
    "sections": [
      {
        "anchor": "#sec-5.1",
        "heading": "Straight-Through Processing Path",
        "body": "Submissions flow from SUBMITTED -> INTAKE_EXTRACTED -> VALIDATING -> RULES_EVALUATING -> BUDGET_RESERVING -> EXCEPTION_TRIAGE -> PENDING_HUMAN_REVIEW -> APPROVED -> PAID -> ARCHIVED.",
        "source_file": "docs/00-architecture-and-pipeline.md",
        "source_page": 2
      },
      {
        "anchor": "#sec-5.2",
        "heading": "Human Decision Boundaries",
        "body": "Final approval and payment authorization are strictly human operations. Autonomous agents generate recommendations only.",
        "source_file": "docs/00-architecture-and-pipeline.md",
        "source_page": 3
      },
      {
        "anchor": "#sec-5.3",
        "heading": "Exception Loop & Recovery",
        "body": "Submissions flagged for clarification pause at NEEDS_CLARIFICATION. Once partner inputs are logged, processing resumes seamlessly.",
        "source_file": "docs/00-architecture-and-pipeline.md",
        "source_page": 4
      },
      {
        "anchor": "#sec-5.4",
        "heading": "Immutable Audit Logging",
        "body": "Every state transition writes an immutable event row with timestamp, actor, and evidence references.",
        "source_file": "docs/00-architecture-and-pipeline.md",
        "source_page": 5
      }
    ]
  },
  {
    "doc_id": "WFS-EXCEPTION",
    "title": "Dual-Track Exception Triage Architecture",
    "path": "policies/exception-triage.md",
    "version": "v2026.1",
    "effective_date": "2026-03-01",
    "sections": [
      {
        "anchor": "#sec-6.1",
        "heading": "Business Track vs Security Track Separation",
        "body": "Business exceptions (missing documents, arithmetic variance) are segregated from security threats (prompt injections, tampered macros). Ordinary commercial mistakes are never treated as malicious.",
        "source_file": "docs/05-agent-exception.md",
        "source_page": 1
      },
      {
        "anchor": "#sec-6.2",
        "heading": "Security Quarantine Isolation",
        "body": "Files containing malicious payloads or prompt injection triggers route to SECURITY_QUARANTINE in an isolated sandbox.",
        "source_file": "docs/05-agent-exception.md",
        "source_page": 2
      },
      {
        "anchor": "#sec-6.3",
        "heading": "Independent Validator Falsification",
        "body": "A secondary red-team validator attempts to falsify security findings, ensuring authentic commercial files are not quarantined erroneously.",
        "source_file": "docs/05-agent-exception.md",
        "source_page": 3
      },
      {
        "anchor": "#sec-6.4",
        "heading": "Follow-Up Notification Generation",
        "body": "Business exceptions automatically draft polite Information Request templates for partner follow-up.",
        "source_file": "docs/05-agent-exception.md",
        "source_page": 4
      }
    ]
  },
  {
    "doc_id": "COM-TEMPLATES",
    "title": "Review Memos, Information Requests & Rejection Templates",
    "path": "policies/templates.md",
    "version": "v2026.1",
    "effective_date": "2026-03-01",
    "sections": [
      {
        "anchor": "#sec-7.1",
        "heading": "Structured 6-Section Review Memo",
        "body": "Standard memo comprises: 1. Submission Summary, 2. Completed Verifications, 3. Outstanding Issues & Evidence, 4. Recommended Action, 5. Items Requiring Approver Sign-Off, 6. Policy Citations.",
        "source_file": "docs/06-agent-human-review-workflow.md",
        "source_page": 1
      },
      {
        "anchor": "#sec-7.2",
        "heading": "Information Request (RFI) Template",
        "body": "Draft notification outlining missing documents, submission deadlines, and secure upload link for partner resubmission.",
        "source_file": "docs/06-agent-human-review-workflow.md",
        "source_page": 2
      },
      {
        "anchor": "#sec-7.3",
        "heading": "Rejection & Policy Block Notices",
        "body": "Formal rejection notices provide unambiguous policy citations and escalation appeal pathways without contentious phrasing.",
        "source_file": "docs/06-agent-human-review-workflow.md",
        "source_page": 3
      }
    ]
  }
];

// 3. Glossary
d.glossary = [
  { term: "Allocated", definition: "Annual or quarterly budget ceiling assigned to a partner or programme line.", path: "policies/budget-calculation.md#sec-3.1" },
  { term: "Committed", definition: "Approved pre-approval funds frozen in ledger to guarantee payout upon claim.", path: "policies/budget-calculation.md#sec-3.1" },
  { term: "Approved", definition: "Verified claim reimbursement amount awaiting disbursement release by cashier.", path: "policies/budget-calculation.md#sec-3.1" },
  { term: "Paid", definition: "Settled fund disbursement recorded in immutable ledger transaction logs.", path: "policies/budget-calculation.md#sec-3.1" },
  { term: "Available", definition: "Remaining headroom: Available = Allocated - (Committed + Approved + Paid) >= 0.", path: "policies/budget-calculation.md#sec-3.2" },
  { term: "Idempotency Key", definition: "Unique transaction key (submission_id:action:run_id) preventing duplicate ledger deductions.", path: "policies/budget-calculation.md#sec-3.4" },
  { term: "STP Rate", definition: "Straight-Through Processing rate: percentage of submissions evaluated without manual intervention.", path: "docs/07-agent-audit-reporting.md" },
  { term: "Ageing", definition: "Dwell time of a submission at the current owner relative to SLA thresholds.", path: "docs/07-agent-audit-reporting.md" },
  { term: "DOA Matrix", definition: "Delegation of Authority matrix defining approval limits for Managers, Directors, and VPs.", path: "10-approval-authority-matrix.pdf" },
  { term: "Zero Guessing", definition: "Iron Invariant 3: when documents or configs are uncertain, the system halts rather than fabricating data.", path: "docs/00-architecture-and-pipeline.md" },
  { term: "Security Quarantine", definition: "Isolated sandbox state for malicious attachments, preserving intact evidence for investigation.", path: "docs/05-agent-exception.md" }
];

// 4. Cases
d.cases = [
  {
    "title": "Standard Full Approval Case (case-01-normal)",
    "summary": "Gold tier partner submits RM 8,000 claim with all 4 required documents, filed 14 days post-activity under approved pre-approval.",
    "outcome": "All rules PASSED. Ledger completes COMMIT_TO_APPROVE transfer. Approved by human reviewer into PAID -> ARCHIVED."
  },
  {
    "title": "Missing Event Proof & Follow-up Notice",
    "summary": "Attachment includes tax invoice and quote but lacks event photos and attendee sign-in. Classified as business exception.",
    "outcome": "Rule R-DOC-005 flagged with WARNING. Agent 6 drafts Information Request notice in PENDING_INFO_REQUEST state."
  },
  {
    "title": "Invoice Amount Discrepancy (case-03-amount-mismatch)",
    "summary": "Two uploaded invoices total RM 15,000 but application declared amount is RM 10,000.",
    "outcome": "Grill-Me generates aggregated clarification question (CLR-Q1) in NEEDS_CLARIFICATION state."
  },
  {
    "title": "Excess Claim with Reduction Option",
    "summary": "Claim filed for RM 15,000 under Gold tier with RM 10,000 single-event ceiling.",
    "outcome": "Rules R-CAP-003 and R-MATCH-004 block auto-approval; Review memo offers 1-click reduction to RM 10,000 ceiling."
  },
  {
    "title": "Overdue Submission with Director Special Approval",
    "summary": "Claim filed 45 days after event (exceeding 30-day window) with suspended partner status.",
    "outcome": "R-DATE-001 warning and R-PARTNER-006 policy block. Escalates to Director review for final determination."
  },
  {
    "title": "Attachment Metadata Prompt Injection Quarantined",
    "summary": "Event photo EXIF metadata contains prompt injection payload attempting to override approval status.",
    "outcome": "Agent 5 isolates file into SECURITY_QUARANTINE sandbox; system prompt remains protected."
  },
  {
    "title": "Cold-Start Graceful Degradation",
    "summary": "Partner without configured tier submits claim during enterprise initialization.",
    "outcome": "Tier rules yield NOT_EVALUATED and route cleanly to human reviewer without breaking workflow."
  }
];

// 5. Client documents manifest
d.client_documents_manifest = [
  { seq: "01", filename: "01-pre-approval-form.pdf", category: "Forms", importance: "Mandatory", extraction_target: "Pre-approval form structure, mandatory fields, applicant details, planned budget lines" },
  { seq: "02", filename: "02-claim-reimbursement-form.pdf", category: "Forms", importance: "Mandatory", extraction_target: "Claim form structure, invoice line items, bank payout accounts, parental lineage" },
  { seq: "03", filename: "03-partner-incentive-and-coop-policy.pdf", category: "Policy", importance: "Mandatory", extraction_target: "Partner tiers, eligible marketing activities, co-op ratios, event caps, claim deadlines" },
  { seq: "04", filename: "04-partner-master-and-budget-tracker.xlsx", category: "Data", importance: "Mandatory", extraction_target: "Partner directory, annual budget pool, allocated funds, transaction ledger" },
  { seq: "05", filename: "05-sample-historical-cases.pdf", category: "Cases", importance: "Recommended", extraction_target: "Benchmark cases covering standard approvals, missing items, variances, and rejections" },
  { seq: "06", filename: "06-current-workflow-sop.pdf", category: "Process", importance: "Mandatory", extraction_target: "Reviewer roles, SLAs, handoff rules, escalation pathways, delegation of authority" },
  { seq: "07", filename: "07-supporting-document-checklist.pdf", category: "Checklist", importance: "Mandatory", extraction_target: "Checklist of invoices, sign-in sheets, photo proofs, and payment confirmations" },
  { seq: "08", filename: "08-reporting-templates.xlsx", category: "Templates", importance: "Recommended", extraction_target: "Operations, finance, and executive weekly/monthly dashboard reporting structures" },
  { seq: "09", filename: "09-communication-templates.docx", category: "Templates", importance: "Recommended", extraction_target: "Internal approval notifications, partner reminders, and formal rejection emails" },
  { seq: "10", filename: "10-approval-authority-matrix.pdf", category: "Governance", importance: "Mandatory", extraction_target: "Approval limit matrix specifying Manager, Director, and VP financial caps" }
];

// 6. ADRs
d.adr = [
  {
    "adr_id": "ADR-003",
    "title": "Gold Tier Single-Event Grant Cap Unified at RM 10,000",
    "decision": "Effective 2026-03-01, RM 10,000 cap from Partner_Incentive_2026_Q1 applies to all Gold tier claims, superseding legacy SOP_2025_V2.",
    "context": "Policy discrepancy discovered between SOP_2025_V2 (RM 8,000) and Partner_Incentive_2026_Q1 (RM 10,000).",
    "rationale": "Grill-With-Docs identified discrepancy and escalated to leadership. Commercial objectives prioritize RM 10,000 incentive.",
    "signed_by": ["APAC Business VP", "Finance Director"],
    "date": "2026-03-01",
    "status": "ratified"
  },
  {
    "adr_id": "ADR-004",
    "title": "Resolution of Budget Tracker Worksheet F14 (Pending)",
    "decision": "Pending administrator confirmation in Setup Wizard Step 3.",
    "context": "Worksheet Q3_Allocations retains legacy formula referencing RM 8,000.",
    "rationale": "Iron Invariant 3 prohibits AI from guessing business policy without human authorization.",
    "signed_by": ["Pending Administrator Sign-Off"],
    "date": "2026-03-10",
    "status": "proposed"
  }
];

// 7. Versions
d.versions = [
  {
    "version": "v2026.3.0",
    "status": "published",
    "published_at": "2026-03-01T00:00:00Z",
    "effective_date": "2026-03-01",
    "approved_by": "APAC Business VP & Finance Director (ADR-003)",
    "change_summary": "Production rule matrix incorporating 14 deterministic rules (timing, matching ratio, event caps, checklist, partner status, lineage, invoice deduplication)."
  },
  {
    "version": "v2026.4.0-draft",
    "status": "draft",
    "published_at": null,
    "effective_date": "2026-11-01",
    "approved_by": "Pending Administrator Sign-Off",
    "change_summary": "Draft rule bundle incorporating CF-002 adjudication and Silver tier limits."
  }
];

// 8. Onboarding pathways
d.onboarding_pathways = [
  {
    "id": "A",
    "title_en": "I Have Official Policy Documents",
    "title_zh": "I Have Official Policy Documents",
    "action_en": "Upload SOPs & spreadsheets to extract candidate rules",
    "action_zh": "Upload SOPs & spreadsheets to extract candidate rules",
    "fits_en": "Best for: Enterprises with documented policies",
    "fits_zh": "Best for: Enterprises with documented policies",
    "detail_en": "Upload existing PDF, Word, or Excel policies. System indexes with Docling and Grill-With-Docs.",
    "detail_zh": "Upload existing PDF, Word, or Excel policies. System indexes with Docling and Grill-With-Docs."
  },
  {
    "id": "B",
    "title_en": "I Know The Rules But Need To Document Them",
    "title_zh": "I Know The Rules But Need To Document Them",
    "action_en": "Guided questionnaire for progressive configuration",
    "action_zh": "Guided questionnaire for progressive configuration",
    "fits_en": "Best for: Teams with operational knowledge in staff memory",
    "fits_zh": "Best for: Teams with operational knowledge in staff memory",
    "detail_en": "Step through lightweight wizard to define tiers, ratios, and checklists systematically.",
    "detail_zh": "Step through lightweight wizard to define tiers, ratios, and checklists systematically."
  },
  {
    "id": "C",
    "title_en": "I Am Still Establishing Policy Rules",
    "title_zh": "I Am Still Establishing Policy Rules",
    "action_en": "Operate pipeline and crystallize rules gradually",
    "action_zh": "Operate pipeline and crystallize rules gradually",
    "fits_en": "Best for: Startups or evolving business programs",
    "fits_zh": "Best for: Startups or evolving business programs",
    "detail_en": "Enter basic company details and receive submissions immediately with graceful degradation.",
    "detail_zh": "Enter basic company details and receive submissions immediately with graceful degradation."
  }
];

// 9. Three layer isolation
d.three_layer_isolation = [
  {
    "layer": 1,
    "binding": "hard",
    "name": "Formal Policy & Requirements",
    "role_en": "Formal Policy & Governance Center",
    "role_zh": "Formal Policy & Governance Center",
    "body": "Encapsulates deterministic policies, tier caps, and mandatory documents. Compiles into executable rule matrix v2026.3.0."
  },
  {
    "layer": 2,
    "binding": "soft",
    "name": "Company Mindset & Communication",
    "role_en": "Company Mindset & Experience Center",
    "role_zh": "Company Mindset & Experience Center",
    "body": "Executive preferences, historical precedents, and tone guidelines. Used for recommendation ranking; never overrides formal policy."
  },
  {
    "layer": 3,
    "binding": "state",
    "name": "Live Operational Database",
    "role_en": "Dynamic Operational Single Source of Truth",
    "role_zh": "Dynamic Operational Single Source of Truth",
    "body": "Four-state budget ledger, real-time submission states, and payment records. Deterministic arithmetic with zero hallucinations."
  }
];

fs.writeFileSync(brainPath, JSON.stringify(d, null, 2), 'utf8');
console.log('Successfully updated brain.json to 100% English!');
