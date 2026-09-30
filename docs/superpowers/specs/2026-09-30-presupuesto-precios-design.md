# Presupuesto mensual de precios separado de gastos reales

Continuación autorizada de la auditoría. Cambio del flujo existente en cuatro consumidores: costo operativo para precio = costos_fijos activos + costos_variables.monto_referencia. Las tablas ya representan valores mensuales previstos y permiten editar conceptos. Extras previstos se cargan como conceptos variables; no crear otro monto que duplique esas filas. No sumar ni consultar `gastos` para calcular precios, cotizaciones, costos de combos o planificación de precios.

Los gastos reales permanecen registrados y se descuentan una sola vez en el resultado del mes correspondiente. Ganancias distingue presupuesto para precio de costo operativo estimado (fijos/variables actuales) y gasto real del mes; la receta no acumula todos los gastos pasados. No copiar históricos a presupuesto, borrar registros ni cambiar datos de producción.

Costos debe mostrar Presupuesto mensual para precios, fijos activos, variables previstos y costo por unidad objetivo. Explicar que los gastos reales se ven en Ganancias y que registrar un gasto no cambia la carta. Precios y Marketing usan exactamente el mismo presupuesto. Cambiar un concepto previsto sí cambia el precio calculado; retirar gastos del cálculo puede bajar precios antes inflados. Las ventas guardadas y el ledger no se recalculan.

Validar montos previstos finitos y no negativos y objetivo de unidades positivo cuando exista presupuesto. Lectura fallida nunca equivale a presupuesto cero. Mantener redondeo, rendimiento, gramajes, tapa, comisiones, márgenes, permisos y caché offline vigentes. No nuevas columnas/DDL: evita volver a romper DTOs estrictos de clientes antiguos. Esos clientes deben actualizarse para usar la nueva regla.

Pruebas: histórico vacío/grande/fallido no cambia precio; fijos inactivos no cuentan; variable prevista sí altera precio; presupuesto vacío legítimo cero; fuente prevista fallida/valor inválido bloquea. Fixture idéntica TS/Kotlin con subtotal mensual y costo por unidad esperado, conservando igualdad semántica. Suites y build de los cuatro; revisión y push autorizados. No pagos, notificaciones, IA paga ni escrituras de prueba reales.

Fuera de esta etapa: costo y comisión histórica por venta, versiones mensuales del presupuesto, comparador presupuesto vs gasto real, nuevas intenciones de devolución, CI general y despliegues efectivos.
