# Sexta etapa — costeo histórico por venta

## Resultado

Impasto y Carro guardan el pedido y su ficha de costo en una única transacción mediante `crear_pedido_costeado`. Se conserva el costo de producción calculado con los mismos datos de la cotización, la tasa configurada de comisión estimada y los productos originales. Cambiar después ingredientes, recetas o comisión no modifica la ficha. Recuperar un intento ya registrado devuelve la venta original sin volver a costear.

Las mitades promedian costos de sus variedades; las cajas suman cantidades por sabor. Los productos sin receta y extras de POS sin composición quedan con costo desconocido, nunca cero inventado. El costo excluye presupuesto operativo y envío. Los datos internos de costos se mantienen fuera del JSON público de catálogo y cotización mediante contextos privados.

Ganancias web y Android usan la ficha por pedido con actividad de cobro bruto documentado, independientemente del catálogo actual. Una devolución conserva la base de producción y la comisión estimada sobre el bruto MP. La comisión se redondea al centavo por pedido. Sin ficha, con costo desconocido, productos modificados o versión no compatible, el resultado queda no disponible y se muestra cobertura. La comisión puede seguir disponible aunque falte el costo; sin bruto MP su estimación es cero.

Los pedidos antiguos no se rellenan con costos actuales. Las proyecciones y ajustes de unidades siguen usando valores actuales y se mantienen separados del resultado. Fallos del catálogo/configuración u objetivo afectan esas proyecciones; el presupuesto mensual financiero se calcula directamente desde fijos activos y variables previstos. Gastos reales se descuentan una sola vez. Pedidos, gastos, fichas y movimientos se leen hasta página vacía con orden estable; páginas incompletas, errores y duplicados no se publican como totales completos. Gastos inválidos bloquean el resultado.

## Backend y compatibilidad

Aplicada exclusivamente `migrations/20261001003000_pedido-costeos.sql` al backend compartido `3agqcygs.us-east.insforge.app`. No se agregaron columnas a pedidos ni ingredientes, preservando la compatibilidad del DTO estricto de clientes anteriores.

Verificación posterior por metadatos: tabla y RPC pertenecen a postgres, RLS activo, RPC SECURITY DEFINER con search_path vacío. Anon carece de acceso; authenticated sólo puede leer según `es_usuario_recetario`; project_admin puede leer y ejecutar la RPC, sin INSERT/UPDATE/DELETE/TRUNCATE directo en fichas. Fichas inmutables sin borrado en cascada; los lectores excluyen registros sin pedido presente. La tabla nueva estaba vacía tras la migración: no hubo pedidos, pagos, devoluciones, avisos ni IA de prueba en producción.

## Evidencia

- Impasto: suite completa y build Next correctos. Cuatro pruebas de captura y cuatro de SQL; las SQL incorporan las migraciones reales del ledger y avisos, demostrando rollback de todos los efectos, defaults, permiso de lectura condicionado, ACL e inmutabilidad.
- Carro: suite completa y build Next correctos. Captura de costos, extras desconocidos, formato RPC y recuperación de intento cubiertos. Permanecen warnings anteriores de imágenes y dependencia de efecto.
- Recetario web: 248 pruebas en 17 archivos y build Astro/Netlify/PWA correctos. Permanecen warnings anteriores de crypto externo y Browserslist.
- Android: 355 pruebas, cero fallos/errores/omitidas; testDebugUnitTest y assembleDebug correctos. APK debug generado, sin instalación en teléfono ni publicación release.
- Fixture de costeo idéntica en los cuatro repositorios, consumida por pruebas de lectores web/Android: devolución total, cobro mixto, costo desconocido y cero conocido. SHA256: `486E716145D5382D1076E0A96A89CACEF14B5D790E084D7B8A10470F2BEF6339`.

Las revisiones cruzadas encontraron y corrigieron: guardia web que podía operar con costo null; lectura truncada de pedidos/gastos; Android descartando gastos inválidos; cobertura engañosa tras fuentes fallidas; dependencia web del objetivo/configuración actual. Nuevas pruebas verifican guardias y filas inválidas en páginas posteriores. Revisión independiente de captura/SQL sin bloqueos para aplicar la migración; relectura posterior confirma correcciones en los lectores.

## Límites y trabajo restante

Se congela el cálculo de receta vigente, no compras reales, consumo físico ni comisión/liquidación bancaria efectiva. Presupuesto operativo mensual sigue siendo actual: no hay versión histórica ni cierre contable completo. El envío carece de costo registrado. Un cobro parcial conserva el costo de todo el pedido. Las ventas anteriores o creadas por servidores todavía no actualizados carecen de ficha.

Quedan conciliación bancaria, segunda intención de devolución/reversos manuales, CRM/contadores, CI y contratos generales, paginación de otras fuentes, accesibilidad, despliegues efectivos, Android release y restauración de backups. La revisión también señala validar metadatos explícitamente malformados de rendimiento/gramaje: esta etapa conserva el modelo de precios existente y sus fallbacks anteriores.

Push y builds no prueban despliegue efectivo ni actualizan una app instalada. No se abrió una sesión operativa real para certificar la pantalla. Cambios paralelos de marca/logo y archivos ajenos quedaron fuera de la implementación de esta etapa.
