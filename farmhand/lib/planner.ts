/* ============================================================
   planner.ts — Weekly Planner engine (ported from the Coyote
   Content Engine): best-time slots, week auto-planning from a
   brief, Metricool export, and auto-publish payload helpers.
   ============================================================ */

export interface PlannedPost {
  id: string;
  topic: string;
  type: "single" | "carousel" | "story";
  pillar: "market" | "story" | "tips" | "spotlight";
  caption: string;
  hashtags: string[];
  plannedDay: string | null; // mon..sun or null = unscheduled
  status: "draft" | "ready" | "scheduled" | "posted";
}

/* Best posting times per day — single source of truth for display,
   CSV export and auto-publish (same rule as the Coyote system:
   the Nth post on a day takes the Nth slot). */
export const DAYS = [
  { id: "mon", label: "Monday", short: "Mon", slots: ["07:00", "18:00"] },
  { id: "tue", label: "Tuesday", short: "Tue", slots: ["12:00", "19:00"] },
  { id: "wed", label: "Wednesday", short: "Wed", slots: ["08:00", "12:00", "18:00"] },
  { id: "thu", label: "Thursday", short: "Thu", slots: ["08:00", "17:00"] },
  { id: "fri", label: "Friday", short: "Fri", slots: ["07:00", "18:00"] },
  { id: "sat", label: "Saturday", short: "Sat", slots: ["08:00", "12:00", "18:00"] },
  { id: "sun", label: "Sunday", short: "Sun", slots: ["12:00", "19:00"] },
];

export const PILLARS: Record<string, { short: string; color: string }> = {
  market: { short: "Market", color: "#4DA6FF" },
  story: { short: "Story", color: "#FF9A62" },
  tips: { short: "Tips", color: "#37D98A" },
  spotlight: { short: "Spotlight", color: "#B98CFF" },
};

export const TYPE_LABEL: Record<string, string> = {
  single: "Post",
  carousel: "Carousel",
  story: "Story",
};

/* A balanced week: rotates pillars and formats (realtor edition) */
export const WEEK_PLAN: { day: string; pillar: PlannedPost["pillar"]; type: PlannedPost["type"] }[] = [
  { day: "mon", pillar: "market", type: "carousel" },
  { day: "tue", pillar: "tips", type: "single" },
  { day: "wed", pillar: "story", type: "carousel" },
  { day: "thu", pillar: "spotlight", type: "single" },
  { day: "fri", pillar: "market", type: "single" },
  { day: "sat", pillar: "story", type: "story" },
  { day: "sun", pillar: "tips", type: "carousel" },
];

/* Topic seeds per pillar — blended with the week brief when drafting */
const TOPIC_SEEDS: Record<string, string[]> = {
  market: [
    "what actually sold in 85234 this month",
    "the three-price truth about this market",
    "what $520K gets you in Gilbert right now",
  ],
  story: [
    "the closing that took 8 months and 2 heartbreaks",
    "a first-time buyer win worth sharing",
    "the moment the keys change hands",
  ],
  tips: [
    "5 things to check before monsoon season",
    "the 10-minute homeowner check that saves $4K",
    "what buyers notice first at a showing",
  ],
  spotlight: [
    "the lake path that sells Val Vista Lakes",
    "Agritopia in 60 seconds",
    "why Heritage District evenings hit different",
  ],
};

const CAPTION_SHAPES: Record<string, (topic: string, brief: string) => string> = {
  market: (t, b) =>
    `${cap(t)}.\n\nThe numbers tell a cleaner story than the headlines${b ? ` — especially with ${b.toLowerCase()} in play` : ""}.\n\nSave this for your next price conversation.`,
  story: (t, b) =>
    `${cap(t)}.\n\nThis is the part of the job that never gets old${b ? ` — and this week it ties right into ${b.toLowerCase()}` : ""}.\n\nKnow someone house-hunting? Send them this.`,
  tips: (t, b) =>
    `${cap(t)}.\n\n• The quick check most people skip\n• The one that causes 80% of claims\n• The 10-minute fix${b ? `\n\nTimely this week: ${b}` : ""}\n\nSave the checklist.`,
  spotlight: (t, b) =>
    `${cap(t)}.\n\nCurrent listings, HOA truth, and what your money actually gets you here${b ? ` — plus what ${b.toLowerCase()} means for the neighborhood` : ""}.\n\nWant the full breakdown? Comment TOUR.`,
};

const HASHTAG_BANK: Record<string, string[]> = {
  market: ["gilbertaz", "azrealestate", "85234", "marketupdate", "eastvalley", "gilbertrealtor"],
  story: ["gilbertaz", "gilbertrealtor", "welcomehome", "closingday", "eastvalley", "azliving"],
  tips: ["homeownertips", "gilbertaz", "eastvalley", "azliving", "housetips", "gilbertrealtor"],
  spotlight: ["gilbertaz", "valvistalakes", "agritopia", "neighborhoodspotlight", "eastvalley", "azliving"],
};

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

let seedCursor = 0;
export function draftPost(
  day: string,
  pillar: PlannedPost["pillar"],
  type: PlannedPost["type"],
  brief: string,
  id: string
): PlannedPost {
  const seeds = TOPIC_SEEDS[pillar];
  const topic = seeds[seedCursor++ % seeds.length];
  return {
    id,
    topic: cap(topic),
    type,
    pillar,
    caption: CAPTION_SHAPES[pillar](topic, brief.trim()),
    hashtags: HASHTAG_BANK[pillar],
    plannedDay: day,
    status: "draft",
  };
}

/* ---- scheduling math (studio/export/publish all share these) ---- */
const DAY_INDEX: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };

export function nextDateISO(dayId: string): string {
  const target = DAY_INDEX[dayId] ?? 1;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let delta = (target - d.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  d.setDate(d.getDate() + delta);
  return (
    d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
  );
}

function addMin(hhmm: string, mins: number): string {
  const p = hhmm.split(":").map(Number);
  let t = (p[0] || 0) * 60 + (p[1] || 0) + mins;
  t = Math.max(0, Math.min(t, 23 * 60 + 45));
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
}

export function slotHHMM(dayId: string, index: number): string {
  const d = DAYS.find((x) => x.id === dayId);
  const slots = d?.slots || ["09:00"];
  if (index < slots.length) return slots[index];
  return addMin(slots[slots.length - 1], (index - slots.length + 1) * 120);
}

export function fmtTime12(hhmm: string): string {
  const p = hhmm.split(":").map(Number);
  let h = p[0] || 0;
  const m = p[1] || 0;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return h + (m ? ":" + String(m).padStart(2, "0") : "") + " " + ap;
}

/* ---- Metricool export / auto-publish helpers ---- */
export function captionText(p: PlannedPost): string {
  const tags = p.hashtags.map((h) => "#" + h).join(" ");
  return (p.caption + (tags ? "\n\n" + tags : "")).trim();
}

export const igType = (t: string) => (t === "story" ? "Story" : "Post");

const csvCell = (s: unknown) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';

export function metricoolCSV(queue: { post: PlannedPost; dayId: string; slotIdx: number }[]): string {
  const header = ["Text", "Date", "Time", "Instagram", "Type", "Picture URL 1"];
  const rows = queue.map(({ post, dayId, slotIdx }) => [
    captionText(post),
    nextDateISO(dayId),
    slotHHMM(dayId, slotIdx) + ":00",
    "TRUE",
    igType(post.type),
    "",
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

/* Unsigned Cloudinary upload of a data URL → public https URL (free tier) */
export async function cloudinaryUpload(
  dataURL: string,
  cfg: { cloudName: string; uploadPreset: string }
): Promise<string> {
  const fd = new FormData();
  fd.append("file", dataURL);
  fd.append("upload_preset", cfg.uploadPreset);
  const res = await fetch("https://api.cloudinary.com/v1_1/" + cfg.cloudName + "/image/upload", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    let m = "";
    try {
      m = (await res.json()).error.message;
    } catch {}
    throw new Error("Cloudinary: " + (m || res.status));
  }
  const j = await res.json();
  return j.secure_url as string;
}

export interface Integrations {
  cloudName: string;
  uploadPreset: string;
  makeWebhook: string;
  timezone: string;
  autoPublish: boolean;
}

/* Seed content — the engine queue as plannable posts */
export const SEED_POSTS: PlannedPost[] = [
  {
    id: "p-e1",
    topic: "What Gilbert homes actually sold for in June",
    type: "carousel",
    pillar: "market",
    caption:
      "What Gilbert homes actually sold for in June.\n\n12 closings in 85234 last month. Median: $487K — up 2.1% from May.\n\nThe three that went over asking all had one thing in common.\n\nSave this for your next price conversation.",
    hashtags: ["gilbertaz", "azrealestate", "85234", "marketupdate", "eastvalley"],
    plannedDay: "mon",
    status: "ready",
  },
  {
    id: "p-e2",
    topic: "I handed the Ramirez family their keys today",
    type: "single",
    pillar: "story",
    caption:
      "I handed the Ramirez family their keys today.\n\nWe searched for eight months. Two heartbreaks, one perfect backyard for the twins.\n\nThis is my favorite part of the job. Welcome home. 🔑",
    hashtags: ["gilbertaz", "welcomehome", "closingday", "gilbertrealtor"],
    plannedDay: "wed",
    status: "draft",
  },
  {
    id: "p-e3",
    topic: "Monsoon roof check: 5 things to look at this weekend",
    type: "carousel",
    pillar: "tips",
    caption:
      "Monsoon roof check: 5 things to look at this weekend.\n\n• Scuppers and flat-roof drains\n• Tile slippage on the south face\n• Vent flashing — causes 80% of claims\n• Overhanging mesquite branches\n• Coating cracks\n\nTen minutes now beats a $4,000 ceiling repair in August.",
    hashtags: ["homeownertips", "gilbertaz", "monsoonseason", "eastvalley"],
    plannedDay: null,
    status: "draft",
  },
  {
    id: "p-e4",
    topic: "Val Vista Lakes evening walk — neighborhood spotlight",
    type: "single",
    pillar: "spotlight",
    caption:
      "Val Vista Lakes evening walk — neighborhood spotlight.\n\nThe lake path at 6pm is why my buyers keep asking about this neighborhood.\n\nCurrent listings, HOA truth, and what $520K gets you here.\n\nWant the breakdown? Comment TOUR.",
    hashtags: ["valvistalakes", "gilbertaz", "neighborhoodspotlight", "eastvalley"],
    plannedDay: null,
    status: "draft",
  },
];
