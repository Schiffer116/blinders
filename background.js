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
  const sites = await updateSite(id, (s) => { s.unblockedUntil = 0; delete s.unblockTab; });
  await coverOpenTabs(sites.find((s) => s.id === id));
  return sites;
}

// Every unblock is tied to tab `tabId` and ends when that tab closes. A timed unblock also ends
// when its alarm fires; minutes == null ("Until I close this tab") has no time limit.
async function unblock(id, minutes, tabId) {
  if (tabId == null) throw new Error('No tab to tie this unblock to');
  await chrome.alarms.clear(ALARM_PREFIX + id);
  if (minutes == null) {
    return updateSite(id, (s) => { s.unblockedUntil = 'tab'; s.unblockTab = tabId; });
  }
  const until = Date.now() + minutes * 60_000;
  await chrome.alarms.create(ALARM_PREFIX + id, { when: until });
  return updateSite(id, (s) => { s.unblockedUntil = until; s.unblockTab = tabId; });
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

// Runs on install/update and browser start: re-block anything whose unblock ended while the
// extension wasn't running, make sure alarms exist for the rest, and rebuild the rules from storage.
// Tab IDs don't survive a browser restart (and get reused), so every tab-tied unblock ends at startup.
function reconcile({ startup }) {
  return serial(async () => {
    const sites = await loadSites();
    const now = Date.now();
    const ended = [];
    for (const s of sites) {
      if (s.unblockedUntil === 0) continue;
      const timeLeft = s.unblockedUntil === 'tab' || (typeof s.unblockedUntil === 'number' && s.unblockedUntil > now);
      // Unblocks saved before every unblock was tied to a tab have no unblockTab; only their timer applies.
      const tabOpen = s.unblockTab == null
        ? s.unblockedUntil !== 'tab'
        : !startup && (await chrome.tabs.get(s.unblockTab).then(() => true, () => false));
      if (timeLeft && tabOpen) {
        if (s.unblockedUntil !== 'tab') await chrome.alarms.create(ALARM_PREFIX + s.id, { when: s.unblockedUntil });
        continue;
      }
      // Lapsed timer, closed tab, or the old 'forever' value from before that option was removed.
      s.unblockedUntil = 0;
      delete s.unblockTab;
      ended.push(s);
    }
    await saveSites(sites);
    for (const s of ended) await coverOpenTabs(s);
    return sites;
  });
}

chrome.runtime.onInstalled.addListener(() => reconcile({ startup: false }));
chrome.runtime.onStartup.addListener(() => reconcile({ startup: true }));

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const sites = await loadSites();
  for (const s of sites) {
    if (!isBlocked(s) && s.unblockTab === tabId) await block(s.id);
  }
});

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
  // The blocked page is itself the tab being unblocked; the popup passes the active tab's id.
  unblock: (msg, sender) => unblock(msg.id, msg.minutes, msg.tabId ?? sender.tab?.id),
  add: (msg) => add(msg),
  remove: (msg) => remove(msg.id),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return false;
  handler(msg, sender).then(
    (sites) => sendResponse({ sites }),
    (err) => sendResponse({ error: err.message }),
  );
  return true;
});
