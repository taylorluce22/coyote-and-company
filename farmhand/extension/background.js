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

// App-triggered Reddit sweep: the Farmhand app's Rescan button relays here
// (via bridge.js). We set the territory keywords the content script matches
// on, then open Reddit search tabs it will scan automatically.
const AZ_SUBS = "phoenix+arizona+MovingtoPhoenix+WestValleyAZ+Scottsdale+gilbert";
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "fh-reddit-scan") {
    const kws = (msg.territories || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3);
    if (kws.length) {
      // make sure the content script has these keywords to match against
      chrome.storage.sync.get("fhKeywords").then(({ fhKeywords }) => {
        const existing = (fhKeywords || "").split(",").map((s) => s.trim()).filter(Boolean);
        const merged = Array.from(new Set([...existing, ...kws]));
        chrome.storage.sync.set({ fhKeywords: merged.join(", "), fhRadarOn: true });
      });
      kws.forEach((k, i) => {
        const url = `https://old.reddit.com/r/${AZ_SUBS}/search?q=${encodeURIComponent('"' + k + '"')}&restrict_sr=on&sort=new&t=month`;
        setTimeout(() => chrome.tabs.create({ url, active: i === 0 }), i * 500);
      });
    }
    sendResponse({ ok: true, opened: kws.length });
  }
  return true;
});
