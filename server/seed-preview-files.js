'use strict';
/**
 * Seed real PDF documents for all sample submissions and sync to store & SQLite.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./lib/store');
const db = require('./lib/db');

const UPLOAD_DIR = store.UPLOAD_DIR;
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function escapePdfText(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdfBuffer(title, subtitle, lines = []) {
  let content = 'BT\n';
  content += '/F2 16 Tf\n50 740 Td\n(' + escapePdfText(title) + ') Tj\n';
  if (subtitle) {
    content += '/F1 11 Tf\n0 -22 Td\n(' + escapePdfText(subtitle) + ') Tj\n';
  }
  content += '/F1 10 Tf\n0 -20 Td\n';
  content += '(--------------------------------------------------------------------------------) Tj\n';

  let currentY = -18;
  for (const line of lines) {
    content += '0 ' + currentY + ' Td\n(' + escapePdfText(line) + ') Tj\n';
    currentY = -16;
  }
  content += 'ET\n';

  const streamBuf = Buffer.from(content, 'latin1');
  const streamLen = streamBuf.length;

  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<<\n  /Type /Page\n  /Parent 2 0 R\n  /MediaBox [0 0 612 792]\n  /Contents 4 0 R\n  /Resources <<\n    /Font <<\n      /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n      /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\n    >>\n  >>\n>>\nendobj\n'
  );
  objects.push(
    '4 0 obj\n<< /Length ' + streamLen + ' >>\nstream\n' + content + 'endstream\nendobj\n'
  );

  let pdfStr = '%PDF-1.4\n';
  const offsets = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdfStr, 'latin1'));
    pdfStr += objects[i];
  }

  const startXref = Buffer.byteLength(pdfStr, 'latin1');
  pdfStr += 'xref\n0 ' + (objects.length + 1) + '\n';
  pdfStr += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdfStr += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdfStr += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  pdfStr += 'startxref\n' + startXref + '\n%%EOF\n';

  return Buffer.from(pdfStr, 'latin1');
}

const SAMPLE_DOCS = {
  'doc_999128ee': {
    stored: 'doc_999128ee-quarantine-tax-invoice-tampered.pdf',
    title: 'TAX INVOICE INV-DUP-2026-9901',
    subtitle: 'Cyberjaya Exhibition Pavilion - Venue Staging',
    lines: [
      'Supplier: Cyberjaya Exhibition Pavilion Sdn Bhd',
      'SST Registration No: W10-9999-00000000 (FLAGGED: UNREGISTERED / INVALID)',
      'Billed to: InnoSoft Regional Distribution Ltd (Partner ID: PTR-REG-305)',
      'Invoice Number: INV-DUP-2026-9901',
      'Invoice Date: 2026-09-10',
      'Item 1: Virtualization Showcase Main Exhibition Hall - RM 16,000.00',
      'Item 2: High-Density Rack Power Staging & AV Displays - RM 8,000.00',
      'Total Amount Payable: RM 24,000.00',
      '--------------------------------------------------------------------------------',
      '[AGENT 5 SECURITY SENTINEL AUDIT REPORT]',
      'THREAT LEVEL: CRITICAL (Tampering Flagged)',
      '1. DUPLICATE INVOICE: Number INV-DUP-2026-9901 previously claimed under PTR-GLD-882.',
      '2. TIMESTAMP TAMPERING: PDF XMP creation timestamp does not match filesystem metadata.',
      '3. SECURITY ACTION: Automatic quarantine applied. Pipeline halted (Iron Invariant 5).'
    ]
  },
  'doc_8172da10': {
    stored: 'doc_8172da10-tax-invoice-mandarin-oriental-summit.pdf',
    title: 'TAX INVOICE INV-APX-2026-0914',
    subtitle: 'Mandarin Oriental Hotel Kuala Lumpur',
    lines: [
      'Supplier: Mandarin Oriental Hotel Kuala Lumpur',
      'SST Registration No: W10-1808-32000018 (Verified via MyInvois)',
      'Billed to: Apex Data Systems Pte Ltd (Partner ID: PTR-ELT-101)',
      'Invoice Number: INV-APX-2026-0914',
      'Invoice Date: 2026-09-15',
      'Pre-Approval Reference: SUB-2026-MY-0001',
      'Programme: Cloud Pioneer MDF Initiative',
      'Item 1: Grand Ballroom Staging, Backdrop & High-Def LED Wall - RM 11,250.00',
      'Item 2: Interactive Live Demo Lab Workstations & AV Cabling - RM 4,500.00',
      'Item 3: Executive Buffet Luncheon for 85 Enterprise Attendees - RM 3,000.00',
      'Total Payable: RM 18,750.00 (Inclusive of 8% SST RM 1,388.89)',
      'Payment Status: Fully Paid via Swift Remittance MT103'
    ]
  },
  'doc_5518bca2': {
    stored: 'doc_5518bca2-event-photos-summit-watermarked.pdf',
    title: 'EVENT EXECUTION PHOTOS & SIGNAGE LOG',
    subtitle: 'APAC Cybersecurity Partner Summit 2026',
    lines: [
      'Partner Name: Apex Data Systems Pte Ltd (PTR-ELT-101)',
      'Venue: Mandarin Oriental Hotel Kuala Lumpur',
      'Date of Execution: 2026-09-15',
      'Photo Record 1: Ballroom Foyer - UMochi Cloud Pioneer co-branded banners verified.',
      'Photo Record 2: Registration Reception Counter with attendee badge distribution.',
      'Photo Record 3: Keynote Hall - Executive speech on Zero-Trust Cloud Architecture.',
      'Photo Record 4: Hands-on Technical Demo Pods with live enterprise demonstrations.',
      'Photo Record 5: Group session photograph with enterprise CIO and CTO delegates.',
      'GPS & Watermark: Verified on-site coordinates (3.1553N, 101.7144E).'
    ]
  },
  'doc_319208fa': {
    stored: 'doc_319208fa-attendee-signin-roster-verified.pdf',
    title: 'ATTENDEE REGISTRATION & SIGN-IN SHEET',
    subtitle: 'APAC Cybersecurity Partner Summit 2026',
    lines: [
      'Date: 2026-09-15 | Venue: Mandarin Oriental Kuala Lumpur',
      'Total Verified Attendees: 85 Enterprise Representatives',
      'Sample Verified Attendees (5 of 85 listed):',
      '1. Dato\' Azman Harun (Maybank Technology) - azman.h@maybank.com.my [Signed]',
      '2. Karen Tan (Petronas Digital) - karen.tan@petronas.com [Signed]',
      '3. Chong Wei Lun (RHB Bank ICT) - wlchong@rhbgroup.com [Signed]',
      '4. Sanjay Kumar (Axiata Group) - sanjay.k@axiata.com [Signed]',
      '5. Rachel Wong (Tenaga Nasional) - rachel.wong@tnb.com.my [Signed]',
      'Verification: Signatures and corporate email domains verified by event staff.'
    ]
  },
  'doc_991823ac': {
    stored: 'doc_991823ac-bank-payment-clearing-advice.pdf',
    title: 'BANK PAYMENT REMITTANCE CONFIRMATION',
    subtitle: 'DBS Bank Singapore - Swift MT103 Clearing Advice',
    lines: [
      'Remitting Account: Apex Data Systems Pte Ltd (DBS Bank Singapore)',
      'Beneficiary Name: Mandarin Oriental Hotel Kuala Lumpur',
      'Beneficiary Bank: Malayan Banking Berhad (MBBEMYKL)',
      'Remitted Amount: RM 18,750.00 (MYR)',
      'Payment Reference: APX-MO-SUMMIT-20260915',
      'Value Date: 2026-09-20',
      'Swift UETR: e912a841-9982-4112-b881-229109481928',
      'Remittance Status: CLEARED / SETTLED'
    ]
  },
  'doc_97932cff': {
    stored: 'doc_97932cff-pa-form-2026-q3-kl-launch.pdf',
    title: 'PRE-APPROVAL APPLICATION REQUISITION FORM',
    subtitle: 'FY2026 Q3 Enterprise Cloud Launch Event',
    lines: [
      'Applicant: MegaTech Solutions (M) Sdn Bhd (Partner ID: PTR-GLD-882)',
      'Partner Tier: Gold Tier (Co-op Reimbursement Ratio: 50%)',
      'Activity: Flagship Enterprise Cloud Launch Event in Kuala Lumpur',
      'Planned Activity Date: 2026-08-20',
      'Programme: APAC Co-op Marketing Fund FY26',
      'Planned Budget Breakdown:',
      '- Grand Hyatt Kuala Lumpur Venue Hire: RM 4,200.00',
      '- High-Resolution LED AV Staging & Lighting: RM 3,100.00',
      '- Keynote Speaker Honorarium & Marketing Collateral: RM 2,700.00',
      'Total Pre-Approval Requested: RM 10,000.00',
      'Applicant Signatory: Lim Kar Seng (Director of Cloud Business)'
    ]
  },
  'doc_932252d8': {
    stored: 'doc_932252d8-vendor-quotation-kl-launch-venue.pdf',
    title: 'VENDOR QUOTATION REF QTN-4471',
    subtitle: 'Grand Hyatt Kuala Lumpur Venue Services',
    lines: [
      'Supplier: Grand Hyatt Kuala Lumpur Venue Services',
      'Quotation Issued To: MegaTech Solutions (M) Sdn Bhd',
      'Date of Quotation: 2026-07-25',
      'Scope of Deliverables:',
      '1. Grand Ballroom Half-Day Session Rental - RM 4,200.00',
      '2. High-Definition LED Wall, Sound Rigging & Microphones - RM 3,100.00',
      'Subtotal Quotation Amount: RM 7,300.00',
      'Validity Period: 60 Days from issuance date',
      'Payment Terms: 30% deposit upon pre-approval confirmation'
    ]
  },
  'doc_42eb8632': {
    stored: 'doc_42eb8632-programme-agenda-kl-launch.pdf',
    title: 'OFFICIAL PROGRAMME AGENDA & RUN SHEET',
    subtitle: 'FY2026 Q3 Enterprise Cloud Launch Event',
    lines: [
      'Date: 2026-08-20 | Location: Grand Hyatt Kuala Lumpur',
      'Event Run Sheet:',
      '09:00 - 09:30 : Attendee Registration & Welcome Coffee',
      '09:30 - 10:30 : Opening Keynote: Sovereign Hybrid Cloud in Asia-Pacific',
      '10:30 - 12:00 : Architecture Deep-Dive: Enterprise Migration Strategies',
      '12:00 - 14:00 : Executive Luncheon & Solution Partner Networking',
      '14:00 - 16:00 : Technical Breakout Sessions & Hands-on Deployment Demos',
      '16:00 - 16:30 : Closing Remarks & Wrap-Up'
    ]
  },
  'doc_c3f9edb7': {
    stored: 'doc_c3f9edb7-tax-invoice-proforma-mts-2026-0588.pdf',
    title: 'PRO-FORMA TAX INVOICE INV-MTS-2026-0588',
    subtitle: 'Grand Hyatt Kuala Lumpur Venue Services',
    lines: [
      'Supplier: Grand Hyatt Kuala Lumpur Venue Services',
      'SST Registration No: W10-1808-11223344',
      'Billed to: MegaTech Solutions (M) Sdn Bhd',
      'Invoice Date: 2026-07-28',
      'Invoice Number: INV-MTS-2026-0588',
      'Description:',
      'Item 1: Venue Ballroom Half-Day & AV Rigging - RM 7,300.00',
      'Item 2: Executive Lunch Package & Coffee Breaks - RM 2,700.00',
      'Total Amount: RM 10,000.00',
      'Terms: Pro-forma invoice issued for pre-approval requisition filing'
    ]
  },
  'doc_412093da': {
    stored: 'doc_412093da-agency-invoice-nexa-digital.pdf',
    title: 'TAX INVOICE INV-NXD-2026-0312',
    subtitle: 'NEXA Digital Media Lead Generation Campaign',
    lines: [
      'Agency: NEXA Digital Media Sdn Bhd',
      'Billed to: NEXA Digital Enterprise Sdn Bhd (PTR-SLV-456)',
      'Invoice Number: INV-NXD-2026-0312',
      'Invoice Date: 2026-08-30',
      'Activity: B2B LinkedIn Ads & Google Search Ads targeting manufacturing CIOs',
      'Total Invoice Amount: RM 6,400.00',
      'Agent 2 Grill-Me Note: Awaiting LinkedIn Campaign Manager export for impressions.'
    ]
  },
  'doc_789123aa': {
    stored: 'doc_789123aa-resort-gala-invoice.pdf',
    title: 'TAX INVOICE INV-VNT-2026-0810',
    subtitle: 'The Datai Private Resort & Hospitality',
    lines: [
      'Supplier: The Datai Private Resort & Hospitality',
      'Billed to: Vanguard Network Technologies Sdn Bhd (PTR-SLV-902)',
      'Invoice Number: INV-VNT-2026-0810',
      'Invoice Date: 2026-09-02',
      'Activity: Annual Distributor Appreciation Banquet',
      'Item 1: Private Banquet Hall Rental - RM 15,000.00',
      'Item 2: Premium Alcoholic Beverages & Wine Bar - RM 12,000.00',
      'Item 3: Executive Entertainment & Live Band - RM 8,000.00',
      'Total Amount: RM 35,000.00',
      'POLICY BLOCK: Alcohol and entertainment strictly excluded under Policy Section 3.2.'
    ]
  }
};

console.log('--- Generating sample PDFs in uploads/ ---');
for (const [docId, spec] of Object.entries(SAMPLE_DOCS)) {
  const filePath = path.join(UPLOAD_DIR, spec.stored);
  const pdfBuf = buildPdfBuffer(spec.title, spec.subtitle, spec.lines);
  fs.writeFileSync(filePath, pdfBuf);
  console.log(`Generated: ${spec.stored} (${pdfBuf.length} bytes)`);
}

console.log('--- Updating submissions.json ---');
const submissions = store.read('submissions.json');

for (const sub of submissions) {
  // Update SUB-2026-MY-0002 to APPROVED as requested by user
  if (sub.submission_id === 'SUB-2026-MY-0002') {
    sub.state = 'APPROVED';
    sub.approved_amount = 18750;
    sub.ui_status = 'approved';
    sub.decided_by = 'marcus.tan@umochi.com';
    sub.decided_at = '2026-10-11T10:30:00Z';
    sub.decision_reason = 'Full reimbursement approved by VP Channel Operations & Finance. All 5 proof documents verified against MyInvois and hotel registry.';
    sub.owner = 'Awaiting finance disbursement';
    if (!sub.agent_evaluations) sub.agent_evaluations = {};
    sub.agent_evaluations.executive_summary = {
      recommendation: 'APPROVED',
      authority_tier: 'Director Level (High Value Claim > RM 15,000)',
      human_decision: 'APPROVED',
      approved_by: "Dato' Sri Marcus Tan (VP Global Channel Operations & Finance)",
      approved_at: '2026-10-11T10:30:00Z',
      reason: 'All 7 agent evaluations passed with 98% composite confidence. Verification of SST registration and venue proof of execution fully satisfied.'
    };
    if (sub.review_memo) {
      sub.review_memo.recommended_action = {
        action: 'APPROVE',
        headline: 'Full reimbursement approved (RM 18,750.00)',
        authority: 'Director Level',
        rationale: 'All mandatory documents verified, MyInvois SST valid, budget ledger available.'
      };
    }
  }

  // Populate extracted_evidence with real stored and text_preview
  if (Array.isArray(sub.extracted_evidence)) {
    for (const ev of sub.extracted_evidence) {
      const spec = SAMPLE_DOCS[ev.doc_id];
      if (spec) {
        ev.stored = spec.stored;
        ev.mime = 'application/pdf';
        ev.size_bytes = fs.statSync(path.join(UPLOAD_DIR, spec.stored)).size;
        ev.text_preview = `${spec.title}\n${spec.subtitle}\n${spec.lines.join('\n')}`;
      }
    }
  }
}

store.write('submissions.json', submissions);
console.log('Updated submissions.json successfully.');

console.log('--- Updating ledger.json & comments.json ---');
const ledger = store.read('ledger.json');
if (ledger && ledger.company_totals) {
  ledger.company_totals.approved = 437650;
  ledger.company_totals.committed = 2344950;
  if (Array.isArray(ledger.rows)) {
    const row = ledger.rows.find((r) => r.partner_id === 'PTR-ELT-101');
    if (row) {
      row.approved_amount = 148750;
      row.committed_amount = 761250;
      row.updated_at = new Date().toISOString();
    }
  }
  store.write('ledger.json', ledger);
  console.log('Updated ledger.json successfully.');
}

const comments = store.read('comments.json');
const exists = comments.find((c) => c.submission_id === 'SUB-2026-MY-0002' && c.comment_id === 'cmt_appr_002');
if (!exists) {
  comments.push({
    comment_id: 'cmt_appr_002',
    submission_id: 'SUB-2026-MY-0002',
    author: 'Agent 7: Executive Briefing AI (Boss Skill)',
    role: 'EXECUTIVE_AGENT',
    is_agent: true,
    badge: 'BOSS SKILL',
    text: 'FINAL APPROVAL GRANTED: Co-op claim RM 18,750.00 approved for Apex Data Systems Pte Ltd. All 5 supporting documents verified against MyInvois registry. Budget ledger updated under Cloud Pioneer MDF Initiative.',
    created_at: '2026-10-11T10:30:00Z'
  });
  store.write('comments.json', comments);
  console.log('Added approval comment to comments.json.');
}

console.log('--- Syncing to SQLite ---');
db.syncFromJson();
console.log('Saved submissions to SQLite database via db.syncFromJson().');

const counts = db.query('SELECT state, COUNT(*) as count FROM submissions GROUP BY state');
console.log('Current SQLite Submissions Summary:');
console.table(counts);

console.log('--- Setup preview files complete! ---');
