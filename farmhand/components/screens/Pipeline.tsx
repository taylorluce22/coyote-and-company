"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import SubTabs from "@/components/SubTabs";
import {
  ageLabel,
  isOverdue,
  isStale,
  STAGES,
  WARMTH_META,
  type Contact,
  type Motivation,
  type StageKey,
} from "@/lib/pipeline";
import type { StrategyProfile } from "@/lib/strategy";

const DAY = 86400000;

function chipBtn(on: boolean, color: string): React.CSSProperties {
  return {
    background: on ? `${color}1C` : "rgba(255,255,255,0.04)",
    color: on ? color : "#8B89A0",
    border: `1px solid ${on ? color + "66" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 999,
    padding: "4px 11px",
    fontSize: 10.5,
    fontWeight: 700,
    cursor: "pointer",
  };
}

/* ------------------------- person drawer ------------------------- */

function PersonDrawer({ c, onClose }: { c: Contact; onClose: () => void }) {
  const { set } = useStore();
  const [noteText, setNoteText] = useState("");

  const patch = (u: Partial<Contact>, touch = true) =>
    set((s) => ({
      contacts: (s.contacts as Contact[]).map((x) =>
        x.id === c.id ? { ...x, ...u, ...(touch ? { lastTouchAt: Date.now() } : {}) } : x
      ),
    }));

  const addNote = () => {
    if (!noteText.trim()) return;
    patch({ notes: [{ t: noteText.trim(), at: Date.now() }, ...c.notes] });
    setNoteText("");
  };

  const stageIdx = STAGES.findIndex((s) => s.key === c.stage);

  return (
    <div className="fh-glass" style={{ borderRadius: 15, padding: "17px 19px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.14)", animation: "fh-pop 0.2s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: "#F4F3F8" }}>{c.name}</span>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.07em", fontFamily: "var(--label)", color: WARMTH_META[c.warmth].color }}>{WARMTH_META[c.warmth].label}</span>
        {c.dnc && (
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.07em", fontFamily: "var(--label)", color: "#FF5D8F", background: "rgba(255,93,143,0.12)", border: "1px solid rgba(255,93,143,0.45)", borderRadius: 999, padding: "3px 9px" }}>
            ⛔ DO NOT CONTACT
          </span>
        )}
        <span style={{ fontSize: 10.5, color: "#77758C", fontFamily: "var(--mono)" }}>
          via {c.origin}{c.referrer ? ` · from ${c.referrer}` : ""}{c.territory ? ` · ${c.territory}` : ""} · added {ageLabel(c.createdAt)} ago
        </span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#8B89A0", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          Close
        </button>
      </div>

      {c.sourceContext && (
        <div style={{ fontSize: 11, color: "#8B89A0", marginTop: 7 }}>
          <span style={{ color: "#C9A8FF", fontWeight: 700 }}>came from · </span>{c.sourceContext}
        </div>
      )}
      <div style={{ fontSize: 12, color: "#A6A4B8", marginTop: 6, lineHeight: 1.5 }}>{c.note}</div>

      {/* contact + type row */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
        {c.phone && !c.dnc && (
          <>
            <a href={`tel:${c.phone}`} style={{ ...chipBtn(true, "#41D98A"), textDecoration: "none" }}>📞 Call</a>
            <a href={`sms:${c.phone}`} style={{ ...chipBtn(true, "#7DD3FC"), textDecoration: "none" }}>💬 Text</a>
          </>
        )}
        {c.email && !c.dnc && <a href={`mailto:${c.email}`} style={{ ...chipBtn(true, "#C9A8FF"), textDecoration: "none" }}>✉ Email</a>}
        <span style={{ fontSize: 10.5, color: "#5E5C72", fontFamily: "var(--mono)" }}>{c.phone || "no phone"} · {c.email || "no email"}</span>
      </div>

      {/* motivation / type / warmth */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {(["buying", "selling", "both", "curious"] as Motivation[]).map((m) => (
          <button key={m} onClick={() => patch({ motivation: m }, false)} style={chipBtn(c.motivation === m, "#FFC23D")}>{m}</button>
        ))}
        <span style={{ width: 10 }} />
        {(["lead", "buyer", "seller", "sphere", "past_client", "referral_partner"] as const).map((t) => (
          <button key={t} onClick={() => patch({ ctype: t }, false)} style={chipBtn(c.ctype === t, "#26E0C8")}>{t.replace("_", " ")}</button>
        ))}
      </div>

      {/* stage + next touch + dnc */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 13 }}>
        <span className="fh-kicker" style={{ fontSize: 8.5 }}>Stage</span>
        <button onClick={() => stageIdx > 0 && patch({ stage: STAGES[stageIdx - 1].key as StageKey })} style={chipBtn(false, "#8B89A0")}>←</button>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: STAGES[stageIdx].color }}>{STAGES[stageIdx].label}</span>
        <button onClick={() => stageIdx < STAGES.length - 1 && patch({ stage: STAGES[stageIdx + 1].key as StageKey })} style={chipBtn(true, STAGES[Math.min(stageIdx + 1, STAGES.length - 1)].color)}>advance →</button>
        <span style={{ width: 10 }} />
        <span className="fh-kicker" style={{ fontSize: 8.5 }}>Next touch</span>
        {[["today", 0], ["3d", 3], ["1w", 7], ["1mo", 30]].map(([l, d]) => (
          <button key={l as string} onClick={() => patch({ nextTouchAt: Date.now() + (d as number) * DAY }, false)} style={chipBtn(false, "#FFC23D")}>{l as string}</button>
        ))}
        {c.nextTouchAt && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: isOverdue(c) ? "#FF5D8F" : "#FFC23D", fontFamily: "var(--mono)" }}>
            {isOverdue(c) ? `overdue ${ageLabel(c.nextTouchAt)}` : `in ${Math.max(0, Math.round((c.nextTouchAt - Date.now()) / DAY))}d`}
          </span>
        )}
        <button
          onClick={() => patch({ dnc: !c.dnc }, false)}
          style={{ marginLeft: "auto", ...chipBtn(!!c.dnc, "#FF5D8F") }}
        >
          {c.dnc ? "⛔ DNC on" : "mark do-not-contact"}
        </button>
      </div>

      {/* notes */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
            placeholder="Log a call, text, or context — Enter to save (counts as a touch)"
            style={{ flex: 1, fontSize: 12, color: "#F4F3F8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "9px 12px", outline: "none" }}
          />
          <button onClick={addNote} style={{ background: "rgba(65,217,138,0.12)", color: "#41D98A", border: "1px solid rgba(65,217,138,0.4)", borderRadius: 9, padding: "9px 16px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
            Log
          </button>
        </div>
        {c.notes.slice(0, 5).map((n, i) => (
          <div key={i} style={{ display: "flex", gap: 10, fontSize: 11.5, color: "#A6A4B8", padding: "7px 2px", borderBottom: i < Math.min(c.notes.length, 5) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <span style={{ color: "#5E5C72", fontFamily: "var(--mono)", flexShrink: 0 }}>{ageLabel(n.at)} ago</span>
            <span>{n.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- open house mode ------------------------- */

function OpenHouseMode({ onExit }: { onExit: () => void }) {
  const { set } = useStore();
  const [event, setEvent] = useState("");
  const [started, setStarted] = useState(false);
  const [count, setCount] = useState(0);
  const [f, setF] = useState({ name: "", phone: "", email: "", motivation: "curious" as Motivation, hasAgent: false });

  const signIn = () => {
    if (!f.name.trim()) return;
    const now = Date.now();
    const c: Contact = {
      id: `c-oh-${now}`,
      name: f.name.trim(),
      origin: "event",
      stage: "new",
      warmth: f.motivation === "selling" || f.motivation === "buying" ? "warming" : "cold",
      note: `Open house sign-in · ${f.motivation}${f.hasAgent ? " · has an agent" : ""}`,
      notes: [],
      phone: f.phone.trim() || undefined,
      email: f.email.trim() || undefined,
      motivation: f.motivation,
      ctype: f.motivation === "selling" ? "seller" : "buyer",
      tags: f.hasAgent ? ["has-agent"] : [],
      sourceContext: `Open house · ${event}`,
      createdAt: now,
      lastTouchAt: now,
    };
    set((s) => ({ contacts: [c, ...(s.contacts as Contact[])] }));
    setCount((n) => n + 1);
    setF({ name: "", phone: "", email: "", motivation: "curious", hasAgent: false });
  };

  const big: React.CSSProperties = { width: "100%", fontSize: 17, color: "#F4F3F8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 13, padding: "16px 17px", outline: "none", marginBottom: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, overflowY: "auto", background: "radial-gradient(900px 600px at 50% -10%, #171332, #06060D 65%)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "50px 24px 80px" }}>
        {!started ? (
          <>
            <div className="fh-kicker" style={{ color: "#FFC23D" }}>Open house mode</div>
            <div className="fh-title" style={{ fontSize: 30, margin: "8px 0 6px" }}>Set up the sign-in</div>
            <div style={{ fontSize: 13.5, color: "#A6A4B8", marginBottom: 22, lineHeight: 1.6 }}>
              Hand visitors your phone or tablet. Every sign-in becomes a sourced lead — tomorrow morning they&apos;re
              all in your Respond queue with a follow-up text drafted.
            </div>
            <input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="Event name · e.g. 2314 E Lakeview Dr — Sat" style={big} />
            <button onClick={() => event.trim() && setStarted(true)} style={{ width: "100%", background: "linear-gradient(180deg,#FBBF24,#D97706)", color: "#1A1200", border: "none", borderRadius: 13, padding: "16px", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
              Start sign-ins →
            </button>
            <button onClick={onExit} style={{ display: "block", margin: "16px auto 0", background: "transparent", border: "none", color: "#5E5C72", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="fh-kicker" style={{ color: "#FFC23D" }}>{event}</div>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "#41D98A", fontFamily: "var(--mono)" }}>{count} signed in</span>
            </div>
            <div className="fh-title" style={{ fontSize: 28, margin: "10px 0 4px" }}>Welcome! Sign in 👋</div>
            <div style={{ fontSize: 13, color: "#A6A4B8", marginBottom: 20 }}>Just a name is fine — the rest helps us help you.</div>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" style={big} />
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone (optional)" style={big} />
            <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email (optional)" style={big} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {(["buying", "selling", "both", "curious"] as Motivation[]).map((m) => (
                <button key={m} onClick={() => setF({ ...f, motivation: m })} style={{ ...chipBtn(f.motivation === m, "#FFC23D"), fontSize: 14, padding: "10px 18px" }}>
                  {m === "curious" ? "just looking" : m}
                </button>
              ))}
              <button onClick={() => setF({ ...f, hasAgent: !f.hasAgent })} style={{ ...chipBtn(f.hasAgent, "#7DD3FC"), fontSize: 14, padding: "10px 18px" }}>
                {f.hasAgent ? "✓ working with an agent" : "working with an agent?"}
              </button>
            </div>
            <button onClick={signIn} style={{ width: "100%", background: "linear-gradient(180deg,#4ADE80,#16A34A)", color: "#04110E", border: "none", borderRadius: 13, padding: "17px", fontSize: 17, fontWeight: 800, cursor: "pointer" }}>
              Sign in ✓
            </button>
            <button onClick={onExit} style={{ display: "block", margin: "18px auto 0", background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "#8B89A0", borderRadius: 10, padding: "10px 22px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              End open house · {count} captured
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------- main screen ------------------------- */

type View = "board" | "sphere" | "reactivate" | "referrals";

export default function Pipeline() {
  const { state, set } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const contacts = state.contacts as Contact[];
  const [view, setView] = useState<View>("board");
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openHouse, setOpenHouse] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", note: "" });

  const selC = contacts.find((c) => c.id === sel);

  const add = () => {
    if (!f.name.trim()) return;
    const now = Date.now();
    set((s) => ({
      contacts: [
        {
          id: `c-${now}`,
          name: f.name.trim(),
          origin: "manual" as const,
          stage: "new" as StageKey,
          warmth: "cold" as const,
          note: f.note.trim() || "Added manually",
          notes: [],
          phone: f.phone.trim() || undefined,
          ctype: "lead" as const,
          tags: [],
          createdAt: now,
          lastTouchAt: now,
        },
        ...(s.contacts as Contact[]),
      ],
    }));
    setF({ name: "", phone: "", note: "" });
    setAdding(false);
  };

  const sphere = contacts.filter((c) => c.ctype === "sphere" || c.ctype === "past_client");
  const stale = contacts.filter(isStale);
  const referrals = contacts.filter((c) => c.origin === "referral" || c.ctype === "referral_partner" || c.referrer);

  const Card = ({ c }: { c: Contact }) => {
    const w = WARMTH_META[c.warmth];
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setSel(c.id === sel ? null : c.id)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel(c.id === sel ? null : c.id)}
        className="fh-glass"
        style={{ borderRadius: 12, padding: "11px 13px", borderTop: `2px solid ${w.color}55`, cursor: "pointer", border: sel === c.id ? "1px solid rgba(255,255,255,0.3)" : undefined }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#F4F3F8" }}>{c.name}</span>
          {c.dnc && <span style={{ fontSize: 9 }}>⛔</span>}
          <span style={{ marginLeft: "auto", fontSize: 8, fontWeight: 800, letterSpacing: "0.07em", fontFamily: "var(--label)", color: w.color }}>{w.label}</span>
        </div>
        <div style={{ fontSize: 10.5, color: "#8B89A0", marginTop: 4, lineHeight: 1.45 }}>{c.note.slice(0, 80)}</div>
        <div style={{ fontSize: 9.5, color: "#5E5C72", marginTop: 6, fontFamily: "var(--mono)" }}>
          via {c.origin}{c.territory ? ` · ${c.territory}` : ""} · touched {ageLabel(c.lastTouchAt)} ago
          {c.nextTouchAt && <span style={{ color: isOverdue(c) ? "#FF5D8F" : "#FFC23D" }}> · {isOverdue(c) ? "OVERDUE" : `next in ${Math.max(0, Math.round((c.nextTouchAt - Date.now()) / DAY))}d`}</span>}
        </div>
      </div>
    );
  };

  return (
    <div>
      {openHouse && <OpenHouseMode onExit={() => setOpenHouse(false)} />}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <SubTabs
          tabs={[
            { id: "board" as const, label: "Board" },
            { id: "sphere" as const, label: `Sphere · ${sphere.length}` },
            { id: "reactivate" as const, label: `Reactivate · ${stale.length}` },
            { id: "referrals" as const, label: `Referrals · ${referrals.length}` },
          ]}
          active={view}
          color="#FFC23D"
          onPick={setView}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, marginBottom: 18 }}>
          <button onClick={() => setOpenHouse(true)} style={{ background: "linear-gradient(180deg,#FBBF24,#D97706)", color: "#1A1200", border: "none", borderRadius: 9, padding: "8px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            ⌂ Open house mode
          </button>
          <button onClick={() => setAdding(!adding)} style={{ background: "rgba(255,194,61,0.12)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.4)", borderRadius: 9, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {adding ? "Cancel" : "+ Add person"}
          </button>
        </div>
      </div>

      {adding && (
        <div className="fh-glass" style={{ borderRadius: 13, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 9, flexWrap: "wrap" }}>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name or @handle" style={{ flex: "1 1 160px", fontSize: 12.5, color: "#F4F3F8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "9px 12px", outline: "none" }} />
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone (enables call/text)" style={{ flex: "1 1 150px", fontSize: 12.5, color: "#F4F3F8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "9px 12px", outline: "none" }} />
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Context — where you met, what they need" style={{ flex: "2 1 220px", fontSize: 12.5, color: "#F4F3F8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "9px 12px", outline: "none" }} />
          <button onClick={add} style={{ background: "linear-gradient(180deg,#FBBF24,#D97706)", color: "#1A1200", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Add</button>
        </div>
      )}

      {selC && <PersonDrawer c={selC} onClose={() => setSel(null)} />}

      {view === "board" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 11, overflowX: "auto", paddingBottom: 6 }}>
          {STAGES.filter((st) => !st.key.startsWith("closed") || contacts.some((c) => c.stage === st.key)).map((st) => {
            const cards = contacts.filter((c) => c.stage === st.key);
            return (
              <div key={st.key} style={{ minWidth: 190 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.color, boxShadow: `0 0 6px ${st.color}` }} />
                  <span className="fh-kicker" style={{ fontSize: 9 }}>{st.label}</span>
                  <span style={{ fontSize: 10, color: "#5E5C72", fontFamily: "var(--mono)" }}>{cards.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 50 }}>
                  {cards.map((c) => <Card key={c.id} c={c} />)}
                  {cards.length === 0 && <div style={{ borderRadius: 11, border: "1px dashed rgba(255,255,255,0.08)", padding: "12px 10px", fontSize: 10.5, color: "#4A4860", textAlign: "center" }}>empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "sphere" && (
        <div>
          <div style={{ fontSize: 12.5, color: "#A6A4B8", marginBottom: 14, lineHeight: 1.55 }}>
            Past clients and sphere — the cheapest deals you&apos;ll ever close. One useful touch a month keeps you the
            obvious call. Suggested touch: <i style={{ color: "#D8D6E6" }}>&ldquo;{strategy.territories[0]?.name || "your area"} market update — thought of you&rdquo;</i>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 11 }}>
            {sphere.map((c) => <Card key={c.id} c={c} />)}
            {sphere.length === 0 && <div style={{ fontSize: 12.5, color: "#77758C", padding: 20 }}>No sphere contacts yet — open a person and set their type to &ldquo;sphere&rdquo; or &ldquo;past client.&rdquo;</div>}
          </div>
        </div>
      )}

      {view === "reactivate" && (
        <div>
          <div style={{ fontSize: 12.5, color: "#A6A4B8", marginBottom: 14 }}>
            No touch in 30+ days. These aren&apos;t dead — they&apos;re forgotten. One honest check-in revives more deals than any ad.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 11 }}>
            {stale.map((c) => <Card key={c.id} c={c} />)}
            {stale.length === 0 && <div style={{ fontSize: 12.5, color: "#41D98A", padding: 20 }}>✓ Nobody's going stale — your follow-up is holding.</div>}
          </div>
        </div>
      )}

      {view === "referrals" && (
        <div>
          <div style={{ fontSize: 12.5, color: "#A6A4B8", marginBottom: 14 }}>
            Referral chains — who sends you business. Thank the referrer every time; it&apos;s the highest-ROI text you&apos;ll send this week.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 11 }}>
            {referrals.map((c) => <Card key={c.id} c={c} />)}
            {referrals.length === 0 && <div style={{ fontSize: 12.5, color: "#77758C", padding: 20 }}>No referrals tracked yet — when someone sends you a client, note the referrer on the person's record.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
