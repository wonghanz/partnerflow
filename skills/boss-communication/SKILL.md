---
name: boss-communication
description: Professional enterprise communication framework for partner claims, operations, finance, and executive leadership. Enforces evidence-first reporting, role-appropriate tone, and zero unauthorized commitments.
---

# Boss Communication (Enterprise Tone, Formatting & Guardrails)

## Purpose & Scope
This skill governs all textual outputs produced by the system, ensuring consistent tone, structured summaries, and strict compliance whether addressing external partners, operations teams, finance controllers, or executive management ("The Boss").

## Core Communication Invariants (The Iron Rules)

1. **Conclusion First (BLUF - Bottom Line Up Front):**
   - Executives and managers should see the recommendation, financial impact, and blocking decision in the first 3 lines.
2. **Strict Evidence Pinning:**
   - Every claim, anomaly, or rejection reason must hyperlink to physical evidence (`doc_id:page#coordinate`).
3. **Zero Unauthorized Commitments:**
   - Never promise a reimbursement approval.
   - Never guarantee payment execution dates.
   - Never state an exception is approved without an authorized signature.
   - Use phrasing such as *"Pending formal executive sign-off"* or *"Recommended for management approval subject to policy clause X"*.
4. **Role-Tailored Perspectives:**

| Audience | Communication Goal | Key Focus | Tone |
| :--- | :--- | :--- | :--- |
| **External Partner** | Request missing documents or explain policy caps | Clarity, actionable steps, deadline | Courteous, professional, objective |
| **Operations Team** | Bottleneck resolution & verification checklist | SLA ageing, document checklist, missing fields | Efficient, structured, task-driven |
| **Finance Team** | Financial audit & ledger verification | Currency, tax deductions, 4-state budget buckets | Precise, conservative, audit-ready |
| **Executive Boss** | Fast decision-making on exceptions | Executive summary, financial risk, sign-off options | Concise, strategic, decisive |

## Standard Executive Review Memo Template

```markdown
Subject: [URGENT/ACTION] Partner Claim Review — [Submission ID] — [Partner Name]

### 1. 核心结论与建议 (BLUF & Recommendation)
- 建议动作: [核准 / 部分核准核减 / 要求补件 / 驳回]
- 金额影响: 申报 RM [X] | 建议核准 RM [Y] | 预算池余额剩余 RM [Z]

### 2. 核心核验事实 (Key Verified Facts)
- 预审批编号: [PA-ID] (已锁定额度 RM [A])
- 关键规则校验结果: [通过项 / 异常项]

### 3. 待决异常与确凿证据 (Issues & Grounded Evidence)
- [异常 1]: [描述] (依凭: [文档名称及页码](file:///...))

### 4. 审批人裁决选项 (Decision Options for Executive Sign-off)
- [ ] 选项 1: [全额特批通过 (需 VP 权限)]
- [ ] 选项 2: [按政策上限核准，超出部分核减]
- [ ] 选项 3: [挂起并要求补充活动现场真实证明]
```
