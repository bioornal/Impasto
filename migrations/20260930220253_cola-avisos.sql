-- No historical backfill. Only new eligible events enqueue atomically.
ALTER TABLE public.notificaciones
  ADD COLUMN payload jsonb,
  ADD COLUMN mensaje jsonb,
  ADD COLUMN claim_id uuid,
  ADD COLUMN claimed_at timestamptz,
  ADD COLUMN intentos integer NOT NULL DEFAULT 0,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE FUNCTION public.encolar_avisos_pedido() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE tipo_aviso text; snapshot jsonb := to_jsonb(NEW);
BEGIN
  IF NEW.proyecto_id IS DISTINCT FROM 'impasto'
    OR coalesce(NEW.external_reference,'') NOT LIKE 'IM-%'
    OR coalesce(NEW.status,'') IN ('cancelado','cancelada','cancelled','canceled')
    OR coalesce(NEW.estado_pago,'') IN ('rechazado','reembolsado') THEN RETURN NEW; END IF;
  IF NEW.proveedor_pago = 'manual' AND TG_OP = 'INSERT' THEN
    tipo_aviso := 'pedido_recibido';
  ELSIF NEW.proveedor_pago = 'mercadopago' AND NEW.estado_pago = 'aprobado' THEN
    IF TG_OP = 'INSERT' THEN tipo_aviso := 'pago_aprobado';
    ELSIF OLD.estado_pago IS DISTINCT FROM 'aprobado' THEN tipo_aviso := 'pago_aprobado'; END IF;
  END IF;
  IF tipo_aviso IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notificaciones(pedido_id,canal,tipo,destino,payload)
    VALUES (NEW.id,'email',tipo_aviso,coalesce(snapshot->>'email_cliente',''),snapshot),
           (NEW.id,'telegram',tipo_aviso,'',snapshot)
    ON CONFLICT (pedido_id,tipo,canal) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER pedidos_encolar_avisos AFTER INSERT OR UPDATE OF estado_pago ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.encolar_avisos_pedido();

CREATE FUNCTION public.reclamar_notificacion(p_id uuid,p_mensaje jsonb,
  p_reintentar boolean DEFAULT false,p_confirmar_duplicado boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE n public.notificaciones%ROWTYPE; pedido jsonb; legacy boolean;
BEGIN
  SELECT * INTO n FROM public.notificaciones WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR n.estado='enviado' THEN RETURN NULL; END IF;
  -- Snapshot eligibility without a parent lock: the payment trigger already
  -- locks parent then queue, so queue then parent would invert lock order.
  -- A SQL lock cannot protect eligibility throughout the later HTTP request.
  SELECT to_jsonb(p) INTO pedido FROM public.pedidos p WHERE p.id=n.pedido_id;
  IF pedido IS NULL OR pedido->>'proyecto_id' IS DISTINCT FROM 'impasto'
    OR coalesce(pedido->>'external_reference','') NOT LIKE 'IM-%'
    OR coalesce(pedido->>'status','') IN ('cancelado','cancelada','cancelled','canceled')
    OR coalesce(pedido->>'estado_pago','') IN ('rechazado','reembolsado')
    OR NOT ((n.tipo='pedido_recibido' AND pedido->>'proveedor_pago'='manual')
      OR (n.tipo='pago_aprobado' AND pedido->>'proveedor_pago'='mercadopago' AND pedido->>'estado_pago'='aprobado'))
    OR n.canal NOT IN ('email','telegram') THEN RETURN NULL; END IF;
  IF n.estado='procesando' THEN
    IF n.claimed_at > now()-interval '5 minutes' THEN RETURN NULL; END IF;
    UPDATE public.notificaciones SET estado='incierto',updated_at=now(),
      detalle=detalle || jsonb_build_object('motivo','Procesamiento vencido; entrega no confirmada') WHERE id=p_id;
    n.estado := 'incierto';
  END IF;
  legacy := n.payload IS NULL;
  IF legacy THEN
    UPDATE public.notificaciones SET estado='incierto',updated_at=now(),
      detalle=detalle || jsonb_build_object('motivo','Aviso histórico sin snapshot; entrega no confirmada') WHERE id=p_id;
    n.estado := 'incierto';
  END IF;
  IF n.estado='incierto' AND NOT (coalesce(p_reintentar,false) AND coalesce(p_confirmar_duplicado,false)) THEN RETURN NULL; END IF;
  IF n.estado IN ('fallido','omitido') AND NOT coalesce(p_reintentar,false) THEN RETURN NULL; END IF;
  IF n.estado NOT IN ('pendiente','fallido','omitido','incierto') THEN RETURN NULL; END IF;
  IF p_mensaje IS NULL OR jsonb_typeof(p_mensaje)<>'object' THEN RAISE EXCEPTION 'Mensaje inválido'; END IF;
  UPDATE public.notificaciones SET estado='procesando',claim_id=gen_random_uuid(),claimed_at=now(),
    intentos=intentos+1,updated_at=now(),payload=coalesce(payload,pedido),
    mensaje=CASE WHEN n.estado='omitido' THEN p_mensaje ELSE coalesce(mensaje,p_mensaje) END
    WHERE id=p_id RETURNING * INTO n;
  RETURN to_jsonb(n);
END $$;

CREATE FUNCTION public.finalizar_notificacion(p_id uuid,p_claim_id uuid,p_estado text,p_detalle jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE n public.notificaciones%ROWTYPE;
BEGIN
  IF p_estado NOT IN ('enviado','fallido','omitido','incierto') OR p_estado IS NULL
    OR p_detalle IS NULL OR jsonb_typeof(p_detalle)<>'object' THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
  UPDATE public.notificaciones SET estado=p_estado,detalle=p_detalle,updated_at=now()
    WHERE id=p_id AND estado='procesando' AND claim_id=p_claim_id
    RETURNING * INTO n;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(n);
END $$;

REVOKE ALL ON FUNCTION public.encolar_avisos_pedido() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reclamar_notificacion(uuid,jsonb,boolean,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalizar_notificacion(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.encolar_avisos_pedido() TO project_admin;
GRANT EXECUTE ON FUNCTION public.reclamar_notificacion(uuid,jsonb,boolean,boolean) TO project_admin;
GRANT EXECUTE ON FUNCTION public.finalizar_notificacion(uuid,uuid,text,jsonb) TO project_admin;
CREATE INDEX notificaciones_recuperables_idx ON public.notificaciones(estado,created_at)
  WHERE estado<>'enviado';
