"use client";

import { CHANNELS } from "@/lib/data";

/* Platform sections — every group lives inside its platform's card.
   New platforms (e.g. Instagram) appear automatically when channels
   with that platform tag are added to the data. */
const PLATFORM_META: Record<
  string,
  { title: string; sub: string; color: string; icon: string }
> = {
  "FB GROUP": { title: "Facebook Groups", sub: "Community groups · manual posting by design", color: "#7DD3FC", icon: "f" },
  NEXTDOOR: { title: "Nextdoor", sub: "Neighborhood feeds · verified business page", color: "#26E0C8", icon: "n" },
  INSTAGRAM: { title: "Instagram", sub: "Owned channel · autopilot publishing", color: "#FF5D8F", icon: "ig" },
  FORUM: { title: "Forums", sub: "Long-form local communities", color: "#C9A8FF", icon: "fm" },
};

const HEALTH_LABEL: Record<string, string> = {
  active: "active",
  warm: "warming",
  quiet: "quiet",
};

export default function Directory() {
  const platforms = Array.from(new Set(CHANNELS.map((c) => c.platform)));

  return (
    <div>
      <div className="fh-kicker" style={{ marginBottom: 16 }}>
        Your channel directory · rules, cadence &amp; health by platform
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, alignItems: "start" }}>
        {platforms.map((plat, pi) => {
          const meta = PLATFORM_META[plat] || {
            title: plat,
            sub: "Connected channel",
            color: "#8B89A0",
            icon: plat[0]?.toLowerCase() || "?",
          };
          const groups = CHANNELS.filter((c) => c.platform === plat);
          const totalMembers = groups
            .map((g) => parseFloat(g.members))
            .reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
          const activeCount = groups.filter((g) => g.health === "active").length;
          const quiet = groups.filter((g) => g.health === "quiet");

          return (
            <section
              key={plat}
              style={{
                minWidth: 0,
                borderRadius: 18,
                overflow: "hidden",
                background: "linear-gradient(165deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
                border: "1px solid rgba(255,255,255,0.1)",
                borderTop: `1px solid ${meta.color}4D`,
                boxShadow: `0 22px 50px rgba(0,0,0,0.45), 0 8px 30px ${meta.color}14, inset 0 1px 0 rgba(255,255,255,0.1)`,
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                animation: `fh-fadein .5s ease ${(pi * 0.08).toFixed(2)}s both`,
              }}
            >
              {/* platform header */}
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  padding: "16px 18px",
                  background: `linear-gradient(120deg, ${meta.color}14, transparent 60%)`,
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--label)",
                    fontSize: 16,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "#0B0B16",
                    background: `linear-gradient(145deg, ${meta.color}, ${meta.color}99)`,
                    boxShadow: `0 6px 18px ${meta.color}55, inset 0 1px 0 rgba(255,255,255,0.4)`,
                  }}
                >
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fh-title" style={{ fontSize: 16.5 }}>{meta.title}</div>
                  <div style={{ fontSize: 11.5, color: "#8B89A0", marginTop: 2 }}>{meta.sub}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 18, color: meta.color }}>
                    {groups.length} <span style={{ fontSize: 11, color: "#8B89A0", fontWeight: 600 }}>group{groups.length > 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "#8B89A0", marginTop: 1 }}>
                    {totalMembers.toFixed(1)}K reach · {activeCount}/{groups.length} active
                  </div>
                </div>
              </header>

              {/* groups inside the platform card */}
              <div>
                {groups.map((c, gi) => (
                  <article
                    key={c.name}
                    style={{
                      padding: "14px 18px",
                      borderBottom: gi < groups.length - 1 ? "1px solid rgba(255,255,255,0.055)" : "none",
                      transition: "background .2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</span>
                      <span style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "#77758C" }}>
                        {c.members} · {c.cadence}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: c.healthColor,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: c.healthColor,
                            boxShadow: `0 0 7px ${c.healthColor}`,
                            animation: c.health === "active" ? "fh-pulse 2.4s ease infinite" : undefined,
                          }}
                        />
                        {HEALTH_LABEL[c.health] || c.health}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#A6A4B8", lineHeight: 1.55, marginTop: 6 }}>{c.rules}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 650,
                          fontFamily: "var(--mono)",
                          color: c.promoOn ? "#FFC23D" : "#6E6C82",
                          background: c.promoOn ? "rgba(255,194,61,0.1)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${c.promoOn ? "rgba(255,194,61,0.3)" : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 999,
                          padding: "3px 10px",
                        }}
                      >
                        {c.promo}
                      </span>
                      <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#6E6C82" }}>
                        last posted {c.last}
                      </span>
                    </div>
                    {c.health === "quiet" && (
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 11.5,
                          color: "#FF5D8F",
                          background: "rgba(255,93,143,0.07)",
                          border: "1px solid rgba(255,93,143,0.22)",
                          borderRadius: 9,
                          padding: "8px 11px",
                        }}
                      >
                        Quiet — last post {c.last}. A post is queued in your Weekly Planner.
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {/* platform footer note when something needs attention */}
              {quiet.length > 0 && (
                <footer
                  style={{
                    padding: "10px 18px",
                    borderTop: "1px solid rgba(255,255,255,0.055)",
                    background: "rgba(255,93,143,0.045)",
                    fontSize: 10.5,
                    fontFamily: "var(--mono)",
                    color: "#C08497",
                  }}
                >
                  {quiet.length} group{quiet.length > 1 ? "s" : ""} need{quiet.length > 1 ? "" : "s"} attention on {meta.title}
                </footer>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
