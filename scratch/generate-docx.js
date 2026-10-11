'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_DOCX = path.join(__dirname, '..', 'CMO_Demo_Script_PartnerFlow_2.5Min_v2.docx');
const BUILD_DIR = path.join(__dirname, 'docx_build');

if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
}
fs.mkdirSync(BUILD_DIR, { recursive: true });
fs.mkdirSync(path.join(BUILD_DIR, '_rels'), { recursive: true });
fs.mkdirSync(path.join(BUILD_DIR, 'word'), { recursive: true });
fs.mkdirSync(path.join(BUILD_DIR, 'word', '_rels'), { recursive: true });

// 1. [Content_Types].xml
const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
fs.writeFileSync(path.join(BUILD_DIR, '[Content_Types].xml'), contentTypesXml, 'utf8');

// 2. _rels/.rels
const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
fs.writeFileSync(path.join(BUILD_DIR, '_rels', '.rels'), relsXml, 'utf8');

// 3. word/_rels/document.xml.rels
const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
fs.writeFileSync(path.join(BUILD_DIR, 'word', '_rels', 'document.xml.rels'), docRelsXml, 'utf8');

// 4. word/styles.xml
const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="1E293B"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="140" w:line="270" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>

  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr>
      <w:spacing w:before="0" w:after="100"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:b/>
      <w:sz w:val="48"/>
      <w:color w:val="0F172A"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:pPr>
      <w:spacing w:before="0" w:after="240"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="24"/>
      <w:color w:val="475569"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:pPr>
      <w:spacing w:before="320" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:b/>
      <w:sz w:val="30"/>
      <w:color w:val="1E40AF"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:pPr>
      <w:spacing w:before="220" w:after="90"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:b/>
      <w:sz w:val="24"/>
      <w:color w:val="0F172A"/>
    </w:rPr>
  </w:style>
</w:styles>`;
fs.writeFileSync(path.join(BUILD_DIR, 'word', 'styles.xml'), stylesXml, 'utf8');

function xml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function p(text, options = {}) {
  const { style, bold, italic, color, size, align, spaceBefore, spaceAfter } = options;
  let pPr = '<w:pPr>';
  if (style) pPr += `<w:pStyle w:val="${style}"/>`;
  if (align) pPr += `<w:jc w:val="${align}"/>`;
  if (spaceBefore !== undefined || spaceAfter !== undefined) {
    pPr += `<w:spacing w:before="${spaceBefore ?? 0}" w:after="${spaceAfter ?? 140}"/>`;
  }
  pPr += '</w:pPr>';

  let rPr = '<w:rPr>';
  if (bold) rPr += '<w:b/>';
  if (italic) rPr += '<w:i/>';
  if (color) rPr += `<w:color w:val="${color}"/>`;
  if (size) rPr += `<w:sz w:val="${size}"/>`;
  rPr += '</w:rPr>';

  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

function callout(title, body) {
  return `<w:p>
    <w:pPr>
      <w:pBdr>
        <w:left w:val="single" w:sz="24" w:space="15" w:color="2563EB"/>
      </w:pBdr>
      <w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>
      <w:spacing w:before="100" w:after="120" w:line="250" w:lineRule="auto"/>
      <w:ind w:left="180" w:right="180"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:b/><w:color w:val="1E40AF"/><w:sz w:val="21"/></w:rPr>
      <w:t xml:space="preserve">${xml(title)} </w:t>
    </w:r>
    <w:r>
      <w:rPr><w:color w:val="334155"/><w:sz w:val="21"/></w:rPr>
      <w:t xml:space="preserve">${xml(body)}</w:t>
    </w:r>
  </w:p>`;
}

function speech(speaker, text, subtext = null) {
  let out = `<w:p>
    <w:pPr>
      <w:spacing w:before="60" w:after="100" w:line="270" w:lineRule="auto"/>
      <w:ind w:left="160"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="22"/></w:rPr>
      <w:t xml:space="preserve">${xml(speaker)}: </w:t>
    </w:r>
    <w:r>
      <w:rPr><w:color w:val="1E293B"/><w:sz w:val="22"/></w:rPr>
      <w:t xml:space="preserve">“${xml(text)}”</w:t>
    </w:r>
  </w:p>`;
  if (subtext) {
    out += `<w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="120" w:line="240" w:lineRule="auto"/>
        <w:ind w:left="160"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:i/><w:color w:val="64748B"/><w:sz w:val="20"/></w:rPr>
        <w:t xml:space="preserve">中文参考: “${xml(subtext)}”</w:t>
      </w:r>
    </w:pPr>`;
  }
  return out;
}

function table(headers, rows) {
  let xmlOut = `<w:tbl>
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
    </w:tblPr>`;

  xmlOut += `<w:tr><w:trPr><w:tblHeader/></w:trPr>`;
  for (const h of headers) {
    xmlOut += `<w:tc>
      <w:tcPr>
        <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
        <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>
      </w:tcPr>
      <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>${xml(h)}</w:t></w:r></w:p>
    </w:tc>`;
  }
  xmlOut += `</w:tr>`;

  for (const row of rows) {
    xmlOut += `<w:tr>`;
    for (const cell of row) {
      xmlOut += `<w:tc>
        <w:tcPr>
          <w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>
        </w:tcPr>
        <w:p><w:pPr><w:spacing w:after="30"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr><w:t>${xml(cell)}</w:t></w:r></w:p>
      </w:tc>`;
    }
    xmlOut += `</w:tr>`;
  }

  xmlOut += `</w:tbl>`;
  return xmlOut;
}

// 5. Build word/document.xml
let docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${p('PartnerFlow AI — CMO Executive Demo Script', { style: 'Title' })}
    ${p('High-Impact 2.5-Minute Pitch | Governance Gate, Brain Intelligence & 7-Agent Squad', { style: 'Subtitle' })}

    ${p('Demo Specifications & Value Drivers', { style: 'Heading2' })}
    ${p('• Target Duration: Max 2.5 Minutes (150 seconds / tight executive cadence).')}
    ${p('• Company Context: UMochi Global Technologies (UMochi Cloud & Cyber Solutions).')}
    ${p('• Core Technology: DeepSeek Flash (Sub-second latency, micro-cent token cost, zero-hallucination RAG over enterprise wiki).')}
    ${p('• Demo Sequence: Act 1: Governance Gate (Programme Setup) ➔ Act 2: Brain Intelligence (DeepSeek Flash & Knowledge Upload) ➔ Act 3: Live Submission & 7-Agent Pipeline ➔ Act 4: Listing History (Boss Skill Comment Preview) ➔ Act 5: Evidence & Immutable Audit Log.')}

    <w:p><w:pPr><w:spacing w:before="140" w:after="140"/></w:pPr></w:p>

    ${p('ACT I: The Governance Gate — "No Setup, No Start" [0:00 – 0:25]', { style: 'Heading1' })}
    ${callout('[On-Screen Action]:', 'Open Programme Setup (#/programme). Show Steps 1 to 4: Program Profile, Tier Entitlements, Eligible Categories, and Budget Cap.')}
    ${speech('Speaker (CMO)', 
      'In partner marketing, the number one cause of fund leakage is spending without rules. In PartnerFlow, we enforce a strict governance condition: if Programme Setup is not complete, zero claims can start. Here in Steps 1 through 4, we define our APAC Co-op Fund—locking in Elite, Gold, Silver, or any custom tiers provided by the company, along with eligible categories and hard budget caps. Every rule is deterministic. Nothing is left to guesswork.',
      '在渠道营销中，资金漏洞的第一大根源就是无规则支出。在 PartnerFlow 中，我们执行严格的治理门禁：如果项目配置未完成，任何申请绝对无法启动。在第 1 至第 4 步中，我们锁定了 Elite、Gold、Silver 或公司自定义的任何伙伴等级、合规活动类别及预算上限。完全基于确定性规则，绝无人工臆测。'
    )}

    ${p('ACT II: Brain Intelligence & DeepSeek Flash [0:25 – 0:55]', { style: 'Heading1' })}
    ${callout('[On-Screen Action]:', 'Navigate to Brain Intelligence (#/brain). Show UMochi Company Profile and SOP Wiki. Click Knowledge Base, demonstrate PDF upload & AI digestion, then trigger a live query in the DeepSeek Flash RAG panel.')}
    ${speech('Speaker (CMO)', 
      'Powering this entire ecosystem is Brain Intelligence, taking UMochi Company as our baseline. We power our brain with DeepSeek Flash because it processes complex multi-page document texts with sub-second speed at micro-cent token cost, guaranteeing 100% factual accuracy. All policies—from hospitality limits to SLA windows—are grounded in our live LLM Wiki. Watch: we upload an updated SOP PDF into our Knowledge Base; the AI digests it in real-time, extracts enforceable clauses, and reconstructs our Company Brain instantly with zero manual indexing.',
      '以我们 UMochi 公司为例，驱动整个生态的核心是大脑智能（Brain Intelligence）。我们采用 DeepSeek Flash，因为它能以亚秒级极速和微乎其微的成本解析长篇文档，确保 100% 事实准确。所有政策均沉淀于企业 LLM Wiki。看：我们直接向知识库上传最新的 SOP PDF，AI 实时消化提取合规条款，瞬间重构企业大脑，无需任何人工建库。'
    )}

    ${p('ACT III: Live Submission Intake & 7-Agent Real-Time Pipeline [0:55 – 1:35]', { style: 'Heading1' })}
    ${callout('[On-Screen Action]:', 'Open New Submission (#/submit). Select PTR-ELT-101 (Sentosa Digital Partners), Claim type, attach invoice PDF & execution proofs, and hit Submit. Highlight the visual pipeline strip showing the 7 agents processing in real time.')}
    ${speech('Speaker (CMO)', 
      'Now, watch a live partner claim run. The moment they hit submit, our visual pipeline displays the real-time loading status across our 7 specialized AI agents: Agent 1 Intake runs Docling layout OCR and SHA-256 tamper hashing. Agent 2 Validation cross-checks partner eligibility and triggers Grill-Me inquiries for missing info. Agent 3 Deterministic Rules evaluates zero-token policy compliance. Agent 4 Budget Ledger reserves atomic 4-state ledger balances. Agent 5 Security Sentinel quarantines tampered invoices in a dual-track sandbox. Agent 6 Review Memo generates a structured human review memo. And Agent 7 Executive Briefing applies the Boss Skill to synthesize the final determination.',
      '现在看一笔真实伙伴申请。点击提交的瞬间，流水线实时显示 7 大 AI 智能体的流转状态：Agent 1 负责 Docling OCR 与 SHA-256 防篡改哈希；Agent 2 执行校验与 Grill-Me 澄清核实；Agent 3 确定性规则引擎做 0-token 政策判定；Agent 4 预算账本执行四态原子锁定；Agent 5 安全卫士双轨隔离恶意发票；Agent 6 生成标准审核函；Agent 7 则以 Boss Skill 综合输出高管建议。'
    )}

    ${p('ACT IV: Listing History — Real-Time Triage & Boss Skill Snippets [1:35 – 2:05]', { style: 'Heading1' })}
    ${callout('[On-Screen Action]:', 'Switch to Listing History (#/listing). Point to the clean cards with status badges and highlight the Boss Skill comment preview snippet at the bottom of each card. Briefly toggle Table View.')}
    ${speech('Speaker (CMO)', 
      'Switching to Listing History: notice the bottom of every card—zero blank fields, and zero nulls. Instead, our Boss Skill AI synthesizes the entire squad’s findings into a short executive comment preview right on the card. At a single glance, management sees declared vs. approved totals, live SLA countdowns, and the AI’s synthesized determination for instant triage.',
      '切换到申请历史：注意卡片底部——零空白字段，零 null 乱码。取而代之的是 Boss Skill AI 将所有智能体的判定提炼为一段极简的高管简报直显卡片底部。管理层一眼即可看清申报与批准金额、SLA 倒计时及决策建议。'
    )}

    ${p('ACT V: Evidence & The Ultimate Audit Punchline [2:05 – 2:30]', { style: 'Heading1' })}
    ${callout('[On-Screen Action]:', 'Click into SUB-2026-MY-0002. Toggle to Evidence tab (show Classification Basis & Confidence Basis without dashes) and open the Audit Trail tab.')}
    ${speech('Speaker (CMO)', 
      'Under the Evidence tab, every single field—Classification Basis, Confidence Basis, and Parsed Amount—is 100% verified without a single missing dash. And here is our ultimate safeguard: our immutable audit log records every single transition with cryptographic proof, ensuring we always know exactly who approved each transaction—whether an authorized human admin or an AI agent—to eliminate financial loss. That is PartnerFlow. Compliant, fast, and protected by DeepSeek Flash. Thank you.',
      '在证据详情中，分类依据、置信度依据及解析金额全部精准落地，绝无破折号缺失。最后是终极防护底线：我们的不可变审计日志以密码学哈希记录每一次状态流转，确保我们永远明确知道每笔款项是由人类管理员还是 AI 最终批准，从根本上杜绝任何资金损失！这就是 PartnerFlow。'
    )}

    <w:p><w:pPr><w:spacing w:before="200" w:after="120"/></w:pPr></w:p>

    ${p('CMO Executive Timing Cue Sheet', { style: 'Heading1' })}
    ${table(
      ['Time Window', 'Act & Screen', 'On-Screen Action Focus', 'Core Talk Track & Value Proposition'],
      [
        ['0:00 – 0:25', 'ACT I: Governance (#/programme)', 'Steps 1–4 Setup Wizard', '"No Setup = No Start"; locks Elite, Gold, Silver & custom tiers.'],
        ['0:25 – 0:55', 'ACT II: Brain (#/brain)', 'UMochi Profile & Upload PDF', 'DeepSeek Flash sub-second/cheap; AI digests PDF into Company Brain.'],
        ['0:55 – 1:35', 'ACT III: Submission (#/submit)', 'Submit & 7-Agent Pipeline', 'Live progress loading; briefly names each of the 7 specialized agents.'],
        ['1:35 – 2:05', 'ACT IV: Listing (#/listing)', 'Cards & Table Comment Preview', 'Zero nulls; concise Boss Skill comment snippet for instant triage.'],
        ['2:05 – 2:30', 'ACT V: Audit (#/listing/:id)', 'Evidence & Cryptographic Trail', 'Know exactly who approved (Admin vs AI) to prevent any financial loss!']
      ]
    )}

    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

fs.writeFileSync(path.join(BUILD_DIR, 'word', 'document.xml'), docXml, 'utf8');

// 6. Zip with PowerShell .NET System.IO.Compression.ZipFile
if (fs.existsSync(OUTPUT_DOCX)) {
  fs.unlinkSync(OUTPUT_DOCX);
}

const psScriptPath = path.join(__dirname, 'zip.ps1');
const psScriptContent = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$src = '${BUILD_DIR.replace(/'/g, "''")}'
$dst = '${OUTPUT_DOCX.replace(/'/g, "''")}'
[System.IO.Compression.ZipFile]::CreateFromDirectory($src, $dst)
`;
fs.writeFileSync(psScriptPath, psScriptContent, 'utf8');

execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'inherit' });

if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);

console.log('Successfully regenerated DOCX:', OUTPUT_DOCX);
console.log('File size:', fs.statSync(OUTPUT_DOCX).size, 'bytes');

const demoDest = path.join(__dirname, '..', 'demo', 'CMO_Demo_Script_PartnerFlow_2.5Min_v2.docx');
if (!fs.existsSync(path.dirname(demoDest))) fs.mkdirSync(path.dirname(demoDest), { recursive: true });
fs.copyFileSync(OUTPUT_DOCX, demoDest);
console.log('Copied to:', demoDest);

// Clean up build dir
fs.rmSync(BUILD_DIR, { recursive: true, force: true });
