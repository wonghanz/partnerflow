'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEST_DIR = path.join(__dirname, 'valid_docx_test');
const TEST_DOCX = path.join(__dirname, 'test_validated.docx');

if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DIR, { recursive: true });
fs.mkdirSync(path.join(TEST_DIR, '_rels'), { recursive: true });
fs.mkdirSync(path.join(TEST_DIR, 'word'), { recursive: true });
fs.mkdirSync(path.join(TEST_DIR, 'word', '_rels'), { recursive: true });

// 1. [Content_Types].xml
const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
fs.writeFileSync(path.join(TEST_DIR, '[Content_Types].xml'), contentTypes);

// 2. _rels/.rels
const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
fs.writeFileSync(path.join(TEST_DIR, '_rels', '.rels'), rels);

// 3. word/_rels/document.xml.rels
const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
fs.writeFileSync(path.join(TEST_DIR, 'word', '_rels', 'document.xml.rels'), docRels);

// 4. word/styles.xml
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="22"/>
        <w:color w:val="1E293B"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
</w:styles>`;
fs.writeFileSync(path.join(TEST_DIR, 'word', 'styles.xml'), styles);

// 5. word/document.xml
const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="0F172A"/></w:rPr>
        <w:t>PartnerFlow AI — CMO Executive Demo Script</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr>
        <w:t>Test sentence in body.</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
fs.writeFileSync(path.join(TEST_DIR, 'word', 'document.xml'), doc);

if (fs.existsSync(TEST_DOCX)) fs.unlinkSync(TEST_DOCX);

const psScriptPath = path.join(__dirname, 'zip_test.ps1');
const psScriptContent = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$src = '${TEST_DIR.replace(/'/g, "''")}'
$dst = '${TEST_DOCX.replace(/'/g, "''")}'
[System.IO.Compression.ZipFile]::CreateFromDirectory($src, $dst)
`;
fs.writeFileSync(psScriptPath, psScriptContent, 'utf8');
execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'inherit' });
if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);

console.log('Created test docx:', TEST_DOCX);
