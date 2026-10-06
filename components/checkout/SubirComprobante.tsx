"use client";
import { useRef, useState } from "react";
import { TAMANO_MAXIMO } from "@/lib/foto-subida";

const LADO_MAXIMO = 2000;

/**
 * Las fotos del celular suelen pasar los 4 MB que acepta el servidor. Se achican acá,
 * antes de subir: un comprobante se lee perfecto a 2000 px. Los PDF van tal cual, y si
 * el navegador no puede procesar la imagen se sube el original.
 */
async function prepararArchivo(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith("image/") || archivo.type === "image/webp") return archivo;
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && archivo.size <= TAMANO_MAXIMO) return archivo;
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);
    lienzo.getContext("2d")?.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    const reducido = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
    return reducido && reducido.size < archivo.size ? reducido : archivo;
  } catch {
    return archivo;
  }
}

interface Props {
  referencia: string;
  /** Cuándo se subió el comprobante, si ya se subió (viene del seguimiento). */
  subidoAt?: string;
  onSubido?: (subidoAt: string) => void;
}

export function SubirComprobante({ referencia, subidoAt, onSubido }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<"quieto" | "subiendo">("quieto");
  const [mensaje, setMensaje] = useState("");
  const [subidoAhora, setSubidoAhora] = useState("");
  const recibido = Boolean(subidoAhora || subidoAt);

  async function alElegir(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    setMensaje("");
    setEstado("subiendo");
    try {
      const listo = await prepararArchivo(archivo);
      if (listo.size > TAMANO_MAXIMO) {
        setMensaje("El archivo pesa más de 4 MB. Probá con una captura de pantalla.");
        return;
      }
      const cuerpo = new FormData();
      cuerpo.append("comprobante", listo, archivo.name);
      const respuesta = await fetch(`/api/orders/${encodeURIComponent(referencia)}/comprobante`, { method: "POST", body: cuerpo });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok || !datos.ok) {
        setMensaje(datos.error || "No se pudo subir el comprobante. Probá de nuevo.");
        return;
      }
      setSubidoAhora(datos.subidoAt || new Date().toISOString());
      onSubido?.(datos.subidoAt);
    } catch {
      setMensaje("Error de conexión. Probá de nuevo.");
    } finally {
      setEstado("quieto");
    }
  }

  const subiendo = estado === "subiendo";

  return (
    <div style={{ marginTop: 12 }}>
      <input ref={entrada} type="file" accept="image/*,application/pdf" onChange={alElegir} style={{ display: "none" }} />
      {recibido && (
        <div role="status" style={{ background: "#eaf5ea", border: "1px solid #b9dcb9", color: "#1f5d23", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
          ✓ Recibimos tu comprobante. Lo estamos verificando y apenas se acredite empezamos tu pedido.
        </div>
      )}
      <button
        type="button"
        disabled={subiendo}
        onClick={() => entrada.current?.click()}
        style={{ width: "100%", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 8, background: recibido ? "white" : "#b2472a", color: recibido ? "#b2472a" : "white", border: recibido ? "1.5px solid #b2472a" : "none", fontWeight: 600, fontSize: 13.5, padding: "10px 16px", borderRadius: 8, cursor: subiendo ? "wait" : "pointer", opacity: subiendo ? 0.7 : 1 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
        {subiendo ? "Subiendo…" : recibido ? "Subir otro comprobante" : "Subir comprobante"}
      </button>
      {!recibido && !mensaje && (
        <small style={{ display: "block", marginTop: 6, color: "#8a7a6b", fontSize: 12, textAlign: "center" }}>Foto, captura o PDF de la transferencia</small>
      )}
      {mensaje && <div role="alert" style={{ marginTop: 8, color: "#c62828", fontSize: 13, textAlign: "center" }}>{mensaje}</div>}
    </div>
  );
}
