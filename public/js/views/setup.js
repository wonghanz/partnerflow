/* Programme Setup — Enterprise Admin Console & 4-Step Document Setup Wizard (docs/10 & docs/web.md §4). */

import { api } from '../api.js';
import {
  h, icon, toast, modal, closeModal, badge
} from '../dom.js';

let currentStep = 1; // 1: UPLOAD, 2: REVIEW, 3: RESOLVE, 4: CONFIRM & ANALYZE
let selectedPathway = 'A'; // 'A' | 'B' | 'C'

const MANIFEST_DOCS = [
  { id: '01', filename: '01-pre-approval-form.pdf', cat: 'Forms & templates', required: true, status: 'ready', pages: 3, size: '1.2 MB', desc: 'Pre-approval application form structure and schema', rulesFound: 6 },
  { id: '02', filename: '02-claim-disbursement-form.pdf', cat: 'Forms & templates', required: true, status: 'ready', pages: 4, size: '1.8 MB', desc: 'Claim and disbursement request form', rulesFound: 8 },
  { id: '03', filename: '03-programme-policy-and-sop.pdf', cat: 'Policies & SOPs', required: true, status: 'ready', pages: 24, size: '5.2 MB', desc: 'Official subsidy programme policy manual and operational SOP', rulesFound: 14 },
  { id: '04', filename: '04-partner-master-and-budget-tracker.xlsx', cat: 'Partner & budget records', required: true, status: 'attention', pages: 8, size: '2.1 MB', desc: 'Partner roster and historical budget tracking master spreadsheet', note: 'Formula contains unexpanded external references; verify commitment allocation.' },
  { id: '05', filename: '05-historical-cases/', cat: 'Historical cases & reports', required: false, status: 'ready', pages: 12, size: '3.4 MB', desc: 'Historical benchmark case repository (Standard, Missing docs, Amount mismatch, Over-budget, Exception)', rulesFound: 5 },
  { id: '06', filename: '06-current-workflow-and-roles.pdf', cat: 'Historical cases & reports', required: false, status: 'ready', pages: 6, size: '1.5 MB', desc: 'Current role workflow and turnaround SLA specifications', rulesFound: 3 },
  { id: '07', filename: '07-supporting-document-checklist.pdf', cat: 'Policies & SOPs', required: true, status: 'ready', pages: 5, size: '1.1 MB', desc: 'Mandatory supporting document checklist specification', rulesFound: 18 },
  { id: '08', filename: '08-existing-report-templates.pdf', cat: 'Historical cases & reports', required: false, status: 'ready', pages: 4, size: '890 KB', desc: 'Operational and financial Excel reporting templates', rulesFound: 4 },
  { id: '09', filename: '09-email-follow-up-examples.pdf', cat: 'Historical cases & reports', required: false, status: 'ready', pages: 3, size: '640 KB', desc: 'Follow-up notifications and clarification email templates', rulesFound: 2 },
  { id: '10', filename: '10-approval-authority-matrix.pdf', cat: 'Policies & SOPs', required: true, status: 'ready', pages: 2, size: '480 KB', desc: 'Internal delegation of authority (DOA) approval limit matrix', rulesFound: 4 }
];

export async function render() {
  const wrap = h('div', { class: 'stack' });

  const progressHeader = h('section', { class: 'card' });
  const stepContent = h('div', { class: 'stack' });

  wrap.append(
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', { class: 'page-title' }, h('span', { class: 'grad' }, 'Programme Setup')),
        h('p', { class: 'page-sub' },
          'Enterprise Guided Setup Wizard: Ingest business documents, compile deterministic policy rules, resolve ambiguities, and launch pipeline analysis.')),
      h('div', { class: 'page-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => saveLater() }, icon('save', 15), 'Save & Return'),
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => load() }, icon('refresh', 15), 'Reset'))),
    progressHeader,
    stepContent
  );

  let wizardState = {};

  async function load() {
    try {
      const res = await api.setup();
      wizardState = res.wizard || {};
      if (wizardState.step) currentStep = Number(wizardState.step);
      if (wizardState.pathway) selectedPathway = wizardState.pathway;
      paint();
    } catch {
      paint();
    }
  }

  function paint() {
    renderProgressHeader(progressHeader, () => {
      paint();
    });

    const steps = {
      1: () => renderStep1Upload(stepContent, () => { currentStep = 2; paint(); }),
      2: () => renderStep2Review(stepContent, () => { currentStep = 3; paint(); }, () => { currentStep = 1; paint(); }),
      3: () => renderStep3Resolve(stepContent, () => { currentStep = 4; paint(); }, () => { currentStep = 2; paint(); }),
      4: () => renderStep4Confirm(stepContent, () => { currentStep = 3; paint(); }, (st) => { currentStep = st; paint(); })
    };
    stepContent.replaceChildren(steps[currentStep]());
  }

  async function saveLater() {
    try {
      await api.saveSetup({ step: currentStep, pathway: selectedPathway, saved_at: new Date().toISOString() });
      toast('Setup progress saved successfully.', 'ok');
    } catch (e) {
      toast(String(e.message || e), 'err');
    }
  }

  await load();
  return wrap;
}

/* ---------- Header: Progress & Stepper ---------- */

function renderProgressHeader(host, onStepClick) {
  const stepTitles = [
    { num: 1, name: '01 UPLOAD', desc: 'Upload & Auto-Classification' },
    { num: 2, name: '02 REVIEW', desc: 'Review Extracted Rules' },
    { num: 3, name: '03 RESOLVE', desc: 'Resolve Ambiguities & Conflicts' },
    { num: 4, name: '04 CONFIRM & ANALYZE', desc: 'Confirm & Launch Analysis' }
  ];

  const completedCount = currentStep > 3 ? 5 : currentStep === 3 ? 3 : currentStep === 2 ? 2 : 1;
  const progressPct = Math.round((completedCount / 5) * 100);

  host.replaceChildren(
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, `STEP ${currentStep} OF 4 · ${stepTitles[currentStep - 1].name}`),
        h('div', { class: 'sub' }, `Setup progress: ${completedCount} of 5 sections completed · You can save and return later (GOV.UK Task-List Pattern)`)),
      badge(`Progress ${progressPct}%`, progressPct >= 80 ? 'ok' : 'info')),
    h('div', { class: 'card-body' },
      h('div', { class: 'progress', style: { height: '8px', marginBottom: '16px' } },
        h('span', { style: { width: `${progressPct}%` } })),
      h('ol', { class: 'steps' }, stepTitles.map((st) => {
        const isDone = st.num < currentStep;
        const isCurrent = st.num === currentStep;
        return h('li', {
          class: `step ${isDone ? 'done' : isCurrent ? 'current' : ''}`,
          style: { cursor: 'pointer' },
          onClick: () => { currentStep = st.num; onStepClick(); }
        },
          h('span', { class: 'sn' }, isDone ? icon('check', 13) : String(st.num)),
          h('div', { class: 'st' },
            h('b', {}, st.name),
            h('i', {}, st.desc))
        );
      }))
    )
  );
}

/* ---------- Step 1: Upload & Auto-Categorization ---------- */

function renderStep1Upload(host, onNext) {
  const wrap = h('div', { class: 'stack' });

  // Onboarding Pathways A/B/C
  const pathways = [
    { id: 'A', title: 'Pathway A: Existing Policy Documents', act: '[ 📂 Upload & Extract Candidate Rules ]', fit: 'Ideal for teams with established SOPs, Excel sheets, and form templates. Auto-extracts rules with clause citations.' },
    { id: 'B', title: 'Pathway B: Known Rules Not Formatted', act: '[ 🧭 Guided Step-by-Step Questionnaire ]', fit: 'For teams with institutional knowledge in staff minds. Answers plain-English prompts regarding tiers, windows, and checklists.' },
    { id: 'C', title: 'Pathway C: Policy Evolving in Flight', act: '[ 🚀 Dynamic Accumulation ]', fit: 'For early-stage operations. Enters basic organisation identity; unconfigured criteria gracefully defer to human ruling.' }
  ];

  const pathwayCards = h('div', { class: 'grid g-3' }, pathways.map((p) => {
    const isSel = selectedPathway === p.id;
    const card = h('div', {
      class: 'pathway',
      style: { border: isSel ? '2px solid #38BDF8' : '1px solid var(--glass-border)', background: isSel ? 'rgba(114,205,255,.08)' : 'rgba(255,255,255,.6)' },
      onClick: () => { selectedPathway = p.id; toast(`Selected onboarding pathway: ${p.title}`, 'info'); }
    },
      h('div', { class: 'pid' }, p.id),
      h('h3', {}, p.title),
      h('div', { class: 'act' }, p.act),
      h('div', { class: 'fit' }, p.fit)
    );
    return card;
  }));

  // Dropzone
  const fileInput = h('input', { type: 'file', multiple: 'true', style: { display: 'none' } });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      toast(`Successfully added ${fileInput.files.length} document(s). Parsing engine initiated.`, 'ok');
    }
  });

  const dropzone = h('div', {
    class: 'dropzone',
    tabindex: '0',
    role: 'button',
    'aria-label': 'Upload business documents',
    onClick: () => fileInput.click()
  },
    fileInput,
    h('div', { class: 'dz-ico' }, icon('upload', 22)),
    h('h3', {}, 'Click or drag business documents here (PDF · DOCX · XLSX · CSV)'),
    h('p', {}, 'Supports client-documents/ intake up to 50MB per file with automatic macro scanning and OCR classification.')
  );

  // Document Manifest List
  const docList = h('div', { class: 'stack' }, MANIFEST_DOCS.map((doc) => {
    const isAttention = doc.status === 'attention';
    return h('div', {
      class: 'doc-row',
      style: { borderLeft: isAttention ? '3px solid #F59E0B' : '3px solid #10B981', background: 'rgba(255,255,255,.7)' }
    },
      h('span', { class: 'di' }, doc.id),
      h('div', {},
        h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } },
          h('b', { style: { fontSize: '13.5px' } }, doc.filename),
          badge(doc.cat, 'info'),
          doc.required ? badge('Required', 'brand') : badge('Recommended', 'neutral'),
          isAttention ? badge('Needs attention ⚠️', 'warn') : badge('Ready for review ✅', 'ok')
        ),
        h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, `${doc.desc} · ${doc.size} · ${doc.pages} pages`),
        doc.note ? h('div', { class: 'tiny', style: { color: '#B45309', marginTop: '3px' } }, doc.note) : null
      ),
      h('div', { class: 'row', style: { gap: '6px' } },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => editCategory(doc) }, 'Re-tag'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => viewDetails(doc) }, 'Inspect')
      )
    );
  }));

  wrap.append(
    h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', {},
          h('h2', {}, 'Onboarding Pathways'),
          h('div', { class: 'sub' }, 'Select onboarding methodology based on organization maturity')),
        badge(`Pathway ${selectedPathway}`, 'brand')),
      h('div', { class: 'card-body' }, pathwayCards)
    ),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', {},
          h('h2', {}, 'Client Documents Manifest (10 Core Business Assets)'),
          h('div', { class: 'sub' }, 'Includes pre-approvals, claims, SOPs, partner master, cases, and DOA matrix')),
        badge('10 / 10 DOCUMENTS READY', 'ok')),
      h('div', { class: 'card-body' }, dropzone, h('div', { class: 'divider' }), docList),
      h('div', { class: 'card-foot', style: { padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-soft)' } },
        h('button', { class: 'btn btn-primary', type: 'button', onClick: onNext }, 'Continue to Review', icon('chevron', 14)))
    )
  );

  return wrap;
}

/* ---------- Step 2: Review — Extracted Rules & Summaries ---------- */

function renderStep2Review(host, onNext, onPrev) {
  const wrap = h('div', { class: 'stack' });

  const rulesExtracted = [
    { id: 'EXT-01', source: '03-sop.pdf #p4', cat: 'Eligibility', text: 'Partner must have executed channel agreement and maintain Active status', ok: true },
    { id: 'EXT-02', source: '03-sop.pdf #p8', cat: 'Budget Cap', text: 'Gold tier single joint-marketing grant cap is RM 8,000 with up to 50% co-funding ratio', ok: true },
    { id: 'EXT-03', source: '07-checklist.pdf #p2', cat: 'Checklist', text: 'Claim requires official tax invoice and verified on-site attendance sign-in sheet', ok: true },
    { id: 'EXT-04', source: '10-matrix.pdf #p1', cat: 'DOA Authority', text: 'Claims exceeding RM 50,000 require final determination from Channel VP', ok: true },
    { id: 'EXT-05', source: '04-tracker.xlsx #F14', cat: 'Formula Ambiguity', text: 'Cell F14 in Q3 budget tracker references external lookup; pending verification', ok: false }
  ];

  wrap.append(
    h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', {},
          h('h2', {}, 'Extracted Rules & Entities Review'),
          h('div', { class: 'sub' }, 'Structured ingestion yielded 14 core rules, 4 tier limits, and 18 document requirements')),
        badge('REVIEW MODE', 'info')),
      h('div', { class: 'card-body' },
        h('div', { class: 'stack' }, rulesExtracted.map((r) =>
          h('div', { class: `verify${r.ok ? ' ok' : ' bad'}`, style: { padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,.6)', border: '1px solid var(--border-soft)' } },
            h('span', { class: 'vi' }, icon(r.ok ? 'check' : 'alert', 14)),
            h('div', { style: { flex: '1 1 auto' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },
                h('b', {}, r.text),
                badge(r.cat, r.ok ? 'neutral' : 'warn')
              ),
              h('div', { class: 'tiny muted', style: { marginTop: '3px' } }, `Source: ${r.source}`)
            )
          )
        ))
      ),
      h('div', { class: 'card-foot', style: { padding: '14px 20px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-soft)' } },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: onPrev }, icon('arrowLeft', 14), 'Back'),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: onNext }, 'Continue to Resolve', icon('chevron', 14)))
    )
  );

  return wrap;
}

/* ---------- Step 3: Resolve — Conflict Rulings & Formulae ---------- */

function renderStep3Resolve(host, onNext, onPrev) {
  const wrap = h('div', { class: 'stack' });

  // Conflict Ruling Card (CF-002: RM 8,000 vs RM 10,000)
  const conflictCard = h('div', { class: 'conflict-banner' },
    h('span', { class: 'ci', style: { color: '#EA580C' } }, icon('alert', 22)),
    h('div', {},
      h('h4', {}, 'Policy Conflict Detected: CF-002'),
      h('p', {}, 'Document "03-programme-policy-and-sop.pdf" page 8 states Gold Tier grant cap is RM 8,000; older form "01-pre-approval-form.pdf" notes indicate RM 10,000.'),
      h('div', { class: 'stack', style: { marginTop: '12px' } },
        h('label', { class: 'row', style: { gap: '8px', cursor: 'pointer', alignItems: 'center' } },
          h('input', { type: 'radio', name: 'cf002', checked: 'true' }),
          h('span', { style: { fontSize: '13px', fontWeight: 600 } }, 'Adopt 2026 Official SOP Standard (Cap: RM 8,000 — Recommended)')
        ),
        h('label', { class: 'row', style: { gap: '8px', cursor: 'pointer', alignItems: 'center' } },
          h('input', { type: 'radio', name: 'cf002' }),
          h('span', { style: { fontSize: '13px', fontWeight: 600 } }, 'Adopt Legacy Form Grace Standard (Cap: RM 10,000 — Requires Special Justification)')
        )
      )
    )
  );

  wrap.append(
    h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', {},
          h('h2', {}, 'Resolve Issues & Policy Conflicts'),
          h('div', { class: 'sub' }, 'Iron Invariants 1 & 3: Never auto-select; administrator renders authoritative determination logged to ADR')),
        badge('1 UNRESOLVED CONFLICT', 'warn')),
      h('div', { class: 'card-body' }, conflictCard),
      h('div', { class: 'card-foot', style: { padding: '14px 20px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-soft)' } },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: onPrev }, icon('arrowLeft', 14), 'Back'),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => {
          toast('Conflict resolved and logged to decision register.', 'ok');
          onNext();
        } }, 'Confirm & Proceed', icon('check', 14)))
    )
  );

  return wrap;
}

/* ---------- Step 4: Confirm & Deep Analysis Launch ---------- */

function renderStep4Confirm(host, onPrev, onGoStep) {
  const wrap = h('div', { class: 'stack' });

  const deliverables = [
    { title: '1. End-to-End Process Flowchart', desc: 'Complete lifecycle from partner submission through Agent 1-6 intake to financial disbursement.' },
    { title: '2. Pain Points & Risk Audit', desc: 'Detects duplicate invoice vulnerabilities, SLA blindspots, and unstructured document fraud risks.' },
    { title: '3. Compiled Deterministic Rules Matrix', desc: 'Includes 14 deterministic rules and 12 matching patterns stamped as version v2026.3.0.' },
    { title: '4. Production-Ready System Specification', desc: 'Ledger parameters, partner tier specifications, and dual-track security isolation architecture.' }
  ];

  const analysisBtn = h('button', { class: 'btn btn-primary btn-lg', type: 'button' },
    icon('spark', 18), 'Confirm & Launch Analysis'
  );

  analysisBtn.addEventListener('click', async () => {
    analysisBtn.disabled = true;
    toast('Orchestrator executing end-to-end analysis and rule compilation…', 'info');
    setTimeout(() => {
      analysisBtn.disabled = false;
      modal({
        title: 'Deep Analysis & Rules Compilation Complete!',
        subtitle: 'Enterprise Rules Matrix Compiled Successfully · Version v2026.3.0',
        body: h('div', { class: 'stack' },
          h('div', { class: 'callout' }, h('span', { class: 'ci' }, icon('check', 18)),
            h('div', {}, 'All 10 business documents ingested and published to Company Brain and Rules Engine. Pipeline is live and ready for submissions!')),
          h('div', { class: 'section-label' }, 'Produced Deliverables:'),
          h('ul', { class: 'tiny', style: { paddingLeft: '16px', lineHeight: 1.6 } },
            h('li', {}, 'Process SOP Mapping (SOP_2026_V1)'),
            h('li', {}, 'Immutable Four-State Ledger Baseline (Allocated RM 10,000,000)'),
            h('li', {}, 'Dual-Track Security Sandbox (Prompt Injection Defense Active)')
          )
        ),
        actions: [
          h('a', { class: 'btn btn-ghost', href: '#/brain/requirements', onClick: () => closeModal() }, 'View Rules'),
          h('a', { class: 'btn btn-primary', href: '#/listing', onClick: () => closeModal() }, 'Go to Listing History')
        ]
      });
    }, 1200);
  });

  wrap.append(
    h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', {},
          h('h2', {}, 'Confirm & Launch Analysis'),
          h('div', { class: 'sub' }, 'DWP Standards: Upload and analysis are strictly decoupled; start live production once confirmed')),
        badge('READY TO LAUNCH', 'ok')),
      h('div', { class: 'card-body' },
        h('div', { class: 'grid g-2', style: { marginBottom: '20px' } }, deliverables.map((d) =>
          h('div', { class: 'card', style: { padding: '14px', background: 'rgba(255,255,255,.6)' } },
            h('b', { style: { fontSize: '13.5px' } }, d.title),
            h('p', { class: 'tiny muted', style: { marginTop: '4px' } }, d.desc))
        )),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, analysisBtn)
      ),
      h('div', { class: 'card-foot', style: { padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-soft)', flexWrap: 'wrap', gap: '10px' } },
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn-ghost', type: 'button', onClick: onPrev }, icon('arrowLeft', 14), 'Back to Step 3'),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => onGoStep && onGoStep(1) }, icon('upload', 13), 'Review Step 1 (Manifest)'),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => onGoStep && onGoStep(2) }, icon('scale', 13), 'Review Step 2 (Extracted Rules)'),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => onGoStep && onGoStep(3) }, icon('sliders', 13), 'Review Step 3 (Resolved Conflicts)')
        ),
        h('span', { class: 'badge badge-ok' }, h('i', { class: 'bdot' }), 'Step 1-4 Complete · Active')
      )
    )
  );

  return wrap;
}

/* ---------- Helper Modals ---------- */

function editCategory(doc) {
  const cats = ['Forms & templates', 'Policies & SOPs', 'Partner & budget records', 'Historical cases & reports'];
  const sel = h('select', { class: 'select' }, cats.map((c) => h('option', { value: c, selected: c === doc.cat }, c)));
  const ok = h('button', { class: 'btn btn-primary', type: 'button' }, 'Save');
  ok.addEventListener('click', () => {
    doc.cat = sel.value;
    closeModal();
    toast(`Updated category for ${doc.filename}: ${doc.cat}`, 'ok');
  });

  modal({
    title: `Re-categorize Document: ${doc.filename}`,
    subtitle: 'Manual classification override: Switch category without re-uploading.',
    body: h('div', { class: 'field' }, h('label', {}, 'Category'), sel),
    actions: [h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Cancel'), ok]
  });
}

function viewDetails(doc) {
  modal({
    title: `Document Details: ${doc.filename}`,
    subtitle: `${doc.cat} · ${doc.size} · ${doc.pages} pages`,
    body: h('div', { class: 'stack' },
      h('div', { class: 'kv-grid' },
        h('div', { class: 'kv' }, h('span', {}, 'Rules Found'), h('b', {}, String(doc.rulesFound || '—'))),
        h('div', { class: 'kv' }, h('span', {}, 'Status'), badge(doc.status, doc.status === 'ready' ? 'ok' : 'warn')),
        h('div', { class: 'kv wide' }, h('span', {}, 'Purpose'), h('b', {}, doc.desc))
      ),
      doc.note ? h('div', { class: 'callout warn', style: { marginTop: '10px' } }, h('span', { class: 'ci' }, icon('alert', 16)), h('div', {}, doc.note)) : null
    ),
    actions: [h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Close')]
  });
}
