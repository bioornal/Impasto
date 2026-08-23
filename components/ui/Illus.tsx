"use client";
import { useState } from "react";
import { getEmpanadaImage, getDrinkImage, STOCK_IMAGES } from "@/lib/stock-images";

/* Ilustraciones generativas con soporte de imágenes fotográficas reales de banco de imágenes */

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

function seedOf(id: string) {
  return [...id].reduce((a, c) => a + c.charCodeAt(0), 0) || 7;
}

function randomizer(seed: number) {
  return (n: number) => {
    const x = Math.sin(seed * 9999 + n * 137) * 10000;
    return r4(x - Math.floor(x));
  };
}

const fill: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

export function EmpanadaIllus({ id = "e01", name = "", src }: { id?: string; name?: string; src?: string }) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = src || getEmpanadaImage(name, id);

  if (!hasError && imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name || "Empanada"}
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

  const seed = seedOf(id);
  const rand = randomizer(seed);
  const doughs = [
    { a: "#f3d9a5", b: "#d9ab5f", edge: "#b8843c", bg1: "#fbeed2", bg2: "#e9cfa2" },
    { a: "#f7e2b6", b: "#dfb469", edge: "#a97733", bg1: "#fdf1dc", bg2: "#e5c692" },
    { a: "#eed5a0", b: "#cf9f54", edge: "#a06f2c", bg1: "#f8e9cd", bg2: "#dfbb84" },
  ];
  const s = doughs[seed % doughs.length];
  const marks = Array.from({ length: 7 }, (_, i) => r4(28 + i * 7 + rand(i) * 2));

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={fill} aria-hidden>
      <defs>
        <linearGradient id={`ebg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={s.bg1} />
          <stop offset="100%" stopColor={s.bg2} />
        </linearGradient>
        <linearGradient id={`edo-${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={s.a} />
          <stop offset="100%" stopColor={s.b} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#ebg-${id})`} />
      <ellipse cx="50" cy="72" rx="30" ry="5" fill="rgba(90,55,20,.12)" />
      <path
        d="M22 60c0-19 13-32 28-32s28 13 28 32c0 6-4 9-10 9H32c-6 0-10-3-10-9Z"
        fill={`url(#edo-${id})`}
        stroke={s.edge}
        strokeWidth="1.2"
      />
      {marks.map((x, i) => (
        <path key={i} d={`M${x} 69c2-4 5-4 7 0`} fill="none" stroke={s.edge} strokeWidth="1.3" strokeLinecap="round" opacity=".75" />
      ))}
      <path d="M34 42c5-6 12-9 20-8" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2" strokeLinecap="round" />
      {Array.from({ length: 4 }, (_, i) => (
        <circle key={i} cx={r4(34 + rand(i + 40) * 32)} cy={r4(44 + rand(i + 60) * 16)} r={r4(.9 + rand(i + 80))} fill={s.edge} opacity=".35" />
      ))}
    </svg>
  );
}

export function DrinkIllus({ id = "b01", label = "", name = "", src }: { id?: string; label?: string; name?: string; src?: string }) {
  const [hasError, setHasError] = useState(false);
  const drinkName = name || label;
  const imageUrl = src || getDrinkImage(drinkName, id);

  if (!hasError && imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={drinkName || "Bebida"}
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

  const seed = seedOf(id + label);
  const palettes = [
    { body: "#7c1e1e", cap: "#2c1810", bg1: "#f7e6d3", bg2: "#e3c39a" },
    { body: "#1f5136", cap: "#0f2a1c", bg1: "#eaf0e2", bg2: "#c8d4b6" },
    { body: "#2c4a7c", cap: "#152743", bg1: "#e6edf6", bg2: "#bccbe0" },
    { body: "#a4681c", cap: "#4a2d09", bg1: "#fbeeda", bg2: "#e4c692" },
  ];
  const s = palettes[seed % palettes.length];
  const short = (label || "").split(" ")[0].slice(0, 8);

  return (
    <svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMid slice" style={fill} aria-hidden>
      <defs>
        <linearGradient id={`dbg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={s.bg1} />
          <stop offset="100%" stopColor={s.bg2} />
        </linearGradient>
        <linearGradient id={`dbo-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={s.body} stopOpacity=".82" />
          <stop offset="42%" stopColor={s.body} />
          <stop offset="100%" stopColor={s.cap} />
        </linearGradient>
      </defs>
      <rect width="100" height="130" fill={`url(#dbg-${id})`} />
      <ellipse cx="50" cy="116" rx="24" ry="4" fill="rgba(60,35,10,.14)" />
      <rect x="44" y="14" width="12" height="12" rx="2" fill={s.cap} />
      <path d="M43 26h14l6 14v66a6 6 0 0 1-6 6H43a6 6 0 0 1-6-6V40Z" fill={`url(#dbo-${id})`} />
      <rect x="37" y="58" width="26" height="26" rx="3" fill="rgba(255,250,240,.92)" />
      <text
        x="50"
        y="74"
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontSize="7"
        letterSpacing="0.5"
        fill={s.cap}
      >
        {short.toUpperCase()}
      </text>
      <rect x="41" y="32" width="3" height="70" rx="1.5" fill="rgba(255,255,255,.22)" />
    </svg>
  );
}

/** Escena fotográfica o cálida abstracta para los espacios que en el diseño llevan foto. */
export function SceneIllus({ id = "scene", tone = "warm", src }: { id?: string; tone?: "warm" | "dark" | "ember"; src?: string }) {
  const [hasError, setHasError] = useState(false);
  const defaultSrc = tone === "dark" ? STOCK_IMAGES.story.dough : STOCK_IMAGES.promo.hero;
  const imageUrl = src || defaultSrc;

  if (!hasError && imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="Escena Impasto"
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

  const seed = seedOf(id);
  const rand = randomizer(seed);
  const tones = {
    warm: { a: "#f3d9a5", b: "#c98a45", c: "#8a4a1e", glow: "rgba(255,220,150,.55)" },
    dark: { a: "#3a2f24", b: "#241c15", c: "#0f0c09", glow: "rgba(198,154,74,.4)" },
    ember: { a: "#c9532f", b: "#8f3720", c: "#3a150c", glow: "rgba(255,180,110,.45)" },
  } as const;
  const s = tones[tone];

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={fill} aria-hidden>
      <defs>
        <radialGradient id={`sc-${id}`} cx="62%" cy="28%" r="88%">
          <stop offset="0%" stopColor={s.a} />
          <stop offset="55%" stopColor={s.b} />
          <stop offset="100%" stopColor={s.c} />
        </radialGradient>
        <radialGradient id={`sg-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={s.glow} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#sc-${id})`} />
      <circle cx="66" cy="30" r="42" fill={`url(#sg-${id})`} opacity=".8" />
      {Array.from({ length: 26 }, (_, i) => (
        <circle
          key={i}
          cx={r4(rand(i) * 100)}
          cy={r4(rand(i + 50) * 100)}
          r={r4(.6 + rand(i + 100) * 1.8)}
          fill="rgba(255,240,210,.28)"
        />
      ))}
      <path
        d={`M-5 ${72 + rand(3) * 8}Q30 ${58 + rand(4) * 10} 60 ${74 + rand(5) * 8}T108 ${70 + rand(6) * 8}V105H-5Z`}
        fill="rgba(20,12,6,.32)"
      />
    </svg>
  );
}
