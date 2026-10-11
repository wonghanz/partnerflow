# 01 - Agent 1: Intake Agent (资料读取与结构化整理)

## 1. 业务痛点与目标

| 项目 | 说明 |
| :--- | :--- |
| **当前痛点** | 员工要从 Email、PDF、Excel 和扫描文件中反复手动录入同样的合作伙伴名称、编号、金额、活动日期。格式不一致，且纸质扫描件极易发生肉眼读数偏差。 |
| **核心目标** | 统一摄入多渠道多格式文件；一次性解析为确定性、强类型的 Pydantic JSON Schema；附带物理位置坐标与置信度；彻底阻断幻觉猜测。 |
| **实施技术** | [Docling](https://github.com/docling-project/docling) (高性能多模态文档解析) + **Pydantic V2 Schema** 严格校验。 |

---

## 2. 核心功能规范

1. **全格式格式解析能力：**
   - 原生 PDF / 扫描版 PDF (OCR)
   - 电子表格 (Excel / CSV)
   - 办公文档 (Word .docx)
   - 邮件原文 (.eml / .msg / 邮件正文正文与附件)
2. **结构化提取目标：**
   - 合作伙伴编号 (`partner_id`) 与申请人邮箱
   - 申请类型 (`submission_type`: `PRE_APPROVAL` 或 `CLAIM`)
   - 申请关联预审批编号 (`parent_pre_approval_id`)
   - 申请金额 (`amount`) 与币种 (`currency`, 如 MYR, USD)
   - 活动计划/举办日期 (`activity_date`)
   - 附件文件清单与分类 (`supporting_docs_manifest`)
3. **元数据与溯源 (Lineage Tracking)：**
   - 每个字段提取时附带原始 `doc_id`、`page_number`、表格单元格坐标或 `bounding_box`。
4. **置信度标注与严禁自动补全：**
   - 对关键金额、日期、税号等标记提取置信度评分 (`confidence`: 0.0 ~ 1.0)。
   - 字段不可识别或格式有冲突时，**严禁 LLM 自动补全或猜测**，必须输出带明确错误代码的缺失状态 (`status: FAILED_PARSING`)。

---

## 3. Pydantic 核心数据模型 (Data Contract)

```python
from datetime import date
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class SubmissionType(str, Enum):
    PRE_APPROVAL = "PRE_APPROVAL"
    CLAIM = "CLAIM"


class EvidenceReference(BaseModel):
    doc_id: str = Field(description="系统唯一文件编号")
    filename: str = Field(description="原始文件名")
    page_number: int = Field(description="页码 (1-indexed)")
    bbox: Optional[List[float]] = Field(default=None, description="[x0, y0, x1, y1] 物理边框")
    confidence: float = Field(ge=0.0, le=1.0, description="抽取置信度")


class IntakeExtractedPayload(BaseModel):
    submission_id: str = Field(description="全局申请流水号")
    partner_id: str = Field(description="合作伙伴代码，如 PTR-GLD-882")
    submission_type: SubmissionType
    parent_pre_approval_id: Optional[str] = Field(default=None, description="报销时必填关联的预审批单号")
    amount: float = Field(gt=0, description="申请申报总金额")
    currency: str = Field(default="MYR", description="币种代码 ISO 4217")
    activity_date: date = Field(description="活动开展日期")
    invoice_numbers: List[str] = Field(default_factory=list, description="发票号列表")
    extracted_evidence: List[EvidenceReference]
    amount_confidence: float = Field(ge=0.0, le=1.0, description="金额字段置信度")

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        allowed = {"MYR", "USD", "SGD"}
        if v.upper() not in allowed:
            raise ValueError(f"Unsupported currency: {v}")
        return v.upper()
```

---

## 4. 关键风险与防护机制 (Risk & Defense)

### 风险：OCR 读数错误（例如将 RM 15,000 误识别为 RM 1,500）
*危害：一旦少算或多算一个零，直接导致企业超额报销或引发财务审计事故。*

#### 落地防护四道防线：
1. **多重比对机制 (Cross-Document Consistency Check)：**
   - 发票大写金额（如有）与小写阿拉伯数字交叉比对。
   - 提取发票表格中的各项明细 (Line Items)，计算明细总和是否与发票总额相符。如果 `Sum(Items) != TotalAmount`，置信度直接降为 0。
2. **置信度阈值熔断 (Confidence Circuit Breaker)：**
   - 设定硬性阈值：`amount_confidence < 0.90`。
   - 只要置信度不达标，或者不同附件发票之间金额不一致，直接打上 `FLAG_LOW_CONFIDENCE` 标签。
3. **预算扣减绝对阻断 (Budget Block)：**
   - **系统铁律：** 在金额未经置信度校验通过或人工确认之前，**严禁进入 Agent 4 预算更新与扣减步骤**。
4. **统一归一化处理：**
   - 消除千分位逗号与小数点的混淆（如德制数字与英美数字体系的区别），对马来西亚及东南亚常见账单做专属正则解析。

---

## 5. Token 与推理成本优化 (Token Optimization)

*为什么不能把整个 PDF 送给后续 Agent？*
- 一份包含活动照片、合同扫描件、发票的申请往往多达 20~50 页，直接输入下游 Agent 会迅速耗尽上下文窗口（数万 Token/次），并且引入大量无关视觉干扰。

#### 优化实施方案：
1. **Docling 前置蒸馏：** 
   - Docling 在 Python 服务端完成本地版式解析、表格抽取与 OCR，不消耗云端 LLM Token。
2. **轻量 JSON 传递：**
   - 下游 Agent（Validation, Rules Engine 等）仅接收上述紧凑的 `IntakeExtractedPayload` JSON 数据（消耗仅 300~500 Token）。
3. **按需溯源剪切 (Snippets on Demand)：**
   - 下游若需要视觉复核，仅根据 `doc_id` 和 `page_number` 裁剪对应 1~2 页的局部图像切片传递，节省 90% 以上 Token 成本。
