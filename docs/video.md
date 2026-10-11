# PartnerFlow — Pitch Video Script (PM / Technical Architect View)
**Duration:** ~3 minutes (≈390 words) | **Level:** B2 English | **Audience:** C-Suite / PM / Technical Architect
**Theme:** #72CDFF (Sky Blue) → #BFFFCC (Fresh Mint) on #FFFFFF background

---

## SCENE 1 — The Problem (0:00 – 0:30)

**Script:**
> Partner channel reimbursement is broken at the process level.
> Claims arrive via email, PDF, and Excel — with no standard structure.
> Rules live in PDFs that nobody has read. Budgets are tracked in spreadsheets that nobody trusts.
> The result: duplicated payments, missed deadlines, compliance gaps, and zero audit trail.
> This is not an AI problem. It is an architecture problem.
> PartnerFlow solves it with a deterministic, multi-agent pipeline built on enterprise-grade engineering principles.

**Slide image prompt:**
> Clean enterprise dashboard screenshot-style infographic on a white background with a #72CDFF to #BFFFCC gradient header bar. Four problem blocks arranged horizontally: "Unstructured Inputs", "Conflicting Rules", "Duplicate Budget Deductions", "Missing Audit Trail". Each block has a red warning icon. Bold sans-serif font. Professional, no characters, no illustrations.

**AI video transition:**
> Slide dissolves from left to right into a system architecture diagram, as if the scattered problem blocks are being pulled into a structured pipeline flow.

---

## SCENE 2 — The Hybrid Architecture (0:30 – 1:05)

**Script:**
> The core principle: separate what AI should do from what code must do.
> Financial calculations, rule matching, and budget deductions are handled entirely by deterministic Python and PostgreSQL — zero LLM involvement, zero hallucination risk.
> AI handles only what AI is actually good at: extracting unstructured documents, surfacing contradictions, and drafting structured communication.
> These two layers connect through a strict, versioned JSON event contract — every agent produces and consumes the same schema. No freestyle, no guessing.
> Five architecture layers stack precisely: Orchestrator state machine → Deterministic Engine → Targeted AI Modules → Brain Layer → Independent QA.

**Slide image prompt:**
> Technical architecture diagram on white background with #72CDFF to #BFFFCC gradient layer bands. Five labeled horizontal layers stacked top to bottom: "Orchestrator (State Machine)", "Deterministic Engine (PostgreSQL + Python)", "Targeted AI Modules (Docling, Grill-Me, Exception Analysis)", "Brain Layer (L0–L5)", "Independent QA (Superpowers TDD, RefChecker, Cloudflare Sandbox)". Arrows showing strict downward flow between layers. Minimal, blueprint-style, no illustrations.

**AI video transition:**
> Camera zooms into the pipeline layer, which expands left-to-right into the 7-agent sequential flow diagram.

---

## SCENE 3 — The 7-Agent Pipeline (1:05 – 1:45)

**Script:**
> Seven agents run in strict sequential order, enforced by a state machine with eleven named states.
> Agent 1 — Intake: Docling parses every file format. Pydantic V2 validates structure. Confidence below 0.85 blocks progression immediately.
> Agent 2 — Validation: Links every claim to its pre-approval record. Missing linkage triggers Grill-Me — a structured interrogation that batches all open questions and pauses the pipeline. No guessing.
> Agent 3 — Rules Engine: Executes the compiled rule matrix in pure Python. Grill-With-Docs was used offline to extract and stress-test all policy rules before runtime. Zero token cost at execution.
> Agent 4 — Budget Ledger: PostgreSQL with SELECT FOR UPDATE row-level locking. Four-state conservation: Allocated equals Committed plus Approved plus Paid plus Available. Enforced by a CHECK constraint, not by AI.
> Agent 5 — Exception Triage: Dual-track. Business exceptions go to human review. Security anomalies go to Cloudflare sandbox isolation with a three-state verdict: confirmed, needs validation, or rejected.
> Agent 6 — Human Review Workflow: Drafts the structured review memo using Response-to-Reviewers — six sections, full evidence pinning, with a hard prohibition on uncommitted promises.
> Agent 7 — Audit and Reporting: Immutable event log. Three dashboards for operations, finance, and management. Powered by Superpowers engineering discipline — test first, verify before close.

**Slide image prompt:**
> Horizontal 7-node pipeline flow diagram on white background. Nodes labeled Agent 1 through Agent 7 with short tech descriptions below each node. Connector arrows between nodes. Skill badges rendered as small colored pills below the relevant nodes: "Docling" under Agent 1, "Grill-Me" under Agent 2, "Grill-With-Docs" under Agent 3, "PG FOR UPDATE" under Agent 4, "Cloudflare Sandbox" under Agent 5, "Response-to-Reviewers" under Agent 6, "Superpowers TDD" under Agent 7. Color scheme: #72CDFF node borders, #BFFFCC badge fills, white background, dark text. Blueprint technical style.

**AI video transition:**
> The pipeline flow diagram retracts into the center, and eight glowing skill badges fan out in a ring to form the next scene.

---

## SCENE 4 — The 8 Skill Moats (1:45 – 2:15)

**Script:**
> Eight production skills are wired into the system — not as prompts, but as engineering contracts.
> Grill-Me and Grill-With-Docs eliminate ambiguity before and during runtime. Cloudflare Security Audit provides independent falsification, not just flagging. Superpowers enforces TDD and systematic debugging across every agent. Distill extracts recurring approval patterns from audit history and converts them into signed, versioned Mindset Proposals — approved by a Director, not inferred by the model. Response-to-Reviewers generates six-section memos with source pinning and commitment prohibition. Boss-Communication applies a four-audience tone matrix. RefChecker verifies every policy citation against the original source documents.
> These are not prompt engineering tricks. Each skill is a behavioral contract that constrains what the agent is allowed to do.

**Slide image prompt:**
> Eight hexagonal tiles arranged in a 4x2 grid on white background. Each tile contains a skill name and a one-line function: "Grill-Me — Batch interrogation, pipeline pause", "Grill-With-Docs — Offline policy stress-test, ADR output", "Cloudflare Security Audit — 3-state falsification, sandbox isolation", "Superpowers — TDD, systematic debugging, verify before close", "Distill — Approval pattern extraction → Mindset Proposals", "Response-to-Reviewers — 6-section memo, evidence pinning, no uncommitted promises", "Boss-Communication — BLUF, 4-audience tone matrix", "RefChecker — Policy citation verification against source documents". Hex tile borders in #72CDFF, fill gradient to #BFFFCC, bold labels, dark text, white background.

**AI video transition:**
> Hexagonal tiles fold upward and stack to reveal a layered pyramid diagram for the Brain Layer.

---

## SCENE 5 — Brain Layer L0–L5 (2:15 – 2:45)

**Script:**
> The Brain Layer is not a vector database. It is a five-tier enterprise knowledge system.
> L0 is the Global Brief — 300 tokens of hard invariants loaded on every run. L1 is the Skill Router — it loads skills only when a specific trigger condition is met, not by default. L2 is the Company Policy Wiki — structured Markdown compiled from source PDFs, versioned by effective date. L3 is RAG retrieval — raw source documents with page-level bounding box evidence. L4 is Mindset Memory — management judgment patterns that passed a six-step approval workflow before becoming active. L5 is Communication Memory — tone and format templates for four distinct audiences.
> Token usage is controlled by architecture, not by prompts. Rules run as code. Agents exchange compact JSON under 400 tokens per hop. File parsing is cached by SHA-256 hash. RAG retrieves Top-K equals two.
> The system gets smarter over time through the Distill workflow — but only with signed management authority. No autonomous self-update.

**Slide image prompt:**
> Vertical five-layer pyramid diagram on white background. From base to apex: L3 RAG (widest, ground truth evidence), L2 Company Policy Wiki, L4 Mindset Memory, L5 Communication Memory, L0+L1 Global Brief and Skill Router (apex, smallest). Each layer has a label and short descriptor. Color gradient from #72CDFF at base to #BFFFCC at apex. Right side of diagram shows a Token optimization callout box listing: "L0 = 300 tokens", "RAG Top-K=2", "Agent hop JSON < 400 tokens", "SHA-256 parse cache". Clean, technical, no illustrations.

**AI video transition:**
> Pyramid shrinks to become the brain icon in the center of a phase roadmap timeline that expands across the full slide.

---

## SCENE 6 — Roadmap & Impact (2:45 – 3:00)

**Script:**
> Phase 1 delivers the intake and validation pipeline with the deterministic rules engine. Phase 2 adds the budget ledger with full four-state conservation. Phase 3 activates the Brain Layer with Distill and RefChecker. Phase 4 connects the audit reporting suite. Phases 5 and 6 expand to multi-programme and external partner portal.
> The result: straight-through processing rate targets above 70 percent in Phase 1. Human review time reduced by an estimated 60 percent by Phase 3. Full audit trail from day one — no retroactive compliance work.
> PartnerFlow is production-ready architecture, not a prototype.

**Slide image prompt:**
> Six-phase horizontal timeline roadmap on white background with #72CDFF to #BFFFCC gradient progress bar. Phase labels above: "P1 Intake + Rules", "P2 Budget Ledger", "P3 Brain Layer + Distill", "P4 Audit Suite", "P5 Multi-Programme", "P6 Partner Portal". Below each phase: one key metric or milestone. Bottom right corner: UMochi Squad logo placeholder circle in #72CDFF. Bold, clean, no illustrations, enterprise report style.

**AI video transition:**
> Final slide fades to the UMochi Squad logo centered on white, with a #72CDFF to #BFFFCC horizontal gradient sweep from left to right, then holds.

---

## PRODUCTION NOTES

| Item | Specification |
|---|---|
| Total word count | ~390 words |
| Duration | 180 seconds / 3 minutes |
| Speaker perspective | Product Manager / Technical Architect |
| Audience | C-Suite, PM, Technical Architect |
| Language level | B2 English — precise, technical, no storytelling |
| Brand colours | #72CDFF Sky Blue → #BFFFCC Fresh Mint on #FFFFFF |
| What to exclude | No character narratives, no frontend UX scenes, no animated demos |
| Voice-over style | Steady, confident, declarative — no rhetorical questions, no emotional hooks |
| Key technical terms to pronounce clearly | Docling, Pydantic, PostgreSQL, SELECT FOR UPDATE, Grill-Me, RefChecker, BLUF |
