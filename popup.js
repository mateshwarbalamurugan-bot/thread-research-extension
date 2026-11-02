
import {
  ensureWorkspace,
  createProject
} from "./storage.js";

const list = document.querySelector("#findings");
const count = document.querySelector("#count");
const empty = document.querySelector("#empty");
const clearButton = document.querySelector("#clear");
const projectSelect = document.querySelector("#projectSelect");
const projectForm = document.querySelector("#projectForm");
const projectName = document.querySelector("#projectName");

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
        findings: []
      });

      await chrome.storage.local.set({
        findings: current.findings.filter(
          entry => entry.id !== finding.id
        )
      });

      render();
    };

    actions.append(remove);
    item.append(quote, title, url, actions);
    list.append(item);
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

clearButton.addEventListener("click", async () => {
  const workspace = await ensureWorkspace();

  await chrome.storage.local.set({
    findings: workspace.findings.filter(
      finding => finding.projectId !== workspace.activeProjectId
    )
  });

  render();
});

render();
