// Helpers shared by the popup and the blocked page.

export async function send(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (res?.error) throw new Error(res.error);
  return res.sites;
}

export function formatRemaining(until, now = Date.now()) {
  const totalSec = Math.max(0, Math.ceil((until - now) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// `dataset` is a read-only property, so it's merged in rather than assigned.
export function el(tag, { dataset, ...props } = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  if (dataset) Object.assign(node.dataset, dataset);
  node.append(...children.filter((c) => c != null));
  return node;
}

// Duration buttons for unblocking or changing a limit. With `reason`, the buttons stay disabled until
// the "what do you need it for?" box has text, and onPick receives that text. `reason.draft` and
// `reason.onInput` let a caller keep the typed text across re-renders.
export function durationPicker(durations, { reason, onPick, extra = [] }) {
  let box = null;
  const buttons = durations.map((d) => el('button', {
    textContent: d.label,
    onclick: () => onPick(d, box?.value.trim()),
  }));
  const row = el('div', { className: 'durations' }, ...buttons, ...extra);
  if (!reason) return row;

  box = el('textarea', {
    className: 'reason',
    rows: 2,
    placeholder: 'What do you actually need it for?',
    ariaLabel: 'What do you need this site for?',
    value: reason.draft ?? '',
  });
  const sync = () => {
    const empty = !box.value.trim();
    for (const b of buttons) b.disabled = empty;
    reason.onInput?.(box.value);
  };
  box.addEventListener('input', sync);
  sync();
  return el('div', { className: 'picker-body' }, box, row);
}
