# THREAD — Visual Evidence Mapping

THREAD is a Chrome extension that helps researchers capture, organize, and connect evidence from webpages in a visual knowledge graph.

## Features

- **Evidence capture:** Select text on a webpage and save it through the right-click context menu.
- **Source attribution:** Preserve the webpage title, URL, and capture timestamp.
- **Research projects:** Create and switch between separate research projects.
- **Evidence relationships:** Connect findings using Supports, Contradicts, or Related.
- **Visual knowledge graph:** Explore findings and their relationships through an interactive graph.
- **Graph search:** Find evidence and highlight matching nodes.
- **Graph navigation:** Zoom, pan, and reset the graph view.
- **Finding details:** Select a graph node to inspect its evidence and source information.

## Tech Stack

- Chrome Extensions Manifest V3
- HTML5
- CSS3
- Vanilla JavaScript (ES Modules)
- SVG for graph visualization
- Chrome Storage API (`chrome.storage.local`)
- Chrome Context Menus API

## Installation

1. Clone or download this repository.
2. Open Google Chrome.
3. Navigate to `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the project folder containing `manifest.json`.
7. THREAD should now appear in your Chrome extensions.

## How to Use

1. Open a webpage containing useful research information.
2. Select the text you want to save.
3. Right-click and choose **Save selection to THREAD**.
4. Open THREAD to view your saved findings.
5. Create or select a research project.
6. Connect findings using relationship types.
7. Open the Knowledge Graph to explore the connections.
8. Use search, zoom, and pan to navigate the graph.

## Project Structure

```text
thread-research-extension/
├── manifest.json
├── background.js
├── storage.js
├── popup.html
├── popup.css
├── popup.js
├── graph.html
├── graph.css
├── graph.js
├── docs/
│   └── ARCHITECTURE.md
├── CONTRIBUTING.md
└── README.md
```

## Storage and Privacy

- Research data is stored locally using `chrome.storage.local`.
- This milestone does not include a remote backend or cloud synchronization.
- Data is associated with the current Chrome profile.

## Current Limitations

- No cloud synchronization across devices.
- No built-in backup and restore workflow.
- Research data is stored locally in the browser.

## Team

- Mateshwar Balamurugan
- Sharath
