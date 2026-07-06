// Farmhand Capture — background service worker.
// Adds a right-click menu on any selected text; sends the selection (plus the
// page title + URL as source context) to the Farmhand app's capture endpoint.

const DEFAULT_APP_URL = "https://coyote-and-company.vercel.app";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "farmhand-capture",
    title: "Send selection to Farmhand",
    contexts: ["selection"],
  });
});

async function appUrl() {
  const { farmhandAppUrl } = await chrome.storage.sync.get("farmhandAppUrl");
  return (farmhandAppUrl || DEFAULT_APP_URL).replace(/\/+$/, "");
}

async function sendToFarmhand(text, sourceTitle, pageUrl) {
  const base = await appUrl();
  const params = new URLSearchParams({
    capture: (text || "").slice(0, 1500),
    source: (sourceTitle || "").slice(0, 140),
    url: (pageUrl || "").slice(0, 500),
  });
  chrome.tabs.create({ url: `${base}/?${params.toString()}` });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "farmhand-capture") return;
  sendToFarmhand(info.selectionText, tab?.title, info.pageUrl || tab?.url);
});
