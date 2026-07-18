"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
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

function Screen() {
  const { state } = useStore();
  switch (state.tab) {
    case "today":
      return <Dashboard />;
    case "content":
      return <Content />;
    case "market":
      return <Market />;
    case "engage":
      return <Engage />;
    case "pipeline":
      return <Pipeline />;
    case "insights":
      return <Results />;
    case "settings":
      return <Settings />;
    default:
      return <Dashboard />;
  }
}

function Shell() {
  const { state } = useStore();
  if (!state.onboarded) return <Onboarding />;
  return (
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
  );
}

/**
 * Last line of defense: without a boundary, ANY render error unmounts the
 * entire React tree — production showed a dead black "Application error"
 * page with no way back (on a phone it just looks like the app never loads).
 * A crash now lands on a recovery card instead, and reloading always works
 * because the current tab is never persisted.
 */
class CrashGuard extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: e?.message || "unknown error" };
  }
  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error("Farmhand crashed:", e, info?.componentStack);
  }
  render() {
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
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </CrashGuard>
  );
}
