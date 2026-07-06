const DEFAULT_APP_URL = "https://coyote-and-company.vercel.app";
const $ = (id) => document.getElementById(id);

// settings
chrome.storage.sync.get("farmhandAppUrl").then(({ farmhandAppUrl }) => {
  $("appurl").value = farmhandAppUrl || DEFAULT_APP_URL;
});
$("appurl").addEventListener("change", async () => {
  await chrome.storage.sync.set({ farmhandAppUrl: $("appurl").value.trim() });
  $("saved").style.display = "block";
  setTimeout(() => ($("saved").style.display = "none"), 1500);
});

// capture current selection on the active tab
$("capture").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  let selection = "";
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || "",
    });
    selection = results?.[0]?.result || "";
  } catch {
    // page blocks scripting (e.g. chrome:// pages)
  }
  if (!selection.trim()) {
    $("capture").textContent = "Select some text first, then click";
    setTimeout(() => ($("capture").textContent = "Send selection to Farmhand →"), 2000);
    return;
  }
  const { farmhandAppUrl } = await chrome.storage.sync.get("farmhandAppUrl");
  const base = (farmhandAppUrl || DEFAULT_APP_URL).replace(/\/+$/, "");
  const params = new URLSearchParams({
    capture: selection.slice(0, 1500),
    source: (tab.title || "").slice(0, 140),
    url: (tab.url || "").slice(0, 500),
  });
  chrome.tabs.create({ url: `${base}/?${params.toString()}` });
});
