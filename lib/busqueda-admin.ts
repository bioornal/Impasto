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
const TIPO_PRODUCTO: Record<AdminProduct["type"], string> = { pizza: "Pizza", empanada: "Empanada", bebida: "Bebida" };

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
  // Del producto no se muestra el precio: el de venta se calcula aparte (recetario) y la columna engaña.
  // En carta primero, los dados de baja después; dentro de cada grupo se respeta el orden de entrada.
  const coincidentes = datos.productos.filter((p) => normalizar(p.nombre).includes(t));
  for (const baja of [false, true]) {
    for (const p of coincidentes) {
      if (!!p.archivado !== baja) continue;
      resultados.push({ tipo: "producto", id: p.id, titulo: p.nombre, detalle: `${baja ? "Dado de baja" : "En carta"} · ${TIPO_PRODUCTO[p.type] ?? p.type}` });
    }
  }
  return resultados.slice(0, max);
}
