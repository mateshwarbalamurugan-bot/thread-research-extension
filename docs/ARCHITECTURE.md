# THREAD architecture — Day 1

## Runtime flow

1. `manifest.json` declares the extension as Manifest V3 and registers `background.js` as its service worker.
2. `background.js` creates a context-menu item when the extension is installed.
3. When the user selects text and chooses the menu item, the service worker receives the selected text and active tab metadata.
4. The service worker stores a finding in `chrome.storage.local`.
5. `popup.js` reads stored findings and renders them using DOM APIs and `textContent`.

## Why these APIs?

- `chrome.contextMenus` provides the right-click capture workflow.
- `chrome.storage.local` persists findings locally in the browser.
- `chrome.tabs.create` opens a finding's original source when requested.

## Security notes

- Captured webpage text is untrusted input.
- The popup inserts captured text with `textContent`, not `innerHTML`.
- The extension does not request broad host permissions or send captured data to a server.
