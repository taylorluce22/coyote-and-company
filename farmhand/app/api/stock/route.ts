import { NextRequest, NextResponse } from "next/server";

/* ============================================================
   Server-side stock proxy — keys live in environment variables
   (set once in Vercel → connected forever, on every device):
     PEXELS_API_KEY · PIXABAY_API_KEY · UNSPLASH_ACCESS_KEY
   GET /api/stock            → which providers are configured
   GET /api/stock?q=...&n=8  → search all configured providers
   ============================================================ */

export const dynamic = "force-dynamic";

interface StockPhoto {
  key: string;
  provider: "PEXELS" | "PIXABAY" | "UNSPLASH";
  thumb: string;
  full: string;
  by: string;
}

const keys = () => ({
  pexels: process.env.PEXELS_API_KEY || "",
  pixabay: process.env.PIXABAY_API_KEY || "",
  unsplash: process.env.UNSPLASH_ACCESS_KEY || "",
});

async function searchPexels(key: string, q: string, n: number): Promise<StockPhoto[]> {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${n}&orientation=portrait`,
    { headers: { Authorization: key }, next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  interface P { id: number; photographer: string; src: { tiny?: string; medium?: string; portrait?: string; large2x?: string; large?: string } }
  return ((data.photos || []) as P[]).map((p) => ({
    key: "px-" + p.id,
    provider: "PEXELS" as const,
    thumb: p.src.tiny || p.src.medium || "",
    full: p.src.portrait || p.src.large2x || p.src.large || "",
    by: p.photographer,
  }));
}

async function searchPixabay(key: string, q: string, n: number): Promise<StockPhoto[]> {
  const res = await fetch(
    `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&per_page=${n}&orientation=vertical&image_type=photo&safesearch=true`,
    { next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  interface H { id: number; previewURL: string; webformatURL: string; largeImageURL?: string; user: string }
  return ((data.hits || []) as H[]).map((h) => ({
    key: "pb-" + h.id,
    provider: "PIXABAY" as const,
    thumb: h.previewURL || h.webformatURL,
    full: h.largeImageURL || h.webformatURL,
    by: h.user,
  }));
}

async function searchUnsplash(key: string, q: string, n: number): Promise<StockPhoto[]> {
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${n}&orientation=portrait&client_id=${encodeURIComponent(key)}`,
    { next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  interface U { id: string; urls: { thumb: string; small: string; regular: string }; user: { name: string } }
  return ((data.results || []) as U[]).map((p) => ({
    key: "us-" + p.id,
    provider: "UNSPLASH" as const,
    thumb: p.urls.thumb || p.urls.small,
    full: p.urls.regular,
    by: p.user.name,
  }));
}

export async function GET(req: NextRequest) {
  const k = keys();
  const q = req.nextUrl.searchParams.get("q");

  // status: which providers are configured app-side
  if (!q) {
    return NextResponse.json({
      pexels: !!k.pexels,
      pixabay: !!k.pixabay,
      unsplash: !!k.unsplash,
    });
  }

  const n = Math.min(15, Math.max(1, parseInt(req.nextUrl.searchParams.get("n") || "8", 10) || 8));
  const jobs: Promise<StockPhoto[]>[] = [];
  if (k.pexels) jobs.push(searchPexels(k.pexels, q, n).catch(() => []));
  if (k.pixabay) jobs.push(searchPixabay(k.pixabay, q, n).catch(() => []));
  if (k.unsplash) jobs.push(searchUnsplash(k.unsplash, q, n).catch(() => []));
  const lists = await Promise.all(jobs);
  return NextResponse.json({ lists });
}
