"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { articleBrief, newsDelete, newsExtract, newsList, newsSave, photoAttribution, riskyCredit, sourceLine, type NewsArticle, type NewsImage } from "@/lib/newsDesk";
import { processImageURL } from "@/lib/studio";
import { reelVaultAdd } from "@/lib/reelVault";

/**
 * News Desk — drop an article in, get sourced raw material out.
 *
 * Paste a link: the SERVER reads the page and returns headline, outlet,
 * date, lede, lead image, readable body and SUGGESTED highlights (every
 * sentence carrying a figure). Mark the lines worth citing, add an angle
 * note, save. From there an article can become a reel script in one tap,
 * or a copy-paste brief for the Studio — always carrying its outlet credit
 * and source line, per the brand vault's attribution rule.
 *
 * Records live server-side; this screen holds JSON and lazy <img> thumbs
 * only — no media bytes in the browser.
 */

const card = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12 } as const;
const input = {
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 11px",
  fontSize: 12.5,
  color: "#F4F3F8",
  width: "100%",
  fontFamily: "var(--body)",
} as const;
const btn = (bg: string, color: string, border: string) =>
  ({ background: bg, color, border: `1px solid ${border}`, borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }) as const;

function Chip({ label, on, color, onClick }: { label: string; on?: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: on ? `${color}22` : "rgba(255,255,255,0.04)",
        border: `1px solid ${on ? `${color}77` : "rgba(255,255,255,0.1)"}`,
        color: on ? color : "#A6A4B8",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 11.5,
        lineHeight: 1.45,
        cursor: "pointer",
        width: "100%",
      }}
    >
      {on ? "✓ " : "+ "}
      {label}
    </button>
  );
}

export default function NewsDesk() {
  const { state, set, copy, workspace } = useStore();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<NewsArticle | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [writing, setWriting] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setArticles(await newsList(workspace));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "couldn't read the news desk");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  const read = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    setMsg("Reading the article…");
    try {
      const a = await newsExtract(url.trim());
      setDraft(a);
      setMsg(`Read “${a.title.slice(0, 60)}” — mark the lines you'd cite, then save.`);
    } catch (e) {
      setMsg(`${e instanceof Error ? e.message : "couldn't read that"} — you can paste the text manually instead.`);
      setManual(true);
    } finally {
      setBusy(false);
    }
  };

  const startManual = () => {
    setDraft({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      url: url.trim(),
      outlet: "",
      title: "",
      summary: "",
      body: "",
      images: [],
      highlights: [],
      suggested: [],
      tags: [],
      addedAt: Date.now(),
    });
    setManual(true);
    setMsg("Paste the headline, outlet and the text — highlights can be typed in one per line.");
  };

  const save = async () => {
    if (!draft || busy) return;
    if (!draft.title.trim() || !draft.outlet.trim()) {
      setMsg("Headline and outlet are both required — the outlet is the credit that goes on the slide.");
      return;
    }
    setBusy(true);
    setMsg("Saving…");
    try {
      await newsSave(workspace, draft);
      setDraft(null);
      setUrl("");
      setManual(false);
      setMsg("✓ Saved to the news desk.");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "couldn't save");
    } finally {
      setBusy(false);
    }
  };

  const toggleHighlight = (line: string) => {
    setDraft((d) => {
      if (!d) return d;
      const has = d.highlights.includes(line);
      return { ...d, highlights: has ? d.highlights.filter((h) => h !== line) : [...d.highlights, line] };
    });
  };

  /** Article → reel script → a card in Reel Coach, ready to Produce. */
  const writeReel = async (a: NewsArticle) => {
    if (writing) return;
    if (!a.highlights.length) {
      setMsg("Mark at least one line as a highlight first — those become the only claims the script may use.");
      return;
    }
    setWriting(a.id);
    setMsg(`Writing a reel from “${a.title.slice(0, 50)}”… (about a minute)`);
    try {
      const r = await fetch("/api/reel-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: {
            title: a.title,
            angle: `${a.note || "React to this coverage for Valley homeowners"} — attribute to ${a.outlet}; the reel must land on what it means for a normal APS bill.`,
            facts: a.highlights.slice(0, 5),
          },
          styleName: "R5 news react — the primary source on screen, calm explainer delivery",
          seconds: 30,
        }),
        signal: AbortSignal.timeout(220000),
      });
      const j = (await r.json()) as { script?: { summary?: string; remake?: unknown }; error?: string; configured?: boolean };
      if (j.configured === false) throw new Error("Needs a Claude or Gemini key in Connectors first.");
      if (j.error || !j.script?.remake) throw new Error(j.error || "the script came back empty");
      const ok = await reelVaultAdd(
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label: `📰 ${a.title.slice(0, 48)}`,
          source: "own",
          analysis: {
            summary: j.script.summary || `News react — ${a.outlet}`,
            remake: j.script.remake as never,
            adaptedTopic: a.title,
            contentPattern: `News react (R5) sourced from ${a.outlet} — ${sourceLine(a)}. Credit the outlet on any slide using its headline or image; link in the caption: ${a.url}`,
            coachingNotes: [`Source: ${a.url}`, ...a.highlights.slice(0, 5).map((h) => `Cited: ${h}`)],
          },
          createdAt: Date.now(),
        },
        workspace
      );
      if (!ok) throw new Error("couldn't save the script on this device");
      setMsg("✓ Script written — open Reel Coach to review it and hit ⚡ Produce reel.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "couldn't write the reel");
    } finally {
      setWriting(null);
    }
  };

  /** Photo → Studio. The vault copy is served SAME-ORIGIN through
      /api/media, which is what lets the canvas read it without tainting;
      the credit line lands on the clipboard and in the asset's name so it
      can't get separated from the image. */
  const useInStudio = async (a: NewsArticle, img: NewsImage, idx: number) => {
    if (sending) return;
    if (!img.savedUrl) {
      setMsg("That photo wasn't archived — delete and re-save the article to pull it into the vault first.");
      return;
    }
    setSending(`${a.id}-${idx}`);
    setMsg("Preparing the photo for the Studio…");
    try {
      const p = await processImageURL(`/api/media?u=${encodeURIComponent(img.savedUrl)}`, 1400, 0.86);
      if (!p) throw new Error("couldn't read that photo");
      const credit = img.credit ? `${img.credit} / ${a.outlet}` : a.outlet;
      set((s2) => ({
        stAssets: [
          ...s2.stAssets,
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: `📰 ${credit}`, dataURL: p.dataURL, lum: p.lum, busy: p.busy, source: "news" },
        ].slice(-40),
        contentTab: "studio",
      }));
      copy(`${photoAttribution(a, img)}\n${sourceLine(a)}`);
      setMsg(`✓ Photo added to the Studio as “📰 ${credit}” — the attribution line is on your clipboard for the caption.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "couldn't prepare that photo");
    } finally {
      setSending(null);
    }
  };

  const remove = async (a: NewsArticle) => {
    if (!confirm(`Remove “${a.title.slice(0, 60)}” from the news desk?`)) return;
    await newsDelete(workspace, a.id);
    await refresh();
  };

  const d = draft;

  return (
    <div>
      <div style={{ fontSize: 13, color: "#A6A4B8", marginBottom: 16, lineHeight: 1.5, maxWidth: 680 }}>
        Drop a news article in and it becomes sourced raw material: the context, the image, the exact lines worth
        citing, and the outlet credit that goes on the slide. From here an article can become a reel script in one tap
        or a brief you paste into the Studio.
      </div>

      {/* ---- drop bar ---- */}
      <div className="fh-glass" style={{ borderRadius: 14, padding: "14px 16px", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Paste an article link (azcentral, AZ Republic, Utility Dive, ACC docket page…)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") read();
            }}
            disabled={busy}
            style={{ ...input, flex: 1, minWidth: 240 }}
          />
          <button onClick={read} disabled={busy || !url.trim()} style={{ ...btn("rgba(125,211,252,0.14)", "#7DD3FC", "rgba(125,211,252,0.45)"), opacity: busy || !url.trim() ? 0.6 : 1 }}>
            {busy ? "Reading…" : "Read article"}
          </button>
          <button onClick={startManual} disabled={busy} style={btn("transparent", "#8B89A0", "rgba(255,255,255,0.12)")}>
            Paste text instead
          </button>
        </div>
        {msg && <div style={{ fontSize: 11.5, color: msg.startsWith("✓") ? "#41D98A" : "#7DD3FC", marginTop: 8, lineHeight: 1.45 }}>{msg}</div>}
      </div>

      {/* ---- draft review ---- */}
      {d && (
        <div className="fh-glass" style={{ borderRadius: 14, padding: "16px 17px", marginBottom: 20, border: "1px solid rgba(125,211,252,0.35)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#7DD3FC", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Review before saving
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 7 }}>
              <input value={d.title} onChange={(e) => setDraft({ ...d, title: e.target.value })} placeholder="Headline" style={input} />
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <input value={d.outlet} onChange={(e) => setDraft({ ...d, outlet: e.target.value })} placeholder="Outlet (the on-slide credit)" style={{ ...input, flex: 1, minWidth: 130 }} />
                <input value={d.publishedAt?.slice(0, 10) || ""} onChange={(e) => setDraft({ ...d, publishedAt: e.target.value })} placeholder="YYYY-MM-DD" style={{ ...input, width: 130 }} />
              </div>
              {manual && <input value={d.url} onChange={(e) => setDraft({ ...d, url: e.target.value })} placeholder="Source link" style={input} />}
              <textarea
                value={d.summary}
                onChange={(e) => setDraft({ ...d, summary: e.target.value })}
                placeholder="Summary / lede"
                rows={2}
                style={{ ...input, resize: "vertical" }}
              />
              <textarea
                value={d.note || ""}
                onChange={(e) => setDraft({ ...d, note: e.target.value })}
                placeholder="My angle — why this matters to a Valley homeowner (this steers every script written from it)"
                rows={2}
                style={{ ...input, resize: "vertical" }}
              />
              {manual && (
                <textarea
                  value={d.body || ""}
                  onChange={(e) => setDraft({ ...d, body: e.target.value })}
                  placeholder="Paste the article text here"
                  rows={6}
                  style={{ ...input, resize: "vertical", fontSize: 11.5 }}
                />
              )}
            </div>
          </div>

          {/* photos — keep the ones you'd actually use; each is archived on
              save so it survives link rot and can enter the Studio */}
          {!!d.images.length && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#C9A8FF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Photos · {d.images.length} found — remove any you won&apos;t use (kept ones get archived)
              </div>
              <div className="fh-hscroll" style={{ display: "flex", gap: 10, paddingBottom: 6 }}>
                {d.images.map((im, i) => (
                  <div key={i} style={{ flexShrink: 0, width: 150 }}>
                    <div style={{ position: "relative" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={im.savedUrl || im.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{ width: 150, height: 100, objectFit: "cover", borderRadius: 10, border: `1px solid ${im.lead ? "rgba(201,168,255,0.6)" : "rgba(255,255,255,0.12)"}`, display: "block", background: "#111" }}
                      />
                      <button
                        title="Remove this photo"
                        onClick={() => setDraft({ ...d, images: d.images.filter((_, k) => k !== i) })}
                        style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(255,93,143,0.92)", color: "#fff", fontSize: 9, cursor: "pointer", lineHeight: 1 }}
                      >
                        ✕
                      </button>
                      {im.lead && (
                        <span style={{ position: "absolute", bottom: 4, left: 4, fontSize: 8.5, fontWeight: 800, color: "#0B0A12", background: "#C9A8FF", borderRadius: 4, padding: "1px 5px" }}>LEAD</span>
                      )}
                    </div>
                    <input
                      value={im.credit || ""}
                      onChange={(e) => {
                        const next = [...d.images];
                        next[i] = { ...im, credit: e.target.value };
                        setDraft({ ...d, images: next });
                      }}
                      placeholder="photo credit"
                      style={{ ...input, marginTop: 4, fontSize: 10.5, padding: "5px 8px" }}
                    />
                    {riskyCredit(im.credit) && (
                      <div style={{ fontSize: 9.5, color: "#FFC23D", marginTop: 3, lineHeight: 1.35 }}>
                        ⚠ agency photo — the outlet can&apos;t license it. Prefer the headline-screenshot framing.
                      </div>
                    )}
                    {im.caption && (
                      <div style={{ fontSize: 9.5, color: "#6E6C82", marginTop: 3, lineHeight: 1.35, maxHeight: 44, overflow: "hidden" }}>{im.caption}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* highlights */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#FFC23D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Highlights — the only lines a script may cite {d.highlights.length ? `· ${d.highlights.length} marked` : ""}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 240, overflowY: "auto" }}>
              {(d.suggested || []).map((s, i) => (
                <Chip key={i} label={s} on={d.highlights.includes(s)} color="#FFC23D" onClick={() => toggleHighlight(s)} />
              ))}
              {d.highlights.filter((h) => !(d.suggested || []).includes(h)).map((h, i) => (
                <Chip key={`own-${i}`} label={h} on color="#41D98A" onClick={() => toggleHighlight(h)} />
              ))}
            </div>
            <textarea
              placeholder="Or type your own quotable lines — one per line (numbers stay exact)"
              rows={2}
              onBlur={(e) => {
                const lines = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean);
                if (lines.length) {
                  setDraft({ ...d, highlights: [...new Set([...d.highlights, ...lines])] });
                  e.target.value = "";
                }
              }}
              style={{ ...input, resize: "vertical", marginTop: 6, fontSize: 11.5 }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={save} disabled={busy} style={{ ...btn("rgba(65,217,138,0.14)", "#41D98A", "rgba(65,217,138,0.45)"), opacity: busy ? 0.6 : 1 }}>
              {busy ? "Saving…" : "✓ Save to news desk"}
            </button>
            <button onClick={() => { setDraft(null); setManual(false); setMsg(null); }} disabled={busy} style={btn("transparent", "#8B89A0", "rgba(255,255,255,0.12)")}>
              Discard
            </button>
            <span style={{ fontSize: 10.5, color: "#5E5C72" }}>{sourceLine(d)}</span>
          </div>
        </div>
      )}

      {/* ---- saved articles ---- */}
      {loading ? (
        <div style={{ fontSize: 12, color: "#6E6C82", padding: "16px 4px" }}>Reading the news desk…</div>
      ) : err ? (
        <div style={{ fontSize: 12, color: "#FF6B6B", padding: "16px 4px" }}>{err}</div>
      ) : articles.length === 0 ? (
        <div style={{ fontSize: 12, color: "#6E6C82", padding: "16px 4px" }}>
          Nothing saved yet — paste a link above. Rate-case coverage, data-center filings and heat/grid stories are the
          highest-value drops for this account.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {articles.map((a) => {
            const open = expanded === a.id;
            return (
              <div key={a.id} style={{ ...card, padding: "13px 15px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {a.images[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.images[0].savedUrl || a.images[0].url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ width: 84, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0, background: "#111" }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#F4F3F8", lineHeight: 1.35 }}>{a.title}</div>
                    <div style={{ fontSize: 10.5, color: "#8B89A0", marginTop: 3 }}>
                      <b style={{ color: "#C9A8FF" }}>{a.outlet}</b>
                      {a.publishedAt ? ` · ${a.publishedAt.slice(0, 10)}` : ""}
                      {a.highlights.length ? ` · ${a.highlights.length} cited line${a.highlights.length === 1 ? "" : "s"}` : " · no highlights yet"}
                    </div>
                    {a.note && <div style={{ fontSize: 11.5, color: "#A6A4B8", marginTop: 4, lineHeight: 1.45 }}>{a.note}</div>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
                  <button onClick={() => writeReel(a)} disabled={!!writing} style={{ ...btn("rgba(232,98,44,0.14)", "#FF9A62", "rgba(232,98,44,0.45)"), opacity: writing ? 0.6 : 1 }}>
                    {writing === a.id ? "Writing…" : "🎬 Write a reel from this"}
                  </button>
                  <button onClick={() => copy(articleBrief(a))} style={btn("rgba(38,224,200,0.1)", "#26E0C8", "rgba(38,224,200,0.35)")}>
                    Copy brief
                  </button>
                  <button onClick={() => copy(sourceLine(a))} style={btn("rgba(125,211,252,0.1)", "#7DD3FC", "rgba(125,211,252,0.35)")}>
                    Copy source line
                  </button>
                  {a.images[0] && (
                    <a
                      href={a.images[0].savedUrl || a.images[0].url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...btn("rgba(201,168,255,0.1)", "#C9A8FF", "rgba(201,168,255,0.35)"), textDecoration: "none" }}
                    >
                      Image ↗
                    </a>
                  )}
                  <a href={a.url} target="_blank" rel="noreferrer" style={{ ...btn("transparent", "#8B89A0", "rgba(255,255,255,0.12)"), textDecoration: "none" }}>
                    Original ↗
                  </a>
                  <button onClick={() => setExpanded(open ? null : a.id)} style={btn("transparent", "#8B89A0", "rgba(255,255,255,0.12)")}>
                    {open ? "Collapse" : "Context"}
                  </button>
                  <button onClick={() => remove(a)} style={btn("rgba(255,107,107,0.1)", "#FF6B6B", "rgba(255,107,107,0.3)")}>
                    Delete
                  </button>
                </div>

                {open && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    {!!a.images.length && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 800, color: "#C9A8FF", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>
                          Photos — send one straight into the Studio with its credit
                        </div>
                        <div className="fh-hscroll" style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
                          {a.images.map((im, i) => (
                            <div key={i} style={{ flexShrink: 0, width: 132 }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={im.savedUrl || im.url}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                style={{ width: 132, height: 88, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", display: "block", background: "#111" }}
                              />
                              <button
                                onClick={() => useInStudio(a, im, i)}
                                disabled={!!sending || !im.savedUrl}
                                title={im.savedUrl ? "Add to the Studio as a slide image" : "not archived — re-save the article"}
                                style={{ ...btn("rgba(255,93,143,0.12)", "#FF5D8F", "rgba(255,93,143,0.4)"), width: "100%", marginTop: 4, opacity: sending || !im.savedUrl ? 0.6 : 1 }}
                              >
                                {sending === `${a.id}-${i}` ? "Sending…" : "→ Studio"}
                              </button>
                              <div style={{ fontSize: 9.5, color: riskyCredit(im.credit) ? "#FFC23D" : "#6E6C82", marginTop: 3, lineHeight: 1.35 }}>
                                {riskyCredit(im.credit) ? "⚠ " : ""}
                                {im.credit || a.outlet}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!!a.highlights.length && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 800, color: "#FFC23D", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Cited lines</div>
                        <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                          {a.highlights.map((h, i) => (
                            <li key={i} style={{ fontSize: 11.5, color: "#D9D7E4", lineHeight: 1.5 }}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {a.summary && <div style={{ fontSize: 11.5, color: "#A6A4B8", lineHeight: 1.55, marginBottom: 6 }}>{a.summary}</div>}
                    {a.body && (
                      <details>
                        <summary style={{ fontSize: 10.5, color: "#77758C", cursor: "pointer" }}>Full text</summary>
                        <div style={{ fontSize: 11, color: "#8B89A0", lineHeight: 1.6, marginTop: 6, whiteSpace: "pre-wrap", maxHeight: 300, overflowY: "auto" }}>{a.body}</div>
                      </details>
                    )}
                    <div style={{ fontSize: 10, color: "#5E5C72", marginTop: 8, fontFamily: "var(--mono)" }}>{sourceLine(a)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 10.5, color: "#5E5C72", marginTop: 16, lineHeight: 1.5, maxWidth: 660 }}>
        Attribution rule (from the brand vault): a news headline or image may be used as a credited <i>reference to the
        coverage</i> — outlet named on the slide, link in the caption, photo credits never stripped. Many news photos are
        AP/Getty and are not the outlet&apos;s to license; when in doubt use the headline screenshot framing or your own
        image. {state.demoMode ? "" : ""}
      </div>
    </div>
  );
}
