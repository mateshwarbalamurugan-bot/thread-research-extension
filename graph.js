
import { ensureWorkspace } from "./storage.js";

const svg = document.querySelector("#graph");
const empty = document.querySelector("#empty");
const details = document.querySelector("#details");
const projectName = document.querySelector("#projectName");

const SVG_NS = "http://www.w3.org/2000/svg";

let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let graphViewport = null;

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

// Smart force-directed node layout.
function calculateSmartLayout(
  findings,
  relationships,
  nodeWidth,
  nodeHeight,
  width,
  height
) {
  const count = findings.length;

  const positions = findings.map((finding, index) => {
    const columns = Math.min(3, count);
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      id: finding.id,
      x: 60 + column * 355 + nodeWidth / 2,
      y: 50 + row * 250 + nodeHeight / 2,
      originalX: 60 + column * 355 + nodeWidth / 2,
      originalY: 50 + row * 250 + nodeHeight / 2,
      vx: 0,
      vy: 0
    };
  });

  const indexMap = new Map(
    positions.map((position, index) => [position.id, index])
  );

  const links = relationships
    .map(link => ({
      source: indexMap.get(link.sourceId),
      target: indexMap.get(link.targetId)
    }))
    .filter(link =>
      link.source !== undefined &&
      link.target !== undefined &&
      link.source !== link.target
    );

  for (let iteration = 0; iteration < 180; iteration++) {
    const forces = positions.map(() => ({ x: 0, y: 0 }));

    // Push overlapping nodes apart.
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const a = positions[i];
        const b = positions[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;

        const overlapX = nodeWidth + 35 - Math.abs(dx);
        const overlapY = nodeHeight + 35 - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) {
            const push = overlapX * 0.08 * (dx >= 0 ? 1 : -1);
            forces[i].x -= push;
            forces[j].x += push;
          } else {
            const push = overlapY * 0.08 * (dy >= 0 ? 1 : -1);
            forces[i].y -= push;
            forces[j].y += push;
          }
        }
      }
    }

    // Pull connected findings towards each other.
    links.forEach(link => {
      const a = positions[link.source];
      const b = positions[link.target];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 1;

      const targetDistance = 390;

      if (distance > targetDistance) {
        const force = (distance - targetDistance) * 0.002;

        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        forces[link.source].x += fx;
        forces[link.source].y += fy;

        forces[link.target].x -= fx;
        forces[link.target].y -= fy;
      }
    });

    // Keep layout stable.
    positions.forEach((position, index) => {
      forces[index].x += (position.originalX - position.x) * 0.001;
      forces[index].y += (position.originalY - position.y) * 0.001;

      position.vx = (position.vx + forces[index].x) * 0.75;
      position.vy = (position.vy + forces[index].y) * 0.75;

      position.x += position.vx;
      position.y += position.vy;

      position.x = Math.max(
        nodeWidth / 2 + 30,
        Math.min(width - nodeWidth / 2 - 30, position.x)
      );

      position.y = Math.max(
        nodeHeight / 2 + 30,
        Math.min(height - nodeHeight / 2 - 30, position.y)
      );
    });
  }

  return new Map(
    positions.map(position => [
      position.id,
      {
        x: position.x - nodeWidth / 2,
        y: position.y - nodeHeight / 2
      }
    ])
  );
}

// Find a relationship label position that avoids nodes and other labels.
function findLabelPosition(
  x1,
  y1,
  x2,
  y2,
  controlX,
  controlY,
  labelText,
  positions,
  nodeWidth,
  nodeHeight,
  placedLabels,
  width,
  height
) {
  const labelWidth = labelText.length * 8 + 18;
  const labelHeight = 24;

  const candidates = [];

  const offsets = [45, -45, 65, -65, 90, -90, 120, -120, 155, -155];

  const points = [0.25, 0.35, 0.45, 0.5, 0.55, 0.65, 0.75];

  points.forEach(t => {
    const inverse = 1 - t;

    const pointX =
      inverse * inverse * x1 +
      2 * inverse * t * controlX +
      t * t * x2;

    const pointY =
      inverse * inverse * y1 +
      2 * inverse * t * controlY +
      t * t * y2;

    const tangentX =
      2 * inverse * (controlX - x1) +
      2 * t * (x2 - controlX);

    const tangentY =
      2 * inverse * (controlY - y1) +
      2 * t * (y2 - controlY);

    const tangentLength =
      Math.hypot(tangentX, tangentY) || 1;

    const normalX = -tangentY / tangentLength;
    const normalY = tangentX / tangentLength;

    offsets.forEach(offset => {
      candidates.push({
        x: pointX + normalX * offset,
        y: pointY + normalY * offset,
        offset,
        t
      });
    });
  });

  let bestPosition = candidates[0];
  let lowestScore = Infinity;

  candidates.forEach(candidate => {
    const left = candidate.x - labelWidth / 2;
    const right = candidate.x + labelWidth / 2;
    const top = candidate.y - labelHeight / 2;
    const bottom = candidate.y + labelHeight / 2;

    let score = Math.abs(candidate.offset) * 0.15;
    score += Math.abs(candidate.t - 0.5) * 20;

    // Penalise labels near the graph boundaries.
    if (left < 15 || right > width - 15) score += 100000;
    if (top < 15 || bottom > height - 15) score += 100000;

    // Check overlap with every finding card.
    positions.forEach(position => {
      const nodeLeft = position.x - 10;
      const nodeRight = position.x + nodeWidth + 10;
      const nodeTop = position.y - 10;
      const nodeBottom = position.y + nodeHeight + 10;

      const overlapX = Math.max(
        0,
        Math.min(right, nodeRight) - Math.max(left, nodeLeft)
      );

      const overlapY = Math.max(
        0,
        Math.min(bottom, nodeBottom) - Math.max(top, nodeTop)
      );

      score += overlapX * overlapY * 1000;
    });

    // Check overlap with labels already placed.
    placedLabels.forEach(previous => {
      const overlapX = Math.max(
        0,
        Math.min(right, previous.right) -
        Math.max(left, previous.left)
      );

      const overlapY = Math.max(
        0,
        Math.min(bottom, previous.bottom) -
        Math.max(top, previous.top)
      );

      score += overlapX * overlapY * 1500;
    });

    if (score < lowestScore) {
      lowestScore = score;
      bestPosition = candidate;
    }
  });

  return {
    x: bestPosition.x,
    y: bestPosition.y,
    left: bestPosition.x - labelWidth / 2,
    right: bestPosition.x + labelWidth / 2,
    top: bestPosition.y - labelHeight / 2,
    bottom: bestPosition.y + labelHeight / 2
  };
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
  const previousZoom = zoomLevel;

  zoomLevel = Math.max(
    0.4,
    Math.min(2.5, zoomLevel * factor)
  );

  const viewBox = svg.viewBox.baseVal;
  const centerX = viewBox.width / 2;
  const centerY = viewBox.height / 2;

  const scaleFactor = zoomLevel / previousZoom;

  panX = centerX - (centerX - panX) * scaleFactor;
  panY = centerY - (centerY - panY) * scaleFactor;

  updateGraphTransform();
}

function setupGraphNavigation() {
  document.querySelector("#zoomIn").addEventListener(
    "click",
    () => zoomGraph(1.2)
  );

  document.querySelector("#zoomOut").addEventListener(
    "click",
    () => zoomGraph(1 / 1.2)
  );

  document.querySelector("#resetView").addEventListener(
    "click",
    resetGraphView
  );

  svg.addEventListener("pointerdown", event => {
    if (event.target.closest(".node")) return;

    isDragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    svg.classList.add("dragging");
    svg.setPointerCapture(event.pointerId);
  });

  svg.addEventListener("pointermove", event => {
    if (!isDragging) return;

    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;

    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;

    panX += (event.clientX - lastPointerX) * scaleX;
    panY += (event.clientY - lastPointerY) * scaleY;

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
  graphViewport = null;

  if (!findings.length) {
    empty.hidden = false;
    svg.setAttribute("viewBox", "0 0 1100 600");
    return;
  }

  empty.hidden = true;

  const nodeWidth = 210;
  const nodeHeight = 100;
  const columns = Math.min(3, findings.length);
  const rows = Math.ceil(findings.length / columns);

  const width = Math.max(
    1100,
    columns * (nodeWidth + 145) + 100
  );

  const height = Math.max(
    600,
    rows * (nodeHeight + 150) + 150
  );

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("height", height);

  graphViewport = svgElement("g", {
    id: "graphViewport"
  });

  svg.append(graphViewport);

  const positions = calculateSmartLayout(
    findings,
    relationships,
    nodeWidth,
    nodeHeight,
    width,
    height
  );

  // Count connections between each pair.
  const pairCounts = new Map();

  relationships.forEach(link => {
    const key = [link.sourceId, link.targetId].sort().join("|");
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  });

  const pairIndexes = new Map();
  const placedLabels = [];

  // Draw relationship lines and labels.
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

    const offset = (index - (total - 1) / 2) * 55;

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

    graphViewport.append(path);

    const labelText = link.type.toUpperCase();

    const labelPosition = findLabelPosition(
      x1,
      y1,
      x2,
      y2,
      controlX,
      controlY,
      labelText,
      positions,
      nodeWidth,
      nodeHeight,
      placedLabels,
      width,
      height
    );

    placedLabels.push(labelPosition);

    const label = svgElement("text", {
      x: labelPosition.x,
      y: labelPosition.y + 4,
      class: "edge-label",
      "text-anchor": "middle"
    });

    label.textContent = labelText;
    graphViewport.append(label);
  });

  // Draw finding cards above relationship lines and labels.
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

    graphViewport.append(group);
  });

  resetGraphView();
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

// Button events.
document.querySelector("#refreshButton")
  .addEventListener("click", loadGraph);

setupGraphNavigation();
loadGraph();
