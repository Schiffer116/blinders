import { DURATIONS, SUGGESTED_SITES, isBlocked } from './sites.js';
import { send, formatRemaining, el, durationPicker } from './ui.js';

const list = document.getElementById('sites');
const summary = document.getElementById('summary');
const errorBox = document.getElementById('error');
const suggestions = document.getElementById('suggestions');
const form = document.getElementById('add-form');
const input = document.getElementById('add-input');

let sites = [];
// The open duration picker, if any. `mode` is also the message type it sends: 'unblock' | 'changeLimit'.
let picking = null;
let reasonDraft = ''; // survives re-renders while the unblock picker is open

async function run(type, payload) {
  errorBox.textContent = '';
  try {
    sites = await send(type, payload);
    render();
    return true;
  } catch (err) {
    errorBox.textContent = err.message;
    return false;
  }
}

function statusText(site) {
  if (isBlocked(site)) return 'Blocked';
  if (site.unblockedUntil === 'tab') return 'Unblocked until you close its tab';
  const at = new Date(site.unblockedUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `Unblocked · re-blocks at ${at} or when its tab closes (${formatRemaining(site.unblockedUntil)} left)`;
}

function renderSite(site) {
  const blocked = isBlocked(site);
  const open = (mode) => () => { picking = { id: site.id, mode }; reasonDraft = ''; render(); };
  const actions = blocked
    ? [el('button', { textContent: 'Unblock', onclick: open('unblock') })]
    : [el('div', { className: 'stacked' },
        el('button', { textContent: 'Change', title: 'Change the time limit', onclick: open('changeLimit') }),
        el('button', { className: 'primary', textContent: 'Block now', onclick: () => run('block', { id: site.id }) }))];

  const row = el('div', { className: 'row' },
    el('span', { className: blocked ? 'dot' : 'dot open' }),
    el('div', { className: 'name' },
      el('strong', { textContent: site.label }),
      el('span', { className: 'status', dataset: { id: site.id }, textContent: statusText(site) })),
    ...actions,
    el('button', {
      className: 'ghost remove', textContent: '×', title: `Remove ${site.label}`,
      onclick: () => run('remove', { id: site.id }),
    }));

  const item = el('li', {}, row);
  const mode = picking?.id === site.id ? picking.mode : null;
  // A picker only makes sense for the state it was opened in; drop it if the site flipped meanwhile.
  if (mode === (blocked ? 'unblock' : 'changeLimit')) {
    const cancel = el('button', { className: 'ghost', textContent: 'Cancel', onclick: () => { picking = null; render(); } });
    const onPick = async (d, reason) => {
      picking = null;
      // "This tab" from the popup means the tab the popup was opened over.
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      run(mode, { id: site.id, minutes: d.minutes, tabId: tab?.id, reason });
    };
    item.append(el('div', { className: 'picker' },
      el('p', { textContent: blocked ? `Unblock ${site.label} for…` : 'New limit, counted from now:' }),
      durationPicker(DURATIONS, {
        action: blocked ? 'Unblock' : 'Set limit',
        reason: blocked ? { draft: reasonDraft, onInput: (v) => { reasonDraft = v; } } : null,
        onPick,
        extra: [cancel],
      })));
  }
  return item;
}

function render() {
  list.replaceChildren(...sites.map(renderSite));
  list.querySelector('textarea.reason')?.focus();
  const blockedCount = sites.filter((s) => isBlocked(s)).length;
  summary.textContent = `${blockedCount} of ${sites.length} blocked`;

  const missing = SUGGESTED_SITES.filter((s) => !sites.some((x) => x.id === s.id));
  suggestions.replaceChildren(...(missing.length ? [
    el('span', { textContent: 'Suggested:' }),
    ...missing.map((s) => el('button', { textContent: `+ ${s.label}`, onclick: () => run('add', { preset: s.id }) })),
  ] : []));
}

// Tick the countdowns in place; refetch once a timed unblock has expired so the row flips back to Blocked.
setInterval(() => {
  const now = Date.now();
  let expired = false;
  for (const site of sites) {
    if (typeof site.unblockedUntil !== 'number' || site.unblockedUntil === 0) continue;
    if (site.unblockedUntil <= now) expired = true;
    const node = list.querySelector(`.status[data-id="${CSS.escape(site.id)}"]`);
    if (node) node.textContent = statusText(site);
  }
  if (expired) run('getSites');
}, 1000);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (await run('add', { input: input.value })) input.value = '';
});

run('getSites');
