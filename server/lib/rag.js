/**
 * RAG-lite retrieval over the AI-authored Company Brain corpus (L0-L5).
 *
 * Every answer is assembled at runtime from indexed chunks that carry their own
 * `source_ref`, so nothing is hardcoded: change brain.json and the answers change.
 * Grounding layer per docs/08 §2 (L2 Policy Wiki) and §4 (L3 RAG evidence).
 */

const store = require('./store');

const STOP = new Set(('a an the of and or to in for on with is are be as at by from that this it its not no must may can should will would could have has had if then than when where which who whom whose what why how all any both each few more most other some such only own same too very do does did doing done being been am i we you they he she them us our your their my me').split(' '));

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Chinese text has no spaces — add character bigrams so CJK queries can match. */
function bigrams(text) {
  const s = String(text || '').replace(/[^\u4e00-\u9fff]/g, '');
  const out = [];
  for (let i = 0; i + 1 < s.length; i += 1) out.push(s.slice(i, i + 2));
  return out;
}

function terms(text) {
  return [...tokens(text), ...bigrams(text)];
}

/* ------------------------------------------------------------------ */
/* Index construction                                                  */
/* ------------------------------------------------------------------ */

function pushChunk(chunks, layer, id, title, body, sourceRef, meta = {}) {
  const text = `${title}\n${body}`.trim();
  if (!text) return;
  const t = terms(text);
  const freq = new Map();
  for (const term of t) freq.set(term, (freq.get(term) || 0) + 1);
  chunks.push({
    layer, id, title, body: text, source_ref: sourceRef, meta,
    terms: t, freq, length: t.length || 1
  });
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function buildIndex() {
  const chunks = [];
  const brain = store.read('brain.json') || {};
  const rules = asArray(store.read('rules.json'));
  const tiers = asArray(store.read('tiers.json'));
  const conflicts = asArray(store.read('rule-conflicts.json'));
  const agentsFile = store.read('agents.json') || {};
  const config = store.read('config.json') || {};

  // L0 — Global Brief (role + the five iron invariants, verbatim from the corpus)
  const l0 = brain.l0_global_brief || {};
  pushChunk(chunks, 'L0', 'l0-role', 'L0 Global Brief — Role & Operating Contract',
    [l0.role,
     `Organisation: ${config.org?.name || 'n/a'} · Product: ${config.brand?.product || 'n/a'}`,
     config.brand?.tagline ? `Positioning: ${config.brand.tagline}` : '',
     `Region: ${config.org?.region || 'n/a'} · Fiscal year: ${config.org?.fiscal_year || 'n/a'} · Base currency: ${config.org?.base_currency || 'n/a'}`,
     `Rule engine version: ${config.rule_engine_version || 'n/a'}`,
     `Confidence thresholds: amount hard block ${config.confidence_thresholds?.amount_hard_block}, parsing suspend ${config.confidence_thresholds?.parsing_suspend}`,
     `Claim window: ${config.claim_window_days} days · Ops initial review SLA: ${config.sla_hours?.ops_initial_review} hours`,
     `Operator: ${config.operator?.name || 'n/a'} — ${config.operator?.role || ''}`].filter(Boolean).join('\n'),
    'docs/08-brain-layer.md#L0', { layer_name: 'Global Brief' });

  for (const inv of asArray(l0.invariants)) {
    pushChunk(chunks, 'L0', `inv-${inv.id}`, `${inv.id} — ${inv.title}`,
      [inv.body, inv.verification ? `Verification: ${inv.verification}` : ''].filter(Boolean).join('\n'),
      'docs/11-architecture-cross-check-report.md#sec-3', inv);
  }

  // L1 — Skill router (trigger -> skill -> agent)
  for (const s of asArray(brain.l1_skill_router)) {
    pushChunk(chunks, 'L1', `l1-${s.skill}`, `L1 Skill Router — ${s.skill}`,
      [`Trigger: ${s.trigger}`, `Skill path: ${s.skill_path}`, `Used by: ${s.used_by}`, `Purpose: ${s.purpose}`]
        .filter(Boolean).join('\n'),
      s.skill_path || 'docs/08-brain-layer.md#L1', s);
  }

  // L2 — Policy wiki: each doc carries nested sections; index one chunk per section
  for (const doc of asArray(brain.l2_policy_wiki)) {
    pushChunk(chunks, 'L2', `l2-${doc.doc_id}`, `L2 Policy — ${doc.title}`,
      [doc.path ? `Source: ${doc.path}` : '', `Version: ${doc.version || 'n/a'} · Effective: ${doc.effective_date || 'n/a'}`,
       `${asArray(doc.sections).length} indexed section(s)`].filter(Boolean).join('\n'),
      doc.path || 'company-brain/INDEX.md', doc);
    for (const sec of asArray(doc.sections)) {
      pushChunk(chunks, 'L2', `l2-${doc.doc_id}-${sec.anchor}`, `${doc.title} ${sec.anchor} — ${sec.heading}`,
        [sec.body, sec.source_file ? `Extracted from: ${sec.source_file}${sec.source_page ? ` p.${sec.source_page}` : ''}` : '']
          .filter(Boolean).join('\n'),
        `${doc.path || ''}${sec.anchor || ''}`, { ...sec, doc_id: doc.doc_id, doc_title: doc.title, doc_version: doc.version });
    }
  }

  // L3 — RAG source manifest (the raw client documents behind the wiki)
  for (const src of asArray(brain.l3_rag_sources)) {
    pushChunk(chunks, 'L3', `l3-${src.doc_id}`, `L3 Source — ${src.filename}`,
      [`Category: ${src.category} · Importance: ${src.importance} · Size: ${src.size_mb} MB · Status: ${src.status}`,
       `Extraction target: ${src.extraction_target}`,
       `Extract summary: ${src.extract_summary}`,
       src.rules_extracted !== undefined ? `Rules extracted: ${src.rules_extracted}` : '',
       src.refcheck ? `Reference check valid: ${src.refcheck.valid === true ? 'yes' : 'no'} (last checked ${src.refcheck.last_checked})` : '']
        .filter(Boolean).join('\n'),
      `client-documents/${src.filename}`, src);
  }

  // L3 — Historical cases (precedent evidence used by Agent 6)
  for (const c of asArray(brain.cases)) {
    pushChunk(chunks, 'L3', `case-${c.case_id}`, `Case ${c.case_id} — ${c.title}`,
      [c.summary, c.outcome, asArray(c.rule_refs).length ? `Rule references: ${c.rule_refs.join(', ')}` : '']
        .filter(Boolean).join('\n'),
      c.path || 'company-brain/cases/', c);
  }

  // L4 — Mindset memory (approved principles; policy_override_allowed is always false)
  for (const m of asArray(brain.l4_mindset)) {
    pushChunk(chunks, 'L4', `mindset-${m.principle_id}`, `L4 Mindset — ${m.principle_id}`,
      [m.principle,
       `Scope: ${m.scope || 'n/a'} · Basis: ${m.basis || 'n/a'}`,
       `Authority: ${m.authority || 'n/a'} · Policy override allowed: ${m.policy_override_allowed === true ? 'yes' : 'no'}`,
       `Effective: ${m.effective_date || 'n/a'} (v${m.version ?? 1}) · Status: ${m.status || 'n/a'}`]
        .filter(Boolean).join('\n'),
      'company-brain/mindset/approved-principles.md', m);
  }

  // L5 — Communication memory (audience-specific templates + hard wording rules)
  for (const t of asArray(brain.l5_communication)) {
    pushChunk(chunks, 'L5', `l5-${t.template_id}`, `L5 Communication — ${t.audience} (${t.template_id})`,
      [`Audience: ${t.audience} · Tone: ${t.tone}`,
       asArray(t.rules).length ? `Wording rules:\n- ${t.rules.join('\n- ')}` : '',
       t.subject_template ? `Subject: ${t.subject_template}` : '',
       t.body_template ? `Body: ${t.body_template}` : ''].filter(Boolean).join('\n'),
      'company-brain/communication/review-templates.md', t);
  }

  // Glossary
  for (const g of asArray(brain.glossary)) {
    pushChunk(chunks, 'L2', `glossary-${g.term.replace(/\s+/g, '-').toLowerCase()}`, `Glossary — ${g.term}`,
      g.definition, g.path || 'company-brain/glossary/', g);
  }

  // Rules matrix (compiled, deterministic — Agent 3)
  for (const r of rules) {
    pushChunk(chunks, 'L2', `rule-${r.rule_id}`, `Rule ${r.rule_id} (${r.code}) — ${r.name}`,
      [r.description,
       `Category: ${r.category} · Severity: ${r.severity} · On fail: ${r.on_fail} · Status: ${r.status}`,
       `Error code: ${r.error_code}`,
       `Condition: ${r.condition?.type} — ${r.condition?.expression}`,
       r.condition?.params ? `Params: ${JSON.stringify(r.condition.params)}` : '',
       `Applies to: types ${(r.applies_to?.submission_types || []).join('/') || 'all'} · programmes ${(r.applies_to?.programmes || []).join('/') || 'all'} · tiers ${(r.applies_to?.tiers || []).join('/') || 'all'}`,
       `Version ${r.version || 'n/a'} · Effective ${r.effective_date || 'n/a'} · Approved by ${r.approved_by || 'n/a'}`]
        .filter(Boolean).join('\n'),
      r.policy_ref || 'docs/03-agent-rules-engine.md', r);
  }

  // Partner tiers
  for (const t of tiers) {
    pushChunk(chunks, 'L2', `tier-${t.tier_id}`, `Partner Tier — ${t.name}`,
      [t.eligibility_criteria,
       `Status: ${t.status} · Level: ${t.level ?? 'n/a'} · Cap configured: ${t.programme_limits?.cap_configured === true ? 'yes' : 'no'}`,
       `Single event cap: ${t.programme_limits?.single_event_cap ?? 'NOT CONFIGURED'} ${t.programme_limits?.cap_currency || ''}`,
       `Co-op reimbursement ratio: ${t.programme_limits?.coop_reimbursement_ratio ?? 'NOT CONFIGURED'}`,
       `Required documents: ${asArray(t.required_documents).join(', ') || 'none configured'}`,
       t.effective_date ? `Effective: ${t.effective_date}` : '',
       t.approved_by ? `Approved by: ${t.approved_by}` : '', t.notes].filter(Boolean).join('\n'),
      t.source_ref || 'company-brain/glossary/partner-tier.md', t);
  }

  // ADRs — binding adjudications that supersede older policy values
  for (const a of asArray(brain.adr)) {
    pushChunk(chunks, 'L2', `adr-${a.adr_id}`, `${a.adr_id} — ${a.title}`,
      [a.decision,
       `Signed by: ${Array.isArray(a.signed_by) ? a.signed_by.join(' & ') : a.signed_by}`,
       `Effective: ${a.effective_date} · Status: ${a.status}`].filter(Boolean).join('\n'),
      'docs/03-agent-rules-engine.md#ADR', a);
  }

  // Rule conflicts (open ones drive the Conflict Banner; resolved ones cite their ADR)
  for (const c of conflicts) {
    pushChunk(chunks, 'L2', `conflict-${c.conflict_id}`, `Rule Conflict ${c.conflict_id} — ${c.field} (${c.status})`,
      [`${c.rule_a} says ${JSON.stringify(c.value_a)} (source ${c.source_a}) while ${c.rule_b} says ${JSON.stringify(c.value_b)} (source ${c.source_b}).`,
       c.resolution ? `Resolution: ${c.resolution} — resolved by ${c.resolved_by || 'n/a'} on ${c.resolved_at || 'n/a'}` : 'Resolution: OPEN — awaiting human adjudication; no silent override is permitted.',
       c.notes,
       asArray(c.affected_submissions).length ? `Affected submissions: ${c.affected_submissions.join(', ')}` : '']
        .filter(Boolean).join('\n'),
      'docs/03-agent-rules-engine.md#conflicts', c);
  }

  // Rule-matrix versions (policy immutability: each submission binds its version)
  for (const v of asArray(brain.versions)) {
    pushChunk(chunks, 'L2', `version-${v.version}`, `Rule Matrix ${v.version} — ${v.status}`,
      [v.change_summary,
       `Published: ${v.published_at} · Effective: ${v.effective_date} · Approved by: ${v.approved_by}`,
       asArray(v.changes).length ? `Changes: ${v.changes.map((ch) => `${ch.rule_id} ${ch.field} ${ch.before} -> ${ch.after}`).join('; ')}` : '']
        .filter(Boolean).join('\n'),
      'docs/03-agent-rules-engine.md#versions', v);
  }

  // Agent specifications + the state machine they drive
  for (const a of asArray(agentsFile.agents)) {
    pushChunk(chunks, 'L1', `agent-${a.id}`, `Agent ${a.order} — ${a.name} (${a.name_en || a.name})`,
      [`Technology: ${asArray(a.tech).join(' + ') || 'n/a'} · Skill: ${a.skill || 'none'} · Deterministic: ${a.deterministic === false ? 'no' : 'yes'}`,
       `Token profile: ${a.token_profile || 'n/a'}`,
       `State transition: ${a.in_state} -> ${a.out_state}; on failure -> ${a.failure_state}`,
       asArray(a.responsibilities).length ? `Responsibilities:\n- ${a.responsibilities.join('\n- ')}` : '',
       asArray(a.defenses).length ? `Defenses:\n- ${a.defenses.join('\n- ')}` : '',
       a.doc ? `Specification: ${a.doc}` : ''].filter(Boolean).join('\n'),
      a.doc || 'docs/00-architecture-and-pipeline.md', a);
  }

  for (const t of asArray(agentsFile.state_machine)) {
    pushChunk(chunks, 'L1', `state-${t.from}-${t.to}`.replace(/[^a-zA-Z0-9_*-]/g, '_'),
      `State ${t.from} -> ${t.to}`,
      [`Trigger: ${t.trigger}`, t.agent ? `Owning agent: ${t.agent}` : 'Owning agent: none (external / human action)'].join('\n'),
      'docs/00-architecture-and-pipeline.md#state-machine', t);
  }

  // Three-layer isolation (why business rules and prompts can never be silently edited)
  for (const iso of asArray(brain.three_layer_isolation)) {
    pushChunk(chunks, 'L0', `isolation-${iso.layer}`, `Layer ${iso.layer} — ${iso.name} (${iso.binding} binding)`,
      [iso.role_en || iso.role_zh, iso.body].filter(Boolean).join('\n'),
      'docs/08-brain-layer.md#three-layer-isolation', iso);
  }

  // Onboarding pathways + enterprise setup progress
  for (const p of asArray(brain.onboarding_pathways)) {
    pushChunk(chunks, 'L0', `onboarding-${p.id}`, `Onboarding Pathway ${p.id} — ${p.title_en || ''}`,
      [p.action_en, p.fits_en].filter(Boolean).join('\n'),
      'docs/10-enterprise-admin-setup-wizard.md', p);
  }

  const sp = brain.setup_progress || {};
  if (sp.total_sections) {
    pushChunk(chunks, 'L0', 'setup-progress', 'Enterprise Setup Progress — Programme Setup',
      [`${sp.completed_sections} of ${sp.total_sections} sections complete (${sp.percent}%). Save and return later: ${sp.save_and_return_later ? 'yes' : 'no'}`,
       ...asArray(sp.sections).map((s) => `- ${s.label} [${s.status}]: ${s.detail}${s.next_action_label ? ` (next: ${s.next_action_label})` : ''}`)]
        .filter(Boolean).join('\n'),
      'docs/10-enterprise-admin-setup-wizard.md', sp);
  }

  for (const m of asArray(brain.client_documents_manifest)) {
    pushChunk(chunks, 'L3', `manifest-${m.seq}`, `Client Document ${m.seq} — ${m.filename}`,
      [`Category: ${m.category} · Importance: ${m.importance}`, `Extraction target: ${m.extraction_target}`]
        .filter(Boolean).join('\n'),
      `client-documents/${m.filename}`, m);
  }

  // IDF pass
  const df = new Map();
  for (const ch of chunks) {
    for (const t of new Set(ch.terms)) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = chunks.length || 1;
  for (const ch of chunks) {
    ch.idf = new Map();
    for (const [t, f] of ch.freq) ch.idf.set(t, Math.log(1 + N / (df.get(t) || 1)) * (1 + Math.log(f)));
  }
  return chunks;
}

let INDEX = null;
function index() {
  if (!INDEX) INDEX = buildIndex();
  return INDEX;
}
function reindex() { INDEX = null; return index(); }

/* ------------------------------------------------------------------ */
/* Retrieval                                                           */
/* ------------------------------------------------------------------ */

function retrieve(query, { k = 6, layers = null } = {}) {
  const q = terms(query);
  if (!q.length) return [];
  const qset = new Set(q);
  const allowed = layers && layers.length ? new Set(layers) : null;
  const scored = index()
    .filter((ch) => !allowed || allowed.has(ch.layer))
    .map((ch) => {
    let score = 0;
    const matched = [];
    for (const [t, w] of ch.idf) {
      if (qset.has(t)) { score += w; matched.push(t); }
    }
    if (!score) return null;
    // Length normalisation keeps long wiki sections from dominating short rules.
    const norm = score / Math.sqrt(ch.length);
    const coverage = matched.length / qset.size;
    return { chunk: ch, score: norm * (0.6 + 0.4 * coverage), matched };
  }).filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, k);
  const max = top[0]?.score || 1;
  return top.map((s) => ({
    layer: s.chunk.layer,
    id: s.chunk.id,
    title: s.chunk.title,
    excerpt: excerpt(s.chunk.body, s.matched),
    body: s.chunk.body,
    source_ref: s.chunk.source_ref,
    relevance: Number((s.score / max).toFixed(3)),
    matched_terms: [...new Set(s.matched)].slice(0, 12),
    meta: s.chunk.meta
  }));
}

function excerpt(body, matched, radius = 160) {
  const lower = body.toLowerCase();
  let at = -1;
  for (const m of matched) {
    const i = lower.indexOf(m);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return body.slice(0, radius * 2);
  const start = Math.max(0, at - radius);
  const end = Math.min(body.length, at + radius * 2);
  return `${start > 0 ? '…' : ''}${body.slice(start, end).trim()}${end < body.length ? '…' : ''}`;
}

/* ------------------------------------------------------------------ */
/* Grounded answering                                                  */
/* ------------------------------------------------------------------ */

const ai = require('./ai');

/**
 * Answer a question strictly from retrieved brain chunks.
 * If a live LLM provider is configured the context is sent to it (still grounded
 * and cited); otherwise an extractive answer is composed deterministically from
 * the same chunks. Either way the content originates from the AI-authored corpus.
 */
async function ask(question, { k = 6, layers = null } = {}) {
  const hits = retrieve(question, { k, layers });
  if (!hits.length) {
    return {
      question,
      mode: 'no-evidence',
      grounded: false,
      answer: 'No matching evidence was found in the Company Brain corpus. Per Iron Invariant 3 (zero auto-guessing) the system will not speculate — please configure the relevant policy section in Programme Setup, or rephrase the question.',
      citations: [],
      retrieved: [],
      provider: ai.status()
    };
  }

  const provider = ai.status();
  if (provider.available) {
    try {
      const context = hits.map((h, i) => `[${i + 1}] (${h.layer}) ${h.title}\nSource: ${h.source_ref}\n${h.body}`).join('\n\n---\n\n');
      const text = await ai.chat([
        { role: 'system', content: 'You are the PartnerFlow Company Brain retrieval assistant. Answer ONLY from the supplied evidence. Cite every claim as [n] matching the evidence index. If the evidence does not settle the question, say so explicitly and never invent a policy limit, amount, ratio or deadline. CRITICAL REQUIREMENT: Answer strictly and entirely in English at all times. Do NOT use Chinese or any non-English characters.' },
        { role: 'user', content: `Evidence:\n\n${context}\n\nQuestion: ${question}` }
      ]);
      return {
        question, mode: 'llm-grounded', grounded: true, answer: text,
        citations: hits.map((h, i) => ({ n: i + 1, layer: h.layer, title: h.title, source_ref: h.source_ref, relevance: h.relevance })),
        retrieved: hits.map(strip), provider
      };
    } catch (err) {
      // Graceful degradation — fall through to extractive mode, record the failure.
      provider.last_error = String(err && err.message || err);
    }
  }

  const best = hits[0];
  const lines = hits.map((h, i) => `${i + 1}. ${h.title} — ${h.excerpt}  [${h.source_ref}]`);
  const answer = [
    `Based on ${hits.length} evidence chunk(s) retrieved from the Company Brain (top match: ${best.title}, relevance ${(best.relevance * 100).toFixed(0)}%):`,
    '',
    ...lines,
    '',
    'Retrieval-only answer: no live LLM provider is configured on this host, so the response is composed verbatim from the indexed corpus rather than generated. Configure a provider in server/.env to enable grounded generation.'
  ].join('\n');

  return {
    question, mode: 'rag-extractive', grounded: true, answer,
    citations: hits.map((h, i) => ({ n: i + 1, layer: h.layer, title: h.title, source_ref: h.source_ref, relevance: h.relevance })),
    retrieved: hits.map(strip), provider
  };
}

function strip(h) {
  const { body, ...rest } = h;
  return rest;
}

function stats() {
  const byLayer = {};
  for (const ch of index()) byLayer[ch.layer] = (byLayer[ch.layer] || 0) + 1;
  return { chunks: index().length, by_layer: byLayer, index_built: !!INDEX };
}

module.exports = { buildIndex, index, reindex, retrieve, ask, stats, terms };
