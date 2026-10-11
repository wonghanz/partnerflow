/* Submission wizard: plus-gateway → form + unlimited PDF dropzone → foolproof gate (web.md §3). */

import { api, ApiError } from '../api.js';
import { h, icon, toast, bytes, field } from '../dom.js';
import { ctx } from '../state.js';

/* The draft lives at module scope so stepping away to check a pre-approval ID never
   discards a bundle that took minutes to assemble. */
const draft = {
  open: false,
  busy: false,
  error: null,
  type: 'CLAIM',
  partner: null,
  title: '',
  activityType: '',
  activityDate: '',
  amount: '',
  invoiceLineTotal: '',
  currency: null,
  parent: '',
  invoiceNumbers: '',
  contactName: '',
  contactEmail: '',
  notes: '',
  files: [],
  checklist: [],
  checklistMeta: { tier: null, tier_found: false, cap_configured: false, submission_type: 'CLAIM' }
};

let fileSeq = 0;

export async function render() {
  const lookups = await loadLookups();
  const host = h('div', { class: 'stack' });
  const paint = () => host.replaceChildren(draft.open ? formView(lookups, paint) : gatewayView(paint));
  paint();
  return host;
}

/* Nothing in this view invents business data: currencies come from the whitelist rule,
   the document checklist comes from /api/checklist for the chosen type and partner tier. */
async function loadLookups() {
  const out = { currencies: null, currencyRef: null, programmes: [] };
  try {
    const r = await api.rules();
    const rules = Array.isArray(r.rules) ? r.rules : [];
    const cur = rules.find((x) => x?.condition?.type === 'CURRENCY_IN_WHITELIST' && x?.status !== 'inactive');
    const allowed = cur?.condition?.params?.allowed;
    if (Array.isArray(allowed) && allowed.length) {
      out.currencies = allowed;
      out.currencyRef = cur.policy_ref || null;
    }
  } catch { /* fall back to organisation base currency */ }
  if (!draft.currency) {
    const base = ctx.config?.org?.base_currency;
    draft.currency = base || out.currencies?.[0] || null;
  }
  return out;
}

/* ---------- §3.1 empty state: centred quick entry ---------- */

function gatewayView(paint) {
  const start = () => { draft.open = true; paint(); };
  return h('div', { class: 'plus-gateway' },
    h('div', { class: 'stack', style: { alignItems: 'center', gap: '0' } },
      h('span', { style: { color: '#72CDFF', display: 'grid', placeItems: 'center', marginBottom: '18px' } }, icon('doc', 48)),
      h('button', { class: 'plus-ring', type: 'button', 'aria-label': 'Submit a Report', onClick: start }, icon('plus', 54)),
      h('p', { style: { fontSize: '18px', color: '#4B5563', marginBottom: '10px' } }, 'Submit a Report'),
      h('p', { class: 'tiny muted' }, 'Upload PDF evidence — the checklist and submit gate are computed live from company policies.'),
      h('button', { class: 'btn btn-ghost', type: 'button', style: { marginTop: '18px' }, onClick: start }, icon('plus', 15), 'Start a New Report')));
}

/* ---------- §3.2 form + checklist ---------- */

function formView(lookups, paint) {
  const base = ctx.config?.org?.base_currency || '';
  const missingFields = requiredFieldGaps();
  const missingDocs = draft.checklist.filter((i) => i.required && !boundTo(i)).length;
  const gateOpen = !draft.busy && !missingFields.length && !missingDocs;

  const shell = h('div', { class: 'stack' });

  shell.appendChild(h('div', { class: 'page-head' },
    h('div', {},
      h('h1', { class: 'page-title' }, h('span', { class: 'grad' }, 'Submit a Report')),
      h('p', { class: 'page-sub' },
        'Iron Invariant 3: The system never guesses partner identity and never auto-fills unconfirmed rules.')),
    h('div', { class: 'page-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => { draft.open = false; paint(); } }, icon('arrowLeft', 15), 'Back to Gateway'))));

  if (draft.error) {
    shell.appendChild(h('div', { class: 'callout danger' }, h('span', { class: 'ci' }, icon('alert', 18)),
      h('div', {}, h('b', {}, `${draft.error.code} `), draft.error.message)));
  }

  shell.appendChild(partnershipCard(lookups, paint, base));
  shell.appendChild(uploadCard(paint));
  shell.appendChild(checklistCard(missingFields, paint));
  shell.appendChild(submitBar(gateOpen, missingFields.length + missingDocs, paint));
  return shell;
}

function partnershipCard(lookups, paint, base) {
  const body = h('div', { class: 'stack' });

  /* --- partner search (Iron Invariant 3: never a free-text guess) --- */
  const results = h('div', { class: 'stack', style: { gap: '6px', marginTop: '8px' } });
  const search = h('input', {
    class: 'input', type: 'search', 'aria-label': 'Partner search',
    placeholder: 'Search partner name or ID…',
    value: draft.partner ? `${draft.partner.name} · ${draft.partner.partner_id}` : ''
  });
  let timer = null;
  const showResults = async (q) => {
    try {
      const r = await api.partners(q);
      const list = (r.partners || []).slice(0, 12);
      if (!list.length) {
        results.replaceChildren(h('p', { class: 'tiny muted' }, `No partner matches "${q || '…'}". Partners are sourced from directory; unrecognised entities are rejected.`));
        return;
      }
      results.replaceChildren(...list.map((p) => h('button', {
        class: 'approver-row', type: 'button',
        onClick: () => { draft.partner = p; draft.parent = ''; results.replaceChildren(); search.value = `${p.name} · ${p.partner_id}`; loadChecklist(p, paint); }
      },
      h('span', { class: 'av' }, (p.name || '?').slice(0, 2)),
      h('span', { class: 'meta' }, h('b', {}, p.name), h('i', {}, `${p.partner_id} · ${p.tier || 'Unassigned'} · ${p.region || '—'}`),
        h('span', { class: 'row-tags' },
          h('span', { class: `chip ${p.status === 'active' ? '' : 'chip-no'}` }, `Status: ${p.status}`),
          h('span', { class: 'chip' }, (p.programmes || []).join(' · ') || 'No programme'))),
      h('span', { class: 'go' }, icon('chevron', 16)))));
    } catch (e) {
      results.replaceChildren(h('p', { class: 'tiny muted' }, String(e.message || e)));
    }
  };
  search.addEventListener('input', () => {
    clearTimeout(timer);
    const q = search.value.trim();
    if (draft.partner && q === '') { draft.partner = null; results.replaceChildren(); loadChecklist(null, paint); return; }
    timer = setTimeout(() => showResults(q), 220);
  });
  search.addEventListener('focus', () => { if (!draft.partner) showResults(search.value.trim()); });

  const partnerField = field('Partner', search, {
    required: true,
    hint: draft.partner
      ? `Selected: ${draft.partner.partner_id} · Tier: ${draft.partner.tier || 'Unassigned'} · Status: ${draft.partner.status}`
      : 'Must be selected from the partner directory.'
  });
  if (draft.partner && draft.partner.status !== 'active') {
    partnerField.appendChild(h('span', { class: 'err' }, `Partner status is ${draft.partner.status} — the rules engine will block this submission.`));
  }
  body.appendChild(partnerField);
  body.appendChild(results);

  body.appendChild(h('div', { class: 'divider' }));

  /* --- application type --- */
  const typeBtn = (value, en) => h('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(draft.type === value),
    onClick: () => { draft.type = value; loadChecklist(draft.partner, paint); }
  }, en);
  body.appendChild(field('Submission Type',
    h('div', { class: 'row' }, typeBtn('PRE_APPROVAL', 'Pre-approval'), typeBtn('CLAIM', 'Reimbursement Claim')),
    { required: true, hint: 'A reimbursement claim must reference an approved pre-approval.' }));

  /* --- parent pre-approval: offered from real records, never typed blind --- */
  const parentHost = h('div', {});
  if (draft.type === 'CLAIM') {
    parentHost.appendChild(parentSelect(paint));
  } else {
    parentHost.appendChild(h('p', { class: 'tiny muted' }, 'Pre-approval applications stand on their own.'));
  }
  body.appendChild(field('Parent Pre-Approval ID', parentHost, { required: draft.type === 'CLAIM' }));

  body.appendChild(h('div', { class: 'grid g-2' },
    field('Submission Title', input('title', { type: 'text', placeholder: 'Q3 Joint Marketing Campaign · KL Launch' }), { required: true }),
    field('Activity Type', input('activityType', { type: 'text', placeholder: 'Joint Marketing / Event', list: 'programmeHints' }), {
      hint: 'Suggestions derived from partner programmes.'
    })));

  const dl = h('datalist', { id: 'programmeHints' });
  const seen = new Set();
  for (const p of lookups.programmes || []) if (!seen.has(p) && seen.add(p)) dl.appendChild(h('option', { value: p }));

  body.appendChild(h('div', { class: 'grid g-3' },
    field('Activity Date', input('activityDate', { type: 'date' }), { required: true, hint: 'Anchors the claim submission window rule.' }),
    field('Declared Amount', input('amount', { type: 'number', step: '0.01', min: '0', placeholder: '0.00' }), { required: true }),
    field('Currency', currencySelect(lookups, base), { hint: lookups.currencyRef ? `Whitelist from ${lookups.currencyRef}` : null })));

  body.appendChild(h('div', { class: 'grid g-2' },
    field('Invoice Number(s)', input('invoiceNumbers', { type: 'text', placeholder: 'INV-001, INV-002' }), { hint: 'Comma or space separated — feeds deduplication verification.' }),
    field('Invoice Line Total', input('invoiceLineTotal', { type: 'number', step: '0.01', min: '0', placeholder: 'Optional' }), { hint: 'Discrepancies trigger a Grill-Me clarification inquiry.' })));

  body.appendChild(h('div', { class: 'grid g-2' },
    field('Contact Name', input('contactName', { type: 'text' }), { required: true }),
    field('Contact Email', input('contactEmail', { type: 'email', placeholder: 'partner@company.com' }))));

  body.appendChild(field('Notes', input('notes', { type: 'textarea', placeholder: 'Additional context or remarks…' })));

  const cardEl = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, '1 · Partnership & Activity Details'),
      h('div', { class: 'sub' }, 'Partner entity · Submission type · Linked pre-approval · Amount & currency'))),
    h('div', { class: 'card-body' }, body, dl));
  return cardEl;
}

function parentSelect(paint) {
  const sel = h('select', { 'aria-label': 'Parent pre-approval' });
  sel.appendChild(h('option', { value: '' }, draft.partner ? 'Choose an approved pre-approval…' : 'Select a partner first'));
  if (!draft.partner) { sel.disabled = true; return sel; }
  let chosen = draft.parent;
  api.submissions({ type: 'PRE_APPROVAL', limit: 200 }).then((r) => {
    const usable = (r.submissions || []).filter((s) => s.partner_id === draft.partner?.partner_id
      && ['APPROVED', 'PAID', 'ARCHIVED'].includes(s.state));
    if (!usable.length) {
      sel.replaceChildren(h('option', { value: '' }, 'No approved pre-approvals found for this partner'));
      sel.disabled = true;
      return;
    }
    sel.replaceChildren(h('option', { value: '' }, 'Choose an approved pre-approval…'),
      ...usable.map((s) => h('option', { value: s.submission_id, selected: s.submission_id === chosen },
        `${s.submission_id} · ${s.title} · ${s.approved_amount ?? s.amount ?? '—'}`)));
    if (chosen) { sel.value = chosen; } else { draft.parent = ''; }
  }).catch((e) => {
    sel.replaceChildren(h('option', { value: '' }, `Failed to load: ${e.code || e.message}`));
  });
  sel.addEventListener('change', () => { draft.parent = sel.value; paint(); });
  return sel;
}

function currencySelect(lookups, base) {
  const list = lookups.currencies || (base ? [base] : []);
  const sel = h('select', { 'aria-label': 'Currency' });
  if (!list.length) { sel.appendChild(h('option', { value: '' }, '—')); return sel; }
  for (const c of list) sel.appendChild(h('option', { value: c, selected: c === draft.currency }, c));
  sel.addEventListener('change', () => { draft.currency = sel.value; });
  return sel;
}

function input(key, props = {}) {
  const isTextarea = props.type === 'textarea';
  const { type, ...rest } = props;
  const el = h(isTextarea ? 'textarea' : 'input', { class: 'input', ...rest });
  if (!isTextarea) el.value = draft[key] || '';
  else if (draft[key]) el.value = draft[key];
  el.addEventListener('input', () => { draft[key] = el.value; });
  el.addEventListener('change', () => { draft[key] = el.value; });
  return el;
}

/* ---------- §3.2 B unlimited multi-PDF dropzone ---------- */

function uploadCard(paint) {
  const list = h('div', { class: 'stack', style: { gap: '0', marginTop: '14px' } });
  const picker = h('input', { type: 'file', multiple: true, accept: '.pdf,application/pdf', style: { display: 'none' }, onChange: () => addFiles(picker.files) });

  const dz = h('div', {
    class: 'dropzone', role: 'button', tabindex: '0',
    onClick: () => picker.click(),
    onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); } }
  },
  h('div', { class: 'dz-ico' }, icon('upload', 22)),
  h('h3', {}, 'Drag & drop PDF files here, or click to browse'),
  h('p', {}, 'Unlimited file uploads supported · Evaluated individually by Agent 1 Intake'));

  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', (e) => addFiles(e.dataTransfer?.files));

  function addFiles(fileList) {
    for (const f of Array.from(fileList || [])) {
      if (!f) continue;
      const rec = { id: `f${++fileSeq}`, file: f, name: f.name, size: f.size, category: autoMatch(f.name) };
      draft.files.push(rec);
    }
    paint();
  }

  function autoMatch(filename) {
    const hit = draft.checklist.find((i) => matches(i, filename));
    return hit ? hit.item_id : null;
  }

  function renderFiles() {
    list.replaceChildren(...(draft.files.length ? draft.files.map((rec) => fileRow(rec, paint)) :
      [h('p', { class: 'tiny muted', style: { marginTop: '12px' } }, 'No files attached yet.')]));
  }
  renderFiles();

  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {},
      h('h2', {}, '2 · Supporting Documents'),
      h('div', { class: 'sub' }, `${draft.files.length} file(s) · ${bytes(draft.files.reduce((a, f) => a + f.size, 0))} · Server-side intake and confidence extraction`)),
    h('div', { class: 'card-body' }, dz, picker, list)));
}

function fileRow(rec, paint) {
  const ext = (rec.name.split('.').pop() || 'file').slice(0, 4).toUpperCase();
  const bind = h('select', { 'aria-label': `Classify ${rec.name}` },
    h('option', { value: '', selected: !rec.category }, 'Unassigned'),
    ...draft.checklist.map((i) => h('option', { value: i.item_id, selected: rec.category === i.item_id },
      `${i.label_en || i.label_zh || i.item_id}${i.required ? ' *' : ''}`)));
  bind.addEventListener('change', () => { rec.category = bind.value || null; paint(); });

  return h('div', { class: 'file-item' },
    h('span', { class: 'fi' }, ext),
    h('div', { style: { minWidth: '0' } },
      h('div', { class: 'fn', title: rec.name }, rec.name),
      h('div', { class: 'fm' }, `${bytes(rec.size)} · ${rec.category ? `Matched: ${rec.category}` : 'Unmatched'}`)),
    h('div', { class: 'row', style: { gap: '6px' } }, bind,
      h('button', {
        class: 'icon-btn', type: 'button', 'aria-label': `Remove ${rec.name}`, title: 'Remove',
        onClick: () => { draft.files = draft.files.filter((f) => f.id !== rec.id); paint(); }
      }, icon('trash', 15))));
}

/* ---------- §3.2 C + D dynamic checklist and foolproof lock ---------- */

async function loadChecklist(partner, paint) {
  const tier = partner?.tier || null;
  try {
    const r = await api.checklist(tier, draft.type);
    draft.checklist = r.checklist || [];
    draft.checklistMeta = { tier, tier_found: r.tier_found, cap_configured: r.cap_configured, submission_type: r.submission_type };
    for (const f of draft.files) if (f.category && !draft.checklist.some((i) => i.item_id === f.category)) f.category = null;
  } catch (e) {
    draft.checklist = [];
    draft.checklistMeta = { tier, tier_found: false, error: e.code || String(e.message || e) };
  }
  paint();
}

function matches(item, filename) {
  const name = String(filename || '').toLowerCase();
  const needles = [item.item_id, ...(item.match_keywords || [])].filter(Boolean).map((k) => String(k).toLowerCase());
  return needles.some((k) => name.includes(k));
}

function boundTo(item) {
  return draft.files.some((f) => f.category === item.item_id);
}

function requiredFieldGaps() {
  const checks = [
    ['Partner', () => !!draft.partner],
    ['Title', () => !!draft.title.trim()],
    ['Activity Date', () => !!draft.activityDate],
    ['Declared Amount', () => draft.amount !== '' && Number(draft.amount) > 0],
    ['Currency', () => !!draft.currency],
    ['Submitted By', () => !!(draft.contactName.trim() || draft.contactEmail.trim())],
    ['Parent Pre-Approval', () => draft.type !== 'CLAIM' || !!draft.parent]
  ];
  return checks.filter(([, ok]) => !ok()).map(([label]) => label);
}

function checklistCard(missingFields, paint) {
  const items = draft.checklist;
  const required = items.filter((i) => i.required);
  // The mandatory-field block counts as one gate so the bar never reads 100% while a field is empty.
  const total = required.length + 1;
  const done = required.filter(boundTo).length + (missingFields.length ? 0 : 1);
  const pct = Math.round((done / total) * 100);

  const rows = h('div', { class: 'checklist' });
  for (const label of missingFields) {
    rows.appendChild(h('div', { class: 'check-item', dataset: { state: 'missing' } },
      h('span', { class: 'mk' }, '✕'),
      h('div', {}, h('div', { class: 'cl' }, label), h('div', { class: 'cs' }, 'Required field missing')),
      h('span', { class: 'tiny muted' }, 'Field')));
  }
  for (const i of items) {
    const ok = boundTo(i);
    const state = i.required ? (ok ? 'ok' : 'missing') : (ok ? 'ok' : 'optional');
    rows.appendChild(h('div', { class: 'check-item', dataset: { state } },
      h('span', { class: 'mk' }, ok ? '✓' : i.required ? '✕' : '–'),
      h('div', {},
        h('div', { class: 'cl' }, `${i.order ? `${i.order}. ` : ''}${i.label_en || i.label_zh || i.item_id}`),
        h('div', { class: 'cs' }, ok
          ? `Uploaded: ${draft.files.filter((f) => f.category === i.item_id).map((f) => f.name).join(', ')}`
          : [i.policy_ref ? `Policy ref: ${i.policy_ref}` : 'Waiting for human determination'].filter(Boolean).join(' · '))),
      h('span', { class: 'mono tiny' }, i.item_id)));
  }
  if (!items.length) {
    rows.appendChild(h('div', { class: 'callout warn' }, h('span', { class: 'ci' }, icon('info', 18)),
      h('div', {}, 'No document checklist configured for this tier and type. ',
        h('br'), 'The system will not guess requirements (zero auto-fill); this submission will route for human ruling.')));
  }

  const notConfigured = items.length && items.every((i) => i.configured === false);
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {},
      h('h2', {}, '3 · Document Readiness Checklist'),
      h('div', { class: 'sub' }, `${draft.checklistMeta.tier ? `Tier: ${draft.checklistMeta.tier}` : 'Global checklist'} · ${draft.checklistMeta.submission_type || draft.type}`))),
    h('div', { class: 'card-body' },
      h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '10px' } },
        h('span', { class: 'tiny muted' }, `Readiness: ${done} of ${total}`),
        h('span', { class: 'mono tiny' }, `${pct}%`)),
      h('div', { class: 'progress' }, h('span', { style: { width: `${pct}%` } })),
      h('div', { style: { height: '16px' } }),
      rows,
      notConfigured ? h('p', { class: 'tiny muted', style: { marginTop: '12px' } },
        `Note: Specific requirements for Tier ${draft.checklistMeta.tier} are unconfirmed (cap_configured = false); falling back to standard checklist.`) : null));
}

/* ---------- §3.2 D gate + E post-submission redirect ---------- */

function submitBar(gateOpen, blockers, paint) {
  const btn = h('button', {
    class: 'btn btn-primary btn-lg', type: 'button',
    disabled: !gateOpen,
    title: gateOpen ? 'All gates satisfied' : `${blockers} unmet conditions — submit locked`
  }, icon(draft.busy ? 'clock' : 'send', 16), draft.busy ? 'Submitting…' : 'Submit Report');
  btn.addEventListener('click', () => submit(paint));

  return h('div', { class: 'card' },
    h('div', { class: 'card-pad', style: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'space-between' } },
      h('div', { class: 'row', style: { gap: '8px' } },
        blockers
          ? h('span', { class: 'badge badge-warn' }, h('i', { class: 'bdot' }), `Locked · ${blockers} item(s) unmet`)
          : h('span', { class: 'badge badge-ok' }, h('i', { class: 'bdot' }), 'All gates satisfied'),
        h('span', { class: 'tiny muted' }, 'Any missing required condition keeps the button locked')),
      btn));
}

async function submit(paint) {
  draft.busy = true; draft.error = null; paint();

  const fd = new FormData();
  const set = (k, v) => { if (v !== null && v !== undefined && v !== '') fd.set(k, v); };
  set('submission_type', draft.type);
  set('partner_id', draft.partner?.partner_id);
  set('partner_name', draft.partner?.name);
  set('title', draft.title.trim());
  set('activity_type', draft.activityType.trim() || draft.title.trim());
  set('activity_date', draft.activityDate);
  set('amount', draft.amount);
  set('invoice_line_total', draft.invoiceLineTotal);
  set('currency', draft.currency);
  set('parent_pre_approval_id', draft.parent);
  set('invoice_numbers', draft.invoiceNumbers);
  set('contact_name', draft.contactName.trim());
  set('contact_email', draft.contactEmail.trim());
  set('submitted_by', draft.contactName.trim() || draft.contactEmail.trim());
  set('notes', draft.notes);
  for (const rec of draft.files) fd.append('files', rec.file, rec.file.name);

  try {
    const r = await api.post('/api/submissions', fd);
    const s = r.submission || {};
    toast(`Report submitted successfully · ID: ${s.submission_id} (State: ${s.state}${s.ui_status ? ` · ${s.ui_status}` : ''})`, 'ok', r.message || 'Report submitted successfully!', 7000);
    resetDraft();
    ctx.navigate('/listing');
  } catch (e) {
    draft.busy = false;
    draft.error = e instanceof ApiError ? { code: e.code, message: e.message } : { code: 'SUBMIT_FAILED', message: String(e.message || e) };
    paint();
  }
}

function resetDraft() {
  Object.assign(draft, {
    open: false, busy: false, error: null, type: 'CLAIM', partner: null, title: '', activityType: '',
    activityDate: '', amount: '', invoiceLineTotal: '', parent: '', invoiceNumbers: '',
    contactName: '', contactEmail: '', notes: '', files: [], checklist: []
  });
  draft.currency = ctx.config?.org?.base_currency || null;
}
