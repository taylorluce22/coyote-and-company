import Link from "next/link";

/**
 * Branded 404 — the unstyled Next.js default read as broken next to the
 * rest of the app (10K-site checklist: 404 with navigation back).
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#0B0B16",
      }}
    >
      <div
        style={{
          textAlign: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          padding: "42px 48px",
          maxWidth: 440,
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 6 }}>🌵</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: "#F4F3F8", letterSpacing: "-0.02em" }}>404</div>
        <div style={{ fontSize: 14, color: "#A6A4B8", lineHeight: 1.6, margin: "10px 0 24px" }}>
          Nothing out here but desert. The page you&apos;re looking for doesn&apos;t exist — but the app does.
        </div>
        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "#FF9A62",
            color: "#0B0B16",
            borderRadius: 10,
            padding: "12px 28px",
            fontSize: 13.5,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          ← Back to Farmhand
        </Link>
      </div>
    </div>
  );
}
