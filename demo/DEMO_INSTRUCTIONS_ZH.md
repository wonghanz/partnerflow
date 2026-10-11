# PartnerFlow 现场演示完整操作指南 (Demo Playbook)

本指南指导您在演示时如何完整、流畅、惊艳地展示 PartnerFlow 的六大核心能力，确保演示 100% 成功并展示最终通过 (APPROVED) 状态。

---

## 演示路线概览 (Demo Walkthrough)

### 第一步：展示工单历史列表 (Listing History `#/listing`)
1. 打开浏览器访问系统的 `#/listing`。
2. **展示 5 条精选工单 (Pure English Apple HIG 标准)**:
   - **SUB-2026-MY-0001**: 预审批通过 (`APPROVED`, RM 10,000)。
   - **SUB-2026-MY-0002**: 报销通过 (`APPROVED`, RM 18,750)。
   - **SUB-2026-MY-0003**: 需单轮补充数据 (`NEEDS_CLARIFICATION`, RM 6,400)。
   - **SUB-2026-MY-0004**: 违规开支阻断 (`POLICY_BLOCKED`, RM 35,000)。
   - **SUB-2026-MY-0005**: 篡改凭单隔离 (`SECURITY_QUARANTINE`, RM 24,000)。
3. **点击任意单据进入详情，点击附件预览 (Preview)**:
   - 点击 `quarantine-tax-invoice-tampered.pdf` 或 `tax-invoice-mandarin-oriental-summit.pdf`。
   - **亮点**: 弹窗完美渲染真实 PDF 文档内容，显示红字防篡改告警或正式发票结构，点击 "Download Original" 即可下载原件。

---

### 第二步：展示计划配置向导 (Programme Setup `#/setup`)
1. 导航至 `#/setup`。
2. **展示已完成全部 4 步 (Step 4 of 4 · READY TO LAUNCH)**:
   - 顶部进度条显示 100% 完成。
   - 下方提供便捷审查跳转按钮：
     - 点击 **Review Step 1 (Manifest)**: 查看已成功解析的 10 份商业文件。
     - 点击 **Review Step 2 (Extracted Rules)**: 查看提取的 14 条确定性业务规则。
     - 点击 **Review Step 3 (Resolved Conflicts)**: 查看 ADR 裁决与冲突裁决记录。
     - 点击 **Confirm & Launch**: 查看 SOP_2026_V1 映射与 RM 10,000,000 账本底座。

---

### 第三步：展示大脑智能中枢 (Brain Intelligence `#/brain`)
1. 导航至 `#/brain`。
2. **展示公司品牌、SOP 与账本全景**:
   - **公司详情**: UMochi Technologies Sdn. Bhd.、税号、注册号、总部地址。
   - **三大品牌**: UMochi Core™、UMochi Cloud™、UMochi AI Suite™。
   - **三大计划**: Cloud Pioneer MDF、APAC Co-op Marketing Fund、Retail Merchandising。
   - **运营 SOP**: SOP_2026_V1 及四大不可逾越铁律。
   - **四态账本底座**: RM 10,000,000 总池，Allocated / Committed / Approved / Paid / Available 条形图。

---

### 第四步：实操上传新报销 (New Submission `#/submit`) 并达成 APPROVED
演示伙伴自行提交报销单，全自动流转 7 大 Agent 并达成通过：
1. 点击导航栏 **New Submission** (`#/submit`)。
2. 点击 **Start a New Report**。
3. **填写表单参数**:
   - **Partner**: 选择 `MegaTech Solutions (M) Sdn Bhd` (ID: `PTR-GLD-882`)
   - **Submission Type**: 选择 `CLAIM`
   - **Title**: `FY2026 Q3 Enterprise Cloud Launch Event - Co-op Reimbursement`
   - **Activity Date**: 选择 `2026-08-20` (30天内合规窗口)
   - **Declared Amount**: 填入 `10000`
   - **Currency**: `MYR`
   - **Parent Pre-Approval**: 填入 `SUB-2026-MY-0001`
   - **Contact Email**: `alyssa.woe@megatech.com`
4. **上传 demo 文件**:
   - 将 `demo/partner_demo_upload/` 文件夹下的 5 个 PDF 拖入上传区域：
     1. `1_tax_invoice_INV2026_8819.pdf`
     2. `2_pre_approval_approval_letter.pdf`
     3. `3_event_execution_photos.pdf`
     4. `4_attendee_signin_verified.pdf`
     5. `5_bank_payment_receipt.pdf`
5. **提交验证**:
   - 右侧 "Document Readiness Checklist" 实时点亮 100% 绿勾。
   - 点击 **Submit Report**！
6. **AI 七大 Agent 自动执行**:
   - 系统自动解析发票号 `INV-APX-2026-8819`、金额 RM 10,000.00，置信度 0.98+。
   - 规则引擎匹配 `SUB-2026-MY-0001`（限额 RM 10,000）全部通过。
   - 生成决策备忘录，建议动作为 **APPROVE**！
7. **点击终审批准 (Human Authority)**:
   - 在详情页点击绿色的 **Approve Submission**。
   - 选择审批人（如 Dato' Sri Marcus Tan 或 Alyssa Woe），点击 **Confirm Approval**。
   - **结果**: 工单状态变更为 **APPROVED**，四态账本自动划转扣减，展示终极合规闭环！
