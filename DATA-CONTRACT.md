# DATA CONTRACT — files a real AI must author from the source documentation

Source of truth: `C:\Users\Hanz\Downloads\umochi-squad-partnerflow (3)\umochi-squad-partnerflow` (docs/00..11, docs/web.md, company-brain/, client-documents/README.md). Project root for the files you write: `C:\Users\Hanz\Documents\Qoder\2026-10-11\3696dfe6\umochi-squad-web` (all relative paths below resolve against it).

Every value below must be **derived from the documentation** (numbers, tier names, rule codes, states, policy refs, error codes, mindset principles, communication rules). Where the docs give concrete examples (e.g. `SUB-2026-MY-0042`, `PTR-GLD-882`, Gold cap RM 10,000, ratio 50%, 30-day window, four-state ledger totals RM 10,000,000 / 4,200,000 / 800,000 / 3,500,000 / 1,500,000), reuse them exactly. Where the docs leave a field open, invent a plausible value consistent with the docs and mark `"provenance": "derived"`. Values lifted verbatim from the docs get `"provenance": "documented"`.

Output must be **valid JSON, UTF-8, no comments, no trailing commas**. Write files with the Write tool to the exact paths given.

---

## 1. `server/data/config.json`

```json
{
  "brand": { "name": "UMochi Squad", "product": "PartnerFlow", "tagline": "...", "gradient": ["#72CDFF", "#BFFFCC"] },
  "org": { "name": "...", "environment": "...", "fiscal_year": 2026, "base_currency": "MYR", "region": "..." },
  "rule_engine_version": "v2026.3.0",
  "confidence_thresholds": { "amount_hard_block": 0.90, "parsing_suspend": 0.85 },
  "claim_window_days": 30,
  "sla_hours": { "ops_initial_review": 48 },
  "operator": { "name": "...", "email": "...", "role": "..." },
  "provenance": "documented|derived"
}
```

## 2. `server/data/tiers.json`

Array of partner tiers. Must include the four documented tiers `Elite`, `Gold`, `Silver`, `Registered` **plus** the documented `Other / Unassigned` fallback card. Each:

```json
{
  "tier_id": "TIER-GOLD", "name": "Gold", "level": 2,
  "status": "active|draft|not_configured|fallback",
  "eligibility_criteria": "...",
  "programme_limits": {
    "single_event_cap": 10000.00, "cap_currency": "MYR",
    "coop_reimbursement_ratio": 0.50,
    "cap_configured": true
  },
  "required_documents": ["TAX_INVOICE", "EVENT_PHOTOS", "ATTENDEE_SIGNIN", "PROOF_OF_PAYMENT"],
  "effective_date": "2026-03-01",
  "source_ref": "policies/tier-benefits.md#table-2",
  "approved_by": "...",
  "notes": "...",
  "provenance": "documented"
}
```

Documented anchors: Gold cap `RM 10,000` effective 2026-03-01 (ADR 003, supersedes SOP_2025_V2 RM 8,000), Gold ratio `50%`, Elite ratio `70%`, tiers ordered Registered(0) < Silver(1) < Gold(2) < Elite(3). `Silver` must be `not_configured` and `Other / Unassigned` must be `fallback` — matching web.md §4.5. Only tiers whose limits are documented get `cap_configured: true`; otherwise `cap_configured: false` and `single_event_cap: null` (zero auto-guessing rule).

## 3. `server/data/rules.json`

Compiled rule matrix. Must include the four documented rules verbatim and enough additional rules to cover every gate the docs describe (document completeness, partner active status, pre-approval linkage, invoice dedup, confidence circuit breaker, currency whitelist, budget availability, policy-undefined fallback, rule conflict). Each:

```json
{
  "rule_id": "R-CAP-003",
  "code": "REQ-CAP-002",
  "name": "单次额度上限 / Single-event cap",
  "description": "...",
  "category": "DOCUMENT|ELIGIBILITY|BUDGET|TIMELINESS|LINKAGE|SECURITY|DATA_QUALITY",
  "status": "active|draft|inactive",
  "applies_to": { "submission_types": ["CLAIM"], "programmes": ["All Programmes"], "tiers": ["All Tiers"] },
  "condition": { "type": "AMOUNT_LTE_TIER_CAP", "expression": "claim_amount <= tier_cap", "params": {} },
  "on_fail": "FLAG_FOR_REVIEW|REQUEST_MISSING_DOCUMENTS|BLOCK_PROGRESSION",
  "severity": "BLOCKER|WARNING|INFO",
  "error_code": "AMOUNT_EXCEEDS_TIER_CAP",
  "policy_ref": "policies/budget-calculation.md#rule-4",
  "approved_by": "...",
  "version": "v2026.3.0",
  "effective_date": "2026-03-01",
  "provenance": "documented"
}
```

The documented four: `R-DATE-001` (claim_date - activity_date <= 30 days, warn + special approval, `policies/claim-eligibility.md#sec-3`), `R-RATIO-002` (ratio cap, Gold 50%, BLOCK, `policies/tier-benefits.md#table-2`), `R-CAP-003` (cap Gold RM 10,000, BLOCK, `policies/budget-calculation.md#rule-4`), `R-MATCH-004` (claim_amount <= pre_approval_approved_amount, BLOCK, `policies/pre-approval.md#sec-1.2`).

`condition.type` must be one of: `AMOUNT_LTE_TIER_CAP`, `AMOUNT_RATIO_LTE`, `AMOUNT_LTE_PRE_APPROVAL`, `DAYS_SINCE_ACTIVITY_LTE`, `DOCUMENTS_PRESENT`, `PARTNER_STATUS_EQUALS`, `PRE_APPROVAL_STATUS_EQUALS`, `INVOICE_NUMBERS_UNIQUE`, `AMOUNT_CONFIDENCE_GTE`, `CURRENCY_IN_WHITELIST`, `BUDGET_AVAILABLE_GTE_AMOUNT`, `ALWAYS_NEEDS_INTERPRETATION`. Put machine params in `params` (e.g. `{"max_days":30}`, `{"ratio":0.5}`, `{"min_confidence":0.90}`, `{"required":["TAX_INVOICE","EVENT_PHOTOS"]}`, `{"allowed":["MYR","USD","SGD"]}`).

Also author `server/data/rule-conflicts.json`: an array of the documented conflict(s) (SOP_2025_V2 RM 8,000 vs Partner_Incentive_2026_Q1 RM 10,000, resolved by ADR 003) plus any unresolved conflict to drive the Conflict Banner:

```json
{ "conflict_id": "CF-001", "rule_a": "R-CAP-003", "rule_b": "...", "field": "single_event_cap",
  "value_a": 10000, "value_b": 8000, "source_a": "SOP_2025_V2.pdf#p4", "source_b": "Partner_Incentive_2026_Q1.pdf#p2",
  "status": "resolved|open", "resolution": "ADR-003", "resolved_by": "...", "resolved_at": "2026-03-01", "affected_submissions": [] }
```

## 4. `server/data/partners.json`

Partner master (at least 8 partners spanning all tiers, Malaysia/Singapore/Indonesia regions, and the documented `PTR-GLD-882` MegaTech Solutions (M) Sdn Bhd, Gold):

```json
{ "partner_id": "PTR-GLD-882", "name": "MegaTech Solutions (M) Sdn Bhd", "tier": "Gold",
  "status": "active|suspended", "region": "Malaysia", "contact_email": "...",
  "programmes": ["Q3 Joint Marketing"], "since": "2024-02-01", "provenance": "documented" }
```

Include at least one `suspended` partner and at least one partner with `tier: "Unassigned"` to exercise the documented graceful-degradation path.

## 5. `server/data/ledger.json`

Four-state budget ledger. Company totals must match docs/07 §4.2 exactly: Allocated 10,000,000 / Committed 4,200,000 / Approved 800,000 / Paid 3,500,000 / Available 1,500,000. Per-partner rows must sum to those totals.

```json
{
  "fiscal_year": 2026,
  "currency": "MYR",
  "company_totals": { "allocated": 10000000, "committed": 4200000, "approved": 800000, "paid": 3500000, "available": 1500000 },
  "rows": [ { "partner_id": "PTR-GLD-882", "fiscal_year": 2026, "allocated_amount": 0, "committed_amount": 0, "approved_amount": 0, "paid_amount": 0, "updated_at": "2026-10-10T09:00:00Z" } ],
  "invariant": "Available = Allocated - (Committed + Approved + Paid); must be >= 0",
  "cashflow_forecast_14d": [ { "date": "2026-10-12", "expected_payout": 0 } ],
  "provenance": "documented"
}
```

`rows[].allocated_amount` must sum to 10,000,000 and each of committed/approved/paid must sum to its company total. Include at least 6 entries in `cashflow_forecast_14d` covering 2026-10-11..2026-10-24 summing to <= approved.

## 6. `server/data/checklist.json`

Dynamic document checklist definitions per submission type (drives the ❌/✅ foolproof gate in web.md §3.2 C/D):

```json
{
  "CLAIM": [ { "item_id": "TAX_INVOICE", "order": 1, "label_zh": "盖章正规税务发票", "label_en": "Official Tax Invoice", "required": true, "match_keywords": ["invoice","tax","faktur","resit"], "policy_ref": "policies/claim-eligibility.md#sec-2" } ],
  "PRE_APPROVAL": [ ... ]
}
```

`CLAIM` must contain the four documented items (Tax Invoice, Event Photos/Proof of Execution, Attendee Sign-in Sheet, Proof of Payment). `PRE_APPROVAL` should contain the documented pre-approval form fields/programme plan items. `match_keywords` are lowercase filename tokens the server uses to auto-detect a match — give 3-6 realistic tokens each.

## 7. `server/data/brain.json`

The Company Brain (L0-L5) knowledge corpus used for RAG retrieval. Structure:

```json
{
  "setup_progress": { "completed_sections": 2, "total_sections": 5, "percent": 40, "save_and_return_later": true,
    "sections": [ { "id": "company_requirements", "label": "Company Requirements", "status": "complete|not_set|locked|in_progress", "detail": "...", "next_action_label": "..." } ] },
  "l0_global_brief": { "role": "...", "invariants": [ { "id": "INV-1", "title": "人工终审权绝不让渡", "body": "...", "verification": "..." } ] },
  "l1_skill_router": [ { "trigger": "...", "skill": "grill-me", "skill_path": "skills/grill-me/SKILL.md", "used_by": "Agent 2", "purpose": "..." } ],
  "l2_policy_wiki": [ { "doc_id": "POL-CLAIM-ELIG", "path": "company-brain/policies/claim-eligibility.md", "title": "...", "version": "v2026.3.0", "effective_date": "2026-03-01", "sections": [ { "anchor": "#sec-2", "heading": "...", "body": "...", "source_file": "03-programme-policy-and-sop.pdf", "source_page": 4 } ] } ],
  "l3_rag_sources": [ { "doc_id": "doc_sop_03", "filename": "03-programme-policy-and-sop.pdf", "category": "Policies & SOPs", "importance": "Required", "size_mb": 5.2, "status": "parsed|needs_attention|processing|uploaded", "extraction_target": "...", "extract_summary": "...", "rules_extracted": 14, "refcheck": { "valid": true, "last_checked": "2026-10-10" } } ],
  "l4_mindset": [ { "principle_id": "MINDSET_001", "principle": "...", "scope": "claim_triage", "basis": "...", "authority": "...", "policy_override_allowed": false, "version": 1, "effective_date": "2026-04-01", "status": "approved|proposed" } ],
  "l5_communication": [ { "audience": "partner|ops|finance|management", "tone": "...", "rules": ["..."], "template_id": "TPL-RFI-01", "subject_template": "...", "body_template": "..." } ],
  "glossary": [ { "term": "Partner Tier", "definition": "...", "path": "company-brain/glossary/partner-tier.md" } ],
  "cases": [ { "case_id": "CASE-OVER-BUDGET", "title": "...", "path": "company-brain/cases/over-budget.md", "summary": "...", "outcome": "...", "rule_refs": ["R-CAP-003"] } ],
  "client_documents_manifest": [ { "seq": "01", "filename": "01-pre-approval-form.pdf", "category": "Forms & templates", "importance": "Required", "extraction_target": "..." } ],
  "adr": [ { "adr_id": "ADR-003", "title": "...", "decision": "...", "signed_by": ["亚太区业务副总裁","财务总监"], "effective_date": "2026-03-01", "status": "accepted" } ],
  "versions": [ { "version": "v2026.3.0", "status": "published|draft", "published_at": "2026-03-01", "effective_date": "2026-03-01", "change_summary": "...", "approved_by": "...", "changes": [ { "rule_id": "R-CAP-003", "field": "single_event_cap", "before": 8000, "after": 10000 } ] } ],
  "onboarding_pathways": [ { "id": "A", "title_zh": "我已经有正式文件", "action_zh": "上传文件提取候选规则", "fits_zh": "适合：已有现成 SOP/Excel 的企业", "title_en": "...", "action_en": "...", "fits_en": "..." } ],
  "three_layer_isolation": [ { "layer": 1, "name": "Company Requirements", "role_zh": "正式政策中心", "body": "...", "binding": "hard" } ]
}
```

All 10 client documents must appear in `client_documents_manifest` and `l3_rag_sources` exactly as listed in `client-documents/README.md` (filenames, categories, Required/Recommended, extraction targets). `l0_global_brief.invariants` must be the 5 Iron Invariants from docs/11 §3. `l1_skill_router` must be the 6-row table from docs/08 §2 L1. `l4_mindset` must include MINDSET_001 and MINDSET_002 verbatim from `company-brain/mindset/approved-principles.md`. `l5_communication` must be the 4 audiences from docs/08 L5. `onboarding_pathways` must be the 3 cards A/B/C from web.md §4.4. `three_layer_isolation` must be the 3 layers from web.md §4.7. `setup_progress` must be 2 of 5 / 40% per web.md §4.3.

Aim for **25+ `l2_policy_wiki` sections** and **6+ `cases`** so RAG retrieval has real depth. Every `body` field must be substantive prose (2-6 sentences), written in the docs' bilingual style (Chinese primary with English terms), never placeholder text.

## 8. `server/data/agents.json`

The 7-agent pipeline definition for the UI pipeline visualiser:

```json
{ "agents": [ { "order": 1, "id": "intake", "name": "Intake Agent", "name_zh": "资料读取与结构化整理",
  "tech": ["Docling","Pydantic V2"], "skill": null, "in_state": "SUBMITTED", "out_state": "INTAKE_EXTRACTED",
  "deterministic": false, "token_profile": "0 cloud tokens (local parsing)", "responsibilities": ["..."], "defenses": ["..."],
  "failure_state": "NEEDS_INTAKE_CORRECTION", "doc": "docs/01-agent-intake.md" } ],
  "state_machine": [ { "from": "SUBMITTED", "to": "INTAKE_EXTRACTED", "trigger": "Agent 1 解析完成", "agent": "intake" } ],
  "event_contract_fields": ["run_id","submission_id","parent_pre_approval_id","partner_id","partner_tier","timestamp","source_agent","target_agent","status","payload","validation_result","evidence_refs"] }
```

`state_machine` must reproduce **every** transition in the docs/00 §2 state diagram (all 18 of them, including the failure/quarantine branches).

## 9. `server/data/dashboards.json`

The three role dashboards from docs/07 §4:

```json
{ "operations": { "title": "...", "widgets": [ { "id": "worklist", "type": "table|metric|heatmap|bar", "title": "...", "description": "...", "data_source": "submissions" } ] },
  "finance": { ... }, "management": { ... },
  "dimensions": [ { "id": "by_partner", "label_zh": "按伙伴", "label_en": "By Partner", "metric": "..." } ] }
```

`dimensions` must be the 5 documented ones (partner, region, tier, programme, status).

---

## Global rules for the authoring AI

- Read the docs first. Do not guess business facts that the docs settle.
- Every policy/rule citation must use the exact path anchors the docs use (`policies/claim-eligibility.md#sec-2`, `policies/budget-calculation.md#rule-4`, `policies/tier-benefits.md#table-2`, `policies/pre-approval.md#sec-1.2`).
- Money is a JSON number with 2 decimals max. Dates are ISO (`YYYY-MM-DD`). Timestamps are ISO-8601 UTC with `Z`.
- Set `"provenance"` on top-level objects: `"documented"` when the docs state it, `"derived"` when you extended it consistently.
- Validate each file parses as JSON before finishing (`node -e "JSON.parse(require('fs').readFileSync(p,'utf8'))"`).
- Do not create any file other than the 10 listed. Do not write Markdown summaries.
