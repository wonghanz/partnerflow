'use strict';
const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..', 'test-upload-samples');
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function makePdf(textLines) {
  const content = textLines.map((line, i) => {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    return i === 0
      ? `BT /F1 12 Tf 50 750 Td (${escaped}) Tj`
      : `T* (${escaped}) Tj`;
  }).join('\n') + '\nET';

  const streamLength = Buffer.byteLength(content, 'utf8');

  return `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${content}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000262 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${350 + streamLength}
%%EOF
`;
}

// 1. Pre-Approval Application Form
const paText = [
  'PRE-APPROVAL APPLICATION FORM',
  'Document Type: PRE_APPROVAL_FORM',
  'Applicant Partner: MegaTech Solutions (M) Sdn Bhd',
  'Partner ID: PTR-GLD-882 (Gold Tier)',
  'Programme: APAC Co-op Marketing Fund FY26',
  'Activity Title: FY2026 Enterprise AI Tech Day & Showcase',
  'Activity Date: 2026-11-15',
  'Activity Location: Grand Hyatt Kuala Lumpur',
  'Itemized Budget Request:',
  '1. Venue & Ballroom Rental: RM 4,500.00',
  '2. Staging, AV & Live Stream: RM 2,500.00',
  '3. Marketing Collateral & Badges: RM 1,500.00',
  'Total Planned Spend: RM 8,500.00',
  'Requested Co-op Subsidy (50% match): RM 4,250.00',
  'Authorized Representative: Lim Kar Seng (Managing Director)'
];
fs.writeFileSync(path.join(TARGET_DIR, '01_pre_approval_application_form.pdf'), makePdf(paText));

// 2. Official SST Tax Invoice
const invText = [
  'TAX INVOICE',
  'Document Type: TAX_INVOICE',
  'Supplier: Grand Hyatt Venue Services Sdn Bhd',
  'SST Registration No: W10-1808-32000018',
  'Invoice No: INV-MTS-2026-0922',
  'Date: 2026-11-16',
  'Billed To: MegaTech Solutions (M) Sdn Bhd',
  'Description of Supply:',
  '- Enterprise Grand Ballroom Hire (Full Day): RM 4,500.00',
  '- Professional Stage & Lighting Services: RM 2,500.00',
  '- Delegate Tea Break Catering & AV Facilities: RM 1,500.00',
  'Subtotal (before SST): RM 8,500.00',
  'Total Amount Due: RM 8,500.00',
  'Payment Status: PAID IN FULL'
];
fs.writeFileSync(path.join(TARGET_DIR, '02_grand_hyatt_kl_tax_invoice.pdf'), makePdf(invText));

// 3. Event Photos Report
const photoText = [
  'EVENT EXECUTION PHOTO REPORT',
  'Document Type: EVENT_PHOTOS',
  'Activity: FY2026 Enterprise AI Tech Day & Showcase',
  'Date of Event: 2026-11-15',
  'Venue: Grand Hyatt Kuala Lumpur',
  'Watermark Timestamp: 2026-11-15 10:14:22 MYT',
  'Photo 1: UMochi Cloud Pioneer backdrop banner at registration counter',
  'Photo 2: Plenary keynote hall with 60 enterprise attendees seated',
  'Photo 3: Sponsor exhibition booth featuring joint co-branding lockup',
  'Photo 4: Hands-on technology demonstration session'
];
fs.writeFileSync(path.join(TARGET_DIR, '03_event_booth_execution_photos.pdf'), makePdf(photoText));

// 4. Attendee Sign-in Sheet
const signinText = [
  'ATTENDEE REGISTRATION & SIGN-IN SHEET',
  'Document Type: ATTENDEE_SIGNIN',
  'Event: FY2026 Enterprise AI Tech Day & Showcase',
  'Date: 2026-11-15 | Venue: Grand Hyatt Ballroom',
  'Delegate 1: Tan Sri Azman (Petronas) - Signature Verified',
  'Delegate 2: David Lim (Maybank Digital) - Signature Verified',
  'Delegate 3: Sarah Teoh (CIMB FinTech) - Signature Verified',
  'Delegate 4: Michelle Wong (Axiata Group) - Signature Verified',
  'Total Verified Attendees: 60 Delegates',
  'Event Organizer Sign-off: Lim Kar Seng'
];
fs.writeFileSync(path.join(TARGET_DIR, '04_attendee_signin_sheet.pdf'), makePdf(signinText));

// 5. Proof of Payment Bank Advice
const payText = [
  'BANK PAYMENT CONFIRMATION ADVICE',
  'Document Type: PROOF_OF_PAYMENT',
  'Bank: Maybank Islamic Berhad',
  'Reference No: MBB-PAY-2026-881920',
  'Transaction Date: 2026-11-18',
  'Debit Account: 8881-XXXX-4471 (MegaTech Solutions Sdn Bhd)',
  'Beneficiary: Grand Hyatt Venue Services Sdn Bhd',
  'Invoice Reference: INV-MTS-2026-0922',
  'Remitted Amount: RM 8,500.00',
  'Transfer Status: SUCCESSFUL / CLEARED'
];
fs.writeFileSync(path.join(TARGET_DIR, '05_bank_transfer_payment_advice.pdf'), makePdf(payText));

// 6. User Guide
const readmeContent = `# Test Upload Sample Files (Ready for Testing)

This folder contains verified, valid mock documents specifically formatted for testing the PartnerFlow ingestion engine and all 7 Brain Intelligence Agents.

## File Inventory:
1. \`01_pre_approval_application_form.pdf\` - Pre-Approval requisition form (Planned budget: RM 8,500.00)
2. \`02_grand_hyatt_kl_tax_invoice.pdf\` - Official Tax Invoice #INV-MTS-2026-0922 (RM 8,500.00)
3. \`03_event_booth_execution_photos.pdf\` - Event photos with watermarked timestamps
4. \`04_attendee_signin_sheet.pdf\` - Attendee registration roster (60 delegates)
5. \`05_bank_transfer_payment_advice.pdf\` - Maybank bank payment advice confirmation (RM 8,500.00)

## How to Test in the Browser:
1. Open the PartnerFlow Web Console: **http://127.0.0.1:4321/#/submit**
2. Fill in the submission fields:
   - **Submission Type**: Choose \`Claim Reimbursement\` or \`Pre-Approval\`
   - **Partner Tier**: Select \`Gold Tier\`
   - **Partner**: Select \`MegaTech Solutions (M) Sdn Bhd\`
   - **Activity Title**: \`FY2026 Enterprise AI Tech Day & Showcase\`
   - **Programme**: \`APAC Co-op Marketing Fund FY26\`
   - **Declared Amount**: \`8500.00\`
3. **Upload Files**:
   - Drag and drop the files from this folder directly into the upload dropzone!
   - You can upload \`02_grand_hyatt_kl_tax_invoice.pdf\`, \`03_event_booth_execution_photos.pdf\`, etc.
4. Click **"Run Intelligent Pipeline & Submit"**:
   - Watch the 7 Agents run in sequence:
     - **Gatekeeper & Intake Sanitizer**: Validates PDF SHA-256 integrity and checks for macro threats.
     - **Document Extractor & OCR**: Automatically extracts invoice \`INV-MTS-2026-0922\` and total \`RM 8,500.00\`.
     - **Deterministic Policy Engine**: Verifies rules against \`rules.json\`.
     - **Fraud & Anomaly Sentinel**: Checks duplicate invoices and MyInvois SST registry.
     - **Budget & Ledger Officer**: Reserves four-state ledger balance.
     - **Executive Briefing Desk**: Compiles briefing notes and executive comments.
5. Inspect the new record on **Listing History** (\`#/listing\`) or SQL database (\`partnerflow.db\`)!
`;
fs.writeFileSync(path.join(TARGET_DIR, 'README_HOW_TO_TEST_UPLOAD.md'), readmeContent, 'utf8');

console.log('Successfully created test-upload-samples folder and 5 sample PDF documents.');
