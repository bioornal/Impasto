import assert from "node:assert/strict";
import { test } from "node:test";
import { errorDeMedio, pedidosDeLaNoche } from "../lib/medio-pago";
import { resumenGuardado } from "../lib/payment-ledger";
import { adaptOrder } from "../lib/adapt-order";
import type { AdminOrder } from "../app/admin/components/types";

const pedido = (extra: Partial<AdminOrder>): AdminOrder => ({
  _dbId: Math.random().toString(36).slice(2), id: "IM-1", cliente: "", tel: "", mode: "takeaway", dir: "", zona: "",
  items: [], subtotal: 0, shipping: 0, total: 0, pago: "efectivo", pagoEstado: "pendiente", cambio: "", referencia: "",
  cuando: "asap", estado: "nuevo", fecha: "2026-10-17T23:00:00.000Z", notas: "", ...extra,
});

test("pedidosDeLaNoche: los de esa noche (06:00 a 06:00), sin cancelados, en orden de llegada", () => {
  const lista = pedidosDeLaNoche([
    pedido({ _dbId: "b", fecha: "2026-10-18T01:00:00.000Z" }),
    pedido({ _dbId: "a", fecha: "2026-10-17T23:00:00.000Z" }),
    pedido({ _dbId: "c", fecha: "2026-10-18T03:30:00.000Z" }),
    pedido({ _dbId: "x", fecha: "2026-10-17T23:30:00.000Z", estado: "cancelado" }),
    pedido({ _dbId: "y", fecha: "2026-10-16T23:00:00.000Z" }),
  ], "2026-10-17");
  assert.deepEqual(lista.map((o) => o._dbId), ["a", "b", "c"]);
});

test("adaptOrder: el medio se puede corregir salvo en los pagos con tarjeta de la web", () => {
  assert.equal(adaptOrder({ id: "1", metodo_pago: "efectivo" }).medioEditable, true);
  assert.equal(adaptOrder({ id: "2", metodo_pago: "mercadopago", proveedor_pago: "mercadopago", mp_order_id: "ORD1" }).medioEditable, false);
  assert.equal(adaptOrder({ id: "3", metodo_pago: "mercadopago", id_pago: "123" }).medioEditable, false);
});

test("errorDeMedio: traduce los errores de corregir_medio_pago", () => {
  assert.deepEqual(errorDeMedio({ message: "MEDIO_NO_EDITABLE" }), { status: 409, error: "Los pagos con tarjeta de la web los confirma Mercado Pago: ese medio no se puede cambiar." });
  assert.equal(errorDeMedio({ message: "PEDIDO_NO_ENCONTRADO" }).status, 404);
  assert.equal(errorDeMedio({ message: "MEDIO_INVALIDO" }).status, 400);
  assert.equal(errorDeMedio({ message: "otra cosa" }).status, 500);
});

test("resumenGuardado: una corrección de medio no es cobro ni devolución", () => {
  const fila = (id: string, tipo: string, clave: string) => ({ id, pedido_id: "p", clave, tipo, monto_centavos: 2450000, metodo_pago: "efectivo", ocurrido_en: "2026-10-18T02:00:00Z", fecha_fuente: "registro" });
  const t = resumenGuardado([
    fila("1", "cobro", "manual-saldo:2450000"),
    fila("2", "devolucion", "correccion-medio:1:efectivo:salida"),
    { ...fila("3", "cobro", "correccion-medio:1:efectivo:entrada"), metodo_pago: "transferencia" },
  ] as never);
  assert.equal(t.cobros, 2450000);
  assert.equal(t.devoluciones, 0);
  assert.equal(t.neto, 2450000);
});
