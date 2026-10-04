// Fallback for navigations the declarativeNetRequest rules never see: pages served straight from a
// site's own service worker cache (x.com does this) don't hit the network, so no rule fires.
// Content scripts can't be ES modules, so the matching from sites.js is repeated here.
(async () => {
  const { sites } = await chrome.storage.local.get('sites');
  if (!sites) return;
  const host = location.hostname.toLowerCase();
  const site = sites.find((s) => s.domains.some((d) => host === d || host.endsWith(`.${d}`)));
  if (!site) return;
  const unblocked = site.unblockedUntil === 'forever' || site.unblockedUntil > Date.now();
  if (!unblocked) location.replace(`${chrome.runtime.getURL('blocked.html')}#${location.href}`);
})();
