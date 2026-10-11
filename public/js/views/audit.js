/* Global Immutable Audit Log — Iron Invariant 4: append-only ledger of all transitions. */

import { api, ApiError } from '../api.js';
import {
  h, icon, toast, dateTime, relTime, badge, empty, prettyState
} from '../dom.js';

const filters = { actorType: 'all', errorCode: 'all', submissionId: '', limit: 100 };

export async function render() {
  const wrap = h('div', { class: 'stack' });

  const statsHost = h('div', { class: 'grid g-4', id: 'auditStats' });
  const toolbarHost = h('div', { class: 'toolbar' });
  const timelineHost = h('div', { class: 'stack' });

  wrap.append(
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', { class: 'page-title' }, h('span', { class: 'grad' }, 'Audit Log')),
        h('p', { class: 'page-sub' },
          'Iron Invariant 4: Append-only immutable audit trail. Every state transition, agent assessment, and human decision appends a permanent log entry; soft deletions preserve complete history.')),
      h('div', { class: 'page-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => load() }, icon('refresh', 15), 'Refresh'),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => exportAll() }, icon('download', 15), 'Export JSON'))),
    statsHost,
    toolbarHost,
    timelineHost
  );

  let allEvents = [];

  buildToolbar(toolbarHost, () => load());

  async function load() {
    statsHost.replaceChildren(...Array.from({ length: 4 }, () => h('div', { class: 'skeleton', style: { height: '80px' } })));
    timelineHost.replaceChildren(...Array.from({ length: 5 }, () => h('div', { class: 'skeleton', style: { height: '110px', marginBottom: '10px' } })));

    try {
      const res = await api.audit({ limit: filters.limit });
      allEvents = res.events || [];

      renderStats(statsHost, allEvents);
      renderEvents(timelineHost, allEvents);
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.code} — ${e.message}` : String(e.message || e);
      statsHost.replaceChildren();
      timelineHost.replaceChildren(h('div', { class: 'callout danger' }, h('span', { class: 'ci' }, icon('alert', 18)), h('div', {}, msg)));
    }
  }

  function exportAll() {
    const blob = new Blob([JSON.stringify(allEvents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `audit-events-${Date.now().toString(36)}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Audit log exported successfully.', 'ok');
  }

  await load();
  return wrap;
}

function renderStats(host, list) {
  const total = list.length;
  const human = list.filter((e) => (e.actor_type || '').startsWith('HUMAN')).length;
  const agent = list.filter((e) => (e.actor_type || '').includes('AGENT') || (e.actor_type || '').includes('SYSTEM')).length;
  const errs = list.filter((e) => !!e.error_code).length;

  host.replaceChildren(
    statMini('clock', 'Total Audit Events', String(total)),
    statMini('user', 'Human Determinations', String(human), 'ok'),
    statMini('activity', 'System & Agent Runs', String(agent), 'brand'),
    statMini('alert', 'Threats & Blockers', String(errs), errs > 0 ? 'warn' : 'ok')
  );
}

function statMini(iconName, label, value, tone = '') {
  return h('div', { class: `stat${tone ? ' mini-stat' : ''}`, dataset: tone ? { accent: tone === 'ok' ? 'approved' : tone === 'warn' ? 'pending' : 'brand' } : {} },
    h('div', { class: 'stat-top' }, h('span', { class: 'si' }, icon(iconName, 16)), h('span', { class: 'sl' }, label)),
    h('div', { class: 'stat-value sm' }, value));
}

function buildToolbar(host, onChange) {
  const actorSelect = h('select', { class: 'select', 'aria-label': 'Actor type' },
    h('option', { value: 'all' }, 'All Actors'),
    h('option', { value: 'HUMAN_APPROVER' }, 'Human Approver'),
    h('option', { value: 'HUMAN' }, 'Human Operator'),
    h('option', { value: 'EXTERNAL_PARTNER' }, 'External Partner'),
    h('option', { value: 'SYSTEM_AGENT' }, 'System Agent')
  );

  const errorSelect = h('select', { class: 'select', 'aria-label': 'Outcome type' },
    h('option', { value: 'all' }, 'All Outcomes'),
    h('option', { value: 'SECURITY_THREAT' }, 'Security Threats'),
    h('option', { value: 'POLICY_BLOCKED' }, 'Policy Blocked'),
    h('option', { value: 'DUPLICATE_INVOICE' }, 'Duplicate Invoices'),
    h('option', { value: 'ERRORS_ONLY' }, 'Any Error Code')
  );

  const searchInput = h('input', {
    class: 'input', placeholder: 'Search by Submission ID, Run ID, Rule ID, Actor…',
    value: filters.submissionId, 'aria-label': 'Search'
  });

  const limitSelect = h('select', { class: 'select', 'aria-label': 'Limit' },
    h('option', { value: '50' }, 'Latest 50 entries'),
    h('option', { value: '100', selected: 'true' }, 'Latest 100 entries'),
    h('option', { value: '200' }, 'Latest 200 entries')
  );

  actorSelect.addEventListener('change', () => { filters.actorType = actorSelect.value; onChange(); });
  errorSelect.addEventListener('change', () => { filters.errorCode = errorSelect.value; onChange(); });
  limitSelect.addEventListener('change', () => { filters.limit = Number(limitSelect.value); onChange(); });

  let timer;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      filters.submissionId = searchInput.value.trim().toLowerCase();
      onChange();
    }, 240);
  });

  host.replaceChildren(
    h('div', { class: 'search-wrap' }, icon('search', 16), searchInput),
    actorSelect, errorSelect, limitSelect
  );
}

function renderEvents(host, list) {
  let filtered = list.filter((e) => {
    if (filters.actorType !== 'all') {
      if (filters.actorType === 'HUMAN_APPROVER' && e.actor_type !== 'HUMAN_APPROVER') return false;
      if (filters.actorType === 'HUMAN' && !['HUMAN', 'HUMAN_ADMIN'].includes(e.actor_type)) return false;
      if (filters.actorType === 'EXTERNAL_PARTNER' && e.actor_type !== 'EXTERNAL_PARTNER') return false;
      if (filters.actorType === 'SYSTEM_AGENT' && !['SYSTEM_AGENT', 'SYSTEM'].includes(e.actor_type)) return false;
    }
    if (filters.errorCode !== 'all') {
      if (filters.errorCode === 'ERRORS_ONLY' && !e.error_code) return false;
      if (filters.errorCode === 'SECURITY_THREAT' && !(e.error_code || '').includes('SECURITY')) return false;
      if (filters.errorCode === 'POLICY_BLOCKED' && !(e.error_code || '').includes('POLICY') && e.new_state !== 'POLICY_BLOCKED') return false;
      if (filters.errorCode === 'DUPLICATE_INVOICE' && !(e.error_code || '').includes('DUP')) return false;
    }
    if (filters.submissionId) {
      const q = filters.submissionId;
      const target = `${e.submission_id || ''} ${e.run_id || ''} ${e.rule_id || ''} ${e.actor || ''} ${e.error_code || ''} ${JSON.stringify(e.details || {})}`.toLowerCase();
      if (!target.includes(q)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    host.replaceChildren(empty('clock', 'No Matching Audit Events',
      'No audit entries found matching the current filters. Try resetting search criteria.'));
    return;
  }

  const cardNode = h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, `Sequential Event Stream (${filtered.length} Events)`),
        h('div', { class: 'sub' }, 'Every record binds a unique event_id, timestamp, and tamper-evident execution context')),
      badge('APPEND ONLY', 'ok')),
    h('div', { class: 'card-body' },
      h('ol', { class: 'timeline' }, filtered.map((e) => {
        const isHuman = (e.actor_type || '').startsWith('HUMAN');
        const hasErr = !!e.error_code;
        const isSecurity = (e.error_code || '').includes('SECURITY') || e.new_state === 'SECURITY_QUARANTINE';

        return h('li', { class: `tl-item${hasErr ? ' err' : ''}${isHuman ? ' human' : ''}` },
          h('span', { class: 'tl-dot' }, icon(isSecurity ? 'shield' : isHuman ? 'user' : hasErr ? 'alert' : 'activity', 13)),
          h('div', { style: { width: '100%' } },
            h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', alignItems: 'center' } },
              h('b', { class: 'mono tiny' }, e.previous_state ? `${e.previous_state} → ${e.new_state}` : (e.new_state || e.details?.event || 'AUDIT_EVENT')),
              badge(e.actor_type || 'SYSTEM', isHuman ? 'brand' : 'neutral'),
              e.error_code ? badge(e.error_code, isSecurity ? 'purple' : 'no') : null,
              e.rule_id ? badge(e.rule_id, 'info') : null,
              e.submission_id ? h('a', { class: 'link mono tiny', href: `#/listing/${encodeURIComponent(e.submission_id)}` }, e.submission_id) : null
            ),
            h('div', { class: 'tiny muted', style: { marginTop: '4px' } },
              `${e.actor || 'system'} · ${dateTime(e.created_at)} · ${relTime(e.created_at)}`),
            h('div', { class: 'mono tiny muted', style: { marginTop: '2px' } }, `event_id: ${e.event_id || '—'}`),
            e.details && Object.keys(e.details).length
              ? h('details', { style: { marginTop: '6px' } },
                  h('summary', { class: 'tiny muted', style: { cursor: 'pointer' } }, 'View Details JSON'),
                  h('pre', { class: 'mono tiny', style: { marginTop: '6px', padding: '10px', background: 'var(--surface-sunken)', borderRadius: '8px', overflow: 'auto', maxHeight: '200px' } }, JSON.stringify(e.details, null, 2)))
              : null,
            (e.evidence_refs || []).length
              ? h('div', { class: 'tiny muted', style: { marginTop: '4px' } },
                  'Evidence: ',
                  h('span', { class: 'mono' }, e.evidence_refs.map((r) => r.doc_id || r.filename || r).join(', ')))
              : null
          )
        );
      }))
    )
  );

  host.replaceChildren(cardNode);
}
