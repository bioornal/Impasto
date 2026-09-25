"use client";
import { useEffect, useState } from "react";
import { useStore } from "./StoreProvider";
import { MENSAJE_DELIVERY_DEFAULT } from "@/lib/hours";
import type { CuentaTransferencia } from "@/lib/cuentas-transferencia";

interface Sucursal {
  nombre: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  email: string;
  whatsapp: string;
  horarios: string;
  dias_apertura: string;
  hora_apertura: string;
  hora_cierre: string;
  delivery_fee: number;
  envio_gratis_desde: number;
  ventas_activas: boolean;
  mensaje_cierre: string;
  delivery_activo?: boolean;
  mensaje_delivery?: string;
  cuentas_transferencia?: CuentaTransferencia[];
}

type CampoCuenta = "nombre" | "alias" | "cbu" | "banco" | "titular";

const DIAS: [number, string][] = [
  [1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"], [0, "Dom"],
];

export function Settings() {
  const { reset, showToast } = useStore();
  const [config, setConfig] = useState<Sucursal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/sucursal")
      .then((r) => r.json())
      .then((r) => {
        if (r?.ok && r.data) setConfig(r.data);
        else setError(r?.error || "No se pudo cargar la configuración");
      })
      .catch(() => setError("No se pudo cargar la configuración"))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="panel"><div className="panel-body">Cargando configuración…</div></div>;
  if (!config) return <div className="panel"><div className="panel-body"><div className="co-error">{error}</div></div></div>;

  const set = <K extends keyof Sucursal>(campo: K, valor: Sucursal[K]) =>
    setConfig((c) => (c ? { ...c, [campo]: valor } : c));

  const diasActivos = String(config.dias_apertura || "").split(",").map(Number).filter((n) => !Number.isNaN(n));
  const deliveryActivo = config.delivery_activo !== false;

  // El editor trabaja sobre la lista tal como está, sin filtrarla: una cuenta a
  // medio tipear no puede desaparecer. La valida el servidor al guardar.
  const cuentas = config.cuentas_transferencia ?? [];
  const setCuentas = (siguiente: CuentaTransferencia[]) => set("cuentas_transferencia", siguiente);
  const cambiarCuenta = (id: string, campo: CampoCuenta, valor: string) =>
    setCuentas(cuentas.map((cuenta) => (cuenta.id === id ? { ...cuenta, [campo]: valor } : cuenta)));
  const usarCuenta = (id: string) =>
    setCuentas(cuentas.map((cuenta) => ({ ...cuenta, activa: cuenta.id === id })));
  const quitarCuenta = (cuenta: CuentaTransferencia) => {
    if (!confirm(`¿Quitar la cuenta ${cuenta.nombre || "sin nombre"}?`)) return;
    const restantes = cuentas.filter((otra) => otra.id !== cuenta.id);
    // Si se quita la activa, pasa a serlo la primera que quede: nunca sin cuenta por descuido.
    if (cuenta.activa && restantes.length > 0) restantes[0] = { ...restantes[0], activa: true };
    setCuentas(restantes);
  };
  const agregarCuenta = () =>
    setCuentas([
      ...cuentas,
      { id: crypto.randomUUID(), nombre: "", alias: "", cbu: "", banco: "", titular: "", activa: cuentas.length === 0 },
    ]);

  const alternarDia = (dia: number) => {
    const siguiente = diasActivos.includes(dia)
      ? diasActivos.filter((d) => d !== dia)
      : [...diasActivos, dia];
    set("dias_apertura", siguiente.sort((a, b) => a - b).join(","));
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      const respuesta = await fetch("/api/admin/sucursal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          delivery_fee: Number(config.delivery_fee),
          envio_gratis_desde: Number(config.envio_gratis_desde),
        }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.ok) throw new Error(resultado.error || "No se pudo guardar");
      showToast("Configuración guardada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head"><h3>Configuración</h3></div>
      <div className="panel-body">
        <div style={{ maxWidth: 620, display: "flex", flexDirection: "column", gap: 24 }}>

          <section>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 4 }}>Venta</h4>
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Cortá la venta por vacaciones o imprevistos. Manda por encima del horario:
              con esto apagado no se toman pedidos aunque el local esté en horario.
            </div>
            <button
              className={`btn ${config.ventas_activas ? "btn-success" : "btn-danger"}`}
              onClick={() => set("ventas_activas", !config.ventas_activas)}
            >
              {config.ventas_activas ? "✓ Tomando pedidos" : "✕ Venta pausada"}
            </button>
            {!config.ventas_activas && (
              <div className="field" style={{ marginTop: 12 }}>
                <label>Motivo que ve el cliente</label>
                <input
                  placeholder="Cerramos por vacaciones hasta el 5 de enero"
                  value={config.mensaje_cierre || ""}
                  onChange={(e) => set("mensaje_cierre", e.target.value)}
                />
              </div>
            )}
          </section>

          <section>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 4 }}>Horario de atención</h4>
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              El <b>último pedido</b> es la hora en que el sitio deja de aceptar pedidos, y no
              tiene por qué coincidir con la de cierre del local: si se trabaja hasta las 00:00
              pero el último pedido entra 23:45, poné 23:45 acá y 00:00 en el texto que se muestra.
            </div>
            <div className="flex gap-8" style={{ flexWrap: "wrap", marginBottom: 14 }}>
              {DIAS.map(([dia, etiqueta]) => (
                <button
                  key={dia}
                  className={`btn btn-sm ${diasActivos.includes(dia) ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => alternarDia(dia)}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Abre</label>
                <input type="time" value={config.hora_apertura} onChange={(e) => set("hora_apertura", e.target.value)} />
              </div>
              <div className="field">
                <label>Último pedido</label>
                <input type="time" value={config.hora_cierre} onChange={(e) => set("hora_cierre", e.target.value)} />
              </div>
              <div className="field full">
                <label>Horario que se muestra en el sitio</label>
                <input value={config.horarios} onChange={(e) => set("horarios", e.target.value)} />
              </div>
            </div>
          </section>

          <section>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 4 }}>Delivery</h4>
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Si hoy no podés hacer envíos, pausá el delivery: el sitio sigue vendiendo, pero solo
              para retirar en el local, y el cliente ve el motivo antes de armar su pedido.
            </div>
            <button
              className={`btn ${deliveryActivo ? "btn-success" : "btn-danger"}`}
              onClick={() => set("delivery_activo", !deliveryActivo)}
            >
              {deliveryActivo ? "✓ Haciendo envíos" : "✕ Delivery pausado · solo retiro"}
            </button>
            {!deliveryActivo && (
              <div className="field" style={{ marginTop: 12 }}>
                <label>Motivo que ve el cliente</label>
                <input
                  placeholder={MENSAJE_DELIVERY_DEFAULT}
                  value={config.mensaje_delivery || ""}
                  onChange={(e) => set("mensaje_delivery", e.target.value)}
                />
                <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Si lo dejás vacío, se muestra el texto de ejemplo.
                </div>
              </div>
            )}
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="field">
                <label>Tarifa de envío</label>
                <input type="number" value={config.delivery_fee} onChange={(e) => set("delivery_fee", Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Envío gratis desde</label>
                <input type="number" value={config.envio_gratis_desde} onChange={(e) => set("envio_gratis_desde", Number(e.target.value))} />
              </div>
            </div>
          </section>

          <section>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 10 }}>Datos del local</h4>
            <div className="form-grid">
              <div className="field"><label>Nombre</label><input value={config.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
              <div className="field"><label>Teléfono</label><input value={config.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
              <div className="field"><label>Email</label><input value={config.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="field"><label>WhatsApp</label><input value={config.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
              <div className="field full"><label>Dirección</label><input value={config.direccion} onChange={(e) => set("direccion", e.target.value)} /></div>
              <div className="field full"><label>Ciudad</label><input value={config.ciudad} onChange={(e) => set("ciudad", e.target.value)} /></div>
            </div>
          </section>

          <section>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 4 }}>Cuentas para transferencias</h4>
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Los clientes ven solo la cuenta <b>activa</b>, en la confirmación y en el seguimiento del pedido.
              Cada pedido guarda la cuenta que se le mostró: si cambiás la activa, los pedidos anteriores no cambian.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cuentas.length === 0 && (
                <div className="text-muted" style={{ fontSize: 13 }}>
                  No hay cuentas cargadas: a quien elija transferencia se le pide que consulte los datos por WhatsApp.
                </div>
              )}
              {cuentas.map((cuenta) => (
                <div
                  key={cuenta.id}
                  style={{
                    border: `1px solid ${cuenta.activa ? "var(--a-success)" : "var(--a-line)"}`,
                    background: cuenta.activa ? "var(--a-success-soft)" : "var(--a-surface)",
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <div className="flex gap-8" style={{ alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap" }}>
                    <b style={{ fontSize: 15 }}>{cuenta.nombre || "Cuenta nueva"}</b>
                    <div className="flex gap-8">
                      {cuenta.activa ? (
                        <span className="btn btn-sm btn-success" style={{ cursor: "default" }}>✓ Activa</span>
                      ) : (
                        <button className="btn btn-sm btn-primary" onClick={() => usarCuenta(cuenta.id)}>Usar esta</button>
                      )}
                      <button className="btn btn-sm btn-ghost" onClick={() => quitarCuenta(cuenta)}>Quitar</button>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="field"><label>Nombre corto (lo ves vos)</label><input placeholder="ARQ, AstroPay, Galicia…" value={cuenta.nombre} onChange={(e) => cambiarCuenta(cuenta.id, "nombre", e.target.value)} /></div>
                    <div className="field"><label>Alias</label><input placeholder="MI.ALIAS.BANCARIO" value={cuenta.alias} onChange={(e) => cambiarCuenta(cuenta.id, "alias", e.target.value)} /></div>
                    <div className="field full"><label>CBU / CVU (22 dígitos)</label><input inputMode="numeric" placeholder="0000003100…" value={cuenta.cbu} onChange={(e) => cambiarCuenta(cuenta.id, "cbu", e.target.value)} /></div>
                    <div className="field"><label>Banco / Billetera</label><input placeholder="Nombre del banco o billetera" value={cuenta.banco} onChange={(e) => cambiarCuenta(cuenta.id, "banco", e.target.value)} /></div>
                    <div className="field"><label>Titular</label><input placeholder="Nombre y apellido del titular" value={cuenta.titular} onChange={(e) => cambiarCuenta(cuenta.id, "titular", e.target.value)} /></div>
                  </div>
                </div>
              ))}
              <div>
                <button className="btn btn-ghost btn-sm" onClick={agregarCuenta}>+ Agregar cuenta</button>
              </div>
            </div>
          </section>

          {error && <div className="co-error">{error}</div>}

          <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
            <button className="btn btn-ghost" onClick={() => { if (confirm("¿Recargar datos desde la base?")) reset(); }}>
              Recargar datos
            </button>
          </div>

          <div className="text-muted" style={{ fontSize: 12 }}>
            Los cambios de horario, de venta y de delivery se ven en el sitio en menos de un minuto.
          </div>
        </div>
      </div>
    </div>
  );
}
