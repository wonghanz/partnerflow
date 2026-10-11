# UMochi Squad — Web 前端交互与界面规格说明书 (web.md)

> **设计基调与使命：**
> 本规范定义了 **UMochi Squad** 智能企业报销与提报系统的 Web 前端界面架构。整体界面秉持现代、极简与高可用设计原则，以**纯净白 (Clean White)** 为主色调，辅以清爽的边框与微阴影，降低员工视觉疲劳并提升操作效率。

---

## 🎨 整体视觉、设计系统与全局布局 (Visual & Design System)

### 1.1 色彩规范 (Color Palette & Brand Theme)
- **品牌主题渐变色 (Brand Theme Gradient):** 
  - `linear-gradient(135deg, #72CDFF 0%, #BFFFCC 100%)`
  - **#72CDFF (天空蓝 / Sky Blue):** 品牌主色，代表智慧、流转与现代科技感。
  - **#BFFFCC (清新薄荷绿 / Fresh Mint):** 品牌副色，代表安全、核准通过与轻盈活力。
- **主背景色 (Main Background):** `#FFFFFF` (纯白，清爽整洁)
- **次级背景 / 卡片底色 (Surface & Cards):** `#FAFBFC` / `#F8FAFC`
- **中性灰与边框 (Borders & Dividers):** `#E5E7EB` / `#E2E8F0`
- **主要文本色 (Primary Text):** `#111827` (深灰黑，保证高对比可读性)
- **辅助说明文本 (Muted Text):** `#6B7280`
- **状态语义色 (Semantic Badges):**
  - **Approved (已通过):** 背景采用薄荷绿浅底 `#EBFDF5` (基于 `#BFFFCC` 衍生)，文字/边框 `#065F46`（深绿）
  - **Rejected (已驳回):** 背景 `#FDE8E8`，文字/边框 `#9B1C1C`（红色 Red）
  - **Pending (审核中):** 背景 `#FEF08A`，文字/边框 `#854D0E`（黄色/琥珀色 Yellow）
  - **Primary Action (主操作按钮 / 激活态):** 采用品牌渐变 `linear-gradient(135deg, #72CDFF 0%, #BFFFCC 100%)`，文字搭配深色 `#0F172A`，悬浮微发光 `box-shadow: 0 4px 14px rgba(114, 205, 255, 0.35)`
  - **Sidebar 激活态 (Active Tab):** 左侧高亮色条 `#72CDFF`，背景微浅底 `rgba(114, 205, 255, 0.08)`

### 1.2 全局页面栅格与布局 (App Shell)
整体采用经典的 **顶部导航 (Top Navbar) + 左侧侧边栏 (Sidebar) + 右侧主内容视口 (Main Content Viewport)** 结构：

```
+-----------------------------------------------------------------------------------+
|  [Logo] UMochi Squad                             [Search / Notifications / User]   |  <- Top Navbar (H: 64px)
+-------------------+---------------------------------------------------------------+
|  SIDEBAR (W: 240) |  MAIN CONTENT VIEWPORT (Bg: #FFFFFF)                          |
|                   |                                                               |
|  📋 Listing       |  [Page Header / Metric Cards / Forms]                         |
|     History       |                                                               |
|                   |  [Dynamic Content Area: Cards / Detail / Upload]              |
|  📤 Submission    |                                                               |
|                   |                                                               |
|  🧠 Brain         |                                                               |
|     Memory        |                                                               |
+-------------------+---------------------------------------------------------------+
```

### 1.3 顶部导航栏 (Top Navbar)
- **极简化 Logo 与品牌标识：**
  - 左上角展示极简轮廓化/扁平单色调吉祥物 Logo 图标（基于 UMochi 灵巧机器人形象，去除复杂渐变高光）。
  - Logo 旁边搭配醒目且现代的无衬线加粗字体：**“UMochi Squad”**。
  - 右侧支持当前组织环境指示、系统状态与操作员信息。

### 1.4 左侧侧边栏 (Sidebar 工具箱)
常驻左侧菜单，支持当前激活状态高亮（蓝色浅底或左侧激活指示条）：
1. **Listing History (提交记录):** 查看历史提报记录、统计指标与详情卡片。
2. **Submission (提交报告):** 发起新报销/预审批提报并上传材料。
3. **Brain Memory (核心记忆库):** 维护与更新企业知识库及合作方档案。

---

## 📄 页面 1：Listing History (提交记录页面)

### 2.1 顶部数据看板面板 (Stats Metrics Panel)
进入页面顶部清晰横排展示 4 个微卡片，实时呈现提报汇总状态：

```
+-------------------+ +-------------------+ +-------------------+ +-------------------+
| Total Submission  | | Accepted (已通过) | | Pending (审核中)  | | Rejected (已拒绝) |
|      128 单       | |       84 单       | |       32 单       | |       12 单       |
| (Icon: 📊 / 统计) | | (Tag: 🟢 绿色)   | | (Tag: 🟡 黄色)    | | (Tag: 🔴 红色)    |
+-------------------+ +-------------------+ +-------------------+ +-------------------+
```

### 2.2 记录列表 (Card 布局，参考 DXP Browse 风格)
下方以响应式卡片流（Card Grid/List）列出各项提交记录：

#### 单个卡片 (Submission Card) 结构：
- **卡片边框与质感：** 纯白背景、1px 实线轻柔边框 (`#E5E7EB`)、悬停时微浮轻阴影 (`hover:shadow-md`)。
- **卡片头部：**
  - **标题 (Title):** 如 *"MegaTech Solutions - Q3 Regional Seminar Co-op Claim"* (Font-weight: 600, 16px)
  - **流水号与伙伴等级：** 如 `SUB-2026-MY-0042` | `Gold Partner`
- **卡片主体：**
  - 申报金额与币种：`RM 15,000.00`
  - 提报时间与关联预审批号
- **状态徽章 (Status Badge):**
  - 状态为 **Approved** 时：显示为**绿色**标签（`bg-green-100 text-green-800`）。
  - 状态为 **Rejected** 时：显示为**红色**标签（`bg-red-100 text-red-800`）。
  - 状态为 **Pending** 时：显示为**黄色**标签（`bg-yellow-100 text-yellow-800`）。
- **底部操作按钮组：**
  - **[ View (查看) ]**：白底蓝字次级按钮，点击后平滑过渡至详情页面。
  - **[ Delete (删除) ]**：白底红字文字按钮，点击触发二次确认弹窗。

### 2.3 “View” 按钮详情页交互规范 (Detail View)
点击卡片上的 View 按钮后，路由平滑跳转至详情子页（支持面包屑返回）：
1. **页面顶部大标题：** 使用标准 `<h1>` 标签清晰渲染提交记录标题（Title）。
2. **基本信息栏 (Metadata Section):**
   - 提交日期 (Submission date)：如 `2026-10-10 14:32:00`
   - 提交人 (Who submit)：如 `alyssa.woe@megatech.com`
   - 关联项目 / 合作伙伴 (Partnership): `MegaTech Solutions (M) Sdn Bhd`
3. **附件文档列表 (Uploaded Documents):**
   - 逐项列出具体上传的 PDF 或其他附件名称（如 `Tax_Invoice_INV88912.pdf`, `Event_Photos_Batch1.pdf`）。
   - 提供在线预览 (Quick Preview) 与下载链接。
4. **系统核验与规则审查摘要 (Agent Review Insights):**
   - 汇总 Agent 1 ~ Agent 6 的自动化检查结果、证据定位切片与待确认项。
5. **底部评论区 (Comment Box):**
   - 包含历史留言流（审批员沟通记录、补件提示、驳回原因阐述）。
   - 文本输入框 + “Post Comment” 按钮，支持团队协同备注。

### 2.4 “Delete” 按钮安全确认弹窗 (Pop-up Modal)
- **交互逻辑：** 点击“Delete”禁止直接删除数据。
- **模态弹窗 (Confirmation Dialog):**
  - 标题：`确认删除该提交记录？`
  - 警告内容：`“您确定要删除 [标题名称] (ID: SUB-XXXX) 吗？该操作将归档此记录并撤销预留预算，此操作无法撤销。”`
  - 按钮组：
    - **[ 取消 (Cancel) ]**：灰色轮廓按钮，关闭弹窗不执行操作。
    - **[ 确认删除 (Confirm Delete) ]**：深红背景危险按钮 (`bg-red-600 text-white`)，二次确认后异步发起软删除请求，更新统计看板并返回列表。

---

## 📝 页面 2：Submission (提交报告页面)

### 3.1 初始界面：居中快捷入口 (Empty / Plus Gateway)
- **视觉排版：** 整个白色页面正中央垂直居中。
- **元素构成：**
  1. 上方醒目的文档图标（Document Logo / 极简纸质文档带折角图标，描边采用 `#72CDFF`）。
  2. 中间大号加号按钮 (Big Plus Button / 圆形微浮阴影按钮，内嵌 `+` 符号，外环与背景采用 `#72CDFF` 至 `#BFFFCC` 柔和品牌渐变与呼吸微浮光效 `box-shadow: 0 8px 24px rgba(114, 205, 255, 0.28)`)。
  3. 按钮正下方居中文字：**“Submit a report”** (18px, Medium Gray `#4B5563`)。
- **交互事件：** 用户点击加号按钮或文本，平滑展开/跳转至表单填写主页。

### 3.2 表单填写页面 (Form & Checklist View)
页面顶部醒目大标题更新为：**“Submit a report”**。

#### A. 合作方信息填写区 (Partnership Info Field)
- 包含标准表单输入组件：
  - 合作方选择/搜索输入框 (`Partner Name / Partner ID`)
  - 申请类型单选 (Pre-approval / Claim 报销)
  - 关联预审批号输入框 (`Parent Pre-Approval ID`)
  - 申请总金额与币种 (`Amount & Currency`)

#### B. 无限制多 PDF 上传区域 (Multi-File Dropzone Box)
- 宽幅虚线卡片上传区域：`Drag & drop PDF files here, or click to browse` (边框悬停时变为 `#72CDFF` 高亮)。
- **无限制上传功能：** 允许用户同时拖拽或多选上传多个 PDF 文档。
- 上传后即时显示文件卡片清单（含文件名、大小、进度条及删除单项按钮）。

#### C. 动态待提交清单 (Dynamic Checklist 防呆验证逻辑)
在文件上传区下方，实时根据申报类型显示所要求的必选材料清单：
- **清单项定义示例：**
  - [ ] 1. 盖章正规税务发票 (Official Tax Invoice)
  - [ ] 2. 活动现场证明 / 照片 (Event Photos / Proof of Execution)
  - [ ] 3. 参会签到表或数字登记录 (Attendee Sign-in Sheet)
  - [ ] 4. 银行流水或付款水单 (Proof of Payment)

#### D. 图标动态响应与防呆锁定 (Foolproof Lock):
- **未满足条件状态：** 当系统或解析规则尚未检测到对应材料时，清单该项右侧显示**红色的打叉图标 (❌)**。
- **已满足条件状态：** 当用户成功上传并匹配对应材料时，清单该项右侧实时切换为**绿色的打勾图标 (✅)**（勾选徽章采用 `#BFFFCC` 浅底与深绿边框）。
- **按钮防呆激活机制 (Submit Button Gate):**
  - **默认锁定：** 只要存在任何一项为红叉 (❌)，最下方的 **[ Submit Report ]** 按钮保持灰色禁用状态 (`disabled`, `cursor: not-allowed`, 透明度 50%)。
  - **全部满足激活：** 只有当清单上**所有项目均点亮绿色打勾 (✅)** 时，底部的 **[ Submit Report ]** 按钮瞬间激活并点亮为 **`linear-gradient(135deg, #72CDFF 0%, #BFFFCC 100%)` 灵动主题渐变色**，搭配深色文本 `#0F172A` 与微发光投影，允许用户点击提交。

#### E. 提交后路由跳转 (Post-Submission Redirect)
- 用户点击已激活的 Submit 按钮后，系统展示提交中加载微动效并异步推送到后端流水线。
- 提报成功即时 Toast 提示：`“Report submitted successfully!”`。
- **页面自动路由跳转回 “Listing History” 页面**，列表中展示该笔处于 Pending 状态的最新记录。

---

## 🧠 页面 3：Company Brain & Policy Center (企业知识与规则中心)

### 4.1 核心设计理念：允许企业「从零开始」渐进式配置 (Zero-to-One Progressive Setup)
系统**坚决不假设**所有企业在初次使用时就已经拥有成熟的 SOP、完备的 Partner Tier 制度或详尽的报销政策手册。
Company Brain & Policy Center 的核心使命是：**即使公司从未正式整理过这些规则，也能按照自身节奏逐步建立、测试、生效并优化规则体系**。

---

### 4.2 前置化解三大核心 UX 风险 (Mitigating Top 3 UX Risks)

| 核心风险 | 潜在危害 | 系统防护与交互设计 (UX Solution) |
| :--- | :--- | :--- |
| **风险一：初次使用要求填写海量配置** | 管理员在 Setup 引导阶段因缺乏材料直接卡死，导致产品无法落地。 | **渐进式任务清单 (Task-List Pattern，参考 GOV.UK 设计规范)：**<br/>• 允许随时「保存进度、稍后继续 (Save and return later)」。<br/>• 将配置拆分为独立状态卡片（如 `2 of 5 sections completed`）。<br/>• 未配置部分允许跳过，不阻断系统基础功能的开启。 |
| **风险二：AI 擅自脑补捏造业务规则** | 若公司未明确 Gold Tier 报销比例，LLM 自行按“行业常识”假设 50%，导致财务错算或违规风险。 | **绝对禁止 AI 自动填空 (Zero Auto-Guessing)：**<br/>• 未明确项强制展示为 **「尚未配置 (Not configured / Needs confirmation)」**。<br/>• 必须由拥有审批权限的管理员在界面上显式勾选或输入后方可生效。 |
| **风险三：更新政策后旧历史申请被溯及修改** | 4月份修改补贴上限为 RM 8,000，导致此前3月份按 RM 10,000 审核的历史单据被错误判定为超额违规。 | **严格版本化与时间戳锚定 (Immutability & Effective Dates)：**<br/>• 每个已发布的规则均打上 `vX.Y.Z` 版本号与生效起始日期 (`effective_date`)。<br/>• **历史申请永远锁定提交时刻的规则版本**；新规则仅对生效日之后的未来新提报生效。 |

---

### 4.3 整体 UI 布局与六大二级导航架构

页面顶部展示轻量进度条与状态摘要：
```
+---------------------------------------------------------------------------------------------------------+
| Company Brain                                                                                           |
| Knowledge, policies & decision rules                                              [ Setup incomplete ]  |
| Manage the rules your company uses to review applications.                                              |
|                                                                                                         |
| Setup progress: 2 of 5 sections completed · You can save and return later                                |
| [████████████████████░░░░░░░░░░░░░░░░░░░░░░░] 40%                                                        |
+---------------------------------------------------------------------------------------------------------+
```

左侧或顶部子导航分为六个独立管理维度：

```
[ Overview ]  [ Company Requirements ]  [ Partner Tiers ]  [ Knowledge Base ]  [ Company Mindset ]  [ Versions & Audit ]
```

| 二级子页面 | 管理员可以在此做什么 (Capabilities) | 核心状态与交互元素 |
| :--- | :--- | :--- |
| **1. Overview (总览)** | • 查看整体配置进度与健康度<br/>• 查看待确认规则 (Pending Confirmation)<br/>• 快速查看最近生效的规则变更与快捷待办 | • 任务清单状态卡片 (Complete / Not set / Locked)<br/>• “Resume Setup” 快捷入口 |
| **2. Company Requirements (公司要求)** | • 维护申请资格准入门槛<br/>• 配置必需提交的证明材料清单<br/>• 设定预算控制条件与核销公式<br/>• 设定违规动作 (Flag / Request / Block) | • **规则卡片流 (Rule Cards)**<br/>• 规则冲突智能提示横幅 (Conflict Banner)<br/>• 严禁直接编辑原始 Prompt |
| **3. Partner Tiers (合作伙伴等级)** | • 新建、修改或停用合作伙伴分级<br/>• 为不同等级绑定不同的报销限额与比例<br/>• 声明「无分级制度」选项 | • 等级卡片 (Draft / Not configured / Fallback)<br/>• 支持 “No tier-based rules” 单选切换 |
| **4. Knowledge Base (知识库)** | • 上传正式 PDF、SOP 扫描件、Excel 总表<br/>• 查看由 Docling 提取的结构化知识片段<br/>• 查看规则与原始法律文件的双向引用 | • 文档拖拽上传区<br/>• 提取事实与条款高亮对照视图<br/>• 来源失效与过期警告 (RefChecker) |
| **5. Company Mindset (企业心智)** | • 审核管理层历史裁量偏好与典型案例<br/>• 审批由 Distill 技能提炼的《Mindset 提案》<br/>• 管理排序与解释建议原则 | • 经审批的原则列表 (`approved-principles.md`)<br/>• 标记：“仅作建议倾向，绝不覆盖正式政策” |
| **6. Versions & Audit (版本与审计)** | • 双版本代码/规则可视化 Diff 对比<br/>• 审计谁在什么时间修改了什么规则、审批人是谁<br/>• 设定未来特定日期的政策定时生效 | • 版本发布日志 (v1.0, v1.1-draft)<br/>• “Publish New Version” 激活按钮 (需管理员密码/二次签名) |

---

### 4.4 第一次进入系统：给管理员的三种冷启动起点 (Onboarding Pathways)

当管理员首次打开系统时，不弹出强制全填的弹窗，而是提供三种平滑的起点卡片：

```
+--------------------------------+  +--------------------------------+  +--------------------------------+
|  方式 A：我已经有正式文件        |  |  方式 B：我知道规则但未整理成文  |  |  方式 C：我还不确定完整规则      |
|                                |  |                                |  |                                |
|  [ 📂 上传文件提取候选规则 ]   |  |  [ 🧭 引导式问卷逐步配置 ]     |  |  [ 🚀 边跑业务边逐步沉淀 ]     |
|                                |  |                                |  |                                |
|  适合：已有现成 SOP/Excel 的企业 |  |  适合：经验在老员工脑中的团队    |  |  适合：初创或正在摸索政策的企业  |
+--------------------------------+  +--------------------------------+  +--------------------------------+
```

- **方式 A (已有现成文件)：**
  - 管理员上传现有 PDF、Word 或 Excel 政策文件。
  - 系统启动 Docling + Grill-With-Docs 离线分析，抽取候选规则矩阵，标出条款来源及潜在的自相矛盾之处。
  - 管理员逐项审查并点击“确认采纳”，生成第一版规则。
- **方式 B (无文件但有口头规则)：**
  - 进入轻量向导表单，系统以通俗问卷形式发问：
    - *“您的公司是否有合作伙伴分级？[是 / 否]”*
    - *“报销时发票金额是否需要与预审批单完全一致？[完全一致 / 允许微小浮动]”*
    - *“必须提交哪些证明？[发票 / 活动照片 / 签到表]”*
  - 根据回答自动生成结构化规则卡片供最终确认。
- **方式 C (尚无清晰规则，先用起来)：**
  - 仅录入基础企业抬头信息，跳过复杂的等级与限额配置。
  - 系统立即就绪，允许接收并展示申请；在此阶段，系统执行**不涉及自动放款的初步结构化提取与展示**。
  - 任何未配置的规则均优雅降级标记为「待人工裁定」，企业在日常处理中逐步补充规则。

---

### 4.5 Partner Tiers (合作伙伴等级) 界面深度设计

管理员可以直接在 UI 上增删改查等级，**无需任何技术人员改动底层代码**：

```
Partner Tiers
Define partner classifications and their applicable policies.

+--------------------------+  +--------------------------+  +--------------------------+
| Gold                     |  | Silver                   |  | Other / Unassigned       |
| Eligibility & limits     |  | No active policy         |  | For partners without a   |
| to be confirmed          |  | configured               |  | confirmed tier           |
|                          |  |                          |  |                          |
| [ Status: Draft ]        |  | [ Status: Not config ]   |  | [ Status: Fallback ]     |
| Edit · Delete            |  | Configure Now            |  | Default Rules Applied    |
+--------------------------+  +--------------------------+  +--------------------------+

[ + Add Tier ]    [ 📥 Import Tiers from Excel ]    [ 🔘 We do not use tier-based rules ]
```

#### 新增/编辑 Tier 表单字段规范：
1. **Tier Name (等级名称):** 必填输入框，支持客户自定义命名（如 `Gold`, `Premier`, `Tier-1`），不强制硬编码。
2. **Eligibility Criteria (准入条件):** 如年度采购额度、签约资质要求或直接下拉关联销售系统标签。
3. **Programme Limits (补贴与报销上限):** 
   - 单次活动最高报销限额（如 `RM 10,000`）。
   - 联合营销分摊比例（如 `50%`）。
   - 未填写时保持为“无上限限制（需单次特批）”。
4. **Required Documents (专属文件要求):** 选择此等级是否需要额外凭证（如 Elite 级免除签到表原件，只需照片）。
5. **Effective Date (生效日期):** 设定从哪一天提交的申请开始执行该等级标准。
6. **Source / Approval (政策依据与审批):** 关联的 SOP 文档编号或管理员签字说明。
- **无分级支持：** 若勾选 `We do not use tier-based rules`，系统统一采用全局统一定额标准，隐藏等级相关配置。

---

### 4.6 Company Requirements (规则卡片流设计)

杜绝让管理员直接面对黑盒复杂的 LLM Prompt 文本框，统一采用直观的**低代码规则卡片 (Rule Cards)**：

```
+----------------------------------------------------------------------------------------------------+
| 📌 [Rule: REQ-DOC-001] Required Supporting Documents                              [ Status: Active ]|
|                                                                                                    |
| Description: 定义报销申请必须包含的有效凭单与活动佐证材料。                                             |
|                                                                                                    |
| • Applies to:    [ Claim 报销阶段 ] · [ All Programmes ] · [ All Tiers ]                           |
| • Condition:     必须包含至少 1 张已校验税务发票，且包含至少 2 张有效活动现场水印照片。                 |
| • If not met:    [ 🟡 Flag for Review & Draft RFI Notice (生成补件通知草稿并挂起) ]                 |
| • Source / Ref:  company-brain/policies/claim-eligibility.md#sec-2 (Approved by CFO)              |
|                                                                                                    |
| [ Edit Rule ]    [ Deactivate ]    [ Duplicate ]                                                   |
+----------------------------------------------------------------------------------------------------+
```

#### 规则卡片核心属性：
- **Rule Name & Code:** 易于理解的业务规则名称与唯一编码（如 `REQ-CAP-002: Gold 单次额度上限`）。
- **Applies to:** 适用的申请类型 (`Pre-approval` / `Claim`) 与适用伙伴等级。
- **Condition:** 触发校验的客观条件表达式（金额区间、日期时效、文档清单）。
- **If Not Met (未满足时的系统行为):**
  - `Flag for review`: 标黄提示并在建议函中告知审批人。
  - `Request missing documents`: 自动生成针对外部合作伙伴的补件通知草稿。
  - `Block progression`: 阻断自动流转，不允许进入预算账本扣减环节。
- **冲突即时拦截：** 若新添加的规则与现有规则产生重叠冲突（如两项规则对同一等级设定了不同的报销上限），系统即时弹出冲突比对浮层，引导管理员二选一，**禁止静默覆盖**。

---

### 4.7 架构核心铁律：三大数据实体的物理隔离

为确保系统安全与审计合规，后台必须保持三层物理隔离：

```
+------------------------------------------------------------------------------------+
| 1. Company Requirements (正式政策中心)                                             |
|    包含正式政策、等级硬限额、必需法律文件。对审批结果具备阻断性硬约束。              |
+------------------------------------------------------------------------------------+
                                      ≠ (物理解耦)
+------------------------------------------------------------------------------------+
| 2. Company Mindset (企业心智与经验中心)                                            |
|    包含管理层裁量偏好、历史特批判例、沟通语气规范。仅用于建议排序与解释，不可凌驾正式政策。|
+------------------------------------------------------------------------------------+
                                      ≠ (物理解耦)
+------------------------------------------------------------------------------------+
| 3. Operational Database (动态事实业务数据库)                                       |
|    PostgreSQL 四态账本、申请实时状态、已批准付款记录。是业务真实现状的唯一真实源 (SSOT)。 |
+------------------------------------------------------------------------------------+
```

---

### 4.8 渐进式容错处理机制 (Graceful Degradation when Unconfigured)

当企业刚上线、管理员**什么规则都还没配置**或只配置了一部分时，系统绝不瘫痪报错，而是采取**优雅渐进式降级 (Graceful Degradation)**：

1. **未配置 Partner Tier 时：**
   - 申请人依然可以正常提交申请，系统照常读取发票与金额；
   - 系统**不自动判定**依赖等级的补贴上限，将单据归为 `Tier: Unassigned`，并在审核建议中友好注明：*“由于尚未设置 Partner Tier，请审批人人工核定报销限额。”*
2. **未配置文件要求清单时：**
   - 系统依然会使用 Docling 完整解析上传的所有 PDF 并罗列在详情页；
   - 系统**绝不假称**“文件完整性已通过”，而是标注为 `Checklist: Self-Verification Required`，提供人工复查入口。
3. **未确认预算控制公式时：**
   - 账本仅展示当前录入的数字，系统**禁止自动扣减预算或自动承诺金额**，必须等待人工确认。
4. **规则之间出现冲突时：**
   - 挂起受冲突影响的申请单据，明确高亮指示涉及的具体两条规则编号，给管理员提供一键配置跳转入口。
5. **清晰明确的界面引导：**
   - 界面上永远展示清晰具体的下一步操作入口（如 `[ 点击设置补贴上限 ]`、`[ 确认发票规则 ]`），**绝对不展示笼统无用的「AI 尚未准备好」报错**。

---

## 🛠️ 前端技术栈与更新后组件架构

```text
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx             # 极简 Logo + "UMochi Squad"
│   │   │   └── Sidebar.tsx            # 3个核心选项工具箱 (Listing / Submission / Brain Memory)
│   │   ├── listing/
│   │   │   ├── StatsOverview.tsx      # Total, Accepted, Pending, Rejected 统计
│   │   │   ├── SubmissionCard.tsx     # 卡片布局 (Approved/Rejected/Pending 颜色徽章)
│   │   │   ├── DeleteConfirmModal.tsx # 删除二次确认弹窗
│   │   │   └── DetailView.tsx         # 详情页 (H1, 元数据, 文档列表, 评论区)
│   │   ├── submission/
│   │   │   ├── InitialGate.tsx        # 居中大号加号 + 文档 Logo
│   │   │   ├── ReportForm.tsx         # 合作方表单
│   │   │   ├── MultiFileUpload.tsx    # 无限制多 PDF 拖拽上传
│   │   │   └── DynamicChecklist.tsx   # 动态防呆清单 (❌ 与 ✅ 响应)
│   │   └── brain-center/              # 完整的 Company Brain & Policy Center
│   │       ├── SetupProgressBanner.tsx # 渐进式任务清单进度条 (GOV.UK 风格)
│   │       ├── OnboardingWizard.tsx   # 3种冷启动方式引导 (文件导入/问卷/边跑边建)
│   │       ├── sub-pages/
│   │       │   ├── BrainOverview.tsx  # 总览与健康度检查
│   │       │   ├── RequirementsManager.tsx # 规则卡片流与冲突预警
│   │       │   ├── PartnerTierConsole.tsx  # 等级维护卡片与无等级切换
│   │       │   ├── KnowledgeLibrary.tsx    # 原始文档与条款提取对应
│   │       │   ├── MindsetReview.tsx       # 经批准的心智原则 (L4)
│   │       │   └── VersionAuditLog.tsx     # 规则版本 Diff 与生效日期管理
│   │       └── RuleCardModal.tsx      # 规则卡片结构化配置弹窗
│   ├── pages/
│   │   ├── ListingHistoryPage.tsx
│   │   ├── SubmissionPage.tsx
│   │   └── BrainMemoryPage.tsx        # 挂载 Brain Center 主视图
│   └── App.tsx
```

---

## 🚀 最终验收标准 (Definition of Done for Web UI)

1. [x] **视觉与品牌配色：** 纯白整洁背景，融入 **`#72CDFF` (天空蓝) 至 `#BFFFCC` (薄荷绿)** 灵动主题渐变色；Logo 极简化，顶部标明 “UMochi Squad”，左侧三项主导航。
2. [x] **Listing History：** 4 维指标清晰统计；卡片状态色标（绿/红/黄）；View 打开大标题详情与评论区；Delete 弹出二次确认弹窗。
3. [x] **Submission：** 居中“文档+加号”网关（外环微光渐变）；支持无限制上传多 PDF；待提交清单动态切 ❌ 与 ✅；未全绿前 Submit 强锁死，点亮后呈 `#72CDFF - #BFFFCC` 渐变激活，提交后自动跳转回 Listing History。
4. [x] **Company Brain & Policy Center：**
   - 支持从零开始、分阶段保存与返回（进度条填充采用主题渐变）；
   - AI 绝不自动填空或猜测未配置规则；
   - 规则与政策强制版本化，不溯及修改历史申请；
   - 提供 6 个二级管理视图 (Overview, Requirements, Tiers, Knowledge, Mindset, Versions)；
   - 提供 3 种新手启动路径 (已有文件 / 问卷向导 / 边跑边建)；
   - 规则采用卡片流而非编辑 Prompt；正式政策、管理层心智与业务数据库三层物理解耦。
