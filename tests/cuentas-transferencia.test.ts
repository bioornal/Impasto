import { leerCuentas, cuentaActiva, validarCuentas, datosDesdePedido, type CuentaTransferencia } from "../lib/cuentas-transferencia";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}

// Datos ficticios: el repo es público, nunca van cuentas reales acá.
const cuenta = (over: Partial<CuentaTransferencia>): CuentaTransferencia => ({
  id: "a", nombre: "Billetera A", alias: "PRUEBA.ALIAS.UNO", cbu: "0".repeat(21) + "1",
  banco: "Banco de Prueba", titular: "Titular Ficticio", activa: false, ...over,
});

/* ── lectura ── */
chequear("leerCuentas · no es lista → vacía", leerCuentas("basura").length === 0 && leerCuentas(null).length === 0);
chequear("leerCuentas · descarta entradas sin alias ni CBU", leerCuentas([cuenta({ alias: "", cbu: "" })]).length === 0);
chequear("leerCuentas · descarta entradas que no son objeto", leerCuentas([1, "x", null]).length === 0);
chequear("leerCuentas · conserva una cuenta válida", leerCuentas([cuenta({})]).length === 1);
chequear("leerCuentas · alias de más de 20 no se recorta: se descarta", leerCuentas([cuenta({ alias: "A".repeat(25), cbu: "" })]).length === 0);

/* ── la activa ── */
chequear("cuentaActiva · sin activa → null", cuentaActiva([cuenta({})]) === null);
const activa = cuentaActiva([cuenta({}), cuenta({ id: "b", nombre: "Billetera B", activa: true })]);
chequear("cuentaActiva · devuelve la marcada, sin id ni activa", activa?.nombre === "Billetera B" && !("id" in (activa ?? {})) && !("activa" in (activa ?? {})));
chequear("cuentaActiva · dos activas es ambiguo → null", cuentaActiva([cuenta({ activa: true }), cuenta({ id: "b", activa: true })]) === null);
chequear("cuentaActiva · activa leída de un JSON dañado a medias", cuentaActiva(leerCuentas([{ id: "z", activa: true }, cuenta({ activa: true })]))?.nombre === "Billetera A");

/* ── validación del panel ── */
const ok = (r: ReturnType<typeof validarCuentas>) => r.ok;
const error = (r: ReturnType<typeof validarCuentas>) => (r.ok ? "" : r.error);
chequear("validar · lista vacía es válida", ok(validarCuentas([])));
chequear("validar · no es lista → error", !ok(validarCuentas({})));
chequear("validar · una activa válida", ok(validarCuentas([cuenta({ activa: true })])));
chequear("validar · ninguna activa → error", /activa/i.test(error(validarCuentas([cuenta({})]))));
chequear("validar · dos activas → error", /activa/i.test(error(validarCuentas([cuenta({ activa: true }), cuenta({ id: "b", activa: true })]))));
chequear("validar · CBU corto → error", /22/.test(error(validarCuentas([cuenta({ activa: true, cbu: "123" })]))));
chequear("validar · alias de más de 20 no se recorta: error", /alias/i.test(error(validarCuentas([cuenta({ activa: true, alias: "A".repeat(25) })]))));
chequear("validar · alias con espacios → error", /alias/i.test(error(validarCuentas([cuenta({ activa: true, alias: "mi alias" })]))));
chequear("validar · sin alias ni CBU → error", !ok(validarCuentas([cuenta({ activa: true, alias: "", cbu: "" })])));
chequear("validar · sin nombre → error", /nombre/i.test(error(validarCuentas([cuenta({ activa: true, nombre: " " })]))));
chequear("validar · ids repetidos → error", !ok(validarCuentas([cuenta({ activa: true }), cuenta({})])));
const normalizada = validarCuentas([cuenta({ id: "", activa: true, cbu: "0000-0000 00000000000001 " })], () => "nuevo-id");
chequear(
  "validar · genera id y normaliza el CBU",
  normalizada.ok && normalizada.cuentas[0].id === "nuevo-id" && normalizada.cuentas[0].cbu === "0".repeat(21) + "1",
);
chequear("validar · más de 10 cuentas → error", !ok(validarCuentas(Array.from({ length: 11 }, (_, i) => cuenta({ id: `c${i}`, activa: i === 0 })))));

/* ── la foto guardada en el pedido ── */
chequear("datosDesdePedido · null → null", datosDesdePedido(null) === null);
chequear("datosDesdePedido · sin alias ni CBU → null", datosDesdePedido({ nombre: "X", alias: "", cbu: "" }) === null);
chequear("datosDesdePedido · lee la foto", datosDesdePedido({ nombre: "Billetera A", alias: "PRUEBA.ALIAS.UNO", cbu: "", banco: "B", titular: "T" })?.alias === "PRUEBA.ALIAS.UNO");

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
