const DEFAULT_APP_URL = "https://coyote-and-company.vercel.app";
const $ = (id) => document.getElementById(id);

async function base() {
  const { farmhandAppUrl } = await chrome.storage.sync.get("farmhandAppUrl");
  return (farmhandAppUrl || DEFAULT_APP_URL).replace(/\/+$/, "");
}

/* settings */
chrome.storage.sync.get(["farmhandAppUrl", "fhRadarOn", "fhKeywords"]).then((v) => {
  $("appurl").value = v.farmhandAppUrl || DEFAULT_APP_URL;
  $("keywords").value = v.fhKeywords || "";
  $("toggle").classList.toggle("on", v.fhRadarOn !== false);
});
$("appurl").addEventListener("change", async () => {
  await chrome.storage.sync.set({ farmhandAppUrl: $("appurl").value.trim() });
  $("saved").style.display = "block";
  setTimeout(() => ($("saved").style.display = "none"), 1500);
});
$("keywords").addEventListener("change", () => chrome.storage.sync.set({ fhKeywords: $("keywords").value }));
$("toggle").addEventListener("click", async () => {
  const on = !$("toggle").classList.contains("on");
  $("toggle").classList.toggle("on", on);
  await chrome.storage.sync.set({ fhRadarOn: on });
});

/* queue rendering */
async function renderQueue() {
  const { fhQueue = [] } = await chrome.storage.local.get("fhQueue");
  const has = fhQueue.length > 0;
  $("queue").style.display = has ? "block" : "none";
  $("send").style.display = has ? "block" : "none";
  $("clear").style.display = has ? "block" : "none";
  $("count").textContent = String(fhQueue.length);
  $("queue").innerHTML = fhQueue
    .slice(-8)
    .reverse()
    .map((q) => `<div class="qitem"><span class="qsrc">${(q.s || "page").replace(/</g, "&lt;")}</span> — ${(q.t || "").slice(0, 90).replace(/</g, "&lt;")}…</div>`)
    .join("");
}
renderQueue();
chrome.storage.onChanged.addListener((c, area) => area === "local" && c.fhQueue && renderQueue());

/* scan current page */
$("scan").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "fh-scan" });
    $("scan").textContent = "Scanned ✓ — matches queue below";
  } catch {
    $("scan").textContent = "Open a Facebook/Nextdoor/Reddit page first";
  }
  setTimeout(() => ($("scan").textContent = "Scan this page now"), 2200);
  setTimeout(renderQueue, 800);
});

/* send queue to Farmhand (batches of 5 per tab, URL-size safe) */
$("send").addEventListener("click", async () => {
  const { fhQueue = [] } = await chrome.storage.local.get("fhQueue");
  if (!fhQueue.length) return;
  const b = await base();
  const batch = fhQueue.slice(0, 5).map((q) => ({ t: q.t.slice(0, 350), s: q.s, u: q.u }));
  const params = new URLSearchParams({ captureBatch: JSON.stringify(batch) });
  chrome.tabs.create({ url: `${b}/?${params.toString()}` });
  await chrome.storage.local.set({ fhQueue: fhQueue.slice(5) });
});

$("clear").addEventListener("click", () => chrome.storage.local.set({ fhQueue: [] }));

/* manual selection capture (v1 behavior) */
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
  } catch {}
  if (!selection.trim()) {
    $("capture").textContent = "Select some text first";
    setTimeout(() => ($("capture").textContent = "Send selected text instead"), 2000);
    return;
  }
  const b = await base();
  const params = new URLSearchParams({
    capture: selection.slice(0, 1500),
    source: (tab.title || "").slice(0, 140),
    url: (tab.url || "").slice(0, 500),
  });
  chrome.tabs.create({ url: `${b}/?${params.toString()}` });
});
