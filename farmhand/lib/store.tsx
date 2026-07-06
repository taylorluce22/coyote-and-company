"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TabId } from "./data";
import type { Asset, Bg, StudioDesign } from "./studio";
import { DEFAULT_DESIGN } from "./studio";
import { SEED_POSTS, type Integrations, type PlannedPost } from "./planner";
import { DEFAULT_STRATEGY, type StrategyProfile } from "./strategy";
import { SEED_CONTACTS, type Contact } from "./pipeline";
import type { Opportunity } from "./engage";

export interface Upload {
  id: string;
  url: string;
  alt: string;
}

export interface ChannelStudio {
  design: StudioDesign;
  slideBg: Record<number, Bg>;
  coverBg?: Bg | null;
}

export interface AppState {
  tab: TabId;
  streak: number;
  approved: Record<string, boolean>;
  done: Record<string, boolean>;
  copied: Record<string, boolean>;
  planned: Record<string, boolean>;
  autopilotOn: boolean;

  // engine studio (Content Engine tab)
  studioSel: string;
  studioImgs: Record<string, string>;
  studioAccents: Record<string, string>;
  stSlide: number;

  // composer / post studio
  compChannel: "ig" | "fb" | "nd";
  compImg: string;
  compRatio: string;
  compBgMode: string;
  compAccent: string;
  compShort: boolean;
  compRegen: boolean;
  uploads: Upload[];
  stStudio: Record<string, ChannelStudio>; // per-channel design + slide bgs
  stAssets: Asset[]; // analyzed image library (persisted)
  compStatus: Record<string, string>; // per-channel: draft | ready | scheduled | posted
  pexelsKey: string;

  // weekly planner
  plannedPosts: PlannedPost[];
  weekBrief: string;
  integrations: Integrations;

  // strategy spine (LocalOS)
  onboarded: boolean;
  strategy: StrategyProfile;
  contentTab: "ideas" | "studio" | "week" | "queue";
  engageTab: "opportunities" | "sources" | "drafts";
  contacts: Contact[];
  opportunities: Opportunity[];


  // reply assistant
  asstInput: string;
  asstTone: string;
  asstShown: boolean;
  asstVariant: number;
  asstCopied: boolean;

  // results
  resLogged: number;

  // settings (dynamic keys)
  [key: string]: unknown;
}

const initialState: AppState = {
  tab: "today",
  streak: 11,
  approved: {},
  done: {},
  copied: {},
  planned: {},
  autopilotOn: true,
  studioSel: "e2",
  studioImgs: {},
  studioAccents: {},
  stSlide: 0,
  compChannel: "ig",
  compImg: "",
  compRatio: "portrait",
  compBgMode: "photo",
  compAccent: "cyan",
  compShort: false,
  compRegen: false,
  uploads: [],
  stStudio: {},
  stAssets: [],
  compStatus: {},
  pexelsKey: "",
  plannedPosts: SEED_POSTS,
  weekBrief: "",
  integrations: { cloudName: "", uploadPreset: "", makeWebhook: "", timezone: "", autoPublish: true },
  onboarded: false,
  strategy: DEFAULT_STRATEGY,
  contentTab: "studio",
  engageTab: "opportunities",
  contacts: SEED_CONTACTS,
  opportunities: [],
  asstInput:
    "Anyone know a good realtor in Gilbert? Just moved to Val Vista and looking to buy in the spring — no idea where to start with this market.",
  asstTone: "warm",
  asstShown: false,
  asstVariant: 0,
  asstCopied: false,
  resLogged: 0,
};

export function defaultChannelStudio(): ChannelStudio {
  return { design: { ...DEFAULT_DESIGN }, slideBg: {}, coverBg: null };
}

type Patch = Partial<AppState> | ((s: AppState) => Partial<AppState>);

interface Store {
  state: AppState;
  set: (patch: Patch) => void;
  copy: (text: string) => void;
  dragId: React.MutableRefObject<string | null>;
}

const StoreContext = createContext<Store | null>(null);

const PERSIST_KEY = "farmhand-studio-v1";
const PERSIST_FIELDS = [
  "stStudio",
  "stAssets",
  "compStatus",
  "pexelsKey",
  "plannedPosts",
  "weekBrief",
  "integrations",
  "onboarded",
  "strategy",
  "contacts",
  "opportunities",
] as const;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const hydrated = useRef(false);
  const dragId = useMemo(
    () => ({ current: null as string | null }),
    []
  ) as React.MutableRefObject<string | null>;

  // hydrate persisted studio state (library, looks, statuses, API key)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERSIST_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setState((s) => ({ ...s, ...saved }));
      }
    } catch {}
    hydrated.current = true;
  }, []);

  // save on change (persisted fields only)
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      const out: Record<string, unknown> = {};
      PERSIST_FIELDS.forEach((k) => (out[k] = state[k]));
      localStorage.setItem(PERSIST_KEY, JSON.stringify(out));
    } catch {}
  }, [state.stStudio, state.stAssets, state.compStatus, state.pexelsKey, state.plannedPosts, state.weekBrief, state.integrations, state.onboarded, state.strategy, state.contacts, state.opportunities]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((patch: Patch) => {
    setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  const copy = useCallback((text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, []);

  const value = useMemo(
    () => ({ state, set, copy, dragId }),
    [state, set, copy, dragId]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
