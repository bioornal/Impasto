-- Inventario de bebidas entre noches. Sin fila o unidades NULL: sin control.
CREATE TABLE public.stock_bebidas (
 producto_id uuid PRIMARY KEY REFERENCES public.productos(id) ON DELETE CASCADE,
 proyecto_id text NOT NULL DEFAULT 'impasto' CHECK (proyecto_id='impasto'),
 unidades integer CHECK (unidades>=0),
 actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stock_movimientos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 producto_id uuid NOT NULL,
 delta integer NOT NULL,
 motivo text NOT NULL CHECK (motivo IN ('carga','ajuste','venta','devolucion')),
 -- Se conserva la referencia histórica aunque se elimine el pedido o producto.
 pedido_id uuid,
 actor text,
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movimientos_producto_fecha ON public.stock_movimientos(producto_id,creado_en);
CREATE INDEX stock_movimientos_pedido ON public.stock_movimientos(pedido_id) WHERE pedido_id IS NOT NULL;
ALTER TABLE public.stock_bebidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movimientos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stock_bebidas, public.stock_movimientos FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.stock_bebidas,public.stock_movimientos TO project_admin;

ALTER TABLE public.pedidos
 ADD COLUMN stock_consumo jsonb,
 ADD COLUMN stock_liberado boolean NOT NULL DEFAULT false;

-- Web por id (key); POS sin type por nombre. Una coincidencia por línea,
-- priorizando el producto no archivado ante copias históricas con igual nombre.
CREATE FUNCTION public.stock_consumo(p_productos jsonb) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 WITH items AS (
  SELECT e, GREATEST(1,COALESCE(
   CASE WHEN e->>'qty' ~ '^[0-9]+$' THEN (e->>'qty')::integer END,
   CASE WHEN e->>'cantidad' ~ '^[0-9]+$' THEN (e->>'cantidad')::integer END,1)) qty
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_productos)='array' THEN p_productos ELSE '[]'::jsonb END) e
  WHERE jsonb_typeof(e)='object'
 ), partes AS (
  SELECT p.id, i.qty FROM items i CROSS JOIN LATERAL (
   SELECT p.id FROM public.productos p
   WHERE p.proyecto_id='impasto' AND (p.tipo='bebida' OR p.categoria ILIKE '%bebida%')
    AND ((i.e->>'type'='bebida' AND p.id::text=COALESCE(i.e->>'key',i.e->>'id'))
     OR (COALESCE(i.e->>'type','')='' AND p.nombre=i.e->>'nombre' AND i.e->'variant' IS NULL))
   ORDER BY COALESCE(p.archivado,false),p.id LIMIT 1
  ) p
 )
 SELECT COALESCE(jsonb_agg(jsonb_build_object('producto_id',id,'unidades',unidades) ORDER BY id),'[]'::jsonb)
 FROM (SELECT id,sum(qty)::integer unidades FROM partes GROUP BY id) s
$$;

CREATE FUNCTION public.stock_actor() RETURNS text
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub',true),''),NULLIF(current_setting('role',true),'none'),session_user::text)
$$;

-- Todos los cambios manuales bloquean la misma fila que las ventas. Una carga
-- suma al número vigente, sin pisar ventas que hayan llegado mientras se editaba.
CREATE FUNCTION public.cargar_stock_bebida(p_producto uuid,p_delta integer,p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE fila public.stock_bebidas; anterior integer;
BEGIN
 IF p_delta IS NULL OR p_motivo IS NULL OR p_motivo NOT IN ('carga','ajuste') OR (p_motivo='carga' AND p_delta<=0) THEN
  RAISE EXCEPTION 'Carga de stock inválida';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.productos WHERE id=p_producto AND proyecto_id='impasto' AND (tipo='bebida' OR categoria ILIKE '%bebida%')) THEN
  RAISE EXCEPTION 'Bebida inválida';
 END IF;
 INSERT INTO public.stock_bebidas(producto_id) VALUES(p_producto) ON CONFLICT DO NOTHING;
 SELECT * INTO fila FROM public.stock_bebidas WHERE producto_id=p_producto FOR UPDATE;
 anterior:=COALESCE(fila.unidades,0);
 IF anterior::bigint+p_delta<0 OR anterior::bigint+p_delta>2147483647 THEN RAISE EXCEPTION 'Stock inválido'; END IF;
 UPDATE public.stock_bebidas SET unidades=anterior+p_delta,actualizado_en=now() WHERE producto_id=p_producto RETURNING * INTO fila;
 INSERT INTO public.stock_movimientos(producto_id,delta,motivo,actor) VALUES(p_producto,p_delta,p_motivo,public.stock_actor());
 RETURN to_jsonb(fila);
END $$;

CREATE FUNCTION public.fijar_stock_bebida(p_producto uuid,p_unidades integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE fila public.stock_bebidas; anterior integer;
BEGIN
 IF p_unidades<0 THEN RAISE EXCEPTION 'Stock inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.productos WHERE id=p_producto AND proyecto_id='impasto' AND (tipo='bebida' OR categoria ILIKE '%bebida%')) THEN
  RAISE EXCEPTION 'Bebida inválida';
 END IF;
 INSERT INTO public.stock_bebidas(producto_id) VALUES(p_producto) ON CONFLICT DO NOTHING;
 SELECT unidades INTO anterior FROM public.stock_bebidas WHERE producto_id=p_producto FOR UPDATE;
 UPDATE public.stock_bebidas SET unidades=p_unidades,actualizado_en=now() WHERE producto_id=p_producto RETURNING * INTO fila;
 -- Al quitar control, delta 0: no es una salida física de mercadería.
 INSERT INTO public.stock_movimientos(producto_id,delta,motivo,actor)
 VALUES(p_producto,CASE WHEN p_unidades IS NULL THEN 0 ELSE p_unidades-COALESCE(anterior,0) END,'ajuste',public.stock_actor());
 RETURN to_jsonb(fila);
END $$;

-- signo 1 consume; -1 devuelve. Se usa sólo con el consumo que realmente fue
-- controlado al vender, para que activar stock después no invente devoluciones.
CREATE FUNCTION public.stock_mover(p_consumo jsonb,p_signo integer,p_pedido uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; quedan integer; nom text;
BEGIN
 FOR r IN SELECT (x->>'producto_id')::uuid pid,(x->>'unidades')::integer cantidad
  FROM jsonb_array_elements(COALESCE(p_consumo,'[]'::jsonb)) x ORDER BY 1 LOOP
  SELECT s.unidades,p.nombre INTO quedan,nom FROM public.stock_bebidas s JOIN public.productos p ON p.id=s.producto_id
  WHERE s.producto_id=r.pid AND s.proyecto_id='impasto' FOR UPDATE OF s;
  IF FOUND AND quedan IS NOT NULL THEN
   IF p_signo=1 AND quedan<r.cantidad THEN RAISE EXCEPTION 'STOCK_AGOTADO|%|%',nom,quedan; END IF;
   UPDATE public.stock_bebidas SET unidades=unidades-p_signo*r.cantidad,actualizado_en=now() WHERE producto_id=r.pid;
   INSERT INTO public.stock_movimientos(producto_id,delta,motivo,pedido_id,actor)
   VALUES(r.pid,-p_signo*r.cantidad,CASE WHEN p_signo=1 THEN 'venta' ELSE 'devolucion' END,p_pedido,public.stock_actor());
  END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.pedidos_cupo_al_actualizar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE muerto boolean;
BEGIN
 muerto := COALESCE(NEW.status='cancelado',false) OR COALESCE(NEW.estado_pago='rechazado',false);
 -- Mismo orden global que crear_pedido_costeado: cupos, masas, stock por id.
 IF (NEW.cupo_consumo IS NOT NULL OR NEW.masas_consumo IS NOT NULL) AND NEW.cupo_noche IS NOT NULL THEN
  PERFORM 1 FROM public.cupos_noche c WHERE c.proyecto_id=NEW.proyecto_id AND c.noche=NEW.cupo_noche
   AND c.producto_id IN (SELECT (x->>'producto_id')::uuid FROM jsonb_array_elements(COALESCE(NEW.cupo_consumo,'[]'::jsonb)) x)
   ORDER BY c.producto_id FOR UPDATE;
  PERFORM 1 FROM public.masas_noche m WHERE m.proyecto_id=NEW.proyecto_id AND m.noche=NEW.cupo_noche ORDER BY m.masa FOR UPDATE;
  IF muerto AND NOT NEW.cupo_liberado THEN
   PERFORM public.cupos_mover(NEW.proyecto_id,NEW.cupo_noche,NEW.cupo_consumo,-1);
   PERFORM public.masas_mover(NEW.proyecto_id,NEW.cupo_noche,NEW.masas_consumo,NEW.masas_molde,-1);
   NEW.cupo_liberado:=true;
  ELSIF NOT muerto AND NEW.cupo_liberado THEN
   PERFORM public.cupos_mover(NEW.proyecto_id,NEW.cupo_noche,NEW.cupo_consumo,1);
   PERFORM public.masas_mover(NEW.proyecto_id,NEW.cupo_noche,NEW.masas_consumo,NEW.masas_molde,1);
   NEW.cupo_liberado:=false;
  END IF;
 END IF;
 IF NEW.proyecto_id='impasto' AND NEW.stock_consumo IS NOT NULL THEN
  IF muerto AND NOT NEW.stock_liberado THEN
   PERFORM public.stock_mover(NEW.stock_consumo,-1,NEW.id); NEW.stock_liberado:=true;
  ELSIF NOT muerto AND NEW.stock_liberado THEN
   PERFORM public.stock_mover(NEW.stock_consumo,1,NEW.id); NEW.stock_liberado:=false;
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.pedidos_cupo_al_eliminar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (OLD.cupo_consumo IS NOT NULL OR OLD.masas_consumo IS NOT NULL) AND OLD.cupo_noche IS NOT NULL AND NOT OLD.cupo_liberado THEN
  PERFORM 1 FROM public.cupos_noche c WHERE c.proyecto_id=OLD.proyecto_id AND c.noche=OLD.cupo_noche
   AND c.producto_id IN (SELECT (x->>'producto_id')::uuid FROM jsonb_array_elements(COALESCE(OLD.cupo_consumo,'[]'::jsonb)) x)
   ORDER BY c.producto_id FOR UPDATE;
  PERFORM 1 FROM public.masas_noche m WHERE m.proyecto_id=OLD.proyecto_id AND m.noche=OLD.cupo_noche ORDER BY m.masa FOR UPDATE;
  PERFORM public.cupos_mover(OLD.proyecto_id,OLD.cupo_noche,OLD.cupo_consumo,-1);
  PERFORM public.masas_mover(OLD.proyecto_id,OLD.cupo_noche,OLD.masas_consumo,OLD.masas_molde,-1);
 END IF;
 IF OLD.proyecto_id='impasto' AND OLD.stock_consumo IS NOT NULL AND NOT OLD.stock_liberado THEN
  PERFORM public.stock_mover(OLD.stock_consumo,-1,OLD.id);
 END IF;
 RETURN OLD;
END $$;

-- RPC vigente de masas-por-tipo; sólo se añade stock.
CREATE OR REPLACE FUNCTION public.crear_pedido_costeado(p_pedido jsonb,p_costeo jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cols text; vals text; saved public.pedidos; cost numeric; fee numeric; key text;
 v_proyecto text; v_noche date; v_consumo jsonb; v_insert jsonb; r record; cap integer; sold integer; nom text; v_masas integer;
 v_molde integer; cap_napo integer; sold_napo integer; v_stock jsonb; v_controlado jsonb;
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
END $$;
REVOKE ALL ON FUNCTION public.stock_consumo(jsonb),public.stock_actor(),public.stock_mover(jsonb,integer,uuid),public.cargar_stock_bebida(uuid,integer,text),public.fijar_stock_bebida(uuid,integer),public.crear_pedido_costeado(jsonb,jsonb),public.pedidos_cupo_al_actualizar(),public.pedidos_cupo_al_eliminar() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stock_consumo(jsonb),public.cargar_stock_bebida(uuid,integer,text),public.fijar_stock_bebida(uuid,integer),public.crear_pedido_costeado(jsonb,jsonb) TO project_admin;
