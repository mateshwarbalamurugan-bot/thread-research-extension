
import { ensureWorkspace, addFinding } from "./storage.js";

const MENU_ID = "thread-save-selection";

chrome.runtime.onInstalled.addListener(async () => {
  await ensureWorkspace();

  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save selection to THREAD",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (
    info.menuItemId !== MENU_ID ||
    !info.selectionText ||
    !tab
  ) return;

  await addFinding({
    text: info.selectionText.trim(),
    sourceTitle: tab.title || "Untitled page",
    sourceUrl: tab.url || info.pageUrl || "",
    capturedAt: new Date().toISOString()
  });
});
