# A09 — Precios seguros ante fallas de costos

Fecha: 22/09/2026. Alcance: Impasto (web) y Carro Fogón (POS). El recetario conserva sus fórmulas y datos; esta etapa no cambia cobros ni tablas de producción.

## Objetivo y criterio de éxito

El dueño eligió bloquear temporalmente las ventas cuando no se puede calcular un precio confiable, en lugar de vender con un valor anterior o asumir costo cero. Una falla de una fuente necesaria no debe publicar, cotizar ni guardar un pedido con un precio reducido por datos faltantes. Una receta individual mal configurada debe impedir vender ese producto, sin paralizar los demás.

## Enfoques considerados

1. **Bloquear ante datos incompletos (elegido).** No requiere una nueva tabla ni mantener una copia de precios. Prioriza evitar una venta subvaluada; una caída de costos puede suspender temporalmente la toma de pedidos.
2. **Último precio validado.** Permitiría continuar vendiendo, pero exige definir publicación, vigencia, sincronización y trazabilidad de esa copia en los tres sistemas. Se descarta para esta apertura.
3. **Usar `productos.precio` ante cualquier error.** Es simple, pero ese campo puede no representar el precio calculado actual; no satisface el criterio de seguridad y se descarta.

## Contrato de lectura y cálculo

- `productos` y las fuentes de costeo (`recetas`, `receta_ingredientes`, `ingredientes`, `precios_venta`, `config_negocio`, `costos_fijos`, `costos_variables`, `gastos`) son críticas. Un error de transporte, autorización o base en cualquiera de ellas invalida la cotización completa. Una lista vacía recibida correctamente no es por sí sola un error, salvo donde se requiere una relación concreta para una regla de precio.
- `promociones`, `testimonios` y `etiquetas` son decorativos para esta garantía: pueden degradar sin alterar precios. Su error debe quedar registrado, pero no suspende ventas.
- Un producto con regla de precio calculado necesita receta, componentes e ingredientes referenciados válidos, cantidades y precios numéricos, markup positivo y resultado final finito y mayor que cero. No se omite silenciosamente un ingrediente faltante. Un precio positivo que surge solo de costos operativos mientras faltan los ingredientes de su receta tampoco es válido.
- Un producto sin regla de precio calculado puede usar `productos.precio` únicamente si es finito y mayor que cero. El precio guardado no sustituye una regla de cálculo rota. Se mantiene el redondeo actual hacia arriba en múltiplos de $500; este proyecto no cambia las fórmulas del recetario.
- Si falla una fuente crítica, web y POS comunican que los precios no están disponibles y no aceptan pedidos nuevos. Si falla solamente un producto, ese producto queda no vendible con motivo de precio; los otros continúan. Una caja de empanadas no puede usar el precio del combo para ocultar un sabor inválido.

## Flujo web y POS

- En Impasto, la carga de carta y la cotización del checkout comparten la misma validación. Un carrito abierto antes de la falla se vuelve a validar en el servidor; pizzas, bebidas, mitades y cajas no se aceptan con precios cero, no finitos o sabores inválidos. El cliente ve un error reintentable y no se crea un pedido ni se inicia un cobro.
- En Carro Fogón, `GET /api/productos` y `POST /api/pedidos` usan el mismo resultado validado. La respuesta de un error crítico es explícita; el POST no toma el precio enviado por el navegador. El operario puede volver a intentar cuando se recupera el costeo. El carrito cargado previamente no evita la validación del POST.
- Un producto inválido por datos propios se muestra o se excluye con una indicación comprensible para cliente/operario, sin modificar `productos.disponible` en la base ni confundirlo con falta de stock. La condición se evalúa de nuevo al guardar.
- Los errores se registran en servidor con la fuente o producto afectado, sin revelar credenciales ni detalles internos en la respuesta pública. No se crea una copia persistente de precios ni una ruta alternativa de cobro.

## Límites

Esta corrección no resuelve cambios legítimos de precio entre ver la carta y confirmar, ni la idempotencia de un POST del POS; corresponden a A12. Tampoco modifica el cálculo de Ganancias (A06–A08), devoluciones (A18) ni la paridad de rendimiento futuro con el recetario (A13). La prueba operativa de A01/A02 con Mercado Pago sigue pendiente.

## Pruebas de aceptación

1. Simular error en cada fuente crítica, tanto rechazo de promesa como `{ data: null, error }`: web y POS bloquean cotización/guardado, sin precio cero ni pedido insertado.
2. Simular error solo en promociones, testimonios o etiquetas: los precios válidos siguen vendiéndose.
3. Simular receta sin componentes, ingrediente faltante, cantidad/precio inválidos, markup inválido y precio calculado cero: se bloquea solo ese producto; una pizza, bebida, mitad o caja que lo contenga no se puede comprar.
4. Verificar producto manual con `productos.precio > 0` y sin regla calculada: sigue disponible. Precio manual nulo, cero o no finito: queda bloqueado.
5. Verificar que la web y el POS muestran el mismo precio válido con el redondeo actual de $500 y que un carrito antiguo no puede saltarse la validación del servidor.
6. Ejecutar suites, TypeScript y builds de ambos proyectos. No realizar cobros reales ni escribir en producción para probar fallas simuladas. Un ensayo posterior en producción confirmará los mensajes y el SHA desplegado.
