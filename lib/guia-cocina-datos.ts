import { unstable_cache } from "next/cache";
import { db } from "@/lib/insforge";
import { readPages } from "@/lib/read-pages";
import type { FilasGuia } from "@/lib/guia-cocina";

/**
 * Lee del recetario lo que arma `/cocina`, con la clave de backend. No pide precios
 * ni costos (solo `precio_salsa`, para saber si la pizza lleva salsa). Las filas se
 * guardan un minuto. Si una lectura falla, tira: al renovar, `unstable_cache` sigue
 * devolviendo las últimas filas buenas (Next 16.3.8, `unstable-cache.js`).
 */
export const leerFilasGuia = unstable_cache(async (): Promise<FilasGuia> => {
  const t = db.database;
  const [productos, precios, recetas, lineas, ingredientes, preparaciones] = await Promise.all([
    readPages((s, e) => t.from("productos").select("id,nombre,categoria,archivado")
      .eq("proyecto_id", "impasto").eq("categoria", "pizzas").order("id", { ascending: true }).range(s, e)),
    readPages((s, e) => t.from("precios_venta").select("id,receta_id,nombre").order("id", { ascending: true }).range(s, e)),
    readPages((s, e) => t.from("recetas").select("id,nombre,precio_salsa,en_cocina,indicaciones,conservacion").order("id", { ascending: true }).range(s, e)),
    readPages((s, e) => t.from("receta_ingredientes").select("id,receta_id,ingrediente_id,cantidad_kg,momento").order("id", { ascending: true }).range(s, e)),
    readPages((s, e) => t.from("ingredientes").select("id,nombre,unidad,gramos_por_unidad").order("id", { ascending: true }).range(s, e)),
    // Son pocas filas y no tienen id. La lectura privada acepta tanto el esquema
    // anterior como el nuevo: tipo_base aparece al aplicar la migración. Se
    // proyectan solo los campos de cocina abajo; ninguna fila cruda se publica.
    t.from("preparaciones").select("*").limit(1000),
  ]);
  const leidas = { productos, precios, recetas, lineas, ingredientes, preparaciones };
  for (const [nombre, r] of Object.entries(leidas)) {
    if (r.error || !Array.isArray(r.data)) throw new Error(`/cocina: no se pudo leer ${nombre}`);
  }
  return {
    productos: productos.data as FilasGuia["productos"],
    precios: precios.data as FilasGuia["precios"],
    recetas: recetas.data as FilasGuia["recetas"],
    lineas: lineas.data as FilasGuia["lineas"],
    ingredientes: ingredientes.data as FilasGuia["ingredientes"],
    preparaciones: (preparaciones.data as FilasGuia["preparaciones"]).map(({receta_id, ingrediente_id, rinde_kg, tipo_base}) =>
      ({receta_id, ingrediente_id, rinde_kg, tipo_base})),
  };
}, ["guia-cocina"], { revalidate: 60 });
