"use client";

interface InterruptorProps {
  checked: boolean;
  label: string;
  /** Debajo del nombre: "Tomando pedidos", "Agotada", etc. */
  detalle?: string;
  disabled?: boolean;
  title?: string;
  onChange: (valor: boolean) => void;
}

/** Interruptor accesible del Arranque: todo el recuadro es el botón. */
export function Interruptor({ checked, label, detalle, disabled, title, onChange }: InterruptorProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`int ${checked ? "" : "apagado"}`}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!checked)}
    >
      <span className="int-text"><b>{label}</b>{detalle && <small>{detalle}</small>}</span>
      <span className="int-track" aria-hidden="true" />
    </button>
  );
}
