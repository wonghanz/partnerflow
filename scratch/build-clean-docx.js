'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_DOCX = path.join(__dirname, '..', 'CMO_Demo_Script_PartnerFlow.docx');
const DEMO_DOCX = path.join(__dirname, '..', 'demo', 'CMO_Demo_Script_PartnerFlow.docx');
const BUILD_DIR = path.join(__dirname, 'docx_clean_build');

if (fs.existsSync(BUILD_DIR)) fs.rmSync(BUILD_DIR, { recursive: true, force: true });
fs.mkdirSync(BUILD_DIR, { recursive: true });
fs.mkdirSync(path.join(BUILD_DIR, '_rels'), { recursive: true });
fs.mkdirSync(path.join(BUILD_DIR, 'word'), { recursive: true });

// 1. [Content_Types].xml
const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
fs.writeFileSync(path.join(BUILD_DIR, '[Content_Types].xml'), contentTypes, 'utf8');

// 2. _rels/.rels
const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
fs.writeFileSync(path.join(BUILD_DIR, '_rels', '.rels'), rels, 'utf8');

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function p(text, opts = {}) {
  const { bold, italic, color = '1E293B', size = 22, before = 0, after = 140 } = opts;
  let rPr = `<w:rPr><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:color w:val="${color}"/>`;
  if (bold) rPr += '<w:b/><w:bCs/>';
  if (italic) rPr += '<w:i/><w:iCs/>';
  rPr += '</w:rPr>';

  return `<w:p>
    <w:pPr><w:spacing w:before="${before}" w:after="${after}"/></w:pPr>
    <w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>
  </w:p>`;
}

function callout(action) {
  return `<w:p>
    <w:pPr>
      <w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>
      <w:spacing w:before="80" w:after="100"/>
      <w:ind w:left="160" w:right="160"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="1E40AF"/></w:rPr>
      <w:t xml:space="preserve">SCREEN ACTION: </w:t>
    </w:r>
    <w:r>
      <w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(action)}</w:t>
    </w:r>
  </w:p>`;
}

function speech(text, zhText = null) {
  let out = `<w:p>
    <w:pPr>
      <w:spacing w:before="60" w:after="80"/>
      <w:ind w:left="160"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr>
      <w:t xml:space="preserve">CMO: </w:t>
    </w:r>
    <w:r>
      <w:rPr><w:sz w:val="22"/><w:color w:val="1E293B"/></w:rPr>
      <w:t xml:space="preserve">"${escapeXml(text)}"</w:t>
    </w:r>
  </w:p>`;

  if (zhText) {
    out += `<w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="100"/>
        <w:ind w:left="160"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr>
        <w:t xml:space="preserve">中文参考: "${escapeXml(zhText)}"</w:t>
      </w:r>
    </w:pPr>`;
  }
  return out;
}

function table(headers, rows, colWidths = [1800, 2200, 2400, 3000]) {
  let xml = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9400" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:left w:val="none"/>
        <w:bottom w:val="single" w:sz="12" w:space="0" w:color="94A3B8"/>
        <w:right w:val="none"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        <w:insideV w:val="none"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>`;

  for (const w of colWidths) {
    xml += `<w:gridCol w:w="${w}"/>`;
  }
  xml += `</w:tblGrid>`;

  // Header
  xml += `<w:tr><w:trPr><w:tblHeader/></w:trPr>`;
  headers.forEach((h, idx) => {
    xml += `<w:tc>
      <w:tcPr>
        <w:tcW w:w="${colWidths[idx]}" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
      </w:tcPr>
      <w:p><w:pPr><w:spacing w:after="40"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(h)}</w:t></w:r>
      </w:p>
    </w:tc>`;
  });
  xml += `</w:tr>`;

  // Rows
  for (const row of rows) {
    xml += `<w:tr>`;
    row.forEach((cell, idx) => {
      xml += `<w:tc>
        <w:tcPr>
          <w:tcW w:w="${colWidths[idx]}" w:type="dxa"/>
        </w:tcPr>
        <w:p><w:pPr><w:spacing w:after="30"/></w:pPr>
          <w:r><w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(cell)}</w:t></w:r>
        </w:p>
      </w:tc>`;
    });
    xml += `</w:tr>`;
  }

  xml += `</w:tbl>`;
  return xml;
}

// Build word/document.xml
let docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${p('PartnerFlow AI — CMO Executive Demo Script', { bold: true, size: 44, color: '0F172A', after: 60 })}
    ${p('Concise 2-Minute Executive Pitch | Zero Fluff, Solid Value, 100% Grounded', { size: 24, color: '475569', after: 200 })}

    ${p('ACT I: The Governance Gate (Programme Setup)', { bold: true, size: 28, color: '1E40AF', before: 200, after: 80 })}
    ${callout('Open Programme Setup (#/programme). Show Steps 1 to 4: Program Profile, Tier Entitlements, Eligible Categories, and Budget Cap.')}
    ${speech(
      'In partner marketing, fund leakage happens when spending has no rules. In PartnerFlow, if Programme Setup is not complete, zero claims can start—locking in Elite, Gold, Silver, or any custom tiers provided by the company, along with hard budget caps.',
      '在渠道营销中，资金漏洞的根源就是支出缺乏规则。在 PartnerFlow 中，如果项目配置未完成，任何申请绝对无法启动——全面锁定 Elite、Gold、Silver 或公司自定义等级及预算硬上限。'
    )}

    ${p('ACT II: Brain Intelligence & DeepSeek Flash', { bold: true, size: 28, color: '1E40AF', before: 200, after: 80 })}
    ${callout('Go to Brain Intelligence (#/brain). Show UMochi Company Profile and live SOP Wiki. Click Knowledge Base, show PDF upload & real-time digest, then trigger DeepSeek Flash Q&A.')}
    ${speech(
      'Using UMochi as our baseline, Brain Intelligence grounds our operations in a live company SOP Wiki. We power our brain with DeepSeek Flash because it processes complex multi-page document texts with sub-second speed at micro-cent token cost, guaranteeing 100% factual accuracy. In our Knowledge Base, we simply upload a policy PDF, and the AI digests and integrates it directly into the Company Brain in real time.',
      '以 UMochi 公司为基准，大脑智能将所有运营沉淀在企业 SOP Wiki 中。我们采用 DeepSeek Flash，因为它能以亚秒级极速和微乎其微的成本解析长篇文档，确保 100% 事实准确。在知识库中直接上传政策 PDF，AI 即可实时消化并无缝重构企业大脑。'
    )}

    ${p('ACT III: Live Submission Intake & 7-Agent Real-Time Pipeline', { bold: true, size: 28, color: '1E40AF', before: 200, after: 80 })}
    ${callout('Open New Submission (#/submit). Pick PTR-ELT-101, attach invoice and proof, click Submit. Point to the visual loading pipeline strip at the top showing the 7 specialized agents.')}
    ${speech(
      'When a partner submits a claim, our visual pipeline displays the real-time loading status across our 7 specialized AI agents: Agent 1 Intake (OCR & SHA-256 hashing), Agent 2 Validation (Grill-Me cross-checks), Agent 3 Deterministic Rules, Agent 4 Budget Ledger, Agent 5 Security Sentinel, Agent 6 Review Memo, and Agent 7 Executive Briefing. Everything runs autonomously in seconds without manual data entry.',
      '伙伴提交申请时，流水线实时显示 7 大智能体的运转状态：Agent 1 负责 OCR 与防篡改哈希、Agent 2 校验与 Grill-Me 追问、Agent 3 确定性规则判定、Agent 4 账本四态锁定、Agent 5 安全隔离、Agent 6 审核函生成、Agent 7 高管简报输出。全流程数秒内自主完成，无需人工录入。'
    )}

    ${p('ACT IV: Listing History — Real-Time Triage', { bold: true, size: 28, color: '1E40AF', before: 200, after: 80 })}
    ${callout('Switch to Listing History (#/listing). Highlight clean cards with zero nulls and point directly to the Boss Skill comment preview snippet at the bottom.')}
    ${speech(
      'In Listing History, every card displays zero blank fields and zero nulls. Our Boss Skill AI synthesizes the entire squad’s findings into a short executive comment preview right on the card for instant decision-making.',
      '在申请历史中，每张卡片零空白字段、零 null 乱码。Boss Skill AI 将全智能体的判定浓缩为卡片底部的简短高管简报，方便管理层秒级审批决策。'
    )}

    ${p('ACT V: Evidence & The 2-Sentence Audit Log Safeguard', { bold: true, size: 28, color: '1E40AF', before: 200, after: 80 })}
    ${callout('Click into SUB-2026-MY-0002. Toggle to Evidence tab (show complete Classification Basis & Confidence Basis) and open Audit Trail.')}
    ${speech(
      'Under Evidence, every field—from classification basis to parsed amounts—is 100% verified. Most importantly, our audit log ensures we always know exactly who approved each transaction—whether an authorized human admin or an AI agent—to eliminate financial loss.',
      '在证据中，分类依据与解析金额均 100% 验证无缺失。最重要的是：审计日志确保我们永远明确知晓每笔款项由人类管理员还是 AI 批准，彻底杜绝任何资金损失。'
    )}

    ${p('Executive Cue Sheet', { bold: true, size: 26, color: '0F172A', before: 200, after: 60 })}
    ${table(
      ['Timing', 'Act & Route', 'Key Action Focus', 'Core Value Proposition'],
      [
        ['0:00 – 0:20', 'ACT I (#/programme)', 'Steps 1–4 Wizard', 'No Setup = No Start; locks Elite, Gold, Silver & custom tiers.'],
        ['0:20 – 0:50', 'ACT II (#/brain)', 'UMochi & PDF Upload', 'DeepSeek Flash sub-second/cheap; AI digests PDF into Brain.'],
        ['0:50 – 1:25', 'ACT III (#/submit)', 'Submit & 7-Agent Strip', 'Live loading strip; concise run-through of Agents 1–7.'],
        ['1:25 – 1:45', 'ACT IV (#/listing)', 'Cards & Comment Preview', 'Zero nulls; Boss Skill comment snippet for instant triage.'],
        ['1:45 – 2:05', 'ACT V (#/listing/:id)', 'Evidence & Audit Trail', 'Know exactly who approved (Admin vs AI) to prevent financial loss!']
      ],
      [1600, 2200, 2600, 3000]
    )}

    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

fs.writeFileSync(path.join(BUILD_DIR, 'word', 'document.xml'), docXml, 'utf8');

// Zip
const psScriptPath = path.join(__dirname, 'zip_clean.ps1');
const psScriptContent = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$src = '${BUILD_DIR.replace(/'/g, "''")}'
$dst = '${OUTPUT_DOCX.replace(/'/g, "''")}'
if (Test-Path $dst) { Remove-Item $dst -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($src, $dst)
`;
fs.writeFileSync(psScriptPath, psScriptContent, 'utf8');

execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'inherit' });
if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);

// Copy to demo
if (!fs.existsSync(path.dirname(DEMO_DOCX))) fs.mkdirSync(path.dirname(DEMO_DOCX), { recursive: true });
fs.copyFileSync(OUTPUT_DOCX, DEMO_DOCX);

console.log('Successfully generated clean DOCX:');
console.log('1.', OUTPUT_DOCX);
console.log('2.', DEMO_DOCX);

fs.rmSync(BUILD_DIR, { recursive: true, force: true });
