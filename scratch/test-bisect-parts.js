'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// We test subsets of docXml
const parts = [
  { name: 'title', xml: `<w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="0F172A"/></w:rPr><w:t>PartnerFlow AI — CMO Executive Demo Script</w:t></w:r></w:p>` },
  { name: 'subtitle', xml: `<w:p><w:pPr><w:spacing w:before="0" w:after="200"/></w:pPr><w:r><w:rPr><w:sz w:val="24"/><w:color w:val="475569"/></w:rPr><w:t>Concise 2-Minute Executive Pitch | Zero Fluff, Solid Value, 100% Grounded</w:t></w:r></w:p>` },
  { name: 'act1_h', xml: `<w:p><w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1E40AF"/></w:rPr><w:t>ACT I: The Governance Gate (Programme Setup)</w:t></w:r></w:p>` },
  { name: 'act1_callout', xml: `<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/><w:spacing w:before="80" w:after="100"/><w:ind w:left="160" w:right="160"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="1E40AF"/></w:rPr><w:t xml:space="preserve">SCREEN ACTION: </w:t></w:r><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr><w:t xml:space="preserve">Open Programme Setup (#/programme). Show Steps 1 to 4: Program Profile, Tier Entitlements, Eligible Categories, and Budget Cap.</w:t></w:r></w:p>` },
  { name: 'act1_speech', xml: `<w:p><w:pPr><w:spacing w:before="60" w:after="80"/><w:ind w:left="160"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">CMO: </w:t></w:r><w:r><w:rPr><w:sz w:val="22"/><w:color w:val="1E293B"/></w:rPr><w:t xml:space="preserve">&quot;In partner marketing, fund leakage happens when spending has no rules. In PartnerFlow, if Programme Setup is not complete, zero claims can start—locking in Elite, Gold, Silver, or any custom tiers provided by the company, along with hard budget caps.&quot;</w:t></w:r></w:p>` },
  { name: 'act1_zh', xml: `<w:p><w:pPr><w:spacing w:before="0" w:after="100"/><w:ind w:left="160"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve">中文参考: &quot;在渠道营销中，资金漏洞的根源就是支出缺乏规则。在 PartnerFlow 中，如果项目配置未完成，任何申请绝对无法启动——全面锁定 Elite、Gold、Silver 或公司自定义等级及预算硬上限。&quot;</w:t></w:r></w:p>` }
];

function testXml(content, label) {
  const dir = path.join(__dirname, 'test_part_' + label);
  const docx = path.join(__dirname, 'test_part_' + label + '.docx');

  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'word'), { recursive: true });

  fs.writeFileSync(path.join(dir, '[Content_Types].xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  fs.writeFileSync(path.join(dir, '_rels', '.rels'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  fs.writeFileSync(path.join(dir, 'word', 'document.xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${content}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  if (fs.existsSync(docx)) fs.unlinkSync(docx);
  const ps = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${dir.replace(/'/g, "''")}', '${docx.replace(/'/g, "''")}')`;
  execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'inherit' });

  // Test with Word
  const testPs = `
    $w = New-Object -ComObject Word.Application
    $w.Visible = $false
    $w.DisplayAlerts = 0
    try {
      $d = $w.Documents.Open('${docx.replace(/'/g, "''")}', $false, $true)
      Write-Output "SUCCESS: ${label}"
      $d.Close()
    } catch {
      Write-Output "FAILED: ${label} - $($_.Exception.Message)"
    } finally {
      $w.Quit()
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
    }
  `;
  const psFile = path.join(__dirname, 'test_' + label + '.ps1');
  fs.writeFileSync(psFile, testPs, 'utf8');
  try {
    const res = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { encoding: 'utf8' });
    console.log(res.trim());
  } finally {
    if (fs.existsSync(psFile)) fs.unlinkSync(psFile);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    if (fs.existsSync(docx)) fs.unlinkSync(docx);
  }
}

// Test individual and accumulated
let accum = '';
for (const p of parts) {
  accum += p.xml;
  testXml(accum, 'accum_' + p.name);
}
