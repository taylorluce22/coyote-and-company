/**
 * Engage — opportunity capture + triage + guardrails.
 * MVP is assisted-manual: the agent pastes a thread link/text (Facebook Groups
 * and Nextdoor have no third-party APIs); Reddit keyword monitors are the P1.5
 * automated source and will feed the same Opportunity shape.
 */

export interface Opportunity {
  id: string;
  sourceName: string;
  territory: string;
  excerpt: string;
  url?: string;
  tags: string[];
  status: "new" | "watching" | "engaged" | "skipped";
  capturedAt: string; // legacy relative-string fallback for records with no capturedAtMs
  capturedAtMs?: number; // epoch ms — when Farmhand actually captured it; display is computed live from this
  firstTouch: boolean; // first engagement in this source → guardrails apply
  extKey?: string; // dedup key when captured via the Radar extension bridge
  titleFingerprint?: string; // secondary dedup — catches the same real post re-cited under a different URL
  // web-wide Lead Engine metadata (present on auto-hunted opportunities)
  engineScore?: number; // 0-100 intent strength the engine assigned
  platform?: string; // reddit | facebook | quora | forum | x | news | web…
  intent?: string; // buyer | seller | relocation | investor | renter | referral
  why?: string; // one line: why the engine flagged it
  feedback?: "good" | "bad"; // agent's thumbs — trains the engine
}

/**
 * Live relative-time label for when this was captured — computed at render
 * time from capturedAtMs, not frozen as a literal string at capture time.
 * ("just now" used to get baked in permanently for any lead whose source
 * didn't report its own age, making old captures look freshly found.)
 */
export function capturedAtLabel(o: Pick<Opportunity, "capturedAt" | "capturedAtMs">): string {
  if (o.capturedAtMs == null) return o.capturedAt;
  const mins = Math.max(0, Math.round((Date.now() - o.capturedAtMs) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/** Rule-based topic tagging for captured threads. */
export function tagOpportunity(text: string): string[] {
  const t = text.toLowerCase();
  const tags: string[] = [];
  if (/(moving|relocat|out of state|from (chicago|california|seattle|denver|portland))/.test(t)) tags.push("relocation");
  if (/(worth|price|market|sell|value|equity|rates?)/.test(t)) tags.push("market-question");
  // "recommend"/"looking for" alone is too broad — it tags salon and bar posts
  // just as readily as neighborhood ones. Require housing context alongside it.
  const asksForRecommendation = /(recommend|looking for|anyone know|suggestions?)/.test(t);
  const housingContext = /(neighborhood|area|suburb|live|living|house|home|move|moving|relocat|rent|buy|realtor|agent|school|hoa|community)/.test(t);
  if (asksForRecommendation && housingContext) tags.push("recommendation-ask");
  if (/(hoa|school|commute|neighborhood|community|park)/.test(t)) tags.push("neighborhood-chat");
  if (/(agent|realtor|broker)/.test(t)) tags.push("agent-mention");
  return tags.length ? tags : ["general"];
}

/** Relevance: territory + topic + question-shape. Transparent, 0–100. */
export function scoreOpportunity(text: string, territories: string[]): number {
  let s = 30;
  const t = text.toLowerCase();
  if (territories.some((n) => t.includes(n.toLowerCase()))) s += 30;
  if (t.includes("?")) s += 15;
  if (/(recommend|anyone know|looking for|advice)/.test(t)) s += 15;
  if (/(rant|vent|scam|hate)/.test(t)) s -= 20;
  return Math.max(5, Math.min(100, s));
}

/**
 * Fair-housing lint — flags steering / protected-class phrasing before copy.
 * Not legal advice; a guardrail that catches the common mistakes.
 */
const FH_PATTERNS: { re: RegExp; why: string }[] = [
  { re: /\b(great|perfect|ideal) for famil(y|ies)\b/i, why: "familial-status steering — describe the property/area features instead" },
  { re: /\b(safe|good|bad|sketchy|rough) (neighborhood|area|part of town)\b/i, why: "perceived-safety steering — share objective data sources instead" },
  { re: /\b(christian|churches? nearby|temple|mosque)\b/i, why: "religion reference — leave places of worship out of housing talk" },
  { re: /\b(hispanic|latino|black|white|asian|indian) (area|neighborhood|community)\b/i, why: "racial/ethnic composition — never characterize areas by who lives there" },
  { re: /\bno (kids|children)\b/i, why: "familial-status exclusion" },
  { re: /\b(retirees?|seniors? only|young professionals? only)\b/i, why: "age steering — unless a verified 55+ community designation" },
  { re: /\bexclusive (community|neighborhood)\b/i, why: "'exclusive' reads as exclusionary in fair-housing context — try 'sought-after'" },
];

export function fairHousingLint(text: string): { pass: boolean; flags: { match: string; why: string }[] } {
  const flags: { match: string; why: string }[] = [];
  FH_PATTERNS.forEach((p) => {
    const m = text.match(p.re);
    if (m) flags.push({ match: m[0], why: p.why });
  });
  return { pass: flags.length === 0, flags };
}

/**
 * Reply drafting (template-based now; model-assisted later — same signature).
 * Enforces the first-touch rule: no CTA, no links, no pitch on a first
 * engagement in a source. Tone + prospecting mode shape assertiveness.
 */
export function draftReply(opts: {
  excerpt: string;
  tags: string[];
  tone: string[];
  mode: "observer" | "participant" | "connector";
  firstTouch: boolean;
  agentName: string;
  territory: string;
  vertical?: "realtor" | "solar";
}): string {
  const { tags, mode, firstTouch, territory } = opts;
  const warm = opts.tone.includes("warm") || opts.tone.includes("neighborly");
  const data = opts.tone.includes("data-driven") || opts.tone.includes("sharp");

  if (opts.vertical === "solar") {
    let sbody = "";
    if (tags.includes("quote-shopping")) {
      sbody = `The two numbers that cut through quote confusion: price per watt (before incentives) and what the production estimate assumes. If two quotes differ a lot, it's almost always panel count or an inflated production model — happy to share what typical AZ numbers look like right now if that helps.`;
    } else if (tags.includes("bill-pain")) {
      sbody = data
        ? `Worth pulling your last 12 months of usage before deciding anything — the on-peak/off-peak split matters more than the total. Some of that bill is fixable with a rate-plan change alone; the rest is where solar math starts. The utility's own usage export shows it.`
        : `A lot of that is the summer on-peak rates doing the damage. Before anything else, it's worth checking you're on the right rate plan — that's free — and then the solar math gets a lot clearer from your actual usage.`;
    } else if (tags.includes("considering")) {
      sbody = warm
        ? `Honest version from someone in the industry here in AZ: it pencils out for most homeowners with decent sun exposure and a bill over ~$150, and doesn't for everyone — shade, roof age, and how long you'll stay matter more than people expect. Happy to share the questions worth asking any installer.`
        : `The three things that actually decide it in Arizona: your utility's export rate, your roof orientation, and how long you'll own the home. Get those three answered honestly and the decision usually makes itself.`;
    } else if (tags.includes("battery-ev")) {
      sbody = `If you're charging an EV at home, the math changes a lot — off-peak charging plus solar sized for the extra load is a different system than a standard install. Worth making sure any quote actually models the EV usage rather than last year's bill.`;
    } else if (tags.includes("recommendation-ask")) {
      sbody = `A few things worth checking on ANY installer before names even matter: their license/ROC number, whether they sub out the install, and what the workmanship warranty actually covers. Happy to share what separates the good ones — no stake in who you pick.`;
    } else {
      sbody = `Good thread — there's a lot of noise around solar in AZ and questions like this are how people avoid the expensive mistakes.`;
    }
    if (mode === "observer") sbody = sbody.split(". ").slice(0, 2).join(". ") + (sbody.includes(".") ? "." : "");
    if (!firstTouch && mode === "connector" && !tags.includes("general")) {
      sbody += ` If it'd ever help, I'm happy to sanity-check numbers — no pitch, I just do this all day.`;
    }
    // first-touch rule: value only — no CTA, no link, no company-drop. Enforced by construction above.
    return sbody;
  }

  let body = "";
  if (tags.includes("relocation")) {
    body = warm
      ? `Welcome (almost)! I live and work around ${territory} — the honest version: the summer takes adjusting, everything else is easier than people expect. Happy to share the areas people usually compare when they're new.`
      : `A few practical things people moving here wish they'd known: commute patterns matter more than distance, and ${territory} inventory moves in seasonal waves. Glad to share specifics if useful.`;
  } else if (tags.includes("market-question")) {
    body = data
      ? `Depends which slice of ${territory} you mean — the averages hide a lot. Broad strokes: entry inventory is thin, mid-range is negotiable again. If you want, I can point you to the public data I check weekly.`
      : `Short version for ${territory}: it's steadier than the headlines suggest. The public county records are a good gut-check if you want real numbers over vibes.`;
  } else if (tags.includes("recommendation-ask")) {
    body = `A couple of thoughts from someone who spends a lot of time in ${territory} — happy to share what I've seen work. (No stake in any of these, just what neighbors tend to rave about.)`;
  } else {
    body = warm
      ? `Love seeing this kind of thread about ${territory} — this is exactly the stuff that makes the area what it is.`
      : `Useful thread — ${territory} doesn't get enough of this kind of detail.`;
  }

  if (mode === "observer") body = body.split(". ").slice(0, 2).join(". ") + (body.includes(".") ? "." : "");
  if (!firstTouch && mode === "connector" && !tags.includes("general")) {
    body += ` If it'd help, I'm always up for a no-pressure coffee chat about the area — I'm local.`;
  }
  // first-touch rule: value only — no CTA, no link, no title-drop. Enforced by construction above.
  return body;
}
