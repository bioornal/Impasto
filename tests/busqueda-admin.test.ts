import assert from "node:assert/strict";
import { test } from "node:test";
import { buscar } from "../lib/busqueda-admin";
import type { AdminCustomer, AdminOrder, AdminProduct } from "../app/admin/components/types";

const pedido = (extra: Partial<AdminOrder>) => ({ _dbId: "p1", id: "IM-107345-K7QD", numero: "107345", canal: "web", cliente: "Patricia Machado", tel: "3757570585", total: 43500, estado: "nuevo", fecha: "2026-10-17T23:00:00Z", ...extra }) as AdminOrder;
const cliente = (extra: Partial<AdminCustomer>) => ({ _dbId: "c1", id: "c1", nombre: "Matías Sanabria", tel: "3757574590", email: "", ...extra }) as AdminCustomer;
const producto = (extra: Partial<AdminProduct>) => ({ _dbId: "x1", id: "x1", nombre: "Fugazzetta", precio: 18000, type: "pizza", ...extra }) as AdminProduct;
const datos = {
  pedidos: [pedido({}), pedido({ _dbId: "p2", id: "IM-0003", numero: "3", canal: "pos", cliente: "Saul" })],
  clientes: [cliente({}), cliente({ _dbId: "c2", id: "c2", nombre: "Patricia Machado", tel: "3757570585" })],
  productos: [producto({}), producto({ _dbId: "x2", id: "x2", nombre: "Muzzarella Impasto" })],
};

test("buscar: menos de 2 letras no busca", () => {
  assert.deepEqual(buscar("p", datos), []);
  assert.deepEqual(buscar("  ", datos), []);
});

test("buscar: por número de pedido (también POS)", () => {
  assert.deepEqual(buscar("107345", datos).map((r) => [r.tipo, r.id]), [["pedido", "p1"]]);
  assert.deepEqual(buscar("pos 3", datos).map((r) => [r.tipo, r.id]), [["pedido", "p2"]]);
});

test("buscar: sin tildes ni mayúsculas, pedidos antes que clientes", () => {
  assert.deepEqual(buscar("patricia", datos).map((r) => [r.tipo, r.id]), [["pedido", "p1"], ["cliente", "c2"]]);
  assert.deepEqual(buscar("MATIAS", datos).map((r) => [r.tipo, r.id]), [["cliente", "c1"]]);
});

test("buscar: por teléfono (solo dígitos) y por producto", () => {
  assert.deepEqual(buscar("574590", datos).map((r) => r.id), ["c1"]);
  assert.deepEqual(buscar("fugaz", datos).map((r) => [r.tipo, r.titulo]), [["producto", "Fugazzetta"]]);
});

test("buscar: tope de resultados", () => {
  const muchos = { ...datos, productos: Array.from({ length: 20 }, (_, i) => producto({ _dbId: `m${i}`, id: `m${i}`, nombre: `Muzza ${i}` })) };
  assert.equal(buscar("muzza", muchos).length, 8);
  assert.equal(buscar("muzza", muchos, 3).length, 3);
});
