"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * One queue row. "Open in Gmail" is the trigger: it opens the conversation
 * with the draft already in it, so the send is one click away inside Gmail —
 * where the account, the signature and the send authority actually live.
 * The buttons here only record what happened; nothing sends from the app.
 */

export type Item = {
  id: string;
  facility: string;
  email: string;
  stage: string;
  status: string;
  ageDays: number | null;
  gmailUrl: string | null;
};

const C = {
  queued: "#d8c9a3",
  sent: "#7fd18a",
  replied: "#8ab4d1",
  skipped: "#6b6f68",
} as const;

const btn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #2b332c",
  color: "#8a9187",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "inherit",
};

export default function OutreachRow({ item }: { item: Item }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const setStatus = (status: string) => {
    setError(null);
    start(async () => {
      try {
        const r = await fetch("/api/agency/outreach", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, status }),
        });
        const j = await r.json();
        if (!j.ok) {
          setError("not saved");
          return;
        }
        router.refresh();
      } catch {
        setError("not saved");
      }
    });
  };

  const color = C[item.status as keyof typeof C] || "#8a9187";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid #1a201b",
        fontSize: 14,
        opacity: pending ? 0.5 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.facility}
        </div>
        <div style={{ fontSize: 11, color: "#6b6f68" }}>
          {item.email} · {item.stage}
          {item.ageDays !== null && item.status === "queued"
            ? ` · drafted ${item.ageDays}d ago`
            : ""}
        </div>
      </div>

      <span style={{ fontSize: 11, color, minWidth: 56, textAlign: "right" }}>{item.status}</span>

      {item.gmailUrl && (
        <a
          href={item.gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btn, color: "#e8e6df", textDecoration: "none" }}
        >
          Open in Gmail →
        </a>
      )}

      {item.status === "queued" ? (
        <>
          <button style={btn} onClick={() => setStatus("sent")} disabled={pending}>
            Mark sent
          </button>
          <button style={btn} onClick={() => setStatus("skipped")} disabled={pending}>
            Skip
          </button>
        </>
      ) : (
        <button style={btn} onClick={() => setStatus("queued")} disabled={pending}>
          Undo
        </button>
      )}

      {error && <span style={{ fontSize: 11, color: "#d18a8a" }}>{error}</span>}
    </div>
  );
}
