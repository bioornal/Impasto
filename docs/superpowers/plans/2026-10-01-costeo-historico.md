# Sexta etapa: costeo histórico

1. Implementar migración aditiva `pedido_costeos` y RPC atómica; probar permisos, rollback, defaults e inmutabilidad con PGlite. No tocar pedidos históricos.
2. Extraer costo unitario del cálculo de precio existente, validar contra resolución de precios y utilizar el mismo conjunto leído. Integrar RPC en Impasto y POS preservando recuperación por intento y reintentos de numeración.
3. Incorporar lector paginado y cálculo histórico estricto en Recetario web. Mostrar cobertura y comisión estimada; no usar datos actuales como históricos.
4. Incorporar el mismo contrato y comportamiento en Android, con pruebas del dominio y estado de pantalla.
5. Revisión cruzada, suites completas y builds. Revisar y aplicar exclusivamente la nueva migración, verificar metadatos de permisos sin escrituras de negocio.
6. Documentar evidencia y límites, stage exacto de archivos propios, commit/push de cada proyecto y verificar igualdad local/remoto.

Trabajo dividido por repositorio para evitar ediciones concurrentes: un implementador captura/SQL y lectores web/Android independientes. La integración y revisión final quedan a cargo del agente principal. La continuidad e integración ya están autorizadas por el usuario.
