import "server-only";
import { db } from "./insforge";
import { readPages } from "./read-pages";
import type { Oferta } from "./promos";
import { ofertasVigentes } from "./promos-aplicar";

/** Columnas comerciales exclusivamente: no se consulta ni se serializa ningún costo del panel. */
const COLUMNAS = "id,tipo,nombre,titulo,descripcion,estado,config,dias,desde,hasta,orden,aprobada_en,creada_en,actualizada_en";

export async function leerOfertasVigentes(ahora = new Date()): Promise<Oferta[]> {
  try {
    const { data, error } = await readPages((start, end) => db.database.from("ofertas").select(COLUMNAS)
      .eq("proyecto_id", "impasto").eq("estado", "aprobada").order("orden").order("id").range(start, end));
    if (error || !Array.isArray(data)) throw error ?? new Error("Ofertas no disponibles");
    return ofertasVigentes(data as Oferta[], ahora).map(o => ({
      id: o.id, tipo: o.tipo, nombre: o.nombre, titulo: o.titulo, descripcion: o.descripcion, estado: o.estado,
      config: o.tipo === "combo" ? { precio: o.config.precio, lugares: o.config.lugares.map(l => ({ etiqueta: l.etiqueta, cantidad: l.cantidad, productos: [...l.productos] })) }
        : o.tipo === "regalo" ? { minimoPizzas: o.config.minimoPizzas, cantidad: o.config.cantidad, opciones: o.config.opciones.map(op => ({ producto: op.producto, suplemento: op.suplemento })) }
          : { cada: o.config.cada, porcentaje: o.config.porcentaje, productos: o.config.productos === null ? null : [...o.config.productos] },
      dias: [...o.dias], desde: o.desde, hasta: o.hasta, orden: o.orden,
      aprobada_en: o.aprobada_en, creada_en: o.creada_en, actualizada_en: o.actualizada_en,
    }) as Oferta);
  } catch (error) {
    console.error("[ofertas] lectura no crítica:", error);
    return [];
  }
}
