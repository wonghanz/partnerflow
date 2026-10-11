/* Ask the Brain — RAG-lite retrieval drawer over the AI-authored company corpus. */

import { api } from '../api.js';
import { h, icon, toast, pct } from '../dom.js';
import { ctx } from '../state.js';

const SUGGESTIONS = [
  'What is the single-event grant cap for Gold Tier?',
  'What is the claim window for a completed activity?',
  'How is the co-op reimbursement ratio calculated?',
  'When must a submission go to a human instead of being auto-decided?',
  'What are the rules regarding invoice deduplication?',
  'What does Iron Invariant 3 (zero auto-guessing) mean in practice?'
];

const LAYER_TONE = { L0: 'brand', L1: 'info', L2: 'ok', L3: 'neutral', L4: 'warn', L5: 'info' };

let host = null;

export function openBrainDrawer(initialQuestion = '') {
  if (host) return;
  const root = document.getElementById('drawerRoot');
  const input = h('textarea', {
    class: 'input', rows: '3', placeholder: 'Ask the company brain anything about policy, tiers, thresholds, or the pipeline…',
    'aria-label': 'Question'
  }, initialQuestion || '');

  const answerBox = h('div', { class: 'qa-answer' });
  const citeBox = h('div', { class: 'qa-cites' });
  const hitsBox = h('div', { class: 'qa-hits' });
  const metaBox = h('div', { class: 'qa-meta' });
  const busy = h('div', { class: 'spin' });

  const ask = async () => {
    const q = input.value.trim();
    if (!q) { input.focus(); return; }
    askBtn.disabled = true;
    answerBox.replaceChildren(h('div', { class: 'row', style: { gap: '10px', color: 'var(--ink-2)' } }, busy.cloneNode(), h('span', { class: 'tiny' }, 'Retrieving from the authorised corpus…')));
    citeBox.replaceChildren(); hitsBox.replaceChildren(); metaBox.replaceChildren();
    try {
      const r = await api.ragAsk(q, 6);
      renderAnswer(r);
    } catch (e) {
      answerBox.replaceChildren(h('div', { class: 'callout danger' }, h('span', { class: 'ci' }, icon('alert', 18)), h('div', {}, String(e.message || e))));
    } finally {
      askBtn.disabled = false;
    }
  };

  const renderAnswer = (r) => {
    const modeTone = r.mode === 'llm-grounded' ? 'ok' : r.mode === 'rag-extractive' ? 'info' : 'warn';
    const modeLabel = r.mode === 'llm-grounded' ? 'LLM-Grounded'
      : r.mode === 'rag-extractive' ? 'RAG Extractive'
        : 'No Evidence';
    answerBox.replaceChildren(
      h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', marginBottom: '10px' } },
        h('span', { class: `badge badge-${modeTone}` }, h('i', { class: 'bdot' }), modeLabel),
        r.grounded === false ? h('span', { class: 'badge badge-warn' }, 'Iron Invariant 3 · Zero Auto-Guessing') : null,
        h('span', { class: 'badge badge-neutral' }, `${(r.retrieved || []).length} hits`)),
      h('div', { class: 'qa-text' }, r.answer || '(No answer available)'));

    citeBox.replaceChildren();
    for (const c of (r.citations || [])) {
      citeBox.appendChild(h('div', { class: 'cite' },
        h('span', { class: `badge badge-${LAYER_TONE[c.layer] || 'neutral'}` }, c.layer || 'L?'),
        h('div', {}, h('b', {}, c.title || c.id || '—'),
          c.source_ref ? h('div', { class: 'mono tiny muted' }, c.source_ref) : null,
          c.excerpt ? h('p', { class: 'tiny' }, c.excerpt) : null)));
    }

    hitsBox.replaceChildren();
    for (const hit of (r.retrieved || [])) {
      hitsBox.appendChild(h('div', { class: 'hit' },
        h('div', { class: 'hit-top' },
          h('span', { class: `badge badge-${LAYER_TONE[hit.layer] || 'neutral'}` }, hit.layer || 'L?'),
          h('b', { class: 'truncate' }, hit.title || hit.id),
          h('span', { class: 'mono tiny muted' }, pct(hit.relevance, 1))),
        hit.excerpt ? h('p', { class: 'tiny muted' }, hit.excerpt) : null,
        hit.source_ref ? h('div', { class: 'mono tiny muted' }, hit.source_ref) : null));
    }

    const prov = r.provider || {};
    metaBox.replaceChildren(
      h('div', { class: 'tiny muted' },
        `Mode: ${r.mode} · Provider: ${prov.provider || 'none'}${prov.model ? ` · ${prov.model}` : ''}`,
        h('br'),
        r.mode === 'rag-extractive' ? 'No live LLM configured on this host — answers are assembled verbatim from the authorised corpus with no hallucination.' : ''),
      h('div', { class: 'row', style: { gap: '8px', marginTop: '10px' } },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => navigator.clipboard?.writeText(r.answer || '').then(() => toast('Answer copied to clipboard.', 'ok')) }, icon('doc', 14), 'Copy Answer')));
  };

  const askBtn = h('button', { class: 'btn btn-primary', type: 'button', onClick: ask }, icon('send', 15), 'Ask');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ask(); }
  });

  const suggestions = h('div', { class: 'suggest' }, SUGGESTIONS.map((s) =>
    h('button', {
      class: 'chip', type: 'button', onClick: () => { input.value = s; input.focus(); ask(); }
    }, s)));

  const drawer = h('aside', {
    class: 'drawer', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Ask the Brain', tabindex: '-1'
  },
  h('div', { class: 'drawer-head' },
    h('div', {}, h('h2', {}, icon('brain', 18), ' Ask the Brain'),
      h('p', { class: 'tiny muted' }, 'Authorised Corpus: L0–L5 · Ctrl/⌘+K to open · Ctrl/⌘+Enter to submit')),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onClick: close }, icon('x', 18))),
  h('div', { class: 'drawer-body' },
    h('div', { class: 'field' }, input),
    h('div', { class: 'row', style: { gap: '8px', marginBottom: '14px' } }, askBtn,
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: async () => {
        toast('Reindexing corpus…', 'info');
        try { const s = await api.reindex(); toast(`Index rebuilt: ${s.chunks} chunks.`, 'ok'); } catch (e) { toast(String(e.message || e), 'err'); }
      } }, icon('refresh', 14), 'Reindex')),
    suggestions,
    h('div', { class: 'divider' }),
    answerBox, citeBox, hitsBox, metaBox));

  const scrim = h('div', { class: 'drawer-scrim' }, drawer);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  root.appendChild(scrim);
  host = scrim;

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  setTimeout(() => input.focus(), 60);

  function close() {
    document.removeEventListener('keydown', onKey);
    scrim.remove();
    host = null;
  }

  if (initialQuestion) ask();
  return close;
}

export function brainStatsLine() {
  const r = ctx.health?.rag;
  if (!r) return null;
  return h('span', { class: 'tiny muted mono' }, `${r.chunks} chunks ${JSON.stringify(r.by_layer || {})}`);
}
