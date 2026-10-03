/**
 * Qué archivo del bucket `DB` es la foto de un producto. Puro, para testearse con `tsx`.
 *
 * Candidatas: lo que sube el admin en `fotos/<id del producto>/` y los archivos de la raíz
 * que se llaman como el producto, solos o con una versión al final ("v4", "(1)"). Gana la
 * más nueva. Nunca se reemplaza un archivo con el mismo nombre: el CDN de InsForge
 * seguiría sirviendo el viejo (comprobado el 03/10/2026).
 */
export interface ObjetoFoto { key: string; uploadedAt: string; url: string }

const EXTENSION = /\.(jpe?g|png|webp)$/i;
const VERSION = /^(v\d+|\(\d+\))$/;

export function normalizarNombre(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function esDelProducto(key: string, producto: { id?: string; nombre: string }): boolean {
  if (!EXTENSION.test(key)) return false;
  if (key.includes("/")) return !!producto.id && key.startsWith(`fotos/${producto.id}/`);
  const base = normalizarNombre(key.replace(EXTENSION, ""));
  const nombre = normalizarNombre(producto.nombre);
  if (!nombre) return false;
  return base === nombre || (base.startsWith(`${nombre} `) && VERSION.test(base.slice(nombre.length + 1)));
}

/** URL de la foto más nueva del producto, o undefined si no hay ninguna. */
export function elegirFoto(producto: { id?: string; nombre: string }, objetos: ObjetoFoto[]): string | undefined {
  let mejor: ObjetoFoto | undefined;
  let mejorFecha = -Infinity;
  for (const objeto of objetos) {
    if (!esDelProducto(objeto.key, producto)) continue;
    const fecha = Date.parse(objeto.uploadedAt);
    const valor = Number.isFinite(fecha) ? fecha : -Infinity;
    if (!mejor || valor > mejorFecha) { mejor = objeto; mejorFecha = valor; }
  }
  return mejor?.url;
}
