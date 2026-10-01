# Séptima etapa — calidad y operación

## Resultado

CRM de Impasto y Carro calcula compras únicas con neto cobrado positivo desde pedidos y movimientos. Guardar un contacto o reintentar no suma compras. Una devolución total deja de contar; una parcial conserva una compra con su neto. Si un reembolso antiguo carece de importes, se excluye y se indica la falta de documentación.

Se retira la asociación por nombre o últimos ocho dígitos. Se utiliza el teléfono completo normalizado, sin inventar equivalencias de prefijos. La escritura de perfiles conserva campos ante textos vacíos y usa bloqueo transaccional por identidad. Perfiles legacy ambiguos causan un error explícito; no se fusionan automáticamente. El contador almacenado antiguo no se reescribe ni gobierna las nuevas lecturas.

El perfil se guarda en la misma transacción del pedido, costo histórico, movimientos y avisos. El panel consume métricas verificadas, presenta fallos y fecha de última lectura, y permite actualizar compras. El polling de cocina no sobrescribe métricas financieras con una muestra de pedidos. El detalle identifica esa muestra como pedidos cargados.

CI en los cuatro repositorios instala desde lockfiles, ejecuta pruebas y compila sin credenciales ni acceso al backend de producción. Android conserva pruebas, no distribuye el APK de configuración ficticia y separa la compilación configurada de main. Si faltan secretos de configuración pública, omite su distribución explícitamente.

Accesibilidad: etiquetas asociadas, acciones con nombre y contexto, selección anunciada, foco de teclado visible y salto al contenido en web; navegación y controles Android con semántica y áreas táctiles de al menos 48 dp en los controles tratados. Precios permite envolver controles y el menú Más permite desplazamiento. El zoom web ya estaba permitido y se conservó.

## Backend

Aplicada exclusivamente `20261001130000_crm-compras.sql` al backend compartido `3agqcygs.us-east.insforge.app` el 1 de octubre de 2026. Verificados dos índices y trigger habilitado. Funciones propiedad de postgres, SECURITY DEFINER y search_path vacío; RPCs de lectura/escritura sólo ejecutables por project_admin, sin acceso anon/authenticated. Trigger invocable por PostgreSQL, sin ejecución directa de roles de aplicación.

Inspección agregada posterior: cero perfiles sin dígitos y cero identidades de teléfono duplicadas. No se crearon pedidos, cobros, devoluciones ni avisos de prueba en producción. La migración no agrega columnas a pedidos/ingredientes ni modifica DTOs.

## Evidencia

- Pruebas CRM de transporte en ambos canales: lectura hasta página vacía, fallos de páginas posteriores, duplicados de identidad, métricas inválidas, confirmación de contacto y teléfono exacto.
- Siete pruebas SQL locales con migraciones reales: reintentos, cobros, devolución parcial/total, legado desconocido, paginación/ACL, alias legacy y rollback conjunto de cinco tablas ante costo fallido o intento duplicado.
- Adapter del panel: métricas RPC, fechas desconocidas, errores HTTP/JSON/contrato y asociación exacta del historial.
- Suites completas y builds locales: Impasto y Carro correctos; Recetario web 248 pruebas y build correctos; Android 355 pruebas y assembleDebug correctos.
- Instalaciones limpias aisladas sin archivos de entorno de producción: lockfiles, pruebas y builds de los cuatro proyectos correctos. Revisión independiente de workflows y CRM completada.

## Límites y pendientes

No se certificó navegación visual en navegador, TalkBack ni escalado físico de fuentes. El diálogo de confirmación de POS conserva foco inicial/Escape; falta completar captura y restitución de foco. Las lecturas paginadas del CRM usan varias solicitudes: no constituyen un cierre contable con snapshot global entre páginas. No se probó concurrencia bajo carga.

Quedan conciliación de comisiones/liquidaciones bancarias, devoluciones sucesivas y reversos manuales, contratos generales y validación de gramaje/rendimiento malformado, paginación de otras fuentes, despliegues efectivos, Android firmado/instalado y restauración de backups. Las instalaciones mostraron avisos preexistentes de dependencias; no se actualizan dependencias ni se declara una auditoría de seguridad limpia en esta etapa.

Push y CI no prueban despliegue efectivo ni actualizan una app ya instalada. Archivos ajenos y cambios paralelos de marca quedan fuera del stage de esta etapa.
