# 00 - 系统总架构与运转链路 (Architecture & End-to-End Pipeline)

## 1. 架构总览与核心设计哲学

为了解决「多渠道散乱录入、规则模糊冲突、预算重复扣减、人工反复审核、审计缺失」的痛点，本系统采用 **确定性工程底座 + LLM 语义推理 + 企业记忆脑层 (Brain Layer)** 的混合多 Agent 架构。

```mermaid
graph TB
    subgraph ClientLayer ["输入入口 (Ingestion Entry)"]
        In1["Email 附件"]
        In2["PDF 账单/发票"]
        In3["Excel 申请表"]
        In4["扫描件 / 纸质拍照"]
    end

    subgraph AgentPipeline ["核心 Agent 运转流水线 (Runtime Pipeline)"]
        A1["Agent 1: Intake Agent<br/>(Docling + Pydantic)"]
        A2["Agent 2: Validation Agent<br/>(Pre-approval 勾稽 & Grill-Me)"]
        A3["Agent 3: Rules Engine<br/>(确定性规则执行矩阵)"]
        A4["Agent 4: Budget & Claim<br/>(PostgreSQL 事务账本)"]
        A5["Agent 5: Exception Agent<br/>(业务/安全双轨审查)"]
        A6["Agent 6: Human Review<br/>(结构化审核函 & 草稿通知)"]
        A7["Agent 7: Audit & Reporting<br/>(状态追踪 & 三重视图看板)"]
    end

    subgraph DataAndBrain ["数据底座与企业大脑 (Data & Brain Layer)"]
        DB[("PostgreSQL 数据库<br/>状态机/四态账本/审计日志")]
        Brain["Brain Layer (L0 - L5)<br/>Wiki / RAG / Mindset / Communication"]
    end

    ClientLayer --> A1
    A1 -->|结构化提取事件| A2
    A2 -->|完整性校验事件| A3
    A3 -->|合规校验事件| A4
    A4 -->|账本预留/校验事件| A5
    A5 -->|异常分流与评估事件| A6
    A6 -->|人工决策输入| DB
    DB --> A7
    
    A1 -.-> DB
    A2 -.-> Brain
    A3 -.-> Brain
    A4 -.-> DB
    A5 -.-> Brain
    A6 -.-> Brain
```

---

## 2. 状态机规范 (Submission Lifecycle State Machine)

每份申请在系统生命周期内具备严格确定的状态转移，严禁下游 Agent 越权跳级执行。

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED: 收到申请文件
    SUBMITTED --> INTAKE_EXTRACTED: Agent 1 解析完成
    INTAKE_EXTRACTED --> NEEDS_INTAKE_CORRECTION: 格式致命错误/解析失败
    NEEDS_INTAKE_CORRECTION --> SUBMITTED: 重新上传
    
    INTAKE_EXTRACTED --> VALIDATING: 进入 Agent 2
    VALIDATING --> NEEDS_CLARIFICATION: 发现矛盾/缺失 (触发 Grill-Me)
    NEEDS_CLARIFICATION --> VALIDATING: 录入澄清证据
    
    VALIDATING --> RULES_EVALUATING: Agent 2 校验通过
    RULES_EVALUATING --> POLICY_BLOCKED: Agent 3 触发规则阻断/冲突
    
    RULES_EVALUATING --> BUDGET_RESERVING: Agent 3 规则通过
    BUDGET_RESERVING --> BUDGET_REJECTED: Agent 4 余额不足/超上限
    
    BUDGET_RESERVING --> EXCEPTION_TRIAGE: 预算预留成功，进入 Agent 5
    EXCEPTION_TRIAGE --> SECURITY_QUARANTINE: 安全异常 (注入/恶意文件)
    EXCEPTION_TRIAGE --> PENDING_HUMAN_REVIEW: 业务异常或正常流程
    
    PENDING_HUMAN_REVIEW --> APPROVED: 审核员批准 (财务核销付款)
    PENDING_HUMAN_REVIEW --> REJECTED: 审核员驳回
    PENDING_HUMAN_REVIEW --> PENDING_INFO_REQUEST: 需外部补件 (Agent 6 草拟)
    
    PENDING_INFO_REQUEST --> SUBMITTED: 补充资料入库
    APPROVED --> PAID: Agent 4 结算入账
    PAID --> ARCHIVED: Agent 7 归档与审计闭环
    REJECTED --> ARCHIVED
```

---

## 3. 标准 Agent 通讯事件合约 (Unified Event Schema)

系统之所以能够顺畅运转并实现可靠的 `Validate` 和 `Link`，核心在于每个 Agent 绝不自由发挥，必须消费和生产标准 JSON 合约：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "run_id": "run_20261010_9a01bf2",
  "submission_id": "SUB-2026-MY-0042",
  "parent_pre_approval_id": "PA-2026-Q3-018",
  "partner_id": "PTR-GLD-882",
  "partner_tier": "Gold",
  "timestamp": "2026-10-10T10:55:00Z",
  "source_agent": "validation",
  "target_agent": "rules_engine",
  "status": "NEEDS_CLARIFICATION",
  "payload": {
    "extracted_claim_amount": 15000.00,
    "currency": "MYR",
    "invoice_numbers": ["INV-88912", "INV-88913"],
    "activity_date": "2026-09-15",
    "attachments_count": 3
  },
  "validation_result": {
    "is_passed": false,
    "error_code": "INVOICE_AMOUNT_MISMATCH",
    "rule_id": "RULE_VAL_INVOICE_002",
    "severity": "WARNING",
    "open_questions": [
      {
        "question_id": "Q-01",
        "question": "上传的两张发票金额分别为 RM 10,000 与 RM 5,000，与申请总额 RM 15,000 是否为分笔开票，或其中一张为作废重开？",
        "evidence_refs": ["doc_inv_1:page_1", "doc_inv_2:page_1"]
      }
    ]
  },
  "evidence_refs": [
    {
      "doc_id": "doc_inv_1",
      "filename": "tax_invoice_final.pdf",
      "page": 1,
      "bounding_box": [120, 340, 280, 360],
      "confidence": 0.98
    }
  ]
}
```

---

## 4. 全系统运转与校验闭环 (How It Links & Validates)

### 4.1 链路连接机制 (Linkage Mechanism)
1. **全局主键追踪：** 每份申请在 Intake 时生成唯一全局键 `submission_id`，所有产生的中间提取表、证据片断、日志、数据库事务行均强制携带该键。
2. **前后向双向引用：** 
   - 报销单 (Claim) 必须向前强制绑定预审批单 `parent_pre_approval_id`。
   - 所有下游判定结果必须向后回溯到 Intake 阶段提取出的 `doc_id + page + bounding_box` 物理证据。
3. **Brain Layer 上下文注入：** 
   - 运行时只有高层元数据 (L0 Global Brief) 随请求常驻。
   - 遇到未决事项时，通过 L1 Router 精准装载所需 Skill（如 Agent 2 装载 Grill-Me，Agent 3 装载 Grill-With-Docs）。

### 4.2 全链路验证体系 (Validation Strategy)
1. **输入验证 (Input Gate)：** Pydantic 强类型与 Docling 解析置信度阈值过滤（置信度 < 0.85 强制挂起）。
2. **业务逻辑验证 (Rules Gate)：** 确定性规则矩阵（纯 Python/SQL 代码），0% 幻觉风险。
3. **财务一致性验证 (Ledger Gate)：** PostgreSQL 行级排他锁（`SELECT ... FOR UPDATE`），四状态严密守恒（`Allocated = Committed + Approved + Paid + Available`）。
4. **安全隔离验证 (Security Gate)：** 文件解析与沙盒双人审计机制，确认安全威胁才能进入阻断，避免业务误杀。
5. **最终决策闭环 (Human-in-the-Loop Gate)：** 任何异常或正常款项核准，最终批准动作由人工权限系统在 UI 界面点击并留存数字签名。
