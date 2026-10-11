const fs = require('fs');
const path = require('path');

async function testDemoUpload() {
  const invoicePdf = fs.readFileSync(path.join(__dirname, '../demo/partner_demo_upload/1_tax_invoice_INV2026_8819.pdf'));
  const paPdf = fs.readFileSync(path.join(__dirname, '../demo/partner_demo_upload/2_pre_approval_approval_letter.pdf'));
  const photosPdf = fs.readFileSync(path.join(__dirname, '../demo/partner_demo_upload/3_event_execution_photos.pdf'));
  const signinPdf = fs.readFileSync(path.join(__dirname, '../demo/partner_demo_upload/4_attendee_signin_verified.pdf'));
  const paymentPdf = fs.readFileSync(path.join(__dirname, '../demo/partner_demo_upload/5_bank_payment_receipt.pdf'));

  const payload = {
    submission_type: 'CLAIM',
    partner_id: 'PTR-ELT-101',
    parent_pre_approval_id: 'SUB-2026-MY-0001',
    title: 'Demo Live Presentation — AI Cloud Acceleration Summit',
    activity_type: 'Partner Summit & Cloud Showcase',
    activity_date: '2026-10-01',
    amount: 12500,
    currency: 'MYR',
    invoice_numbers: ['INV-2026-8819'],
    contact_name: 'Kenneth Wong',
    contact_email: 'kenneth.wong@apexdata.com.sg',
    notes: 'Demo submission containing verified tax invoice, watermarked photos, signed attendee roster, and payment advice slip.',
    attachments: [
      {
        filename: '1_tax_invoice_INV2026_8819.pdf',
        mime: 'application/pdf',
        size_bytes: invoicePdf.length,
        base64: invoicePdf.toString('base64')
      },
      {
        filename: '2_pre_approval_approval_letter.pdf',
        mime: 'application/pdf',
        size_bytes: paPdf.length,
        base64: paPdf.toString('base64')
      },
      {
        filename: '3_event_execution_photos.pdf',
        mime: 'application/pdf',
        size_bytes: photosPdf.length,
        base64: photosPdf.toString('base64')
      },
      {
        filename: '4_attendee_signin_verified.pdf',
        mime: 'application/pdf',
        size_bytes: signinPdf.length,
        base64: signinPdf.toString('base64')
      },
      {
        filename: '5_bank_payment_receipt.pdf',
        mime: 'application/pdf',
        size_bytes: paymentPdf.length,
        base64: paymentPdf.toString('base64')
      }
    ]
  };

  const res = await fetch('http://127.0.0.1:4321/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log('Submission upload response:', {
    ok: data.ok,
    submission_id: data.submission?.submission_id,
    state: data.submission?.state,
    amount_confidence: data.submission?.amount_confidence,
    rules_verdict: data.submission?.rules_result?.verdict,
    all_passed: data.submission?.rules_result?.all_passed,
    rec_action: data.submission?.review_memo?.recommended_action?.options?.[0]?.label
  });

  if (data.submission) {
    // 1. Sign in as executive approver
    const sessRes = await fetch('http://127.0.0.1:4321/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'marcus.tan@umochi.com' })
    });
    const sessData = await sessRes.json();
    console.log('Session login:', { ok: sessData.ok, approver: sessData.approver?.name });

    // 2. Call /approve
    const apprRes = await fetch(`http://127.0.0.1:4321/api/submissions/${data.submission.submission_id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessData.token}`
      },
      body: JSON.stringify({
        approved_amount: 12500,
        reason: 'All 7 AI Agents validated and verified. 100% compliant with UMochi SOP 2026.'
      })
    });
    const apprData = await apprRes.json();
    console.log('1-click decision response:', {
      ok: apprData.ok,
      state: apprData.submission?.state,
      decided_by: apprData.submission?.decided_by,
      approved_amount: apprData.submission?.approved_amount
    });
  }
}

testDemoUpload().catch(console.error);
