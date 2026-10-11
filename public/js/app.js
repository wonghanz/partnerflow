/* Application shell: hash router, sidebar nav, Ask-the-Brain drawer. */

import { api, ApiError } from './api.js';
import { h, icon, toast, closeModal, badge } from './dom.js';
import { ctx, boot, startUptimeTicker, renderSession, requireApprover } from './state.js';
import { openBrainDrawer } from './views/ask.js';

const NAV = [
  { path: '/listing', label: 'Listing History', icon: 'list' },
  { path: '/submit', label: 'New Submission', icon: 'plus' },
  { path: '/setup', label: 'Programme Setup', icon: 'sliders' },
  { path: '/budget', label: 'Budget Ledger', icon: 'money' },
  { path: '/audit', label: 'Audit Log', icon: 'clock' },
  {
    path: '/brain', label: 'Brain Intelligence', icon: 'brain',
    children: [
      { path: '/brain/overview', label: 'Overview', icon: 'grid' },
      { path: '/brain/requirements', label: 'Company Requirements', icon: 'scale' },
      { path: '/brain/tiers', label: 'Partner Tiers', icon: 'layers' },
      { path: '/brain/knowledge', label: 'Knowledge Base', icon: 'book' },
      { path: '/brain/mindset', label: 'Company Mindset', icon: 'spark' },
      { path: '/brain/versions', label: 'Versions & Audit', icon: 'clock' }
    ]
  }
];

const VIEWS = {
  '/overview': () => import('./views/listing.js'),
  '/listing': () => import('./views/listing.js'),
  '/listing/': () => import('./views/detail.js'),
  '/submit': () => import('./views/submit.js'),
  '/setup': () => import('./views/setup.js'),
  '/budget': () => import('./views/budget.js'),
  '/audit': () => import('./views/audit.js'),
  '/brain': () => import('./views/brain.js')
};

let renderToken = 0;

function matchRoute(hash) {
  const path = hash.replace(/^#/, '') || '/listing';
  if (path === '/' || path === '' || path === '/overview' || path.startsWith('/overview') || path.startsWith('/reports')) return { key: '/listing', params: {} };
  const detail = path.match(/^\/listing\/([^/]+)$/);
  if (detail) return { key: '/listing/', params: { id: decodeURIComponent(detail[1]) } };
  const brainSub = path.match(/^\/brain(?:\/([a-z]+))?$/);
  if (brainSub) return { key: '/brain', params: { section: brainSub[1] || 'overview' } };
  if (path.startsWith('/submit')) return { key: '/submit', params: {} };
  if (path.startsWith('/setup')) return { key: '/setup', params: {} };
  if (path.startsWith('/budget')) return { key: '/budget', params: {} };
  if (path.startsWith('/audit')) return { key: '/audit', params: {} };
  if (path.startsWith('/listing')) return { key: '/listing', params: {} };
  return { key: '/listing', params: {} };
}

export function renderNav() {
  const host = document.getElementById('navList');
  if (!host) return;
  const { key, params } = matchRoute(location.hash);
  host.replaceChildren();

  for (const item of NAV) {
    const activeRoot = key === item.path || key.startsWith(item.path + '/');
    const li = h('li', {});
    const a = h('a', {
      class: `nav-item${activeRoot && !item.children ? ' active' : ''}${activeRoot && item.children ? ' active' : ''}`,
      href: `#${item.children ? item.children[0].path : item.path}`,
      'aria-current': activeRoot ? 'page' : undefined
    }, h('span', { class: 'ni' }, icon(item.icon, 17)),
    h('span', { class: 'nt' }, h('b', {}, item.label)),
    item.children ? h('span', { class: 'chev' }, icon('chevron', 14)) : null);
    li.appendChild(a);

    if (item.children) {
      const sub = h('ul', { class: `nav-sub${activeRoot ? ' open' : ''}` });
      for (const c of item.children) {
        sub.appendChild(h('li', {}, h('a', {
          class: `nav-sub-item${params.section === c.path.split('/').pop() ? ' active' : ''}`,
          href: `#${c.path}`, 'aria-current': params.section === c.path.split('/').pop() ? 'page' : undefined
        }, h('span', { class: 'ni' }, icon(c.icon, 15)), h('span', { class: 'nt' }, h('b', {}, c.label)))));
      }
      li.appendChild(sub);
    }
    host.appendChild(li);
  }
}

async function route() {
  const token = ++renderToken;
  const view = document.getElementById('view');
  const { key, params } = matchRoute(location.hash);
  renderNav();
  document.getElementById('main')?.scrollTo({ top: 0 });

  const loader = VIEWS[key];
  if (!loader) return;
  view.replaceChildren(h('div', { class: 'stack' },
    h('div', { class: 'skeleton', style: { height: '76px' } }),
    h('div', { class: 'skeleton', style: { height: '180px' } }),
    h('div', { class: 'skeleton', style: { height: '260px' } })));

  try {
    const mod = await loader();
    if (token !== renderToken) return;
    const node = await mod.render(params, { ctx, navigate: ctx.navigate, requireApprover });
    if (token !== renderToken) return;
    view.replaceChildren(node);
    if (mod.afterRender) await mod.afterRender(node, params);
  } catch (err) {
    if (token !== renderToken) return;
    const code = err instanceof ApiError ? err.code : 'VIEW_ERROR';
    const msg = err instanceof ApiError ? err.message : String(err?.message || err);
    view.replaceChildren(h('div', { class: 'empty' },
      h('div', { class: 'ei' }, icon('alert', 26)),
      h('h3', {}, 'Could not load this view'),
      h('p', { class: 'mono tiny' }, `${code}: ${msg}`),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => route() }, icon('refresh', 15), 'Retry'),
        h('a', { class: 'btn btn-primary', href: '#/listing' }, 'Back to Listing History'))));
    console.error('[view]', key, err);
  }
}

function wireShell() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const stored = localStorage.getItem('partnerflow.sidebar');
  // The off-canvas drawer only exists below 980px, so start collapsed there unless asked otherwise.
  const narrow = window.matchMedia('(max-width: 980px)').matches;
  const collapsed = stored ? stored === 'collapsed' : narrow;
  const apply = (c) => {
    document.body.classList.toggle('sidebar-collapsed', c);
    toggle?.setAttribute('aria-expanded', String(!c));
    localStorage.setItem('partnerflow.sidebar', c ? 'collapsed' : 'open');
  };
  apply(collapsed);
  toggle?.addEventListener('click', () => apply(!document.body.classList.contains('sidebar-collapsed')));

  document.getElementById('askBrainBtn')?.addEventListener('click', () => openBrainDrawer());
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openBrainDrawer(); }
  });

  window.addEventListener('hashchange', route);
}

async function main() {
  wireShell();
  renderSession();
  const view = document.getElementById('view');
  view.replaceChildren(h('div', { class: 'boot' },
    h('div', { class: 'boot-mark' }, 'U'),
    h('div', { class: 'boot-text' }, h('b', {}, 'Connecting to PartnerFlow runtime…'), h('i', {}, 'Deterministic pipeline engine')),
    h('div', { class: 'spin' })));

  try {
    await boot();
  } catch (err) {
    ctx.bootError = err;
    view.replaceChildren(h('div', { class: 'empty' },
      h('div', { class: 'ei' }, icon('alert', 26)),
      h('h3', {}, 'Backend unreachable'),
      h('p', { class: 'mono tiny' }, String(err instanceof ApiError ? `${err.code}: ${err.message}` : err?.message || err)),
      h('p', { class: 'tiny muted' }, 'Make sure the localhost server is active: '),
      h('p', { class: 'mono tiny' }, 'node server/index.js')));
    return;
  }

  startUptimeTicker();
  renderSession();
  if (!location.hash) location.hash = '#/listing';
  if (!ctx.health?.ready && ctx.health?.missing?.length) {
    toast(`Company Brain corpus initialising — missing ${ctx.health.missing.join(', ')}`, 'err', null, 9000);
  }
  await route();
}

main();
