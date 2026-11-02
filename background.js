const MENU_ID = "thread-save-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save selection to THREAD",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText || !tab) return;

  const { findings = [] } =
    await chrome.storage.local.get({ findings: [] });

  findings.unshift({
    id: crypto.randomUUID(),
    text: info.selectionText.trim(),
    sourceTitle: tab.title || "Untitled page",
    sourceUrl: tab.url || info.pageUrl || "",
    capturedAt: new Date().toISOString()
  });

  await chrome.storage.local.set({ findings });
});