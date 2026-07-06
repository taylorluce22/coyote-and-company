"use client";

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

export default function FarmhandApp() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
