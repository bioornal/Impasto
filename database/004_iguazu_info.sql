update info_empresa_impasto
set informacion = case categoria
  when 'nombre' then 'Impasto - Pizzeria y Empanadas'
  when 'direccion' then 'Santa María esq. Obispo Angelelli, Puerto Iguazú'
  when 'horarios' then 'Martes a Domingo de 19:30 a 00:00. Cerrado los lunes.'
  when 'whatsapp' then '(03757) 42-1840'
  when 'instagram' then '@impasto.iguazu'
  when 'delivery' then 'Costo de delivery: 3000 pesos. Retiro en local: sin cargo.'
  else informacion
end,
updated_at = now()
where categoria in ('nombre', 'direccion', 'horarios', 'whatsapp', 'instagram', 'delivery');

insert into info_empresa_impasto (categoria, informacion, updated_at)
select 'email', 'hola@impastoiguazu.com.ar', now()
where not exists (
  select 1 from info_empresa_impasto where categoria = 'email'
);
