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

## Invariants

- `background.js` (service worker) is the only writer of state. The popup and blocked page send it messages; mutations run through `serial()`.
- `guard.js` (content script, can't import modules) repeats the site matching from `sites.js`. Keep the two in sync.
- Chrome's minimum alarm period is 30s and a service worker can't keep a 1-second timer alive, so the toolbar badge shows minutes, not seconds.
