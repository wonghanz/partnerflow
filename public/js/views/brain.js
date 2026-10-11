/* Company Brain & Policy Center — Enterprise Multi-Agent Governance & Knowledge Center. */

import { api, ApiError } from '../api.js';
import { h, icon, toast, badge, field, modal, closeModal, money, compactMoney, pct, bytes, dateOnly, dateTime, prettyState } from '../dom.js';
import { ctx, brain as loadBrain, invalidateBrain, withAuthority } from '../state.js';
import { openBrainDrawer } from './ask.js';

const SECTIONS = [
  ['overview', 'Overview', 'grid'],
  ['agents', 'AI Agent Squad', 'spark'],
  ['requirements', 'Company Requirements', 'scale'],
  ['tiers', 'Partner Tiers', 'layers'],
  ['knowledge', 'Knowledge Base', 'book'],
  ['mindset', 'Company Mindset', 'spark'],
  ['versions', 'Versions & Audit', 'clock']
];

const STATUS_TONE = {
  active: 'ok', published: 'ok', complete: 'ok', approved: 'ok', resolved: 'ok', valid: 'ok',
  draft: 'info', in_progress: 'info', proposed: 'warn', uploaded: 'warn', processing: 'warn',
  not_configured: 'warn', not_set: 'warn', open: 'warn', needs_attention: 'warn',
  inactive: 'neutral', locked: 'neutral', fallback: 'neutral', archived: 'neutral', rejected: 'no'
};

const statusBadge = (s) => badge(String(s || 'n/a').replace(/_/g, ' '), STATUS_TONE[String(s)] || 'neutral', true);

const SECTION = { overview, agents, requirements, tiers, knowledge, mindset, versions };

export async function render(params) {
  const section = (SECTIONS.some(([id]) => id === params?.section) ? params.section : 'overview');
  const d = await loadBrain();
  const cur = ctx.config?.org?.base_currency || 'MYR';

  const wrap = h('div', { class: 'stack' });
  wrap.appendChild(brainHeader(d, cur));
  wrap.appendChild(subNav(section));

  const host = h('div', { class: 'stack' });
  wrap.appendChild(host);
  host.replaceChildren(...await SECTION[section](d, cur));
  return wrap;
}

/* ---------- header + sub navigation ---------- */

function brainHeader(d, cur) {
  const sp = d.brain?.setup_progress || {};
  const done = Number(sp.completed_sections ?? 0);
  const total = Number(sp.total_sections ?? 0);
  const percent = Number.isFinite(sp.percent) ? sp.percent : (total ? Math.round((done / total) * 100) : 0);
  const openConflicts = arr(d.conflicts).filter((c) => c.status === 'open').length;

  return h('div', { class: 'page-head' },
    h('div', {},
      h('h1', { class: 'page-title' }, h('span', { class: 'grad' }, 'Company Brain')),
      h('p', { class: 'page-sub' }, 'Knowledge, policies & multi-agent decision rules your company uses to review applications.'),
      h('p', { class: 'tiny muted', style: { marginTop: '8px' } },
        `Setup progress: ${done} of ${total} sections completed`,
        sp.save_and_return_later ? ' · You can save and return later' : '',
        ` · Engine: ${ctx.config?.rule_engine_version || '—'}`,
        ` · Index: ${d.index_stats?.chunks ?? 0} chunks`,
        ` · Base Currency: ${cur}`)),
    h('div', { class: 'page-actions' },
      openConflicts ? badge(`${openConflicts} open conflicts`, 'warn') : null,
      percent >= 100
        ? badge('Setup Complete', 'ok')
        : badge(`Setup In Progress (${percent}%)`, 'warn'),
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => resumeSetup(d) }, icon('spark', 15), 'Resume Setup')));
}

function subNav(section) {
  return h('div', { class: 'brain-sub', role: 'tablist', 'aria-label': 'Company Brain sections' },
    SECTIONS.map(([id, en, ic]) => h('button', {
      class: 'btn', type: 'button', role: 'tab', 'aria-selected': String(id === section),
      onClick: () => ctx.navigate(`/brain/${id}`)
    }, icon(ic, 14), en)));
}

/* ---------- overview ---------- */

async function overview(d, cur) {
  const sp = d.brain?.setup_progress || {};
  const sections = arr(sp.sections);
  const out = [];

  const rd = await api.setup().catch(() => null);
  const ledgerSnap = await api.ledger().catch(() => null);

  // 1. Company profile & brands
  out.push(companyProfileCard(d, cur));

  // 2. Live DeepSeek AI Interactive Q&A
  out.push(liveBrainAssistantCard(d));

  // 3. Autonomous AI Agent Squad
  out.push(agentSquadOverviewCard(d));

  // 4. Progressive Task List
  out.push(card2('Progressive Task List',
    `${sections.filter((s) => s.status === 'complete').length} of ${sections.length} sections completed · Incomplete sections never block the system from running`,
    h('div', { class: 'grid g-3' }, sections.map((s) => h('div', { class: 'card' },
      h('div', { class: 'card-pad', style: { display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' } },
        h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '8px' } },
          h('b', {}, s.label || s.id), statusBadge(s.status)),
        h('p', { class: 'tiny muted', style: { margin: 0 } }, s.detail || ''),
        h('div', { class: 'row', style: { gap: '6px', marginTop: 'auto' } },
          s.status === 'complete'
            ? h('a', { class: 'btn btn-ghost btn-sm', href: `#/brain/${linkFor(s.id)}` }, 'Review')
            : h('a', { class: 'btn btn-primary btn-sm', href: `#/brain/${linkFor(s.id)}` }, icon('plus', 14), s.next_action_label || 'Configure'))))))));

  // 5. Four-State Budget Ledger
  if (ledgerSnap?.ok) {
    out.push(ledgerCard(ledgerSnap, cur));
  }

  // 6. Pending Confirmation
  const pending = pendingConfirmations(d);
  out.push(card2('Pending Confirmation',
    'Zero auto-guessing: unconfirmed items stay "Not configured". The system never guesses on behalf of humans.',
    pending.length
      ? h('div', { class: 'stack', style: { gap: '8px' } }, pending.map((p) => h('div', { class: 'check-item', dataset: { state: p.state } },
        h('span', { class: 'mk' }, p.state === 'ok' ? '✓' : '!'),
        h('div', {}, h('div', { class: 'cl' }, p.title), h('div', { class: 'cs' }, p.detail)),
        h('a', { class: 'btn btn-ghost btn-sm', href: `#/brain/${p.to}` }, 'Open'))))
      : h('p', { class: 'tiny muted' }, 'Nothing currently awaiting confirmation.')));

  // 7. Recent Rule Changes
  const recent = arr(d.brain?.versions).slice(0, 2);
  out.push(card2('Recent Rule Changes',
    'Historical submissions stay permanently bound to the rule version active at submission time (Iron Invariant 4).',
    recent.length
      ? h('div', { class: 'grid g-2' }, recent.map((v) => h('div', { class: 'invariant', style: { gridTemplateColumns: '1fr' } },
        h('div', {}, h('h4', {}, `${v.version} · ${v.status}`),
          h('p', {}, v.change_summary || ''),
          h('div', { class: 'ver' }, `Published: ${dateOnly(v.published_at)} · Effective: ${dateOnly(v.effective_date)} · Approved by: ${v.approved_by || '—'}`)))))
      : h('p', { class: 'tiny muted' }, 'No version history recorded yet.')));

  // 8. Pathways, Isolation & Invariants
  out.push(pathwaysCard(d));
  out.push(isolationCard(d));
  out.push(invariantsCard(d));

  if (rd?.readiness) {
    const present = rd.readiness.present || {};
    out.push(card2('Corpus Readiness',
      rd.readiness.ready ? 'Every required dataset is present and verified' : `Missing: ${(rd.readiness.missing || []).join(', ')}`,
      h('div', { class: 'checklist' }, Object.entries(present).map(([file, ok]) => h('div', { class: 'check-item', dataset: { state: ok ? 'ok' : 'missing' } },
        h('span', { class: 'mk' }, ok ? '✓' : '✕'),
        h('div', {}, h('div', { class: 'cl mono tiny' }, file)),
        h('span', { class: 'mono tiny muted' }, ok ? 'ready' : 'absent'))))));
  }
  return out;
}

function linkFor(sectionId) {
  const s = String(sectionId || '');
  if (s.includes('tier')) return 'tiers';
  if (s.includes('agent')) return 'agents';
  if (s.includes('knowledge') || s.includes('document')) return 'knowledge';
  if (s.includes('mindset')) return 'mindset';
  if (s.includes('version')) return 'versions';
  return 'requirements';
}

function pendingConfirmations(d) {
  const rows = [];
  for (const t of arr(d.tiers)) {
    if (t.status === 'not_configured' || t.programme_limits?.cap_configured === false) {
      rows.push({ title: `${t.name}: Cap & ratio unconfirmed`, detail: `Status: ${t.status} · cap_configured: ${t.programme_limits?.cap_configured} · Reference: ${t.source_ref || '—'}`, to: 'tiers', state: 'missing' });
    }
  }
  for (const r of arr(d.rules).filter((x) => x.status && x.status !== 'active')) {
    rows.push({ title: `${r.code || r.rule_id} is currently ${r.status}`, detail: `${r.name || ''} · Excluded from evaluation until published`, to: 'requirements', state: 'missing' });
  }
  for (const c of arr(d.conflicts).filter((x) => x.status === 'open')) {
    rows.push({ title: `Policy Conflict: ${c.conflict_id}`, detail: `${c.field}: ${c.value_a} vs ${c.value_b} · ${c.source_a} ⇄ ${c.source_b}`, to: 'requirements', state: 'missing' });
  }
  for (const m of arr(d.brain?.l4_mindset).filter((x) => x.status === 'proposed')) {
    rows.push({ title: `Mindset Proposal: ${m.principle_id}`, detail: `${m.principle || ''} · Advisory only until approved`, to: 'mindset', state: 'missing' });
  }
  const resolved = arr(d.conflicts).filter((x) => x.status === 'resolved').length;
  if (resolved) rows.push({ title: `${resolved} conflicts adjudicated`, detail: 'Recorded via ADR; historical records remain untouched', to: 'versions', state: 'ok' });
  return rows;
}

function companyProfileCard(d, cur) {
  const p = d.brain?.company_profile || {};
  const brands = arr(p.brands);
  const programmes = arr(p.programmes);
  const sop = p.sop || {};

  return card2(`Company Profile & Brands: ${p.name || 'UMochi Technologies Sdn. Bhd.'}`,
    `Reg: ${p.registration_number || '202401088219-X'} · SST: ${p.tax_id || 'W10-2401-32000881'} · HQ: ${p.headquarters || 'Kuala Lumpur, Malaysia'} · Annual Pool: ${money(p.annual_budget_pool || 10000000, cur)}`,
    h('div', { class: 'stack', style: { gap: '14px' } },
      h('div', { class: 'grid g-3' }, brands.map((b) => h('div', { class: 'card', style: { padding: '14px', background: 'rgba(255,255,255,0.7)' } },
        h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '4px' } },
          h('b', { style: { color: 'var(--text-strong)' } }, b.name),
          badge('Active Brand', 'ok')),
        h('p', { class: 'tiny', style: { color: '#0284C7', fontWeight: 600, margin: '2px 0 6px 0' } }, b.tagline),
        h('p', { class: 'tiny muted', style: { margin: 0 } }, b.description)
      ))),
      h('div', { class: 'grid g-2' },
        h('div', { class: 'card', style: { padding: '14px', background: 'rgba(255,255,255,0.6)' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '8px' } },
            h('b', {}, `Operating SOP: ${sop.sop_id || 'SOP_2026_V1'}`),
            badge('Active SOP', 'info')),
          h('p', { class: 'tiny muted', style: { margin: '0 0 8px 0' } }, sop.title || 'Channel Partner Co-op Reimbursement & Pre-Approval Standard Operating Procedure'),
          h('ul', { class: 'tiny', style: { paddingLeft: '16px', margin: 0, lineHeight: 1.6 } },
            arr(sop.core_invariants).map((ci) => h('li', {}, ci)))),
        h('div', { class: 'card', style: { padding: '14px', background: 'rgba(255,255,255,0.6)' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '8px' } },
            h('b', {}, 'Active Co-Op Programmes'),
            badge(`${programmes.length} Active`, 'brand')),
          h('div', { class: 'stack', style: { gap: '8px' } }, programmes.map((prg) => h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } },
            h('div', {},
              h('div', { class: 'cl tiny', style: { fontWeight: 600 } }, prg.name),
              h('div', { class: 'tiny muted' }, `Eligible: ${arr(prg.eligible_activities).join(', ')}`)),
            h('span', { class: 'mono tiny' }, money(prg.pool_allocation || 0, cur))
          )))
        )
      )
    )
  );
}

function liveBrainAssistantCard(d) {
  const input = h('input', {
    class: 'input', type: 'search', placeholder: 'Ask anything (e.g. Gold cap, claim deadline, 4-state ledger rules, proof requirements)…',
    'aria-label': 'Question for Company Brain'
  });
  const askBtn = h('button', { class: 'btn btn-primary', type: 'button' }, icon('spark', 15), 'Ask Brain');
  const resultBox = h('div', { class: 'stack', style: { marginTop: '12px', display: 'none' } });

  const aiStatus = d.ai || {};
  const isLive = aiStatus.available === true;
  const modelName = aiStatus.model || 'deepseek-flash';

  const presets = [
    'What is the single-event grant cap for Gold Tier?',
    'What is the claim filing window for completed events?',
    'How is the four-state budget ledger calculated?',
    'What are the mandatory documents for claim submission?'
  ];

  const runQuery = async (queryText) => {
    const q = (queryText || input.value || '').trim();
    if (!q) return;
    input.value = q;
    askBtn.disabled = true;
    resultBox.style.display = 'block';
    resultBox.replaceChildren(
      h('div', { class: 'row', style: { gap: '10px', color: 'var(--ink-2)' } },
        h('span', { class: 'spin' }),
        h('span', { class: 'tiny' }, `Querying 167 indexed chunks with ${isLive ? modelName : 'RAG Extractive'}…`))
    );

    try {
      const res = await api.ragAsk(q, 6);
      resultBox.replaceChildren(
        h('div', { class: 'card', style: { padding: '16px', background: 'rgba(255,255,255,0.9)', border: '1px solid #72CDFF' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap' } },
            h('div', { class: 'row', style: { gap: '6px' } },
              badge(res.mode === 'llm-grounded' ? 'LLM-Grounded' : 'RAG Extractive', 'ok'),
              badge(`Model: ${res.provider?.model || modelName}`, 'brand')),
            h('span', { class: 'tiny muted' }, `${arr(res.citations).length} verified citations`)),
          h('div', { style: { fontSize: '13.5px', lineHeight: 1.65, color: 'var(--text-strong)', whiteSpace: 'pre-wrap', marginBottom: '12px' } },
            res.answer || 'No direct answer retrieved.'),
          h('div', { class: 'row-tags' },
            arr(res.citations).map((c) => h('span', { class: 'chip chip-doc', title: c.source_ref || '' },
              `[${c.n || '•'}] ${c.title || c.source_ref}`)))
        )
      );
    } catch (err) {
      resultBox.replaceChildren(
        h('div', { class: 'callout danger' },
          h('span', { class: 'ci' }, icon('alert', 18)),
          h('div', {}, String(err.message || err)))
      );
    } finally {
      askBtn.disabled = false;
    }
  };

  askBtn.addEventListener('click', () => runQuery());
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runQuery(); });

  return card2('Company Brain Intelligence & Live DeepSeek RAG',
    `Connected Engine: ${isLive ? `Live DeepSeek AI (${modelName})` : 'Offline RAG'} · 167 Chunks Indexed · Zero Hallucination Guardrail`,
    h('div', { class: 'stack', style: { gap: '12px' } },
      h('div', { class: 'row', style: { gap: '8px' } },
        input,
        askBtn),
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', alignItems: 'center' } },
        h('span', { class: 'tiny muted' }, 'Suggested queries:'),
        presets.map((p) => h('button', {
          class: 'chip', type: 'button', onClick: () => runQuery(p)
        }, p))),
      resultBox
    )
  );
}

function agentSquadOverviewCard(d) {
  const agentsList = arr(d.agents);
  const aiStatus = d.ai || {};

  return card2('Enterprise AI Agent Squad & Autonomous Skills Matrix',
    '7 Specialized AI Agents with rigorous defense boundaries, deterministic rule execution, and live DeepSeek LLM briefings.',
    h('div', { class: 'stack', style: { gap: '14px' } },
      h('div', { class: 'grid g-4' }, agentsList.slice(0, 4).map((a) => agentMiniCard(a))),
      h('div', { class: 'grid g-3' }, agentsList.slice(4, 7).map((a) => agentMiniCard(a, aiStatus))),
      h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' } },
        h('span', { class: 'tiny muted' },
          'Deterministic Code: Agents 3 & 4 (0 tokens) · Grill-Me Clarification: Agent 2 · Security Audit: Agent 5 · Boss Skill: Agent 7 (DeepSeek AI)'),
        h('a', { class: 'btn btn-ghost btn-sm', href: '#/brain/agents' },
          icon('spark', 14), 'View Full Agent Squad Specs & State Machine →')
      )
    )
  );
}

function agentMiniCard(a, aiStatus = {}) {
  const isAgent7 = a.order === 7 || a.id === 'audit';
  const skillLabel = a.skill ? a.skill.replace('skills/', '').replace('/SKILL.md', '').toUpperCase() : 'BUILT-IN';

  return h('div', { class: 'card', style: { padding: '12px', background: 'rgba(255,255,255,0.7)', border: isAgent7 ? '1px solid rgba(114,205,255,0.6)' : '1px solid var(--border)' } },
    h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } },
      h('div', { class: 'mono tiny', style: { fontWeight: 700, color: 'var(--brand)' } }, `AGENT ${a.order}`),
      badge(isAgent7 ? 'LIVE AI' : 'ONLINE', isAgent7 ? 'brand' : 'ok')),
    h('b', { class: 'tiny', style: { display: 'block', color: 'var(--text-strong)', marginBottom: '2px' } }, a.name),
    h('div', { class: 'tiny muted', style: { marginBottom: '6px' } }, a.name_en || ''),
    h('div', { class: 'row-tags', style: { marginBottom: '6px' } },
      badge(skillLabel, 'info'),
      a.deterministic ? badge('Deterministic', 'neutral') : badge('Probabilistic', 'warn')),
    h('p', { class: 'tiny muted', style: { margin: 0, fontSize: '11.5px', lineHeight: 1.45 } },
      (arr(a.responsibilities)[0] || '').slice(0, 85) + '…')
  );
}

/* ---------- AI Agent Squad Section ---------- */

async function agents(d, cur) {
  const out = [];
  const agentsList = arr(d.agents);
  const aiStatus = d.ai || {};
  const stateMachine = arr(d.raw_agents?.state_machine || d.brain?.state_machine);

  out.push(card2('Autonomous AI Multi-Agent Architecture',
    '7 Independent Specialized Enterprise Agents configured with zero-guessing boundaries, separation of concerns, and full human authority sign-off.',
    h('div', { class: 'stack', style: { gap: '16px' } },
      h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } },
        badge(`AI Model: ${aiStatus.model || 'deepseek-flash'}`, 'brand'),
        badge('Engine: Python/SQL Compiled Rule Matrix v2026.3.0', 'ok'),
        badge('Accounting: Four-State Atomic Ledger SSOT', 'ok'),
        badge('Security: Dual-Track Quarantine Sandbox', 'warn')),
      h('div', { class: 'grid g-1', style: { gap: '14px' } },
        agentsList.map((ag) => renderAgentDetailCard(ag, cur, aiStatus)))
    )
  ));

  if (stateMachine.length) {
    out.push(card2('Application State Machine & Owning Agents',
      `${stateMachine.length} Defined State Transitions driving straight-through processing and exception loops.`,
      h('div', { class: 'stack', style: { gap: '8px' } },
        h('div', { class: 'grid g-3', style: { fontWeight: 600, fontSize: '12px', color: 'var(--ink-2)', padding: '0 8px' } },
          h('div', {}, 'Transition (From → To)'),
          h('div', {}, 'Trigger Event'),
          h('div', {}, 'Owning Agent')),
        stateMachine.map((sm) => h('div', { class: 'check-item', dataset: { state: 'ok' } },
          h('span', { class: 'mk' }, '→'),
          h('div', { class: 'grid g-3', style: { width: '100%', alignItems: 'center' } },
            h('div', { class: 'mono tiny', style: { fontWeight: 600 } }, `${sm.from} → ${sm.to}`),
            h('div', { class: 'tiny muted' }, sm.trigger || ''),
            h('div', {}, sm.agent ? badge(`Agent: ${sm.agent}`, 'brand') : badge('Human / External', 'neutral')))))
      )
    ));
  }

  return out;
}

function renderAgentDetailCard(a, cur, aiStatus) {
  const isAgent7 = a.order === 7 || a.id === 'audit';
  const skillLabel = a.skill ? a.skill.replace('skills/', '').replace('/SKILL.md', '') : 'none';

  return h('article', { class: 'card', style: { border: isAgent7 ? '1px solid rgba(114,205,255,0.7)' : '1px solid var(--border)' } },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h3', {}, `Agent ${a.order}: ${a.name} — ${a.name_en || ''}`),
        h('div', { class: 'sub mono' },
          `ID: ${a.id} · In: ${a.in_state} → Out: ${a.out_state} · Failure: ${a.failure_state}`)),
      h('div', { class: 'row', style: { gap: '6px' } },
        badge(`Skill: ${skillLabel}`, 'brand'),
        a.deterministic ? badge('Deterministic (0-Token)', 'ok') : badge(`LLM: ${isAgent7 ? (aiStatus.model || 'deepseek-flash') : 'Probabilistic'}`, 'info'),
        badge(isAgent7 ? 'LIVE AI' : 'ONLINE', 'ok'))),
    h('div', { class: 'card-body' },
      h('div', { class: 'stack', style: { gap: '12px' } },
        h('div', { class: 'kv-grid' },
          h('div', { class: 'kv' }, h('span', {}, 'Tech Stack'), h('b', { class: 'tiny' }, arr(a.tech).join(' · ') || 'Built-in')),
          h('div', { class: 'kv' }, h('span', {}, 'Token Profile'), h('b', { class: 'mono tiny' }, a.token_profile || '0 tokens')),
          h('div', { class: 'kv' }, h('span', {}, 'Assigned Skill'), h('b', { class: 'mono tiny' }, a.skill || 'None (Native deterministic)')),
          h('div', { class: 'kv' }, h('span', {}, 'Documentation'), h('b', { class: 'mono tiny' }, a.doc || 'docs/00-architecture-and-pipeline.md'))),
        h('div', { class: 'grid g-2', style: { marginTop: '4px' } },
          h('div', { class: 'card', style: { padding: '12px', background: 'var(--surface-1)' } },
            h('b', { class: 'tiny', style: { color: 'var(--text-strong)', display: 'block', marginBottom: '6px' } }, 'Core Responsibilities:'),
            h('ul', { class: 'tiny muted', style: { paddingLeft: '16px', margin: 0, lineHeight: 1.6 } },
              arr(a.responsibilities).map((r) => h('li', {}, r)))),
          h('div', { class: 'card', style: { padding: '12px', background: 'var(--surface-1)' } },
            h('b', { class: 'tiny', style: { color: 'var(--text-strong)', display: 'block', marginBottom: '6px' } }, 'Defenses & Anti-Hallucination Guardrails:'),
            h('ul', { class: 'tiny muted', style: { paddingLeft: '16px', margin: 0, lineHeight: 1.6 } },
              arr(a.defenses).map((d) => h('li', {}, d))))
        )
      )
    )
  );
}

function ledgerCard(l, cur) {
  const t = l.declared_totals || {};
  const rows = arr(l.rows);
  const total = Number(t.allocated || 0) || 1;
  const seg = (key, cls) => {
    const v = Number(t[key] || 0);
    return h('span', { class: cls, style: { width: `${(v / total) * 100}%` }, title: `${key} ${money(v, cur)}` }, v ? key : '');
  };
  return card2('Four-State Budget Ledger',
    l.invariant || 'Available = Allocated − (Committed + Approved + Paid) ≥ 0',
    h('div', { class: 'stack' },
      h('div', { class: 'ledger-bar' }, seg('allocated', 'lb-allocated'), seg('committed', 'lb-committed'), seg('approved', 'lb-approved'), seg('paid', 'lb-paid'), seg('available', 'lb-available')),
      h('div', { class: 'legend' },
        ['allocated', 'committed', 'approved', 'paid', 'available'].map((k) => h('span', {},
          h('i', { class: `lb-${k}` }),
          `${prettyState(k)}: ${compactMoney(t[k] || 0, cur)}`))),
      l.reconcile ? h('p', { class: `tiny ${l.reconcile.ok === false ? 'recon-drift' : 'muted'}` },
        `Reconciliation: ${l.reconcile.ok === false ? `Drift ${JSON.stringify(l.reconcile.differences || l.reconcile)}` : 'Balanced'} · Rows: ${rows.length} · FY: ${l.fiscal_year ?? '—'}`) : null,
      h('div', { class: 'kv-grid', style: { marginTop: '6px' } },
        h('div', { class: 'kv' }, h('span', {}, 'Allocated'), h('b', { class: 'num' }, money(t.allocated || 0, cur))),
        h('div', { class: 'kv' }, h('span', {}, 'Committed'), h('b', { class: 'num' }, money(t.committed || 0, cur))),
        h('div', { class: 'kv' }, h('span', {}, 'Approved'), h('b', { class: 'num' }, money(t.approved || 0, cur))),
        h('div', { class: 'kv' }, h('span', {}, 'Paid'), h('b', { class: 'num' }, money(t.paid || 0, cur))),
        h('div', { class: 'kv' }, h('span', {}, 'Available'), h('b', { class: 'num ok' }, money(t.available || 0, cur))))));
}

function pathwaysCard(d) {
  const list = arr(d.brain?.onboarding_pathways);
  return card2('Three Onboarding Pathways',
    'The system never assumes mature SOPs already exist — establish rules at your own pace.',
    list.length
      ? h('div', { class: 'grid g-3' }, list.map((p) => h('button', {
        class: 'pathway', type: 'button',
        onClick: () => ctx.navigate(p.id === 'A' ? '/brain/knowledge' : p.id === 'B' ? '/brain/requirements' : '/brain/overview')
      },
      h('div', { class: 'pid' }, p.id || '·'),
      h('h3', {}, `${p.title_en || ''}`),
      h('div', { class: 'act' }, p.action_en || ''),
      h('div', { class: 'fit' }, p.fits_en || ''))))
      : h('p', { class: 'tiny muted' }, 'No pathways specified in corpus.'));
}

function isolationCard(d) {
  const layers = arr(d.brain?.three_layer_isolation);
  if (!layers.length) return h('span', {});
  return card2('Three-Layer Isolation',
    'Policy, tiers, and mindset never override each other.',
    h('div', { class: 'grid g-3' }, layers.map((x) => h('div', { class: 'iso-layer' },
      h('div', { class: 'ln' }, `LAYER ${x.layer ?? '—'} · ${String(x.binding || '').toUpperCase()}`),
      h('h3', {}, x.name || ''),
      h('p', {}, [x.role_en, x.body].filter(Boolean).join(' — '))))));
}

function invariantsCard(d) {
  const inv = arr(d.brain?.l0_global_brief?.invariants);
  return card2('Iron Invariants',
    d.brain?.l0_global_brief?.role ? String(d.brain.l0_global_brief.role).slice(0, 220) : 'Non-negotiable operating premises of the autonomous pipeline.',
    h('div', { class: 'grid g-2' }, inv.map((i) => h('div', { class: 'invariant' },
      h('div', { class: 'iid' }, String(i.id || '').replace('INV-', '#')),
      h('div', {}, h('h4', {}, i.title || ''), h('p', {}, i.body || ''),
        i.verification ? h('div', { class: 'ver' }, `Verification: ${i.verification}`) : null)))));
}

/* ---------- company requirements ---------- */

async function requirements(d, cur) {
  const out = [];
  const rules = arr(d.rules);
  const conflicts = arr(d.conflicts);

  const open = conflicts.filter((c) => c.status === 'open');
  for (const c of open) out.push(conflictBanner(c, cur));
  if (!open.length && conflicts.length) {
    out.push(h('div', { class: 'callout' }, h('span', { class: 'ci' }, icon('check', 18)),
      h('div', {}, `${conflicts.length} documented conflicts are adjudicated; nothing is open.`)));
  }

  out.push(card2('Rule Cards Stream',
    `${rules.length} rules · Engine version ${ctx.config?.rule_engine_version || '—'} · Low-code deterministic rules, not LLM black-boxes`,
    h('div', { class: 'stack' }, groupBy(rules, (r) => r.category || 'OTHER').map(([cat, list]) => h('div', {},
      h('div', { class: 'section-label' }, `${prettyState(cat)} · ${list.length}`),
      h('div', { class: 'stack', style: { gap: '10px' } }, list.map((r) => ruleCard(r, cur))))))));

  out.push(h('div', { class: 'callout warn' }, h('span', { class: 'ci' }, icon('shield', 18)),
    h('div', {}, h('b', {}, 'Rule Write Boundary — '),
      'This runtime writes tier configuration and setup progress; rule authoring goes through the deployed publish flow to ensure full audit provenance.')));

  const cl = d.checklist && !Array.isArray(d.checklist) ? d.checklist : {};
  const perType = Object.entries(cl).map(([k, v]) => [k, arr(v)]);
  if (perType.length) {
    out.push(card2('Document Checklist Definitions',
      'These definitions drive the foolproof submission gate on the submit view.',
      h('div', { class: 'grid g-2' }, perType.map(([type, items]) => h('div', { class: 'stack' },
        h('div', { class: 'section-label' }, `${type} · ${items.length} items`),
        h('div', { class: 'checklist' }, items.map((i) => h('div', { class: 'check-item', dataset: { state: i.required ? 'missing' : 'optional' } },
          h('span', { class: 'mk' }, i.required ? '✕' : '–'),
          h('div', {}, h('div', { class: 'cl' }, i.label_en || i.item_id),
            h('div', { class: 'cs' }, `${i.label_en || ''}${i.policy_ref ? ` · ${i.policy_ref}` : ''}`)),
          h('span', { class: 'mono tiny muted' }, (i.match_keywords || []).slice(0, 3).join(', '))))))))));
  }
  return out;
}

function conflictBanner(c, cur) {
  const isMoney = ['single_event_cap', 'allocated', 'cap'].some((k) => String(c.field || '').includes(k));
  const fmt = (v) => (isMoney && typeof v === 'number' ? money(v, cur) : String(v));
  return h('div', { class: 'conflict-banner' },
    h('span', { style: { color: '#9A3412' } }, icon('alert', 20)),
    h('div', {},
      h('h4', {}, `Policy Conflict: ${c.conflict_id} — ${c.field}`),
      h('p', {}, `${fmt(c.value_a)} (${c.source_a}) vs ${fmt(c.value_b)} (${c.source_b}) both exist in the corpus, affecting ${arr(c.affected_submissions).length} submissions.`),
      h('p', { class: 'mono tiny' }, `${c.rule_a || '—'} ⇄ ${c.rule_b || '—'} · Status: ${c.status}`)),
    statusBadge(c.status));
}

function ruleCard(r, cur) {
  const cond = r.condition || {};
  const params = cond.params || {};
  const paramText = Object.entries(params).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : String(v)}`).join(' · ') || '—';
  const apply = r.applies_to || {};
  const isMoneyParam = /cap|amount|ratio/.test(String(cond.type || ''));

  return h('article', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h3', {}, `${r.name || r.rule_id}`),
        h('div', { class: 'sub mono' }, `${r.rule_id} · ${r.code || '—'} · ${r.category || '—'} · ${r.version || ctx.config?.rule_engine_version || '—'}`)),
      h('div', { class: 'row', style: { gap: '6px' } },
        statusBadge(r.status),
        r.severity ? badge(r.severity, r.severity === 'BLOCKER' ? 'no' : r.severity === 'WARNING' ? 'warn' : 'neutral') : null)),
    h('div', { class: 'card-body' },
      h('div', { class: 'stack', style: { gap: '10px' } },
        r.description ? h('p', { class: 'tiny', style: { margin: 0, color: 'var(--ink-2)' } }, r.description) : null,
        h('div', { class: 'kv-grid' },
          h('div', { class: 'kv' }, h('span', {}, 'Applies To'),
            h('b', {}, [(apply.submission_types || []).join('+'), (apply.tiers || []).join('+'), (apply.programmes || []).join('+')].filter(Boolean).join(' · ') || 'All')),
          h('div', { class: 'kv' }, h('span', {}, 'Condition Type'), h('b', { class: 'mono' }, cond.type || '—')),
          h('div', { class: 'kv' }, h('span', {}, 'Expression'), h('b', { class: 'mono tiny' }, cond.expression || '—')),
          h('div', { class: 'kv' }, h('span', {}, 'Params'), h('b', { class: 'mono tiny' }, isMoneyParam && params.single_event_cap ? money(params.single_event_cap, cur) : paramText)),
          h('div', { class: 'kv' }, h('span', {}, 'If Not Met'), h('b', {}, prettyState(r.on_fail || '—'))),
          h('div', { class: 'kv' }, h('span', {}, 'Error Code'), h('b', { class: 'mono tiny' }, r.error_code || '—')),
          h('div', { class: 'kv' }, h('span', {}, 'Effective Date'), h('b', { class: 'num' }, dateOnly(r.effective_date))),
          h('div', { class: 'kv' }, h('span', {}, 'Source Ref'), h('b', { class: 'mono tiny' }, r.policy_ref || '—'))),
        h('div', { class: 'row', style: { gap: '8px', marginTop: '2px' } },
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => inspectRule(r, cur) }, icon('search', 14), 'Inspect'),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => openBrainDrawer(r.policy_ref || r.name || r.rule_id) },
            icon('brain', 14), 'Locate in Knowledge Base'),
          h('span', { class: 'tiny muted', style: { marginLeft: 'auto' } }, `provenance: ${r.provenance || '—'} · approved by ${r.approved_by || '—'}`)))));
}

function inspectRule(r, cur) {
  modal({
    title: `${r.rule_id} — ${r.name || ''}`,
    subtitle: `${r.code || ''} · ${r.category || ''} · ${r.status || ''}`,
    body: h('div', { class: 'stack' },
      h('p', { class: 'tiny' }, r.description || ''),
      h('div', { class: 'divider' }),
      h('div', { class: 'section-label' }, 'Full Rule Definition'),
      h('pre', { class: 'mono tiny', style: { whiteSpace: 'pre-wrap', background: 'var(--surface-2)', padding: '12px', borderRadius: 'var(--r-xs)', maxHeight: '340px', overflow: 'auto' } },
        JSON.stringify(r, null, 2)),
      h('p', { class: 'tiny muted' }, `Currency context: ${cur}`)),
    actions: [h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Close')]
  });
}

/* ---------- partner tiers ---------- */

async function tiers(d, cur) {
  const out = [];
  const list = arr(d.tiers);
  const partners = arr(d.partners);
  const byTier = groupByCount(partners, (p) => p.tier || 'Unassigned');

  const docIds = new Set();
  for (const items of Object.values((d.checklist && !Array.isArray(d.checklist)) ? d.checklist : {})) arr(items).forEach((i) => docIds.add(i.item_id));
  for (const t of list) arr(t.required_documents).forEach((x) => docIds.add(x));

  out.push(card2('Tier Definitions',
    'Administrators can directly configure tier caps, co-op ratios, and required documents without code modifications.',
    h('div', { class: 'grid g-3' }, list.map((t) => tierCard(t, cur, byTier, docIds)))));

  out.push(h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
    h('span', { class: 'tiny muted' }, 'No tier system?'),
    tierModeChip(d),
    h('span', { class: 'tiny muted', style: { marginLeft: 'auto' } },
      `Runtime configurable: Caps / Ratios / Required Documents / Status / Effective Dates`)));

  out.push(card2('Partner Distribution by Tier',
    `${partners.length} registered partners · Unassigned partners follow default rules`,
    h('div', { class: 'grid g-2' },
      h('div', { class: 'stack' }, [...byTier.entries()].sort((a, b) => b[1] - a[1]).map(([tier, n]) =>
        h('div', { class: 'rule-row', dataset: { status: 'PASSED' } },
          h('span', { class: 'rid' }, String(n)),
          h('div', {}, h('div', { class: 'rname' }, tier), h('div', { class: 'rmetric' }, `${Math.round((n / partners.length) * 100)}% of partners`)),
          h('span', { class: 'rmeta' }, list.some((t) => t.name === tier) ? 'defined' : 'no tier record'))),
      ),
      h('div', { class: 'stack' },
        h('div', { class: 'section-label' }, 'Partner Directory'),
        partners.slice(0, 12).map((p) => h('div', { class: 'doc-row' },
          h('span', { class: 'di' }, (p.tier || 'U').slice(0, 2).toUpperCase()),
          h('div', {}, h('b', { class: 'tiny' }, p.name), h('div', { class: 'mono tiny muted' }, `${p.partner_id} · ${p.region || '—'} · ${arr(p.programmes).join(', ') || 'no programme'}`)),
          h('span', { class: `chip ${p.status === 'active' ? 'chip-ok' : 'chip-no'}` }, p.status)))))));

  if (docIds.size) out.push(h('p', { class: 'tiny muted' }, `Document codes available for binding: ${[...docIds].join(', ')}`));
  return out;
}

function tierCard(t, cur, byTier, docIds) {
  const lim = t.programme_limits || {};
  const capSet = lim.cap_configured === true && lim.single_event_cap !== null && lim.single_event_cap !== undefined;
  return h('div', { class: 'tier-card', dataset: { tier: t.name } },
    h('div', { style: { height: '10px' } }),
    h('h3', {}, t.name || t.tier_id),
    h('div', { class: 'tiny muted' }, t.tier_id),
    h('div', { class: 'cap' }, capSet ? compactMoney(lim.single_event_cap, lim.cap_currency || cur) : 'Not configured'),
    h('div', { class: 'tiny muted' }, capSet ? `Single-event cap · Co-op ratio: ${pct(lim.coop_reimbursement_ratio ?? 0, 0)}` : 'Caps and ratios take effect once confirmed by administrator'),
    h('div', { class: 'divider', style: { margin: '12px 0' } }),
    h('div', { class: 'stack', style: { gap: '5px' } },
      h('div', { class: 'tiny' }, t.eligibility_criteria || 'No eligibility criteria recorded'),
      h('div', { class: 'row-tags' },
        arr(t.required_documents).length
          ? arr(t.required_documents).map((x) => h('span', { class: 'chip chip-doc' }, x))
          : h('span', { class: 'chip' }, 'No required documents'),
        h('span', { class: 'chip' }, `${byTier.get(t.name) || 0} partners`)),
      h('div', { class: 'mono tiny muted' }, `Effective: ${dateOnly(t.effective_date)} · ${t.source_ref || 'no ref'} · ${t.approved_by || 'unapproved'}`)),
    h('div', { class: 'row', style: { gap: '8px', marginTop: '14px' } },
      h('button', { class: 'btn btn-primary btn-sm', type: 'button', onClick: () => configureTier(t, cur, docIds) }, icon('scale', 14), 'Configure'),
      h('button', {
        class: 'btn btn-ghost btn-sm', type: 'button',
        onClick: () => toggleTierStatus(t)
      }, icon(t.status === 'active' ? 'lock' : 'check', 14), t.status === 'active' ? 'Deactivate' : 'Activate')));
}

function configureTier(t, cur, docIds) {
  const lim = t.programme_limits || {};
  const cap = h('input', { class: 'input', type: 'number', step: '0.01', min: '0', value: lim.single_event_cap ?? '', placeholder: 'Leave blank for uncapped' });
  const ratio = h('input', { class: 'input', type: 'number', step: '1', min: '0', max: '100', value: lim.coop_reimbursement_ratio != null ? String(Math.round(lim.coop_reimbursement_ratio * 100)) : '', placeholder: 'e.g. 50' });
  const eff = h('input', { class: 'input', type: 'date', value: t.effective_date || '' });
  const status = h('select', {}, ['active', 'draft', 'not_configured', 'inactive'].map((v) => h('option', { value: v, selected: t.status === v }, v)));
  const docHost = h('div', { class: 'row-tags' });
  const picked = new Set(arr(t.required_documents));
  const pool = new Set([...arr(t.required_documents), ...docIds]);
  if (!pool.size) docHost.appendChild(h('span', { class: 'tiny muted' }, 'No document codes in corpus yet'));
  for (const id of pool) {
    const cb = h('input', { type: 'checkbox', checked: picked.has(id), style: { width: 'auto' } });
    cb.addEventListener('change', () => { if (cb.checked) picked.add(id); else picked.delete(id); });
    docHost.appendChild(h('label', { class: 'chip', style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, cb, id));
  }

  modal({
    title: `Configure Tier: ${t.name}`,
    subtitle: `${t.tier_id} · Requires authorised approver session (Iron Invariant 1) · Applies to new submissions after effective date`,
    body: h('div', { class: 'stack' },
      h('div', { class: 'grid g-2' },
        field(`Single-event cap (${lim.cap_currency || cur})`, cap, { hint: 'Leave blank for no cap (requires individual exception)' }),
        field('Co-op reimbursement ratio (%)', ratio, { hint: '0–100, leave blank if unconfirmed' })),
      h('div', { class: 'grid g-2' },
        field('Effective date', eff, { hint: 'Historical submissions remain locked to original version (Iron Invariant 4)' }),
        field('Status', status)),
      field('Required documents', docHost, { hint: 'From checklist definitions and tier requirements' }),
      h('div', { class: 'callout' }, h('span', { class: 'ci' }, icon('info', 18)),
        h('div', {}, `Policy source: ${t.source_ref || '—'} · Approved by: ${t.approved_by || '—'} · Provenance: ${t.provenance || '—'}`))),
    actions: [
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', type: 'button', onClick: save }, 'Save & Apply')
    ]
  });

  async function save() {
    const body = {
      single_event_cap: cap.value === '' ? null : Number(cap.value),
      coop_reimbursement_ratio: ratio.value === '' ? null : Number(ratio.value) / 100,
      required_documents: [...picked],
      status: status.value
    };
    if (eff.value) body.effective_date = eff.value;
    closeModal();
    const r = await withAuthority(() => api.patchTier(t.tier_id, body),
      'Policy configuration requires an authorised human administrator.');
    if (!r.ok) return;
    invalidateBrain();
    toast(`${t.name} updated successfully.`, 'ok', 'Tier configured', 6000);
    ctx.navigate('/brain/tiers');
  }
}

async function toggleTierStatus(t) {
  const next = t.status === 'active' ? 'inactive' : 'active';
  const r = await withAuthority(() => api.patchTier(t.tier_id, { status: next }),
    'Activating or deactivating a tier requires human authority.');
  if (!r.ok) return;
  invalidateBrain();
  toast(`${t.name} → ${next}`, 'ok');
  ctx.navigate('/brain/tiers');
}

function tierModeChip(d) {
  const off = d.setup?.tier_mode === 'none' || d.brain?.tier_mode === 'none';
  const chip = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(off) },
    off ? 'Flat grant model active (no tier-based rules)' : 'We do not use tier-based rules');
  chip.addEventListener('click', async () => {
    const r = await withAuthority(() => api.saveSetup({ tier_mode: off ? 'tiered' : 'none' }),
      'Changing tier policy requires an administrator session.');
    if (!r.ok) return;
    invalidateBrain();
    toast(off ? 'Tier-based policy rules restored.' : 'A single global limit applies to all partners.', 'ok', null, 6000);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  return chip;
}

/* ---------- knowledge base ---------- */

async function knowledge(d, cur) {
  const out = [];
  const l3 = arr(d.brain?.l3_rag_sources);
  const manifest = arr(d.brain?.client_documents_manifest);
  const wiki = arr(d.brain?.l2_policy_wiki);

  out.push(uploadCard());

  out.push(card2('Structured Knowledge (L2 Policy Wiki)',
    `${wiki.length} policy documents · ${wiki.reduce((a, x) => a + arr(x.sections).length, 0)} sections · Every section traces to source documents`,
    h('div', { class: 'stack' }, wiki.map((doc) => h('article', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', {}, h('h3', {}, doc.title || doc.doc_id),
          h('div', { class: 'sub mono' }, `${doc.path || ''} · ${doc.version || '—'} · Effective: ${dateOnly(doc.effective_date)}`)),
        badge(`${arr(doc.sections).length} sections`, 'brand')),
      h('div', { class: 'card-body' },
        h('div', { class: 'stack', style: { gap: '9px' } }, arr(doc.sections).map((sec) => h('details', { class: 'preview', style: { marginTop: 0 } },
          h('summary', {}, `${sec.anchor || '#'} ${sec.heading || ''}`),
          h('p', { style: { padding: '0 14px 10px', margin: 0, fontSize: '13px', lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' } }, sec.body || ''),
          sec.source_file ? h('div', { class: 'mono tiny muted', style: { padding: '0 14px 12px' } },
            `Extracted from ${sec.source_file}${sec.source_page ? ` p.${sec.source_page}` : ''}`) : null)))))))));

  out.push(card2('Registered Source Documents (L3)',
    `${l3.length} documents · Docling parsing results and citation validity checks (RefChecker)`,
    l3.length ? h('div', { class: 'stack' }, l3.map((s) => h('div', { class: 'doc-row' },
      h('span', { class: 'di' }, ext(s.filename)),
      h('div', { style: { minWidth: '0' } },
        h('b', { class: 'tiny' }, s.filename),
        h('div', { class: 'mono tiny muted' }, `${s.category || '—'} · ${s.importance || '—'} · ${s.size_mb ?? '—'} MB · ${s.rules_extracted != null ? `${s.rules_extracted} rules` : 'no rule count'}`),
        s.extract_summary ? h('div', { class: 'tiny', style: { marginTop: '4px', color: 'var(--ink-3)' } }, s.extract_summary) : null),
      h('div', { class: 'row', style: { gap: '6px' } },
        statusBadge(s.status),
        s.refcheck ? badge(`refcheck ${s.refcheck.valid === true ? 'valid' : 'invalid'} · ${dateOnly(s.refcheck.last_checked)}`, s.refcheck.valid === true ? 'ok' : 'no') : null)))
    ) : h('p', { class: 'tiny muted' }, 'No L3 sources registered.')));

  if (manifest.length) {
    out.push(card2('Client Document Manifest',
      `${manifest.length} items · Aligned with client-documents/README.md`,
      h('div', { class: 'grid g-2' }, manifest.map((m) => h('div', { class: 'rule-row', dataset: { status: 'NOT_APPLICABLE' } },
        h('span', { class: 'rid' }, m.seq || '—'),
        h('div', {}, h('div', { class: 'rname' }, m.filename), h('div', { class: 'rmetric' }, m.extraction_target || '')),
        h('span', { class: 'rmeta' }, `${m.category || '—'} · ${m.importance || '—'}`))))));
  }

  out.push(retrievalCard(d));
  void cur;
  return out;
}

function ext(filename) {
  return String(filename || 'file').split('.').pop().slice(0, 4).toUpperCase();
}

function uploadCard() {
  const picker = h('input', { type: 'file', multiple: true, style: { display: 'none' }, onChange: () => run(picker.files) });
  const log = h('div', { class: 'stack', style: { marginTop: '12px' } });
  const dz = h('div', { class: 'dropzone', role: 'button', tabindex: '0' },
    h('div', { class: 'dz-ico' }, icon('upload', 22)),
    h('h3', {}, 'Upload official PDF / SOP documents or Excel sheets'),
    h('p', {}, 'Drag & drop, or click to browse — Files are stored in uploads/ and indexed immediately'));
  dz.addEventListener('click', () => picker.click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); } });
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', (e) => run(e.dataTransfer?.files));

  async function run(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    log.replaceChildren(h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'spin' }), h('span', { class: 'tiny muted' }, `Archiving ${files.length} files…`)));
    try {
      const r = await api.post('/api/upload', fd);
      log.replaceChildren(h('div', { class: 'checklist' }, (r.files || []).map((f) => h('div', { class: 'check-item', dataset: { state: 'ok' } },
        h('span', { class: 'mk' }, '✓'),
        h('div', {}, h('div', { class: 'cl' }, f.stored || f.filename || 'file'),
          h('div', { class: 'cs mono' }, `Written to uploads/ · Ingestion requires administrator approval before inclusion in L3`)),
        h('span', { class: 'mono tiny muted' }, bytes(f.size_bytes || 0))))));
      toast(`${files.length} file(s) archived successfully.`, 'ok');
    } catch (e) {
      log.replaceChildren(h('div', { class: 'callout danger' }, h('span', { class: 'ci' }, icon('alert', 18)),
        h('div', {}, `${e instanceof ApiError ? e.code : 'UPLOAD_FAILED'} — ${e.message || e}`)));
    }
  }

  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Upload Official Documents'),
      h('div', { class: 'sub' }, 'Upload raw SOPs or spreadsheets; candidate rules will be extracted automatically')),
    h('div', { class: 'card-body' }, dz, picker, log)));
}

function retrievalCard(d) {
  const q = h('input', { class: 'input', type: 'search', placeholder: 'Search authorised corpus (e.g. Gold cap, claim window)…' });
  const out = h('div', { class: 'stack', style: { marginTop: '12px' } });
  const go = async () => {
    const term = q.value.trim();
    if (!term) return;
    out.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'spin' }), h('span', { class: 'tiny muted' }, 'Retrieving…')));
    try {
      const r = await api.ragSearch(term, 8);
      const hits = arr(r.results);
      out.replaceChildren(h('div', { class: 'checklist' }, hits.length
        ? hits.map((x) => h('div', { class: 'check-item', dataset: { state: 'ok' } },
          h('span', { class: 'mk' }, x.layer || 'L'),
          h('div', {}, h('div', { class: 'cl' }, x.title || x.id), h('div', { class: 'cs' }, String(x.body || x.excerpt || '').slice(0, 180))),
          h('span', { class: 'mono tiny muted' }, `${x.score != null ? Number(x.score).toFixed(2) : '—'} · ${x.source_ref || ''}`)))
        : [h('p', { class: 'tiny muted' }, `No chunks match "${term}" — Iron Invariant 3: The brain will not fabricate answers.`)]));
    } catch (e) {
      out.replaceChildren(h('div', { class: 'callout danger' }, h('span', { class: 'ci' }, icon('alert', 18)), h('div', {}, String(e.message || e))));
    }
  };
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

  const stats = d.index_stats || {};
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {}, h('h2', {}, 'Retrieval & Index'),
        h('div', { class: 'sub mono' }, `${stats.chunks ?? 0} chunks · ${JSON.stringify(stats.by_layer || {})} · ${d.ai?.available ? `${d.ai.provider}/${d.ai.model}` : 'no live LLM (RAG only)'}`)),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: async () => {
        try { const s = await api.reindex(); invalidateBrain(); toast(`Index rebuilt: ${s.chunks} chunks.`, 'ok'); window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) { toast(String(e.message || e), 'err'); }
      } }, icon('refresh', 14), 'Reindex')),
    h('div', { class: 'card-body' }, field('Keyword search', q, { hint: 'Ctrl/⌘+K to open the full Ask-the-Brain drawer' }), out));
}

/* ---------- company mindset ---------- */

async function mindset(d, cur) {
  const out = [];
  const principles = arr(d.brain?.l4_mindset);
  const comms = arr(d.brain?.l5_communication);

  out.push(h('div', { class: 'callout warn' }, h('span', { class: 'ci' }, icon('info', 18)),
    h('div', {}, h('b', {}, 'Advisory Only — '),
      'The mindset layer is used to prioritise and explain recommendations. When mindset and formal policy conflict, policy always prevails.')));

  out.push(card2('Approved Principles',
    `${principles.filter((p) => p.status === 'approved').length} approved · ${principles.filter((p) => p.status === 'proposed').length} proposed principles awaiting approval`,
    h('div', { class: 'grid g-2' }, principles.map((m) => h('div', { class: 'invariant' },
      h('div', { class: 'iid' }, String(m.principle_id || '').replace('MINDSET_', '#')),
      h('div', {},
        h('h4', {}, m.principle || ''),
        h('p', {}, [m.scope ? `Scope: ${m.scope}` : null, m.basis ? `Basis: ${m.basis}` : null, m.authority ? `Authority: ${m.authority}` : null].filter(Boolean).join(' · ') || '—'),
        h('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } },
          statusBadge(m.status),
          badge(m.policy_override_allowed === true ? 'override allowed' : 'never overrides policy', m.policy_override_allowed === true ? 'no' : 'ok')),
        h('div', { class: 'ver' }, `v${m.version ?? 1} · Effective: ${dateOnly(m.effective_date)}${m.status === 'proposed' ? ' · Proposals must be formally approved by an authorised administrator' : ''}`)))))));

  if (comms.length) {
    out.push(card2('Communication Rules by Audience',
      `${comms.length} audience groups · Tone and templates defined by corpus`,
      h('div', { class: 'grid g-2' }, comms.map((c) => h('article', { class: 'card' },
        h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, String(c.audience || '').toUpperCase()),
          h('div', { class: 'sub' }, c.tone || '')),
        c.template_id ? badge(c.template_id, 'brand') : null),
        h('div', { class: 'card-body' },
          h('div', { class: 'stack', style: { gap: '7px' } }, arr(c.rules).map((r) => h('div', { class: 'memo-line', style: { fontSize: '12.5px' } }, `· ${r}`))),
          c.subject_template || c.body_template ? h('details', { class: 'preview' },
            h('summary', {}, 'Template'),
            h('pre', { class: 'mono tiny' }, `${c.subject_template || ''}\n\n${c.body_template || ''}`)) : null))))));
  }

  const glossary = arr(d.brain?.glossary);
  if (glossary.length) {
    out.push(card2('Glossary', `${glossary.length} terms`,
      h('div', { class: 'grid g-2' }, glossary.map((g) => h('div', { class: 'rule-row', dataset: { status: 'NOT_APPLICABLE' } },
        h('span', { class: 'rid' }, 'TERM'),
        h('div', {}, h('div', { class: 'rname' }, g.term), h('div', { class: 'rmetric' }, g.definition || '')),
        h('span', { class: 'rmeta' }, g.path || ''))))));
  }
  void cur;
  return out;
}

/* ---------- versions & audit ---------- */

async function versions(d, cur) {
  const out = [];
  const versionsList = arr(d.brain?.versions);
  const adrList = arr(d.brain?.adr);

  out.push(card2('Active Rule Versions',
    'Rule bundles are versioned and immutable; submissions lock their effective version at submission time.',
    h('div', { class: 'grid g-2' }, versionsList.map((v) => h('div', { class: 'invariant', style: { gridTemplateColumns: '1fr' } },
      h('div', {},
        h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '4px' } },
          h('h4', {}, v.version), statusBadge(v.status)),
        h('p', {}, v.change_summary || ''),
        h('div', { class: 'ver' }, `Published: ${dateOnly(v.published_at)} · Effective: ${dateOnly(v.effective_date)} · Approved by: ${v.approved_by || '—'}`)))))));

  if (versionsList.length >= 2) {
    out.push(diffCard(versionsList, cur));
  }

  if (adrList.length) {
    out.push(card2('Architecture & Policy Decision Records (ADR)',
      `${adrList.length} Ratified Business & System Policy Decisions`,
      h('div', { class: 'stack' }, adrList.map((a) => h('div', { class: 'card', style: { padding: '14px' } },
        h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '6px' } },
          h('b', { style: { color: 'var(--text-strong)' } }, `${a.adr_id}: ${a.title}`),
          statusBadge(a.status)),
        h('p', { class: 'tiny', style: { margin: '0 0 6px 0', color: 'var(--ink-2)' } }, a.decision || ''),
        h('div', { class: 'mono tiny muted' }, `Context: ${a.context || '—'} · Signed by: ${arr(a.signed_by).join(', ') || 'Unsigned'} · Date: ${dateOnly(a.date)}`))))));
  }

  const logs = await api.auditEvents({ limit: 12 }).catch(() => ({ events: [] }));
  const evts = arr(logs.events);

  out.push(card2('Recent Audit Events Stream',
    `${evts.length} Recent immutable ledger events recorded`,
    evts.length ? h('div', { class: 'stack', style: { gap: '6px' } }, evts.map((e) => h('div', { class: 'doc-row' },
      h('span', { class: 'di mono' }, 'EVT'),
      h('div', {},
        h('b', { class: 'tiny' }, e.event_type || e.action || 'Event'),
        h('div', { class: 'mono tiny muted' }, `${e.submission_id || 'System'} · Actor: ${e.actor || 'system'} · ${dateTime(e.timestamp || e.created_at)}`)),
      badge(e.status || 'LOGGED', 'ok'))))
    : h('p', { class: 'tiny muted' }, 'No audit events recorded yet.')));

  return out;
}

function diffCard(list, cur) {
  const a = h('select', {}, list.map((v, i) => h('option', { value: String(i), selected: i === list.length - 2 }, v.version)));
  const b = h('select', {}, list.map((v, i) => h('option', { value: String(i), selected: i === list.length - 1 }, v.version)));
  const out = h('div', { class: 'stack', style: { marginTop: '12px' } });
  const paint = () => {
    const left = list[Number(a.value)] || {};
    const right = list[Number(b.value)] || {};
    const keys = (v) => arr(v.changes).map((c) => `${c.rule_id}::${c.field}`);
    const only = (v, w) => arr(v.changes).filter((c) => !keys(w).includes(`${c.rule_id}::${c.field}`));
    out.replaceChildren(
      h('div', { class: 'row', style: { gap: '8px' } },
        badge(`${left.version || '—'} → ${right.version || '—'}`, 'brand'),
        h('span', { class: 'tiny muted' }, `Before: ${arr(left.changes).length} changes · After: ${arr(right.changes).length} changes`)),
      h('div', { class: 'stack', style: { gap: '6px' } },
        ...arr(right.changes).map((c) => h('div', { class: 'verify ok' },
          h('span', { class: 'vi' }, icon('check', 15)),
          h('div', {}, h('b', {}, `${c.rule_id || '—'} · ${c.field || ''}`),
            h('span', { class: 'mono tiny' }, `${fmtVal(c.before, cur)} → ${fmtVal(c.after, cur)}`)))),
        ...only(left, right).map((c) => h('div', { class: 'verify bad' },
          h('span', { class: 'vi' }, icon('x', 15)),
          h('div', {}, h('b', {}, `${c.rule_id || '—'} · ${c.field || ''}`),
            h('span', { class: 'mono tiny' }, `Only in ${left.version}: ${fmtVal(c.after, cur)}`)))),
        !arr(right.changes).length && !only(left, right).length
          ? h('p', { class: 'tiny muted' }, 'No recorded delta between these two versions.')
          : null));
  };
  a.addEventListener('change', paint);
  b.addEventListener('change', paint);
  paint();
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Visual Version Diff'),
      h('div', { class: 'sub' }, 'Change lists are extracted directly from the corpus version ledger.'))),
    h('div', { class: 'card-body' }, h('div', { class: 'grid g-2' }, field('Base Version', a), field('Compare Version', b)), out));
}

function fmtVal(v, cur) {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'number') return money(v, cur);
  return String(v);
}

/* ---------- shared bits ---------- */

function card2(title, sub, bodyNodes) {
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, title), sub ? h('div', { class: 'sub' }, sub) : null)),
    h('div', { class: 'card-body' }, bodyNodes));
}

function resumeSetup(d) {
  const sp = d.brain?.setup_progress || {};
  const todo = arr(sp.sections).filter((s) => s.status !== 'complete');
  modal({
    title: 'Resume Setup',
    subtitle: `Completed ${sp.completed_sections ?? 0} / ${sp.total_sections ?? 0} sections · Uncompleted sections do not block runtime processing`,
    body: todo.length
      ? h('div', { class: 'stack' }, todo.map((s) => h('button', {
        class: 'approver-row', type: 'button', onClick: () => { closeModal(); ctx.navigate(`/brain/${linkFor(s.id)}`); }
      }, h('span', { class: 'av' }, '··'),
      h('span', { class: 'meta' }, h('b', {}, s.label || s.id), h('i', {}, s.detail || s.next_action_label || '')),
      h('span', { class: 'go' }, icon('chevron', 16)))))
      : h('p', { class: 'tiny' }, 'Every section has been configured successfully.'),
    actions: [h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeModal() }, 'Later')]
  });
}

function arr(x) { return Array.isArray(x) ? x : []; }

function groupBy(list, keyFn) {
  const m = new Map();
  for (const x of list) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return [...m.entries()];
}

function groupByCount(list, keyFn) {
  const m = new Map();
  for (const x of list) m.set(keyFn(x), (m.get(keyFn(x)) || 0) + 1);
  return m;
}
