"use client";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import { EstadoLocal } from "./EstadoLocal";

export function Topbar({ title, subtitle, onMenu, onEstado, buscador, right }: {
  title: string; subtitle: string; onMenu: () => void; onEstado: () => void; buscador?: React.ReactNode; right?: React.ReactNode;
}) {
  const { soundEnabled, toggleSound } = useStore();
  return (
    <header className="topbar">
      <button className="sidebar-toggle" onClick={onMenu} aria-label="Abrir el menú"><Icon.Menu /></button>
      <h1>{title}{subtitle && <small>{subtitle}</small>}</h1>
      <EstadoLocal onIr={onEstado} />
      <div className="topbar-spacer" />
      {buscador}
      <button
        className={`btn btn-sm ${soundEnabled ? "btn-ghost" : "btn-muted"}`}
        onClick={toggleSound}
        title={soundEnabled ? "Sonido de pedidos nuevos activado (clic para silenciar)" : "Sonido silenciado (clic para activar)"}
      >
        {soundEnabled ? <Icon.Volume2 /> : <Icon.VolumeX />}
        <span>{soundEnabled ? "Sonido" : "Silenciado"}</span>
      </button>
      {right}
    </header>
  );
}
