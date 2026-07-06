// Farmhand Radar — content script.
// While you browse Facebook groups, Nextdoor, or Reddit AS YOURSELF, this
// script watches the posts already rendered on your screen, flags the ones
// that match your territories + buyer-intent language, and queues them for
// one-click send to your Farmhand inbox. It never navigates, never posts,
// never runs when you aren't on the page.

const INTENT = [
  /\b(moving|relocat\w*)\b/i,
  /\brecommend\w*\b/i,
  /\b(realtor|real estate agent|broker)\b/i,
  /\b(home|house).{0,24}(worth|value|price|sell)/i,
  /\b(sell|buy)ing?\b.{0,30}\b(home|house)\b/i,
  /\b(looking for|anyone know|any advice|suggestions?)\b/i,
  /\b(neighborhood|hoa|school district|commute|new build)\b/i,
];

let cfg = { on: true, keywords: [] };
const seen = new Set();

function loadCfg() {
  chrome.storage.sync.get(["fhRadarOn", "fhKeywords"]).then((v) => {
    cfg.on = v.fhRadarOn !== false;
    cfg.keywords = (v.fhKeywords || "")
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  });
}
loadCfg();
chrome.storage.onChanged.addListener(loadCfg);

function hashOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

function candidates() {
  // FB group posts render as role=article; Nextdoor + forums use <article>;
  // new Reddit uses <shreddit-post>. One selector covers all three.
  return document.querySelectorAll('[role="article"], article, shreddit-post');
}

function isMatch(text) {
  const t = text.toLowerCase();
  const pageMatch = cfg.keywords.some((k) => document.title.toLowerCase().includes(k));
  const kwInText = cfg.keywords.some((k) => t.includes(k));
  const intent = INTENT.some((re) => re.test(text));
  // On a page ABOUT your territory (group title matches), intent alone is
  // enough; elsewhere the post must mention a territory too.
  return intent && (pageMatch || kwInText);
}

async function queueMatch(text) {
  const key = hashOf(text.slice(0, 200));
  if (seen.has(key)) return false;
  seen.add(key);
  const { fhQueue = [] } = await chrome.storage.local.get("fhQueue");
  if (fhQueue.some((q) => q.key === key) || fhQueue.length >= 30) return false;
  fhQueue.push({
    key,
    t: text.slice(0, 500),
    s: (document.title || location.hostname).replace(/ [-|–|·] .*$/, "").slice(0, 90),
    u: location.href.slice(0, 400),
    at: Date.now(),
  });
  await chrome.storage.local.set({ fhQueue });
  return true;
}

function scan() {
  if (!cfg.on || cfg.keywords.length === 0) return 0;
  let found = 0;
  candidates().forEach((el) => {
    const text = (el.innerText || "").trim();
    if (text.length < 40 || text.length > 4000) return;
    if (!isMatch(text)) return;
    queueMatch(text).then((added) => {
      if (added) {
        el.style.outline = "2px solid rgba(45,212,191,0.7)";
        el.style.outlineOffset = "2px";
        el.style.borderRadius = "8px";
      }
    });
    found++;
  });
  return found;
}

// passive watch: scan as new posts render while you scroll (debounced)
let debounce = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounce);
  debounce = setTimeout(scan, 1600);
});
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(scan, 2500);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "fh-scan") {
    const n = scan();
    sendResponse({ scanned: true, matched: n });
  }
  return true;
});
