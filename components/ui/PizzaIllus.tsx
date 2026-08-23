"use client";
import { useState } from "react";
import { getPizzaImage } from "@/lib/stock-images";

interface PizzaIllusProps {
  id?: string;
  name?: string;
  tags?: string[];
  src?: string;
}

export function PizzaIllus({ id = "p01", name = "", tags = [], src }: PizzaIllusProps) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = src || getPizzaImage(name, id, tags);

  if (!hasError && imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name || "Pizza"}
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    );
  }

  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  const rand = (n: number) => {
    const x = Math.sin(seed * 9999 + n * 137) * 10000;
    return r4(x - Math.floor(x));
  };
  const schemes = [
    { cheese: "#efc77a", crust: "#b57a3a", crustDark: "#7a4720", top: "#b5381f", top2: "#3e5b3a", bg1: "#fff3d8", bg2: "#f1c87d" },
    { cheese: "#e9c180", crust: "#a66a2d", crustDark: "#6b3e18", top: "#8a2f18", top2: "#4a6a2e", bg1: "#fbe7c4", bg2: "#e0a965" },
    { cheese: "#f1cc85", crust: "#9c5f26", crustDark: "#5e3617", top: "#a03a1c", top2: "#2f4d26", bg1: "#fff0d0", bg2: "#efb679" },
    { cheese: "#e2b86f", crust: "#8a5324", crustDark: "#5a3317", top: "#c85635", top2: "#566b2f", bg1: "#f6dfa6", bg2: "#d9a858" },
    { cheese: "#f3d089", crust: "#b47a36", crustDark: "#734214", top: "#c94829", top2: "#4d6531", bg1: "#fde8c0", bg2: "#e4b472" },
  ];
  const s = schemes[seed % schemes.length];
  const count = 8 + (seed % 5);
  const toppings = Array.from({ length: count }, (_, i) => {
    const angle = rand(i) * Math.PI * 2;
    const radius = 6 + rand(i + 100) * 22;
    return { cx: r4(50 + Math.cos(angle) * radius), cy: r4(50 + Math.sin(angle) * radius), r: r4(2 + rand(i + 200) * 2.2), color: rand(i + 300) > 0.5 ? s.top : s.top2 };
  });
  const leaves = Array.from({ length: 3 + (seed % 3) }, (_, i) => {
    const angle = rand(i + 400) * Math.PI * 2;
    const radius = 8 + rand(i + 500) * 18;
    return { cx: r4(50 + Math.cos(angle) * radius), cy: r4(50 + Math.sin(angle) * radius), rot: r4(rand(i + 600) * 360) };
  });

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id={`bg-${id}`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={s.bg1} />
          <stop offset="100%" stopColor={s.bg2} />
        </radialGradient>
        <radialGradient id={`cheese-${id}`} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#fbe3a0" />
          <stop offset="100%" stopColor={s.cheese} />
        </radialGradient>
        <pattern id={`texture-${id}`} x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.4" fill="rgba(255,200,100,.35)" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill={`url(#bg-${id})`} />
      <circle cx="50" cy="50" r="38" fill={s.crustDark} />
      <circle cx="50" cy="50" r="36" fill={s.crust} />
      <circle cx="50" cy="50" r="31" fill={`url(#cheese-${id})`} />
      <circle cx="50" cy="50" r="31" fill={`url(#texture-${id})`} />
      {[...Array(5)].map((_, i) => {
        const a = rand(i + 700) * Math.PI * 2;
        const r = rand(i + 800) * 24;
        return <ellipse key={"s" + i} cx={r4(50 + Math.cos(a) * r)} cy={r4(50 + Math.sin(a) * r)} rx={r4(3 + rand(i + 900) * 2)} ry={r4(2 + rand(i + 910) * 1.5)} fill="#c94829" opacity={0.22} />;
      })}
      {toppings.map((t, i) => <circle key={"t" + i} cx={t.cx} cy={t.cy} r={t.r} fill={t.color} />)}
      {leaves.map((l, i) => <ellipse key={"l" + i} cx={l.cx} cy={l.cy} rx="2.4" ry="1.2" fill="#3e5b3a" transform={`rotate(${l.rot} ${l.cx} ${l.cy})`} />)}
      {[0, 45, 90, 135].map((d, i) => (
        <line key={"sl" + i} x1="50" y1="50" x2={50 + Math.cos(d * Math.PI / 180) * 31} y2={50 + Math.sin(d * Math.PI / 180) * 31} stroke="rgba(120,60,20,.15)" strokeWidth={0.4} />
      ))}
      <ellipse cx="38" cy="32" rx="14" ry="6" fill="white" opacity={0.1} />
    </svg>
  );
}
