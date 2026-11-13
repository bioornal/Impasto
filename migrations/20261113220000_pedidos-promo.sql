-- Pedidos con promo (etapa 2): columna nueva y la función que guarda pedidos la acepta.
-- La función es la vigente en producción (20261113200000_stock-bebidas.sql) con 'promo' en la lista de columnas permitidas.
alter table pedidos add column if not exists promo jsonb;

CREATE OR REPLACE FUNCTION public.crear_pedido_costeado(p_pedido jsonb, p_costeo jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE cols text; vals text; saved public.pedidos; cost numeric; fee numeric; key text;
 v_proyecto text; v_noche date; v_consumo jsonb; v_insert jsonb; r record; cap integer; sold integer; nom text; v_masas integer;
 v_molde integer; cap_napo integer; sold_napo integer; v_stock jsonb; v_controlado jsonb;
 allowed constant text[]:=ARRAY['numero_pedido','proyecto_id','sucursal_id','modalidad','status','direccion','productos','subtotal','envio','total','total_con_descuento','metodo_pago','estado_pago','proveedor_pago','nombre_cliente','telefono_cliente','email_cliente','fecha','notas','cuando','cuenta_transferencia','cambio','referencia','id_pago','mp_order_id','external_reference','parcial_mp','promo'];
BEGIN
 IF jsonb_typeof(p_pedido) IS DISTINCT FROM 'object' OR jsonb_typeof(p_costeo) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Pedido y costeo deben ser objetos'; END IF;
 FOR key IN SELECT jsonb_object_keys(p_pedido) LOOP
  IF NOT key=ANY(allowed) THEN RAISE EXCEPTION 'Columna de pedido no permitida: %',key; END IF;
 END LOOP;
 IF jsonb_typeof(p_pedido->'productos') IS DISTINCT FROM 'array' OR jsonb_array_length(p_pedido->'productos')=0 THEN RAISE EXCEPTION 'Productos inválidos'; END IF;
 IF NOT(p_costeo ? 'costo_produccion_centavos') OR NOT(p_costeo ? 'comision_pct') THEN RAISE EXCEPTION 'Costeo incompleto'; END IF;
 IF p_costeo->'costo_produccion_centavos'<>'null'::jsonb THEN
  IF jsonb_typeof(p_costeo->'costo_produccion_centavos')<>'number' THEN RAISE EXCEPTION 'Costo inválido'; END IF;
  cost:=(p_costeo->>'costo_produccion_centavos')::numeric;
  IF cost<0 OR cost>9007199254740991 OR cost<>trunc(cost) THEN RAISE EXCEPTION 'Costo requiere centavos enteros no negativos'; END IF;
 END IF;
 IF jsonb_typeof(p_costeo->'comision_pct') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Comisión inválida'; END IF;
 fee:=(p_costeo->>'comision_pct')::numeric;
 IF fee<0 OR fee>=100 THEN RAISE EXCEPTION 'Comisión inválida'; END IF;
 -- Cupo de la noche: se bloquean las filas (orden fijo) y se descuenta; si no alcanza, nada se guarda.
 v_proyecto:=COALESCE(NULLIF(p_pedido->>'proyecto_id',''),'impasto');
 v_noche:=public.noche_de_negocio(now());
 v_consumo:=public.cupos_consumo(p_pedido->'productos',v_proyecto,v_noche);
 FOR r IN SELECT (x->>'producto_id')::uuid AS pid,(x->>'mitades')::int AS m FROM jsonb_array_elements(v_consumo) x ORDER BY 1 LOOP
  SELECT c.cupo_mitades,c.vendidas_mitades,p.nombre INTO cap,sold,nom
  FROM public.cupos_noche c JOIN public.productos p ON p.id=c.producto_id
  WHERE c.proyecto_id=v_proyecto AND c.noche=v_noche AND c.producto_id=r.pid FOR UPDATE OF c;
  IF FOUND THEN
   IF sold+r.m>cap THEN RAISE EXCEPTION 'CUPO_AGOTADO|%|%',nom,GREATEST(0,cap-sold); END IF;
   UPDATE public.cupos_noche SET vendidas_mitades=vendidas_mitades+r.m,actualizado_en=now()
   WHERE proyecto_id=v_proyecto AND noche=v_noche AND producto_id=r.pid;
  END IF;
 END LOOP;
 -- Masas de la noche: una por pizza, de la masa elegida. Las filas se crean sin límite si el dueño
 -- todavía no cargó nada. Con algún número cargado, la masa sin cargar vale 0.
 v_masas:=public.masas_consumo(p_pedido->'productos',v_proyecto);
 IF v_masas>0 THEN
  v_molde:=public.masas_molde(p_pedido->'productos');
  INSERT INTO public.masas_noche(proyecto_id,noche,masa)
  VALUES(v_proyecto,v_noche,'molde'),(v_proyecto,v_noche,'napoletana') ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.masas_noche m WHERE m.proyecto_id=v_proyecto AND m.noche=v_noche ORDER BY m.masa FOR UPDATE;
  SELECT m.cupo,m.vendidas INTO cap,sold FROM public.masas_noche m
  WHERE m.proyecto_id=v_proyecto AND m.noche=v_noche AND m.masa='molde';
  SELECT m.cupo,m.vendidas INTO cap_napo,sold_napo FROM public.masas_noche m
  WHERE m.proyecto_id=v_proyecto AND m.noche=v_noche AND m.masa='napoletana';
  IF cap IS NOT NULL OR cap_napo IS NOT NULL THEN
   IF v_molde>0 AND sold+v_molde>COALESCE(cap,0) THEN
    RAISE EXCEPTION 'MASAS_AGOTADAS|%|molde',GREATEST(0,COALESCE(cap,0)-sold);
   END IF;
   IF v_masas>v_molde AND sold_napo+v_masas-v_molde>COALESCE(cap_napo,0) THEN
    RAISE EXCEPTION 'MASAS_AGOTADAS|%|napoletana',GREATEST(0,COALESCE(cap_napo,0)-sold_napo);
   END IF;
  END IF;
  UPDATE public.masas_noche SET vendidas=vendidas+CASE WHEN masa='molde' THEN v_molde ELSE v_masas-v_molde END,actualizado_en=now()
  WHERE proyecto_id=v_proyecto AND noche=v_noche;
 END IF;
 -- Stock: después de cupos y masas, bloquear por producto_id; NULL no consume.
 v_stock:=CASE WHEN v_proyecto='impasto' THEN public.stock_consumo(p_pedido->'productos') ELSE '[]'::jsonb END;
 v_controlado:='[]'::jsonb;
 FOR r IN SELECT (x->>'producto_id')::uuid pid,(x->>'unidades')::integer cantidad FROM jsonb_array_elements(v_stock) x ORDER BY 1 LOOP
  SELECT s.unidades,p.nombre INTO cap,nom FROM public.stock_bebidas s JOIN public.productos p ON p.id=s.producto_id
  WHERE s.producto_id=r.pid AND s.proyecto_id=v_proyecto FOR UPDATE OF s;
  IF FOUND AND cap IS NOT NULL THEN
   IF r.cantidad>cap THEN RAISE EXCEPTION 'STOCK_AGOTADO|%|%',nom,cap; END IF;
   v_controlado:=v_controlado||jsonb_build_array(jsonb_build_object('producto_id',r.pid,'unidades',r.cantidad));
  END IF;
 END LOOP;
 v_insert:=p_pedido;
 IF jsonb_array_length(v_controlado)>0 THEN
  v_insert:=v_insert||jsonb_build_object('stock_consumo',v_controlado);
 END IF;
 IF jsonb_array_length(v_consumo)>0 THEN
  v_insert:=v_insert||jsonb_build_object('cupo_consumo',v_consumo);
 END IF;
 IF v_masas>0 THEN
  v_insert:=v_insert||jsonb_build_object('masas_consumo',v_masas,'masas_molde',v_molde);
 END IF;
 IF jsonb_array_length(v_consumo)>0 OR v_masas>0 THEN
  v_insert:=v_insert||jsonb_build_object('cupo_noche',v_noche);
 END IF;
 -- Insert only supplied whitelisted columns. Omitted columns retain live defaults.
 SELECT string_agg(format('%I',k),',' ORDER BY k),string_agg(format('r.%I',k),',' ORDER BY k)
 INTO cols,vals FROM jsonb_object_keys(v_insert) AS keys(k);
 EXECUTE format('INSERT INTO public.pedidos(%s) SELECT %s FROM jsonb_populate_record(NULL::public.pedidos,$1) r RETURNING *',cols,vals) INTO saved USING v_insert;
 PERFORM public.stock_mover(v_controlado,1,saved.id);
 INSERT INTO public.pedido_costeos(pedido_id,productos,costo_produccion_centavos,comision_pct)
 VALUES(saved.id,saved.productos,cost::bigint,fee);
 RETURN to_jsonb(saved);
END $function$

;
