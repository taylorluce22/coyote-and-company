"use client";

import { useEffect, useState } from "react";
import { cleanSlate, useStore } from "@/lib/store";
import {
  AZ_AREAS,
  DEFAULT_STRATEGY,
  PLATFORM_OPTS,
  POSITIONING_OPTS,
  TONE_CHIPS,
  type StrategyProfile,
  type Territory,
} from "@/lib/strategy";

/**
 * The strategy intake. Six steps, every question shows why we ask,
 * ends with a "Building your OS" transition. Re-runnable from Settings.
 */

const STEP_TITLES = [
  "You & your market",
  "Your territory",
  "Your positioning",
  "Your voice",
  "How you prospect",
  "Goals & cadence",
];

function Why({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: "#77758C", marginTop: 5, lineHeight: 1.45 }}>
      <span style={{ color: "#C9A8FF", fontWeight: 700 }}>why we ask · </span>
      {children}
    </div>
  );
}

function Q({ label, children, why }: { label: string; children: React.ReactNode; why: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F3F8", marginBottom: 9 }}>{label}</div>
      {children}
      <Why>{why}</Why>
    </div>
  );
}

function Chip({ on, color, onClick, children }: { on: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: on ? `${color}1F` : "rgba(255,255,255,0.04)",
        color: on ? color : "#A6A4B8",
        border: `1px solid ${on ? color + "77" : "rgba(255,255,255,0.11)"}`,
        borderRadius: 999,
        padding: "8px 15px",
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        fontSize: 13.5,
        color: "#F4F3F8",
        background: "rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: "11px 13px",
        outline: "none",
      }}
    />
  );
}

const CHECKLIST = (p: StrategyProfile) => [
  `${p.territories.length} territories on your watchlist`,
  `${p.territories.filter((t) => t.segment === "luxury").length ? "Luxury" : "Growth"}-weighted content themes loaded`,
  `${p.prospectingMode === "observer" ? "Reading-first" : p.prospectingMode === "connector" ? "Connector" : "Participant"} engagement pace set`,
  `${p.postingTarget}-post week planned in your voice`,
  "Suggested communities mapped to your farm",
  "Example data cleared — every number from here on is real",
];

export default function Onboarding() {
  const { set } = useStore();
  const [step, setStep] = useState(0);
  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState(0);
  const [p, setP] = useState<StrategyProfile>({ ...DEFAULT_STRATEGY, territories: [], positioning: [], tone: [], platforms: [] });

  const patch = (u: Partial<StrategyProfile>) => setP((s) => ({ ...s, ...u }));
  const toggle = (key: "positioning" | "tone" | "platforms", val: string, max = 99) =>
    setP((s) => {
      const list = s[key] as string[];
      const next = list.includes(val) ? list.filter((x) => x !== val) : list.length >= max ? list : [...list, val];
      return { ...s, [key]: next };
    });

  const toggleTerritory = (slug: string) =>
    setP((s) => {
      const has = s.territories.find((t) => t.slug === slug);
      if (has) return { ...s, territories: s.territories.filter((t) => t.slug !== slug) };
      if (s.territories.length >= 6) return s;
      const area = AZ_AREAS.find((a) => a.slug === slug)!;
      return { ...s, territories: [...s.territories, { ...area, status: "building" as const }] };
    });

  const setTerritoryStatus = (slug: string, status: Territory["status"]) =>
    setP((s) => ({ ...s, territories: s.territories.map((t) => (t.slug === slug ? { ...t, status } : t)) }));

  const finish = () => {
    const finalP: StrategyProfile = {
      ...p,
      territories: p.territories.length ? p.territories : DEFAULT_STRATEGY.territories,
      positioning: p.positioning.length ? p.positioning : ["growth"],
      tone: p.tone.length ? p.tone : DEFAULT_STRATEGY.tone,
      platforms: p.platforms.length ? p.platforms : DEFAULT_STRATEGY.platforms,
    };
    setP(finalP);
    setBuilding(true);
  };

  // "Building your OS" sequence
  useEffect(() => {
    if (!building) return;
    if (built >= CHECKLIST(p).length) {
      const t = setTimeout(() => set({ ...cleanSlate(), onboarded: true, strategy: p, tab: "today" }), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setBuilt((b) => b + 1), 620);
    return () => clearTimeout(t);
  }, [building, built]); // eslint-disable-line react-hooks/exhaustive-deps

  const canNext =
    step === 0 ? p.name.trim().length > 0 :
    step === 1 ? p.territories.length >= 1 :
    step === 2 ? p.positioning.length >= 1 :
    step === 3 ? p.tone.length >= 1 :
    true;

  if (building) {
    const items = CHECKLIST(p);
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "radial-gradient(900px 600px at 50% 20%, #171332, #06060D 70%)" }}>
        <div style={{ width: 440, maxWidth: "90vw" }}>
          <div className="fh-kicker" style={{ fontSize: 10, color: "#C9A8FF" }}>Farmhand</div>
          <div className="fh-title fh-shimmer-text" style={{ fontSize: 30, marginTop: 6, marginBottom: 24 }}>
            Building your OS…
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {items.map((line, i) => (
              <div key={line} style={{ display: "flex", alignItems: "center", gap: 11, opacity: i < built ? 1 : 0.22, transition: "opacity 0.4s", fontSize: 13.5, color: "#D8D6E6" }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, color: i < built ? "#0A0A14" : "#4A4860", background: i < built ? "#41D98A" : "rgba(255,255,255,0.06)", transition: "all 0.3s" }}>
                  ✓
                </span>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, overflowY: "auto", background: "radial-gradient(1100px 700px at 50% -10%, #171332, #06060D 65%)" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* header */}
        <div style={{ marginBottom: 28 }}>
          <div className="fh-kicker" style={{ fontSize: 10, color: "#C9A8FF" }}>Farmhand · strategy session</div>
          <div className="fh-title" style={{ fontSize: 27, marginTop: 5 }}>
            {step === 0 ? "This isn't a signup form." : STEP_TITLES[step]}
          </div>
          {step === 0 && (
            <div style={{ fontSize: 13.5, color: "#A6A4B8", marginTop: 8, lineHeight: 1.6 }}>
              Six short steps, about 4 minutes. Every answer changes what your dashboard becomes — territory, content
              themes, engagement pace, all of it. You can re-run this anytime from Settings.
            </div>
          )}
          {/* progress */}
          <div style={{ display: "flex", gap: 5, marginTop: 18 }}>
            {STEP_TITLES.map((t, i) => (
              <div key={t} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? "#A855F7" : "rgba(255,255,255,0.09)", transition: "background 0.3s" }} />
            ))}
          </div>
        </div>

        <div className="fh-glass" style={{ borderRadius: 18, padding: "26px 26px 18px" }}>
          {step === 0 && (
            <>
              <Q label="Your name" why="it goes on everything we draft for you.">
                <TextInput value={p.name} onChange={(v) => patch({ name: v })} placeholder="Jess Rivera" />
              </Q>
              <Q label="Brokerage & license #" why="compliance footer on every generated post — set once, never think about it again.">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <TextInput value={p.brokerage} onChange={(v) => patch({ brokerage: v })} placeholder="Desert Sky Realty" />
                  <TextInput value={p.licenseNo} onChange={(v) => patch({ licenseNo: v })} placeholder="AZ-SA-0000000" />
                </div>
              </Q>
              <Q label="How long have you been in the business?" why="newer agents get credibility-building content weighted up; established agents get authority and market-report angles.">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {([["new", "Just getting started"], ["building", "2–7 years"], ["established", "Established"]] as const).map(([k, l]) => (
                    <Chip key={k} on={p.experience === k} color="#A855F7" onClick={() => patch({ experience: k })}>{l}</Chip>
                  ))}
                </div>
              </Q>
              <Q label="Home base" why="anchors your market pulse and drive-time framing.">
                <TextInput value={p.homeBase} onChange={(v) => patch({ homeBase: v })} placeholder="Gilbert, AZ" />
              </Q>
            </>
          )}

          {step === 1 && (
            <>
              <Q label="Pick your farm — the 2–6 areas you want to own" why="this is the spine of the whole app: content, conversations, market signals and leads all hang off these areas.">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 9 }}>
                  {AZ_AREAS.map((a) => {
                    const on = !!p.territories.find((t) => t.slug === a.slug);
                    return (
                      <button
                        key={a.slug}
                        onClick={() => toggleTerritory(a.slug)}
                        style={{
                          textAlign: "left",
                          background: on ? `${a.hex}1C` : "rgba(255,255,255,0.035)",
                          border: `1px solid ${on ? a.hex + "88" : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 12,
                          padding: "11px 13px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: on ? "#F4F3F8" : "#C9C7D6" }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: a.hex, fontWeight: 700, letterSpacing: "0.06em", marginTop: 3, textTransform: "uppercase" }}>
                          {a.segment}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Q>
              {p.territories.length > 0 && (
                <Q label="Where are you with each one?" why="'exploring' areas get gentler goals; areas you own get defense-of-turf content.">
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {p.territories.map((t) => (
                      <div key={t.slug} style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: t.hex, width: 140 }}>{t.name}</span>
                        {(["own", "building", "exploring"] as const).map((st) => (
                          <Chip key={st} on={t.status === st} color={t.hex} onClick={() => setTerritoryStatus(t.slug, st)}>
                            {st === "own" ? "I own it" : st}
                          </Chip>
                        ))}
                      </div>
                    ))}
                  </div>
                </Q>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Q label="Your positioning (pick up to 2)" why="drives your content theme mix, which market signals surface, and how CTAs are worded.">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {POSITIONING_OPTS.map((o) => (
                    <Chip key={o.key} on={p.positioning.includes(o.key)} color="#FF5D8F" onClick={() => toggle("positioning", o.key, 2)}>{o.label}</Chip>
                  ))}
                </div>
              </Q>
              <Q label="Who's your ideal client?" why="selects your CTA library and which lead magnets we suggest.">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {([["buyers", "Buyers"], ["sellers", "Sellers"], ["both", "Both"], ["investors", "Investors"]] as const).map(([k, l]) => (
                    <Chip key={k} on={p.idealClient === k} color="#FFC23D" onClick={() => patch({ idealClient: k })}>{l}</Chip>
                  ))}
                </div>
              </Q>
              <Q label="What do clients say you're great at?" why="we mine this for proof-point content — the posts that build trust fastest.">
                <TextInput value={p.strengths} onChange={(v) => patch({ strengths: v })} placeholder="“She answered every text in minutes” · “He knew every street”" />
              </Q>
            </>
          )}

          {step === 3 && (
            <>
              <Q label="Where do you actually show up today?" why="we only build for channels you'll really use — and suggest communities on them.">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PLATFORM_OPTS.map((o) => (
                    <Chip key={o.key} on={p.platforms.includes(o.key)} color="#26E0C8" onClick={() => toggle("platforms", o.key)}>{o.label}</Chip>
                  ))}
                </div>
              </Q>
              <Q label="Pick 3 words for your voice" why="every draft — posts and replies — is written in this register.">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {TONE_CHIPS.map((t) => (
                    <Chip key={t} on={p.tone.includes(t)} color="#C9A8FF" onClick={() => toggle("tone", t, 3)}>{t}</Chip>
                  ))}
                </div>
              </Q>
              <Q label="How do you feel about being on camera?" why="sets your reel vs. carousel vs. text-graphic mix — we never assign content you'll avoid.">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {([["love", "Love it"], ["tolerate", "Tolerate it"], ["avoid", "Avoid it"]] as const).map(([k, l]) => (
                    <Chip key={k} on={p.cameraComfort === k} color="#FF9A62" onClick={() => patch({ cameraComfort: k })}>{l}</Chip>
                  ))}
                </div>
              </Q>
            </>
          )}

          {step === 4 && (
            <>
              <Q label="In local groups, you're naturally a…" why="the single most important answer: it sets your engagement pace and how assertive drafted replies are. Nothing will ever push past your comfort.">
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {([
                    ["observer", "Observer", "I read a lot, rarely post"],
                    ["participant", "Participant", "I comment when I have something useful"],
                    ["connector", "Connector", "I start conversations and enjoy it"],
                  ] as const).map(([k, l, d]) => (
                    <button
                      key={k}
                      onClick={() => patch({ prospectingMode: k })}
                      style={{
                        textAlign: "left",
                        background: p.prospectingMode === k ? "rgba(38,224,200,0.11)" : "rgba(255,255,255,0.035)",
                        border: `1px solid ${p.prospectingMode === k ? "#26E0C877" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 12,
                        padding: "12px 15px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: p.prospectingMode === k ? "#26E0C8" : "#D8D6E6" }}>{l}</div>
                      <div style={{ fontSize: 11.5, color: "#8B89A0", marginTop: 2 }}>{d}</div>
                    </button>
                  ))}
                </div>
              </Q>
              <Q label="Honestly — how are you at follow-up?" why="tunes how persistent your follow-up queue is, and how it talks to you.">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {([["great", "Great at it"], ["week", "Good for a week"], ["drop", "I drop the ball"]] as const).map(([k, l]) => (
                    <Chip key={k} on={p.followUpHonesty === k} color="#FFC23D" onClick={() => patch({ followUpHonesty: k })}>{l}</Chip>
                  ))}
                </div>
              </Q>
              <Q label="Anything off-limits?" why="hard guardrails — drafts will never cross these lines.">
                <TextInput value={p.offLimits} onChange={(v) => patch({ offLimits: v })} placeholder="no cold DMs, no political threads, no weekend posting…" />
              </Q>
            </>
          )}

          {step === 5 && (
            <>
              <Q label="What posting rhythm can you actually sustain?" why="your consistency score measures against YOUR target — not some influencer ideal.">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {([[3, "3 posts / week"], [5, "5 posts / week"], [7, "Daily"]] as const).map(([k, l]) => (
                    <Chip key={k} on={p.postingTarget === k} color="#41D98A" onClick={() => patch({ postingTarget: k })}>{l}</Chip>
                  ))}
                </div>
              </Q>
              <Q label="Your #1 goal for the next 90 days" why="reorders your daily next-actions — listings goals surface seller signals first.">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {([["listings", "More listings"], ["buyers", "More buyers"], ["new-market", "Break into a new area"], ["revival", "Revive my pipeline"]] as const).map(([k, l]) => (
                    <Chip key={k} on={p.goal90d === k} color="#A855F7" onClick={() => patch({ goal90d: k })}>{l}</Chip>
                  ))}
                </div>
              </Q>
              <Q label="How much time can you give this?" why="decides when Autopilot pre-drafts for you vs. asks first.">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {([["daily20", "20 min a day"], ["few-hours", "1 hr every few days"], ["weekend-batch", "Batch on weekends"]] as const).map(([k, l]) => (
                    <Chip key={k} on={p.timeBudget === k} color="#7DD3FC" onClick={() => patch({ timeBudget: k })}>{l}</Chip>
                  ))}
                </div>
              </Q>
            </>
          )}
        </div>

        {/* nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "#A6A4B8", borderRadius: 10, padding: "11px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ← Back
            </button>
          )}
          <button
            onClick={() => (step === 5 ? finish() : setStep(step + 1))}
            disabled={!canNext}
            style={{
              marginLeft: "auto",
              background: canNext ? "linear-gradient(180deg,#C084FC,#9333EA)" : "rgba(255,255,255,0.06)",
              color: canNext ? "#fff" : "#5E5C72",
              border: "none",
              borderRadius: 10,
              padding: "12px 26px",
              fontSize: 13.5,
              fontWeight: 800,
              cursor: canNext ? "pointer" : "default",
              boxShadow: canNext ? "0 8px 24px rgba(147,51,234,0.45)" : "none",
            }}
          >
            {step === 5 ? "Build my OS →" : "Continue →"}
          </button>
        </div>
        <button
          onClick={() => set({ onboarded: true, strategy: DEFAULT_STRATEGY, tab: "today" })}
          style={{ display: "block", margin: "18px auto 0", background: "transparent", border: "none", color: "#5E5C72", fontSize: 11.5, cursor: "pointer" }}
        >
          Skip for now — use a smart default profile
        </button>
      </div>
    </div>
  );
}
