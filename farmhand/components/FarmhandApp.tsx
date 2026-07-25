"use client";

import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { parseHandoff, unpackHandoff } from "@/lib/handoff";
import BackgroundFx from "./BackgroundFx";
import Rail from "./Rail";
import TopBar from "./TopBar";
import Onboarding from "./Onboarding";
import Dashboard from "./screens/Dashboard";
import Content from "./screens/Content";
import Market from "./screens/Market";
import Engage from "./screens/Engage";
import Pipeline from "./screens/Pipeline";
import Results from "./screens/Results";
import Settings from "./screens/Settings";
import CommandCenter from "./screens/CommandCenter";
import AgentNetwork from "./screens/AgentNetwork";
import KnowledgeVault from "./screens/KnowledgeVault";
import { TasksPanel, SchedulePanel, ToolsPanel } from "./screens/OsPanels";
import Connectors from "./screens/Connectors";
import TemplateStudio from "./screens/TemplateStudio";
import ConsultantLibrary from "./screens/ConsultantLibrary";
import PacketExport from "./screens/PacketExport";
import Progress from "./screens/Progress";

function Screen() {
  const { state } = useStore();
  switch (state.tab) {
    case "command":
      return <CommandCenter />;
    case "agents":
      return <AgentNetwork />;
    case "tasks":
      return <TasksPanel />;
    case "schedule":
      return <SchedulePanel />;
    case "tools":
      return <ToolsPanel />;
    case "connectors":
      return <Connectors />;
    case "vault":
      return <KnowledgeVault />;
    case "content":
      return <Content />;
    case "progress":
      return <Progress />;
    case "packet":
      return <PacketExport />;
    case "studio":
      return <TemplateStudio />;
    case "library":
      return <ConsultantLibrary />;
    case "engage":
      return <Engage />;
    case "insights":
      return <Results />;
    case "settings":
      return <Settings />;
    case "today":
      return <Dashboard />;
    case "market":
      return <Market />;
    case "pipeline":
      return <Pipeline />;
    default:
      return <CommandCenter />;
  }
}

/**
 * Phone handoff receiver — a link created in Settings → 📱 Use on phone
 * carries an encrypted client bundle (key in the #fragment, ciphertext in a
 * Blob). This runs on EVERY load, before the onboarding gate, so a brand-new
 * phone lands, imports the full setup, switches into it, deletes the blob,
 * and scrubs the URL.
 */
function HandoffReceiver() {
  const { importClient, switchWorkspace } = useStore();
  const [msg, setMsg] = useState<string | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const h = parseHandoff();
    if (!h) return;
    (async () => {
      setMsg("📱 Importing your setup…");
      try {
        const res = await fetch(h.blobUrl, { signal: AbortSignal.timeout(60000) });
        if (!res.ok) throw new Error("link expired");
        const bundle = await unpackHandoff(await res.arrayBuffer(), h.key);
        const id = await importClient(bundle);
        if (!id) throw new Error("bad bundle");
        // clean the URL BEFORE switching (switch may re-render everything)
        try {
          history.replaceState(null, "", location.pathname);
        } catch {}
        // one-time link: burn the blob
        fetch("/api/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ del: h.blobUrl }) }).catch(() => {});
        setMsg("✓ Setup imported — loading your workspace…");
        switchWorkspace(id);
        setTimeout(() => setMsg(null), 4000);
      } catch (e) {
        setMsg(
          `Couldn't import: ${e instanceof Error && e.message === "link expired" ? "this link was already used or expired" : "the link looks damaged"} — create a fresh one on your computer (Settings → 📱 Use on phone).`
        );
      }
    })();
  }, [importClient, switchWorkspace]);
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "rgba(10,10,18,0.92)", border: "1px solid rgba(125,211,252,0.4)", color: "#D8D6E6", borderRadius: 12, padding: "10px 18px", fontSize: 12.5, maxWidth: "90vw", lineHeight: 1.5 }}>
      {msg}
    </div>
  );
}

function Shell() {
  const { state } = useStore();
  return (
    <>
      <HandoffReceiver />
      {!state.onboarded ? (
        <Onboarding />
      ) : (
        <div className="fh-app">
          <BackgroundFx />
          <Rail />
          <main className="fh-main">
            <TopBar />
            <div key={state.tab} className="fh-rise">
              <Screen />
            </div>
          </main>
        </div>
      )}
    </>
  );
}

/**
 * Last line of defense: without a boundary, ANY render error unmounts the
 * entire React tree — production showed a dead black "Application error"
 * page with no way back (on a phone it just looks like the app never loads).
 * A crash now lands on a recovery card instead, and reloading always works
 * because the current tab is never persisted.
 */
/** A stale tab straddling two deployments fails loading old chunk files. */
const isStaleDeployError = (msg: string) => /loading chunk|chunkloaderror|failed to fetch dynamically imported|importing a module script failed/i.test(msg);

/** One-shot reload for the stale-deploy case; the flag prevents any loop. */
function healStaleDeploy() {
  try {
    if (!sessionStorage.getItem("fh-deploy-reload")) {
      sessionStorage.setItem("fh-deploy-reload", "1");
      window.location.reload();
    }
  } catch {}
}

/**
 * Chunk failures during client-side navigation can surface as unhandled
 * rejections OUTSIDE React's error boundary — CrashGuard never sees those,
 * so the tab just wedges. These window-level listeners close that gap.
 */
function DeployHealListener() {
  useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      if (isStaleDeployError(e.message || "")) healStaleDeploy();
    };
    const onRej = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "");
      if (isStaleDeployError(msg)) healStaleDeploy();
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);
  return null;
}

/**
 * Without this, dropping a file anywhere OUTSIDE a designated drop zone
 * (e.g. missing the Reel Coach upload box by a few pixels) falls through to
 * the browser's default drag-drop behavior: it navigates the tab and tries
 * to open the raw file directly. For a large local video that can wedge
 * Chrome's shared video/GPU pipeline hard enough to need a full browser
 * restart — not just this tab. This blanket page-level guard makes every
 * drop a no-op by default; individual drop zones (Reel Coach's upload box)
 * still work because their own onDrop handler runs first, during bubbling,
 * before this one.
 */
function DropGuard() {
  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);
  return null;
}

class CrashGuard extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: e?.message || "unknown error" };
  }
  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error("Farmhand crashed:", e, info?.componentStack);
    // Self-heal the mid-deploy stale-tab case: the old build's files are gone
    // from the server, so a reload (once — the flag prevents a loop) fetches
    // the new build and everything works. Without this the tab just "won't
    // load" until the user hard-refreshes by hand.
    if (isStaleDeployError(e?.message || "")) healStaleDeploy();
  }
  render() {
    if (this.state.error && isStaleDeployError(this.state.error)) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 13.5, color: "#A6A4B8" }}>New version available — refreshing…</div>
        </div>
      );
    }
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="fh-glass" style={{ borderRadius: 16, padding: "28px 30px", maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🌵</div>
          <div className="fh-title" style={{ fontSize: 17, marginBottom: 8 }}>Something went sideways</div>
          <div style={{ fontSize: 12.5, color: "#A6A4B8", lineHeight: 1.6, marginBottom: 6 }}>
            The screen hit an error, but your data is safe — everything is stored on this device.
          </div>
          <div style={{ fontSize: 10.5, color: "#6E6C82", fontFamily: "monospace", marginBottom: 18, wordBreak: "break-word" }}>
            {this.state.error}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "#FF9A62", color: "#0B0B16", border: "none", borderRadius: 10, padding: "11px 26px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Reload Farmhand
          </button>
        </div>
      </div>
    );
  }
}

export default function FarmhandApp() {
  return (
    <CrashGuard>
      <DeployHealListener />
      <DropGuard />
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </CrashGuard>
  );
}
