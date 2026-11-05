
import { ensureWorkspace } from "./storage.js";

const svg = document.querySelector("#graph");
const empty = document.querySelector("#empty");
const details = document.querySelector("#details");
const projectName = document.querySelector("#projectName");
const searchInput = document.querySelector("#graphSearch");

const SVG_NS = "http://www.w3.org/2000/svg";

const NODE_WIDTH = 250;
const NODE_HEIGHT = 112;
const HORIZONTAL_GAP = 190;
const VERTICAL_GAP = 175;

const relationshipColors = {
  supports: "#42d6a4",
  contradicts: "#ff718b",
  related: "#65b7ff"
};

const nodeColors = [
  "#42d6a4",
  "#65b7ff",
  "#b28aff",
  "#ffbd69",
  "#ff718b"
];

let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let graphViewport = null;

function getFindingTitle(finding) {
  return finding.sourceTitle || finding.title || "Untitled page";
}

function getFindingText(finding) {
  return finding.text || finding.quote || finding.content || "";
}

function getFindingUrl(finding) {
  return finding.sourceUrl || finding.url || "";
}

function getFindingDate(finding) {
  return finding.capturedAt || finding.createdAt || "";
}

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
}

function wrapText(value, maxLength = 29, maxLines = 3) {
  const words = String(value || "Untitled page").split(/\s+/);
  const lines = [];
  let line = "";
  let truncated = false;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;

    if (candidate.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }

    if (lines.length === maxLines) {
      truncated = true;
      break;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  if (truncated && lines.length) {
    const last = lines.length - 1;
    lines[last] = lines[last].replace(/[.,;:]?$/, "") + "...";
  }

  return lines;
}

function addTextLine(group, text, x, y, className) {
  const element = svgElement("text", {
    x,
    y,
    class: className
  });

  element.textContent = text;
  group.appendChild(element);

  return element;
}

function showDetails(finding) {
  if (!details) return;

  details.replaceChildren();

  const label = document.createElement("p");
  label.className = "eyebrow";
  label.textContent = "SELECTED EVIDENCE";

  const heading = document.createElement("h2");
  heading.textContent = getFindingTitle(finding);

  const quote = document.createElement("p");
  quote.className = "detail-quote";
  quote.textContent =
    getFindingText(finding) || "No evidence text available.";

  details.append(label, heading, quote);

  const sourceUrl = getFindingUrl(finding);

  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);

      if (url.protocol === "http:" || url.protocol === "https:") {
        const link = document.createElement("a");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open original source";
        details.appendChild(link);
      }
    } catch {
      console.warn("Invalid source URL:", sourceUrl);
    }
  }

  const capturedAt = getFindingDate(finding);

  if (capturedAt) {
    const date = document.createElement("p");
    date.className = "detail-meta";
    date.textContent =
      `Captured: ${new Date(capturedAt).toLocaleString()}`;
    details.appendChild(date);
  }
}

function calculateSmartLayout(findings, relationships) {
  const adjacency = new Map(
    findings.map(finding => [finding.id, new Set()])
  );

  relationships.forEach(link => {
    if (
      adjacency.has(link.sourceId) &&
      adjacency.has(link.targetId)
    ) {
      adjacency.get(link.sourceId).add(link.targetId);
      adjacency.get(link.targetId).add(link.sourceId);
    }
  });

  const visited = new Set();
  const components = [];

  for (const finding of findings) {
    if (visited.has(finding.id)) continue;

    const queue = [finding.id];
    const component = [];

    visited.add(finding.id);

    while (queue.length) {
      const current = queue.shift();
      component.push(current);

      for (const neighbour of adjacency.get(current) || []) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          queue.push(neighbour);
        }
      }
    }

    components.push(component);
  }

  components.sort((a, b) => b.length - a.length);

  const positions = new Map();
  const maxBlockWidth = 1900;
  const componentGap = 170;

  let cursorX = 100;
  let cursorY = 100;
  let rowHeight = 0;

  components.forEach(component => {
    const columns = Math.min(3, component.length);
    const rows = Math.ceil(component.length / columns);

    const blockWidth =
      columns * (NODE_WIDTH + HORIZONTAL_GAP) - HORIZONTAL_GAP;

    const blockHeight =
      rows * (NODE_HEIGHT + VERTICAL_GAP) - VERTICAL_GAP;

    if (
      cursorX > 100 &&
      cursorX + blockWidth > maxBlockWidth
    ) {
      cursorX = 100;
      cursorY += rowHeight + componentGap;
      rowHeight = 0;
    }

    component.forEach((id, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);

      positions.set(id, {
        x: cursorX + column * (NODE_WIDTH + HORIZONTAL_GAP),
        y: cursorY + row * (NODE_HEIGHT + VERTICAL_GAP)
      });
    });

    cursorX += blockWidth + componentGap;
    rowHeight = Math.max(rowHeight, blockHeight);
  });

  let width = 1200;
  let height = 700;

  positions.forEach(position => {
    width = Math.max(width, position.x + NODE_WIDTH + 100);
    height = Math.max(height, position.y + NODE_HEIGHT + 100);
  });

  return { positions, width, height };
}

function getEdgePoints(source, target) {
  const sourceCenterX = source.x + NODE_WIDTH / 2;
  const sourceCenterY = source.y + NODE_HEIGHT / 2;
  const targetCenterX = target.x + NODE_WIDTH / 2;
  const targetCenterY = target.y + NODE_HEIGHT / 2;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  if (dx === 0 && dy === 0) return null;

  const scale = Math.min(
    (NODE_WIDTH / 2) / Math.max(Math.abs(dx), 0.001),
    (NODE_HEIGHT / 2) / Math.max(Math.abs(dy), 0.001)
  );

  return {
    x1: sourceCenterX + dx * scale,
    y1: sourceCenterY + dy * scale,
    x2: targetCenterX - dx * scale,
    y2: targetCenterY - dy * scale
  };
}

function findLabelPosition(
  x1,
  y1,
  x2,
  y2,
  offset,
  labelWidth,
  placedLabels
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(Math.hypot(dx, dy), 1);

  const normalX = -dy / length;
  const normalY = dx / length;

  const candidates = [
    65, -65, 95, -95, 130, -130, 165, -165
  ];

  for (const distance of candidates) {
    const x =
      (x1 + x2) / 2 + normalX * (distance + offset);

    const y =
      (y1 + y2) / 2 + normalY * (distance + offset);

    const overlaps = placedLabels.some(label => {
      return (
        Math.abs(label.x - x) < (labelWidth + 35) / 2 &&
        Math.abs(label.y - y) < 34
      );
    });

    if (!overlaps) {
      placedLabels.push({ x, y });
      return { x, y };
    }
  }

  const fallback = {
    x: (x1 + x2) / 2 + normalX * 190,
    y: (y1 + y2) / 2 + normalY * 190
  };

  placedLabels.push(fallback);
  return fallback;
}

function applyGraphSearch(query) {
  if (!graphViewport) return;

  const term = query.trim().toLowerCase();

  const nodes = graphViewport.querySelectorAll(".node");
  const edges = graphViewport.querySelectorAll(".edge");
  const labels = graphViewport.querySelectorAll(".edge-label");

  const matchingIds = new Set();

  nodes.forEach(node => {
    const matches =
      term &&
      node.dataset.searchText.includes(term);

    if (matches) {
      matchingIds.add(node.dataset.findingId);
    }

    node.classList.toggle("search-match", Boolean(matches));
    node.classList.toggle("search-dim", Boolean(term && !matches));
  });

  [...edges, ...labels].forEach(element => {
    const connected =
      matchingIds.has(element.dataset.sourceId) ||
      matchingIds.has(element.dataset.targetId);

    element.classList.toggle(
      "search-dim",
      Boolean(term && !connected)
    );

    element.classList.toggle(
      "search-match",
      Boolean(term && connected)
    );
  });
}

function updateGraphTransform() {
  if (!graphViewport) return;

  graphViewport.setAttribute(
    "transform",
    `translate(${panX} ${panY}) scale(${zoomLevel})`
  );
}

function resetGraphView() {
  zoomLevel = 1;
  panX = 0;
  panY = 0;
  updateGraphTransform();
}

function zoomGraph(factor) {
  if (!graphViewport) return;

  const previousZoom = zoomLevel;

  zoomLevel = Math.min(
    2.5,
    Math.max(0.4, zoomLevel * factor)
  );

  const bounds = svg.getBoundingClientRect();

  const scaleX = Number(svg.viewBox.baseVal.width) / bounds.width;
  const scaleY = Number(svg.viewBox.baseVal.height) / bounds.height;

  const pointX = bounds.width / 2 * scaleX;
  const pointY = bounds.height / 2 * scaleY;

  panX = pointX - (pointX - panX) * (zoomLevel / previousZoom);
  panY = pointY - (pointY - panY) * (zoomLevel / previousZoom);

  updateGraphTransform();
}

function setupGraphNavigation() {
  document.querySelector("#zoomIn")?.addEventListener("click", () => {
    zoomGraph(1.2);
  });

  document.querySelector("#zoomOut")?.addEventListener("click", () => {
    zoomGraph(1 / 1.2);
  });

  document.querySelector("#resetView")?.addEventListener(
    "click",
    resetGraphView
  );

  svg.addEventListener("pointerdown", event => {
    if (event.target.closest?.(".node")) return;

    isDragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    svg.classList.add("dragging");
    svg.setPointerCapture(event.pointerId);
  });

  svg.addEventListener("pointermove", event => {
    if (!isDragging) return;

    const bounds = svg.getBoundingClientRect();

    const scaleX = Number(svg.viewBox.baseVal.width) / bounds.width;
    const scaleY = Number(svg.viewBox.baseVal.height) / bounds.height;

    panX +=
      ((event.clientX - lastPointerX) * scaleX) / zoomLevel;

    panY +=
      ((event.clientY - lastPointerY) * scaleY) / zoomLevel;

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    updateGraphTransform();
  });

  function stopDragging() {
    isDragging = false;
    svg.classList.remove("dragging");
  }

  svg.addEventListener("pointerup", stopDragging);
  svg.addEventListener("pointercancel", stopDragging);
  svg.addEventListener("lostpointercapture", stopDragging);
}

function renderGraph(findings, relationships) {
  svg.replaceChildren();

  if (!findings.length) {
    empty.hidden = false;
    svg.hidden = true;
    graphViewport = null;
    return;
  }

  empty.hidden = true;
  svg.hidden = false;

  const layout = calculateSmartLayout(findings, relationships);

  svg.setAttribute(
    "viewBox",
    `0 0 ${layout.width} ${layout.height}`
  );

  svg.setAttribute("width", layout.width);
  svg.setAttribute("height", layout.height);

  graphViewport = svgElement("g", {
    id: "graphViewport"
  });

  svg.appendChild(graphViewport);

  const placedLabels = [];
  const pairCounts = new Map();

  relationships.forEach(link => {
    const key = [link.sourceId, link.targetId].sort().join("|");

    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  });

  const pairIndexes = new Map();

  relationships.forEach(link => {
    const source = layout.positions.get(link.sourceId);
    const target = layout.positions.get(link.targetId);

    if (!source || !target) return;

    const points = getEdgePoints(source, target);
    if (!points) return;

    const key = [link.sourceId, link.targetId].sort().join("|");

    const index = pairIndexes.get(key) || 0;
    pairIndexes.set(key, index + 1);

    const total = pairCounts.get(key) || 1;
    const offset = (index - (total - 1) / 2) * 55;

    const centerX = (points.x1 + points.x2) / 2;
    const centerY = (points.y1 + points.y2) / 2;

    const dx = points.x2 - points.x1;
    const dy = points.y2 - points.y1;
    const length = Math.max(Math.hypot(dx, dy), 1);

    const curveX = centerX - (dy / length) * offset;
    const curveY = centerY + (dx / length) * offset;

    const path = svgElement("path", {
      d: `M ${points.x1} ${points.y1} Q ${curveX} ${curveY} ${points.x2} ${points.y2}`,
      class: "edge",
      stroke: relationshipColors[link.type] || relationshipColors.related,
      "data-source-id": link.sourceId,
      "data-target-id": link.targetId
    });

    graphViewport.appendChild(path);

    const labelText = link.type || "related";
    const labelWidth = labelText.length * 8 + 30;

    const labelPosition = findLabelPosition(
      points.x1,
      points.y1,
      points.x2,
      points.y2,
      offset,
      labelWidth,
      placedLabels
    );

    const label = svgElement("text", {
      x: labelPosition.x,
      y: labelPosition.y,
      class: "edge-label",
      "text-anchor": "middle",
      "data-source-id": link.sourceId,
      "data-target-id": link.targetId
    });

    label.textContent = labelText;
    label.style.fill =
      relationshipColors[link.type] || relationshipColors.related;

    graphViewport.appendChild(label);
  });

  findings.forEach((finding, index) => {
    const position = layout.positions.get(finding.id);
    if (!position) return;

    const title = getFindingTitle(finding);
    const evidenceText = getFindingText(finding);
    const sourceUrl = getFindingUrl(finding);

    const group = svgElement("g", {
      class: `node node-color-${index % nodeColors.length}`,
      transform: `translate(${position.x} ${position.y})`,
      tabindex: "0",
      role: "button",
      "aria-label": `Open finding: ${title}`,
      "data-finding-id": finding.id,
      "data-search-text": [
        title,
        evidenceText,
        sourceUrl
      ].filter(Boolean).join(" ").toLowerCase()
    });

    const rect = svgElement("rect", {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      rx: 17,
      ry: 17
    });

    group.appendChild(rect);

    const lines = wrapText(title);

    lines.forEach((line, lineIndex) => {
      addTextLine(
        group,
        line,
        20,
        37 + lineIndex * 22,
        "node-title"
      );
    });

    let sourceText = "Saved evidence";

    if (sourceUrl) {
      try {
        sourceText = new URL(sourceUrl).hostname.replace(/^www\./, "");
      } catch {
        sourceText = "Saved evidence";
      }
    }

    addTextLine(
      group,
      sourceText,
      20,
      NODE_HEIGHT - 17,
      "node-source"
    );

    group.addEventListener("click", () => {
      showDetails(finding);
    });

    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showDetails(finding);
      }
    });

    graphViewport.appendChild(group);
  });

  resetGraphView();

  if (searchInput) {
    applyGraphSearch(searchInput.value);
  }
}

async function loadGraph() {
  try {
    const workspace = await ensureWorkspace();

    // Relationships are stored separately from ensureWorkspace().
    const storedData = await chrome.storage.local.get({
      relationships: []
    });

    const activeProjectId = workspace.activeProjectId;

    const activeProject = workspace.projects.find(
      project => project.id === activeProjectId
    );

    if (projectName) {
      projectName.textContent =
        activeProject?.name || "My Research";
    }

    const findings = workspace.findings.filter(
      finding => finding.projectId === activeProjectId
    );

    const findingIds = new Set(
      findings.map(finding => finding.id)
    );

    const relationships = storedData.relationships.filter(
      link =>
        findingIds.has(link.sourceId) &&
        findingIds.has(link.targetId)
    );

    renderGraph(findings, relationships);

  } catch (error) {
    console.error("Unable to load THREAD graph:", error);

    empty.hidden = false;
    empty.textContent =
      "Unable to load the graph. Check the extension console.";

    svg.hidden = true;
  }
}

document.querySelector("#refreshButton")?.addEventListener(
  "click",
  loadGraph
);

searchInput?.addEventListener("input", event => {
  applyGraphSearch(event.target.value);
});

setupGraphNavigation();
loadGraph();
