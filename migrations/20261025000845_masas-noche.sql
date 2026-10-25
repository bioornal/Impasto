-- Masas de la noche (pedido del dueño, 24/10/2026): cuántas pizzas en total se pueden vender esta
-- noche según las masas (prepizzas) que hay. Cada pizza usa una masa: entera o mitad y mitad, napoletana
-- o al molde. Empanadas y bebidas no cuentan. Va además de los cupos por sabor (cupos_noche).
-- El control vive en crear_pedido_costeado, que usan la web y el POS: si no alcanza, el pedido no se
-- guarda. Cancelar, eliminar o un pago rechazado devuelven las masas (mismos triggers que los cupos).
-- La fila de la noche se crea con el primer pedido con pizzas, así "vendidas" siempre está al día;
-- cupo NULL = sin límite (lo que pasa si el dueño no cargó nada).
-- Servidor propio: sin OWNER TO postgres (todo es de project_admin).

CREATE TABLE public.masas_noche (
 proyecto_id text NOT NULL,
 noche date NOT NULL,
 cupo integer CHECK (cupo BETWEEN 0 AND 2000),
 -- Puede pasar el cupo si un pago rechazado vuelve a aprobarse: la venta ya existe.
 vendidas integer NOT NULL DEFAULT 0 CHECK (vendidas >= 0),
 actualizado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (proyecto_id, noche)
);
ALTER TABLE public.masas_noche ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.masas_noche FROM PUBLIC, anon, authenticated;
CREATE POLICY masas_noche_admin ON public.masas_noche FOR ALL TO project_admin USING (true) WITH CHECK (true);

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS masas_consumo integer;

-- Cuántas masas usa un pedido. Web: `type` pizza o pizza-half. POS: sin `type`; es pizza si trae
-- `masa` (desde el 17/10 el POS la pone en cada pizza), si es mitad y mitad o si el nombre es el de
-- una pizza de la carta.
CREATE FUNCTION public.masas_consumo(p_productos jsonb, p_proyecto text) RETURNS integer
LANGUAGE sql STABLE SET search_path='' AS $$
 WITH items AS (
  SELECT e, GREATEST(1, COALESCE(
    CASE WHEN e->>'qty' ~ '^[0-9]+$' THEN (e->>'qty')::int END,
    CASE WHEN e->>'cantidad' ~ '^[0-9]+$' THEN (e->>'cantidad')::int END, 1)) AS qty
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_productos)='array' THEN p_productos ELSE '[]'::jsonb END) e
  WHERE jsonb_typeof(e)='object'
 )
 SELECT COALESCE(sum(qty),0)::int FROM items i
 WHERE i.e->>'type' IN ('pizza','pizza-half')
  OR (COALESCE(i.e->>'type','')='' AND (
   i.e ? 'masa'
   OR i.e->'variant'->>'kind'='half'
   OR EXISTS (SELECT 1 FROM public.productos p
    WHERE p.proyecto_id=p_proyecto AND p.nombre=i.e->>'nombre' AND p.categoria ~* 'pizz')))
$$;

-- Suma (signo 1) o devuelve (signo -1) masas de una noche, sin controlar el cupo.
CREATE FUNCTION public.masas_mover(p_proyecto text, p_noche date, p_masas integer, p_signo integer) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.masas_noche
 SET vendidas=GREATEST(0, vendidas + p_signo*COALESCE(p_masas,0)), actualizado_en=now()
 WHERE proyecto_id=p_proyecto AND noche=p_noche
$$;
REVOKE ALL ON FUNCTION public.masas_mover(text,date,integer,integer) FROM PUBLIC, anon, authenticated;

-- El panel carga "cuántas me quedan ahora": cupo = vendidas + quedan, en un solo paso (un pedido que
-- entra justo no se pisa). NULL = sin límite. Se puede cargar en cualquier momento de la noche.
CREATE FUNCTION public.fijar_masas_restantes(p_proyecto text, p_quedan integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE fila public.masas_noche;
BEGIN
 IF p_quedan IS NOT NULL AND (p_quedan < 0 OR p_quedan > 2000) THEN RAISE EXCEPTION 'Masas inválidas'; END IF;
 INSERT INTO public.masas_noche(proyecto_id, noche, cupo)
 VALUES (p_proyecto, public.noche_de_negocio(now()), p_quedan)
 ON CONFLICT (proyecto_id, noche) DO UPDATE
  SET cupo = CASE WHEN EXCLUDED.cupo IS NULL THEN NULL ELSE LEAST(2000, public.masas_noche.vendidas + EXCLUDED.cupo) END,
      actualizado_en = now()
 RETURNING * INTO fila;
 RETURN to_jsonb(fila);
END $$;
REVOKE ALL ON FUNCTION public.fijar_masas_restantes(text,integer) FROM PUBLIC, anon, authenticated;

-- Los triggers de los cupos ahora también devuelven (o vuelven a sumar) las masas.
CREATE OR REPLACE FUNCTION public.pedidos_cupo_al_actualizar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE muerto boolean;
BEGIN
 IF (NEW.cupo_consumo IS NULL AND NEW.masas_consumo IS NULL) OR NEW.cupo_noche IS NULL THEN RETURN NEW; END IF;
 muerto := NEW.status='cancelado' OR NEW.estado_pago='rechazado';
 IF muerto AND NOT NEW.cupo_liberado THEN
  PERFORM public.cupos_mover(NEW.proyecto_id, NEW.cupo_noche, NEW.cupo_consumo, -1);
  PERFORM public.masas_mover(NEW.proyecto_id, NEW.cupo_noche, NEW.masas_consumo, -1);
  NEW.cupo_liberado := true;
 ELSIF NOT muerto AND NEW.cupo_liberado THEN
  PERFORM public.cupos_mover(NEW.proyecto_id, NEW.cupo_noche, NEW.cupo_consumo, 1);
  PERFORM public.masas_mover(NEW.proyecto_id, NEW.cupo_noche, NEW.masas_consumo, 1);
  NEW.cupo_liberado := false;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.pedidos_cupo_al_eliminar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (OLD.cupo_consumo IS NOT NULL OR OLD.masas_consumo IS NOT NULL) AND OLD.cupo_noche IS NOT NULL AND NOT OLD.cupo_liberado THEN
  PERFORM public.cupos_mover(OLD.proyecto_id, OLD.cupo_noche, OLD.cupo_consumo, -1);
  PERFORM public.masas_mover(OLD.proyecto_id, OLD.cupo_noche, OLD.masas_consumo, -1);
 END IF;
 RETURN OLD;
END $$;

-- Igual que antes (cupos por sabor), más las masas de la noche. Se bloquean primero las filas de los
-- cupos y después la de masas, siempre en ese orden. Error: 'MASAS_AGOTADAS|<masas que quedan>'.
CREATE OR REPLACE FUNCTION public.crear_pedido_costeado(p_pedido jsonb,p_costeo jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cols text; vals text; saved public.pedidos; cost numeric; fee numeric; key text;
 v_proyecto text; v_noche date; v_consumo jsonb; v_insert jsonb; r record; cap integer; sold integer; nom text; v_masas integer;
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
 -- Masas de la noche: una por pizza. La fila se crea sin límite si el dueño todavía no cargó nada.
 v_masas:=public.masas_consumo(p_pedido->'productos',v_proyecto);
 IF v_masas>0 THEN
  INSERT INTO public.masas_noche(proyecto_id,noche) VALUES(v_proyecto,v_noche) ON CONFLICT DO NOTHING;
  SELECT m.cupo,m.vendidas INTO cap,sold FROM public.masas_noche m
  WHERE m.proyecto_id=v_proyecto AND m.noche=v_noche FOR UPDATE;
  IF cap IS NOT NULL AND sold+v_masas>cap THEN RAISE EXCEPTION 'MASAS_AGOTADAS|%',GREATEST(0,cap-sold); END IF;
  UPDATE public.masas_noche SET vendidas=vendidas+v_masas,actualizado_en=now()
  WHERE proyecto_id=v_proyecto AND noche=v_noche;
 END IF;
 v_insert:=p_pedido;
 IF jsonb_array_length(v_consumo)>0 THEN
  v_insert:=v_insert||jsonb_build_object('cupo_consumo',v_consumo);
 END IF;
 IF v_masas>0 THEN
  v_insert:=v_insert||jsonb_build_object('masas_consumo',v_masas);
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
