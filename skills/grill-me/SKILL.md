---
name: grill-me
description: A relentless, disciplined interview process to discover gaps, clarify ambiguous requirements, and resolve contradictions before execution. Use when submission details are contradictory or incomplete.
---

# Grill-Me (Clarification & Gap Discovery Skill)

## Purpose & Scope
This skill executes a relentless, structured interview to uncover missing assumptions, resolve conflicting evidence (such as multiple invoices with differing amounts), and construct a rigorous decision tree.

In production automated systems, this skill operates as a **batch-interrogate & pause-and-resume** engine:
1. Identify all unsettled decisions or conflicting data points.
2. Group related questions into a single round to minimize back-and-forth overhead.
3. Formulate each question with a concrete recommended answer based on available evidence.
4. Record confirmed answers permanently as structured evidence (`clarification_records`).

## Interview Protocol (The Design Tree)

Work the decision tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled:

### Round Question Format
```markdown
❓ **Q1** - **[Question Title]**: [Detailed context, citing specific document IDs and page numbers]
- Option A: [Description]
- Option B: [Description]

💡 Recommended Answer: [Actionable recommendation, formatted so "Yes" accepts it]
```

### Operational Rules
1. **Never guess facts**: If an answer can be found in existing databases or parsed OCR tokens, look it up; never ask humans for facts the system already possesses.
2. **Batch questions**: Present all active frontier questions in one single prompt/modal.
3. **Persist clarification**: Once answered, store answers in the application ledger to prevent downstream agents from re-asking.
4. **Halt affected workflow**: The submission enters `NEEDS_CLARIFICATION` and pauses until the frontier is cleared.
