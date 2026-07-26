/**
 * Style Genome — the structured reference-video analysis contract.
 *
 * Stage 1 (Gemini extraction) fills this schema; Stage 2 (Claude adaptation)
 * consumes it; Stage 3 (generation handoff) compiles it deterministically into
 * a Higgsfield-ready master prompt and a recreation brief. STYLE lives here;
 * TOPIC lives only in beatMap.dialogueOrText / scriptStructure (the record of
 * what the reference SAID — the replace side of preserveVsReplace).
 *
 * Everything in this module is pure and isomorphic (server + client): the
 * sanitizer guards the vault, the builders guard the generators, and the
 * quality checks guard the output.
 */

/* ------------------------------------------------------------------ */
/* schema                                                              */
/* ------------------------------------------------------------------ */

export interface BeatMapEntry {
  startTime?: string;
  endTime?: string;
  visuals?: string;
  dialogueOrText?: string;
  purpose?: string;
  /** 1 (calm) – 5 (max intensity) */
  energyLevel?: number;
  framing?: string;
  editPattern?: string;
}

export interface ReferenceVideoAnalysis {
  overview?: {
    formulaSummary?: string;
    primaryStyleCategory?: string;
    confidenceNotes?: string[];
  };
  beatMap?: BeatMapEntry[];
  hookAnalysis?: {
    hookType?: string;
    firstThreeSecondMechanics?: string;
    retentionDrivers?: string[];
    emotionalPromise?: string;
    openingVisualChange?: string;
    openingTextPattern?: string;
  };
  scriptStructure?: {
    hook?: string;
    setup?: string;
    problem?: string;
    reframe?: string;
    valueDelivery?: string;
    proof?: string;
    cta?: string;
    transitionLogic?: string;
  };
  styleAnalysis?: {
    vibe?: string[];
    pacing?: string;
    tone?: string;
    confidenceStyle?: string;
    emotionalEffect?: string[];
    formatIdentity?: string;
  };
  visualLanguage?: {
    shotTypes?: string[];
    cameraMovement?: string[];
    subjectDistance?: string[];
    composition?: string[];
    lighting?: string[];
    colorPalette?: string[];
    wardrobeOrProps?: string[];
    backgroundStyle?: string[];
    textOverlayStyle?: string;
    bRollStyle?: string;
    transitions?: string[];
  };
  editingSystem?: {
    averageShotDuration?: string;
    cutFrequency?: string;
    cutMotivation?: string[];
    captionStyle?: string;
    textDensity?: string;
    soundDesignRole?: string;
    musicRole?: string;
    patternInterrupts?: string[];
    loopMechanics?: string;
  };
  persuasionSystem?: {
    believabilityDrivers?: string[];
    premiumSignals?: string[];
    shareabilityDrivers?: string[];
    saveWorthyDrivers?: string[];
    authoritySignals?: string[];
    psychologicalMechanics?: string[];
  };
  reusableStyleRules?: string[];
  preserveVsReplace?: {
    preserve?: string[];
    replace?: string[];
  };
  recreationBrief?: {
    desiredAesthetic?: string;
    shotRhythm?: string;
    scriptRhythm?: string;
    editingRhythm?: string;
    deliveryStyle?: string;
    viewerFeeling?: string;
    nonNegotiables?: string[];
    avoid?: string[];
  };
}

/* ------------------------------------------------------------------ */
/* sanitizer — Gemini's JSON goes straight into the vault and the      */
/* renderer; a malformed field must never crash a saved card           */
/* ------------------------------------------------------------------ */

const s = (v: unknown, n = 600): string | undefined => {
  const out = typeof v === "string" ? v.trim().slice(0, n) : "";
  return out || undefined;
};
const sa = (v: unknown, cap = 12, n = 400): string[] | undefined => {
  const out = (Array.isArray(v) ? v : [])
    .filter((x): x is string => typeof x === "string" && !!x.trim())
    .map((x) => x.trim().slice(0, n))
    .slice(0, cap);
  return out.length ? out : undefined;
};
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
/** Drop sections that came back entirely empty. */
const prune = <T extends Record<string, unknown>>(o: T): T | undefined =>
  Object.values(o).some((v) => v !== undefined) ? o : undefined;

export function sanitizeGenome(raw: unknown): ReferenceVideoAnalysis | null {
  const g = obj(raw);
  if (!Object.keys(g).length) return null;
  const ov = obj(g.overview);
  const hk = obj(g.hookAnalysis);
  const sc = obj(g.scriptStructure);
  const st = obj(g.styleAnalysis);
  const vl = obj(g.visualLanguage);
  const ed = obj(g.editingSystem);
  const pe = obj(g.persuasionSystem);
  const pr = obj(g.preserveVsReplace);
  const rb = obj(g.recreationBrief);
  const out: ReferenceVideoAnalysis = {
    overview: prune({
      formulaSummary: s(ov.formulaSummary),
      primaryStyleCategory: s(ov.primaryStyleCategory, 120),
      confidenceNotes: sa(ov.confidenceNotes, 6),
    }),
    beatMap: (Array.isArray(g.beatMap) ? g.beatMap : [])
      .map((b): BeatMapEntry | undefined => {
        const r = obj(b);
        const lvl = Number(r.energyLevel);
        const entry: BeatMapEntry = {
          startTime: s(r.startTime, 12),
          endTime: s(r.endTime, 12),
          visuals: s(r.visuals),
          dialogueOrText: s(r.dialogueOrText),
          purpose: s(r.purpose, 200),
          energyLevel: Number.isFinite(lvl) ? Math.min(5, Math.max(1, Math.round(lvl))) : undefined,
          framing: s(r.framing, 200),
          editPattern: s(r.editPattern, 200),
        };
        return prune(entry as Record<string, unknown>) ? entry : undefined;
      })
      .filter((b): b is BeatMapEntry => !!b)
      .slice(0, 24),
    hookAnalysis: prune({
      hookType: s(hk.hookType, 120),
      firstThreeSecondMechanics: s(hk.firstThreeSecondMechanics),
      retentionDrivers: sa(hk.retentionDrivers, 8),
      emotionalPromise: s(hk.emotionalPromise, 300),
      openingVisualChange: s(hk.openingVisualChange, 300),
      openingTextPattern: s(hk.openingTextPattern, 300),
    }),
    scriptStructure: prune({
      hook: s(sc.hook),
      setup: s(sc.setup),
      problem: s(sc.problem),
      reframe: s(sc.reframe),
      valueDelivery: s(sc.valueDelivery),
      proof: s(sc.proof),
      cta: s(sc.cta),
      transitionLogic: s(sc.transitionLogic),
    }),
    styleAnalysis: prune({
      vibe: sa(st.vibe, 8, 80),
      pacing: s(st.pacing, 300),
      tone: s(st.tone, 200),
      confidenceStyle: s(st.confidenceStyle, 200),
      emotionalEffect: sa(st.emotionalEffect, 8, 120),
      formatIdentity: s(st.formatIdentity, 200),
    }),
    visualLanguage: prune({
      shotTypes: sa(vl.shotTypes, 10, 120),
      cameraMovement: sa(vl.cameraMovement, 10, 120),
      subjectDistance: sa(vl.subjectDistance, 6, 80),
      composition: sa(vl.composition, 8, 160),
      lighting: sa(vl.lighting, 8, 160),
      colorPalette: sa(vl.colorPalette, 10, 120),
      wardrobeOrProps: sa(vl.wardrobeOrProps, 10, 160),
      backgroundStyle: sa(vl.backgroundStyle, 8, 160),
      textOverlayStyle: s(vl.textOverlayStyle, 400),
      bRollStyle: s(vl.bRollStyle, 400),
      transitions: sa(vl.transitions, 8, 120),
    }),
    editingSystem: prune({
      averageShotDuration: s(ed.averageShotDuration, 80),
      cutFrequency: s(ed.cutFrequency, 160),
      cutMotivation: sa(ed.cutMotivation, 8, 160),
      captionStyle: s(ed.captionStyle, 400),
      textDensity: s(ed.textDensity, 160),
      soundDesignRole: s(ed.soundDesignRole, 300),
      musicRole: s(ed.musicRole, 300),
      patternInterrupts: sa(ed.patternInterrupts, 8, 200),
      loopMechanics: s(ed.loopMechanics, 300),
    }),
    persuasionSystem: prune({
      believabilityDrivers: sa(pe.believabilityDrivers, 8),
      premiumSignals: sa(pe.premiumSignals, 8),
      shareabilityDrivers: sa(pe.shareabilityDrivers, 8),
      saveWorthyDrivers: sa(pe.saveWorthyDrivers, 8),
      authoritySignals: sa(pe.authoritySignals, 8),
      psychologicalMechanics: sa(pe.psychologicalMechanics, 8),
    }),
    reusableStyleRules: sa(g.reusableStyleRules, 16),
    preserveVsReplace: prune({
      preserve: sa(pr.preserve, 14),
      replace: sa(pr.replace, 14),
    }),
    recreationBrief: prune({
      desiredAesthetic: s(rb.desiredAesthetic),
      shotRhythm: s(rb.shotRhythm, 300),
      scriptRhythm: s(rb.scriptRhythm, 300),
      editingRhythm: s(rb.editingRhythm, 300),
      deliveryStyle: s(rb.deliveryStyle, 300),
      viewerFeeling: s(rb.viewerFeeling, 300),
      nonNegotiables: sa(rb.nonNegotiables, 10),
      avoid: sa(rb.avoid, 10),
    }),
  };
  // strip the undefined sections so JSON.stringify stays compact
  (Object.keys(out) as (keyof ReferenceVideoAnalysis)[]).forEach((k) => {
    if (out[k] === undefined || (Array.isArray(out[k]) && !(out[k] as unknown[]).length)) delete out[k];
  });
  return Object.keys(out).length ? out : null;
}

/** Compact JSON for prompt embedding — hard cap so a chatty extraction can
    never blow the adaptation prompt's budget. */
export function genomeJson(g: ReferenceVideoAnalysis, cap = 12000): string {
  const full = JSON.stringify(g);
  if (full.length <= cap) return full;
  // beat visuals are the bulkiest fields — shed them first, keep the systems
  const slim = { ...g, beatMap: (g.beatMap || []).map((b) => ({ ...b, visuals: (b.visuals || "").slice(0, 120) })) };
  return JSON.stringify(slim).slice(0, cap);
}

/* ------------------------------------------------------------------ */
/* stage-3 handoff — deterministic compilation, no model in the loop   */
/* ------------------------------------------------------------------ */

const joinList = (v?: string[]) => (v && v.length ? v.join(", ") : "");

/** The standing avoid-list every handoff prompt carries (matches the brain
    vault's Higgsfield playbook negative clause). */
export const STANDARD_AVOID =
  "on-screen text, captions, logos, watermarks, deformed hands, extra fingers, warped geometry, plastic skin, over-saturation, unrealistic lens flare, AI-float motion";

/** Compile the genome (+ optional subject/environment override) into the
    Higgsfield-ready master prompt: one labeled block per field the generator
    needs. Pure string assembly — same genome in, same prompt out. */
export function buildHiggsfieldPrompt(
  g: ReferenceVideoAnalysis,
  opts?: { subject?: string; environment?: string }
): string {
  const vl = g.visualLanguage || {};
  const ed = g.editingSystem || {};
  const st = g.styleAnalysis || {};
  const rb = g.recreationBrief || {};
  const lines: Array<[string, string]> = [
    ["SUBJECT", opts?.subject || joinList(vl.wardrobeOrProps) || "the recurring on-screen subject of the adapted script"],
    ["ENVIRONMENT", opts?.environment || joinList(vl.backgroundStyle)],
    [
      "CAMERA LANGUAGE",
      [joinList(vl.shotTypes), joinList(vl.subjectDistance), joinList(vl.composition)].filter(Boolean).join(" · "),
    ],
    ["MOTION", joinList(vl.cameraMovement)],
    ["LIGHTING", joinList(vl.lighting)],
    ["COLOR PALETTE", joinList(vl.colorPalette)],
    ["REALISM / STYLIZATION", [st.formatIdentity, rb.desiredAesthetic].filter(Boolean).join(" — ")],
    [
      "EDIT FEEL",
      [ed.averageShotDuration && `avg shot ${ed.averageShotDuration}`, ed.cutFrequency, rb.editingRhythm]
        .filter(Boolean)
        .join(" · "),
    ],
    ["MOOD", [joinList(st.vibe), rb.viewerFeeling].filter(Boolean).join(" — ")],
    ["AVOID", [joinList(rb.avoid), STANDARD_AVOID].filter(Boolean).join(", ")],
  ];
  const body = lines
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return `9:16 vertical video, single continuous style system.\n${body}`;
}

/** Concise recreation brief for ANY downstream generator or editor — the
    style contract in prose, no topic content. */
export function recreationBriefText(g: ReferenceVideoAnalysis): string {
  const rb = g.recreationBrief || {};
  const rows: Array<[string, string | undefined]> = [
    ["Formula", g.overview?.formulaSummary],
    ["Aesthetic", rb.desiredAesthetic],
    ["Shot rhythm", rb.shotRhythm],
    ["Script rhythm", rb.scriptRhythm],
    ["Editing rhythm", rb.editingRhythm],
    ["Delivery", rb.deliveryStyle],
    ["Viewer should feel", rb.viewerFeeling],
    ["Non-negotiables", joinList(rb.nonNegotiables) || undefined],
    ["Avoid", joinList(rb.avoid) || undefined],
  ];
  return rows
    .filter((r): r is [string, string] => !!r[1])
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* quality controls — flags, not silent failure                        */
/* ------------------------------------------------------------------ */

export interface QualityFlag {
  code: "weak-hook" | "generic" | "too-close" | "no-proof" | "thin";
  level: "warn" | "block";
  note: string;
}

type RemakeLike = {
  hookLine?: string;
  cta?: string;
  beats?: Array<{ say?: string; visualDetail?: string; genPrompt?: string; onScreenText?: string }>;
};

const VAGUE = [
  "engaging",
  "dynamic",
  "stunning",
  "eye-catching",
  "compelling",
  "captivating",
  "high quality",
  "amazing",
  "beautiful shot",
  "cinematic vibes",
  "visually appealing",
];
const GREETING = /^\s*["“]?\s*(hey|hi|hello|what's up|whats up|welcome|good (morning|afternoon|evening))\b/i;

const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Every n-word run in the text, for verbatim-overlap detection. */
function shingles(text: string, n: number): Set<string> {
  const w = norm(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

/** Originality + specificity gate on an adapted script. `referenceText` is
    everything the reference actually said/showed (transcript + beat
    dialogue); `facts` are the verified numbers the script was given. */
export function qualityCheck(
  remake: RemakeLike,
  opts: { referenceText?: string; facts?: string[] } = {}
): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const beats = remake.beats || [];
  const says = beats.map((b) => b.say || "").filter(Boolean);
  const allSay = [remake.hookLine || "", ...says, remake.cta || ""].join(" ");

  // a real hook: present, cold, no self-introduction
  const hook = remake.hookLine || says[0] || "";
  if (!hook.trim()) flags.push({ code: "weak-hook", level: "block", note: "No hook line at all — the first 2 seconds are empty." });
  else if (GREETING.test(hook) || /\btoday (i|we)('m|'re| am| are| will| want)?\b/i.test(hook))
    flags.push({ code: "weak-hook", level: "warn", note: `Hook opens with a greeting/wind-up ("${hook.slice(0, 40)}…") — start mid-argument instead.` });

  // thin structure
  if (beats.length && beats.length < 3)
    flags.push({ code: "thin", level: "warn", note: `Only ${beats.length} beat(s) — the reference's structure needs more shots to reproduce.` });

  // generic production language in the fields that feed the generator
  const genText = beats.map((b) => `${b.visualDetail || ""} ${b.genPrompt || ""}`).join(" ").toLowerCase();
  const vagueHits = VAGUE.filter((v) => genText.includes(v));
  if (vagueHits.length >= 2)
    flags.push({ code: "generic", level: "warn", note: `Generation prompts lean on vague words (${vagueHits.slice(0, 4).join(", ")}) — they carry no visual information.` });

  // too close to the reference: any 6-word verbatim run is copied wording
  if (opts.referenceText) {
    const ref = shingles(opts.referenceText, 6);
    if (ref.size) {
      const own = shingles(allSay, 6);
      let hits = 0;
      own.forEach((sh) => {
        if (ref.has(sh)) hits++;
      });
      if (hits > 0)
        flags.push({
          code: "too-close",
          level: hits > 3 ? "block" : "warn",
          note: `${hits} phrase(s) of 6+ words copied verbatim from the reference — style can be reused, wording cannot.`,
        });
    }
  }

  // proof/specificity: given verified numbers, the script must use at least one
  if ((opts.facts || []).some((f) => /\d/.test(f)) && !/\d/.test(allSay))
    flags.push({ code: "no-proof", level: "warn", note: "Verified facts with numbers were provided but no number made it into the script — the proof beat is empty." });

  return flags;
}
