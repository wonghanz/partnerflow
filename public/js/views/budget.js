/* Budget Ledger — Iron Invariant 2: Four-state pool conservation and atomic transactions. */

import { api, ApiError } from '../api.js';
import {
  h, icon, toast, money, compactMoney, dateTime, dateOnly, badge, empty, pct, barRow
} from '../dom.js';

export async function render() {
  const wrap = h('div', { class: 'stack' });

  const statsHost = h('div', { class: 'grid g-6' });
  const bannerHost = h('div', {});
  const barHost = h('section', { class: 'card' });
  const forecastHost = h('section', { class: 'card' });
  const tableHost = h('section', { class: 'card' });
  const txHost = h('section', { class: 'card' });

  wrap.append(
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', { class: 'page-title' }, h('span', { class: 'grad' }, 'Budget Ledger')),
        h('p', { class: 'page-sub' },
          'Iron Invariant 2: Strict four-state conservation (Available = Allocated − (Committed + Approved + Paid) ≥ 0). All balance movements execute atomically with idempotency keys.')),
      h('div', { class: 'page-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => load() }, icon('refresh', 15), 'Refresh'),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => exportData() }, icon('download', 15), 'Export JSON'))),
    statsHost,
    bannerHost,
    barHost,
    forecastHost,
    tableHost,
    txHost
  );

  let ledgerData = null;
  let txData = null;

  async function load() {
    statsHost.replaceChildren(...Array.from({ length: 5 }, () => h('div', { class: 'skeleton', style: { height: '84px' } })));
    tableHost.replaceChildren(h('div', { class: 'card-pad' }, h('div', { class: 'skeleton', style: { height: '180px' } })));
    txHost.replaceChildren(h('div', { class: 'card-pad' }, h('div', { class: 'skeleton', style: { height: '180px' } })));

    try {
      const [led, txs] = await Promise.all([
        api.ledger(),
        api.transactions()
      ]);
      ledgerData = led;
      txData = txs;

      renderStats(statsHost, led);
      renderBanner(bannerHost, led);
      renderLedgerBar(barHost, led);
      renderForecast(forecastHost, led);
      renderPartnerTable(tableHost, led);
      renderTransactions(txHost, txs);
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.code} — ${e.message}` : String(e.message || e);
      statsHost.replaceChildren();
      tableHost.replaceChildren(h('div', { class: 'callout danger' }, h('span', { class: 'ci' }, icon('alert', 18)), h('div', {}, msg)));
    }
  }

  function exportData() {
    const payload = { ledger: ledgerData, transactions: txData };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `budget-ledger-${Date.now().toString(36)}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Budget ledger exported successfully.', 'ok');
  }

  await load();
  return wrap;
}

function renderStats(host, d) {
  const t = d.company_totals || d.computed_totals || {};
  const cur = d.currency || 'MYR';

  host.replaceChildren(
    statMini('money', 'Allocated', money(t.allocated, cur), ''),
    statMini('clock', 'Committed', money(t.committed, cur), 'brand'),
    statMini('check', 'Approved Pending Payout', money(t.approved, cur), 'ok'),
    statMini('spark', 'Paid Out', money(t.paid, cur), ''),
    statMini('shield', 'Available Balance', money(t.available, cur), t.available > 0 ? 'ok' : 'warn')
  );
}

function statMini(iconName, label, value, tone = '') {
  return h('div', { class: `stat${tone ? ' mini-stat' : ''}`, dataset: tone ? { accent: tone === 'ok' ? 'accepted' : tone === 'warn' ? 'rejected' : 'pending' } : {} },
    h('div', { class: 'stat-top' }, h('span', { class: 'si' }, icon(iconName, 16)), h('span', { class: 'sl' }, label)),
    h('div', { class: 'stat-value sm' }, value));
}

function renderBanner(host, d) {
  const rec = d.reconcile || {};
  const isOk = rec.balanced !== false;
  const t = d.company_totals || d.computed_totals || {};
  const cur = d.currency || 'MYR';

  host.replaceChildren(
    h('div', { class: `callout ${isOk ? '' : 'danger'}` },
      h('span', { class: 'ci' }, icon(isOk ? 'check' : 'alert', 18)),
      h('div', {},
        h('b', {}, isOk ? 'Four-State Invariant Balanced — ' : 'Reconciliation Drift Warning — '),
        `Conservation formula: ${d.invariant_formula || 'Available = Allocated − (Committed + Approved + Paid) ≥ 0'}.`,
        h('div', { class: 'tiny muted', style: { marginTop: '4px' } },
          `Fiscal Year: FY${d.fiscal_year || 2026} · Base Currency: ${cur} · Partners Covered: ${rec.rows || (d.rows || []).length} rows · Drift: `,
          h('span', { class: isOk ? 'mono ok' : 'mono recon-drift' }, isOk ? 'RM 0.00' : JSON.stringify(rec.drift || []))
        )
      )
    )
  );
}

function renderLedgerBar(host, d) {
  const t = d.company_totals || d.computed_totals || {};
  const cur = d.currency || 'MYR';
  const alloc = Number(t.allocated || 1);
  const comm = Number(t.committed || 0);
  const appr = Number(t.approved || 0);
  const paid = Number(t.paid || 0);
  const avail = Number(t.available || 0);

  const pComm = Math.max(0, (comm / alloc) * 100);
  const pAppr = Math.max(0, (appr / alloc) * 100);
  const pPaid = Math.max(0, (paid / alloc) * 100);
  const pAvail = Math.max(0, (avail / alloc) * 100);

  host.replaceChildren(
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Four-State Budget Pool'),
        h('div', { class: 'sub' }, `Total Programme Pool: ${money(alloc, cur)} · Real-time liquidity distribution`)),
      badge(pAvail < 15 ? 'Liquidity Constrained' : 'Pool Healthy', pAvail < 15 ? 'warn' : 'ok')),
    h('div', { class: 'card-body' },
      h('div', { class: 'ledger-bar', role: 'img', 'aria-label': 'Budget 4-state bar' },
        comm > 0 ? h('span', { class: 'lb-committed', style: { width: `${pComm}%` }, title: `Committed: ${money(comm, cur)} (${pComm.toFixed(1)}%)` }, `${pComm.toFixed(0)}%`) : null,
        appr > 0 ? h('span', { class: 'lb-approved', style: { width: `${pAppr}%` }, title: `Approved: ${money(appr, cur)} (${pAppr.toFixed(1)}%)` }, `${pAppr.toFixed(0)}%`) : null,
        paid > 0 ? h('span', { class: 'lb-paid', style: { width: `${pPaid}%` }, title: `Paid: ${money(paid, cur)} (${pPaid.toFixed(1)}%)` }, `${pPaid.toFixed(0)}%`) : null,
        avail > 0 ? h('span', { class: 'lb-available', style: { width: `${pAvail}%` }, title: `Available: ${money(avail, cur)} (${pAvail.toFixed(1)}%)` }, `${pAvail.toFixed(0)}%`) : null
      ),
      h('div', { class: 'legend' },
        h('span', {}, h('i', { class: 'lb-committed' }), `Committed: ${compactMoney(comm, cur)} (${pComm.toFixed(1)}%)`),
        h('span', {}, h('i', { class: 'lb-approved' }), `Approved: ${compactMoney(appr, cur)} (${pAppr.toFixed(1)}%)`),
        h('span', {}, h('i', { class: 'lb-paid' }), `Paid: ${compactMoney(paid, cur)} (${pPaid.toFixed(1)}%)`),
        h('span', {}, h('i', { class: 'lb-available' }), `Available: ${compactMoney(avail, cur)} (${pAvail.toFixed(1)}%)`)
      )
    )
  );
}

function renderForecast(host, d) {
  const cur = d.currency || 'MYR';
  const list = d.cashflow_forecast_14d || [];
  const totalExpected = list.reduce((acc, it) => acc + Number(it.expected_payout || 0), 0);
  const maxDay = Math.max(1, ...list.map((it) => Number(it.expected_payout || 0)));

  host.replaceChildren(
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, '14-Day Payout Forecast'),
        h('div', { class: 'sub' }, `Anticipated two-week disbursements total: ${money(totalExpected, cur)}. Daily payouts capped by approved reserves.`)),
      badge(`14-Day Total: ${compactMoney(totalExpected, cur)}`, 'info')),
    h('div', { class: 'card-body' },
      list.length
        ? h('div', { class: 'stack' }, list.map((it) => {
            const amt = Number(it.expected_payout || 0);
            return barRow(`${dateOnly(it.date)} (${it.day_of_week || 'Day'})`, amt, maxDay, money(amt, cur));
          }))
        : h('p', { class: 'tiny muted' }, 'No cashflow forecast available for this period.')
    )
  );
}

function renderPartnerTable(host, d) {
  const rows = d.rows || [];
  const cur = d.currency || 'MYR';

  host.replaceChildren(
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, `Partner Ledger Breakdown (${rows.length} Partners)`),
        h('div', { class: 'sub' }, 'Row-by-row conservation validation: Available = Allocated − (Committed + Approved + Paid)')),
      badge('PROGRAMME ROWS', 'neutral')),
    h('div', { class: 'card-body' },
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', {},
            h('tr', {},
              h('th', {}, 'Partner'),
              h('th', {}, 'Tier'),
              h('th', {}, 'Allocated'),
              h('th', {}, 'Committed'),
              h('th', {}, 'Approved'),
              h('th', {}, 'Paid Out'),
              h('th', {}, 'Available'),
              h('th', { style: { minWidth: '140px' } }, 'Utilisation')
            )
          ),
          h('tbody', {}, rows.map((r) => {
            const alloc = Number(r.allocated_amount || 0);
            const comm = Number(r.committed_amount || 0);
            const appr = Number(r.approved_amount || 0);
            const paid = Number(r.paid_amount || 0);
            const avail = Number(r.available ?? (alloc - comm - appr - paid));
            const usedPct = alloc > 0 ? ((alloc - avail) / alloc) * 100 : 0;

            return h('tr', {},
              h('td', {},
                h('b', {}, r.partner_name || r.partner_id),
                h('div', { class: 'mono tiny muted' }, r.partner_id)),
              h('td', {}, badge(r.tier || 'Standard', 'neutral')),
              h('td', { class: 'num' }, money(alloc, cur)),
              h('td', { class: 'num' }, money(comm, cur)),
              h('td', { class: 'num ok' }, money(appr, cur)),
              h('td', { class: 'num' }, money(paid, cur)),
              h('td', { class: `num ${avail < 0 ? 'recon-drift' : avail < 20000 ? 'warn' : 'ok'}` }, money(avail, cur)),
              h('td', {},
                h('div', { class: 'progress', style: { height: '6px' } },
                  h('span', { style: { width: `${Math.min(100, Math.max(2, usedPct))}%` } })),
                h('span', { class: 'tiny muted' }, `${usedPct.toFixed(1)}%`)
              )
            );
          }))
        )
      )
    )
  );
}

function renderTransactions(host, d) {
  const list = d.transactions || [];

  host.replaceChildren(
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, `Ledger Operations Journal (${list.length} Entries)`),
        h('div', { class: 'sub' }, 'Atomic ledger transactions journal with idempotency keys and rule version citations')),
      badge('AUDIT PROVENANCE', 'ok')),
    h('div', { class: 'card-body' },
      list.length
        ? h('div', { class: 'table-wrap' },
            h('table', { class: 'data' },
              h('thead', {},
                h('tr', {},
                  h('th', {}, 'Timestamp'),
                  h('th', {}, 'Transaction Type'),
                  h('th', {}, 'Amount'),
                  h('th', {}, 'Submission ID'),
                  h('th', {}, 'Partner'),
                  h('th', {}, 'Idempotency Key'),
                  h('th', {}, 'Rules')
                )
              ),
              h('tbody', {}, list.slice(0, 30).map((tx) =>
                h('tr', {},
                  h('td', { class: 'tiny muted' }, dateTime(tx.created_at)),
                  h('td', {}, badge(String(tx.transaction_type || '').replace(/_/g, ' '), 'brand')),
                  h('td', { class: 'num' }, money(tx.amount, 'MYR')),
                  h('td', {}, tx.submission_id ? h('a', { class: 'link mono tiny', href: `#/listing/${encodeURIComponent(tx.submission_id)}` }, tx.submission_id) : '—'),
                  h('td', { class: 'mono tiny' }, tx.partner_id || '—'),
                  h('td', { class: 'mono tiny muted' }, tx.idempotency_key || '—'),
                  h('td', { class: 'mono tiny muted' }, tx.rule_version || '—')
                )
              ))
            )
          )
        : h('p', { class: 'tiny muted' }, 'No ledger operations recorded yet.')
    )
  );
}
