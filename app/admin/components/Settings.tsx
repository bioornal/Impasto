"use client";
import { useStore } from "./StoreProvider";

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
              <div className="field"><label>Teléfono</label><input defaultValue="(0299) 555-0184" /></div>
              <div className="field full"><label>Dirección</label><input defaultValue="Av. Argentina 875, Neuquén Capital" /></div>
              <div className="field full"><label>Horarios</label><input defaultValue="Martes a Domingo · 19:30 — 00:00" /></div>
            </div>
          </div>
          <div>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 6 }}>Zonas de envío</h4>
            <div className="form-grid">
              <div className="field"><label>Centro</label><input defaultValue="3000" /></div>
              <div className="field"><label>Oeste</label><input defaultValue="4000" /></div>
              <div className="field"><label>Este</label><input defaultValue="4500" /></div>
              <div className="field"><label>Norte</label><input defaultValue="5000" /></div>
              <div className="field full"><label>Fuera de capital</label><input defaultValue="6000" /></div>
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
