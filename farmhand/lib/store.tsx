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
import { DEFAULT_STRATEGY, SOLAR_TERRITORIES, type Idea, type StrategyProfile } from "./strategy";
import { normalizeContact, SEED_CONTACTS, type Contact } from "./pipeline";
import { tagOpportunity, type Opportunity } from "./engage";
import type { SourceEntry } from "./sources";
import { DEFAULT_TRAINING, isProvablyStaleLead, type LeadTraining } from "./hunt";
import { VERTICALS } from "./verticals";
import { memoryConfigured, pullSnapshot, pushSnapshot, mergeById } from "./memorySync";
import { setVaultClient } from "./vault";
import { setReelVaultClient } from "./reelVault";
import {
  loadClients, saveClients, persistKeyFor, makeClientId,
  exportClientBundle, importClientBundle, purgeClient,
  type ClientMeta, type ClientId, type ClientBundle,
} from "./clients";

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
  // the idea the Studio is currently composing from (null = channel demo copy)
  compIdea: Idea | null;
  compImg: string;
  compRatio: string;
  compBgMode: string;
  compAccent: string;
  compShort: boolean;
  compRegen: boolean;
  // AI-written copy for the current idea+channel (key = `${ideaId}:${channel}`)
  compAiCopy: { key: string; long: string; short: string; cta: string } | null;
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
  contentTab: "ideas" | "studio" | "week" | "queue" | "reels";
  engageTab: "opportunities" | "conversations" | "sources" | "drafts";
  contacts: Contact[];
  opportunities: Opportunity[];
  sources: SourceEntry[];
  leadTraining: LeadTraining; // trainable memory for the web-wide lead engine
  extensionConnected: boolean; // Radar extension bridge live in this tab (transient)
  marketSel: string | null;
  doneActions: Record<string, boolean>;
  contentResponses: Record<string, { pillar: string; dm: number; comment: number; inquiry: number }>;
  briefs: Record<string, { summary: string; facts: string[] }>; // live area briefs, cached per territory
  energyIntel: { fetchedAt: number; items: { headline: string; summary: string; source: string; url: string; date: string; utility: string; angle: string }[] } | null; // live AZ energy news → post angles (solar vertical)
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
  tab: "command",
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
  compIdea: null,
  compImg: "",
  compRatio: "portrait",
  compBgMode: "photo",
  compAccent: "cyan",
  compShort: false,
  compRegen: false,
  compAiCopy: null,
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
  energyIntel: null,
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

/**
 * Operator multi-client mode (E1) — the founder services many client accounts
 * from one browser. Each client is isolated: its own app-state localStorage key
 * and its own IndexedDB vaults. The registry + storage keys live in ./clients;
 * "default" (realtor test user) and "solar" (the real account) are seeded with
 * their original keys so all existing data loads untouched. WorkspaceId is kept
 * as an alias of the string ClientId for back-compat.
 */
export type WorkspaceId = ClientId;

interface Store {
  state: AppState;
  set: (patch: Patch) => void;
  copy: (text: string) => void;
  dragId: React.MutableRefObject<string | null>;
  /** active client id (a.k.a. workspace, back-compat name) */
  workspace: ClientId;
  switchWorkspace: (ws: ClientId) => void;
  /** the full client roster the switcher renders */
  clients: ClientMeta[];
  addClient: (label: string, opts?: { emoji?: string; vertical?: "realtor" | "solar" }) => ClientId;
  renameClient: (id: ClientId, label: string, emoji?: string) => void;
  removeClient: (id: ClientId) => void;
  exportClient: (id: ClientId) => Promise<void>;
  importClient: (bundle: ClientBundle) => Promise<ClientId | null>;
}

const StoreContext = createContext<Store | null>(null);

const WS_ACTIVE_KEY = "farmhand-ws-active";
const PERSIST_FIELDS = [
  "stStudio",
  "stAssets",
  "compStatus",
  "compIdea",
  "compAiCopy",
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
  "energyIntel",
  "demoMode",
  "streak",
] as const;

/** Parse + migrate a persisted snapshot. Shared by hydrate and switching. */
function parseSaved(raw: string): Partial<AppState> {
  const saved = JSON.parse(raw);
  // migrate any old-shape contact records to the current schema
  if (Array.isArray(saved.contacts)) saved.contacts = saved.contacts.map(normalizeContact);
  // a snapshot written by an older build can be missing fields newer code
  // reads unconditionally (training.good.length crashed the whole app to a
  // black "Application error" screen) — every nested persisted object is
  // merged over its current defaults so no field is ever undefined
  if (saved.leadTraining && typeof saved.leadTraining === "object") {
    saved.leadTraining = { ...DEFAULT_TRAINING, ...saved.leadTraining };
    if (!Array.isArray(saved.leadTraining.good)) saved.leadTraining.good = [];
    if (!Array.isArray(saved.leadTraining.bad)) saved.leadTraining.bad = [];
    if (!Array.isArray(saved.leadTraining.avoid)) saved.leadTraining.avoid = [];
    if (!Array.isArray(saved.leadTraining.intents)) saved.leadTraining.intents = DEFAULT_TRAINING.intents;
  }
  if (saved.strategy && typeof saved.strategy === "object") {
    saved.strategy = { ...DEFAULT_STRATEGY, ...saved.strategy };
    for (const k of ["territories", "positioning", "platforms", "tone"] as const) {
      if (!Array.isArray(saved.strategy[k])) saved.strategy[k] = DEFAULT_STRATEGY[k];
    }
  }
  for (const k of ["opportunities", "contacts", "sources", "plannedPosts"] as const) {
    if (saved[k] != null && !Array.isArray(saved[k])) delete saved[k];
  }
  // self-heal a profile persisted with no territories (possible via older
  // onboarding builds) — an empty list silently gave the lead engine nothing
  // to search, which looked like "hunt ran, found nothing" with no error
  if (saved.strategy && saved.strategy.territories.length === 0) {
    saved.strategy = { ...saved.strategy, territories: DEFAULT_STRATEGY.territories };
  }
  // a solar profile still carrying the realtor demo's Gilbert farm
  // neighborhoods (Val Vista Lakes etc.) inherited them by accident at
  // workspace creation — every content card and hunt was labeled with a
  // realtor micro-neighborhood. Swap in the solar city territories, but ONLY
  // when it's exactly the demo signature, never a set the user chose.
  if (saved.strategy?.vertical === "solar" && saved.strategy.territories.length) {
    const demoSlugs = new Set(DEFAULT_STRATEGY.territories.map((t) => t.slug));
    const allDemo = saved.strategy.territories.every((t: { slug?: string }) => t.slug && demoSlugs.has(t.slug));
    // second stock signature: the interim Phoenix/Scottsdale/Mesa placeholder
    // defaults — the research showed those are saturated central cities, not
    // solar hot spots. A set the user picked themselves never matches either.
    const placeholderSlugs = new Set(["phoenix", "scottsdale", "mesa"]);
    const allPlaceholder = saved.strategy.territories.every((t: { slug?: string }) => t.slug && placeholderSlugs.has(t.slug));
    if (allDemo || allPlaceholder) {
      saved.strategy = { ...saved.strategy, territories: SOLAR_TERRITORIES };
      // drop stale knowledge-base source suggestions (they were realtor cards
      // for the old territories) so the solar bank reseeds for the new ones —
      // anything the user explicitly added to their rotation is kept
      if (Array.isArray(saved.sources)) {
        saved.sources = saved.sources.filter((s: { origin?: string; status?: string }) => s.origin !== "knowledge-base" || s.status === "added");
      }
    }
  }
  // inbox hygiene: auto-purge engine captures that are provably stale
  // (captured before the recency/age-verification gates existed). Untouched
  // "new" items only — anything the user engaged/watched is theirs to keep.
  if (Array.isArray(saved.opportunities)) {
    saved.opportunities = saved.opportunities.filter((o: { url?: string; postedAgo?: string; extKey?: string; status?: string }) => !isProvablyStaleLead(o));
  }
  return saved;
}

/**
 * Fresh state for the owner's real solar workspace: solar vertical, solar
 * engine training, Instagram-first, and NO demo data — this account exists
 * to scale a real business, so every number starts earned.
 */
function solarSeed(): AppState {
  const v = VERTICALS.solar;
  return {
    ...initialState,
    onboarded: true,
    demoMode: false,
    streak: 0,
    contacts: [],
    plannedPosts: [],
    opportunities: [],
    strategy: {
      ...DEFAULT_STRATEGY,
      vertical: "solar",
      name: "Taylor",
      brokerage: "",
      licenseNo: "",
      homeBase: "Scottsdale",
      territories: SOLAR_TERRITORIES,
      platforms: ["instagram"],
      positioning: ["generalist"],
      idealClient: "both",
    },
    // low auto-add bar: the owner judges lead quality themselves (thumbs
    // train the engine); the machine only screens provable junk
    leadTraining: { ...DEFAULT_TRAINING, guidance: v.defaultGuidance, intents: v.defaultIntents, minScore: 35 },
  };
}

/** Fresh state for a brand-new client the founder is onboarding: not onboarded
    (lands on intake), no demo data, seeded to the chosen vertical's engine. */
function newClientSeed(vertical: "realtor" | "solar"): AppState {
  if (vertical === "solar") return { ...solarSeed(), onboarded: false };
  return { ...initialState };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [workspace, setWorkspace] = useState<ClientId>("default");
  const [clients, setClients] = useState<ClientMeta[]>([]);
  const clientsRef = useRef<ClientMeta[]>([]);
  const workspaceRef = useRef<ClientId>("default");
  const hydrated = useRef(false);
  // cloud pull finished (or skipped) → safe to push. STATE, not a ref, so the
  // push effect re-runs when it flips true and flushes any edit queued during
  // the pull window.
  const [syncReady, setSyncReady] = useState(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragId = useMemo(
    () => ({ current: null as string | null }),
    []
  ) as React.MutableRefObject<string | null>;

  // hydrate the active client's persisted state
  useEffect(() => {
    try {
      const roster = loadClients();
      clientsRef.current = roster;
      setClients(roster);
      const savedActive = localStorage.getItem(WS_ACTIVE_KEY) || "default";
      // never activate a client that isn't in the registry (stale id → default)
      const ws = roster.some((c) => c.id === savedActive) ? savedActive : "default";
      workspaceRef.current = ws;
      setWorkspace(ws);
      setVaultClient(ws);
      setReelVaultClient(ws);
      const raw = localStorage.getItem(persistKeyFor(ws));
      if (raw) {
        setState((s) => ({ ...s, ...parseSaved(raw) }));
      } else if (ws === "solar") {
        setState(solarSeed());
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

  // save on change (persisted fields only) — always to the ACTIVE workspace's
  // key. DEBOUNCED: serializing stAssets (base64 images) is a multi-MB
  // JSON.stringify that froze the main thread on every keystroke — clicks
  // during the freeze silently died ("sticky buttons"). The debounce batches
  // bursts; flushSave() runs synchronously before anything that reads the key
  // (workspace switch, export) and on tab hide, so no edit is ever lost.
  const stateRef = useRef(state);
  stateRef.current = state;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!hydrated.current) return;
    try {
      const out: Record<string, unknown> = {};
      PERSIST_FIELDS.forEach((k) => (out[k] = stateRef.current[k]));
      localStorage.setItem(persistKeyFor(workspaceRef.current), JSON.stringify(out));
    } catch {}
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 350);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.stStudio, state.stAssets, state.compStatus, state.compIdea, state.compAiCopy, state.pexelsKey, state.plannedPosts, state.weekBrief, state.integrations, state.onboarded, state.strategy, state.contacts, state.opportunities, state.sources, state.leadTraining, state.doneActions, state.contentResponses, state.briefs, state.energyIntel, state.demoMode, state.streak]); // eslint-disable-line react-hooks/exhaustive-deps

  // the debounce must never lose the last edit when the tab closes or hides
  useEffect(() => {
    const onHide = () => {
      if (typeof document === "undefined" || document.visibilityState === "hidden") flushSave();
    };
    window.addEventListener("pagehide", flushSave);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushSave);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushSave]);

  // Shared Memory Layer (Supabase) sync — completely inert until the project is
  // configured (memoryConfigured() caches false → both effects no-op, so the app
  // behaves exactly as it does on localStorage today). Pull once per workspace
  // after hydration, then push on change (debounced).
  //
  // Pull is NON-DESTRUCTIVE: mergeById keeps every local record and only adds
  // cloud records this device hasn't seen, so nothing local is ever clobbered.
  useEffect(() => {
    let alive = true;
    setSyncReady(false); // block pushes until this workspace's pull settles
    (async () => {
      if (!(await memoryConfigured())) { if (alive) setSyncReady(true); return; }
      const snap = await pullSnapshot(workspace);
      if (!alive) return;
      if (snap) {
        setState((s) => ({
          ...s,
          contacts: mergeById(s.contacts as Contact[], (snap.contacts as Contact[]) || []),
          opportunities: mergeById(s.opportunities as Opportunity[], (snap.opportunities as Opportunity[]) || []),
          plannedPosts: mergeById(s.plannedPosts as PlannedPost[], (snap.plannedPosts as PlannedPost[]) || []),
        }));
      }
      setSyncReady(true);
    })();
    return () => { alive = false; };
  }, [workspace]);

  // push local arrays up, debounced — only after the pull has settled so we
  // never overwrite the cloud before we've merged from it. syncReady is a dep,
  // so when the pull finishes this re-runs and flushes any edit that landed
  // during the pull window.
  useEffect(() => {
    if (!hydrated.current || !syncReady) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      memoryConfigured().then((ok) => {
        if (!ok) return;
        pushSnapshot(workspaceRef.current, {
          contacts: state.contacts as unknown[],
          opportunities: state.opportunities as unknown[],
          plannedPosts: state.plannedPosts as unknown[],
        });
      });
    }, 2500);
    return () => { if (pushTimer.current) clearTimeout(pushTimer.current); };
  }, [state.contacts, state.opportunities, state.plannedPosts, syncReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // switch between clients: flush the (debounced) save to the CURRENT client's
  // key first, then point the vaults + keys at the target and load (or seed)
  // it. A never-seen client with no saved state seeds by its vertical.
  const switchWorkspace = useCallback((target: ClientId) => {
    if (target === workspaceRef.current) return;
    const meta = clientsRef.current.find((c) => c.id === target);
    if (!meta) return; // guard: never switch to an unregistered client
    flushSave();
    try { localStorage.setItem(WS_ACTIVE_KEY, target); } catch {}
    setVaultClient(target);
    setReelVaultClient(target);
    let next: AppState;
    try {
      const raw = localStorage.getItem(persistKeyFor(target));
      next = raw ? { ...initialState, ...parseSaved(raw) }
        : target === "solar" ? solarSeed() : newClientSeed(meta.vertical || "realtor");
    } catch {
      next = target === "solar" ? solarSeed() : newClientSeed(meta.vertical || "realtor");
    }
    workspaceRef.current = target;
    setWorkspace(target);
    setState(next);
  }, [flushSave]);

  // ——— client roster management (E1) ———
  const persistRoster = useCallback((list: ClientMeta[]) => {
    clientsRef.current = list;
    setClients(list);
    saveClients(list);
  }, []);

  /** Create a new client and switch to it (lands on onboarding for that vertical). */
  const addClient = useCallback((label: string, opts?: { emoji?: string; vertical?: "realtor" | "solar" }): ClientId => {
    flushSave(); // settle the current client's pending save before leaving it
    const vertical = opts?.vertical || "solar"; // solar is the beachhead
    const id = makeClientId(label || "client", clientsRef.current);
    const meta: ClientMeta = { id, label: (label || "New client").slice(0, 60), emoji: opts?.emoji || (vertical === "solar" ? "☀️" : "🏠"), vertical, createdAt: Date.now() };
    persistRoster([...clientsRef.current, meta]);
    // switchWorkspace reads the ref we just set, so the new client is switchable
    try { localStorage.setItem(WS_ACTIVE_KEY, id); } catch {}
    setVaultClient(id);
    setReelVaultClient(id);
    workspaceRef.current = id;
    setWorkspace(id);
    setState(newClientSeed(vertical));
    return id;
  }, [persistRoster, flushSave]);

  const renameClient = useCallback((id: ClientId, label: string, emoji?: string) => {
    persistRoster(clientsRef.current.map((c) => (c.id === id ? { ...c, label: label.slice(0, 60) || c.label, emoji: emoji || c.emoji } : c)));
  }, [persistRoster]);

  /** Remove a client and its data. Seed accounts can't be removed. Switches to
      "default" first if the removed client is active, so nothing renders stale. */
  const removeClient = useCallback((id: ClientId) => {
    if (id === "default" || id === "solar") return;
    if (workspaceRef.current === id) switchWorkspace("default");
    persistRoster(clientsRef.current.filter((c) => c.id !== id));
    void purgeClient(id);
  }, [persistRoster, switchWorkspace]);

  /** Download a client bundle (app state + all vault images) — the backup. */
  const exportClient = useCallback(async (id: ClientId) => {
    const meta = clientsRef.current.find((c) => c.id === id);
    if (!meta) return;
    flushSave(); // the bundle reads localStorage — make sure the latest edit is in it
    const bundle = await exportClientBundle(meta);
    try {
      const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `farmhand-${id}-${new Date(bundle.exportedAt).toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  }, [flushSave]);

  /** Restore a bundle as a NEW client (never overwrites). Returns its id. */
  const importClient = useCallback(async (bundle: ClientBundle): Promise<ClientId | null> => {
    const meta = await importClientBundle(bundle, clientsRef.current);
    if (!meta) return null;
    persistRoster([...clientsRef.current, meta]);
    return meta.id;
  }, [persistRoster]);

  const set = useCallback((patch: Patch) => {
    setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  const copy = useCallback((text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, []);

  const value = useMemo(
    () => ({ state, set, copy, dragId, workspace, switchWorkspace, clients, addClient, renameClient, removeClient, exportClient, importClient }),
    [state, set, copy, dragId, workspace, switchWorkspace, clients, addClient, renameClient, removeClient, exportClient, importClient]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
