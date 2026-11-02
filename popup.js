const list = document.querySelector("#findings");
const count = document.querySelector("#count");
const empty = document.querySelector("#empty");
const clearButton = document.querySelector("#clear");

async function renderFindings() {
  const { findings = [] } = await chrome.storage.local.get({ findings: [] });
  list.replaceChildren();
  count.textContent = String(findings.length);
  empty.hidden = findings.length > 0;
  clearButton.hidden = findings.length === 0;

  for (const finding of findings) {
    const item = document.createElement("li");
    item.className = "finding";

    const quote = document.createElement("p");
    quote.textContent = finding.text;

    const source = document.createElement("div");
    source.className = "source";
    source.textContent = finding.sourceTitle || "Unknown source";

    const actions = document.createElement("div");
    actions.className = "actions";

    if (finding.sourceUrl) {
      const open = document.createElement("button");
      open.type = "button";
      open.textContent = "Open source";
      open.addEventListener("click", () => {
        chrome.tabs.create({ url: finding.sourceUrl });
      });
      actions.append(open);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      const current = await chrome.storage.local.get({ findings: [] });
      await chrome.storage.local.set({
        findings: current.findings.filter(entry => entry.id !== finding.id)
      });
      renderFindings();
    });
    actions.append(remove);

    item.append(quote, source, actions);
    list.append(item);
  }
}

clearButton.addEventListener("click", async () => {
  await chrome.storage.local.set({ findings: [] });
  renderFindings();
});

renderFindings();
