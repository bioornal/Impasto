# Costeo histórico de ventas

## Objetivo y alcance autorizado
Continuar la sexta etapa de la auditoría: guardar el costo de producción y la tasa de comisión estimada de cada venta nueva, y consumirlos en Ganancias web y Android. No reconstruir hechos antiguos con precios actuales ni presentar la estimación como comisión bancaria real.

## Diseño
Se agrega `pedido_costeos`, sin columnas nuevas en pedidos. Una RPC `crear_pedido_costeado(p_pedido jsonb, p_costeo jsonb)` exclusiva de project_admin inserta pedido y costeo en la misma transacción y devuelve la fila del pedido como JSONB. Conserva defaults del pedido y sus triggers actuales. No se permiten escrituras directas de costeos. Lectura para usuario autorizado del recetario y project_admin, sin acceso anónimo. El historial permanece tras borrar el pedido y los lectores sólo incluyen pedidos presentes en su ámbito.

El costeo contiene `pedido_id`, `version=1`, `productos` (copia del JSON guardado), `costo_produccion_centavos` (entero no negativo o null si falta receta/costo), `comision_pct` (tasa válida entre 0 y 100 exclusivo), `registrado_en`. El costo excluye presupuesto operativo, extras sin receta y envío. Los extras de POS vuelven incompleto el costo total. Costo cero sólo es válido si proviene de una receta validada. La tasa utiliza el mismo default 7,99% del precio. No hay backfill.

Los servidores calculan costo desde los mismos datos usados para cotizar. Pizzas mitad y mitad promedian los costos; cajas suman sabores y cantidades; productos sin receta quedan desconocidos. Se redondea al centavo después de sumar toda la producción del pedido. Ningún campo enviado por el comprador determina el costeo. Recuperar una venta por clave de intento conserva su ficha original.

Ganancias calcula producción por pedido con actividad de producción según cobros brutos existentes. Conserva producción y comisión estimada tras devoluciones. La comisión congelada se aplica al bruto de Mercado Pago, no al neto devuelto. Costeo ausente, incompleto, versión desconocida o productos modificados: resultado histórico no disponible y cobertura visible; las proyecciones actuales permanecen separadas. Un fallo de lectura no es cero. Los gastos reales y presupuesto operativo mensual siguen fuera de esta ficha.

## Alternativas consideradas
Guardar después del pedido deja un hueco si falla la segunda escritura. Reservar antes del pedido evita ese hueco pero produce registros huérfanos. La RPC transaccional conserva las garantías con una operación y evita ambas situaciones.

## Validación
Pruebas locales de transacción, ACL, inmutabilidad, desconocidos, mitad/cajas, conservación al cambiar catálogo, devoluciones, lectura fallida y paridad de lectores. Suites y builds de los cuatro repositorios. Aplicar únicamente la migración revisada; ninguna venta/pago/aviso de prueba en producción.
