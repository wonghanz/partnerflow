'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function testDocx(name, bodyXml) {
  const dir = path.join(__dirname, 'diag_' + name);
  const docx = path.join(__dirname, 'diag_' + name + '.docx');

  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'word'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'word', '_rels'), { recursive: true });

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

  const fullDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  fs.writeFileSync(path.join(dir, 'word', 'document.xml'), fullDoc);

  if (fs.existsSync(docx)) fs.unlinkSync(docx);
  const ps = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${dir}', '${docx}')`;
  execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'inherit' });

  // Test with Word
  try {
    const testPs = `
      $w = New-Object -ComObject Word.Application
      $w.Visible = $false
      $w.DisplayAlerts = 0
      try {
        $d = $w.Documents.Open('${docx}', $false, $true)
        $len = $d.Content.Text.Length
        $d.Close()
        Write-Output "OK: ${name} ($len chars)"
      } catch {
        Write-Output "FAIL: ${name} - $($_.Exception.Message)"
      } finally {
        $w.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
      }
    `;
    const res = execSync(`powershell -NoProfile -Command "${testPs.replace(/\n/g, '; ')}"`, { encoding: 'utf8' });
    console.log(res.trim());
  } catch (err) {
    console.log('Error testing:', err.message);
  }
}

// Test 1: Simple text with Chinese
testDocx('text_zh', '<w:p><w:r><w:t>Hello World - 中文测试</w:t></w:r></w:p>');

// Test 2: Table
testDocx('table_test', `<w:tbl>
  <w:tblPr><w:tblW w:w="5000" w:type="dxa"/></w:tblPr>
  <w:tblGrid><w:gridCol w:w="2500"/><w:gridCol w:w="2500"/></w:tblGrid>
  <w:tr>
    <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Col1</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Col2</w:t></w:r></w:p></w:tc>
  </w:tr>
</w:tbl>`);
