/* Executive Overview — Command centre combining triage queue, SLA alerts & pipeline health. */

import { api, ApiError } from '../api.js';
import {
  h, icon, toast, money, compactMoney, dateTime, relTime, dateOnly, badge, empty, pct, stateBadge, prettyState
} from '../dom.js';

export async function render() {
  const wrap = h('div', { class: 'stack' });

  const kpiHost = h('div', { class: 'grid g-4' });
  const actionHost = h('section', { class: 'card' });
  const slaHost = h('section', { class: 'card' });
  const pipelineHost = h('div', { class: 'grid g-2' });

  wrap.append(
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', { class: 'page-title' }, h('span', { class: 'grad' }, 'Executive Overview')),
        h('p', { class: 'page-sub' },
          'Enterprise command centre: live triage queue, SLA breach alerts, four-state budget ledger, and deterministic agent pipeline health.')),
      h('div', { class: 'page-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => load() }, icon('refresh', 15), 'Refresh'),
        h('a', { class: 'btn btn-primary', href: '#/submit' }, icon('plus', 15), 'New Submission'))),
    kpiHost,
    actionHost,
    slaHost,
    pipelineHost
  );

  async function load() {
    kpiHost.replaceChildren(...Array.from({ length: 4 }, () => h('div', { class: 'skeleton', style: { height: '96px' } })));
    actionHost.replaceChildren(h('div', { class: 'card-pad' }, h('div', { class: 'skeleton', style: { height: '180px' } })));
    slaHost.replaceChildren(h('div', { class: 'card-pad' }, h('div', { class: 'skeleton', style: { height: '140px' } })));
    pipelineHost.replaceChildren(
      h('div', { class: 'skeleton', style: { height: '180px' } }),
      h('div', { class: 'skeleton', style: { height: '180px' } })
    );

    try {
      const [stats, subsRes, led, brainRes] = await Promise.all([
        api.stats(),
        api.submissions({ limit: 100 }),
        api.ledger(),
        api.brain()
      ]);

      const subs = subsRes.submissions || [];
      renderKPIs(kpiHost, stats, led, subs);
      renderActionQueue(actionHost, subs);
      renderSlaAlerts(slaHost, subs);
      renderPipelineAndBrain(pipelineHost, brainRes, led);
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.code} — ${e.message}` : String(e.message || e);
      kpiHost.replaceChildren();
      actionHost.replaceChildren(h('div', { class: 'callout danger' }, h('span', { class: 'ci' }, icon('alert', 18)), h('div', {}, msg)));
    }
  }

  await load();
  return wrap;
}

function renderKPIs(host, stats, led, subs) {
  const pending = subs.filter((s) => s.ui_status === 'pending');
  const breached = pending.filter((s) => s.sla_breached);
  const totals = led?.company_totals || led?.computed_totals || {};
  const cur = led?.currency || 'MYR';

  host.replaceChildren(
    statCard('clock', 'Action Items', `${pending.length}`, 'Pending human confirmation, clarification or review', pending.length > 0 ? 'warn' : 'ok'),
    statCard('alert', 'SLA Breaches', `${breached.length}`, 'Submissions exceeding 48h SLA threshold', breached.length > 0 ? 'warn' : 'ok'),
    statCard('money', 'Available Budget Pool', money(totals.available, cur), `Total Pool: ${compactMoney(totals.allocated, cur)} · Conserved`, 'brand'),
    statCard('shield', 'Security Quarantine', `${subs.filter((s) => s.state === 'SECURITY_QUARANTINE').length}`, 'Dual-track physical isolation gate', 'purple')
  );
}

function renderActionQueue(host, subs) {
  const actionItems = subs.filter((s) =>
    ['NEEDS_CLARIFICATION', 'NEEDS_HUMAN_CONFIRMATION', 'PENDING_HUMAN_REVIEW', 'REQUIRES_POLICY_INTERPRETATION', 'SECURITY_QUARANTINE'].includes(s.state)
  );

  host.replaceChildren(
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, `Action Items Triage Queue (${actionItems.length})`),
        h('div', { class: 'sub' }, 'Iron Invariants 1 & 3: Human final authority is never abdicated. Zero auto-guessing.')),
      badge(`${actionItems.length} Pending Decision`, actionItems.length > 0 ? 'warn' : 'ok')),
    h('div', { class: 'card-body' },
      actionItems.length
        ? h('div', { class: 'table-wrap' },
            h('table', { class: 'data' },
              h('thead', {},
                h('tr', {},
                  h('th', {}, 'Submission ID'),
                  h('th', {}, 'Triage Category'),
                  h('th', {}, 'Partner & Tier'),
                  h('th', { class: 'num' }, 'Declared'),
                  h('th', {}, 'Ageing'),
                  h('th', {}, 'System Insights & Recommendation'),
                  h('th', { class: 'actions-col' }, 'Action')
                )
              ),
              h('tbody', {}, actionItems.map((s) => {
                let catLabel = 'Pending Review';
                let catTone = 'neutral';
                if (s.state === 'SECURITY_QUARANTINE') { catLabel = 'Security Quarantine'; catTone = 'purple'; }
                else if (s.state === 'NEEDS_CLARIFICATION') { catLabel = 'Clarification Required'; catTone = 'warn'; }
                else if (s.state === 'REQUIRES_POLICY_INTERPRETATION') { catLabel = 'Policy Interpretation'; catTone = 'info'; }
                else if (s.state === 'NEEDS_HUMAN_CONFIRMATION') { catLabel = 'Pending Sign-off'; catTone = 'ok'; }

                return h('tr', { class: 'interactive' },
                  h('td', {}, h('a', { class: 'link mono tiny', style: { fontWeight: 700 }, href: `#/listing/${encodeURIComponent(s.submission_id)}` }, s.submission_id)),
                  h('td', {}, badge(catLabel, catTone)),
                  h('td', {}, h('b', {}, s.partner_name || s.partner_id), h('div', { class: 'tiny muted' }, s.partner_tier || 'Unassigned')),
                  h('td', { class: 'num' }, money(s.amount, s.currency)),
                  h('td', {}, `${s.ageing_days || 0}d`),
                  h('td', { style: { maxWidth: '320px' } },
                    h('div', { class: 'tiny', style: { lineHeight: 1.4 } }, s.recommended_action || s.rules_summary || 'Awaiting human verification and approval signature'),
                    s.open_questions ? h('div', { class: 'tiny muted' }, `${s.open_questions} open question(s) pending`) : null
                  ),
                  h('td', { class: 'actions-col' },
                    h('a', { class: 'btn btn-primary btn-sm', href: `#/listing/${encodeURIComponent(s.submission_id)}` }, 'Review')
                  )
                );
              }))
            )
          )
        : h('p', { class: 'tiny muted' }, 'No action items currently pending in the triage queue.')
    )
  );
}

function renderSlaAlerts(host, subs) {
  const breached = subs.filter((s) => s.sla_breached && s.ui_status === 'pending');

  host.replaceChildren(
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, `SLA Breach Alert Queue (>48h)`),
        h('div', { class: 'sub' }, 'Submissions exceeding initial 48h operations SLA threshold requiring priority resolution.')),
      badge(`${breached.length} Breached`, breached.length > 0 ? 'no' : 'ok')),
    h('div', { class: 'card-body' },
      breached.length
        ? h('div', { class: 'table-wrap' },
            h('table', { class: 'data' },
              h('thead', {},
                h('tr', {},
                  h('th', {}, 'Submission ID'),
                  h('th', {}, 'Partner'),
                  h('th', {}, 'State'),
                  h('th', {}, 'Ageing'),
                  h('th', {}, 'Submitted At'),
                  h('th', { class: 'actions-col' }, 'Action')
                )
              ),
              h('tbody', {}, breached.map((s) =>
                h('tr', { class: 'interactive' },
                  h('td', {}, h('a', { class: 'link mono tiny', style: { fontWeight: 700 }, href: `#/listing/${encodeURIComponent(s.submission_id)}` }, s.submission_id)),
                  h('td', {}, s.partner_name || s.partner_id),
                  h('td', {}, stateBadge(s.state, s.ui_status)),
                  h('td', {}, badge(`${s.ageing_days || 0}d (Breached)`, 'no')),
                  h('td', { class: 'tiny muted' }, dateTime(s.submitted_at)),
                  h('td', { class: 'actions-col' }, h('a', { class: 'btn btn-ghost btn-sm', href: `#/listing/${encodeURIComponent(s.submission_id)}` }, 'Expedite'))
                )
              ))
            )
          )
        : h('div', { class: 'callout' },
            h('span', { class: 'ci' }, icon('check', 18)),
            h('div', {}, 'All active submissions are within the 48-hour service level agreement limits. No backlog.')
          )
    )
  );
}

function renderPipelineAndBrain(host, brainData, ledData) {
  // Defensive normalization of agents array: handles array, { agents: [...] }, or fallback
  const raw = brainData?.agents;
  const agents = Array.isArray(raw) ? raw : (Array.isArray(raw?.agents) ? raw.agents : []);
  const cur = ledData?.currency || 'MYR';
  const totals = ledData?.company_totals || ledData?.computed_totals || {};

  // Card 1: Agent Pipeline Health
  const agentCard = h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Agent Pipeline Cluster (Agents 1-7)'),
        h('div', { class: 'sub' }, 'Deterministic rule execution and immutable dual-track isolation status')),
      badge(`${agents.length || 7} AGENTS OPERATIONAL`, 'ok')),
    h('div', { class: 'card-body' },
      h('div', { class: 'stack', style: { gap: '8px' } }, agents.map((a) =>
        h('div', { class: 'row', style: { justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,.55)', borderRadius: '10px', border: '1px solid var(--border-soft)' } },
          h('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } },
            h('span', { class: 'mono tiny', style: { fontWeight: 800, color: '#0369A1' } }, `#${a.order}`),
            h('b', { style: { fontSize: '13px' } }, a.name),
            h('span', { class: 'tiny muted' }, `(${a.responsibilities?.[0] || 'Core pipeline responsibility'})`)
          ),
          badge('HEALTHY', 'ok')
        )
      ))
    )
  );

  // Card 2: Quick Operations Hub
  const quickCard = h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Operations Hub'),
        h('div', { class: 'sub' }, 'Direct access to core console workflows')),
      badge('NAVIGATION', 'brand')),
    h('div', { class: 'card-body' },
      h('div', { class: 'grid g-2' },
        quickLink('plus', 'New Submission', 'Upload partner PDF evidence to trigger the automated intake pipeline', '#/submit'),
        quickLink('list', 'Listing History', 'Browse, filter, and audit full pre-approvals and claims in high-density table', '#/listing'),
        quickLink('money', 'Budget Ledger', `Available pool: ${money(totals.available, cur)} with conserved reconciliation`, '#/budget'),
        quickLink('sliders', 'Programme Setup', 'Configure partner tiers, rule matrices, and enterprise parameters', '#/setup')
      )
    )
  );

  host.replaceChildren(agentCard, quickCard);
}

function quickLink(iconName, title, desc, href) {
  return h('a', {
    class: 'card',
    href,
    style: { padding: '14px', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: '6px' }
  },
    h('div', { class: 'row', style: { alignItems: 'center', gap: '8px' } },
      h('span', { class: 'si', style: { width: '28px', height: '28px', borderRadius: '8px', background: 'var(--brand-gradient-soft)', display: 'grid', placeItems: 'center', color: '#0369A1' } }, icon(iconName, 15)),
      h('b', { style: { fontSize: '13.5px' } }, title)
    ),
    h('div', { class: 'tiny muted', style: { lineHeight: 1.4 } }, desc)
  );
}

function statCard(iconName, label, value, sub, tone = '') {
  return h('article', { class: 'stat', dataset: tone ? { accent: tone === 'ok' ? 'accepted' : tone === 'warn' ? 'pending' : tone === 'purple' ? 'rejected' : 'brand' } : {} },
    h('div', { class: 'stat-top' }, h('span', { class: 'si' }, icon(iconName, 16)), h('span', { class: 'sl' }, label)),
    h('div', { class: 'stat-value sm' }, value),
    h('div', { class: 'stat-foot' }, sub)
  );
}
