# PartnerFlow · UMochi Squad

> **Enterprise Partner Pre-Approval & Claim Automation Console**  
> *Deterministic Rules Engine · 4-State Conserved Budget Ledger · 7-Agent Pipeline · Grounded AI Corporate Brain*

[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Zero External Dependencies](https://img.shields.io/badge/Dependencies-0%20(Pure%20Node%20Builtin)-blue?logo=javascript)](https://nodejs.org/)
[![Architecture](https://img.shields.io/badge/Architecture-7--Agent%20Pipeline-72CDFF)](docs/00-architecture-and-pipeline.md)
[![Budget Ledger](https://img.shields.io/badge/Ledger-4--State%20Conserved-BFFFCC)](docs/04-agent-budget-claim-verification.md)
[![Tests](https://img.shields.io/badge/Tests-Passing-success)](test-rules.js)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 📺 Promotional & Pitch Demo Video

Watch the comprehensive technical architecture and live walkthrough of **PartnerFlow**:

[![PartnerFlow Demo Video](https://img.youtube.com/vi/KAfzeq-uHQo/maxresdefault.jpg)](https://youtu.be/KAfzeq-uHQo)

👉 **[Click here to watch the full demo on YouTube (https://youtu.be/KAfzeq-uHQo)](https://youtu.be/KAfzeq-uHQo)**

> *"Partner channel reimbursement is broken at the process level. Claims arrive via fragmented emails, PDFs, and spreadsheets with conflicting rules and zero auditability. This is not an AI problem — it is an architecture problem. PartnerFlow solves it with a deterministic, multi-agent pipeline built on enterprise-grade engineering principles."*

---

## 💡 Executive Summary & Philosophy

**PartnerFlow** separates what AI should do from what deterministic code must do:

* **Deterministic Code & SQL Engine**: Financial calculations, policy threshold matching, duplicate detection, and budget ledger deductions run with **zero LLM involvement and zero hallucination risk**.
* **Targeted AI Capabilities**: Multimodal document parsing, missing-evidence question generation (*Grill-Me*), and structured reviewer memos (*Response-to-Reviewers*), grounded strictly in an enterprise corporate brain corpus.
* **Conserved 4-State Ledger**: Row-level locking guarantees that `Allocated = Committed + Approved + Paid + Available` at all times.

---

## 🏛️ The 7-Agent Pipeline

```
                                      PARTNER INTAKE
                                             │
                                             ▼
   ┌──────────────────────────────────────────────────────────────────────────────────┐
   │ [Agent 1: Intake]                                                                │
   │ Multimodal parsing (Docling) · Contract validation · Confidence score threshold │
   └─────────────────────────────────────────┬────────────────────────────────────────┘
                                             ▼
   ┌──────────────────────────────────────────────────────────────────────────────────┐
   │ [Agent 2: Validation]                                                            │
   │ Parent Pre-Approval linkage · Required checklist audit · Grill-Me missing info   │
   └─────────────────────────────────────────┬────────────────────────────────────────┘
                                             ▼
   ┌──────────────────────────────────────────────────────────────────────────────────┐
   │ [Agent 3: Rules Engine]                                                          │
   │ Deterministic compiled rule matrix · Tier caps & ratios · Zero runtime tokens    │
   └─────────────────────────────────────────┬────────────────────────────────────────┘
                                             ▼
   ┌──────────────────────────────────────────────────────────────────────────────────┐
   │ [Agent 4: Budget Ledger]                                                         │
   │ 4-State conservation invariant · Idempotency keys · Transaction isolation        │
   └─────────────────────────────────────────┬────────────────────────────────────────┘
                                             ▼
   ┌──────────────────────────────────────────────────────────────────────────────────┐
   │ [Agent 5: Exception Triage]                                                      │
   │ Dual-track: Business escalation vs. Cloudflare Sandbox security quarantine       │
   └─────────────────────────────────────────┬────────────────────────────────────────┘
                                             ▼
   ┌──────────────────────────────────────────────────────────────────────────────────┐
   │ [Agent 6: Human Review Workflow]                                                 │
   │ Evidence-pinned memo generator · Zero hallucinated promises · Human final gate   │
   └─────────────────────────────────────────┬────────────────────────────────────────┘
                                             ▼
   ┌──────────────────────────────────────────────────────────────────────────────────┐
   │ [Agent 7: Audit & Dashboards]                                                    │
   │ Immutable audit trail · Executive, Finance & Ops KPI views · Complete lineage    │
   └──────────────────────────────────────────────────────────────────────────────────┘
```

1. **Intake Agent**: Ingests partner claims and pre-approvals across heterogeneous formats; enforces schema contracts with confidence scoring (`< 0.85` triggers automatic intake flags).
2. **Validation Agent**: Cross-links claims to pre-approval allocations. Automatically detects missing documents and batches structured inquiries.
3. **Rules Engine**: Pure deterministic logic evaluating tier ratios, expense ceilings, submission deadlines, and grace periods.
4. **Budget Ledger Engine**: Enforces strict mathematical balance across budget pools (`Allocated == Committed + Approved + Paid + Available`).
5. **Exception Agent**: Routes business anomalies to human approvers while isolating suspicious documents into a quarantine track.
6. **Human Review Workflow**: Generates comprehensive decision memos with exact evidence citations for human approvers.
7. **Audit & Reporting**: Records every transition in an append-only event ledger and feeds three real-time operational consoles.

---

## ⚡ Key Highlights

* **Zero External NPM Dependencies**: Runs entirely on native Node.js (`node:http`, `node:sqlite`, `node:crypto`, `node:fs`). Fast, secure, lightweight, and vulnerability-free.
* **Pluggable LLM Provider with Graceful Offline Degradation**: Works out-of-the-box offline using deterministic extractive retrieval. Connect any OpenAI-compatible provider (e.g., DeepSeek, OpenAI) via `server/.env` whenever generative features are desired.
* **Company Brain Layer (L0–L5)**: Multi-layer hierarchical knowledge store encompassing core rules, workflows, policies, cases, and communication guidelines.
* **Modern Vanilla SPA Console**: Built with native ES modules, reactive state management, and an executive aesthetic featuring `#72CDFF` (Sky Blue) to `#BFFFCC` (Fresh Mint) accents.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js** `>= 20.0.0` (Node 20, 22, or 24 recommended)
* No `npm install` needed — **0 external npm dependencies!**

### 1. Clone the Repository
```bash
git clone https://github.com/wonghanz/umochi-squad-partnerflow.git
cd umochi-squad-partnerflow
```

### 2. (Optional) Configure AI Provider
PartnerFlow operates with 100% functionality offline. If you want to enable generative AI features with an OpenAI-compatible provider (e.g. DeepSeek):

```bash
# Copy template configuration
cp server/.env.example server/.env
```

Edit `server/.env`:
```ini
PARTNERFLOW_LLM_BASE_URL=https://api.deepseek.com/v1
PARTNERFLOW_LLM_MODEL=deepseek-flash
PARTNERFLOW_LLM_API_KEY=your_api_key_here
```
*(Leave empty or omit to run in deterministic offline mode).*

### 3. Seed the Baseline Corpus & Ledger
Initialize the 22 pre-configured intake cases, policy matrix, and immutable budget ledger:

```bash
node server/seed-submissions.js
```
Expected output:
```text
Ledger: balanced=true rows=10 totals={"allocated":10000000,...}
Audit events: 159   Submissions: 22   Terminal: 6
Corpus ready. Start the app: node server/index.js
```

### 4. Start the Application Server
```bash
node server/index.js
```

### 5. Access the Console
Open your web browser and navigate to:
* **Web UI Console**: [http://127.0.0.1:4321](http://127.0.0.1:4321)
* **System Health API**: [http://127.0.0.1:4321/api/health](http://127.0.0.1:4321/api/health)

---

## 🧪 Testing & Verification

Run the deterministic policy test suite covering edge cases (caps, ratio limits, missing documents, suspended partners, budget exhaustion):

```bash
node test-rules.js
```

Run internal code verification utilities:
```bash
# Check CSS consistency
node _tools/css-gaps.js

# Query local database directly via SQL CLI
node server/run-sql.js "SELECT submission_id, partner_name, state, amount FROM submissions LIMIT 5"
```

---

## 📂 Project Directory Structure

```text
├── docs/                   # Full system specifications (00-architecture through 11-cross-check)
├── company-brain/          # Hierarchical Corporate Brain (policies, glossary, SOPs, cases)
├── client-documents/       # Sample client forms, guidelines & approval authority matrices
├── test-upload-samples/    # Realistic test document samples for intake simulation
├── uploads/                # Synthetic PDF assets attached to intake submissions
├── server/
│   ├── index.js            # Native HTTP server & REST route handler
│   ├── seed-submissions.js # Deterministic corpus & ledger builder
│   ├── run-sql.js          # Built-in SQLite CLI query tool
│   ├── .env.example        # Environment variable template
│   ├── lib/
│   │   ├── ai.js           # Pluggable OpenAI/DeepSeek provider adapter
│   │   ├── db.js           # SQLite storage layer with prepared statements
│   │   ├── ledger.js       # 4-state budget ledger with balance check invariant
│   │   ├── pipeline.js     # State machine & transition lifecycle
│   │   ├── rag.js          # Grounded corporate brain retrieval engine
│   │   └── rules.js        # Pure deterministic policy rules evaluation
│   └── data/               # Persistent JSON files & SQLite database
├── public/                 # Vanilla ES-Module Single Page Application (SPA)
│   ├── index.html          # Clean entrypoint with executive UI styling
│   ├── css/                # Enterprise styling & design tokens
│   └── js/                 # Reactive frontend views (Brain, Budget, Submissions, Audit)
├── test-rules.js           # Comprehensive rules engine test suite
├── package.json            # Node project configuration (Zero dependencies)
└── video.md                # Presentation pitch script & visual storyboard
```

---

## 🔒 Security & Data Integrity Guarantees

* **Zero Hardcoded Secrets**: Scanned and verified clean of any hardcoded credentials. Credentials are read strictly from process environment or local `.env` (gitignored).
* **Double-Spending Prevention**: Idempotency keys (`submissionId:action:runId`) protect against network replays and duplicate transactions.
* **Audit Lineage**: Every intake event, rule execution verdict, budget state transition, and reviewer remark is recorded with an immutable timestamp and cryptographic author identifier.

---

## 👥 Credits & Attribution

Developed by **UMochi Squad** for enterprise partner governance and automated claim verification.

For demonstration, questions, or integration inquiries, please check out our [YouTube Walkthrough](https://youtu.be/KAfzeq-uHQo) or explore the architectural specifications in the [`docs/`](docs/) directory.
