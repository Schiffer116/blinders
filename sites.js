// Shared site definitions and helpers, imported by the service worker and the UI pages.
//
// A stored site looks like:
//   { id, label, domains: [...], unblockedUntil }
// where unblockedUntil is 0 (blocked), a ms timestamp (unblocked until then), or 'tab' (no time limit).
// Every unblock also stores `unblockTab`, the tab it was unblocked from; closing that tab re-blocks the site.

export const DEFAULT_SITES = [
  { id: 'facebook', label: 'Facebook', domains: ['facebook.com', 'fb.com', 'messenger.com'] },
  { id: 'youtube', label: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
  { id: 'twitter', label: 'Twitter / X', domains: ['twitter.com', 'x.com'] },
  { id: 'pinterest', label: 'Pinterest', domains: ['pinterest.com'] },
  { id: 'reddit', label: 'Reddit', domains: ['reddit.com'] },
];

// Offered as one-click additions in the popup; not blocked unless the user adds them.
export const SUGGESTED_SITES = [
  { id: 'instagram', label: 'Instagram', domains: ['instagram.com'] },
  { id: 'tiktok', label: 'TikTok', domains: ['tiktok.com'] },
  { id: 'twitch', label: 'Twitch', domains: ['twitch.tv'] },
];

// `default` is the duration selected when a picker opens.
export const DURATIONS = [
  { label: '1 min', minutes: 1, default: true },
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: 'No limit', minutes: null },
];

export function isBlocked(site, now = Date.now()) {
  return site.unblockedUntil !== 'tab' && !(site.unblockedUntil > now);
}

// requestDomains in the blocking rules also match subdomains, so mirror that here.
export function siteMatchesHost(site, hostname) {
  const host = hostname.toLowerCase();
  return site.domains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function findSiteForUrl(sites, url) {
  try {
    const { hostname } = new URL(url);
    return sites.find((s) => siteMatchesHost(s, hostname)) ?? null;
  } catch {
    return null;
  }
}

// Turns "https://www.example.com/foo" or "example.com" into a custom site entry.
export function siteFromInput(input) {
  const raw = input.trim();
  if (!raw) return null;
  let hostname;
  try {
    hostname = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  hostname = hostname.replace(/^www\./, '');
  if (!hostname.includes('.')) return null;
  return { id: hostname, label: hostname, domains: [hostname] };
}
