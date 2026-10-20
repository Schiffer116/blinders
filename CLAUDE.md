# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Blinders is a Manifest V3 Chrome extension that blocks distracting sites (Facebook, YouTube, Twitter/X, Pinterest, Reddit by default). Sites are blocked by default; the user can unblock one for 1 min (the default: type a reason, press Enter), 5 min, 15 min, or with no time limit. Every unblock is tied to the tab it was made from, so the site re-blocks when the time runs out or that tab closes, whichever comes first.

Plain JS ES modules, no build step, no dependencies, no tests.

## Running

- Load: `chrome://extensions` → Developer mode → "Load unpacked" → this directory.
- After editing, click the reload icon on the extension card. `background.js` changes need that reload; popup changes take effect the next time the popup opens.
- Syntax check without a browser: `for f in *.js; do node --input-type=module --check < $f; done`
- `sites.js` has no `chrome.*` calls, so its helpers can be imported and tested directly in Node.

## Architecture

- **State** lives in `chrome.storage.local` under `sites`: an array of `{ id, label, domains, unblockedUntil }`. `unblockedUntil` is `0` (blocked), a ms timestamp (unblocked until then), or `'tab'` (no time limit). Every unblocked site also has `unblockTab`, the tab it was unblocked from; closing that tab re-blocks it. Whether a site is blocked is always computed from this field with `isBlocked()` in `sites.js`, not stored separately.
- **`background.js` (service worker) is the only writer.** The popup and blocked page send messages (`getSites`, `block`, `unblock`, `changeLimit`, `add`, `remove`), and each reply is `{ sites }` or `{ error }`. `unblock` requires a non-empty `reason` (what the user needs the site for). It's checked but not stored. `changeLimit` resets a running unblock's limit, counted from now, and needs no reason. Both screens build their duration buttons and the reason box with `durationPicker()` in `ui.js`. Mutations run through `serial()` so they can't overwrite each other's read-modify-write.
- **Blocking** uses `declarativeNetRequest` dynamic rules. `syncRules()` rebuilds the whole rule set from storage after every save: one `main_frame` redirect rule per blocked site, using `requestDomains`, which also matches subdomains. The redirect puts the original URL in the fragment (`blocked.html#<url>`), so the blocked page can send the user back after unblocking.
- **Re-blocking** uses `chrome.alarms` named `reblock:<id>` for the time limit, and `tabs.onRemoved` for the tab closing; both apply to every unblock. The tab is `sender.tab` when unblocking from the blocked page, or the active tab when unblocking from the popup. `reconcile()` runs on install/update and on startup. It ends unblocks whose time ran out or whose tab is gone, and recreates alarms for the rest. Tab IDs don't survive a browser restart and get reused, so every tab-tied unblock ends at startup. It also turns any old `'forever'` values back into blocked.
- **Toolbar badge:** `syncBadges()` sets a per-tab badge with the minutes left on a timed unblock (for example "14m"). It runs after every save, on tab switches and navigations, and on a 30s `badge-tick` alarm while any timed unblock exists. 30 seconds is Chrome's minimum alarm period, and a service worker can't keep a 1-second timer alive, which is why the badge shows minutes rather than seconds.
- **`guard.js`** is a `document_start` content script on all pages. It's a fallback for loads the rules never see, such as pages served from a site's own service-worker cache (x.com does this). Content scripts can't import modules, so it repeats the matching logic from `sites.js`. Keep the two in sync.
- Rules only catch new navigations, so `coverOpenTabs()` redirects tabs already open on a site when it gets blocked or added.
- `DEFAULT_SITES` / `SUGGESTED_SITES` / `DURATIONS` in `sites.js` drive the UI. Suggested sites appear as one-click "+" chips in the popup. To change the duration options, edit `DURATIONS`.
- `quotes.js` holds the Marcus Aurelius quotes (George Long translation, cited by book.section) that `blocked.js` shows at random.
- `ui.js` holds the helpers shared by `popup.js` and `blocked.js` (`send`, `formatRemaining`, `el`, `durationPicker`).
