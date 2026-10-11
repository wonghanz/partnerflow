/* App-wide cache, bootstrap data and the human-authority gate (Iron Invariant 1). */

import { api, session, ApiError } from './api.js';
import { h, icon, modal, closeModal, toast, initials, money, relTime } from './dom.js';

export const ctx = {
  health: null,
  config: null,
  approvers: [],
  brain: null,
  booted: false,
  bootError: null,
  navigate(path) { if (location.hash !== path) location.hash = path; else window.dispatchEvent(new HashChangeEvent('hashchange')); },
  reload() { location.reload(); }
};

export async function boot() {
  const [health, config, approvers] = await Promise.all([api.health(), api.config(), api.approvers().catch(() => ({ approvers: [] }))]);
  ctx.health = health;
  ctx.config = config.config;
  ctx.approvers = approvers.approvers || [];
  ctx.booted = true;
  const c = ctx.config || {};
  document.title = `${c.brand?.name || 'UMochi Squad'} · ${c.brand?.product || 'PartnerFlow'}`;
  setText('brandName', c.brand?.name || 'UMochi Squad');
  setText('brandProduct', c.brand?.product || 'PartnerFlow');
  setText('engineVersion', c.rule_engine_version || '—');
  const ai = health.ai_provider || {};
  setText('llmProvider', ai.available ? `${ai.provider} · ${ai.model}` : 'none · RAG only');
  document.documentElement.style.setProperty('--g-from', c.brand?.gradient?.[0] || '#72CDFF');
  document.documentElement.style.setProperty('--g-to', c.brand?.gradient?.[1] || '#BFFFCC');
  return ctx;
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

let uptimeTimer = null;
export function startUptimeTicker() {
  const el = document.getElementById('ragChunks');
  const up = document.getElementById('uptime');
  if (up) up.textContent = fmtUptime(ctx.health?.uptime_s);
  if (el) el.textContent = `${ctx.health?.rag?.chunks ?? '—'} chunks`;
  if (uptimeTimer) clearInterval(uptimeTimer);
  uptimeTimer = setInterval(async () => {
    try {
      const h2 = await api.health();
      ctx.health = h2;
      if (up) up.textContent = fmtUptime(h2.uptime_s);
      if (el) el.textContent = `${h2.rag?.chunks ?? '—'} chunks`;
    } catch { /* server restarted; next tick retries */ }
  }, 30000);
}

function fmtUptime(s) {
  if (!Number.isFinite(s)) return '—';
  const n = Math.floor(s);
  if (n < 60) return `${n}s`;
  if (n < 3600) return `${Math.floor(n / 60)}m ${n % 60}s`;
  return `${Math.floor(n / 3600)}h ${Math.floor((n % 3600) / 60)}m`;
}

/* ---------- Human authority ---------- */

export function currentApprover() {
  const a = session.approver;
  if (!a || !session.token) return null;
  if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) { session.clear(); return null; }
  return a;
}

export function renderSession() {
  const slot = document.getElementById('sessionSlot');
  if (!slot) return;
  slot.replaceChildren();
  const a = currentApprover();
  if (!a) {
    slot.appendChild(h('button', { class: 'btn btn-primary btn-sm', type: 'button', onClick: () => requireApprover() },
      icon('lock', 15), 'Approver Sign-in'));
    return;
  }
  slot.appendChild(h('div', { class: 'session-chip', title: `${a.email}\n${a.role || ''}` },
    h('span', { class: 'av' }, initials(a.name || a.email)),
    h('span', { class: 'who' }, h('b', {}, a.name || a.email), h('i', {}, a.role || 'Approver')),
    h('button', {
      class: 'icon-btn', type: 'button', 'aria-label': 'Sign out', title: 'Sign out',
      onClick: async () => {
        try { await api.signOut(); } catch { /* token may already be gone */ }
        session.clear(); renderSession(); toast('Signed out.', 'info');
      }
    }, icon('logout', 15))));
}

/**
 * Resolve an authenticated approver, prompting for sign-in when needed.
 * Returns the approver record, or null when the operator cancels.
 */
export function requireApprover(reason) {
  const existing = currentApprover();
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const list = h('div', { class: 'stack' });
    const close = (v) => { closeModal(); resolve(v); };

    const doSignIn = async (email, row) => {
      row?.classList.add('busy');
      try {
        const r = await api.signIn(email);
        session.set(r.token, { ...r.approver, expires_at: r.expires_at });
        renderSession();
        close(r.approver);
        toast(`Signed in as ${r.approver.name || email}.`, 'ok');
      } catch (e) {
        row?.classList.remove('busy');
        toast(e instanceof ApiError ? `${e.code} — ${e.message}` : String(e.message || e), 'err');
      }
    };

    if (!ctx.approvers.length) {
      list.appendChild(h('div', { class: 'callout warn' }, h('span', { class: 'ci' }, icon('alert', 18)),
        h('div', {}, 'No approvers are configured. No human decision can be recorded.')));
    }
    for (const ap of ctx.approvers) {
      const row = h('button', { class: 'approver-row', type: 'button', onClick: () => doSignIn(ap.email, row) },
        h('span', { class: 'av' }, initials(ap.name || ap.email)),
        h('span', { class: 'meta' },
          h('b', {}, ap.name || ap.email),
          h('i', {}, `${ap.email} · ${ap.role || 'Approver'}`),
          h('span', { class: 'row-tags' },
            ap.can_final_approve ? h('span', { class: 'chip chip-ok' }, 'Final Approve') : null,
            h('span', { class: 'chip' }, `Limit: ${money(ap.approval_limit, ctx.config?.org?.base_currency)}`))),
        h('span', { class: 'go' }, icon('chevron', 16)));
      list.appendChild(row);
    }

    const manual = h('input', { class: 'input', type: 'email', placeholder: 'approver@company.com', 'aria-label': 'Approver email' });
    const goBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => doSignIn(manual.value.trim(), null) }, 'Sign in');
    manual.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSignIn(manual.value.trim(), null); });
    list.appendChild(h('div', { class: 'divider' }));
    list.appendChild(h('div', { class: 'row', style: { gap: '8px' } }, manual, goBtn));

    modal({
      title: 'Human Final Authority',
      subtitle: reason || 'Iron Invariant 1: AI cannot replace human decisions. This action requires an authorised approver session.',
      body: list,
      actions: [h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => close(null) }, 'Cancel')],
      dismissable: true
    });
  });
}

/** Run an authenticated mutation; surfaces Iron-Invariant failures as toasts. */
export async function withAuthority(action, reason) {
  const a = await requireApprover(reason);
  if (!a) return { ok: false, cancelled: true };
  try {
    const result = await action(a);
    return { ok: true, approver: a, result };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) { session.clear(); renderSession(); return withAuthority(action, reason); }
      toast(`${e.code} — ${e.message}`, 'err', null, 7000);
    } else {
      toast(String(e.message || e), 'err');
    }
    return { ok: false, error: e };
  }
}

/* ---------- Shared lookups ---------- */

let partnersCache = null;
export async function partners() {
  if (!partnersCache) partnersCache = (await api.partners()).partners;
  return partnersCache;
}
export function invalidatePartners() { partnersCache = null; }

let brainCache = null;
export async function brain() {
  if (!brainCache) brainCache = await api.brain();
  return brainCache;
}
export function invalidateBrain() { brainCache = null; }

export { relTime };
