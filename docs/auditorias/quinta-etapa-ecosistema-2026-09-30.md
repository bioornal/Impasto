# Quinta etapa — presupuesto de precios

## Resultado

El costo operativo usado para fijar precios es ahora **fijos activos + variables mensuales previstos** en los cuatro proyectos. Los gastos reales acumulados no se consultan ni suman al presupuesto de la carta, cotizaciones, Marketing, panel inicial o planificación. Para prever extras, se editan/agregan conceptos en Costos variables, sin copiar automáticamente gastos históricos.

Ganancias conserva los gastos efectivamente registrados del mes y los descuenta una sola vez en el resultado. Un fallo al leer gastos reales impide presentar ese resultado, pero no convierte el presupuesto de precios en cero ni cambia las proyecciones que sí tienen sus fuentes completas. Los cobros, devoluciones y ventas guardadas no se reescriben.

Costos y Precios aclaran qué importe es previsto. Los datos guardados inválidos siguen visibles para corregirlos; sus totales se muestran no disponibles, y los consumidores de precios rechazan el presupuesto inválido. Retirar gastos históricos puede reducir precios que antes estaban inflados. Editar montos previstos sigue modificando el precio calculado, conservando rendimiento, tapa, gramajes, márgenes, comisión y redondeo de cada canal.

No se requieren tablas/columnas nuevas ni migración. No hubo escrituras, pagos, devoluciones, avisos o llamadas de IA de prueba en producción. Clientes Android antiguos conservan su cálculo anterior hasta actualizarse; el push de los otros proyectos no actualiza el teléfono.

## Evidencia

- Impasto: suite completa y build Next correctos. Regresión funcional del catálogo demuestra precio constante con historial vacío, muy grande o no disponible; editar una variable prevista sí altera el precio. Valores previstos inválidos bloquean.
- Carro: suite completa y build Next correctos; misma regresión de precio, independencia de la fuente gastos y rechazo de presupuesto inválido. Avisos anteriores de imágenes y dependencias de efecto permanecen.
- Recetario web: 225 pruebas, 15 archivos; build Astro/Netlify/PWA correcto. Costos, Precios, Marketing, Inicio y Ganancias comparten el helper. Avisos anteriores de SDK crypto y Browserslist permanecen.
- Android: 341 pruebas, cero fallos; testDebugUnitTest y assembleDebug correctos. Catalogo/Marketing, Precios, Inicio, Costos y Ganancias comparten presupuesto estricto. Dos pruebas adicionales comprueban estado editable con monto inválido y corrección de objetivo sin perder presupuesto.
- Cuatro copias idénticas de la fixture de presupuesto: fijos activos/inactivos, variables previstas, decimales, cero legítimo y extra previsto; subtotal y costo por unidad coinciden en TypeScript/Kotlin. Verificado hash de contenido idéntico.

RED/GREEN registrado para independencia del historial en los canales, presupuesto inválido en Android/web y coerción de hexadecimal en TS. La revisión independiente encontró dos problemas de recuperación de editores: valores inválidos ocultaban las filas en web o toda la pantalla en Android. Corregidos antes de publicar; se bloquearon sólo los cálculos, manteniendo los datos editables. El cambio posterior de render web se verificó con revisión de flujo y build, no con una sesión visual real.

## Límites y siguiente etapa

Esta entrega define presupuesto mensual previsto, no versiones históricas de presupuesto ni cierre económico definitivo. Fijos/variables de Ganancias y comisiones siguen siendo estimaciones actuales. Sigue pendiente guardar costo y comisión del momento de cada venta, conciliación de liquidaciones bancarias, segunda intención de devolución/reverso manual, CRM/CI/paginación restante, accesibilidad, despliegues efectivos, release Android y restauración de backups.

No se abrió una sesión real de edición ni se instaló la APK en teléfono en esta etapa. La paridad se comprueba con fixtures; no se certifican condiciones reales de operación por los builds.
