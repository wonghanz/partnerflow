# 10 - Enterprise Admin Console & Guided Document Setup Wizard

> **设计基调与体系规范：**
> 本规范结合 **GOV.UK Design System** 与 **英国就业与养老金部 (DWP) Design System** 的企业级设计哲学，为企业管理员打造一套高效、高容错、完全可控的 **Programme Operations Console（企业管理控制台）** 与 **Guided Document Setup Wizard（引导式资料配置向导）**。
>
> 重点不是做一个漂亮的拖放上传框，而是让管理员清晰知晓：**要上传什么、系统读懂了什么、哪些资料存在冲突与缺失，以及何时才正式开始分析**。

---

## 🧭 1. 管理后台固定全局导航 (Console Navigation)

系统采用桌面优先 (Desktop-First) 的左侧固定深色/中性导航，清晰区分**「初始业务建立 (Setup)」**与**「日常业务审批 (Daily Operations)」**：

| 导航页面 (Section) | 核心功能定位 (Capabilities) | 访问频率与面向角色 |
| :--- | :--- | :--- |
| **Overview (总览)** | 整体申请数量、待处理事项 (Action Items)、SLA 逾期与预算大盘水位摘要。 | 每日高频 · 运营/财务/主管 |
| **Submissions (申请处理)** | 查看和处理所有日常进件的预审批与报销单，进行自动化校验与人工初审。 | 每日高频 · 运营审批员 |
| **Programme Setup (规则与资料配置)** | **[本规范核心]** 上传公司原始资料、抽取政策、排查冲突、管理规则矩阵与 Partner Tier。 | **初始建账 / 季度维护 · 系统管理员** |
| **Budget (预算账本)** | 实时追踪已分配 (Allocated)、已承诺 (Committed)、已核准 (Approved) 与已付款 (Paid) 账目。 | 每日/结账期 · 财务控制器 |
| **Reports (多维报告)** | 运营时效、财务核销流水、管理层 ROI 交叉下钻报表 (按伙伴/区域/计划)。 | 周期性 · 财务/高管 |
| **Audit Log (不可变审计日志)** | 严格追溯历史操作、系统 Agent 判定、规则版本变更与审批人签名记录。 | 审计/合规期 · 合规官/审计师 |

> 💡 **关键架构决策：** 
> 严禁让管理员在每次处理报销单时重新上传公司政策。`Programme Setup` 仅用于编译与更新底层知识大脑；`Submissions` 运行时直接调用已编译生效的规则版本。

---

## 🗂️ 2. 真实企业资料库清单 (Client Documents Manifest)

本设置向导专为解析和消化企业现有的 10 类核心业务文件而设计（归档在 `client-documents/` 目录）：

```
client-documents/
├── 01-pre-approval-form.pdf                 # [必填] 预审批申请表单与字段结构
├── 02-claim-disbursement-form.pdf          # [必填] 报销与打款申请表单
├── 03-programme-policy-and-sop.pdf         # [必填] 官方渠道补贴政策手册与操作 SOP
├── 04-partner-master-and-budget-tracker.xlsx # [必填] 合作伙伴花名册与历史预算追踪总表
├── 05-historical-cases/                     # [推荐] 5类历史真实判例库
│   ├── case-01-normal/                     #   - 正常全额核准单据
│   ├── case-02-missing-documents/          #   - 缺少现场签到表被要求补件
│   ├── case-03-amount-mismatch/            #   - 发票金额与预审批金额不符
│   ├── case-04-over-budget/                #   - 超出预算池上限被部分核减
│   └── case-05-rejected-or-exception/      #   - 违规逾期提交被驳回特批
├── 06-current-workflow-and-roles.pdf       # [推荐] 现状各岗位审批流程与流转 SLA
├── 07-supporting-document-checklist.pdf    # [必填] 报销必备附件清单规范
├── 08-existing-report-templates.pdf        # [推荐] 营运、财务现存的手工 Excel 报表模板
├── 09-email-follow-up-examples.pdf         # [推荐] 催件通知、补件邮件与沟通范文
└── 10-approval-authority-matrix.pdf        # [必填] 内部权限审批金额矩阵 (DOA)
```

### 资料归属四大类别 (Four Document Categories)
向导在界面上明确指引管理员补齐四类材料：
1. **Forms & templates (必填):** `01-pre-approval-form`, `02-claim-disbursement-form`
2. **Policies & SOPs (必填):** `03-programme-policy-and-sop`, `07-supporting-document-checklist`, `10-approval-authority-matrix`
3. **Partner & budget records (必填):** `04-partner-master-and-budget-tracker.xlsx`
4. **Historical cases & reports (推荐):** `05-historical-cases`, `06-current-workflow`, `08-report-templates`, `09-email-examples`

---

## 🚀 3. 四步渐进式设置向导 (The 4-Step Setup Wizard)

向导遵循 DWP/GOV.UK 规范，提供顶部步骤条：`STEP X OF 4 · [STEP_NAME]`：

```
+---------------------------------------------------------------------------------------------------------+
| PartnerFlow / Programme Operations Console                                                      Admin   |
|                                                                                                         |
| # Set up your programme                                                                                 |
| Upload existing documents so the system can understand your workflow, rules and budget structure.       |
|                                                                                                         |
| [ 01 UPLOAD ] ──────► [ 02 REVIEW ] ──────► [ 03 RESOLVE ] ──────► [ 04 CONFIRM & ANALYZE ]            |
+---------------------------------------------------------------------------------------------------------+
```

### 步骤 01：Upload — 上传与自动类别预判
- **交互规范：**
  - 支持将整个目录或多个文件批量拖入，或点击标准文件选择器。
  - 支持格式明示：`PDF · DOCX · XLSX · CSV`，标注单个文件大小限制（如 50MB）与隐私安全提示。
- **自动归类与人工纠错 (Auto-Tagging & Re-categorization)：**
  - 系统使用 Docling 快速读取文件元数据与首页标题，自动建议类别（如将 `.xlsx` 预识别为 `Partner & budget records`，将 `01-pre-approval.pdf` 预识别为 `Forms & templates`）。
  - **重要 UX 容错：** 若系统识别错误，管理员可在卡片下拉框中**一键手动修改分类**，严禁强制用户删掉重传。

---

### 步骤 02：Review — 检查资料与提取摘要
展示每份文件的解析进度与语义理解结果，展示物理页码与提取出的实体字段：
- 显示提取的 Partner 等级列表、报销时效天数、补贴上限金额。
- **冲突高亮提示：** 若读取到 `03-sop.pdf` 规定上限为 RM 8,000，而 `01-form.pdf` 批注写着 RM 10,000，界面立即以琥珀色高亮指出两份文件与对应页码，**绝不擅自二选一**。

---

### 步骤 03：Resolve — 处理缺失与冲突
系统生成明确的未决清单 (Unresolved Issues List)：
1. **缺失的必需材料：** 如检测到缺少 `Partner & budget records`（还未上传 Excel），系统显示红色未完成警示。
2. **公式与数据歧义：** 如 Excel 中存在复杂的宏或断裂的外部引用链接，系统提示管理员明确该公式含义。
3. **确认冲突裁定：** 管理员在此界面为发现的冲突做出商业裁决（例如勾选“以 2026 年新版 SOP 为准”），系统将其记入 ADR 决策记录。

---

### 步骤 04：Confirm & Analyze — 确认后启动深度分析
- **上传与正式提交分析严格解耦 (DWP 规范)：**
  - 只有在管理员确认资料清单完整、解决所有致命冲突后，底部的 **[ Confirm & Analyze ]** 按钮才被激活。
- **分析产物生成：**
  - 点击后，系统 Orchestrator 启动后台深度分析，生成：
    1. **现状端到端流程图 (As-Is Process Flowchart)**
    2. **企业痛点与漏洞诊断报告 (Pain Points & Risk Audit)**
    3. **编译就绪的业务规则矩阵 (Compiled Rules Matrix)**
    4. **可直接投产的 MVP 系统规格与配置清单 (MVP Specification)**
  - 管理员可导出 PDF 报告并一键完成系统正式启用。

---

## 🚦 4. 文件处理状态与清晰反馈设计 (Processing States)

杜绝使用单一黑盒的旋转 Loading 图标，系统为每份文件提供**具备可解释性与行动指引的状态卡片**：

```
+---------------------------------------------------------------------------------------------------------+
| [📄 PDF] 03-programme-policy-and-sop.pdf                                           [ Ready for review ] |
| 5.2 MB · Policies & SOPs                                                                                |
| 已成功读取。提取出 4 个等级权益、3 条报销时效规则与 18 项附件要求。                                       |
| [ 查看提取详情 (14 条规则) ]   [ 重新分类 ]   [ 移除文件 ]                                              |
+---------------------------------------------------------------------------------------------------------+
| [📊 XLSX] 04-partner-master-and-budget-tracker.xlsx                               [ Needs attention ⚠️ ] |
| 2.1 MB · Partner & budget records                                                                       |
| 检测到工作表 'Q3_Allocations' 中的单元格 F14 包含无法识别的外部 VLOOKUP 公式。                           |
| 建议操作：请确认该列是否代表「预留未付款项」，或手动上传无公式的纯数值导出版本。                           |
| [ 修复并确认公式 ]   [ 替换文件 ]                                                                        |
+---------------------------------------------------------------------------------------------------------+
| [📄 DOCX] 02-claim-disbursement-form.docx                                            [ Processing ⏳ ]  |
| 1.4 MB · Forms & templates                                                                              |
| 正在提取表格结构与必填字段校验规则... (进度: 68%)                                                       |
| [████████████████████████░░░░░░░░░░░░░░░░]                                                             |
+---------------------------------------------------------------------------------------------------------+
```

### 错误分类与明确指引 (Error Handling Matrix)

| 异常状态 | 界面友好提示 (User-Facing Message) | 明确的下一步操作指引 (Next Action) |
| :--- | :--- | :--- |
| **文件受密码保护** | `文件已加密 (Password Protected)` | 请先在本地解除 PDF 密码限制后重新上传，或在此输入只读密码。 |
| **文件格式损坏** | `无法解析文件流 (Corrupted File)` | 文件头部数据异常，请在 Office/Acrobat 中重新“另存为”新文件后上传。 |
| **重复文件** | `检测到重复上传 (Duplicate File)` | 该文件哈希与已上传的 `01-form.pdf` 完全一致，系统已自动合并。 |
| **安全扫描拦截** | `安全阻断：检测到可疑嵌入宏代码` | 附件被沙盒杀毒拦截，请清除宏代码后再行上传。 |

---

## ⚖️ 5. 最关键的 3 大 UI/UX 决策 (Top 3 UX Decisions)

### 决策 1：不强迫用户遵循固定的文件命名规则
- 很多系统强制要求用户上传必须命名为 `SOP_FINAL_V2.pdf`，否则报错。
- **PartnerFlow 策略：** 用户无论上传 `scan001.pdf` 还是 `我的表格.xlsx`，系统根据内容智能识别推荐分类，并允许管理员一键下拉调整，降低操作门槛。

### 决策 2：严格区分「上传成功」与「正式分析成功」(DWP 核心准则)
- 文件上传到服务器仅代表 `Uploaded`（字节传输成功）。
- 接下来经历 `Parsing`（Docling 结构化提取）➜ `Review`（人工校验）➜ `Confirmed`（正式提交分析）。
- 管理员随时可以删除错误上传的文件，而不会破坏已生成的业务规则。

### 决策 3：绝对禁止 AI 在后台静默决定正式业务政策
- AI 仅负责发现候选规则、定位证据页码、列出潜在冲突；
- **决定权 100% 在人：** 只有经过管理员在 Review/Resolve 步骤明确点击“确认”，该规则才能写入生产环境规则矩阵。

---

## 🖥️ 6. 桌面优先与无障碍设计 (Accessibility & Form Factor)

1. **工作台空间需求：** 审查规则比对、Excel 复杂单元格与 PDF 原始版面需要并排对照，系统在桌面端采用宽屏双栏/三栏布局。
2. **全键盘操作支持 (Keyboard Navigability)：** 所有步骤切换、文件上传触发、冲突确认模态框均支持 `Tab`, `Shift+Tab`, `Space`, `Enter` 快捷操作。
3. **屏幕阅读器支持 (ARIA Compliant)：** 上传进度条配置 `role="progressbar"`，状态变更配置 `aria-live="polite"`，方便读屏软件播报当前完成百分比。

---

## 👥 7. Console 与未来 Partner Portal 的职责隔离

- **Admin Console (当前产品)：** 面向内部企业管理员。侧重复杂的规则矩阵编译、政策冲突化解、多维看板与全局预算控制。
- **Future Partner Portal (未来外部门户)：** 面向外部合作伙伴。仅保留极简的申请提交、材料清单动态打勾 (Checklist ✅/❌)、单据进度实时看板，**绝不暴露任何后台政策配置与内部审批逻辑**。
