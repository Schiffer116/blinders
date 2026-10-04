// Shared site definitions and helpers, imported by the service worker and the UI pages.
//
// A stored site looks like:
//   { id, label, domains: [...], unblockedUntil }
// where unblockedUntil is 0 (blocked), a ms timestamp (unblocked until then), or 'forever'.

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

export const DURATIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: 'Forever', minutes: null },
];

export function isBlocked(site, now = Date.now()) {
  return site.unblockedUntil !== 'forever' && !(site.unblockedUntil > now);
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
