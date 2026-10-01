-- Atomic historical production cost and configured commission estimate.
CREATE TABLE public.pedido_costeos (
 pedido_id uuid PRIMARY KEY,
 version integer NOT NULL DEFAULT 1 CHECK(version=1),
 productos jsonb NOT NULL CHECK(jsonb_typeof(productos)='array'),
 costo_produccion_centavos bigint CHECK(costo_produccion_centavos>=0 AND costo_produccion_centavos<=9007199254740991),
 comision_pct numeric NOT NULL CHECK(comision_pct>=0 AND comision_pct<100),
 registrado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_costeos OWNER TO postgres;
ALTER TABLE public.pedido_costeos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedido_costeos FROM PUBLIC,anon,authenticated,project_admin;
GRANT SELECT ON public.pedido_costeos TO authenticated,project_admin;
CREATE POLICY costeos_recetario ON public.pedido_costeos FOR SELECT TO authenticated USING(public.es_usuario_recetario());
CREATE POLICY costeos_admin ON public.pedido_costeos FOR SELECT TO project_admin USING(true);
CREATE FUNCTION public.costeo_inmutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'El costeo histórico es inmutable'; END $$;
ALTER FUNCTION public.costeo_inmutable() OWNER TO postgres;
CREATE TRIGGER pedido_costeo_inmutable BEFORE UPDATE OR DELETE ON public.pedido_costeos FOR EACH ROW EXECUTE FUNCTION public.costeo_inmutable();

CREATE FUNCTION public.crear_pedido_costeado(p_pedido jsonb,p_costeo jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cols text; vals text; saved public.pedidos; cost numeric; fee numeric; key text;
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
 -- Insert only supplied whitelisted columns. Omitted columns retain live defaults.
 SELECT string_agg(format('%I',k),',' ORDER BY k),string_agg(format('r.%I',k),',' ORDER BY k)
 INTO cols,vals FROM jsonb_object_keys(p_pedido) AS keys(k);
 EXECUTE format('INSERT INTO public.pedidos(%s) SELECT %s FROM jsonb_populate_record(NULL::public.pedidos,$1) r RETURNING *',cols,vals) INTO saved USING p_pedido;
 INSERT INTO public.pedido_costeos(pedido_id,productos,costo_produccion_centavos,comision_pct)
 VALUES(saved.id,saved.productos,cost::bigint,fee);
 RETURN to_jsonb(saved);
END $$;
ALTER FUNCTION public.crear_pedido_costeado(jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.crear_pedido_costeado(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crear_pedido_costeado(jsonb,jsonb) TO project_admin;
