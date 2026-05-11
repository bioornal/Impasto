"use client";
import { createContext, useContext, useState, useEffect } from "react";

interface Tweaks {
  palette: string;
  typography: string;
  cardStyle: string;
  heroLayout: string;
  cartStyle: string;
  dark: boolean;
}

interface TweakCtx {
  tweaks: Tweaks;
  setKey: (key: keyof Tweaks, value: string | boolean) => void;
  tweaksOn: boolean;
  paletteClass: string;
  typeClass: string;
}

const DEFAULTS: Tweaks = {
  palette: "trattoria",
  typography: "classic",
  cardStyle: "photo",
  heroLayout: "split",
  cartStyle: "drawer",
  dark: false,
};

const TweakCtx = createContext<TweakCtx | null>(null);

export function TweakProvider({ children }: { children: React.ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      return JSON.parse(localStorage.getItem("impasto_tweaks") || "null") || DEFAULTS;
    } catch { return DEFAULTS; }
  });
  const [tweaksOn, setTweaksOn] = useState(false);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setTweaksOn(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOn(false);
    };
    window.addEventListener("message", handler);
    try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch {}
    return () => window.removeEventListener("message", handler);
  }, []);

  const setKey = (key: keyof Tweaks, value: string | boolean) => {
    setTweaks((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("impasto_tweaks", JSON.stringify(next));
      try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [key]: value } }, "*"); } catch {}
      return next;
    });
  };

  const paletteClass = tweaks.dark ? "palette-carbone" : `palette-${tweaks.palette}`;
  const typeClass = `type-${tweaks.typography}`;

  return (
    <TweakCtx.Provider value={{ tweaks, setKey, tweaksOn, paletteClass, typeClass }}>
      {children}
    </TweakCtx.Provider>
  );
}

export const useTweaks = () => {
  const ctx = useContext(TweakCtx);
  if (!ctx) throw new Error("useTweaks must be inside TweakProvider");
  return ctx;
};
