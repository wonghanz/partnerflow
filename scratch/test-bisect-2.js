'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function tryOpen(xmlContent, label) {
  const dir = path.join(__dirname, 'test_try2');
  const docx = path.join(__dirname, 'test_try2.docx');

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
    ${xmlContent}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  if (fs.existsSync(docx)) fs.unlinkSync(docx);
  const ps = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${dir}', '${docx}')`;
  execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'inherit' });

  // Test
  fs.writeFileSync(path.join(__dirname, 'test_open2.ps1'), `
    $w = New-Object -ComObject Word.Application
    $w.Visible = $false
    $w.DisplayAlerts = 0
    try {
      $d = $w.Documents.Open('${docx}', $false, $true)
      Write-Output "SUCCESS: ${label}"
      $d.Close()
    } catch {
      Write-Output "FAILED: ${label} - $($_.Exception.Message)"
    } finally {
      $w.Quit()
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
    }
  `);

  const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${path.join(__dirname, 'test_open2.ps1')}"`, { encoding: 'utf8' });
  console.log(out.trim());
}

// Test 5: Speech with Chinese and quotes
tryOpen(`
  <w:p>
    <w:pPr><w:spacing w:before="60" w:after="80"/><w:ind w:left="160"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">CMO: </w:t></w:r>
    <w:r><w:rPr><w:sz w:val="22"/><w:color w:val="1E293B"/></w:rPr><w:t xml:space="preserve">&quot;In partner marketing, fund leakage happens when spending has no rules.&quot;</w:t></w:r>
  </w:p>
`, 'speech_en');

// Test 6: The Table from build-clean-docx.js
tryOpen(`
  <w:tbl>
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
    <w:tblGrid>
      <w:gridCol w:w="1600"/><w:gridCol w:w="2200"/><w:gridCol w:w="2600"/><w:gridCol w:w="3000"/>
    </w:tblGrid>
    <w:tr>
      <w:trPr><w:tblHeader/></w:trPr>
      <w:tc><w:tcPr><w:tcW w:w="1600" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr><w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>Timing</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr><w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>Act</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2600" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr><w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>Key Action</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr><w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>Value</w:t></w:r></w:p></w:tc>
    </w:tr>
    <w:tr>
      <w:tc><w:tcPr><w:tcW w:w="1600" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="30"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr><w:t>0:00 - 0:20</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="30"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr><w:t>ACT I</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2600" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="30"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr><w:t>Steps 1-4</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="30"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr><w:t>Locks tiers</w:t></w:r></w:p></w:tc>
    </w:tr>
  </w:tbl>
`, 'table_with_formatting');
