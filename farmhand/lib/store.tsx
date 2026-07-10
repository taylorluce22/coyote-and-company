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
import { normalizeContact, SEED_CONTACTS, type Contact } from "./pipeline";
import { tagOpportunity, type Opportunity } from "./engage";
import type { SourceEntry } from "./sources";
import { DEFAULT_TRAINING, type LeadTraining } from "./hunt";

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
  sources: SourceEntry[];
  leadTraining: LeadTraining; // trainable memory for the web-wide lead engine
  extensionConnected: boolean; // Radar extension bridge live in this tab (transient)
  marketSel: string | null;
  doneActions: Record<string, boolean>;
  contentResponses: Record<string, { pillar: string; dm: number; comment: number; inquiry: number }>;
  briefs: Record<string, { summary: string; facts: string[] }>; // live area briefs, cached per territory
  demoMode: boolean; // true = example data visible; false = every number is real


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
  sources: [],
  leadTraining: DEFAULT_TRAINING,
  extensionConnected: false,
  marketSel: null,
  doneActions: {},
  contentResponses: {},
  briefs: {},
  demoMode: true,
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

/** Wipe every piece of example data — from here on, all numbers are earned. */
export function cleanSlate(): Partial<AppState> {
  return {
    demoMode: false,
    streak: 0,
    approved: {},
    done: {},
    copied: {},
    planned: {},
    plannedPosts: [],
    contacts: [],
    opportunities: [],
    doneActions: {},
    resLogged: 0,
    weekBrief: "",
  };
}

/** Bring the example data back (demos, walkthroughs). */
export function restoreDemo(): Partial<AppState> {
  return { demoMode: true, streak: 11, contacts: SEED_CONTACTS, plannedPosts: SEED_POSTS };
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
  "sources",
  "leadTraining",
  "doneActions",
  "contentResponses",
  "briefs",
  "demoMode",
  "streak",
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
        // migrate any old-shape contact records to the current schema
        if (Array.isArray(saved.contacts)) saved.contacts = saved.contacts.map(normalizeContact);
        setState((s) => ({ ...s, ...saved }));
      }
    } catch {}
    hydrated.current = true;

    // browser-extension capture: /?capture=<thread text>&source=<page title>&url=<page url>
    try {
      const params = new URLSearchParams(window.location.search);
      const captured = params.get("capture");
      if (captured && captured.trim()) {
        const sourceName = (params.get("source") || "Captured page").replace(/ [-|–] .*(Facebook|Nextdoor|Reddit).*$/i, "").trim() || "Captured page";
        const url = params.get("url") || undefined;
        setState((s) => {
          const territories = (s.strategy as { territories?: { name: string }[] })?.territories?.map((t) => t.name) || [];
          const matched = territories.find((n) => captured.toLowerCase().includes(n.toLowerCase()));
          const opp: Opportunity = {
            id: `opp-ext-${Date.now()}`,
            sourceName: sourceName.slice(0, 80),
            territory: matched || territories[0] || "General",
            excerpt: captured.trim().slice(0, 400),
            url,
            tags: tagOpportunity(captured),
            status: "new",
            capturedAt: "just now",
            capturedAtMs: Date.now(),
            firstTouch: !(s.opportunities as Opportunity[]).some((o) => o.sourceName === sourceName.slice(0, 80)),
          };
          return {
            ...s,
            opportunities: [opp, ...(s.opportunities as Opportunity[])],
            tab: s.onboarded ? "engage" : s.tab,
            engageTab: "opportunities",
          };
        });
        window.history.replaceState({}, "", window.location.pathname);
      }

      // radar batch from the extension: /?captureBatch=[{t,s,u},...]
      const batchRaw = params.get("captureBatch");
      if (batchRaw) {
        const batch = JSON.parse(batchRaw) as { t?: string; s?: string; u?: string }[];
        if (Array.isArray(batch) && batch.length) {
          setState((s) => {
            const territories = (s.strategy as { territories?: { name: string }[] })?.territories?.map((t) => t.name) || [];
            const existing = s.opportunities as Opportunity[];
            const newOpps: Opportunity[] = [];
            batch.slice(0, 6).forEach((b, i) => {
              const text = String(b.t || "").trim();
              if (!text) return;
              const srcName = String(b.s || "Radar capture").slice(0, 80);
              const matched = territories.find((n) => text.toLowerCase().includes(n.toLowerCase()));
              newOpps.push({
                id: `opp-radar-${Date.now()}-${i}`,
                sourceName: srcName,
                territory: matched || territories[0] || "General",
                excerpt: text.slice(0, 400),
                url: b.u ? String(b.u).slice(0, 500) : undefined,
                tags: tagOpportunity(text),
                status: "new",
                capturedAt: "just now",
                capturedAtMs: Date.now(),
                firstTouch: !existing.some((o) => o.sourceName === srcName) && !newOpps.some((o) => o.sourceName === srcName),
              });
            });
            if (!newOpps.length) return s;
            return {
              ...s,
              opportunities: [...newOpps, ...existing],
              tab: s.onboarded ? "engage" : s.tab,
              engageTab: "opportunities",
            };
          });
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    } catch {}
  }, []);

  // Live bridge to the Farmhand Radar extension: leads it captures while you
  // browse are pushed into this open tab automatically — no button, no new
  // tab. The extension's bridge content script postMessages the queue; we
  // ingest new items (dedup by extKey) and ack so it clears them.
  useEffect(() => {
    const ingest = (items: { key?: string; t?: string; s?: string; u?: string }[]) => {
      setState((s) => {
        const territories = (s.strategy as { territories?: { name: string }[] })?.territories?.map((t) => t.name) || [];
        const existing = s.opportunities as Opportunity[];
        const seen = new Set(existing.map((o) => o.extKey).filter(Boolean));
        const newOpps: Opportunity[] = [];
        items.forEach((b, i) => {
          const text = String(b.t || "").trim();
          if (!text || (b.key && seen.has(b.key))) return;
          const srcName = String(b.s || "Radar capture").slice(0, 80);
          const matched = territories.find((n) => text.toLowerCase().includes(n.toLowerCase()));
          newOpps.push({
            id: `opp-ext-${Date.now()}-${i}`,
            sourceName: srcName,
            territory: matched || territories[0] || "General",
            excerpt: text.slice(0, 400),
            url: b.u ? String(b.u).slice(0, 500) : undefined,
            tags: tagOpportunity(text),
            status: "new",
            capturedAt: "just now",
            capturedAtMs: Date.now(),
            firstTouch: !existing.some((o) => o.sourceName === srcName) && !newOpps.some((o) => o.sourceName === srcName),
            extKey: b.key,
          });
        });
        if (!newOpps.length) return s.extensionConnected ? s : { ...s, extensionConnected: true };
        return { ...s, extensionConnected: true, opportunities: [...newOpps, ...existing] };
      });
    };

    const onMsg = (e: MessageEvent) => {
      if (e.source !== window || !e.data || e.data.source !== "farmhand-radar") return;
      if (e.data.type === "present") {
        setState((s) => (s.extensionConnected ? s : { ...s, extensionConnected: true }));
        window.postMessage({ source: "farmhand-app", type: "hello" }, window.location.origin);
      }
      if (e.data.type === "queue" && Array.isArray(e.data.items) && e.data.items.length) {
        ingest(e.data.items);
        // ack every received key so the extension drains its queue
        const keys = e.data.items.map((i: { key?: string }) => i.key).filter(Boolean);
        window.postMessage({ source: "farmhand-app", type: "ack", keys }, window.location.origin);
      }
    };
    window.addEventListener("message", onMsg);
    // announce we're ready so an already-loaded bridge replies immediately
    window.postMessage({ source: "farmhand-app", type: "hello" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // save on change (persisted fields only)
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      const out: Record<string, unknown> = {};
      PERSIST_FIELDS.forEach((k) => (out[k] = state[k]));
      localStorage.setItem(PERSIST_KEY, JSON.stringify(out));
    } catch {}
  }, [state.stStudio, state.stAssets, state.compStatus, state.pexelsKey, state.plannedPosts, state.weekBrief, state.integrations, state.onboarded, state.strategy, state.contacts, state.opportunities, state.sources, state.leadTraining, state.doneActions, state.contentResponses, state.briefs, state.demoMode, state.streak]); // eslint-disable-line react-hooks/exhaustive-deps

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
