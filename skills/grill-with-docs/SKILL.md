---
name: grill-with-docs
description: Stress-test policies and rule designs against official documentation, discover contradictions or gaps, and crystallize results into GLOSSARY and Architecture Decision Records (ADRs).
---

# Grill-With-Docs (Policy Architecture & Rule Matrix Skill)

## Purpose & Scope
This skill operates during the **Rule Design & Policy Authoring Phase**. It cross-examines draft rules, policies, and SOPs against official documentation to ensure zero logical loopholes, conflicting thresholds, or unhandled edge cases exist before rules are compiled into production code.

## Lifecycle Workflow

```
Official Policy Docs (PDF/Excel)
       ↓
Domain Modeling (Glossary & Entity Definitions)
       ↓
Relentless Cross-Examination (Grill-With-Docs)
       ↓
Resolve Conflicts via ADRs (Signed by Policy Owners)
       ↓
Compiled Deterministic Rules Matrix
```

## Core Disciplines

### 1. Challenge Against the Glossary
When conflicting terms or definitions appear across different documents (e.g., whether "Single Claim Cap" includes or excludes VAT/GST), challenge the discrepancy immediately.

### 2. Probing Edge Cases
Test boundaries systematically:
- What happens on day 31 of a 30-day submission window?
- If an invoice is in foreign currency (e.g., USD) while the tier limit is in local currency (MYR), which exchange rate date applies?
- If partner tier upgraded between activity date and claim date, which tier cap applies?

### 3. Architecture Decision Records (ADRs)
Only create an ADR when a decision meets all three criteria:
1. **Hard to reverse**: The cost of changing later is high.
2. **Surprising without context**: Future maintainers will question the choice.
3. **A real trade-off**: Genuine alternatives were weighed.

### ADR File Format
```markdown
# ADR-00X: [Title]

## Context
[What problem or policy conflict was discovered across source documents?]

## Decision
[Which rule interpretation is adopted as the single source of truth?]

## Rationale & Alternatives
[Why this option was chosen over alternatives]

## Consequences & Citations
[Source policy IDs, effective date, and business owner sign-off]
```
