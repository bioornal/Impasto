import assert from "node:assert/strict";
import { test } from "node:test";
import { esSeccionAdmin, seccionInicial } from "../lib/inicio-admin";

const VIE_SAB_DOM = "0,5,6";

test("seccionInicial: la sección guardada en la sesión manda", () => {
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-21T15:00:00Z"), "productos"), "productos");
});

test("seccionInicial: una guardada inválida se ignora", () => {
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-21T15:00:00Z"), "cupos"), "dashboard");
});

test("seccionInicial: día de apertura abre el Arranque; si no, el Dashboard", () => {
  // vie 23/10 20:00 en Argentina
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-23T23:00:00Z"), null), "arranque");
  // mié 21/10 12:00 en Argentina
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-21T15:00:00Z"), null), "dashboard");
});

test("seccionInicial: a las 01:00 del sábado sigue siendo la noche del viernes", () => {
  // sáb 24/10 01:00 en Argentina = 04:00 UTC
  assert.equal(seccionInicial("5", new Date("2026-10-24T04:00:00Z"), null), "arranque");
});

test("seccionInicial: lunes 01:00 es la noche del domingo; lunes 10:00 ya no", () => {
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-26T04:00:00Z"), null), "arranque");
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-26T13:00:00Z"), null), "dashboard");
});

test("seccionInicial: sin días cargados, Dashboard", () => {
  assert.equal(seccionInicial("", new Date("2026-10-23T23:00:00Z"), null), "dashboard");
  assert.equal(seccionInicial(null, new Date("2026-10-23T23:00:00Z"), null), "dashboard");
});

test("seccionInicial: días de apertura vacíos o con comas sobrantes no cuentan como domingo", () => {
  // dom 25/10 20:00 en Argentina: si "" se leyera como 0, la noche del domingo abriría el Arranque
  const domingo = new Date("2026-10-25T23:00:00Z");
  assert.equal(seccionInicial("", domingo, null), "dashboard");
  assert.equal(seccionInicial(null, domingo, null), "dashboard");
  assert.equal(seccionInicial(" ", domingo, null), "dashboard");
  assert.equal(seccionInicial("5,,6", domingo, null), "dashboard");
  // y con el domingo cargado de verdad, sí abre el Arranque
  assert.equal(seccionInicial("0,5,6", domingo, null), "arranque");
});

test("seccionInicial: una fecha inválida no tira error, Dashboard", () => {
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("no es fecha"), null), "dashboard");
});

test("esSeccionAdmin", () => {
  assert.equal(esSeccionAdmin("arranque"), true);
  assert.equal(esSeccionAdmin("cupos"), false);
  assert.equal(esSeccionAdmin(undefined), false);
});
