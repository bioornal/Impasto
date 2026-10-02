# Cierre técnico del ecosistema — 2 de octubre de 2026

Esta entrega cierra los cambios de código verificables de la auditoría. La entrega firmada de Android y la conciliación bancaria real permanecen pendientes de fuentes externas; no se consideran realizadas.

## Cambios

- Contrato común de gramaje y rendimiento en los cuatro consumidores. Datos explícitos inválidos bloquean el cálculo afectado; las ausencias históricas conservan compatibilidad. Fixture común y pruebas de paridad.
- Paginación de catálogos y listas revisadas: una página corta no implica fin de lectura; los errores, identidades repetidas o faltantes descartan el resultado parcial.
- Carro utiliza un diálogo nativo modal con foco inicial, Escape y devolución del foco. Una prueba renderiza el componente real, además de comprobar su ciclo de vida.
- Impasto registra devoluciones manuales ya realizadas con motivo, UUID durable, saldo documentado y asiento inmutable. No ejecuta transferencias bancarias.
- Devoluciones sucesivas de Mercado Pago: UUID distinto por operación, solicitud y saldo congelados, una operación activa por pedido y reintentos con el mismo cuerpo. Transporte de centavos exactos; conciliación previa y posterior.
- Android incorpora configuración de release con identidad original externa, validación de certificado y workflow manual. No se generó una identidad nueva ni se publicó un APK sin firma.
- Next actualizado a 16.3.8 en Impasto y 15.5.27 en Carro; Recetario migrado a Astro 7.3.5 y adaptador Netlify 8.2.6 con Node 24. Service worker y función SSR generados en el build.

## Verificación local

Los comandos completos de test y build de las tres webs finalizaron correctamente. Recetario web: 268 tests. Android: testDebugUnitTest, assembleDebug y assembleRelease aprobados; 366 tests en el árbol local, incluidos seis de Preparaciones de otro chat. Ese trabajo externo no se incluye en este commit: la suite propia contiene 360 tests y fue validada por CI sobre el commit publicado.

Las tres pruebas de rollback Room se ejecutaron explícitamente con la instrumentación personalizada en el emulador sin conexión: compras, precios y borrado. Gradle informa cero tests porque ese runner no emite eventos JUnit; la instrumentación respondió «3 pruebas de rollback Room aprobadas». No hubo ventas, devoluciones, avisos ni modificaciones de negocio de prueba en producción.

Una revisión independiente de SQL, rutas, solicitudes congeladas, paginación, modal y despliegue no encontró bloqueos críticos/importantes. Los límites de abajo siguen abiertos.

Auditoría de dependencias al cierre local: Impasto y Carro sin alertas conocidas; Recetario conserva nueve entradas altas transitivas, procedentes de dos paquetes sin parche publicado: extract-zip y node-forge, a través de herramientas de desarrollo de Netlify. Sharp se actualizó a 0.35.5. No se afirma que el grafo de Recetario esté libre de vulnerabilidades. No abrir el servidor de desarrollo a redes no confiables ni extraer archivos de origen desconocido. Referencias: [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [extract-zip](https://github.com/advisories/GHSA-jmr9-qjv8-65gv).

## Base y recuperación

Aplicadas exclusivamente las migraciones `20261001150000_devoluciones-manuales.sql` y `20261001160000_devoluciones-operaciones.sql`. ACL/RLS verificadas: sin escritura directa project_admin en operaciones, sin ejecución pública de los RPC de devolución. No se crearon operaciones/devoluciones de prueba en producción.

Backup del proveedor previo a migraciones: `1789a554-2683-48d1-ad0a-d6812983a3c7`, completado. Exportación privada posterior: `ecosistema-20261002-070410`, fuera de Git. Restauración aislada verificada: 28 tablas, 1.510 filas, 69 restricciones, 12 triggers, 28 funciones, 52 políticas y 412 entradas de permisos de tablas; igualdad de todas las filas y permisos de tablas comprobada. Los nuevos scripts `tools/capture-application-backup.ps1` y `tools/verify-application-backup.mjs` permiten repetir la prueba.

La captura de datos utiliza un único snapshot SQL; los metadatos se consultan por separado. No ejecutar DDL simultáneo con la captura. La restauración es de la aplicación pública: auth.users se representa únicamente por UUID para comprobar FK, auth.uid devuelve NULL. No acredita recuperación completa de credenciales, almacenamiento de archivos ni servicios administrados. No se restauró la base de producción.

## Pendientes externos y límites

1. Firma Android: keystore original, alias, contraseñas y huella del certificado; confirmar versionCode instalado antes de actualizar. Sin estos datos no hay release distribuible. El workflow rechaza identidad ausente o parcial.
2. Prueba física: actualización, voz, modo sin señal y TalkBack en el teléfono. El emulador solo acredita las tres pruebas de integridad local indicadas.
3. Finanzas reales: archivos de liquidaciones/comisiones de Mercado Pago y movimientos bancarios. Los costos históricos están congelados y las comisiones son estimaciones, hasta conciliar documentos reales.
4. Mercado Pago: pruebas automatizadas simuladas y SQL aislado; no prueba sandbox ni devolución real. Un refund externo simultáneo con idéntico importe no puede distinguirse de la intención local mediante UUID del proveedor: la conciliación compara IDs nuevos e importes contra la referencia anterior.
5. Preparaciones: la web ya contiene commits de otro chat; sus cambios Android permanecen ajenos a este commit y deben publicarse desde ese trabajo antes de distribuir la app. Sus nuevas lecturas no se incluyen en la afirmación de paginación revisada.

Los SHA, enlaces de CI y estados finales de producción se registran en la conversación después del push. Una compilación local no acredita despliegue efectivo.

## Evidencia publicada

| Proyecto | Commit de implementación | CI |
|---|---|---|
| Impasto | 5337f002ab49665da469dee9b21fcbe45e2e39d0 | [Aprobada](https://github.com/bioornal/Impasto/actions/runs/36993884687) |
| Carro | 82879561e8480f38e8200dfdf9368b5f71260b2c | [Aprobada](https://github.com/bioornal/carroFogon/actions/runs/36993884136) |
| Recetario web | fcdae8d5e09bd9637e8e3a66067f404a1ee454fa | [Aprobada](https://github.com/bioornal/recetario-napolitano/actions/runs/36993884490) |
| Android | 80e80bb7a7c7e09664fd090e6bcbad2e1e63d97d | [Aprobada: tests y APK debug](https://github.com/bioornal/recetario-android/actions/runs/36993884091) |

Netlify confirmó ambos SHA web publicados (`ready`); Vercel confirmó el SHA de Carro en Production con estado `success`. Comprobaciones posteriores: home Impasto/Carro HTTP 200, sus API administrativas HTTP 401 sin sesión; login y service worker de Recetario HTTP 200. El navegador redirige Inicio y Recetas a login sin sesión, con formulario visible y sin errores de consola observados. No se inició sesión ni se ejecutaron escrituras de prueba.

Tras la verificación se cerraron el emulador y el daemon Gradle iniciados para las pruebas. Los cambios no publicados de Preparaciones en Android permanecen intactos en el árbol local.