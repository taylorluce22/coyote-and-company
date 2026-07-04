"use client";

import { StoreProvider, useStore } from "@/lib/store";
import BackgroundFx from "./BackgroundFx";
import Rail from "./Rail";
import TopBar from "./TopBar";
import Dashboard from "./screens/Dashboard";
import ContentEngine from "./screens/ContentEngine";
import Composer from "./screens/Composer";
import Playbook from "./screens/Playbook";
import Calendar from "./screens/Calendar";
import Directory from "./screens/Directory";
import Assistant from "./screens/Assistant";
import Results from "./screens/Results";
import Settings from "./screens/Settings";

function Screen() {
  const { state } = useStore();
  switch (state.tab) {
    case "dashboard":
      return <Dashboard />;
    case "engine":
      return <ContentEngine />;
    case "composer":
      return <Composer />;
    case "playbook":
      return <Playbook />;
    case "calendar":
      return <Calendar />;
    case "directory":
      return <Directory />;
    case "assistant":
      return <Assistant />;
    case "results":
      return <Results />;
    case "settings":
      return <Settings />;
    default:
      return <Dashboard />;
  }
}

function Shell() {
  const { state } = useStore();
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
