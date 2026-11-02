# THREAD — Visual Evidence Mapping

THREAD is a Chrome extension for capturing useful passages from webpages and preserving their source information for research.

## Day 1 scope

This starter establishes the Manifest V3 foundation and one end-to-end workflow:

1. Select text on a webpage.
2. Right-click and choose **Save selection to THREAD**.
3. Open the extension popup to review saved findings.
4. Open the original source or delete a finding.

This is the first milestone, not the complete product. Projects, evidence relationships, graph visualization, review tools and dossier export are planned for later milestones.

## Tech stack

- Chrome Extensions Manifest V3
- HTML and CSS
- Vanilla JavaScript
- `chrome.contextMenus` for selection capture
- `chrome.storage.local` for local persistence

## Install locally

1. Download and extract this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the folder containing `manifest.json`.

## Project structure

```text
THREAD/
├── manifest.json
├── background.js
├── popup.html
├── popup.css
├── popup.js
├── docs/
│   └── ARCHITECTURE.md
└── .gitignore
```

## Current limitations

- Findings are stored in one local list; research projects are not implemented yet.
- There is no graph or relationship editor in this milestone.
- Data remains in the current Chrome profile; backup and restore are not implemented yet.

## Team

- Mateshwar Balamurugan
- Sharath
