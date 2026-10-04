import { DEFAULT_SITES, SUGGESTED_SITES, isBlocked, siteMatchesHost, siteFromInput, findSiteForUrl } from './sites.js';

const BLOCKED_PAGE = chrome.runtime.getURL('blocked.html');
const ALARM_PREFIX = 'reblock:';
const BADGE_TICK = 'badge-tick';

// Every mutation goes through here so concurrent messages/alarms can't clobber each other's writes.
let queue = Promise.resolve();
function serial(fn) {
  const result = queue.then(fn);
  queue = result.catch(() => {});
  return result;
}

async function loadSites() {
  const { sites } = await chrome.storage.local.get('sites');
  return sites ?? DEFAULT_SITES.map((s) => ({ ...s, unblockedUntil: 0 }));
}

async function saveSites(sites) {
  await chrome.storage.local.set({ sites });
  await syncRules(sites);
  await syncBadges(sites);
  return sites;
}

// Shows the minutes left on a timed unblock as a badge on the toolbar icon, per tab.
// The service worker can't keep a 1s timer alive, so a 30s alarm (Chrome's minimum) ticks it
// while any timed unblock is running; minutes are rounded up so it never reads 0m early.
async function syncBadges(sites) {
  sites ??= await loadSites();
  const now = Date.now();
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => {
    const site = tab.url && findSiteForUrl(sites, tab.url);
    const timed = site && typeof site.unblockedUntil === 'number' && site.unblockedUntil > now;
    const text = timed ? `${Math.ceil((site.unblockedUntil - now) / 60_000)}m` : '';
    return chrome.action.setBadgeText({ tabId: tab.id, text }).catch(() => {});
  }));
  const anyTimed = sites.some((s) => typeof s.unblockedUntil === 'number' && s.unblockedUntil > now);
  if (anyTimed) {
    if (!(await chrome.alarms.get(BADGE_TICK))) chrome.alarms.create(BADGE_TICK, { periodInMinutes: 0.5 });
  } else {
    await chrome.alarms.clear(BADGE_TICK);
  }
}

// Rebuilds the dynamic rule set: one redirect rule per currently blocked site.
// The original URL is carried in the fragment so the blocked page can send the user back after unblocking.
async function syncRules(sites) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = sites.filter((s) => isBlocked(s)).map((s, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: 'redirect', redirect: { regexSubstitution: `${BLOCKED_PAGE}#\\0` } },
    condition: { regexFilter: '^.+$', requestDomains: s.domains, resourceTypes: ['main_frame'] },
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules,
  });
}

// Rules only catch new navigations, so tabs already open on a site get sent to the blocked page directly.
async function coverOpenTabs(site) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url) continue;
    let hostname;
    try {
      ({ hostname } = new URL(tab.url));
    } catch {
      continue;
    }
    if (siteMatchesHost(site, hostname)) {
      chrome.tabs.update(tab.id, { url: `${BLOCKED_PAGE}#${tab.url}` });
    }
  }
}

function updateSite(id, change) {
  return serial(async () => {
    const sites = await loadSites();
    const site = sites.find((s) => s.id === id);
    if (!site) throw new Error(`Unknown site: ${id}`);
    change(site);
    return saveSites(sites);
  });
}

async function block(id) {
  await chrome.alarms.clear(ALARM_PREFIX + id);
  const sites = await updateSite(id, (s) => { s.unblockedUntil = 0; });
  await coverOpenTabs(sites.find((s) => s.id === id));
  return sites;
}

async function unblock(id, minutes) {
  await chrome.alarms.clear(ALARM_PREFIX + id);
  if (minutes == null) {
    return updateSite(id, (s) => { s.unblockedUntil = 'forever'; });
  }
  const until = Date.now() + minutes * 60_000;
  await chrome.alarms.create(ALARM_PREFIX + id, { when: until });
  return updateSite(id, (s) => { s.unblockedUntil = until; });
}

function add({ preset, input }) {
  return serial(async () => {
    const site = preset
      ? SUGGESTED_SITES.find((s) => s.id === preset)
      : siteFromInput(input ?? '');
    if (!site) throw new Error('Enter a valid domain, like example.com');
    const sites = await loadSites();
    if (sites.some((s) => s.id === site.id)) throw new Error(`${site.label} is already in the list`);
    sites.push({ ...site, unblockedUntil: 0 });
    await saveSites(sites);
    await coverOpenTabs(site);
    return sites;
  });
}

function remove(id) {
  return serial(async () => {
    await chrome.alarms.clear(ALARM_PREFIX + id);
    const sites = (await loadSites()).filter((s) => s.id !== id);
    return saveSites(sites);
  });
}

// Runs on install and browser start: expire any unblocks that lapsed while Chrome was closed,
// make sure alarms exist for the rest, and rebuild the rules from storage.
function reconcile() {
  return serial(async () => {
    const sites = await loadSites();
    const now = Date.now();
    for (const s of sites) {
      if (typeof s.unblockedUntil !== 'number' || s.unblockedUntil === 0) continue;
      if (s.unblockedUntil <= now) s.unblockedUntil = 0;
      else await chrome.alarms.create(ALARM_PREFIX + s.id, { when: s.unblockedUntil });
    }
    return saveSites(sites);
  });
}

chrome.runtime.onInstalled.addListener(reconcile);
chrome.runtime.onStartup.addListener(reconcile);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BADGE_TICK) syncBadges();
  else if (alarm.name.startsWith(ALARM_PREFIX)) block(alarm.name.slice(ALARM_PREFIX.length));
});

chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
chrome.tabs.onUpdated.addListener((_tabId, info) => { if (info.url || info.status === 'complete') syncBadges(); });
chrome.tabs.onActivated.addListener(() => syncBadges());

const handlers = {
  getSites: () => loadSites(),
  block: (msg) => block(msg.id),
  unblock: (msg) => unblock(msg.id, msg.minutes),
  add: (msg) => add(msg),
  remove: (msg) => remove(msg.id),
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return false;
  handler(msg).then(
    (sites) => sendResponse({ sites }),
    (err) => sendResponse({ error: err.message }),
  );
  return true;
});
