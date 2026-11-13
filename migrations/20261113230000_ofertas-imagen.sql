-- Imagen de cada promo (la sube el dueño desde el panel). URL pública del bucket DB, en promos/<id>/.
alter table ofertas add column if not exists imagen text;
