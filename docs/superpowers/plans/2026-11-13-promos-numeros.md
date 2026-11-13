# Ver números — Implementation Plan

**Goal:** Implementar el agregado del spec de promociones, solo en el panel.
**Architecture:** Cálculo puro compartido entre API y editor; contexto del servidor con lecturas independientes; detalle reutilizable en React.
**Tech Stack:** TypeScript, Next.js, React, SDK existente, node:test y Playwright local.
**Spec:** docs/superpowers/specs/2026-11-13-promociones-panel-design.md, Agregado 13/11/2026.

## Restricciones
Sin red ni base; rama promociones-numeros, sin push. No tocar superficies públicas. Montos es-AR sin decimales. Conservar validación y semáforo existentes.

## Revisión
Opciones con precio y costo no correlacionados; pedidos con descuentos cada N; regalos múltiples con suplemento; corte de noche a las 06:00 y paginación; fallos independientes del contexto.

## Tareas
- [x] Tests primero en tests/promos.test.ts: Dúo 19318/4100/3, descuento 15668/7750, regalo, rangos, envío y datos faltantes. Implementar analisisOferta en lib/promos.ts sin alterar margenOferta.
- [x] Tests de contexto simulado y API; implementar contextoNegocio en lib/ofertas-admin.ts y agregar contexto/analisis al GET. Reusar diaDeNegocio y configuración existente sin consultar servicios reales.
- [x] Resumen, detalle compartido, contexto y editor en Promociones.tsx/admin.css. Verificar UI real con fixture sin red a 1440 y 375 px.
- [x] pnpm test, tsc --noEmit, eslint de archivos tocados, build offline; revisar diff y crear commits chicos si el sandbox permite el índice.

## Registro
Diseño y ejecución ya autorizados explícitamente por el usuario; se procede en esta rama sin nueva aprobación. No existen herramientas fetch-docs conectadas; documentación SDK local leída, sin acceso de red por instrucción del usuario. El contexto de envío usará los campos de sucursales directamente: getBusinessConfig oculta fallos con defaults y además consulta masas, por lo que no permite informar datos ausentes con precisión.

## Cierre
- C?lculos, contexto, GET y UI completos. RED?GREEN: an?lisis ausente; contexto ausente; GET sin contexto; umbral de env?o cero; pedidos con total cero.
- Verificaciones finales: suite pnpm test, tsc --noEmit, eslint de TypeScript tocado, build y Playwright 1440/375 aprobados, sin red/base real. Logs y diez capturas en tmp/promos-numeros-*.
- Revisi?n independiente: corregido umbral cero para coincidir con cotizaci?n; sin otros hallazgos matem?ticos. Se conserva el rechazo existente si faltan datos de precios efectivos: los errores exclusivamente informativos del contexto devuelven null y no bloquean GET (test de API agregado).
- Decisi?n: ContextoNegocio conserva los campos pedidos; ContextoNegocioLeido permite null en env?o/comisi?n cuando falla su lectura. Noches: 28 incluida la actual hasta el instante de consulta, solo impasto no cancelados, noches con pedidos, sin excluir totales cero.
- Git add rechazado por Permission denied al crear .git/index.lock. Sin commits ni push; cambios completos en el ?rbol de trabajo. AGENTS.md y archivos previos ajenos se conservaron.
