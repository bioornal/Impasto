-- Manual declarations record money already returned outside this application.
-- fecha_fuente=registro is the declaration timestamp, never bank settlement evidence.
ALTER TABLE public.pedido_movimientos ADD COLUMN operacion_manual_id uuid;
ALTER TABLE public.pedido_movimientos ADD COLUMN motivo_manual text;
CREATE UNIQUE INDEX pedido_movimientos_operacion_manual_idx ON public.pedido_movimientos(operacion_manual_id) WHERE operacion_manual_id IS NOT NULL;
ALTER TABLE public.pedido_movimientos ADD CONSTRAINT movimiento_devolucion_manual CHECK (
 (operacion_manual_id IS NULL AND motivo_manual IS NULL) OR
 (operacion_manual_id IS NOT NULL AND motivo_manual IS NOT NULL AND tipo='devolucion' AND fecha_fuente='registro' AND length(btrim(motivo_manual)) BETWEEN 3 AND 500));

CREATE FUNCTION public.registrar_devolucion_manual(p_pedido_id uuid,p_sucursal_id text,p_operacion_id uuid,p_monto_centavos bigint,p_metodo text,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.pedidos%ROWTYPE; old public.pedido_movimientos%ROWTYPE;
 gross numeric; returned numeric; channel_net numeric; movement_id uuid; payment_state text;
BEGIN
 SELECT * INTO p FROM public.pedidos WHERE id=p_pedido_id FOR UPDATE;
 IF NOT FOUND OR p.proyecto_id IS DISTINCT FROM 'impasto' OR coalesce(p_sucursal_id,'')='' OR p.sucursal_id IS DISTINCT FROM p_sucursal_id
  OR p.proveedor_pago='mercadopago' OR coalesce(p.mp_order_id,'')<>''
  OR coalesce(p.id_pago,'')<>'' THEN RAISE EXCEPTION 'Pedido incompatible para declaración manual'; END IF;
 IF p_operacion_id IS NULL OR p_monto_centavos IS NULL OR p_monto_centavos<=0 OR p_monto_centavos>9007199254740991
  OR p_metodo IS NULL OR p_metodo NOT IN ('efectivo','transferencia','mercadopago')
  OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 3 AND 500 OR p_motivo IS DISTINCT FROM btrim(p_motivo)
  THEN RAISE EXCEPTION 'Declaración manual inválida'; END IF;
 SELECT * INTO old FROM public.pedido_movimientos WHERE operacion_manual_id=p_operacion_id;
 IF FOUND THEN
  IF old.pedido_id<>p.id OR old.monto_centavos<>p_monto_centavos OR old.metodo_pago<>p_metodo OR old.motivo_manual<>p_motivo
   THEN RAISE EXCEPTION 'Operación manual repetida incompatible'; END IF;
  RETURN jsonb_build_object('operacion_id',p_operacion_id,'movimiento_id',old.id,'estado_pago',p.estado_pago,'recovered',true);
 END IF;
 SELECT coalesce(sum(monto_centavos) FILTER(WHERE tipo='cobro'),0),coalesce(sum(monto_centavos) FILTER(WHERE tipo='devolucion'),0),
  coalesce(sum(CASE WHEN tipo='cobro' THEN monto_centavos ELSE -monto_centavos END) FILTER(WHERE metodo_pago=p_metodo),0)
  INTO gross,returned,channel_net FROM public.pedido_movimientos WHERE pedido_id=p.id;
 IF gross<=0 OR gross>9007199254740991 OR returned>gross OR channel_net<p_monto_centavos
  OR (p.estado_pago IN ('parcialmente_reembolsado','reembolsado') AND returned=0)
  THEN RAISE EXCEPTION 'Saldo documentado insuficiente o histórico no conciliado'; END IF;
 INSERT INTO public.pedido_movimientos(pedido_id,proyecto_id,sucursal_id,clave,tipo,monto_centavos,metodo_pago,ocurrido_en,fecha_fuente,operacion_manual_id,motivo_manual)
  VALUES(p.id,p.proyecto_id,p.sucursal_id,'manual-devolucion:'||p_operacion_id,'devolucion',p_monto_centavos,p_metodo,now(),'registro',p_operacion_id,p_motivo)
  RETURNING id INTO movement_id;
 payment_state:=CASE WHEN returned+p_monto_centavos=gross THEN 'reembolsado' ELSE 'parcialmente_reembolsado' END;
 UPDATE public.pedidos SET estado_pago=payment_state WHERE id=p.id;
 RETURN jsonb_build_object('operacion_id',p_operacion_id,'movimiento_id',movement_id,'estado_pago',payment_state,'recovered',false);
END $$;
ALTER FUNCTION public.registrar_devolucion_manual(uuid,text,uuid,bigint,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.registrar_devolucion_manual(uuid,text,uuid,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_devolucion_manual(uuid,text,uuid,bigint,text,text) TO project_admin;
