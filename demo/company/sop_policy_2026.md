# Channel Partner Co-op Reimbursement & Pre-Approval Standard Operating Procedure (SOP_2026_V1)

**Organization**: UMochi Technologies Sdn. Bhd.  
**Version**: SOP_2026_V1 (Effective: 2026-03-01)  
**Governing Authority**: Global Channel Operations & Finance Governance Committee  

---

## 1. 核心流程概述 (Lifecycle Overview)
1. **预审批申报 (Pre-Approval Requisition)**: 合作伙伴在活动举办前至少 14 天提交 Pre-Approval 申请，附带活动方案 (Agenda) 与供应商报价单 (Quotation)。
2. **额度预占 (Commitment Reservation)**: 预审批一旦核准，资金立即从 Available 划转为 Committed (Iron Invariant 2)。
3. **活动执行与凭证收集 (Execution & Proofs)**: 合作伙伴于活动现场收集合格照片 (水印/GPS)、签到表、全额税务发票及银行付款水单。
4. **报销申报 (Claim Submission)**: 活动结束后 30 天内提交 Claim，必须挂接有效预审批单号 (`parent_pre_approval_id`)。
5. **七大 Agent 自动化审校**:
   - Agent 1: 文档分类与 OCR 提取 (Docling/本地解析)
   - Agent 2: 字段与交叉验证 (Grill-Me 单轮澄清)
   - Agent 3: 确定性业务规则引擎 (0 LLM Token)
   - Agent 4: 预算账本核算与原子状态转移
   - Agent 5: 双轨异常分类与防篡改取证
   - Agent 6: 人工审核备忘录合成
   - Agent 7: 执行摘要与审计链留存
6. **人工终审与放款 (Human Authority & Payout)**: 人工审批人基于决策备忘录签署批准，账本 Committed 划转为 Approved，财务打款后标记为 Paid。

---

## 2. 铁律准则 (Non-Negotiable Invariants)
- **Iron Invariant 1 (人工终审独占权)**: 严禁 AI Agent 自行调用打款或终审接口；所有批准必须由具备审批限额的真实业务人员签名 (JWT 验签)。
- **Iron Invariant 2 (四态账本守恒)**: Available = Allocated - (Committed + Approved + Paid) >= 0，单据操作在数据库原子行锁内完成。
- **Iron Invariant 3 (零主观猜测)**: 置信度低于 0.90 或缺少凭证时严禁 AI 替人做决定，一律挂起至 Grill-Me 待办。
- **Iron Invariant 4 (版本不可追溯推翻)**: 单据永久绑定提交时生效的规则版本。
- **Iron Invariant 5 (物理隔离安全沙箱)**: 恶意脚本与提示注入附件立即送入安全隔离沙箱。
