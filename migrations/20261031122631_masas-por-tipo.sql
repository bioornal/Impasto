-- Masas de la noche por tipo (pedido del dueño, 31/10/2026): un cupo para la napoletana y otro para
-- la de molde, porque un solo número dejaba vender más de una masa que las que había. Cada pizza usa
-- una masa de la que eligió el cliente, entera o mitad y mitad.
-- Con algún número cargado, la masa sin cargar vale 0 (no se vende). Las dos sin cargar: sin límite.
-- Servidor propio: sin OWNER TO postgres (todo es de project_admin).

-- Una fila por masa. Las filas de noches anteriores (el número único) quedan como napoletana.
ALTER TABLE public.masas_noche ADD COLUMN masa text NOT NULL DEFAULT 'napoletana' CHECK (masa IN ('napoletana','molde'));
ALTER TABLE public.masas_noche ALTER COLUMN masa DROP DEFAULT;
ALTER TABLE public.masas_noche DROP CONSTRAINT masas_noche_pkey;
ALTER TABLE public.masas_noche ADD PRIMARY KEY (proyecto_id, noche, masa);

-- Cuántas de `masas_consumo` son al molde; el resto, napoletanas. Sin valor (pedidos de antes) = 0.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS masas_molde integer;

-- Pizzas al molde de un pedido. Web: `type` pizza o pizza-half. POS: sin `type`, solo sus pizzas traen `masa`.
CREATE FUNCTION public.masas_molde(p_productos jsonb) RETURNS integer
LANGUAGE sql STABLE SET search_path='' AS $$
 WITH items AS (
  SELECT e, GREATEST(1, COALESCE(
    CASE WHEN e->>'qty' ~ '^[0-9]+$' THEN (e->>'qty')::int END,
    CASE WHEN e->>'cantidad' ~ '^[0-9]+$' THEN (e->>'cantidad')::int END, 1)) AS qty
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_productos)='array' THEN p_productos ELSE '[]'::jsonb END) e
  WHERE jsonb_typeof(e)='object'
 )
 SELECT COALESCE(sum(qty),0)::int FROM items i
 WHERE i.e->>'masa'='molde' AND (i.e->>'type' IN ('pizza','pizza-half') OR COALESCE(i.e->>'type','')='')
$$;

-- Suma (signo 1) o devuelve (signo -1) las masas de un pedido, cada una en su fila, sin controlar el cupo.
DROP FUNCTION public.masas_mover(text,date,integer,integer);
CREATE FUNCTION public.masas_mover(p_proyecto text, p_noche date, p_masas integer, p_molde integer, p_signo integer) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.masas_noche
 SET vendidas=GREATEST(0, vendidas + p_signo*(CASE WHEN masa='molde' THEN COALESCE(p_molde,0) ELSE COALESCE(p_masas,0)-COALESCE(p_molde,0) END)),
     actualizado_en=now()
 WHERE proyecto_id=p_proyecto AND noche=p_noche
$$;
REVOKE ALL ON FUNCTION public.masas_mover(text,date,integer,integer,integer) FROM PUBLIC, anon, authenticated;

-- El panel carga "cuántas me quedan ahora" de una masa: cupo = vendidas + quedan, en un solo paso.
DROP FUNCTION public.fijar_masas_restantes(text,integer);
CREATE FUNCTION public.fijar_masas_restantes(p_proyecto text, p_masa text, p_quedan integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE fila public.masas_noche;
BEGIN
 IF p_masa IS NULL OR p_masa NOT IN ('napoletana','molde') OR p_quedan IS NULL OR p_quedan < 0 OR p_quedan > 2000 THEN RAISE EXCEPTION 'Masas inválidas'; END IF;
 INSERT INTO public.masas_noche(proyecto_id, noche, masa, cupo)
 VALUES (p_proyecto, public.noche_de_negocio(now()), p_masa, p_quedan)
 ON CONFLICT (proyecto_id, noche, masa) DO UPDATE
  SET cupo = LEAST(2000, public.masas_noche.vendidas + EXCLUDED.cupo), actualizado_en = now()
 RETURNING * INTO fila;
 RETURN to_jsonb(fila);
END $$;
REVOKE ALL ON FUNCTION public.fijar_masas_restantes(text,text,integer) FROM PUBLIC, anon, authenticated;

-- "Quitar límite" del panel: las dos masas vuelven a sin cargar. Las vendidas se conservan.
CREATE FUNCTION public.quitar_limite_masas(p_proyecto text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.masas_noche SET cupo=NULL, actualizado_en=now()
 WHERE proyecto_id=p_proyecto AND noche=public.noche_de_negocio(now())
$$;
REVOKE ALL ON FUNCTION public.quitar_limite_masas(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pedidos_cupo_al_actualizar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE muerto boolean;
BEGIN
 IF (NEW.cupo_consumo IS NULL AND NEW.masas_consumo IS NULL) OR NEW.cupo_noche IS NULL THEN RETURN NEW; END IF;
 muerto := NEW.status='cancelado' OR NEW.estado_pago='rechazado';
 IF muerto AND NOT NEW.cupo_liberado THEN
  PERFORM public.cupos_mover(NEW.proyecto_id, NEW.cupo_noche, NEW.cupo_consumo, -1);
  PERFORM public.masas_mover(NEW.proyecto_id, NEW.cupo_noche, NEW.masas_consumo, NEW.masas_molde, -1);
  NEW.cupo_liberado := true;
 ELSIF NOT muerto AND NEW.cupo_liberado THEN
  PERFORM public.cupos_mover(NEW.proyecto_id, NEW.cupo_noche, NEW.cupo_consumo, 1);
  PERFORM public.masas_mover(NEW.proyecto_id, NEW.cupo_noche, NEW.masas_consumo, NEW.masas_molde, 1);
  NEW.cupo_liberado := false;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.pedidos_cupo_al_eliminar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (OLD.cupo_consumo IS NOT NULL OR OLD.masas_consumo IS NOT NULL) AND OLD.cupo_noche IS NOT NULL AND NOT OLD.cupo_liberado THEN
  PERFORM public.cupos_mover(OLD.proyecto_id, OLD.cupo_noche, OLD.cupo_consumo, -1);
  PERFORM public.masas_mover(OLD.proyecto_id, OLD.cupo_noche, OLD.masas_consumo, OLD.masas_molde, -1);
 END IF;
 RETURN OLD;
END $$;

-- Igual que antes, con un control por masa. Se bloquean primero las filas de los cupos y después las
-- dos de masas, siempre en ese orden. Error: 'MASAS_AGOTADAS|<masas que quedan>|<masa>'.
CREATE OR REPLACE FUNCTION public.crear_pedido_costeado(p_pedido jsonb,p_costeo jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cols text; vals text; saved public.pedidos; cost numeric; fee numeric; key text;
 v_proyecto text; v_noche date; v_consumo jsonb; v_insert jsonb; r record; cap integer; sold integer; nom text; v_masas integer;
 v_molde integer; cap_napo integer; sold_napo integer;
 allowed constant text[]:=ARRAY['numero_pedido','proyecto_id','sucursal_id','modalidad','status','direccion','productos','subtotal','envio','total','total_con_descuento','metodo_pago','estado_pago','proveedor_pago','nombre_cliente','telefono_cliente','email_cliente','fecha','notas','cuando','cuenta_transferencia','cambio','referencia','id_pago','mp_order_id','external_reference','parcial_mp'];
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
 v_insert:=p_pedido;
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
 INSERT INTO public.pedido_costeos(pedido_id,productos,costo_produccion_centavos,comision_pct)
 VALUES(saved.id,saved.productos,cost::bigint,fee);
 RETURN to_jsonb(saved);
END $$;
