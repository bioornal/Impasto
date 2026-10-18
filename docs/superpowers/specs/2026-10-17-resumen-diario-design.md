# Resumen diario en el panel — diseño (17/10/2026)

## Qué pidió el dueño

Ver, por día, cuántas unidades se vendieron y cuánto fue en efectivo, transferencia y Mercado Pago.
Eligió una sección nueva del panel admin de Impasto con una tabla por día. Una **unidad** es una pizza
(entera o mitad y mitad) o **una docena de empanadas**.

## Diseño

- Sección **"Resumen diario"** en el menú del panel, debajo de Dashboard (`app/admin/components/ResumenDiario.tsx`).
- **Noche de trabajo:** de 06:00 a 05:59 del día siguiente, hora de Argentina (UTC-3 fijo), igual que el POS.
- **Pedidos que cuentan:** web y POS juntos, con la regla del Dashboard (`esPedidoValidoParaVentas`):
  sin cancelados ni Mercado Pago sin aprobar.
- **Arriba:** la noche elegida (por defecto, la última con ventas; ‹ › para moverse), con unidades, pedidos
  y total vendido (con envíos). Bajo las unidades: pizzas y docenas si hubo empanadas; si no, cuántas pizzas
  fueron de la web y cuántas del POS. Debajo, una tabla por medio de pago con pedidos, unidades y total.
  "Sin medio" aparece solo si hay alguno.
- **Abajo:** hasta 30 noches con ventas, la más nueva primero: unidades, pedidos, efectivo, transferencia,
  Mercado Pago y total. Tocar una fila la muestra arriba.
- **Pizzas:** la web guarda `type`; el POS no, así que se reconoce por el nombre de un producto de
  categoría pizzas o por "Mitad … / Mitad …".
- **Empanadas:** la web vende "Caja x6/x12/x24" (la de 6 es media docena); el POS, empanadas sueltas con el
  nombre de un producto de categoría empanadas. Se suman y se dividen por 12.
- **Canal:** `AdminOrder.canal` sale de la referencia real (`IM-…` web, el resto POS): el id visible
  no sirve porque a un pedido del POS sin referencia se le inventa `IM-0003`.
- Sin cambios en la base: se calcula con los pedidos que el panel ya carga (todo el historial).
- Lógica pura en `lib/resumen-diario.ts`, con `tests/resumen-diario.test.ts`.
