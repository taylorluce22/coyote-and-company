// Farmhand Capture + Radar — background service worker.

const DEFAULT_APP_URL = "https://coyote-and-company.vercel.app";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "farmhand-capture",
    title: "Send selection to Farmhand",
    contexts: ["selection"],
  });
  updateBadge();
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

// radar queue badge
async function updateBadge() {
  const { fhQueue = [] } = await chrome.storage.local.get("fhQueue");
  chrome.action.setBadgeBackgroundColor({ color: "#0D9488" });
  chrome.action.setBadgeText({ text: fhQueue.length ? String(fhQueue.length) : "" });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.fhQueue) updateBadge();
});

// NOTE: this used to also open a batch of Reddit search tabs whenever the
// Farmhand app auto-scanned (every few minutes) — that made a connected
// extension pop open new tabs on its own, repeatedly. Reddit is now searched
// server-side (see the app's multi-lane hunt engine), so that trigger is
// gone entirely. The extension's job now is just to passively read Facebook
// Groups & Nextdoor pages you're already browsing, logged in as yourself —
// it never opens a tab on its own.
