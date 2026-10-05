import { DURATIONS, findSiteForUrl, isBlocked } from './sites.js';
import { send, el } from './ui.js';
import { randomQuote } from './quotes.js';

const quote = randomQuote();
document.getElementById('quote-text').textContent = `“${quote.text}”`;
document.getElementById('quote-ref').textContent = `Marcus Aurelius, Meditations ${quote.ref}`;

// The blocking rule puts the original URL after the '#'.
const originalUrl = location.hash.slice(1);

const goBack = () => location.replace(originalUrl);

async function init() {
  const sites = await send('getSites');
  const site = findSiteForUrl(sites, originalUrl);
  if (!site) return;

  // Unblocked from the popup while this tab sat here: just go through.
  if (!isBlocked(site)) return goBack();

  document.title = `${site.label} is blocked · Blinders`;
  document.getElementById('title').textContent = `${site.label} is blocked.`;
  document.getElementById('lead').textContent = 'Stay focused. It will still be here later.';
  document.getElementById('picker-label').textContent = `Unblock ${site.label} for…`;

  const picker = document.getElementById('picker');
  const toggle = document.getElementById('unblock-toggle');
  toggle.onclick = () => { toggle.hidden = true; picker.hidden = false; };

  document.getElementById('durations').replaceChildren(...DURATIONS.map((d) => el('button', {
    textContent: d.label,
    onclick: async () => {
      try {
        await send('unblock', { id: site.id, minutes: d.minutes });
        goBack();
      } catch (err) {
        document.getElementById('error').textContent = err.message;
      }
    },
  })));

  document.getElementById('unblock').hidden = false;
}

if (originalUrl) init();
