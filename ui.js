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

let pickerCount = 0; // gives each picker's radio group its own name

// A duration selection plus an `action` button (for example "Unblock") that calls onPick with the
// selected duration. The duration marked `default` starts selected; `extra` buttons go before the
// action. With `reason`, the action stays disabled until the "what do you need it for?" box has
// text, onPick also receives that text, and Enter in the box acts (Shift+Enter still adds a line).
// `reason.draft` and `reason.onInput` let a caller keep the typed text across re-renders.
export function durationPicker(durations, { action, reason, onPick, extra = [] }) {
  const name = `duration-${++pickerCount}`;
  let selected = durations.find((d) => d.default) ?? durations[0];
  const options = el('div', { className: 'segmented', role: 'radiogroup', ariaLabel: 'Duration' },
    ...durations.map((d) => el('label', {},
      el('input', { type: 'radio', name, checked: d === selected, onchange: () => { selected = d; } }),
      el('span', { textContent: d.label }))));

  let box = null;
  const go = el('button', { className: 'primary', textContent: action, onclick: () => onPick(selected, box?.value.trim()) });
  if (reason) {
    box = el('textarea', {
      className: 'reason',
      rows: 2,
      placeholder: 'What do you actually need it for?',
      ariaLabel: 'What do you need this site for?',
      value: reason.draft ?? '',
    });
    const sync = () => {
      go.disabled = !box.value.trim();
      reason.onInput?.(box.value);
    };
    box.addEventListener('input', sync);
    box.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      if (!go.disabled) go.click();
    });
    sync();
  }
  return el('div', { className: 'picker-body' }, options, box, el('div', { className: 'picker-actions' }, ...extra, go));
}
