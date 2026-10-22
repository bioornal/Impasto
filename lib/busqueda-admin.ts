import type { AdminCustomer, AdminOrder, AdminProduct } from "../app/admin/components/types";
import { numeroCorto } from "./admin-pedidos";

export interface ResultadoBusqueda {
  tipo: "pedido" | "cliente" | "producto";
  id: string;
  titulo: string;
  detalle: string;
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const digitos = (s: string) => s.replace(/\D/g, "");
const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

/**
 * Buscador de la barra superior: busca en lo que el panel ya tiene cargado, sin consultas nuevas.
 * Pedidos primero (por número, cliente o teléfono), después clientes y productos.
 */
export function buscar(
  texto: string,
  datos: { pedidos: ReadonlyArray<AdminOrder>; clientes: ReadonlyArray<AdminCustomer>; productos: ReadonlyArray<AdminProduct> },
  max = 8,
): ResultadoBusqueda[] {
  const t = normalizar(texto);
  if (t.length < 2) return [];
  const tDigitos = digitos(t);
  const porTelefono = (tel: string) => tDigitos.length >= 4 && digitos(tel).includes(tDigitos);
  const resultados: ResultadoBusqueda[] = [];

  for (const o of datos.pedidos) {
    const numero = normalizar(numeroCorto(o));
    if (numero === t || numero.startsWith(t) || normalizar(o.id).includes(t) || normalizar(o.cliente).includes(t) || porTelefono(o.tel)) {
      resultados.push({ tipo: "pedido", id: o._dbId, titulo: `Pedido ${numeroCorto(o)}`, detalle: `${o.cliente} · ${fmt(o.total)}` });
    }
  }
  for (const c of datos.clientes) {
    if (normalizar(c.nombre).includes(t) || porTelefono(c.tel)) {
      resultados.push({ tipo: "cliente", id: c.id, titulo: c.nombre, detalle: c.tel });
    }
  }
  for (const p of datos.productos) {
    if (normalizar(p.nombre).includes(t)) {
      resultados.push({ tipo: "producto", id: p.id, titulo: p.nombre, detalle: fmt(p.precio || 0) });
    }
  }
  return resultados.slice(0, max);
}
