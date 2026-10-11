'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function tryOpen(xmlContent, label) {
  const dir = path.join(__dirname, 'test_try');
  const docx = path.join(__dirname, 'test_try.docx');

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
  fs.writeFileSync(path.join(__dirname, 'test_open.ps1'), `
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

  const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${path.join(__dirname, 'test_open.ps1')}"`, { encoding: 'utf8' });
  console.log(out.trim());
}

// 1. Just paragraphs
tryOpen(`
  <w:p><w:r><w:t>Title Paragraph</w:t></w:r></w:p>
  <w:p><w:r><w:t>Second Paragraph with English text</w:t></w:r></w:p>
`, 'two_p');

// 2. Paragraph with rPr (font size, color, bold)
tryOpen(`
  <w:p><w:r><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="0F172A"/></w:rPr><w:t>Title</w:t></w:r></w:p>
`, 'p_with_rPr');

// 3. Paragraph with pPr spacing
tryOpen(`
  <w:p><w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr><w:r><w:t>Spacing</w:t></w:r></w:p>
`, 'p_with_spacing');

// 4. Shading
tryOpen(`
  <w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:pPr><w:r><w:t>Shaded</w:t></w:r></w:p>
`, 'p_with_shd');
