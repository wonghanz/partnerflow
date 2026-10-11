'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const docx = path.join(__dirname, '..', 'CMO_Demo_Script_PartnerFlow.docx');
const outDir = path.join(__dirname, 'unzipped_cmo');

if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });

execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${docx.replace(/'/g, "''")}', '${outDir.replace(/'/g, "''")}')"`, { stdio: 'inherit' });

const docXml = fs.readFileSync(path.join(outDir, 'word', 'document.xml'), 'utf8');
console.log('document.xml length:', docXml.length);
fs.writeFileSync(path.join(__dirname, 'extracted_doc.xml'), docXml, 'utf8');
console.log('Saved extracted_doc.xml');
