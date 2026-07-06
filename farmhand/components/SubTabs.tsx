"use client";

export default function SubTabs<T extends string>({
  tabs,
  active,
  color,
  onPick,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  color: string;
  onPick: (id: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 2, background: "rgba(8,8,18,0.6)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: 3, marginBottom: 18 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onPick(t.id)}
          style={{
            border: "none",
            borderRadius: 8,
            padding: "7px 16px",
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: "0.05em",
            fontFamily: "var(--label)",
            textTransform: "uppercase",
            cursor: "pointer",
            background: active === t.id ? `${color}22` : "transparent",
            color: active === t.id ? color : "#8B89A0",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
