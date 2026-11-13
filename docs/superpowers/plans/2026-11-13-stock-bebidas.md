# Stock de bebidas — implementación

**Objetivo:** implementar el diseño aprobado en `docs/superpowers/specs/2026-11-13-stock-bebidas-design.md`.
**Arquitectura:** inventario persistente por bebida; reserva atómica en la RPC vigente y devolución/reactivación por triggers existentes. Web y panel comparten unidades y contrato del POS.
**Tecnologías:** Next.js, TypeScript, PostgreSQL, PGlite, Playwright.

## Restricciones

- Rama actual `stock-bebidas`; sin cambiar de rama, push, red, CLI, base remota ni despliegue.
- Una migración `20261113200000_stock-bebidas.sql`, basada exactamente en la RPC de `20261031122631_masas-por-tipo.sql`; bloquear cupos, masas, stock por id.
- Sin OWNER TO, bloques DO ni project_admin_policy. POS de carroFogon solo lectura.
- Contrato `STOCK_AGOTADO|<nombre>|<quedan>`; bebida por tipo bebida o categoría que contiene bebida.
- Cambios acotados; español rioplatense sin emojis. Respetar archivos previos ajenos.
- Commits chicos con trailer solicitado; ante rechazo de index.lock dejar sin commitear.

## Tareas

- [x] 1. Escribir pruebas SQL fallidas, migración, ejecutar PGlite y preparar `tmp/stock-casos.sql` con BEGIN/ROLLBACK para todos los casos pedidos. Preservar costeo/cupos/masas y privilegios.
- [x] 2. Escribir pruebas puras fallidas; agregar `lib/stock-bebidas.ts`, tipos y lecturas frescas, cotización 409/traducción de error, límites del carrito y avisos de carta/ficha. Integrar tests en pnpm test.
- [x] 3. Agregar API admin autenticada y controles reutilizables con debounce 700 ms, compra aditiva, sin control, colores y columna de Productos; mantener patrones existentes.
- [x] 4. Revisión de cambios; pnpm test, tsc, eslint tocados, build, Playwright con datos completamente simulados y capturas tmp/stock-*.png a 1366/375, agotado/pocas/carrito.

## Foco de revisión

- Bebidas repetidas por id/nombre se agregan una sola vez; pizzas/cajas/mitades no consumen.
- Rechazos y reactivación insuficiente revierten toda la transacción, sin descuentos parciales.
- NULL y ausencia de fila mantienen venta sin control; cambios manuales quedan en historial.
- Un borrador con exceso bloquea continuar aun si cambió stock desde que se agregó.
- Guardados demorados y compra no pisan unidades durante ventas concurrentes.

## Registro

- Inicio: árbol con cambios previos en AGENTS.md y carpetas no seguidas; no incluirlos.
- Documentación MCP fetch-docs/fetch-sdk-docs no disponible en herramientas. Se usan SDK instalado y patrones locales; la prohibición de red del usuario prevalece.
- Revisión SQL/web final: `tmp/stock-review.md`, sin hallazgos importantes abiertos. Flechas guardan delta acumulado con motivo ajuste, evitando pisar ventas durante los 700 ms; el campo fija recuento físico y compra suma con motivo carga.
- Verificaciones finales: pnpm test (14 casos nuevos), tsc, build y Playwright pasan. ESLint ejecutado sobre todos los TS/TSX tocados: un error previo en Shell.tsx (set-state-in-effect), reproducido con el archivo de HEAD; cero errores nuevos. Detector de UI: sin hallazgos.
- Capturas y logs en `tmp/stock-*`; SQL real preparado, no ejecutado. RPC comparada con la vigente: idéntica al retirar sólo adiciones de stock.
- Git rechazó crear `.git/index.lock` por permisos en el primer add. Por instrucción del dueño, todo queda sin commitear; no se reintentó ni se cambió la rama.
