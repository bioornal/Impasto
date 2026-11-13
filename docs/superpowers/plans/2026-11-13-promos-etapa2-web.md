# Promociones etapa 2 — Web

Spec: `docs/superpowers/specs/2026-11-13-promos-etapa2-design.md`.

Implementación autorizada sobre la rama existente `promos-etapa2`, sin red, base, CLI ni push.
Motor `promos-aplicar.ts` y su contrato intactos. Archivos nuevos/modificados con CRLF.

- [ ] Lectura no crítica de ofertas con clave del backend y lista blanca pública; tipos y adaptador del motor.
- [ ] Cotización a lista, aplicación del motor, tramos/regalo y resumen; pedido, pagos, borrador y migración mínima.
- [ ] Home con combos, selección compartida Tu promo en carrito/checkout y borrador persistido.
- [ ] Comanda, Telegram, mail, panel y prompt del bot.
- [ ] Tests de cotización, test completo, tsc, eslint, build y Playwright simulado a 1366/375; revisar capturas.
- [ ] Revisión del diff, CRLF y commits pequeños si el índice permite escritura.

Decisiones: el borrador conserva líneas a lista y elección, no tramos/regalo calculados; compatibilidad con arrays históricos.
La elegibilidad del regalo descuenta del stock las bebidas ya agregadas y exige cantidad suficiente para todo el regalo.
La lectura de ofertas excluye costos tanto en la consulta como en la serialización; errores devuelven lista vacía.
