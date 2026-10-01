# Plan de séptima etapa

1. CI: inspeccionar lockfiles, runtimes y variables de build; crear workflows web/Impasto/POS, mejorar Android existente. Validar sintaxis/contrato y ejecutar comandos equivalentes sin secretos.
2. CRM: inspeccionar esquema real clientes/pedidos/ledger. Crear RPCs aditivas de perfil atómico y lectura derivada paginada; probar SQL local con datos ficticios y permisos.
3. Integrar servidores Impasto/Carro, retirar incremento manual y lectura+incremento. Panel cliente consume métricas autoritativas y errores; asociación por teléfono exacto normalizado en historial. Probar que contactos/reintentos no cuentan ni fallos se convierten en cero.
4. Accesibilidad web: zoom y controles sin nombre auditados. Android: semántica de navegación/acciones y tamaños táctiles. Revisión de código/compilación sin afirmar validación física.
5. Revisión cruzada, suites completas/builds y aplicación exclusiva de migración revisada, sin escrituras de prueba en producción. Documentar resultados y pendientes.
6. Stage exacto de archivos propios, commits/push y comparación HEAD/origin. Verificar CI remoto si acceso disponible y comunicar estado real.

Distribución independiente: workflows (implementador CI), accesibilidad web, accesibilidad Android; agente principal CRM e integración. Mantener cambios paralelos ajenos fuera del stage. Continuación y push autorizados en la conversación.
