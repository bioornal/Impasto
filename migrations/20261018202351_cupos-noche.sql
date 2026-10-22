-- Servidor propio (desde 14/10/2026): el CLI entra como project_admin, que es dueño de pedidos y
-- de crear_pedido_costeado; por eso acá no hay OWNER TO postgres (no se puede asignar).
-- Cupos por noche (pedido del dueño, 18/10/2026): cuántas pizzas de cada sabor se pueden
-- vender esta noche. Se cuentan en MITADES: una entera usa 2, una mitad y mitad 1 de cada sabor.
-- El control vive en crear_pedido_costeado, que usan la web y el POS: si no alcanza, el pedido
-- no se guarda. Sin fila de cupo, el sabor no tiene límite (igual que antes de esta migración).
-- Cancelar, eliminar o un pago rechazado devuelven las mitades al cupo (trigger en pedidos).

-- Noche de trabajo: de 06:00 a 05:59, hora de Argentina (igual que el POS y el resumen diario).
CREATE FUNCTION public.noche_de_negocio(t timestamptz) RETURNS date
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT ((t AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date
$$;

CREATE TABLE public.cupos_noche (
 proyecto_id text NOT NULL,
 noche date NOT NULL,
 producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
 cupo_mitades integer NOT NULL CHECK (cupo_mitades BETWEEN 0 AND 2000),
 -- Puede pasar el cupo si un pago rechazado vuelve a aprobarse: la venta ya existe.
 vendidas_mitades integer NOT NULL DEFAULT 0 CHECK (vendidas_mitades >= 0),
 actualizado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (proyecto_id, noche, producto_id)
);
ALTER TABLE public.cupos_noche ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cupos_noche FROM PUBLIC, anon, authenticated;
CREATE POLICY cupos_noche_admin ON public.cupos_noche FOR ALL TO project_admin USING (true) WITH CHECK (true);

ALTER TABLE public.pedidos
 ADD COLUMN IF NOT EXISTS cupo_consumo jsonb,
 ADD COLUMN IF NOT EXISTS cupo_noche date,
 ADD COLUMN IF NOT EXISTS cupo_liberado boolean NOT NULL DEFAULT false;

-- Mitades que un pedido consume de los sabores CON cupo esa noche, una fila por producto.
-- Web: `type` pizza (id en `key`) o pizza-half (ids en variant.ids).
-- POS: sin `type`, por `nombre` o variant.nombres. Se cruza contra las filas de cupo de la noche,
-- así un nombre repetido en productos (copias archivadas) no se cuenta dos veces.
CREATE FUNCTION public.cupos_consumo(p_productos jsonb, p_proyecto text, p_noche date) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 WITH items AS (
  SELECT e, GREATEST(1, COALESCE(
    CASE WHEN e->>'qty' ~ '^[0-9]+$' THEN (e->>'qty')::int END,
    CASE WHEN e->>'cantidad' ~ '^[0-9]+$' THEN (e->>'cantidad')::int END, 1)) AS qty
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_productos)='array' THEN p_productos ELSE '[]'::jsonb END) e
  WHERE jsonb_typeof(e)='object'
 ), cupo AS (
  SELECT c.producto_id, p.nombre FROM public.cupos_noche c JOIN public.productos p ON p.id=c.producto_id
  WHERE c.proyecto_id=p_proyecto AND c.noche=p_noche
 ), partes AS (
  SELECT c.producto_id, 2*i.qty AS mitades FROM items i JOIN cupo c ON c.producto_id::text=i.e->>'key'
   WHERE i.e->>'type'='pizza'
  UNION ALL
  SELECT c.producto_id, i.qty FROM items i
   CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(i.e->'variant'->'ids')='array' THEN i.e->'variant'->'ids' ELSE '[]'::jsonb END) h(pid)
   JOIN cupo c ON c.producto_id::text=h.pid
   WHERE i.e->>'type'='pizza-half'
  UNION ALL
  SELECT c.producto_id, i.qty FROM items i
   CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(i.e->'variant'->'nombres')='array' THEN i.e->'variant'->'nombres' ELSE '[]'::jsonb END) h(nom)
   JOIN cupo c ON c.nombre=h.nom
   WHERE COALESCE(i.e->>'type','')='' AND i.e->'variant'->>'kind'='half'
  UNION ALL
  SELECT c.producto_id, 2*i.qty FROM items i JOIN cupo c ON c.nombre=i.e->>'nombre'
   WHERE COALESCE(i.e->>'type','')='' AND i.e->'variant' IS NULL
 )
 SELECT COALESCE(jsonb_agg(jsonb_build_object('producto_id',producto_id,'mitades',m) ORDER BY producto_id),'[]'::jsonb)
 FROM (SELECT producto_id, sum(mitades)::int AS m FROM partes GROUP BY producto_id) s
$$;

-- Suma (signo 1) o devuelve (signo -1) las mitades de un pedido, sin controlar el cupo.
CREATE FUNCTION public.cupos_mover(p_proyecto text, p_noche date, p_consumo jsonb, p_signo integer) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.cupos_noche c
 SET vendidas_mitades=GREATEST(0, c.vendidas_mitades + p_signo*(x->>'mitades')::int), actualizado_en=now()
 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_consumo)='array' THEN p_consumo ELSE '[]'::jsonb END) x
 WHERE c.proyecto_id=p_proyecto AND c.noche=p_noche AND c.producto_id=(x->>'producto_id')::uuid
$$;
REVOKE ALL ON FUNCTION public.cupos_mover(text,date,jsonb,integer) FROM PUBLIC, anon, authenticated;

-- Cancelado o pago rechazado: devuelve el cupo una sola vez; si vuelve a valer (p. ej. un pago
-- rechazado que después se aprueba), lo vuelve a sumar.
CREATE FUNCTION public.pedidos_cupo_al_actualizar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE muerto boolean;
BEGIN
 IF NEW.cupo_consumo IS NULL OR NEW.cupo_noche IS NULL THEN RETURN NEW; END IF;
 muerto := NEW.status='cancelado' OR NEW.estado_pago='rechazado';
 IF muerto AND NOT NEW.cupo_liberado THEN
  PERFORM public.cupos_mover(NEW.proyecto_id, NEW.cupo_noche, NEW.cupo_consumo, -1);
  NEW.cupo_liberado := true;
 ELSIF NOT muerto AND NEW.cupo_liberado THEN
  PERFORM public.cupos_mover(NEW.proyecto_id, NEW.cupo_noche, NEW.cupo_consumo, 1);
  NEW.cupo_liberado := false;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pedidos_cupo_al_actualizar BEFORE UPDATE ON public.pedidos
 FOR EACH ROW EXECUTE FUNCTION public.pedidos_cupo_al_actualizar();

CREATE FUNCTION public.pedidos_cupo_al_eliminar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.cupo_consumo IS NOT NULL AND OLD.cupo_noche IS NOT NULL AND NOT OLD.cupo_liberado THEN
  PERFORM public.cupos_mover(OLD.proyecto_id, OLD.cupo_noche, OLD.cupo_consumo, -1);
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER pedidos_cupo_al_eliminar BEFORE DELETE ON public.pedidos
 FOR EACH ROW EXECUTE FUNCTION public.pedidos_cupo_al_eliminar();

-- Igual que antes, más el control del cupo antes del INSERT (misma transacción).
-- Error: 'CUPO_AGOTADO|<nombre>|<mitades que quedan>'; las apps lo traducen para el cliente.
CREATE OR REPLACE FUNCTION public.crear_pedido_costeado(p_pedido jsonb,p_costeo jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cols text; vals text; saved public.pedidos; cost numeric; fee numeric; key text;
 v_proyecto text; v_noche date; v_consumo jsonb; v_insert jsonb; r record; cap integer; sold integer; nom text;
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
 v_insert:=p_pedido;
 IF jsonb_array_length(v_consumo)>0 THEN
  v_insert:=v_insert||jsonb_build_object('cupo_consumo',v_consumo,'cupo_noche',v_noche);
 END IF;
 -- Insert only supplied whitelisted columns. Omitted columns retain live defaults.
 SELECT string_agg(format('%I',k),',' ORDER BY k),string_agg(format('r.%I',k),',' ORDER BY k)
 INTO cols,vals FROM jsonb_object_keys(v_insert) AS keys(k);
 EXECUTE format('INSERT INTO public.pedidos(%s) SELECT %s FROM jsonb_populate_record(NULL::public.pedidos,$1) r RETURNING *',cols,vals) INTO saved USING v_insert;
 INSERT INTO public.pedido_costeos(pedido_id,productos,costo_produccion_centavos,comision_pct)
 VALUES(saved.id,saved.productos,cost::bigint,fee);
 RETURN to_jsonb(saved);
END $$;
