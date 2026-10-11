const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, '..', 'server', 'data', 'partnerflow.db');
const seedPath = path.join(__dirname, '..', 'server', 'data', 'submissions-seed.json');

// 1. Update partnerflow.db
if (fs.existsSync(dbPath)) {
  const db = new DatabaseSync(dbPath);
  const rows = db.prepare('SELECT * FROM submissions').all();
  for (const r of rows) {
    let raw = r.raw_json;
    if (raw && /[\u4e00-\u9fa5]/.test(raw)) {
      raw = raw
        .replace(/1\. Submission Summary \/ 申请摘要/g, '1. Submission Summary')
        .replace(/2\. Completed Verifications \/ 已完成的系统核对/g, '2. Completed Verifications')
        .replace(/3\. Outstanding Issues & Evidence \/ 待解决问题及对应证据/g, '3. Outstanding Issues & Evidence')
        .replace(/4\. Recommended Action \/ 建议采取的行动/g, '4. Recommended Action')
        .replace(/5\. Items Requiring Approver Sign-Off \/ 需要审批人确认的事项/g, '5. Items Requiring Approver Sign-Off')
        .replace(/6\. Policy Citations \/ 相关政策与文件引用/g, '6. Policy Citations')
        .replace(/0\. Executive AI Briefing \(Boss Skill\) \/ 高管智能简报/g, '0. Executive AI Briefing (Boss Skill)');
      
      db.prepare('UPDATE submissions SET raw_json = ? WHERE submission_id = ?').run(raw, r.submission_id);
      console.log('Cleaned Chinese from DB submission:', r.submission_id);
    }
  }
}

// 2. Clean submissions-seed.json
if (fs.existsSync(seedPath)) {
  const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  for (const s of seeds) {
    if (s.title) {
      s.title = s.title
        .replace(/预审批/g, 'Pre-Approval')
        .replace(/报销/g, 'Claim Reimbursement')
        .replace(/联合市场活动/g, 'Joint Marketing Campaign')
        .replace(/联合推广/g, 'Joint Promotion')
        .replace(/数字广告联合投放/g, 'Digital Advertising Co-Op Campaign')
        .replace(/展会补贴/g, 'Exhibition Co-op Subsidy')
        .replace(/年度巡展预算包/g, 'Annual Roadshow Budget Envelope')
        .replace(/首次展会补贴/g, 'Inaugural Exhibition Subsidy')
        .replace(/历史规则版本单据/g, 'Historical Rule Matrix Version Submission')
        .replace(/分摊比例超限/g, 'Matching Ratio Over-Cap')
        .replace(/超时效且复用了已录入发票号/g, 'Filing Overdue & Duplicate Invoice Collided')
        .replace(/手机翻拍票据置信度不足/g, 'Receipt Image Low Confidence (<0.85)')
        .replace(/二次申报 · 同伙伴同日同金额疑似重复/g, 'Potential Duplicate (Same Partner, Date & Amount)')
        .replace(/缺少活动现场照片/g, 'Missing Event Proof Photos')
        .replace(/附件内嵌指令注入文本/g, 'Attachment Contains Prompt Injection Payload')
        .replace(/宏启用附件与缺失照片双轨异常/g, 'Macro-Enabled XLSM Attachment & Missing Photos')
        .replace(/两张发票金额冲突需澄清/g, 'Dual Invoice Amount Discrepancy (Requires Grill-Me)')
        .replace(/搭建尾款报销 · 承诺额度池已被释放/g, 'Construction Balance Claim (Committed Pool Depleted)')
        .replace(/伙伴处于停用状态/g, 'Partner In Suspended State (Blocked)')
        .replace(/首次参展报销 · 等级未配置需人工核定限额/g, 'Inaugural Expo Claim (Tier Unconfigured)')
        .replace(/全部门禁通过待人工终审/g, 'All Gates Passed (Awaiting Final Human Approval)')
        .replace(/槟城展会补贴/g, 'Penang Consumer Fair Co-op Subsidy')
        .replace(/发票合计 RM 30,000 按 50% 分摊申报/g, 'Invoice Total RM 30,000 Filed at 50% Matching');
    }
    if (s.notes) {
      // Remove any remaining Chinese characters in notes by converting to English standard text
      s.notes = s.notes
        .replace(/[\u4e00-\u9fa5]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  fs.writeFileSync(seedPath, JSON.stringify(seeds, null, 2), 'utf8');
  console.log('Cleaned submissions-seed.json successfully!');
}
