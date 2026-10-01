# Calidad y operación — séptima etapa

## Alcance autorizado
Continuación del plan de auditoría: CI en los cuatro repositorios, consistencia del CRM y barreras concretas de accesibilidad web/Android. Conservar controles de pagos, costeo histórico y seguridad; no ejecutar ventas ni mensajes reales. Paginación de todas las fuentes y validación completa en dispositivo siguen como trabajo distinto si exceden estos flujos.

## CI
Web, Impasto y POS tendrán GitHub Actions en push/PR de main y ejecución manual, con instalación desde lockfile, pruebas y build. Android ya tiene pruebas: fortalecer diagnóstico y funcionamiento sin secretos para PR, evitando distribuir APK con configuración ficticia. Entorno de prueba sin claves de producción y sin llamadas de negocio; permisos mínimos y artefactos de diagnóstico sin credenciales.

## CRM
Compras son pedidos con neto cobrado documentado positivo. Movimientos prevalecen sobre estado; devolución total deja de contar; parcial cuenta una vez. Sin movimientos se mantiene interpretación legacy de cobros aprobados/manuales parciales; reembolso parcial sin importes queda desconocido y se señala. Contactos guardados no son compras, y reintentar no incrementa nada.

Una RPC de lectura admin-only calcula conteo, neto y última compra desde pedidos y ledger dentro de una consulta. Perfilar el contacto usa otra RPC de upsert atómico sin modificar cant_compras, conservando campos existentes si llega texto vacío. Ambas exclusivas del servidor. Un trigger guarda el perfil en la misma transacción del pedido; un bloqueo por identidad normalizada evita nuevos duplicados por formato. Si existen perfiles legacy duplicados, la lectura falla de forma explícita para revisarlos sin fusionarlos automáticamente. Listas se paginan con orden estable y fallan sin exponer métricas incompletas. No se reescribe el contador viejo ni se inventan compras históricas. Vincular por teléfono completo normalizado a dígitos; no por nombre ni por sufijo de ocho cifras. No adivinar equivalencias de prefijos internacionales. El panel usa métricas servidor, muestra fallos explícitos y permite recargar el CRM; el polling de pedidos no recalcula compras localmente. El historial visible se identifica como pedidos cargados y no reemplaza los totales completos del servidor.

## Accesibilidad
Web permite zoom y da nombre accesible a acciones/campos auditados. Android expone selección y etiquetas de navegación, nombres de cerrar/eliminar según contexto y objetivos táctiles apropiados. Mantener identidad visual y lógica de negocio. Verificación de compilación y revisión de semántica; sólo afirmar prueba visual/TalkBack si realmente se realiza.

## Validación y límites
SQL PGlite para upsert, idempotencia por derivación y atomicidad con costeo/ledger/outbox, ACL, cobros/reembolsos/legacy y normalización de identidad. Pruebas de lecturas fallidas y métricas servidor, fixtures de ambos canales. Suites/builds de cuatro proyectos, revisión cruzada y metadatos de la migración exacta antes/después. Verificar workflows remotos tras push si credenciales CLI disponibles; no equiparar build local con Actions verde ni despliegue.
