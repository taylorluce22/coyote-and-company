/**
 * Neighborhood activity feeds — the realtime shell.
 *
 * Every neighborhood card on the dashboard drills into a timestamped feed of
 * the realtor's activity in that area: listings, Facebook page posts, group
 * threads, Nextdoor mentions, Instagram posts.
 *
 * TODAY this returns demo data through the exact same async interface the
 * live version will use. WHEN REAL ACCOUNTS ARE CONNECTED, only the body of
 * `fetchNeighborhoodFeed` changes — each source below maps to one API:
 *
 *   facebook  → Facebook Graph API  (page posts + group activity, filtered
 *               by the group ↔ neighborhood mapping in Active Groups)
 *   instagram → Instagram Graph API (media tagged/located in the area)
 *   nextdoor  → Nextdoor business feed (posts + recommendations)
 *   mls       → MLS/IDX feed (agent's active + new listings in the
 *               neighborhood polygon)
 *
 * The UI never talks to those APIs directly — it only ever calls
 * fetchNeighborhoodFeed(), so wiring real accounts requires zero UI changes.
 */

export type FeedKind = "listing" | "facebook" | "group" | "nextdoor" | "instagram";

export interface FeedItem {
  id: string;
  kind: FeedKind;
  title: string;
  detail: string;
  /** minutes before "now" — the live version supplies real timestamps */
  minsAgo: number;
  source: string;
}

export interface FeedSourceDef {
  key: "facebook" | "instagram" | "nextdoor" | "mls";
  label: string;
  color: string;
  /** flips true once the account is connected in Settings */
  connected: boolean;
}

export const FEED_SOURCES: FeedSourceDef[] = [
  { key: "facebook", label: "Facebook", color: "#7DA7FF", connected: false },
  { key: "instagram", label: "Instagram", color: "#FF8FC0", connected: false },
  { key: "nextdoor", label: "Nextdoor", color: "#41D98A", connected: false },
  { key: "mls", label: "MLS / Listings", color: "#FFC23D", connected: false },
];

export const KIND_META: Record<FeedKind, { icon: string; label: string; color: string }> = {
  listing: { icon: "⌂", label: "Listing", color: "#FFC23D" },
  facebook: { icon: "ƒ", label: "Facebook", color: "#7DA7FF" },
  group: { icon: "⚇", label: "Group", color: "#C9A8FF" },
  nextdoor: { icon: "✦", label: "Nextdoor", color: "#41D98A" },
  instagram: { icon: "◉", label: "Instagram", color: "#FF8FC0" },
};

const DEMO_FEEDS: Record<string, Omit<FeedItem, "id">[]> = {
  "val-vista-lakes": [
    { kind: "listing", title: "New listing live — 4bd/3ba on E Lakeview Dr · $739K", detail: "Photos published · open house Sat 10–1", minsAgo: 42, source: "MLS" },
    { kind: "facebook", title: "Post reached 412 neighbors", detail: "“Monsoon prep for lakefront homes” — 31 reactions, 6 shares", minsAgo: 150, source: "Facebook Page" },
    { kind: "group", title: "3 new replies in Val Vista Lakes Neighbors", detail: "HOA dock-rules thread you answered is still active", minsAgo: 210, source: "Facebook Group" },
    { kind: "nextdoor", title: "New recommendation", detail: "“Jess helped us close in 21 days — knows every street here.”", minsAgo: 1360, source: "Nextdoor" },
    { kind: "instagram", title: "Reel saved 18 times", detail: "Lakeshore sunset walk-through — saves beat likes 2:1", minsAgo: 2900, source: "Instagram" },
  ],
  agritopia: [
    { kind: "group", title: "You were mentioned in Agritopia Neighbors", detail: "“Ask Jess — she posted the farm-stand schedule last month”", minsAgo: 65, source: "Facebook Group" },
    { kind: "facebook", title: "Spotlight post scheduled", detail: "Joe's Farm Grill feature queued for Jul 8, 5:30 PM", minsAgo: 480, source: "Facebook Page" },
    { kind: "listing", title: "Buyer inquiry on Garden District bungalow", detail: "Pre-approved · wants weekend showing", minsAgo: 1180, source: "MLS" },
    { kind: "instagram", title: "Story poll closed — 89 votes", detail: "“Coffee at Peixoto or Bergies?” · 62% Peixoto", minsAgo: 1750, source: "Instagram" },
  ],
  "85234-core": [
    { kind: "facebook", title: "Market post published", detail: "“85234 median hit $487K in June” carousel — 1.2K reach", minsAgo: 95, source: "Facebook Page" },
    { kind: "listing", title: "Price improvement — Vaughn Ave townhome", detail: "$415K → $399K · refreshed listing card posted", minsAgo: 520, source: "MLS" },
    { kind: "group", title: "Answered “what actually sold” question", detail: "85234 Local Chat — your comment pinned by admin", minsAgo: 1420, source: "Facebook Group" },
  ],
  "heritage-district": [
    { kind: "group", title: "Global Village Festival thread heating up", detail: "Gilbert Neighbors — 47 comments · your meetup reply got 12 likes", minsAgo: 55, source: "Facebook Group" },
    { kind: "facebook", title: "Event RSVP'd", detail: "Global Village Festival · Jul 12 — neighborhood-spotlight post queued", minsAgo: 300, source: "Facebook Page" },
    { kind: "instagram", title: "Water-tower reel hit 2.4K plays", detail: "Downtown date-night guide — best performer this month", minsAgo: 2100, source: "Instagram" },
  ],
  "power-ranch": [
    { kind: "group", title: "Quiet 3 weeks in Power Ranch Nextdoor", detail: "Re-engagement post drafted and waiting in your Engine queue", minsAgo: 30, source: "Autopilot" },
    { kind: "nextdoor", title: "Neighbor asked about backyard ADUs", detail: "Unanswered 2 days — good expertise window", minsAgo: 2980, source: "Nextdoor" },
    { kind: "listing", title: "Sold — The Knolls comp closed at $612K", detail: "4bd/2.5ba · 9 days on market · comp card ready to share", minsAgo: 4300, source: "MLS" },
  ],
  "paradise-valley": [
    { kind: "listing", title: "Luxury listing inquiry — golf-course lot", detail: "Relocation buyer · budget $2.1M · wants fairway views", minsAgo: 80, source: "MLS" },
    { kind: "facebook", title: "Post reached 890 in PV Luxury Homes", detail: "“What $2M buys on the fairway” — 3 DMs opened", minsAgo: 610, source: "Facebook Group" },
    { kind: "instagram", title: "Carousel shared by golf-club account", detail: "Clubhouse-to-close story — 44 profile visits", minsAgo: 1500, source: "Instagram" },
  ],
};

/**
 * The one seam between the UI and the outside world.
 * Swap the body for real API calls when accounts connect — the signature,
 * ordering (newest first), and shape stay identical.
 */
export async function fetchNeighborhoodFeed(slug: string): Promise<FeedItem[]> {
  // simulate network latency so the UI's loading state is real
  await new Promise((r) => setTimeout(r, 220 + Math.random() * 260));
  const rows = DEMO_FEEDS[slug] ?? [];
  return rows
    .map((r, i) => ({ ...r, id: `${slug}-${i}` }))
    .sort((a, b) => a.minsAgo - b.minsAgo);
}

/** "42m ago" / "3h ago" / "2d ago" + resolved clock time, from minutes-ago */
export function feedTime(minsAgo: number): { rel: string; clock: string } {
  const rel = minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.round(minsAgo / 60)}h ago` : `${Math.round(minsAgo / 1440)}d ago`;
  const d = new Date(Date.now() - minsAgo * 60000);
  const clock = d.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  return { rel, clock };
}
