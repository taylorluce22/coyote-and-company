"use client";

import { useEffect, useState } from "react";
import { CONSULTANT_SHOTS, composePrompt, type ConsultantShot } from "@/lib/consultantLibrary";
import { processImageURL } from "@/lib/studio";
import { vaultAdd, vaultAll, vaultDelete, type VaultImage } from "@/lib/vault";

/**
 * Consultant Library — the system generates a library of real-looking
 * consultant photos for @taylorlucesolar so the feed reads established while
 * real photos are limited. Runs the CMO's Higgsfield-prompt skill
 * (lib/consultantLibrary.ts) → Soul jobs → vault. Taylor writes no prompts.
 */

type Status = "idle" | "rendering" | "done" | "failed";
const SOUL_KEY = "fh-soul-id";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function ConsultantLibrary() {
  const [soulId, setSoulId] = useState("");
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [vault, setVault] = useState<VaultImage[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    try { setSoulId(localStorage.getItem(SOUL_KEY) || ""); } catch {}
    vaultAll().then(setVault);
    fetch("/api/higgsfield").then((r) => r.json()).then((j) => setConfigured(!!j.configured)).catch(() => setConfigured(false));
  }, []);

  function saveSoul(v: string) {
    setSoulId(v);
    try { localStorage.setItem(SOUL_KEY, v.trim()); } catch {}
  }

  async function generateShot(shot: ConsultantShot): Promise<boolean> {
    setStatus((s) => ({ ...s, [shot.id]: "rendering" }));
    try {
      const prompt = composePrompt(shot);
      const seed = 1 + Math.floor(Math.random() * 999_999);
      const r = await fetch("/api/higgsfield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: [prompt], aspect: shot.aspect, seed, soulId: soulId.trim() || undefined }),
        signal: AbortSignal.timeout(40000),
      });
      const j = await r.json();
      if (j.needsCreds) { setMsg("Add your Higgsfield API keys in Vercel first."); setStatus((s) => ({ ...s, [shot.id]: "failed" })); return false; }
      const handle: string | null = Array.isArray(j.jobs) ? j.jobs[0] : null;
      if (!handle) { setStatus((s) => ({ ...s, [shot.id]: "failed" })); setMsg(j.error || "Couldn't start — no credits spent."); return false; }

      const deadline = Date.now() + 150_000;
      while (Date.now() < deadline) {
        await new Promise((res) => setTimeout(res, 3500));
        const cr = await fetch("/api/higgsfield", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ check: [handle] }) }).then((x) => x.json()).catch(() => null);
        const res = cr?.results?.[0];
        if (res?.status === "failed") { setStatus((s) => ({ ...s, [shot.id]: "failed" })); return false; }
        const url: string | undefined = res?.status === "completed" ? res.images?.[0] : undefined;
        if (url) {
          const p = await processImageURL(`/api/higgsfield?img=${encodeURIComponent(url)}`, 1200, 0.85);
          if (p) {
            await vaultAdd({ id: uid(), dataURL: p.dataURL, lum: p.lum, busy: p.busy, prompt, label: `Consultant · ${shot.label}`, createdAt: Date.now() });
            setPreview((pv) => ({ ...pv, [shot.id]: p.dataURL }));
            setStatus((s) => ({ ...s, [shot.id]: "done" }));
            vaultAll().then(setVault);
            return true;
          }
        }
      }
      setStatus((s) => ({ ...s, [shot.id]: "failed" }));
      return false;
    } catch {
      setStatus((s) => ({ ...s, [shot.id]: "failed" }));
      return false;
    }
  }

  async function generateAll() {
    if (busy) return;
    setBusy(true);
    const todo = CONSULTANT_SHOTS.filter((s) => status[s.id] !== "done");
    setMsg(`Generating ${todo.length} shots — they land as they finish. Safe to leave open.`);
    let ok = 0;
    for (const shot of todo) { if (await generateShot(shot)) ok++; }
    setMsg(`✓ ${ok} of ${todo.length} rendered into your vault.${ok < todo.length ? " Re-run to retry the rest." : ""}`);
    setBusy(false);
  }

  /** Import Higgsfield downloads (generated in Higgsfield's web UI with the
      real Soul-ID character) straight into the app library so they feed the
      DESERT GRID covers and reel openers. */
  async function importFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    let n = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const obj = URL.createObjectURL(file);
      try {
        const p = await processImageURL(obj, 1200, 0.85);
        if (p) {
          await vaultAdd({ id: uid(), dataURL: p.dataURL, lum: p.lum, busy: p.busy, prompt: "imported from Higgsfield", label: `Consultant · ${file.name.replace(/\.[^.]+$/, "").slice(0, 40)}`, createdAt: Date.now() });
          n++;
        }
      } finally {
        URL.revokeObjectURL(obj);
      }
    }
    vaultAll().then(setVault);
    setMsg(`✓ Imported ${n} photo${n === 1 ? "" : "s"} into your library.`);
    setBusy(false);
  }

  const consultantImgs = vault.filter((v) => (v.label || "").startsWith("Consultant ·"));

  return (
    <div>
      <p style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "72ch", marginTop: 0, marginBottom: 16 }}>
        The system builds your consultant photo library — real-looking field shots for @taylorlucesolar — so the feed reads
        established while your real photos are limited. Each shot runs the CMO&apos;s Higgsfield prompt skill; you write nothing.
      </p>

      {/* Soul ID */}
      <div className="fh-glass" style={{ borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#F4F3F8", marginBottom: 4 }}>Soul ID — locks your likeness (optional but recommended)</div>
        <div style={{ fontSize: 11.5, color: "#8B89A0", lineHeight: 1.5, marginBottom: 10 }}>
          In Higgsfield → <b>Soul ID</b>, upload 20+ photos of yourself and paste the ID here. Every shot becomes <i>you</i>.
          Without it, you get a consistent premium consultant persona — regenerate keepers with your Soul ID for exact likeness.
        </div>
        <input value={soulId} onChange={(e) => saveSoul(e.target.value)} placeholder="paste your Soul ID (e.g. soul_abc123…)"
          style={{ width: "100%", maxWidth: 380, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 11px", color: "#F4F3F8", fontSize: 12, fontFamily: "var(--mono)" }} />
      </div>

      {/* controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={generateAll} disabled={busy || configured === false}
          style={{ cursor: busy || configured === false ? "default" : "pointer", fontSize: 12.5, fontWeight: 650, color: "#0B0A12", background: busy || configured === false ? "#6E6C82" : "#E8622C", border: "none", borderRadius: 10, padding: "10px 16px" }}>
          {busy ? "Generating…" : "Generate the library (12 shots)"}
        </button>
        <label style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 650, color: "#F4F3F8", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, padding: "10px 16px" }}>
          Import photos ↑
          <input type="file" accept="image/*" multiple onChange={(e) => importFiles(e.target.files)} style={{ display: "none" }} />
        </label>
        {configured === false && <span style={{ fontSize: 11.5, color: "#FFC23D" }}>Higgsfield not configured — add API keys in Vercel.</span>}
        {msg && <span style={{ fontSize: 11.5, color: "#A6A4B8" }}>{msg}</span>}
      </div>
      <p style={{ fontSize: 11, color: "#6E6C82", lineHeight: 1.5, margin: "-6px 0 16px", maxWidth: "72ch" }}>
        <b style={{ color: "#8B89A0" }}>For your real likeness:</b> generate the shots in Higgsfield&apos;s own Image tool with your <code>taylor-consultant</code> character selected (Soul ID isn&apos;t API-accessible), then <b>Import photos</b> here to bring them into the library. The in-app Generate makes on-brand consultant scenes without your face.
      </p>

      {/* shot grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
        {CONSULTANT_SHOTS.map((shot) => {
          const st = status[shot.id] || "idle";
          const pv = preview[shot.id];
          return (
            <div key={shot.id} className="fh-glass" style={{ borderRadius: 12, overflow: "hidden" }}>
              <div style={{ aspectRatio: shot.aspect === "9:16" ? "9/16" : "3/4", background: "rgba(0,0,0,0.35)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {pv ? <img src={pv} alt={shot.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 10.5, color: st === "rendering" ? "#E8622C" : "#6E6C82" }}>{st === "rendering" ? "rendering…" : st === "failed" ? "failed — retry" : "not generated"}</span>}
              </div>
              <div style={{ padding: "9px 11px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#F4F3F8" }}>{shot.label}</div>
                <div style={{ fontSize: 10, color: "#8B89A0", marginTop: 1 }}>{shot.job} · {shot.preset}</div>
                <button onClick={() => !busy && generateShot(shot)} disabled={busy || st === "rendering" || configured === false}
                  style={{ marginTop: 8, width: "100%", cursor: busy || st === "rendering" ? "default" : "pointer", fontSize: 11, fontWeight: 600, color: st === "done" ? "#41D98A" : "#F4F3F8", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "6px 0" }}>
                  {st === "done" ? "✓ done · regenerate" : st === "rendering" ? "…" : "Generate"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* the growing library */}
      {consultantImgs.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 10 }}>Your consultant library · {consultantImgs.length} saved</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
            {consultantImgs.map((v) => (
              <div key={v.id} style={{ position: "relative", aspectRatio: "3/4", borderRadius: 8, overflow: "hidden" }}>
                <img src={v.dataURL} alt={v.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => vaultDelete(v.id).then(() => vaultAll().then(setVault))} title="delete"
                  style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, cursor: "pointer" }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
