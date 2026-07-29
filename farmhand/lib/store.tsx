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
import { isOutOfMarket } from "./azTerritories";
import { DEFAULT_STRATEGY, SOLAR_TERRITORIES, type Idea, type StrategyProfile } from "./strategy";
import { normalizeContact, SEED_CONTACTS, type Contact } from "./pipeline";
import { tagOpportunity, type Opportunity } from "./engage";
import type { SourceEntry } from "./sources";
import { DEFAULT_TRAINING, isProvablyStaleLead, type LeadTraining } from "./hunt";
import { VERTICALS } from "./verticals";
import { memoryConfigured, pullSnapshot, pushSnapshot, mergeById } from "./memorySync";
import { setVaultClient } from "./vault";
import { setRefClient, refPutMany, refGetMany, refPrune, type ImageRef } from "./imageRefs";
import { setReelVaultClient } from "./reelVault";
import { setClipVaultClient } from "./clipVault";
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
  contentTab: "ideas" | "studio" | "week" | "queue" | "reels" | "news";
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

/* ------------------------------------------------------------------ */
/* base64 OUT of the localStorage snapshot                             */
/* ------------------------------------------------------------------ */
/**
 * `stAssets[].dataURL` and `stStudio[ch].slideBg[n].img` are full-size
 * base64 JPEGs (~400-940KB of UTF-16 heap each). They used to be serialized
 * into the snapshot, which meant `JSON.stringify` over 15-35MB plus a
 * SYNCHRONOUS `localStorage.setItem` every 350ms of use — the Chrome freeze
 * that got progressively worse the more images were banked, and which blew
 * the ~5MB origin quota so nothing persisted at all.
 *
 * Now the snapshot carries `idbref:<id>` and the bytes live in IndexedDB.
 * In-memory state is untouched — it still holds real dataURLs, so every
 * component renders exactly as before.
 */
const REF = "idbref:";
const isDataUrl = (v: unknown): v is string => typeof v === "string" && v.startsWith("data:");
const isRefUrl = (v: unknown): v is string => typeof v === "string" && v.startsWith(REF);

/** Ref id per LIVE OBJECT, not per string: a WeakMap can't pin a dropped
    image in memory the way a `Map<dataURL, id>` would, and object identity
    is stable across saves so an unchanged image keeps one id. */
const refIdOf = new WeakMap<object, string>();
let refSeq = 0;

interface DehydrateCtx {
  /** refs minted this pass — the only ones that need writing */
  writes: ImageRef[];
  /** the objects those ids were minted for, so a FAILED write can un-register
      them and the next save retries instead of stranding the image */
  owners: object[];
  /** every id the snapshot still points at — the prune keep-set */
  keep: Set<string>;
}
const newCtx = (): DehydrateCtx => ({ writes: [], owners: [], keep: new Set() });

function refIdFor(owner: object, data: string, ctx: DehydrateCtx): string {
  let id = refIdOf.get(owner);
  if (!id) {
    id = `r${Date.now().toString(36)}${(refSeq++).toString(36)}`;
    refIdOf.set(owner, id);
    ctx.writes.push({ id, data }); // unchanged images are never rewritten
    ctx.owners.push(owner);
  }
  return id;
}

function dehydrateBg(bg: Bg | null | undefined, ctx: DehydrateCtx): Bg | null | undefined {
  if (!bg || bg.type !== "image") return bg;
  if (isRefUrl(bg.img)) {
    ctx.keep.add(bg.img.slice(REF.length));
    return bg;
  }
  if (!isDataUrl(bg.img)) return bg; // http/blob url — cheap, leave it inline
  const id = refIdFor(bg, bg.img, ctx);
  ctx.keep.add(id);
  return { type: "image", img: REF + id };
}

/** Swap every dataURL in the outgoing snapshot for a marker. Mutates `out`
    (a shallow copy built for persistence), never live state. */
function dehydrateImages(out: Record<string, unknown>, ctx: DehydrateCtx) {
  const assets = out.stAssets;
  if (Array.isArray(assets)) {
    out.stAssets = (assets as Asset[]).map((a) => {
      if (!a) return a;
      if (isRefUrl(a.dataURL)) {
        ctx.keep.add(a.dataURL.slice(REF.length));
        return a;
      }
      if (!isDataUrl(a.dataURL)) return a;
      const id = refIdFor(a, a.dataURL, ctx);
      ctx.keep.add(id);
      return { ...a, dataURL: REF + id };
    });
  }
  const studio = out.stStudio;
  if (studio && typeof studio === "object") {
    const next: Record<string, ChannelStudio> = {};
    for (const [ch, cs] of Object.entries(studio as Record<string, ChannelStudio>)) {
      if (!cs) continue;
      const slideBg: Record<number, Bg> = {};
      for (const [k, bg] of Object.entries(cs.slideBg || {})) {
        const d = dehydrateBg(bg, ctx);
        if (d) slideBg[Number(k)] = d;
      }
      next[ch] = { ...cs, slideBg, coverBg: dehydrateBg(cs.coverBg, ctx) ?? null };
    }
    out.stStudio = next;
  }
}

/**
 * Ids the LIVE state already owns — read-only, it must never mint.
 *
 * The prune keep-set has to be built with this rather than by re-running
 * dehydrateImages: dehydrate mints an id for any image added since the last
 * save, which would register it in the WeakMap without writing it, and the
 * next save would then see a WeakMap hit, skip the write, and persist a
 * marker pointing at bytes that were never stored. That loses the image.
 */
function collectLiveRefIds(s: Pick<AppState, "stAssets" | "stStudio">): Set<string> {
  const ids = new Set<string>();
  const take = (owner: object | null | undefined, url: unknown) => {
    if (isRefUrl(url)) ids.add(url.slice(REF.length));
    else if (owner) {
      const id = refIdOf.get(owner);
      if (id) ids.add(id);
    }
  };
  (s.stAssets || []).forEach((a) => a && take(a, a.dataURL));
  Object.values(s.stStudio || {}).forEach((cs) => {
    if (!cs) return;
    [...Object.values(cs.slideBg || {}), cs.coverBg].forEach((bg) => {
      if (bg && bg.type === "image") take(bg, bg.img);
    });
  });
  return ids;
}

/** Every ref id a parsed snapshot points at. */
function collectRefIds(s: Partial<AppState>): string[] {
  const ids = new Set<string>();
  (s.stAssets || []).forEach((a) => {
    if (a && isRefUrl(a.dataURL)) ids.add(a.dataURL.slice(REF.length));
  });
  Object.values(s.stStudio || {}).forEach((cs) => {
    if (!cs) return;
    const bgs: (Bg | null | undefined)[] = [...Object.values(cs.slideBg || {}), cs.coverBg];
    bgs.forEach((bg) => {
      if (bg && bg.type === "image" && isRefUrl(bg.img)) ids.add(bg.img.slice(REF.length));
    });
  });
  return [...ids];
}

/** Put the real bytes back on the in-memory state. An id that no longer
    resolves (pruned, or a DB wiped by the browser) drops the image rather
    than rendering a broken `idbref:` marker. Re-registers each resolved
    object so the next save reuses the same id instead of duplicating it. */
function applyRefs(s: Partial<AppState>, map: Record<string, string>): Partial<AppState> {
  const out: Partial<AppState> = {};
  if (s.stAssets) {
    out.stAssets = s.stAssets
      .map((a) => {
        if (!a || !isRefUrl(a.dataURL)) return a;
        const data = map[a.dataURL.slice(REF.length)];
        if (!data) return null;
        const next = { ...a, dataURL: data };
        refIdOf.set(next, a.dataURL.slice(REF.length));
        return next;
      })
      .filter(Boolean) as Asset[];
  }
  if (s.stStudio) {
    const studio: Record<string, ChannelStudio> = {};
    const fix = (bg: Bg | null | undefined): Bg | null | undefined => {
      if (!bg || bg.type !== "image" || !isRefUrl(bg.img)) return bg;
      const id = bg.img.slice(REF.length);
      const data = map[id];
      if (!data) return undefined; // unresolvable → fall back to the default bg
      const next: Bg = { type: "image", img: data };
      refIdOf.set(next, id);
      return next;
    };
    for (const [ch, cs] of Object.entries(s.stStudio)) {
      if (!cs) continue;
      const slideBg: Record<number, Bg> = {};
      for (const [k, bg] of Object.entries(cs.slideBg || {})) {
        const f = fix(bg);
        if (f) slideBg[Number(k)] = f;
      }
      studio[ch] = { ...cs, slideBg, coverBg: fix(cs.coverBg) ?? null };
    }
    out.stStudio = studio;
  }
  return out;
}

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
    // APS-only pivot (Jul 2026): SRP / East Valley / ED2-ED3 territories are
    // out of market — "doesn't pencil" — so strip any a profile still carries
    // (picked before the catalog was cut) and their knowledge-base sources.
    // Falls back to the solar defaults if the whole set was out of market.
    const inMarket = saved.strategy.territories.filter((t: { slug?: string; name?: string; city?: string; utility?: string }) => !isOutOfMarket(t));
    if (inMarket.length !== saved.strategy.territories.length) {
      saved.strategy = { ...saved.strategy, territories: inMarket.length ? inMarket : SOLAR_TERRITORIES };
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

  /** Put the real image bytes back on state after a snapshot loads. Async by
      construction (IndexedDB) — the app renders immediately with everything
      else and images fill in a tick later, which is the trade that got the
      megabytes off the synchronous save path. */
  const resolveRefs = useCallback((parsed: Partial<AppState>, client: string) => {
    const ids = collectRefIds(parsed);
    if (!ids.length) return;
    refGetMany(ids, client)
      .then((map) => {
        if (workspaceRef.current !== client) return; // switched away mid-read
        setState((s) => ({ ...s, ...applyRefs(s, map) }));
      })
      .catch(() => {});
  }, []);

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
      setRefClient(ws);
      setReelVaultClient(ws);
      setClipVaultClient(ws);
      const raw = localStorage.getItem(persistKeyFor(ws));
      if (raw) {
        const parsed = parseSaved(raw);
        setState((s) => ({ ...s, ...parsed }));
        resolveRefs(parsed, ws);
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
    // pin the client for this pass: a workspace switch calls flushSave() and
    // THEN repoints the ref store, so the async writes below must carry the
    // client they were computed for or they land in the wrong DB
    const client = workspaceRef.current;
    const ctx = newCtx();
    try {
      const out: Record<string, unknown> = {};
      PERSIST_FIELDS.forEach((k) => (out[k] = stateRef.current[k]));
      dehydrateImages(out, ctx);
      localStorage.setItem(persistKeyFor(client), JSON.stringify(out));
    } catch (e) {
      // NEVER swallow this silently again: a full quota means the user's work
      // stopped being saved, and the old bare `catch {}` hid that completely.
      const name = e instanceof DOMException ? e.name : "";
      if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
        console.error("[farmhand] localStorage is full — this workspace's latest changes were NOT saved.");
      } else {
        console.error("[farmhand] save failed", e);
      }
    }
    // bytes go to IndexedDB out-of-band. Not awaited: the 350ms debounce runs
    // long before any unload, so a queued write has ample time to land, and a
    // lost write costs one image rather than blocking the main thread.
    if (ctx.writes.length) {
      refPutMany(ctx.writes, client)
        .then((ok) => {
          // a failed write would strand the snapshot pointing at a ref that
          // doesn't exist — forget the ids so the next save mints and retries
          if (!ok) {
            console.error("[farmhand] couldn't bank image data — retrying on the next save");
            ctx.owners.forEach((o) => refIdOf.delete(o));
          }
        })
        .catch(() => ctx.owners.forEach((o) => refIdOf.delete(o)));
    }
    schedulePrune.current(client);
  }, []);

  /** Reclaim refs the live snapshot no longer points at, so deleting an image
      actually frees its bytes. Deferred, and the keep-set is recomputed from
      CURRENT state at fire time — that is what keeps it from racing a write
      that is still in flight. Held in a ref so flushSave (defined above it)
      can call it without a declaration-order dance. */
  const pruneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePrune = useRef((client: string) => {
    if (pruneTimer.current) clearTimeout(pruneTimer.current);
    pruneTimer.current = setTimeout(() => {
      if (workspaceRef.current !== client) return; // switched away — leave it alone
      refPrune(collectLiveRefIds(stateRef.current), client).catch(() => {});
    }, 8000);
  });
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
    setRefClient(target);
    setReelVaultClient(target);
    setClipVaultClient(target);
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
    resolveRefs(next, target);
  }, [flushSave, resolveRefs]);

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
    setRefClient(id);
    setReelVaultClient(id);
    setClipVaultClient(id);
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
