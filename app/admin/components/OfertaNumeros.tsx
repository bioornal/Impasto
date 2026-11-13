"use client";
import { useId, useState, type ReactNode } from "react";
import type { AnalisisOferta, OfertaInput, RangoOferta } from "@/lib/promos";

export const dineroOferta = (n: number | null) => n === null ? "Sin dato" : `$${Math.round(n).toLocaleString("es-AR")}`;
const porcentaje = (n: number) => `${Math.round(n)} %`;
const rango = (r: RangoOferta | null, formato: (n: number) => string = dineroOferta) => !r ? "Sin dato" : r.min === r.max ? formato(r.min) : `${formato(r.min)} a ${formato(r.max)}`;

function Tabla({ titulo, columnas, filas }: { titulo: string; columnas: string[]; filas: ReactNode[][] }) {
  return <div className="oferta-tabla-scroll" role="region" aria-label={titulo} tabIndex={0}>
    <table className="oferta-tabla"><caption>{titulo}</caption><thead><tr>{columnas.map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead>
      <tbody>{filas.map((fila, i) => <tr key={i}>{fila.map((celda, j) => j === 0 ? <th scope="row" key={j}>{celda}</th> : <td key={j}>{celda}</td>)}</tr>)}</tbody></table>
  </div>;
}

export function OfertaNumeros({ analisis: a, tipo, desplegable = false }: { analisis: AnalisisOferta; tipo: OfertaInput["tipo"]; desplegable?: boolean }) {
  const [abierto, setAbierto] = useState(false), id = useId();
  if (a.margen.errores.length) return <p className="oferta-error">{a.margen.errores.join(" ")}</p>;
  const t = a.totales;
  const cifras = [
    ["El cliente ahorra", `${rango(t.ahorroCliente)} (${rango(t.ahorroClientePct, porcentaje)})`],
    ["Te queda por pedido", rango(t.teQueda)],
    ["Resignás contra precio normal", rango(t.resignas)],
  ];
  const totales: [string, string][] = [
    ["Precio normal total", rango(t.precioNormal)], [tipo === "combo" ? "Precio combo" : "Paga el cliente", rango(t.paga)],
    ["El cliente ahorra", `${rango(t.ahorroCliente)} (${rango(t.ahorroClientePct, porcentaje)})`],
    ["Costo total (receta + caja)", rango(t.costo)], ["Te queda por pedido", `${rango(t.teQueda)} (${rango(t.gananciaPct, porcentaje)} del cobro)`],
    ["Te quedaría a precio normal", rango(t.gananciaNormal)], ["Resignás contra precio normal", rango(t.resignas)],
    ["Te queda con tarjeta", rango(t.conTarjeta)],
  ];
  return <div className="oferta-numeros">
    <dl className="oferta-cifras">{cifras.map(([label, valor]) => <div key={label}><dt>{label}</dt><dd>{valor}</dd></div>)}</dl>
    {desplegable && <button type="button" className="btn btn-sm" aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto(!abierto)}>{abierto ? "Ocultar números" : "Ver números"}</button>}
    {(!desplegable || abierto) && <div className="oferta-detalle" id={id}>
      {tipo === "combo" && <Tabla titulo="Productos del combo · precios y costos por unidad" columnas={["Lugar / producto", "Cantidad", "Precio normal", "Costo"]} filas={a.productos.map(p => [`${p.lugar} · ${p.nombre}`, p.cantidad, dineroOferta(p.precio), dineroOferta(p.costo)])} />}
      {tipo === "descuento_cantidad" && <Tabla titulo="Qué deja cada pizza cuando es la descontada" columnas={["Pizza", "Precio normal", "Costo", "Te queda normal", "Precio descontado", "Te queda descontada", "Resignás"]} filas={a.productos.map(p => [p.nombre, dineroOferta(p.precio), dineroOferta(p.costo), dineroOferta(p.gananciaNormal!), dineroOferta(p.precioDescuento!), dineroOferta(p.teQueda!), dineroOferta(p.resignas!)])} />}
      {tipo === "regalo" && <><Tabla titulo="Opciones de regalo · precio, costo y suplemento por unidad" columnas={["Bebida", "Cantidad", "Precio normal", "Costo", "Suplemento", "Te cuesta regalarla (total)", "Resignás si ya iba a pedirla"]} filas={a.productos.map(p => [p.nombre, p.cantidad, dineroOferta(p.precio), dineroOferta(p.costo), dineroOferta(p.suplemento!), dineroOferta(p.costoRegalo!), dineroOferta(p.resignas!)])} /><p>Te cuesta regalarla = costo menos suplemento, por la cantidad de regalos.</p></>}
      {a.pedidos.length > 0 && <Tabla titulo={tipo === "regalo" ? "Pedido mínimo · pizzas más baratas y más caras, por bebida" : "Tres pedidos de ejemplo"} columnas={["Pedido", "Paga el cliente", "Te queda", "Resignás", ...(tipo === "regalo" ? ["Costo neto del regalo", "% del pedido en el regalo"] : []), "Cliente paga envío", "Resignás envío", "Con tarjeta"]} filas={a.pedidos.map(p => [p.nombre, dineroOferta(p.paga), dineroOferta(p.teQueda), dineroOferta(p.resignas), ...(tipo === "regalo" ? [dineroOferta(p.costoRegalo!), porcentaje(p.regaloPct!)] : []), dineroOferta(p.envio?.pagaCliente ?? null), dineroOferta(p.envio?.resignas ?? null), dineroOferta(p.conTarjeta)])} />}
      <dl className="oferta-totales">{totales.map(([label, valor]) => <div key={label}><dt>{label}</dt><dd>{valor}</dd></div>)}</dl>
      <div className="oferta-envio"><strong>Envío aparte</strong>{a.envio ? <p>El cliente paga {rango(a.envio.pagaCliente)} de envío. Resignás {rango(a.envio.resignas)} de envío cuando el pedido llega al envío gratis.</p> : <p>Sin datos de envío: actualizá para volver a consultar.</p>}</div>
      {a.conviertePedidoUnaPizza && <p>Si convierte un pedido de 1 pizza: te queda {rango(a.conviertePedidoUnaPizza)} más que vendiendo sola la pizza más barata del combo, antes del envío.</p>}
      <p className="oferta-veredicto">{a.veredicto}</p>
      <small>Los rangos muestran el mínimo y el máximo de cada cifra; pueden corresponder a opciones distintas. Te queda = cobro menos receta y caja. El envío se muestra aparte; delivery y luz se cubren con la cantidad de pedidos indicada, antes de tarjeta y envío. El semáforo conserva el criterio sin tarjeta.</small>
    </div>}
  </div>;
}
