"use client";
import { useEffect, useState } from "react";
import { useSucursal, type Sucursal } from "./SucursalProvider";
import type { CuentaTransferencia } from "@/lib/cuentas-transferencia";

type CampoCuenta = "nombre" | "alias" | "cbu" | "banco" | "titular";

type Pestana = "horario" | "delivery" | "datos" | "cuentas";

const PESTANAS: [Pestana, string][] = [
  ["horario", "Horario"],
  ["delivery", "Delivery"],
  ["datos", "Datos del local"],
  ["cuentas", "Cuentas para transferencias"],
];

const CAMPOS: Record<Pestana, (keyof Sucursal)[]> = {
  horario: ["dias_apertura", "hora_apertura", "hora_cierre", "horarios"],
  delivery: ["delivery_fee", "envio_gratis_desde"],
  datos: ["nombre", "telefono", "email", "whatsapp", "direccion", "ciudad"],
  cuentas: ["cuentas_transferencia"],
};

const camposDe = (p: Pestana, c: Sucursal) => Object.fromEntries(CAMPOS[p].map((k) => [k, c[k]]));

const DIAS: [number, string][] = [
  [1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"], [0, "Dom"],
];

export function Settings() {
  const { sucursal, cargando, error, recargar, guardar } = useSucursal();
  const [pestana, setPestana] = useState<Pestana>("horario");
  const [guardando, setGuardando] = useState(false);
  // `base` es la última versión del servidor que el borrador conoce; `config` es lo que se está editando.
  const [base, setBase] = useState<Sucursal | null>(sucursal);
  const [config, setConfig] = useState<Sucursal | null>(sucursal);

  const sucio =
    !!config && !!base &&
    JSON.stringify(camposDe(pestana, config)) !== JSON.stringify(camposDe(pestana, base));

  // La sucursal cambia de identidad al llegar, al volver a la pestaña y cuando el Arranque mueve un
  // interruptor. Sin cambios sin guardar en esta pestaña, el borrador la sigue; con cambios, no se pisa.
  // Se compara por identidad y se ajusta una sola vez: tras el ajuste `base === sucursal`.
  if (sucursal && base !== sucursal && !sucio) {
    setBase(sucursal);
    setConfig(sucursal);
  }

  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);

  if (!sucursal || !config) {
    return (
      <div className="panel">
        <div className="panel-body">
          {error ? (
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div className="co-error">{error}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => void recargar()}>Reintentar</button>
            </div>
          ) : cargando ? (
            "Cargando configuración…"
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => void recargar()}>Reintentar</button>
          )}
        </div>
      </div>
    );
  }

  const set = <K extends keyof Sucursal>(campo: K, valor: Sucursal[K]) =>
    setConfig((c) => (c ? { ...c, [campo]: valor } : c));

  const irA = (p: Pestana) => {
    if (p === pestana) return;
    if (sucio) {
      if (!confirm("Tenés cambios sin guardar en esta pestaña. ¿Descartarlos?")) return;
      // Se vuelve a lo último que trajo el servidor, no a una base que pudo quedar vieja.
      setBase(sucursal);
      setConfig(sucursal);
    }
    setPestana(p);
  };

  const onGuardar = async () => {
    setGuardando(true);
    const parcial = camposDe(pestana, config) as Partial<Sucursal>;
    if ("delivery_fee" in parcial) parcial.delivery_fee = Number(parcial.delivery_fee);
    if ("envio_gratis_desde" in parcial) parcial.envio_gratis_desde = Number(parcial.envio_gratis_desde);
    if (await guardar(parcial)) setBase((b) => ({ ...(b ?? config), ...parcial }));
    setGuardando(false);
  };

  const diasActivos = String(config.dias_apertura || "").split(",").map(Number).filter((n) => !Number.isNaN(n));

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

  return (
    <div className="panel">
      <div className="tabs" role="tablist">
        {PESTANAS.map(([id, etiqueta]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestana === id}
            className={pestana === id ? "active" : ""}
            onClick={() => irA(id)}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="panel-body" style={{ maxWidth: 640 }}>
        {pestana === "horario" && (
          <section>
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              El último pedido es la hora en que la web deja de aceptar pedidos; el texto es lo que se muestra.
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
        )}

        {pestana === "delivery" && (
          <section>
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Para pausar el delivery, usá el Arranque.
            </div>
            <div className="form-grid">
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
        )}

        {pestana === "datos" && (
          <section>
            <div className="form-grid">
              <div className="field"><label>Nombre</label><input value={config.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
              <div className="field"><label>Teléfono</label><input value={config.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
              <div className="field"><label>Email</label><input value={config.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="field"><label>WhatsApp</label><input value={config.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
              <div className="field full"><label>Dirección</label><input value={config.direccion} onChange={(e) => set("direccion", e.target.value)} /></div>
              <div className="field full"><label>Ciudad</label><input value={config.ciudad} onChange={(e) => set("ciudad", e.target.value)} /></div>
            </div>
          </section>
        )}

        {pestana === "cuentas" && (
          <section>
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
        )}
      </div>

      <div className="panel-body" style={{ borderTop: "1px solid var(--a-line)", display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn btn-primary" disabled={!sucio || guardando} onClick={onGuardar}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        {sucio && <span className="tbl-muted">Cambios sin guardar</span>}
      </div>
    </div>
  );
}
