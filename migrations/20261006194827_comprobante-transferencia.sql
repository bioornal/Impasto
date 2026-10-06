-- Comprobante de una transferencia, subido por el cliente desde la web.
-- El archivo vive en el bucket privado `comprobantes`; acá solo queda dónde está.
-- Lo escribe solo la web (con la clave de backend) y lo lee solo el panel.
alter table pedidos add column if not exists comprobante_clave text;
alter table pedidos add column if not exists comprobante_tipo text;
alter table pedidos add column if not exists comprobante_subido_at timestamptz;
