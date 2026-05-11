import type { AdminProduct } from "./types";

export function ProductThumb({ item }: { item: AdminProduct }) {
  if (item.type === "pizza") {
    const seed = [...(item.id || "x")].reduce((a, c) => a + c.charCodeAt(0), 0);
    const colors = [
      { cheese: "#efc77a", top: "#b5381f", top2: "#3e5b3a" },
      { cheese: "#e9c180", top: "#8a2f18", top2: "#4a6a2e" },
      { cheese: "#f1cc85", top: "#a03a1c", top2: "#2f4d26" },
    ];
    const c = colors[seed % colors.length];
    return (
      <svg viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="#b57a3a" />
        <circle cx="20" cy="20" r="13" fill={c.cheese} />
        <circle cx="15" cy="17" r="1.8" fill={c.top} />
        <circle cx="23" cy="15" r="1.5" fill={c.top} />
        <circle cx="22" cy="23" r="1.5" fill={c.top2} />
        <circle cx="16" cy="24" r="1.3" fill={c.top2} />
        <circle cx="26" cy="22" r="1.5" fill={c.top} />
      </svg>
    );
  }
  if (item.type === "empanada") {
    return (
      <svg viewBox="0 0 40 40">
        <ellipse cx="20" cy="22" rx="14" ry="9" fill="#d39a54" />
        <path d="M 8 22 Q 8 18 11 17 Q 14 16 17 15.5 L 17 14 L 19 15 L 21 14 L 21 15.5 Q 26 16 29 17 Q 32 18 32 22" fill="#e5b774" />
        <path d="M 6 21 L 34 21" stroke="#a06328" strokeWidth="1" strokeDasharray="2 2" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40">
      <rect x="14" y="8" width="12" height="26" rx="2" fill="#2a2a2a" />
      <rect x="16" y="14" width="8" height="16" rx="1" fill="#555" />
    </svg>
  );
}
