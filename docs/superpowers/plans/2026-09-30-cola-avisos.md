# Cola de avisos — implementación

> Usar executing-plans por tareas y revisión final. Continuación autorizada; conservar archivos ajenos y no enviar mensajes reales de prueba.

**Goal:** un corte entre pedido y aviso deja una operación recuperable, no un aviso perdido ni un reenvío ciego.
**Architecture:** trigger transactional outbox en notificaciones, claim/finish con token, transportes y panel de recuperación.
**Tech Stack:** PostgreSQL/InsForge CLI, Next/TypeScript, tsx/PGlite con datos ficticios.
**Spec:** ../specs/2026-09-30-cola-avisos-design.md

- [x] SQL: rollback del padre/cola, doble claim, token viejo, expiración, permisos y filtro POS.
- [x] Migración aditiva con payload/mensaje/claim, trigger y RPC; revisión antes de aplicar archivo concreto.
- [x] RED y transporte: timeout/5xx/recibo incompleto, Resend clave estable y parciales por chat.
- [x] Consumidor con snapshot, bloqueo antes de enviar, confirmación y ninguna deduplicación por error arbitrario.
- [x] API/admin y panel: leer estados sin enviar, reintento explícito y advertencia de duplicado incierto.
- [x] Commit/push y verificación del remoto; integración, suites/build y migración verificados.

Ruling: sin cron nuevo ni backfill automático — avoids reenviar avisos históricos reales durante esta entrega. Recuperación está disponible por pedido/aviso elegido; el panel hace visible la incertidumbre.

Evidencia: transporte 4 pruebas, consumidor 5, SQL PGlite 11. RED registrado de transportes, consumidor y retención de recibos anteriores; SQL inicial se ejecutó por primera vez ya implementado, y sólo la corrección del orden de locks tiene RED registrado. No se presenta como TDD completo. PGlite comprueba SQL real con sesiones secuenciales; no prueba concurrencia entre conexiones reales.

Migración exacta `20260930220253_cola-avisos.sql` aplicada con CLI el 30/09/2026; catálogo confirma trigger activo y RPC invoker ejecutables por project_admin, no por anon/authenticated. No se crearon pedidos ni se entregaron avisos reales para verificar.

Código publicado en main: `2f32ebbb54ee3c16dbc925cecc11c06cf13d9782`, confirmado con `git ls-remote origin refs/heads/main`. El despliegue público del frontend aún no se acredita por esa comprobación.
