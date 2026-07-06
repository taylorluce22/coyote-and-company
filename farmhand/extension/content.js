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
  // new Reddit uses <shreddit-post>; old Reddit uses .thing and search
  // results use .search-result. One selector covers all of them.
  return document.querySelectorAll(
    '[role="article"], article, shreddit-post, div.thing, div.search-result, [data-testid="search-post-unit"]'
  );
}

/** Best-effort permalink for the matched post (falls back to the page URL). */
function linkOf(el) {
  try {
    const perma = el.getAttribute && (el.getAttribute("data-permalink") || el.getAttribute("permalink"));
    if (perma) return new URL(perma, location.origin).href;
    const a =
      el.querySelector &&
      (el.querySelector('a.search-title, a[data-click-id="body"], a[slot="full-post-link"], a[href*="/comments/"]') || null);
    if (a && a.href) return a.href;
  } catch {}
  return location.href;
}

function sourceName() {
  if (/reddit\.com$/.test(location.hostname) || location.hostname.endsWith("reddit.com")) {
    const m = location.pathname.match(/\/r\/([^/+]+)/);
    return m ? `r/${m[1]}` : "Reddit";
  }
  return (document.title || location.hostname).replace(/ [-|–|·] .*$/, "").slice(0, 90);
}

function isMatch(text) {
  const t = text.toLowerCase();
  // page is "about" a territory if the group title OR the search query matches
  const pageCtx = (document.title + " " + decodeURIComponent(location.search)).toLowerCase();
  const pageMatch = cfg.keywords.some((k) => pageCtx.includes(k));
  const kwInText = cfg.keywords.some((k) => t.includes(k));
  const intent = INTENT.some((re) => re.test(text));
  // On a page ABOUT your territory (group/search matches), intent alone is
  // enough; elsewhere the post must mention a territory too.
  return intent && (pageMatch || kwInText);
}

// Serialize all storage writes through one chain — concurrent matches in a
// single scan would otherwise read-modify-write the same array and clobber
// each other, losing all but the last capture.
let writeLock = Promise.resolve();

function queueMatch(text, url) {
  const key = hashOf(text.slice(0, 200));
  if (seen.has(key)) return Promise.resolve(false);
  seen.add(key);
  const result = writeLock.then(async () => {
    const { fhQueue = [] } = await chrome.storage.local.get("fhQueue");
    if (fhQueue.some((q) => q.key === key) || fhQueue.length >= 30) return false;
    fhQueue.push({
      key,
      t: text.slice(0, 500),
      s: sourceName(),
      u: (url || location.href).slice(0, 400),
      at: Date.now(),
    });
    await chrome.storage.local.set({ fhQueue });
    return true;
  });
  // keep the lock chain alive even if this write throws
  writeLock = result.then(() => {}, () => {});
  return result;
}

function scan() {
  if (!cfg.on || cfg.keywords.length === 0) return 0;
  let found = 0;
  candidates().forEach((el) => {
    const text = (el.innerText || "").trim();
    if (text.length < 40 || text.length > 4000) return;
    if (!isMatch(text)) return;
    queueMatch(text, linkOf(el)).then((added) => {
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
