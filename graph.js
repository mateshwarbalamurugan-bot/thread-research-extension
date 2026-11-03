
import { ensureWorkspace } from "./storage.js";

const svg = document.querySelector("#graph");
const empty = document.querySelector("#empty");
const details = document.querySelector("#details");
const projectName = document.querySelector("#projectName");

const SVG_NS = "http://www.w3.org/2000/svg";

const colors = {
  supports: "#70d9a5",
  contradicts: "#ff7777",
  related: "#75aaff"
};

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
}

function showDetails(finding) {
  details.replaceChildren();

  const label = document.createElement("p");
  label.className = "eyebrow";
  label.textContent = "SELECTED FINDING";

  const heading = document.createElement("h2");
  heading.textContent = finding.sourceTitle || "Untitled source";

  const quote = document.createElement("p");
  quote.textContent = finding.text || "No text available.";

  details.append(label, heading, quote);

  if (finding.sourceUrl) {
    const url = document.createElement("a");
    url.textContent = "Open original source";
    url.href = finding.sourceUrl;
    url.target = "_blank";
    url.rel = "noopener noreferrer";
    details.append(url);
  }
}

function wrapText(text, maxLength = 21, maxLines = 3) {
  const words = (text || "Untitled finding").split(/\s+/);
  const lines = [];
  let line = "";

  words.forEach(word => {
    while (word.length > maxLength) {
      if (line) {
        lines.push(line);
        line = "";
      }

      lines.push(word.slice(0, maxLength));
      word = word.slice(maxLength);
    }

    const next = line ? `${line} ${word}` : word;

    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });

  if (line) lines.push(line);

  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] =
      lines[maxLines - 1].slice(0, maxLength - 3) + "...";
  }

  return lines;
}

function addTextLine(group, text, position, index) {
  const line = svgElement("text", {
    x: position.x + 12,
    y: position.y + 30 + index * 19
  });

  line.textContent = text;
  group.append(line);
}

function renderGraph(findings, relationships) {
  svg.replaceChildren();

  if (!findings.length) {
    empty.hidden = false;
    svg.setAttribute("viewBox", "0 0 1100 600");
    return;
  }

  empty.hidden = true;

  const nodeWidth = 210;
  const nodeHeight = 100;
  const columnGap = 145;
  const rowGap = 150;
  const columns = Math.min(3, findings.length);
  const rows = Math.ceil(findings.length / columns);

  const width = Math.max(
    1100,
    columns * (nodeWidth + columnGap) + 100
  );

  const height = Math.max(
    600,
    rows * (nodeHeight + rowGap) + 150
  );

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("height", height);

  const positions = new Map();

  findings.forEach((finding, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    positions.set(finding.id, {
      x: 60 + column * (nodeWidth + columnGap),
      y: 50 + row * (nodeHeight + rowGap)
    });
  });

  // Group connections by the pair of findings they connect.
  const pairCounts = new Map();

  relationships.forEach(link => {
    const key = [link.sourceId, link.targetId].sort().join("|");
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  });

  const pairIndexes = new Map();

  // Draw every connection with its own curve and label.
  relationships.forEach(link => {
    const source = positions.get(link.sourceId);
    const target = positions.get(link.targetId);

    if (!source || !target) return;

    const x1 = source.x + nodeWidth / 2;
    const y1 = source.y + nodeHeight / 2;
    const x2 = target.x + nodeWidth / 2;
    const y2 = target.y + nodeHeight / 2;

    const key = [link.sourceId, link.targetId].sort().join("|");
    const total = pairCounts.get(key);
    const index = pairIndexes.get(key) || 0;

    pairIndexes.set(key, index + 1);

    const offset = (index - (total - 1) / 2) * 35;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;

    const controlX = midX - (dy / length) * offset;
    const controlY = midY + (dx / length) * offset;

    const path = svgElement("path", {
      d: `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`,
      fill: "none",
      stroke: colors[link.type] || colors.related,
      "stroke-width": 2.5,
      class: "edge"
    });

    svg.append(path);

    const label = svgElement("text", {
      x: controlX,
      y: controlY - 10,
      class: "edge-label",
      "text-anchor": "middle"
    });

    label.textContent = link.type.toUpperCase();
    svg.append(label);
  });

  // Draw finding nodes above the connections.
  findings.forEach(finding => {
    const position = positions.get(finding.id);

    const group = svgElement("g", {
      class: "node",
      tabindex: "0",
      role: "button",
      "aria-label": finding.text || "Untitled finding"
    });

    const rectangle = svgElement("rect", {
      x: position.x,
      y: position.y,
      width: nodeWidth,
      height: nodeHeight,
      rx: 12
    });

    group.append(rectangle);

    wrapText(finding.text).forEach((text, index) => {
      addTextLine(group, text, position, index);
    });

    group.addEventListener("click", () => showDetails(finding));

    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showDetails(finding);
      }
    });

    svg.append(group);
  });
}

async function loadGraph() {
  try {
    const workspace = await ensureWorkspace();

    const activeProject = workspace.projects.find(
      project => project.id === workspace.activeProjectId
    );

    projectName.textContent = activeProject
      ? activeProject.name
      : "Research project";

    const findings = workspace.findings.filter(
      finding => finding.projectId === workspace.activeProjectId
    );

    const { relationships = [] } =
      await chrome.storage.local.get({ relationships: [] });

    const projectRelationships = relationships.filter(
      link => link.projectId === workspace.activeProjectId
    );

    renderGraph(findings, projectRelationships);
  } catch (error) {
    console.error("Unable to load THREAD graph:", error);
    projectName.textContent = "Unable to load project";
  }
}

document.querySelector("#refreshButton")
  .addEventListener("click", loadGraph);

loadGraph();
