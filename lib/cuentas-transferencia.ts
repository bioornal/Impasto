/**
 * Cuentas para transferencias. Son el único dato del negocio al que un cliente
 * le manda plata, así que ante cualquier duda este módulo devuelve "nada" y el
 * sitio ofrece pedir los datos por WhatsApp: nunca un valor de ejemplo.
 *
 * Sin dependencias: se testea con `tsx`.
 */

export interface CuentaTransferencia {
  id: string;
  /** Nombre corto para el dueño ("ARQ", "AstroPay"): panel y aviso de Telegram. */
  nombre: string;
  alias: string;
  /** CBU o CVU, solo dígitos (22). Vacío si la cuenta se usa por alias. */
  cbu: string;
  banco: string;
  titular: string;
  activa: boolean;
}

/** Lo que ve el cliente y queda guardado en el pedido. */
export type DatosTransferencia = Omit<CuentaTransferencia, "id" | "activa">;

const MAX_CUENTAS = 10;
const ALIAS = /^[A-Za-z0-9.-]{6,20}$/;
const CBU = /^\d{22}$/;

const texto = (valor: unknown, max: number) => (typeof valor === "string" ? valor.trim().slice(0, max) : "");
const soloDigitos = (valor: unknown) => (typeof valor === "string" ? valor.replace(/[\s-]/g, "") : "");

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

function datos(valor: Record<string, unknown>): DatosTransferencia | null {
  // Sin recortar antes de validar: un alias truncado sería otro alias.
  const alias = texto(valor.alias, 64);
  const cbu = soloDigitos(valor.cbu);
  const aliasOk = ALIAS.test(alias);
  const cbuOk = CBU.test(cbu);
  if (!aliasOk && !cbuOk) return null;
  return {
    nombre: texto(valor.nombre, 40),
    alias: aliasOk ? alias : "",
    cbu: cbuOk ? cbu : "",
    banco: texto(valor.banco, 80),
    titular: texto(valor.titular, 80),
  };
}

/** La lista guardada en `sucursales`. Lo que no tenga forma de cuenta se descarta. */
export function leerCuentas(raw: unknown): CuentaTransferencia[] {
  if (!Array.isArray(raw)) return [];
  const cuentas: CuentaTransferencia[] = [];
  for (const valor of raw) {
    if (!esObjeto(valor)) continue;
    const id = texto(valor.id, 64);
    const leidos = datos(valor);
    if (!id || !leidos) continue;
    cuentas.push({ id, ...leidos, activa: valor.activa === true });
  }
  return cuentas;
}

/** La cuenta que ven los clientes. Dos activas es ambiguo: mejor ninguna que la equivocada. */
export function cuentaActiva(cuentas: CuentaTransferencia[]): DatosTransferencia | null {
  const activas = cuentas.filter((cuenta) => cuenta.activa);
  if (activas.length !== 1) return null;
  const { nombre, alias, cbu, banco, titular } = activas[0];
  return { nombre, alias, cbu, banco, titular };
}

/** Valida lo que manda el panel. Los mensajes se muestran tal cual al dueño. */
export function validarCuentas(
  input: unknown,
  nuevoId: () => string = () => crypto.randomUUID(),
): { ok: true; cuentas: CuentaTransferencia[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "La lista de cuentas no es válida" };
  if (input.length > MAX_CUENTAS) return { ok: false, error: `Podés guardar hasta ${MAX_CUENTAS} cuentas` };

  const cuentas: CuentaTransferencia[] = [];
  const ids = new Set<string>();
  for (const [indice, valor] of input.entries()) {
    const posicion = `Cuenta ${indice + 1}`;
    if (!esObjeto(valor)) return { ok: false, error: `${posicion}: datos inválidos` };
    const nombre = texto(valor.nombre, 40);
    if (!nombre) return { ok: false, error: `${posicion}: poné un nombre corto (por ejemplo, el banco)` };
    const alias = texto(valor.alias, 64);
    if (alias && !ALIAS.test(alias)) {
      return { ok: false, error: `${nombre}: el alias debe tener entre 6 y 20 letras, números, puntos o guiones` };
    }
    const cbu = soloDigitos(valor.cbu);
    if (cbu && !CBU.test(cbu)) return { ok: false, error: `${nombre}: el CBU/CVU debe tener 22 dígitos` };
    if (!alias && !cbu) return { ok: false, error: `${nombre}: cargá el alias o el CBU/CVU` };
    const id = texto(valor.id, 64) || nuevoId();
    if (ids.has(id)) return { ok: false, error: `${nombre}: identificador repetido; recargá la página` };
    ids.add(id);
    cuentas.push({
      id,
      nombre,
      alias,
      cbu,
      banco: texto(valor.banco, 80),
      titular: texto(valor.titular, 80),
      activa: valor.activa === true,
    });
  }

  const activas = cuentas.filter((cuenta) => cuenta.activa).length;
  if (cuentas.length > 0 && activas !== 1) {
    return { ok: false, error: "Elegí una sola cuenta activa: es la que ven los clientes" };
  }
  return { ok: true, cuentas };
}

/** La foto que guardó el pedido al crearse. */
export function datosDesdePedido(raw: unknown): DatosTransferencia | null {
  return esObjeto(raw) ? datos(raw) : null;
}
