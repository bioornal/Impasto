-- No automatic historical backfill; no new columns on pedidos.
CREATE TABLE public.pedido_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pedido_id uuid NOT NULL,
  proyecto_id text NOT NULL, sucursal_id text NOT NULL, clave text NOT NULL,
  tipo text NOT NULL CHECK(tipo IN ('cobro','devolucion')),
  monto_centavos bigint NOT NULL CHECK(monto_centavos > 0 AND monto_centavos <= 9007199254740991),
  metodo_pago text NOT NULL CHECK(metodo_pago IN ('efectivo','transferencia','mercadopago')),
  ocurrido_en timestamptz, fecha_fuente text NOT NULL CHECK(fecha_fuente IN ('registro','proveedor','desconocida')),
  registrado_en timestamptz NOT NULL DEFAULT now(),
  CHECK((ocurrido_en IS NULL) = (fecha_fuente = 'desconocida')),
  CHECK(ocurrido_en IS NULL OR isfinite(ocurrido_en)),
  CHECK(isfinite(registrado_en)),
  UNIQUE(pedido_id,clave)
);
CREATE INDEX pedido_movimientos_fecha_idx ON public.pedido_movimientos(ocurrido_en,pedido_id);
ALTER TABLE public.pedido_movimientos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedido_movimientos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.pedido_movimientos TO authenticated;
REVOKE ALL ON public.pedido_movimientos FROM project_admin;
GRANT SELECT ON public.pedido_movimientos TO project_admin;
CREATE POLICY movimientos_admin ON public.pedido_movimientos FOR ALL TO project_admin USING(true) WITH CHECK(true);
CREATE POLICY movimientos_recetario ON public.pedido_movimientos FOR SELECT TO authenticated USING(public.es_usuario_recetario());

CREATE FUNCTION public.movimientos_inmutables() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Historial de movimientos inmutable'; END $$;
CREATE TRIGGER movimientos_inmutables BEFORE UPDATE OR DELETE ON public.pedido_movimientos FOR EACH ROW EXECUTE FUNCTION public.movimientos_inmutables();

CREATE FUNCTION public.registrar_movimientos_pago(p_pedido_id uuid,p_mp_order_id text,p_movimientos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.pedidos%ROWTYPE; v jsonb; old public.pedido_movimientos%ROWTYPE;
  amount bigint; when_at timestamptz; gross bigint; returned bigint; result jsonb;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id=p_pedido_id FOR UPDATE;
  IF NOT FOUND OR p.proyecto_id IS DISTINCT FROM 'impasto' OR p.proveedor_pago IS DISTINCT FROM 'mercadopago'
    OR p.metodo_pago IS DISTINCT FROM 'mercadopago' OR p.mp_order_id IS DISTINCT FROM p_mp_order_id OR coalesce(p_mp_order_id,'')=''
    OR p.total IS NULL OR p.total<=0 OR p.total*100 <> round(p.total*100) OR p.total*100>9007199254740991
    OR coalesce(p.external_reference,'') NOT LIKE 'IM-%' THEN RAISE EXCEPTION 'Orden de pago incompatible'; END IF;
  IF p_movimientos IS NULL OR jsonb_typeof(p_movimientos)<>'array' OR jsonb_array_length(p_movimientos)>200 THEN RAISE EXCEPTION 'Movimientos inválidos'; END IF;
  IF EXISTS(SELECT 1 FROM public.pedido_movimientos m WHERE m.pedido_id=p.id AND m.tipo='devolucion'
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_movimientos) AS supplied(value) WHERE supplied.value->>'clave'=m.clave))
    THEN RAISE EXCEPTION 'Snapshot de devoluciones incompleto o atrasado'; END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(p_movimientos) LOOP
    IF jsonb_typeof(v)<>'object' OR v->>'tipo' NOT IN ('cobro','devolucion') OR v->>'tipo' IS NULL
      OR v->>'metodo_pago' IS DISTINCT FROM 'mercadopago'
      OR v->>'fecha_fuente' NOT IN ('proveedor','desconocida') OR v->>'fecha_fuente' IS NULL
      OR coalesce(v->>'monto_centavos','') !~ '^[1-9][0-9]{0,15}$'
      OR (v->>'tipo'='cobro' AND v->>'clave' IS DISTINCT FROM 'mp-cobro:'||p_mp_order_id)
      OR (v->>'tipo'='devolucion' AND (coalesce(v->>'clave','') NOT LIKE 'mp-devolucion:%' OR length(v->>'clave')<=14))
      OR length(coalesce(v->>'clave',''))>200 THEN RAISE EXCEPTION 'Movimiento inválido'; END IF;
    amount := (v->>'monto_centavos')::bigint;
    when_at := (v->>'ocurrido_en')::timestamptz;
    IF amount > 9007199254740991 OR ((when_at IS NULL) IS DISTINCT FROM (v->>'fecha_fuente'='desconocida'))
      THEN RAISE EXCEPTION 'Monto o fecha inválidos'; END IF;
    SELECT * INTO old FROM public.pedido_movimientos WHERE pedido_id=p.id AND clave=v->>'clave';
    IF FOUND THEN
      IF old.tipo IS DISTINCT FROM v->>'tipo' OR old.monto_centavos <> amount OR old.metodo_pago <> 'mercadopago'
        OR old.ocurrido_en IS DISTINCT FROM when_at OR old.fecha_fuente IS DISTINCT FROM v->>'fecha_fuente'
        THEN RAISE EXCEPTION 'Movimiento repetido incompatible'; END IF;
    ELSE
      INSERT INTO public.pedido_movimientos(pedido_id,proyecto_id,sucursal_id,clave,tipo,monto_centavos,metodo_pago,ocurrido_en,fecha_fuente)
        VALUES(p.id,p.proyecto_id,p.sucursal_id,v->>'clave',v->>'tipo',amount,'mercadopago',when_at,v->>'fecha_fuente');
    END IF;
  END LOOP;
  SELECT coalesce(sum(monto_centavos) FILTER(WHERE tipo='cobro'),0),coalesce(sum(monto_centavos) FILTER(WHERE tipo='devolucion'),0)
    INTO gross,returned FROM public.pedido_movimientos WHERE pedido_id=p.id;
  IF gross > round(p.total*100) OR returned > gross THEN RAISE EXCEPTION 'Monto supera total confirmado'; END IF;
  -- Refund facts and the derived state commit together under the parent lock.
  -- No optimistic state write can turn a confirmed total refund into a stale partial.
  IF returned>0 THEN
    UPDATE public.pedidos SET estado_pago=CASE WHEN returned=gross THEN 'reembolsado' ELSE 'parcialmente_reembolsado' END WHERE id=p.id;
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY registrado_en,id),'[]'::jsonb) INTO result FROM public.pedido_movimientos m WHERE pedido_id=p.id;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.registrar_movimientos_pago(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimientos_pago(uuid,text,jsonb) TO project_admin;

-- Declaration of receipt, not evidence of bank settlement. Prior documented
-- balance is retained with unknown date when a legacy partial is completed.
CREATE FUNCTION public.registrar_cobro_declarado() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target bigint:=0; previous bigint:=0; recorded bigint:=0; mp_target bigint:=0; mp_recorded bigint:=0; delta bigint; mp_delta bigint; baseline bigint; m text;
BEGIN
  IF NEW.proyecto_id IS DISTINCT FROM 'impasto' OR NEW.proveedor_pago='mercadopago' OR NEW.total IS NULL OR NEW.total<=0
    OR NEW.total*100 <> round(NEW.total*100) OR NEW.total*100>9007199254740991 THEN RETURN NEW; END IF;
  m:=NEW.metodo_pago;
  IF m NOT IN ('efectivo','transferencia','mercadopago') OR m IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.estado_pago IS NOT DISTINCT FROM OLD.estado_pago AND NEW.parcial_mp IS NOT DISTINCT FROM OLD.parcial_mp
      AND (NEW.status='pagado_mp') IS NOT DISTINCT FROM (OLD.status='pagado_mp') THEN RETURN NEW; END IF;
    previous:=CASE WHEN OLD.estado_pago='aprobado' OR OLD.status='pagado_mp' THEN round(OLD.total*100)
      ELSE round(least(greatest(coalesce(OLD.parcial_mp,0),0),OLD.total)*100) END;
  END IF;
  IF coalesce(NEW.parcial_mp,0)*100 <> round(coalesce(NEW.parcial_mp,0)*100) THEN RAISE EXCEPTION 'Parcial debe tener centavos exactos'; END IF;
  target:=CASE WHEN NEW.estado_pago='aprobado' OR NEW.status='pagado_mp' THEN round(NEW.total*100)
    ELSE round(least(greatest(coalesce(NEW.parcial_mp,0),0),NEW.total)*100) END;
  SELECT coalesce(sum(monto_centavos),0),coalesce(sum(monto_centavos) FILTER(WHERE metodo_pago='mercadopago'),0)
    INTO recorded,mp_recorded FROM public.pedido_movimientos WHERE pedido_id=NEW.id AND tipo='cobro';
  IF TG_OP='UPDATE' AND recorded=0 AND previous>0 THEN
    baseline:=previous;
    mp_target:=CASE WHEN OLD.status='pagado_mp' OR OLD.metodo_pago='mercadopago' THEN baseline
      ELSE least(baseline,round(greatest(coalesce(OLD.parcial_mp,0),0)*100)) END;
    IF mp_target>0 THEN INSERT INTO public.pedido_movimientos(pedido_id,proyecto_id,sucursal_id,clave,tipo,monto_centavos,metodo_pago,fecha_fuente)
      VALUES(NEW.id,NEW.proyecto_id,NEW.sucursal_id,'manual-base-mp','cobro',mp_target,'mercadopago','desconocida'); END IF;
    IF baseline>mp_target THEN INSERT INTO public.pedido_movimientos(pedido_id,proyecto_id,sucursal_id,clave,tipo,monto_centavos,metodo_pago,fecha_fuente)
      VALUES(NEW.id,NEW.proyecto_id,NEW.sucursal_id,'manual-base-saldo','cobro',baseline-mp_target,OLD.metodo_pago,'desconocida'); END IF;
    recorded:=baseline;mp_recorded:=mp_target;
  END IF;
  IF target<=recorded THEN RETURN NEW; END IF;
  delta:=target-recorded;
  mp_target:=CASE WHEN NEW.status='pagado_mp' OR m='mercadopago' THEN target ELSE least(target,round(greatest(coalesce(NEW.parcial_mp,0),0)*100)) END;
  mp_delta:=least(delta,greatest(mp_target-mp_recorded,0));
  IF mp_delta>0 THEN INSERT INTO public.pedido_movimientos(pedido_id,proyecto_id,sucursal_id,clave,tipo,monto_centavos,metodo_pago,ocurrido_en,fecha_fuente)
    VALUES(NEW.id,NEW.proyecto_id,NEW.sucursal_id,'manual-mp:'||target,'cobro',mp_delta,'mercadopago',now(),'registro'); END IF;
  IF delta>mp_delta THEN INSERT INTO public.pedido_movimientos(pedido_id,proyecto_id,sucursal_id,clave,tipo,monto_centavos,metodo_pago,ocurrido_en,fecha_fuente)
    VALUES(NEW.id,NEW.proyecto_id,NEW.sucursal_id,'manual-saldo:'||target,'cobro',delta-mp_delta,m,now(),'registro'); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.registrar_cobro_declarado() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_cobro_declarado() TO project_admin;
CREATE TRIGGER pedidos_cobro_declarado AFTER INSERT OR UPDATE OF estado_pago,parcial_mp,status ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.registrar_cobro_declarado();

-- Only orders created after this migration can initiate a refund here. Older
-- orders may have an uncertain POST using a historical amount-based key;
-- reconcile those through GET, or review them directly in Mercado Pago.
CREATE TABLE public.pedido_devolucion_intentos (
  pedido_id uuid PRIMARY KEY, solicitud jsonb, clave text,
  creado_en timestamptz NOT NULL DEFAULT now(), reservado_en timestamptz,
  CHECK((solicitud IS NULL)=(clave IS NULL)),
  CHECK((solicitud IS NULL)=(reservado_en IS NULL))
);
ALTER TABLE public.pedido_devolucion_intentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedido_devolucion_intentos FROM PUBLIC,anon,authenticated,project_admin;
CREATE FUNCTION public.habilitar_devolucion_pedido() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.proyecto_id='impasto' THEN INSERT INTO public.pedido_devolucion_intentos(pedido_id) VALUES(NEW.id); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.habilitar_devolucion_pedido() FROM PUBLIC,anon,authenticated,project_admin;
CREATE TRIGGER pedido_devolucion_nuevo AFTER INSERT ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.habilitar_devolucion_pedido();

CREATE FUNCTION public.reservar_devolucion_pago(p_pedido_id uuid,p_mp_order_id text,p_solicitud jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.pedidos%ROWTYPE; intent public.pedido_devolucion_intentos%ROWTYPE; amount numeric; suffix text; key text;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id=p_pedido_id FOR UPDATE;
  IF NOT FOUND OR p.proyecto_id IS DISTINCT FROM 'impasto' OR p.proveedor_pago IS DISTINCT FROM 'mercadopago'
    OR p.metodo_pago IS DISTINCT FROM 'mercadopago' OR p.mp_order_id IS DISTINCT FROM p_mp_order_id
    OR coalesce(p_mp_order_id,'')='' OR p.estado_pago IS DISTINCT FROM 'aprobado'
    OR p.total IS NULL OR p.total<=0 OR p.total*100<>round(p.total*100) OR p.total*100>9007199254740991
    OR coalesce(p.external_reference,'') NOT LIKE 'IM-%' THEN RAISE EXCEPTION 'Orden incompatible para devolución'; END IF;
  SELECT * INTO intent FROM public.pedido_devolucion_intentos WHERE pedido_id=p.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido anterior al registro de intentos: revisá la devolución directamente en Mercado Pago'; END IF;
  IF p_solicitud IS NULL OR jsonb_typeof(p_solicitud)<>'object' THEN RAISE EXCEPTION 'Solicitud de devolución inválida'; END IF;
  IF p_solicitud='{"total":true}'::jsonb THEN suffix:='total';
  ELSE
    IF NOT (p_solicitud ? 'transaction_id' AND p_solicitud ? 'amount_centavos')
      OR (SELECT count(*) FROM jsonb_object_keys(p_solicitud))<>2
      OR coalesce(p_solicitud->>'transaction_id','')='' OR length(p_solicitud->>'transaction_id')>200
      OR coalesce(p_solicitud->>'amount_centavos','') !~ '^[1-9][0-9]{0,15}$'
      THEN RAISE EXCEPTION 'Solicitud de devolución inválida'; END IF;
    amount:=(p_solicitud->>'amount_centavos')::numeric;
    IF amount>9007199254740991 OR p.total IS NULL OR amount>p.total*100 THEN RAISE EXCEPTION 'Monto de devolución inválido'; END IF;
    suffix:=rtrim(rtrim(to_char(amount/100,'FM999999999999990.00'),'0'),'.');
  END IF;
  key:='refund-'||p_mp_order_id||'-'||suffix;
  IF intent.solicitud IS NOT NULL THEN
    IF intent.solicitud IS DISTINCT FROM p_solicitud OR intent.clave IS DISTINCT FROM key THEN RAISE EXCEPTION 'Ya existe otra intención de devolución; conciliá el intento original'; END IF;
    RETURN intent.clave;
  END IF;
  UPDATE public.pedido_devolucion_intentos SET solicitud=p_solicitud,clave=key,reservado_en=now() WHERE pedido_id=p.id;
  RETURN key;
END $$;
REVOKE ALL ON FUNCTION public.reservar_devolucion_pago(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_devolucion_pago(uuid,text,jsonb) TO project_admin;
