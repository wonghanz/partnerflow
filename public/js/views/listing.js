/* Listing History — Apple-grade Data Table & live deterministic metrics. */

import { api, ApiError } from '../api.js';
import {
  h, icon, toast, money, compactMoney, dateOnly, relTime,
  stateBadge, empty, modal, closeModal, barRow, prettyState
} from '../dom.js';
import { ctx, withAuthority } from '../state.js';

const filters = { q: '', status: 'all', type: 'all', tier: 'all', sort: 'newest', page: 1, limit: 20 };
let viewMode = 'table'; // 'table' (default) | 'cards'

export async function render() {
  const wrap = h('div', { class: 'stack' });

  const statsHost = h('div', { class: 'grid g-4', id: 'statCards' });
  const totalsHost = h('div', { class: 'totals-strip' });
  const toolbarHost = h('div', { class: 'toolbar' });
  const listHost = h('div', { class: 'sub-list' });
  const pagerHost = h('div', { class: 'pager' });

  const segTable = h('button', {
    class: `seg-btn${viewMode === 'table' ? ' active' : ''}`,
    type: 'button',
    onClick: () => { if (viewMode !== 'table') { viewMode = 'table'; syncSeg(); load(); } }
  }, icon('list', 14), 'Table');

  const segCards = h('button', {
    class: `seg-btn${viewMode === 'cards' ? ' active' : ''}`,
    type: 'button',
    onClick: () => { if (viewMode !== 'cards') { viewMode = 'cards'; syncSeg(); load(); } }
  }, icon('grid', 14), 'Cards');

  function syncSeg() {
    segTable.className = `seg-btn${viewMode === 'table' ? ' active' : ''}`;
    segCards.className = `seg-btn${viewMode === 'cards' ? ' active' : ''}`;
  }

  const segControl = h('div', { class: 'seg-control', 'aria-label': 'View Layout' }, segTable, segCards);

  wrap.append(
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', { class: 'page-title' }, h('span', { class: 'grad' }, 'Listing History')),
        h('p', { class: 'page-sub' }, 'Every figure is computed live by the deterministic engine — zero pre-baked metrics.')),
      h('div', { class: 'page-actions' },
        segControl,
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => load() }, icon('refresh', 15), 'Refresh'),
        h('a', { class: 'btn btn-primary', href: '#/submit' }, icon('plus', 15), 'New Submission'))),
    statsHost, totalsHost, toolbarHost, listHost, pagerHost);

  buildToolbar(toolbarHost, () => load());

  async function load() {
    statsHost.replaceChildren(...Array.from({ length: 4 }, () => h('div', { class: 'skeleton', style: { height: '104px' } })));
    listHost.replaceChildren(...Array.from({ length: 5 }, () => h('div', { class: 'skeleton', style: { height: '80px', marginBottom: '10px' } })));
    try {
      const [stats, list] = await Promise.all([
        api.stats(),
        api.submissions({ ...filters })
      ]);
      renderStats(statsHost, totalsHost, stats);
      renderList(listHost, pagerHost, list, () => load());
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.code} — ${e.message}` : String(e.message || e);
      statsHost.replaceChildren();
      listHost.replaceChildren(h('div', { class: 'callout danger' }, h('span', { class: 'ci' }, icon('alert', 18)), h('div', {}, msg)));
    }
  }

  await load();
  return wrap;
}

/* ---------- stats ---------- */

const ACCENT_ICON = { total: 'grid', accepted: 'check', pending: 'clock', rejected: 'alert' };
const ACCENT_LABEL = {
  total: 'Total Submissions',
  accepted: 'Accepted (Approved / Paid / Archived)',
  pending: 'Pending Review',
  rejected: 'Rejected / Blocked / Quarantined'
};

function renderStats(host, totalsHost, stats) {
  host.replaceChildren();
  const cur = ctx.config?.org?.base_currency || 'MYR';
  for (const c of stats.cards || []) {
    const label = ACCENT_LABEL[c.key] || c.label;
    host.appendChild(h('article', { class: 'stat', dataset: { accent: c.accent } },
      h('div', { class: 'stat-top' },
        h('span', { class: 'si' }, icon(ACCENT_ICON[c.key] || 'activity', 16)),
        h('span', { class: 'sl' }, label)),
      h('div', { class: 'stat-value' }, String(c.value ?? 0)),
      h('div', { class: 'stat-foot' },
        c.amount !== undefined && c.amount !== null
          ? h('b', { class: 'num' }, compactMoney(c.amount, cur))
          : h('span', { class: 'muted tiny' }, label))));
  }

  const t = stats.totals || {};
  totalsHost.replaceChildren(
    h('div', { class: 'mini' }, h('span', {}, 'Declared Total'), h('b', { class: 'num' }, money(t.declared_amount, cur))),
    h('div', { class: 'mini' }, h('span', {}, 'Approved Total'), h('b', { class: 'num' }, money(t.approved_amount, cur))),
    h('div', { class: `mini${t.sla_breached ? ' warn' : ''}` }, h('span', {}, 'SLA Breaches'), h('b', { class: 'num' }, String(t.sla_breached ?? 0))),
    h('div', { class: 'mini' }, h('span', {}, 'Average Ageing'), h('b', { class: 'num' }, `${t.average_ageing_days ?? 0}d`)),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => showBreakdown(stats) }, icon('activity', 14), 'Breakdown'));
}

function showBreakdown(stats) {
  const cur = ctx.config?.org?.base_currency || 'MYR';
  const tiers = stats.by_tier || [];
  const types = stats.by_type || [];
  const states = Object.entries(stats.by_state || {}).sort((a, b) => b[1] - a[1]);
  const maxTier = Math.max(1, ...tiers.map((t) => t.count));
  const maxState = Math.max(1, ...states.map((s) => s[1]));

  modal({
    title: 'Submission Distribution Breakdown',
    subtitle: 'Live aggregation computed directly by the deterministic engine',
    body: h('div', { class: 'stack' },
      h('div', { class: 'section-label' }, 'By Partner Tier'),
      tiers.length ? h('div', { class: 'stack' }, tiers.map((t) => barRow(t.tier, t.count, maxTier, `${t.count} · ${compactMoney(t.amount, cur)}`)))
        : h('p', { class: 'tiny muted' }, 'No data available'),
      h('div', { class: 'divider' }),
      h('div', { class: 'section-label' }, 'By Submission Type'),
      types.length ? h('div', { class: 'grid g-2' }, types.map((t) => h('div', { class: 'kv' },
        h('span', {}, t.type === 'PRE_APPROVAL' ? 'Pre-approval' : 'Reimbursement Claim'),
        h('b', { class: 'num' }, `${t.count} · ${compactMoney(t.amount, cur)}`)))) : null,
      h('div', { class: 'divider' }),
      h('div', { class: 'section-label' }, 'By State'),
      states.length ? h('div', { class: 'stack' }, states.map(([s, n]) => barRow(prettyState(s), n, maxState)))
        : h('p', { class: 'tiny muted' }, 'No data available')),
    actions: [h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Close')]
  });
}

/* ---------- toolbar ---------- */

function buildToolbar(host, reload) {
  const q = h('input', { class: 'search', type: 'search', value: filters.q, placeholder: 'Search by ID, title, partner, or invoice number…', 'aria-label': 'Search' });
  let debounce = null;
  q.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { filters.q = q.value.trim(); filters.page = 1; reload(); }, 280);
  });

  const statusSel = select([
    ['all', 'All Statuses'],
    ['pending', 'Pending'],
    ['approved', 'Accepted'],
    ['rejected', 'Rejected']
  ], filters.status, (v) => { filters.status = v; filters.page = 1; reload(); });

  const typeSel = select([
    ['all', 'All Types'],
    ['CLAIM', 'Claim'],
    ['PRE_APPROVAL', 'Pre-approval']
  ], filters.type, (v) => { filters.type = v; filters.page = 1; reload(); });

  const tierSel = select([['all', 'All Tiers'], ...['Elite', 'Gold', 'Silver', 'Registered', 'Unassigned'].map((t) => [t, t])],
    filters.tier, (v) => { filters.tier = v; filters.page = 1; reload(); });

  const sortSel = select([
    ['newest', 'Newest First'],
    ['oldest', 'Oldest First'],
    ['amount_desc', 'Amount (High to Low)'],
    ['amount_asc', 'Amount (Low to High)']
  ], filters.sort, (v) => { filters.sort = v; filters.page = 1; reload(); });

  host.replaceChildren(
    h('div', { class: 'search-wrap' }, icon('search', 16), q),
    statusSel, typeSel, tierSel, sortSel);
}

function select(options, value, onChange) {
  const el = h('select', { class: 'select', 'aria-label': 'Filter' },
    options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

/* ---------- list & table ---------- */

function renderList(host, pagerHost, data, reload) {
  host.replaceChildren();
  const subs = data.submissions || [];
  const cur = ctx.config?.org?.base_currency || 'MYR';

  if (!subs.length) {
    host.appendChild(empty('doc', 'No Matching Submissions',
      'Try adjusting your search query or filters, or submit a new claim report.',
      h('a', { class: 'btn btn-primary', href: '#/submit' }, icon('plus', 15), 'New Submission')));
    pagerHost.replaceChildren();
    return;
  }

  if (viewMode === 'table') {
    host.appendChild(renderTable(subs, cur, reload));
  } else {
    for (const s of subs) host.appendChild(subCard(s, cur, reload));
  }

  const pages = data.pages || 1;
  pagerHost.replaceChildren(
    h('span', { class: 'tiny muted' }, `Page ${data.page} of ${pages} · ${data.total} total records`),
    h('div', { class: 'row', style: { gap: '6px' } },
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: data.page <= 1, onClick: () => { filters.page = Math.max(1, filters.page - 1); reload(); } }, 'Previous'),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: data.page >= pages, onClick: () => { filters.page = Math.min(pages, filters.page + 1); reload(); } }, 'Next')));
}

function renderTable(subs, cur, reload) {
  const wrap = h('div', { class: 'table-wrap' });
  const table = h('table', { class: 'data' });

  const thead = h('thead', {},
    h('tr', {},
      h('th', {}, 'Submission ID'),
      h('th', {}, 'Partner & Tier'),
      h('th', {}, 'Title & Type'),
      h('th', {}, 'Activity Date'),
      h('th', { class: 'num' }, 'Declared'),
      h('th', { class: 'num' }, 'Approved'),
      h('th', {}, 'Status'),
      h('th', {}, 'Ageing / SLA'),
      h('th', { class: 'actions-col' }, 'Actions')
    )
  );

  const tbody = h('tbody', {}, subs.map((s) => {
    const tr = h('tr', { class: 'interactive' });
    tr.addEventListener('click', (e) => {
      // Don't trigger row navigation if user clicked inside action buttons or links
      if (e.target.closest('button') || e.target.closest('a')) return;
      location.hash = `#/listing/${encodeURIComponent(s.submission_id)}`;
    });

    // ID
    const tdId = h('td', {},
      h('a', { class: 'link mono tiny', style: { fontWeight: 700 }, href: `#/listing/${encodeURIComponent(s.submission_id)}` }, s.submission_id)
    );

    // Partner & Tier
    const tdPartner = h('td', {},
      h('b', { style: { display: 'block', fontSize: '13px' } }, s.partner_name || s.partner_id || '—'),
      h('span', { class: 'tiny muted' }, s.partner_tier || 'Unassigned')
    );

    // Title & Type
    const tdTitle = h('td', { style: { maxWidth: '320px' } },
      h('div', { style: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, s.title || s.submission_id),
      h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } },
        h('span', { class: 'chip', style: { fontSize: '10.5px', padding: '2px 7px' } }, s.submission_type === 'PRE_APPROVAL' ? 'Pre-approval' : 'Claim'),
        s.attachments_count ? h('span', { class: 'tiny muted' }, `${s.attachments_count} files`) : null
      ),
      s.latest_comment && s.latest_comment.text
        ? h('div', {
            class: 'tiny muted',
            title: s.latest_comment.text,
            style: { marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '310px' }
          },
            icon('comment', 11),
            h('span', { style: { fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis' } },
              `${s.latest_comment.badge ? `[${s.latest_comment.badge}] ` : ''}${s.latest_comment.text.length > 55 ? s.latest_comment.text.slice(0, 52) + '…' : s.latest_comment.text}`
            )
          )
        : null
    );

    // Activity Date
    const tdDate = h('td', { class: 'tiny muted' }, s.activity_date ? dateOnly(s.activity_date) : relTime(s.submitted_at));

    // Declared Amount
    const tdDeclared = h('td', { class: 'num' },
      h('b', { class: 'num' }, money(s.amount, s.currency || cur))
    );

    // Approved Amount
    const tdApproved = h('td', { class: 'num' },
      s.approved_amount !== null && s.approved_amount !== undefined
        ? h('b', { class: 'num ok' }, money(s.approved_amount, s.currency || cur))
        : h('span', { class: 'muted' }, '—')
    );

    // Status
    const tdStatus = h('td', {}, stateBadge(s.state, s.ui_status));

    // Ageing / SLA
    const tdAgeing = h('td', {},
      s.sla_breached
        ? h('span', { class: 'sla-flag' }, icon('alert', 12), `Breached · ${FMT_DAYS(s.ageing_days)}`)
        : h('span', { class: 'tiny muted' }, `${FMT_DAYS(s.ageing_days)} ageing`)
    );

    // Actions
    const tdActions = h('td', { class: 'actions-col' },
      h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '6px' } },
        h('a', { class: 'btn btn-ghost btn-sm', href: `#/listing/${encodeURIComponent(s.submission_id)}` }, 'View'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => askDelete(s, reload) }, icon('trash', 13))
      )
    );

    tr.append(tdId, tdPartner, tdTitle, tdDate, tdDeclared, tdApproved, tdStatus, tdAgeing, tdActions);
    return tr;
  }));

  table.append(thead, tbody);
  wrap.appendChild(table);
  return wrap;
}

function subCard(s, cur, reload) {
  const el = h('article', { class: 'sub-card', dataset: { status: s.ui_status || 'pending' } });
  el.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    location.hash = `#/listing/${encodeURIComponent(s.submission_id)}`;
  });

  const head = h('div', { class: 'sc-head' },
    h('a', { class: 'sc-title', href: `#/listing/${encodeURIComponent(s.submission_id)}` },
      h('b', {}, s.title || s.submission_id),
      h('span', { class: 'mono tiny muted' }, s.submission_id)),
    stateBadge(s.state, s.ui_status));

  const meta = h('div', { class: 'sc-meta' },
    h('span', { class: 'm' }, icon('user', 13), s.partner_name || s.partner_id || '—'),
    h('span', { class: 'm' }, icon('layers', 13), s.partner_tier || 'Unassigned'),
    h('span', { class: 'm' }, icon(s.submission_type === 'PRE_APPROVAL' ? 'shield' : 'money', 13), s.submission_type === 'PRE_APPROVAL' ? 'Pre-approval' : 'Claim'),
    h('span', { class: 'm' }, icon('clock', 13), relTime(s.submitted_at)),
    s.activity_date ? h('span', { class: 'm' }, icon('activity', 13), `Activity ${dateOnly(s.activity_date)}`) : null,
    s.attachments_count ? h('span', { class: 'm' }, icon('doc', 13), `${s.attachments_count} files`) : null,
    s.parent_pre_approval_id ? h('a', { class: 'm link', href: `#/listing/${encodeURIComponent(s.parent_pre_approval_id)}` }, icon('link', 13), s.parent_pre_approval_id) : null);

  const flags = h('div', { class: 'sc-flags' },
    s.sla_breached ? h('span', { class: 'sla-flag' }, icon('alert', 12), `SLA Breached · ${FMT_DAYS(s.ageing_days)}`) : (s.ageing_days ? h('span', { class: 'chip' }, `${FMT_DAYS(s.ageing_days)} ageing`) : null),
    s.open_questions ? h('span', { class: 'chip chip-warn' }, icon('comment', 12), `${s.open_questions} open questions`) : null,
    s.security_findings ? h('span', { class: 'chip chip-no' }, icon('shield', 12), `${s.security_findings} security findings`) : null,
    s.amount_confidence !== null && s.amount_confidence !== undefined
      ? h('span', { class: `chip ${s.amount_confidence < 0.90 ? 'chip-warn' : 'chip-ok'}` }, `Amount confidence ${Math.round(s.amount_confidence * 100)}%`) : null,
    s.verdict ? h('span', { class: `chip ${s.verdict === 'PASSED' ? 'chip-ok' : s.verdict === 'POLICY_BLOCKED' ? 'chip-no' : 'chip-warn'}` }, s.verdict.replace(/_/g, ' ').toLowerCase()) : null,
    ...(s.document_types || []).slice(0, 4).map((d) => h('span', { class: 'chip chip-doc' }, d)));

  const money2 = h('div', { class: 'sc-money' },
    h('b', { class: 'num' }, money(s.amount, s.currency || cur)),
    s.approved_amount !== null && s.approved_amount !== undefined
      ? h('span', { class: 'tiny' }, h('i', {}, 'Approved: '), h('b', { class: 'num ok' }, money(s.approved_amount, s.currency || cur)))
      : null);

  const actions = h('div', { class: 'sc-actions' },
    h('a', { class: 'btn btn-primary btn-sm', href: `#/listing/${encodeURIComponent(s.submission_id)}` }, icon('search', 14), 'View Details'),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: (e) => { e.stopPropagation(); askDelete(s, reload); } }, icon('trash', 14), 'Delete'));

  // Latest AI Agent / Boss Skill comment preview
  let commentBox = null;
  if (s.latest_comment && s.latest_comment.text) {
    const raw = s.latest_comment.text;
    const shortText = raw.length > 140 ? raw.slice(0, 137) + '…' : raw;
    const author = s.latest_comment.author || 'AI Agent';
    const badgeStr = s.latest_comment.badge ? `[${s.latest_comment.badge}] ` : '';
    commentBox = h('div', { class: 'sc-rec sc-comment-snip', title: raw },
      icon('comment', 13),
      h('span', { class: 'sc-comment-text', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
        h('b', { style: { color: 'var(--ink)' } }, `${badgeStr}${author}: `),
        shortText
      )
    );
  }

  let recBox = null;
  if (s.recommended_action) {
    recBox = h('div', { class: 'sc-rec' }, icon('spark', 13), h('span', {}, s.recommended_action));
  } else if (s.rules_summary) {
    const summaryStr = typeof s.rules_summary === 'object'
      ? `${s.rules_summary.passed ?? 0}/${s.rules_summary.total ?? 0} rules passed`
      : String(s.rules_summary);
    recBox = h('div', { class: 'sc-rec muted' }, icon('scale', 13), h('span', {}, summaryStr));
  }

  el.append(head, meta, flags, h('div', { class: 'sc-foot' }, money2, actions));
  if (commentBox) el.append(commentBox);
  if (recBox) el.append(recBox);
  return el;
}

function FMT_DAYS(d) { return `${d ?? 0}d`; }

function askDelete(s, reload) {
  const confirmInput = h('input', { class: 'input mono', placeholder: s.submission_id, 'aria-label': 'Confirmation text', 'data-autofocus': '' });
  const reason = h('input', { class: 'input', placeholder: 'Reason for deletion (optional)', 'aria-label': 'Reason' });
  const okBtn = h('button', { class: 'btn btn-danger', type: 'button', disabled: true }, 'Confirm Deletion');
  const sync = () => { okBtn.disabled = confirmInput.value.trim() !== s.submission_id && confirmInput.value.trim() !== 'DELETE'; };
  confirmInput.addEventListener('input', sync);

  okBtn.addEventListener('click', async () => {
    const r = await withAuthority(async (approver) => api.deleteSubmission(s.submission_id, {
      confirm_text: confirmInput.value.trim(),
      reason: reason.value.trim() || null,
      operator_email: approver.email
    }), 'Deleting a submission record requires an authorised approver session.');
    if (!r.ok) return;
    closeModal();
    toast(r.result?.note || 'Soft-deleted successfully. Immutable audit trail preserved.', 'ok', null, 6000);
    reload();
  });

  modal({
    title: 'Confirm Submission Deletion',
    subtitle: `Delete submission record ${s.submission_id}?`,
    danger: true,
    body: h('div', { class: 'stack' },
      h('div', { class: 'callout danger' }, h('span', { class: 'ci' }, icon('alert', 18)),
        h('div', {},
          h('b', {}, `${s.submission_id} — ${s.title || ''}`),
          h('div', { class: 'tiny' }, `${s.partner_name || s.partner_id || '—'} · ${money(s.amount, s.currency)} · ${prettyState(s.state)}`))),
      h('p', { class: 'tiny muted' }, 'This is a soft delete: the record will be hidden from the active listing, but its immutable cryptographic audit trail remains fully preserved (Iron Invariant 4).'),
      h('div', { class: 'field' },
        h('label', { class: 'req' }, `Type ${s.submission_id} or DELETE to confirm:`),
        confirmInput),
      h('div', { class: 'field' }, h('label', {}, 'Reason (optional):'), reason)),
    actions: [
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Cancel'),
      okBtn
    ]
  });
}
