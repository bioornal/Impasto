-- Explicit operation UUIDs distinguish a new refund from retries of an uncertain POST.
-- Legacy orders/legacy reserved requests remain blocked pending manual review.
CREATE TABLE public.pedido_devolucion_operaciones (
  operacion_id uuid PRIMARY KEY, pedido_id uuid NOT NULL REFERENCES public.pedidos(id),
  mp_order_id text NOT NULL, solicitud_original jsonb NOT NULL, solicitud jsonb NOT NULL,
  clave text NOT NULL UNIQUE, cobro_centavos bigint NOT NULL CHECK(cobro_centavos>0),
  saldo_centavos bigint NOT NULL CHECK(saldo_centavos>0), anteriores jsonb NOT NULL,
  confirmado_clave text, creado_en timestamptz NOT NULL DEFAULT now(), confirmado_en timestamptz,
  CHECK((confirmado_clave IS NULL)=(confirmado_en IS NULL))
);
CREATE UNIQUE INDEX pedido_devolucion_operacion_activa ON public.pedido_devolucion_operaciones(pedido_id) WHERE confirmado_en IS NULL;
ALTER TABLE public.pedido_devolucion_operaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedido_devolucion_operaciones FROM PUBLIC,anon,authenticated,project_admin;

CREATE FUNCTION public.devolucion_operacion_json(o public.pedido_devolucion_operaciones)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('operationId',o.operacion_id,'key',o.clave,'request',o.solicitud,'gross',o.cobro_centavos,'baseline',o.anteriores,'confirmedRefund',o.confirmado_clave)
$$;
REVOKE ALL ON FUNCTION public.devolucion_operacion_json(public.pedido_devolucion_operaciones) FROM PUBLIC,anon,authenticated,project_admin;

CREATE FUNCTION public.reservar_devolucion_operacion(p_pedido_id uuid,p_mp_order_id text,p_operacion_id uuid,p_solicitud jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.pedidos%ROWTYPE; o public.pedido_devolucion_operaciones%ROWTYPE;
 old public.pedido_devolucion_intentos%ROWTYPE; gross bigint; returned bigint; remaining bigint; amount bigint; baseline jsonb; request jsonb;
BEGIN
 SELECT * INTO p FROM public.pedidos WHERE id=p_pedido_id FOR UPDATE;
 IF NOT FOUND OR p.proyecto_id IS DISTINCT FROM 'impasto' OR p.proveedor_pago IS DISTINCT FROM 'mercadopago'
  OR p.metodo_pago IS DISTINCT FROM 'mercadopago' OR p.mp_order_id IS DISTINCT FROM p_mp_order_id
  OR coalesce(p_mp_order_id,'')='' OR p_operacion_id IS NULL OR coalesce(p.id_pago,'')=''
  OR p.total IS NULL OR p.total<=0 OR p.total*100<>round(p.total*100) OR p.total*100>9007199254740991
  OR coalesce(p.external_reference,'') NOT LIKE 'IM-%' THEN RAISE EXCEPTION 'Orden incompatible para devolución'; END IF;
 SELECT * INTO o FROM public.pedido_devolucion_operaciones WHERE operacion_id=p_operacion_id;
 IF FOUND THEN
  IF o.pedido_id IS DISTINCT FROM p.id OR o.mp_order_id IS DISTINCT FROM p_mp_order_id OR o.solicitud_original IS DISTINCT FROM p_solicitud THEN RAISE EXCEPTION 'Operación reutilizada con otro cuerpo'; END IF;
  RETURN public.devolucion_operacion_json(o);
 END IF;
 SELECT * INTO old FROM public.pedido_devolucion_intentos WHERE pedido_id=p.id FOR UPDATE;
 IF NOT FOUND OR old.solicitud IS NOT NULL THEN RAISE EXCEPTION 'Pedido legacy o devolución anterior incierta: requiere revisión manual'; END IF;
 IF EXISTS(SELECT 1 FROM public.pedido_devolucion_operaciones WHERE pedido_id=p.id AND confirmado_en IS NULL) THEN RAISE EXCEPTION 'Otra operación activa: conciliá el intento original'; END IF;
 IF p.estado_pago IS NULL OR p.estado_pago NOT IN ('aprobado','parcialmente_reembolsado') THEN RAISE EXCEPTION 'Pago sin saldo aprobado'; END IF;
 IF EXISTS(SELECT 1 FROM public.pedido_movimientos WHERE pedido_id=p.id AND
  (metodo_pago IS DISTINCT FROM 'mercadopago' OR (tipo='cobro' AND clave IS DISTINCT FROM 'mp-cobro:'||p_mp_order_id) OR (tipo='devolucion' AND clave NOT LIKE 'mp-devolucion:%')))
  THEN RAISE EXCEPTION 'Movimientos sin evidencia Mercado Pago'; END IF;
 SELECT coalesce(sum(monto_centavos) FILTER(WHERE tipo='cobro'),0),coalesce(sum(monto_centavos) FILTER(WHERE tipo='devolucion'),0)
 INTO gross,returned FROM public.pedido_movimientos WHERE pedido_id=p.id;
 IF gross<>p.total*100 OR gross<=0 OR gross>9007199254740991 THEN RAISE EXCEPTION 'Falta conciliar el cobro completo'; END IF;
 remaining:=gross-returned;
 IF remaining<=0 THEN RAISE EXCEPTION 'Sin saldo disponible'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('clave',clave,'monto_centavos',monto_centavos) ORDER BY clave),'[]'::jsonb)
 INTO baseline FROM public.pedido_movimientos WHERE pedido_id=p.id AND tipo='devolucion';
 IF p_solicitud='{"total":true}'::jsonb THEN amount:=remaining;
 ELSE
  IF p_solicitud IS NULL OR jsonb_typeof(p_solicitud)<>'object'
   OR (SELECT count(*) FROM jsonb_object_keys(p_solicitud))<>2
   OR p_solicitud->>'transaction_id' IS DISTINCT FROM p.id_pago
   OR jsonb_typeof(p_solicitud->'amount_centavos')<>'number'
   OR coalesce(p_solicitud->>'amount_centavos','') !~ '^[1-9][0-9]{0,15}$'
   THEN RAISE EXCEPTION 'Solicitud inválida'; END IF;
  amount:=(p_solicitud->>'amount_centavos')::bigint;
 END IF;
 IF amount<=0 OR amount>remaining THEN RAISE EXCEPTION 'Monto superior al saldo disponible'; END IF;
 request:=jsonb_build_object('transaction_id',p.id_pago,'amount_centavos',amount);
 INSERT INTO public.pedido_devolucion_operaciones(operacion_id,pedido_id,mp_order_id,solicitud_original,solicitud,clave,cobro_centavos,saldo_centavos,anteriores)
 VALUES(p_operacion_id,p.id,p_mp_order_id,p_solicitud,request,'refund-operation-'||p_operacion_id,gross,remaining,baseline) RETURNING * INTO o;
 RETURN public.devolucion_operacion_json(o);
END $$;

CREATE FUNCTION public.confirmar_devolucion_operacion(p_pedido_id uuid,p_mp_order_id text,p_operacion_id uuid,p_movimientos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.pedidos%ROWTYPE; o public.pedido_devolucion_operaciones%ROWTYPE; prior jsonb; fresh jsonb; n integer; matchkey text;
BEGIN
 SELECT * INTO p FROM public.pedidos WHERE id=p_pedido_id FOR UPDATE;
 IF NOT FOUND OR p.proyecto_id IS DISTINCT FROM 'impasto' OR p.mp_order_id IS DISTINCT FROM p_mp_order_id THEN RAISE EXCEPTION 'Orden incompatible'; END IF;
 SELECT * INTO o FROM public.pedido_devolucion_operaciones WHERE operacion_id=p_operacion_id AND pedido_id=p.id FOR UPDATE;
 IF NOT FOUND OR o.mp_order_id IS DISTINCT FROM p_mp_order_id OR jsonb_typeof(p_movimientos)<>'array' THEN RAISE EXCEPTION 'Operación inexistente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_movimientos) m WHERE m->>'clave'='mp-cobro:'||o.mp_order_id AND m->>'tipo'='cobro' AND (m->>'monto_centavos')::numeric=o.cobro_centavos) THEN RAISE EXCEPTION 'Cobro incompatible'; END IF;
 FOR prior IN SELECT * FROM jsonb_array_elements(o.anteriores) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_movimientos) m WHERE m->>'tipo'='devolucion' AND m->>'clave'=prior->>'clave' AND m->'monto_centavos'=prior->'monto_centavos') THEN RAISE EXCEPTION 'Falta devolución anterior'; END IF;
 END LOOP;
 IF o.confirmado_en IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_movimientos) m WHERE m->>'tipo'='devolucion' AND m->>'clave'=o.confirmado_clave AND m->'monto_centavos'=o.solicitud->'amount_centavos') THEN RAISE EXCEPTION 'Falta devolución confirmada'; END IF;
 ELSE
  SELECT count(*),min(m->>'clave') INTO n,matchkey FROM jsonb_array_elements(p_movimientos) m
   WHERE m->>'tipo'='devolucion' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(o.anteriores) a WHERE a->>'clave'=m->>'clave');
  IF n<>1 THEN RAISE EXCEPTION 'Delta inesperado: requiere conciliación manual'; END IF;
  SELECT m INTO fresh FROM jsonb_array_elements(p_movimientos) m WHERE m->>'clave'=matchkey;
  IF fresh->'monto_centavos' IS DISTINCT FROM o.solicitud->'amount_centavos' THEN RAISE EXCEPTION 'Monto no coincide con operación'; END IF;
 END IF;
 -- Ledger and confirmed intention commit together; failure preserves the active intention.
 PERFORM public.registrar_movimientos_pago(p.id,p_mp_order_id,p_movimientos);
 IF o.confirmado_en IS NULL THEN
  UPDATE public.pedido_devolucion_operaciones SET confirmado_clave=matchkey,confirmado_en=now() WHERE operacion_id=o.operacion_id RETURNING * INTO o;
 END IF;
 RETURN public.devolucion_operacion_json(o);
END $$;
REVOKE ALL ON FUNCTION public.reservar_devolucion_operacion(uuid,text,uuid,jsonb),public.confirmar_devolucion_operacion(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_devolucion_operacion(uuid,text,uuid,jsonb),public.confirmar_devolucion_operacion(uuid,text,uuid,jsonb) TO project_admin;
ALTER FUNCTION public.devolucion_operacion_json(public.pedido_devolucion_operaciones) OWNER TO postgres;
ALTER FUNCTION public.reservar_devolucion_operacion(uuid,text,uuid,jsonb) OWNER TO postgres;
ALTER FUNCTION public.confirmar_devolucion_operacion(uuid,text,uuid,jsonb) OWNER TO postgres;
