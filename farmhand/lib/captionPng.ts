/**
 * DESERT GRID caption card → transparent 720×1280 PNG, rendered with
 * <canvas> so it uses the app's real loaded fonts and exact styling —
 * uploaded to Blob and overlaid by /api/assemble's native ffmpeg pass
 * (no fonts exist server-side; a PNG overlay is pixel-identical anyway).
 * Bold sans in PAPER on a NIGHT pill, centered, pinned inside the reel
 * spec's 380–1420/1920 vertical safe band (scaled: y ≤ 947). ≤6 words
 * per the spec — the wrap is a guardrail, not an invitation.
 */
export async function captionPng(text: string): Promise<Blob | null> {
  try {
    const W = 720;
    const H = 1280;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, W, H);
    ctx.font = "700 44px 'Inter Tight', Geist, -apple-system, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = text.trim().split(/\s+/).slice(0, 10);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const probe = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(probe).width > 620 && cur) {
        lines.push(cur);
        cur = w;
      } else cur = probe;
    }
    if (cur) lines.push(cur);
    const lineH = 58;
    const padX = 26;
    const padY = 16;
    const blockH = lines.length * lineH + padY * 2;
    const bottomY = 900;
    const topY = bottomY - blockH;
    lines.forEach((ln, i) => {
      const w = ctx.measureText(ln).width;
      const y = topY + padY + i * lineH + lineH / 2;
      const pillW = w + padX * 2;
      const pillH = lineH - 6;
      ctx.fillStyle = "rgba(16,24,32,0.74)"; // NIGHT @ 74%
      const x = W / 2 - pillW / 2;
      const py = y - pillH / 2;
      const r = 12;
      ctx.beginPath();
      ctx.moveTo(x + r, py);
      ctx.arcTo(x + pillW, py, x + pillW, py + pillH, r);
      ctx.arcTo(x + pillW, py + pillH, x, py + pillH, r);
      ctx.arcTo(x, py + pillH, x, py, r);
      ctx.arcTo(x, py, x + pillW, py, r);
      ctx.fill();
      ctx.fillStyle = "#F4F0E6"; // PAPER
      ctx.fillText(ln, W / 2, y + 1);
    });
    return await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  } catch {
    return null;
  }
}
