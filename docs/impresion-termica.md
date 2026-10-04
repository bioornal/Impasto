# Impresión térmica local de Impasto

Estado al 23/09/2026.

## Equipo y prueba

- Epson TM-T20II USB, controlador de Windows `EPSON TM-T20II Receipt5`.
- La impresora `EPSON TM-T20II Receipt` está configurada como predeterminada.
- El dueño confirmó salida física de la página de prueba del controlador y de un
  ticket mínimo desde Edge sin diálogo de impresión.
- La 3nStar RPT006B no fue configurada para esta solución.

## Uso diario

Abrir `scripts/abrir-terminal-impasto.cmd` desde el Explorador. Inicia Carro Fogón
(`https://carro-fogon.vercel.app`) y el panel de cocina de Impasto
(`https://www.impastopizzas.com/admin`) en un perfil separado de Microsoft Edge con
`--kiosk-printing`. Iniciar sesión en cada aplicación la primera vez. No usar ese
perfil para navegación general: cualquier página que invoque `window.print()` allí
puede imprimir sin pedir confirmación. El navegador habitual no se modifica.

Carro Fogón sigue abriendo una ventana temporal con la comanda y la imprime al
cargar; la opción de Edge elimina el diálogo de impresión, no esa ventana. El panel
de Impasto imprime desde el botón de comanda. No se modificó el código de cobro ni
de pedidos.

## Pendiente de verificar con una comanda real

- Reimprimir un pedido existente habilitado desde Carro Fogón y desde Impasto.
- Comprobar que sale papel sin diálogo y revisar ancho de 80 mm, corte, acentos,
  detalles de productos y datos del cliente.
- No crear un pedido ficticio ni cobrar solo para esta prueba.
- Si la Epson se desconecta, Windows puede dejar trabajos en cola: verificar siempre
  la salida física antes de dar una comanda por impresa.

Este estado debe copiarse a `CLAUDE.md` cuando vuelva a funcionar la edición de
archivos existentes mediante `apply_patch`.
