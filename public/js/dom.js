/* DOM helpers, formatting, icons, toasts, modals. */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    if (c instanceof Node) {
      el.appendChild(c);
    } else if (typeof c === 'object') {
      const val = c.text ?? c.message ?? c.comment ?? c.body ?? c.name ?? (c.toString && c.toString !== Object.prototype.toString ? c.toString() : JSON.stringify(c));
      el.appendChild(document.createTextNode(String(val)));
    } else {
      el.appendChild(document.createTextNode(String(c)));
    }
  }
}

export const frag = (...children) => { const f = document.createDocumentFragment(); append(f, children); return f; };

/* ---------- Formatting ---------- */

const CURRENCY_SYMBOL = { MYR: 'RM', USD: 'US$', SGD: 'S$', IDR: 'Rp', CNY: '¥' };

export function money(value, currency = 'MYR') {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const sym = CURRENCY_SYMBOL[currency] || `${currency} `;
  const body = n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym} ${body}`;
}

export function compactMoney(value, currency = 'MYR') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const sym = CURRENCY_SYMBOL[currency] || `${currency} `;
  if (Math.abs(n) >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${sym}${(n / 1_000).toFixed(1)}K`;
  return `${sym}${n.toFixed(2)}`;
}

export function pct(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

export function dateOnly(v) {
  if (!v) return '—';
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : String(v);
}

export function dateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function relTime(v) {
  if (!v) return '—';
  const d = new Date(v).getTime();
  if (Number.isNaN(d)) return String(v);
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const hr = Math.round(m / 60); if (hr < 24) return `${hr}h ago`;
  const dy = Math.round(hr / 24); if (dy < 31) return `${dy}d ago`;
  return dateOnly(v);
}

export function bytes(n) {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

export function initials(name = '') {
  const parts = String(name).trim().split(/[\s@._-]+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Icons ---------- */

const PATHS = {
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  plus: 'M12 5v14M5 12h14',
  brain: 'M12 4.5a3 3 0 0 0-5.9-.7A3 3 0 0 0 4 9.3a3.2 3.2 0 0 0 .6 5.6A3 3 0 0 0 9 19.4a3 3 0 0 0 3-1.5m0-13.4a3 3 0 0 1 5.9-.7A3 3 0 0 1 20 9.3a3.2 3.2 0 0 1-.6 5.6A3 3 0 0 1 15 19.4a3 3 0 0 1-3-1.5m0-13.4v15.5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15h6M9 11h2',
  money: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2ZM7 11V7a5 5 0 0 1 10 0v4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  chevron: 'M9 18l6-6-6-6',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  spark: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3ZM19 15l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6L15.5 18l2.6-.4L19 15Z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z',
  layers: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  scale: 'M12 3v18M7 21h10M5 7h14M5 7l-3 6a3.5 3.5 0 0 0 6 0L5 7ZM19 7l-3 6a3.5 3.5 0 0 0 6 0l-3-6Z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  calendar: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18',
  fileText: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-4M12 8h.01',
  comment: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'
};

export function icon(name, size = 18) {
  const d = PATHS[name] || PATHS.info;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
  return svg;
}

/* ---------- Toasts ---------- */

const KIND_TITLE = { ok: 'Done', err: 'Blocked', info: 'Note' };

export function toast(message, kind = 'info', title = null, ms = 4200) {
  const host = document.getElementById('toasts');
  const el = h('div', { class: 'toast', dataset: { kind } },
    h('span', { class: 'ti' }, icon(kind === 'ok' ? 'check' : kind === 'err' ? 'alert' : 'info', 16)),
    h('div', {}, title ? h('b', {}, title) : null, message));
  host.appendChild(el);
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 240); };
  const t = setTimeout(kill, ms);
  el.addEventListener('click', () => { clearTimeout(t); kill(); });
  return el;
}

/* ---------- Modal ---------- */

let openModal = null;

export function modal({ title, subtitle, body, actions = [], kind = '', danger = false, onMount = null, dismissable = true }) {
  closeModal();
  const root = document.getElementById('modalRoot');
  const panel = h('div', {
    class: `modal${danger || kind === 'danger' ? ' danger' : ''}`,
    role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1'
  },
  h('div', { class: 'modal-head' },
    h('h2', {}, title),
    subtitle ? h('p', {}, subtitle) : null),
  body ? h('div', { class: 'modal-body' }, body) : null,
  actions.length ? h('div', { class: 'modal-foot' }, actions) : null);

  const scrim = h('div', { class: 'modal-scrim' }, panel);
  if (dismissable) scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) closeModal(); });
  root.appendChild(scrim);

  const onKey = (e) => {
    if (e.key === 'Escape' && dismissable) { e.stopPropagation(); closeModal(); }
    if (e.key === 'Tab') {
      const f = panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const list = [...f].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  openModal = { scrim, onKey };

  const focusTarget = panel.querySelector('[data-autofocus]') || panel.querySelector('input, textarea, select, button');
  if (focusTarget) setTimeout(() => focusTarget.focus(), 40); else panel.focus();
  if (onMount) onMount(panel, closeModal);
  return panel;
}

export function closeModal() {
  if (!openModal) return;
  document.removeEventListener('keydown', openModal.onKey, true);
  openModal.scrim.remove();
  openModal = null;
}

export function confirmModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm }) {
  const ok = h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button' }, confirmLabel);
  const cancel = h('button', { class: 'btn btn-ghost', type: 'button' }, cancelLabel);
  ok.addEventListener('click', async () => { closeModal(); await onConfirm(); });
  cancel.addEventListener('click', () => closeModal());
  modal({ title, body: h('div', { class: 'callout' + (danger ? ' danger' : '') }, h('span', { class: 'ci' }, icon(danger ? 'alert' : 'info', 18)), h('div', {}, message)), actions: [cancel, ok], danger });
}

/* ---------- Small components ---------- */

export function badge(text, tone = 'neutral', withDot = false) {
  return h('span', { class: `badge badge-${tone}` }, withDot ? h('i', { class: 'bdot' }) : null, text);
}

export function stateBadge(state, uiStatus) {
  const tone = state === 'SECURITY_QUARANTINE' ? 'purple'
    : uiStatus === 'approved' ? 'ok'
      : uiStatus === 'rejected' ? 'no'
        : ['POLICY_BLOCKED', 'BUDGET_REJECTED', 'RECOVERABLE_ERROR'].includes(state) ? 'no'
          : ['REQUIRES_POLICY_INTERPRETATION', 'NEEDS_HUMAN_CONFIRMATION', 'NEEDS_INTAKE_CORRECTION'].includes(state) ? 'warn'
            : uiStatus === 'pending' ? 'info' : 'neutral';
  return h('span', { class: `badge badge-${tone}`, title: `Internal state: ${state}` },
    h('i', { class: 'bdot' }), prettyState(state));
}

export function prettyState(state) {
  return String(state || 'UNKNOWN').split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

export function card(title, sub, bodyNodes, opts = {}) {
  return h('section', { class: `card${opts.class ? ' ' + opts.class : ''}` },
    title ? h('div', { class: 'card-head' },
      h('div', {}, h(title === title.toUpperCase() ? 'h3' : 'h2', {}, title), sub ? h('div', { class: 'sub' }, sub) : null),
      opts.headRight || null) : null,
    h('div', { class: title ? 'card-body' : 'card-pad' }, bodyNodes));
}

export function empty(iconName, title, message, action = null) {
  return h('div', { class: 'empty' },
    h('div', { class: 'ei' }, icon(iconName, 26)),
    h('h3', {}, title),
    h('p', {}, message),
    action ? h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '16px' } }, action) : null);
}

export function skeletonList(n = 4) {
  return frag(Array.from({ length: n }, () => h('div', { class: 'skeleton', style: { marginBottom: '10px' } })));
}

export function barRow(label, value, max, display = null) {
  const width = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return h('div', { class: 'bar-row' },
    h('span', { class: 'bl', title: label }, label),
    h('span', { class: 'bt' }, h('i', { style: { width: `${width}%` } })),
    h('span', { class: 'bv' }, display ?? value));
}

export function field(label, inputEl, { hint = null, required = false, error = null, forId = null } = {}) {
  return h('div', { class: 'field' },
    h('label', { for: forId || undefined, class: required ? 'req' : null }, label),
    inputEl,
    hint ? h('span', { class: 'hint' }, hint) : null,
    error ? h('span', { class: 'err' }, error) : null);
}
