"use client";
import { useMemo, useState } from "react";
import { useStore } from "./StoreProvider";
import { diaDeNegocio, formatoUnidades, resumenPorDia } from "@/lib/resumen-diario";
import { comparacionNoche, masVendidas, nochesParaGrafico, restarDias } from "@/lib/admin-dashboard";
import { esPedidoValidoParaVentas } from "@/lib/pedido-visible";
import { esActivo } from "@/lib/admin-pedidos";
import { contarMasas } from "@/lib/masa";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const PERIODOS = [7, 14, 30] as const;

export function Dashboard() {
  const { state } = useStore();
  const [noches, setNoches] = useState<(typeof PERIODOS)[number]>(7);
  const carta = useMemo(() => ({
    pizzas: new Set(state.products.filter((p) => /pizz/i.test(p.categoria)).map((p) => p.nombre)),
    empanadas: new Set(state.products.filter((p) => /empan/i.test(p.categoria)).map((p) => p.nombre)),
  }), [state.products]);
  const dias = useMemo(() => resumenPorDia(state.orders, carta), [state.orders, carta]);
  const hoy = diaDeNegocio(new Date().toISOString());
  const noche = comparacionNoche(dias, hoy);
  const grafico = nochesParaGrafico(dias, noches);
  const max = Math.max(1, ...grafico.map((g) => g.total));
  const validos = state.orders.filter(esPedidoValidoParaVentas);
  const desde30 = restarDias(hoy, 30);
  const ultimos30 = validos.filter((o) => diaDeNegocio(o.fecha) >= desde30);
  const ticket = ultimos30.length ? ultimos30.reduce((s, o) => s + o.total, 0) / ultimos30.length : 0;
  const activos = state.orders.filter(esActivo);
  const sinCobrar = activos.filter((o) => o.pagoEstado === "pendiente").length;
  const desde = grafico[0]?.dia;
  const masas = contarMasas(desde ? validos.filter((o) => diaDeNegocio(o.fecha) >= desde) : []);
  const totalMasas = masas.napoletana + masas.molde;
  const top = masVendidas(desde ? validos.filter((o) => diaDeNegocio(o.fecha) >= desde) : [], carta);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">Ventas esta noche</div><div className="kpi-value">{fmt(noche.actual)}</div>
          <div className={`kpi-delta ${noche.pct === null ? "" : noche.pct >= 0 ? "up" : "down"}`}>{noche.pct === null ? "Sin semana previa" : `${noche.pct >= 0 ? "↑" : "↓"} ${Math.abs(noche.pct)}% vs la semana pasada`}</div></div>
        <div className="kpi"><div className="kpi-label">Pedidos esta noche</div><div className="kpi-value">{noche.pedidos}</div><div className="kpi-delta">{noche.web} web · {noche.pos} POS</div></div>
        <div className="kpi"><div className="kpi-label">Ticket promedio</div><div className="kpi-value">{fmt(ticket)}</div><div className="kpi-delta">últimos 30 días</div></div>
        <div className="kpi"><div className="kpi-label">Activos ahora</div><div className="kpi-value">{activos.length}</div><div className={`kpi-delta ${sinCobrar ? "warn" : ""}`}>{sinCobrar ? `${sinCobrar} con pago pendiente` : "Al día"}</div></div>
      </div>
      <div className="dash-grid">
        <div className="panel">
          <div className="panel-head"><h3>Ventas por noche</h3><div className="panel-head-spacer" />
            <div className="seg">{PERIODOS.map((p) => <button key={p} className={noches === p ? "active" : ""} onClick={() => setNoches(p)}>{p} noches</button>)}</div>
          </div>
          <div className="panel-body">
            {grafico.length === 0 ? <div className="tbl-muted">Todavía no hay ventas.</div> : (
              <div className="chart">
                {grafico.map((g) => (
                  <div key={g.dia} className="chart-bar" style={{ height: `${Math.max(3, (g.total / max) * 100)}%` }} data-label={g.etiqueta} title={`${g.etiqueta}: ${fmt(g.total)}`}>
                    <span className="val">{fmt(g.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Más vendidas</h3><span className="tbl-muted">últimas {noches} noches</span></div>
          <div className="panel-body">
            <div className="top-list">
              {top.map((t, i) => <div className="top-row" key={t.nombre}><span className="top-rank">{i + 1}</span><span>{t.nombre}</span><span className="top-val">×{formatoUnidades(t.cantidad)}</span></div>)}
              {top.length === 0 && <div className="tbl-muted">Sin ventas en el período.</div>}
            </div>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "14px 0 6px" }}>Masas</h3>
            {totalMasas === 0 ? <div className="tbl-muted">Sin pizzas con masa elegida en el período.</div> : (
              <div className="masas-conteo">
                {([["Napoletana", masas.napoletana], ["Al molde", masas.molde]] as const).map(([nombre, n]) => (
                  <div className="masas-fila" key={nombre}><b>{nombre}</b><div className="masas-barra"><span style={{ width: `${Math.round((n / totalMasas) * 100)}%` }} /></div><span>{n} · {Math.round((n / totalMasas) * 100)}%</span></div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
