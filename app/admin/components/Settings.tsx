"use client";
import { useStore } from "./StoreProvider";
import { BUSINESS, DELIVERY_FEE } from "@/lib/business";

export function Settings() {
  const { reset } = useStore();
  return (
    <div className="panel">
      <div className="panel-head"><h3>Configuración</h3></div>
      <div className="panel-body">
        <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 6 }}>Datos del local</h4>
            <div className="form-grid">
              <div className="field"><label>Nombre</label><input defaultValue="Impasto" /></div>
              <div className="field"><label>Teléfono</label><input defaultValue={BUSINESS.phone} /></div>
              <div className="field"><label>Email</label><input defaultValue={BUSINESS.email} /></div>
              <div className="field full"><label>Dirección</label><input defaultValue={`${BUSINESS.address}, ${BUSINESS.locationLabel}`} /></div>
              <div className="field full"><label>Horarios</label><input defaultValue="Martes a Domingo · 19:30 — 00:00" /></div>
            </div>
          </div>
          <div>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 6 }}>Delivery</h4>
            <div className="form-grid">
              <div className="field"><label>Tarifa única</label><input defaultValue={String(DELIVERY_FEE)} /></div>
              <div className="field"><label>Área</label><input defaultValue={BUSINESS.locationLabel} /></div>
            </div>
          </div>
          <div>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 6 }}>Datos</h4>
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 10 }}>Recarga todos los datos desde InsForge.</div>
            <button className="btn btn-danger" onClick={() => { if (confirm("¿Recargar datos desde la base de datos?")) reset(); }}>
              Recargar datos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
