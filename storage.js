
export const DEFAULT_PROJECT_ID = "project-default";

export async function ensureWorkspace() {
  const data = await chrome.storage.local.get([
    "projects",
    "findings",
    "activeProjectId",
    "relationships"
  ]);

  const projects = data.projects || [];
  const findings = data.findings || [];

  if (projects.length === 0) {
    projects.push({
      id: DEFAULT_PROJECT_ID,
      name: "My Research",
      createdAt: new Date().toISOString()
    });
  }

  const validIds = new Set(projects.map(p => p.id));

  findings.forEach(finding => {
    if (!validIds.has(finding.projectId)) {
      finding.projectId = DEFAULT_PROJECT_ID;
    }
  });

  const activeProjectId = validIds.has(data.activeProjectId)
    ? data.activeProjectId
    : projects[0].id;

  await chrome.storage.local.set({
    projects,
    findings,
    activeProjectId,
    relationships: data.relationships || []
  });

  return { projects, findings, activeProjectId };
}

export async function createProject(name) {
  const workspace = await ensureWorkspace();
  const project = {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString()
  };

  if (!project.name) throw new Error("Project name is required");

  workspace.projects.push(project);

  await chrome.storage.local.set({
    projects: workspace.projects,
    activeProjectId: project.id
  });

  return project;
}

export async function addFinding(finding) {
  const workspace = await ensureWorkspace();

  workspace.findings.unshift({
    ...finding,
    id: crypto.randomUUID(),
    projectId: workspace.activeProjectId
  });

  await chrome.storage.local.set({
    findings: workspace.findings
  });
}
