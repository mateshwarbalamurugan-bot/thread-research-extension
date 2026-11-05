
import {
  ensureWorkspace,
  createProject,
  createRelationship,
  deleteRelationship
} from "./storage.js";

const list = document.querySelector("#findings");
const count = document.querySelector("#count");
const empty = document.querySelector("#empty");
const clearButton = document.querySelector("#clear");
const projectSelect = document.querySelector("#projectSelect");
const projectForm = document.querySelector("#projectForm");
const projectName = document.querySelector("#projectName");

const relationshipForm = document.querySelector("#relationshipForm");
const sourceSelect = document.querySelector("#sourceFinding");
const targetSelect = document.querySelector("#targetFinding");
const relationshipList = document.querySelector("#relationships");
const noRelationships = document.querySelector("#noRelationships");
const graphButton = document.querySelector("#openGraph");

async function render() {
  const workspace = await ensureWorkspace();

  projectSelect.replaceChildren();

  workspace.projects.forEach(project => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    projectSelect.append(option);
  });

  projectSelect.value = workspace.activeProjectId;

  const findings = workspace.findings.filter(
    finding => finding.projectId === workspace.activeProjectId
  );

  list.replaceChildren();
  count.textContent = String(findings.length);
  empty.hidden = findings.length > 0;
  clearButton.hidden = findings.length === 0;

  findings.forEach(finding => {
    const item = document.createElement("li");
    item.className = "finding";

    const quote = document.createElement("p");
    quote.textContent = finding.text;

    const title = document.createElement("div");
    title.className = "source";
    title.textContent = `Page: ${finding.sourceTitle || "Unknown title"}`;

    const url = document.createElement("div");
    url.className = "source";
    url.textContent = `URL: ${finding.sourceUrl || "Unavailable"}`;

    const actions = document.createElement("div");
    actions.className = "actions";

    if (finding.sourceUrl) {
      const open = document.createElement("button");
      open.textContent = "Open source";
      open.onclick = () => chrome.tabs.create({
        url: finding.sourceUrl
      });
      actions.append(open);
    }

    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.onclick = async () => {
      const current = await chrome.storage.local.get({
        findings: [],
        relationships: []
      });

      await chrome.storage.local.set({
        findings: current.findings.filter(
          entry => entry.id !== finding.id
        ),
        relationships: current.relationships.filter(
          link => link.sourceId !== finding.id &&
                  link.targetId !== finding.id
        )
      });

      render();
    };

    actions.append(remove);
    item.append(quote, title, url, actions);
    list.append(item);
  });

  // Populate relationship selectors.
  [sourceSelect, targetSelect].forEach(select => {
    select.replaceChildren();

    findings.forEach(finding => {
      const option = document.createElement("option");
      option.value = finding.id;
      option.textContent =
        finding.text.slice(0, 65) || "Untitled finding";
      select.append(option);
    });
  });

  relationshipForm.querySelector("button").disabled =
    findings.length < 2;

  const { relationships = [] } =
    await chrome.storage.local.get({ relationships: [] });

  const projectLinks = relationships.filter(
    link => link.projectId === workspace.activeProjectId
  );

  relationshipList.replaceChildren();
  noRelationships.hidden = projectLinks.length > 0;

  const labels = {
    supports: "Supports",
    contradicts: "Contradicts",
    related: "Related To"
  };

  projectLinks.forEach(link => {
    const source = findings.find(f => f.id === link.sourceId);
    const target = findings.find(f => f.id === link.targetId);

    if (!source || !target) return;

    const item = document.createElement("li");
    item.className = "finding";

    const description = document.createElement("p");
    description.textContent =
      `${source.text.slice(0, 45)} → ${labels[link.type]} → ${target.text.slice(0, 45)}`;

    const remove = document.createElement("button");
    remove.textContent = "Remove connection";
    remove.onclick = async () => {
      await deleteRelationship(link.id);
      render();
    };

    item.append(description, remove);
    relationshipList.append(item);
  });
}

projectSelect.addEventListener("change", async () => {
  await chrome.storage.local.set({
    activeProjectId: projectSelect.value
  });
  render();
});

projectForm.addEventListener("submit", async event => {
  event.preventDefault();

  try {
    await createProject(projectName.value);
    projectName.value = "";
    await render();
  } catch (error) {
    alert(error.message);
  }
});

relationshipForm.addEventListener("submit", async event => {
  event.preventDefault();

  try {
    await createRelationship(
      sourceSelect.value,
      targetSelect.value,
      document.querySelector("#relationshipType").value
    );

    await render();
  } catch (error) {
    alert(error.message);
  }
});

clearButton.addEventListener("click", async () => {
  const workspace = await ensureWorkspace();

  const { relationships = [] } =
    await chrome.storage.local.get({ relationships: [] });

  await chrome.storage.local.set({
    findings: workspace.findings.filter(
      finding => finding.projectId !== workspace.activeProjectId
    ),
    relationships: relationships.filter(
      link => link.projectId !== workspace.activeProjectId
    )
  });

  render();
});
graphButton.addEventListener("click", () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("graph.html")
  });
});
render();
