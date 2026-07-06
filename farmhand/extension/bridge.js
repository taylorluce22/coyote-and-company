// Farmhand Radar — app bridge.
// Runs only on the Farmhand app's own pages. It hands the leads the radar
// captured (while you browse Facebook / Nextdoor / Reddit in other tabs)
// straight into the open app — automatically, no button, no new tab.
// The app ingests them and acks the keys, which we then drain from the queue.

(function () {
  const EXT = "farmhand-radar";
  const APP = "farmhand-app";

  function announce() {
    window.postMessage({ source: EXT, type: "present" }, location.origin);
  }

  async function push() {
    try {
      const { fhQueue = [] } = await chrome.storage.local.get("fhQueue");
      if (fhQueue.length) {
        window.postMessage(
          { source: EXT, type: "queue", items: fhQueue.map((q) => ({ key: q.key, t: q.t, s: q.s, u: q.u })) },
          location.origin
        );
      }
    } catch {}
  }

  window.addEventListener("message", async (e) => {
    if (e.source !== window || !e.data || e.data.source !== APP) return;
    if (e.data.type === "hello") {
      announce();
      push();
    }
    if (e.data.type === "ack" && Array.isArray(e.data.keys) && e.data.keys.length) {
      try {
        const drop = new Set(e.data.keys);
        const { fhQueue = [] } = await chrome.storage.local.get("fhQueue");
        await chrome.storage.local.set({ fhQueue: fhQueue.filter((q) => !drop.has(q.key)) });
      } catch {}
    }
  });

  // push whenever the queue changes (new capture in any tab) + a slow heartbeat
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.fhQueue) push();
  });

  announce();
  push();
  setInterval(push, 5000);
})();
