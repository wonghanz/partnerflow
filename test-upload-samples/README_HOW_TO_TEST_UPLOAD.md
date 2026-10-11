# Test Upload Sample Files (Ready for Testing)

This folder contains verified, valid mock documents specifically formatted for testing the PartnerFlow ingestion engine and all 7 Brain Intelligence Agents.

## File Inventory:
1. `01_pre_approval_application_form.pdf` - Pre-Approval requisition form (Planned budget: RM 8,500.00)
2. `02_grand_hyatt_kl_tax_invoice.pdf` - Official Tax Invoice #INV-MTS-2026-0922 (RM 8,500.00)
3. `03_event_booth_execution_photos.pdf` - Event photos with watermarked timestamps
4. `04_attendee_signin_sheet.pdf` - Attendee registration roster (60 delegates)
5. `05_bank_transfer_payment_advice.pdf` - Maybank bank payment advice confirmation (RM 8,500.00)

## How to Test in the Browser:
1. Open the PartnerFlow Web Console: **http://127.0.0.1:4321/#/submit**
2. Fill in the submission fields:
   - **Submission Type**: Choose `Claim Reimbursement` or `Pre-Approval`
   - **Partner Tier**: Select `Gold Tier`
   - **Partner**: Select `MegaTech Solutions (M) Sdn Bhd`
   - **Activity Title**: `FY2026 Enterprise AI Tech Day & Showcase`
   - **Programme**: `APAC Co-op Marketing Fund FY26`
   - **Declared Amount**: `8500.00`
3. **Upload Files**:
   - Drag and drop the files from this folder directly into the upload dropzone!
   - You can upload `02_grand_hyatt_kl_tax_invoice.pdf`, `03_event_booth_execution_photos.pdf`, etc.
4. Click **"Run Intelligent Pipeline & Submit"**:
   - Watch the 7 Agents run in sequence:
     - **Gatekeeper & Intake Sanitizer**: Validates PDF SHA-256 integrity and checks for macro threats.
     - **Document Extractor & OCR**: Automatically extracts invoice `INV-MTS-2026-0922` and total `RM 8,500.00`.
     - **Deterministic Policy Engine**: Verifies rules against `rules.json`.
     - **Fraud & Anomaly Sentinel**: Checks duplicate invoices and MyInvois SST registry.
     - **Budget & Ledger Officer**: Reserves four-state ledger balance.
     - **Executive Briefing Desk**: Compiles briefing notes and executive comments.
5. Inspect the new record on **Listing History** (`#/listing`) or SQL database (`partnerflow.db`)!
