# L4: Company Mindset Memory — 经授权生效的判断原则库

> **核心原则：**
> 1. 本文件收录的原则均源自真实历史业务案例，经 **Distill Skill** 聚类并由**公司授权管理人员签署批准**后入库。
> 2. **不可突破红线：** 历史经验仅可用于优化审批优先级、风险排序与建议措辞，**绝对禁止覆盖正式政策、财务四态预算硬限制或人工终审权限**。

---

## 📌 当前生效的心智原则 (Active Mindset Principles)

### MINDSET_001: 证据不足的高金额申请优先分流人工复核
```json
{
  "principle_id": "MINDSET_001",
  "principle": "对于申报金额高于 RM 10,000 且缺少活动现场佐证材料的报销申请，优先标记为 HIGH_ATTENTION，提早推送到高级运营初审队列，并在建议函中重点提示核减风险",
  "scope": "claim_triage",
  "basis": "Approved across 28 historical quarterly audit cases",
  "authority": "management_approved_by_Operations_Director",
  "policy_override_allowed": false,
  "version": 1,
  "effective_date": "2026-04-01"
}
```

---

### MINDSET_002: 初次线上研讨会小额超额倾向于建议核减而非整单驳回
```json
{
  "principle_id": "MINDSET_002",
  "principle": "当 Gold 级合作伙伴初次举办线上研讨会且超出预审批金额 10% 以内（且不超过 RM 1,000）时，若具备完整录像与签到表，建议在草稿中提供「按上限核减批准」选项，而非整体驳回",
  "scope": "claim_recommendation",
  "basis": "Historical VP Sales concession pattern",
  "authority": "management_approved_by_VP_Sales",
  "policy_override_allowed": false,
  "version": 1,
  "effective_date": "2026-06-15"
}
```

---

## 🔄 Mindset 提炼与入库标准流程 (Distill Workflow)

```
人工审批/修正 AI 结果
       ↓
系统记录案例明细、差异原因与决策依据 (PostgreSQL 事实表)
       ↓
Distill 识别重复出现的判断模式 (聚合 ≥ 5 次同类特批)
       ↓
生成待审核的《Mindset 提案 (Proposal)》
       ↓
安全与政策审查：检查是否与正式法律/预算政策冲突
       ↓
公司授权管理人员 (VP/Director) 签核批准
       ↓
写入本文件，发布为版本化长期资产
```
