# PartnerFlow Web — 交接文档 / Handoff

生成时间：2026-10-11 ｜ 交接人：AI 总工程师（本会话）

## 位置 / Locations —— 读这一条再动手

有两份完全相同的副本（md5 逐字节核对过），**只有 Downloads 那份是交付件**：

| 角色 | 路径 | 说明 |
|---|---|---|
| **交付件（请改这份）** | `C:\Users\Hanz\Downloads\umochi-squad-partnerflow (3)\umochi-squad-partnerflow` | 2026-10-11 按用户要求复制入原文件夹。与 `docs/`、`company-brain/`、`skills/` 等 121 份源文档同级共存，无文件名冲突（`server/ public/ uploads/ _tools/ package.json test-rules.js DATA-CONTRACT.md handoff.md` 原本都不存在）。已在此目录内实跑 `node server/seed-submissions.js` → `balanced=true`、22 submissions、142 audit events、EXIT=0，证明自包含。 |
| 构建工作区（历史） | `C:\Users\Hanz\Documents\Qoder\2026-10-11\3696dfe6\umochi-squad-web` | 开发过程所在地，保留未删。**不要在这里继续改**，否则两份会分叉。 |
|  salvage 副本 | `C:\Users\Hanz\Documents\Qoder\2026-10-11\3696dfe6\_recovered` | 上一会话崩溃前的 20 个文件残片，仅作修复对照参考，不是可运行副本。 |

注意重复工具：`3696dfe6/_tools/css-gaps.js`（1,250 B，旧版，已废弃）与项目内 `_tools/css-gaps.js`（3,042 B，当前可信版）不同名同职，**只用项目内那份**。根目录另有 `_tools/recover.js`（当时用于从残片重建的脚本，一次性）。

---

生成时间补充：本文件在两份副本中内容一致；若你修改了任一份，请同步另一份或直接删除工作区那份以免混淆。

项目根目录（以下所有相对路径均相对于交付件根）：`umochi-squad-partnerflow`
源文档：同目录 `docs/web.md`（UI 契约）与 `docs/00`–`docs/11`（管线契约）。

---

## 0. 一分钟状态

**后端 + 语料 + 前端已全部跑通，是一个可演示的 MVP。** 缺的是"文档要求但尚未建"的 6 个 Console 屏幕，以及一次桌面宽度的视觉走查。

```bash
cd "C:/Users/Hanz/Downloads/umochi-squad-partnerflow (3)/umochi-squad-partnerflow"
node server/seed-submissions.js     # 重建 22 条语料（幂等，安全重跑）
node server/index.js                 # http://127.0.0.1:4321
```

零外部依赖（`package.json` 无 dependencies，纯 `node:http` + 原生 ES module 前端）。Node ≥ 20。

---

## 1. 已完成并已验证（有磁盘/命令证据）

### 1.1 十份 AI 真实语料（不是手写的常量）
`server/data/` 全部 10 个 foundation 文件由真实 AI 会话依 `docs/*.md` 撰写，我逐份独立验证过 JSON 可解析、账本守恒、契约锚点数量：

| 文件 | 字节 | 内容锚点（已核对） |
|---|---|---|
| `config.json` | 982 | org / fiscal_year 2026 / base_currency MYR / `operator`（**注意：无 `approvers` 数组**） |
| `tiers.json` | 5,556 | 5 个 tier，含 ceiling / ratio cap / required_documents / 提交窗口与 grace |
| `partners.json` | 3,156 | 10 个 partner（MY / SG / ID，含 `PTR-UNA-901` Unassigned 与 Elite） |
| `checklist.json` | 2,442 | 真实文档码池，`submit.js`/`brain.js` 的必填清单来源 |
| `dashboards.json` | 7,426 | KPI 与看板定义 |
| `rules.json` | 15,815 | 14 条规则 / 12 种 `condition.type`，全部对应 `rules.js` 真实 switch 分支 |
| `ledger.json` | 3,994 → 4,684 | 四态账本，Allocated 合计 RM 10,000,000（程序级）|
| `rule-conflicts.json` | 1,961 | 2 条冲突，含 CF-002 |
| `brain.json` | 63,954 | 16 个 root block：5 铁律 / 6 router / 7 docs·36 sections / 10 L3 源 / 7 cases / 2 mindset / 4 audiences / 3 pathways / 3 isolation |
| `agents.json` | 18,565 | 7 个 Agent + 30 条状态迁移（**20 个状态全部存在于 `pipeline.js` 的 `STATES`**，无杜撰状态） |

RAG 索引实测：173 chunks，分层 `{L0:13, L1:43, L2:84, L3:27, L4:2, L5:4}`。

### 1.2 22 条 intake facts 语料 + 引擎真实回放（本轮刚完成）
`server/data/submissions-seed.json`（103 KB，22 条）由 AI 子代理撰写，**只写输入事实**，16 个 `COMPUTED_FIELDS` 出现次数为 0（`SEED_FABRICATED_VERDICT` 未触发）。
`node server/seed-submissions.js` 真实输出（不是我推测的）：

```
Ledger: balanced=true rows=10
totals={"allocated":10000000,"committed":3628100,"approved":839500,"paid":3500000,"available":2032400}
Audit events: 142   Submissions: 22   Terminal: 9
EXIT=0   （无 WARNING orphan parents，无 Refused seeded decisions）
```

状态分布覆盖 11 种状态（证明语料不是"全绿"的假样本）：
APPROVED 7 / POLICY_BLOCKED 4 / REJECTED 2 / SECURITY_QUARANTINE 2 / BUDGET_REJECTED 1 / NEEDS_INTAKE_CORRECTION 1 / NEEDS_HUMAN_CONFIRMATION 1 / NEEDS_CLARIFICATION 1 / PENDING_INFO_REQUEST 1 / REQUIRES_POLICY_INTERPRETATION 1 / PENDING_HUMAN_REVIEW 1。

场景覆盖（`_seed.scenario`）：超 tier ceiling、比例上限突破、CLAIM 超父预审批、逾期 42 天、conf<0.85、conf 0.85–0.90 灰区、缺件、完全重复发票、近似重复发票、停用伙伴、不支持币种、Elite/Unassigned 零脑补、预算不足、`historical_rule_version=SOP_2025_V2` 老 RM 8,000 天花板版本锚定、Grill-Me 答后重验、prompt-injection OCR（5 条 `PROMPT_INJECTION_ATTEMPT`，只隔离不生效）、`.xlsm` 宏附件走安全轨、SG+ID 伙伴、CF-002 对照样本。

落盘产物：`submissions.json` 413 KB / `audit-events.json` 143 KB / `budget-transactions.json` 4.8 KB / `clarifications.json` 819 B。seeder 每次运行前删 runtime 状态并从 `server/data/_baseline/ledger.json` 还原，可无限重跑。

### 1.3 前端：4 个视图 + Brain 6 个分区全部真实渲染
- `#/listing`：4 张微卡 + totals strip + 搜索 + 4 个筛选 + 卡片列表 + 分页（`docs/web.md:63-91`）。
- `#/listing/:id`：8 个 tab 分阶段呈现（`overview / evidence / validation / rules / budget / memo / audit / comments`）。
- `#/submit`：向导 + foolproof gate（就绪度 0/5 时提交按钮锁定，实测）；币种白名单来自 `policies/budget-calculation.md#rule-3` 的真实 RAG 命中，非硬编码。
- `#/brain/*`：6 个分区全部走 `SECTION` 分派表，数据来自 `brain.json`/`tiers.json`/`ledger.json`。
- Ask-the-Brain 抽屉（`ask.js`）+ Ctrl/Cmd-K。

`_tools/check-modules.js` → `OK — all 9 browser modules parse as ESM`。
`_tools/css-gaps.js` → `OK — every statically-emitted class token has a stylesheet rule`（222 emitted / 269 defined）。
`node test-rules.js` → 19 场景通过，exit 0。12 个 GET 端点全 200。

---

## 2. 本轮修掉的真缺陷（全部有定位）

| # | 位置 | 症状 | 修复 |
|---|---|---|---|
| 1 | `public/js/app.js:142` | 整个 SPA 静默不执行，`#view` 空白且**零 console 报错** | 括号不配对，`'…runtime'))),` → `…')),` |
| 2 | `public/js/views/detail.js:427` | 同上（模块解析失败） | `)))))),` → `)))))));` |
| 3 | `public/js/views/brain.js`（8 处：205/247→264/399/430/515/628/690/691） | 同上 | 结构性补括号；690 的问题在 `:` 的**左右侧**而非总数 |
| 4 | `public/js/views/submit.js`（3 处，含 396→报错在 405） | 同上 | 补 `card-head` 包裹层闭合；`btn)));` → `btn));` |
| 5 | `public/js/views/brain.js` | 6 个 Brain 分区全报 `VIEW_ERROR: SECTION is not defined` | 补 `const SECTION = { overview, requirements, tiers, knowledge, mindset, versions };` |
| 6 | `public/js/views/brain.js` | 手写的假清单池 `CHECKLIST_POOL()` / `CHECKLIST_POOL_VALUE` / `primeChecklistPool` —— **违反"不许硬编码"的指令** | 删除，改为把真实文档码池从 `brain.json` 的 `d.checklist` + `t.required_documents` 逐层透传：`tiers() → docIds → tierCard → configureTier`，`const pool = new Set([...arr(t.required_documents), ...docIds])` |
| 7 | `public/js/state.js:13` + brain.js | `navigate()` 内部已 `dispatchEvent('hashchange')`，视图又手动再派发一次 → 双重渲染 | 移除两处 `setTimeout(... dispatchEvent ...)` |
| 8 | `public/js/views/brain.js:181` | `{class: \`lb-${k}\` === 'lb-x' ? '' : ''}` 恒为空串的死表达式 + `i` 上冗余 inline style | 改为 `h('span', {}, h('i', { class: \`lb-${k}\` }), …)` |
| 9 | `public/js/views/brain.js:184` | 三元两分支同为 `'muted'`（账本不平衡也显示成灰色正常文字）| 改为 `'recon-drift'`，并新增该 CSS 规则 |
| 10 | `public/css/app.css` | `input, select { width: 100% }`（:338）导致 listing 工具栏 4 个筛选各占满一行、登录弹窗里输入框把按钮挤下行；而 JS 发出的 `.select` / `.input` 类**没有任何规则** | 新增 `.select { width:auto; flex:0 1 auto; min-width:148px }`、`.row .input { flex:1 1 220px; width:auto }`、`.recon-drift`；`index.html:18` 的无规则 `sidebar-toggle` 死类名删除（真正的 hook 是 `#sidebarToggle`） |
| 11 | `server/seed-submissions.js:156` | **顶层 `async function process(fact)` 因函数提升遮蔽全局 `process`**，于是 `:75` 的 `process.argv.includes()` 抛 `Cannot read properties of undefined (reading 'includes')` —— seeder 在任何 seed 内容下都跑不起来 | 重命名为 `processFact`（:156/:252/:253）|
| 12 | 工具本身 | `node --check <path>.js` 因 `package.json` 的 `"type":"commonjs"` 把 ESM 当 CJS 解析，**对坏文件也报"通过"** | 用 `_tools/check-modules.js`（stdin + `--input-type=module --check`）|

---

## 3. 剩下什么 —— 以及具体怎么做

### P0：必须先由用户拍板的一个冲突
`docs/web.md:92-106` 明确要求详情页是**一条纵向滚动页、5 个编号区块顺序平铺**（第 4 块是"系统核验与规则审查摘要 (Agent Review Insights)：汇总 Agent 1 ~ Agent 6"，第 5 块评论区在页底）。
但用户本轮口头指令是"**不要全部拥挤在同一面 / not all in a page**"。

二者直接冲突。**我的建议（默认按此执行，除非用户改）**：保留 8-tab 分阶段（满足口头指令），同时补一个**文档要求的 Agent 1–6 汇总洞察块**放在 `overview` tab 首屏，并把评论区从 tab 挪到页面底部。这样"分阶段"与"汇总摘要"两个契约同时成立。

**做法**：在 `detail.js` 新增 `insightsCard(sub, agents)`，从 `sub.validation_result / rules_result / budget_result / exception_result / review_memo` + `audit-events`（`AGENT_BY_ACTOR` 映射已存在，`detail.js:10-13`）渲染 7 行 Agent 摘要（Agent / 结论 / 关键证据 / policy_ref），复用现有 `.verify` `.agent-strip` 类；`comments` 从 `TABS` 移出，改为 `wrap.append(head, tabsBar(), tabBody, commentsSection)`。

### P1：6 个文档要求但未建的 Console 屏幕
`docs/10:14-21` 与 `docs/web.md:215-276` 要求：Overview、Submissions、**Programme Setup（4 步渐进向导 `STEP X OF 4`）**、**Budget**、**Reports**、**Audit Log**。`docs/11:100-108` 自己确认这些是未建配对。当前侧边栏只有文档要求的 3 个工具（`docs/web.md:54-56`），所以这是"文档要 9 屏、实建 3 屏"。

**做法（按数据可用性排序，全部数据已在磁盘上，不需要新语料）**：
1. `views/audit.js` — 直接吃已有 `audit-events.json`（142 条）：时间线 + actor_type 筛选 + `error_code` 聚合 + 单事件 detail JSON。最低成本，最高可信度。
2. `views/budget.js` — 吃 `ledger.json`（程序 × 四态）+ `budget-transactions.json`：堆叠条复用 `dom.js` 的 `barRow`，Available 负数即红。
3. `views/setup.js` — `docs/10:60-72` 的 4 步向导 + `docs/web.md:178,193` 的"2 of 5 sections completed"渐进清单；数据源 `config.json`/`tiers.json`/`checklist.json`。
4. `views/reports.js` — `dashboards.json`（7.4 KB，已建好但未挂任何屏幕）。
5. `views/overview.js` — 组织级首页，聚合上面四者的数字。
6. 每屏在 `app.js` 的 `ROUTES` 注册 + `index.html` 侧栏 `nav-list` 加项；沿用现有 `render(params)` 约定与懒 `import()`。

### P2：视觉/UX 走查（用户点名的"bright liquid glass"）
`docs/web.md:12-25` 的色板：`linear-gradient(135deg,#72CDFF 0%,#BFFFCC 100%)`、纯白 `#FFFFFF`、surface `#FAFBFC/#F8FAFC`、边框 `#E5E7EB/#E2E8F0`、文字 `#111827`、muted `#6B7280`；Approved `#EBFDF5/#065F46`、Rejected `#FDE8E8/#9B1C1C`、Pending `#FEF08A/#854D0E`；active tab rail `#72CDFF` + `rgba(114,205,255,.08)`；glow `0 4px 14px rgba(114,205,255,.35)`。
注意：**glassmorphism 不在任何文档里**，它来自用户 prompt（记录在 `task history.md:841`）；`app.css:2,43,78-82` 自行加了 `--blur: blur(22px) saturate(180%)` + aurora 背景。

待办：
1. **必须用桌面宽度**复核。本会话浏览器视口只有 591px，侧栏是 off-canvas（`app.css:877-900` 的 980px 断点下），所以宽屏三栏（`docs/10:4,167-169` 要求 desktop-first 宽屏双/三栏）**从未被真正看过**。
2. 文档要求的 `Quick Preview` + 下载链接缺失（`docs/web.md:100-101`），现在只有一个 blob "Open"（`detail.js:268`）。
3. `SECURITY_QUARANTINE` 被折进红色 "rejected" 桶，丢掉了 `docs/05:46,93` 要求的"隔离/沙盒证伪"语义 —— 应给它独立色与独立文案。
4. 删除确认框超出文档（文档只给 title+warning+Cancel/Confirm，实现在 `listing.js:232-236` 要求手打记录 ID）。
5. 文档要求的降级语义 `Checklist: Self-Verification Required`、"绝不假称文件完整性已通过"（`docs/web.md:343`）与"永远给出下一步入口、绝不显示笼统的 AI 未就绪报错"（`docs/web.md:349`）需在 `unconfigured` 分支上逐条核对。

### P3：12 条引擎侧缺陷 —— AI 子代理报告，**我只验证了第 1 条**，其余未验证，涉及钱，需用户决定是否本轮处理
（子代理明确只报告未改动，符合我的要求。）

1. ~~seeder `process` 遮蔽~~ → **已修，见 §2.11**。
2. `pipeline.js:911-914` + `ledger.js:175`：`reject` 无条件 `releaseCommit(sub.amount)`，钳制到整行 → 从未 reserve 过的单子（`SUB-2026-MY-0005` 在 R-BUDGET-011 就 POLICY_BLOCKED）被驳回时会把 `PTR-GLD-233` 的 606,000 Committed 清零，Available 从 144,000 跳到 750,000，**凭空放出预算**。
3. `pipeline.js:790-801`：`BUDGET_RESERVING` 阶段就 `commitToApprove`，随后 reject 再从 Committed 扣一次 → 同笔钱两次移动（`0012`）。同理 `0016`(SECURITY_QUARANTINE)/`0015`(PENDING_INFO_REQUEST) 的钱已进 Approved 桶，而 `ledger.json#cashflow_forecast_14d` 只看 Approved，可能对隔离件/缺件套现。
4. `rules.js:105-107` + `pipeline.js:582`：CLAIM 的 `tier.required_documents` 覆盖了 PRE_APPROVAL 规则自己的 `params.required` → 所有 Gold PRE_APPROVAL 都判缺件（`0002/0003/0004/0005` 全带 `BIZ-MISSING-DOCS`）。这解释了为何 `0001` 必须真带 7 份文件才能 `PASSED`。
5. `seed-submissions.js:196` 传的 `{resumeFrom:'VALIDATING'}` 在 `pipeline.js:647` 从未被读；`agent2Validate` 不查 `clarifications.json` → Grill-Me 答完仍重问 CLR-Q1，状态轨迹出现两次 `VALIDATING>NEEDS_CLARIFICATION`。
6. `rules.js` 的 `AMOUNT_LTE_TIER_CAP` / `BUDGET_AVAILABLE_GTE_AMOUNT` **不做 FX 换算**，外币数值直接与 RM 上限比较 → `0011` 的 S$9,600 过了 "RM 10,000"，`0006` 的 US$30,000 过了 R-BUDGET-011。
7. `rules.js:247`：`R-CONFLICT-013` 只在 OPEN 冲突点名 `affected_submissions` 时命中，而 CF-002 是 `[]` 且 seed 晚于该文件生成 → 冲突只能显示 banner，不能挂起单据。
8. `seed-submissions.js:202-219`：单趟只回放一次决策，而 `mark-paid`（`pipeline.js:919`）要求状态已是 APPROVED → **PAID/ARCHIVED 在 seed 中不可达**；`_seed.decision:"pay"` 不是合法动作（合法集：approve/reject/mark-paid/release）。
9. `pipeline.js:341`：注入扫描语料只取 `filename + raw_text_hint`，不读 `text_preview`；且正则匹配不到 `ignore all previous instructions`，只能匹配 `IGNORE PREVIOUS INSTRUCTIONS`。
10. `pipeline.js:307`：`days_apart` 硬编码为 0 → `R-DUP-008`（`rules.js:156`）的 90 天窗口形同虚设。
11. `pipeline.js:955-966`：`finish()` 只算一次 ageing/SLA，`applyHumanDecision` 不刷新 → 已 APPROVED 的 `0001`(73d)/`0002`(256d)/`0010`(228d) 仍带 `sla_breached=true`，**会污染看板逾期计数**。
12. `seed-submissions.js:124`：`toRecord` 不复制 `pre_approval_code`，父子只能靠 `submission_id` 挂接（`pipeline.js:578` 支持按 code）。

**建议顺序**：先 2/3（钱的正确性，会直接显示在 UI 上）→ 11（看板读数）→ 4/5（影响详情页可读性）→ 其余记账但不本轮做。

### P4：DeepSeek 实时接入（用户点了 "deepseek v4.1flash"）
`server/.env` / `.env.example` 已就位，**API key 字段故意留空**：

```
PARTNERFLOW_LLM_BASE_URL=https://api.deepseek.com/v1
PARTNERFLOW_LLM_MODEL=deepseek-v4.1-flash
PARTNERFLOW_LLM_API_KEY=
```

- key 由用户本人粘贴；`ai.js` 运行时读取，**绝不回写、绝不打印、`/api/health` 绝不返回**（`ai.js` 的 `status()` 只回 available/provider/model/base_url/reason/env_file_present；`pick()` 会跳过 `changeme|your_key|xxx|<...>` 之类的占位值）。
- key 为空时优雅降级为**有出处的抽取式 RAG**（当前 173 chunks 就是这么工作的），所以 MVP 不依赖它。
- 若网关拒绝 `deepseek-v4.1-flash` 这个名字，DeepSeek 文档化的 id 是 `deepseek-chat` / `deepseek-reasoner`。

---

## 5. 交接必读的机器/工具体坑

- **`node --check` 在这个项目上会撒谎**：根 `package.json` 是 `"type":"commonjs"`，路径式 `--check` 把 `.js` 当 CJS 解析，ESM 语法坏掉也报通过。唯一可信的是 `node _tools/check-modules.js`。
- **括号总数会撒谎**：brain.js:690 的闭合总数正确但位置在 `:` 的错误一侧；submit.js 少闭合在 396 行、报错却在 405 行。**只能按结构推理修**，我因此删掉了自制的 `fix-parens.js` 自动修复器（能修到通过但嵌套是错的）。
- **Chrome 的失败模块记录会污染文档模块图**：文件修好后浏览器仍报 `Unexpected token ')'`，因为失败解析被缓存。用 blob-URL import 证明代码是干净的，然后**真 `location.reload()`**。
- **`mcp__builtin__create_chat_session` 委托的会话没有本工作区写权限**：那个会话写了 22 条记录，`Write` 返回 failed、系统消息是"操作未获得授权"，磁盘上什么都没落地。**要 AI 产出文件，用 `Agent` 工具（general-purpose）而不是 chat session 委托。**
- `wait_chat_sessions` 的参数是 `timeoutMs`（上限 60000），不是 `timeoutSeconds`；`"completed"` 只代表回合结束 ≠ 结果可用，一律回磁盘验证。
- 长驻服务：后台 Bash 任务会随会话结束而死，用 PowerShell `Start-Process` 起服务再验端口。
- 本机无系统 Python（如需脚本用 uv + venv）；报告用中文、代码与标识符用英文。

---

## 6. 可复用命令清单

```bash
node _tools/check-modules.js            # 9 个浏览器模块 ESM 解析
node _tools/css-gaps.js                 # JS 发出的 class 是否都有 CSS 规则
node _tools/lint-modules.js             # 未用 import / 未调用函数 / 可能未定义调用（注意盲点：SECTION[k]() 这类计算成员调用抓不到）
node _tools/depth.js <file>             # 字符串/模板/注释感知的括号深度追踪
node test-rules.js                      # 19 个规则场景
node server/seed-submissions.js         # 重建语料，打印引擎表格 + 守恒校验
node server/index.js                    # :4321
```

## 7. 我停在哪里

`server/data/submissions-seed.json` 已落盘并通过引擎真实回放假证（`balanced=true`，11 种状态，142 审计事件）。§2 的 12 项修复已在磁盘。用户随即叫停并要求交接，所以我**没有**开始 §3 的任何一项：P0 的 Agent 1–6 汇总块、P1 的 6 个 Console 屏幕、P2 的桌面宽度视觉走查、P3 的引擎缺陷、P4 的 key 粘贴，全部未动。下一步应从 P0 那个需要用户拍板的冲突开始。
