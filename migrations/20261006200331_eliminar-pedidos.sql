-- Eliminar pedidos de prueba desde el panel. Borra el pedido junto con lo que cuelga de
-- él, en una sola transacción. El costeo y los movimientos de pago son inmutables a
-- propósito (ver `pedido_costeos` y `pedido_movimientos`): un pedido que los tiene no
-- se elimina, y la función falla antes de borrar nada.
CREATE FUNCTION public.eliminar_pedidos_impasto(p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ids uuid[]; n integer;
BEGIN
  SELECT coalesce(array_agg(id),'{}') INTO ids FROM public.pedidos WHERE id = ANY(p_ids) AND proyecto_id = 'impasto';
  IF EXISTS(SELECT 1 FROM public.pedido_costeos WHERE pedido_id = ANY(ids))
     OR EXISTS(SELECT 1 FROM public.pedido_movimientos WHERE pedido_id = ANY(ids)) THEN
    RAISE EXCEPTION 'Hay pedidos con costeo o movimientos de pago inmutables';
  END IF;
  DELETE FROM public.pedido_devolucion_operaciones WHERE pedido_id = ANY(ids);
  DELETE FROM public.pedido_devolucion_intentos WHERE pedido_id = ANY(ids);
  DELETE FROM public.notificaciones WHERE pedido_id = ANY(ids);
  DELETE FROM public.pedido_eventos WHERE pedido_id = ANY(ids);
  DELETE FROM public.pedidos WHERE id = ANY(ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.eliminar_pedidos_impasto(uuid[]) FROM PUBLIC,anon,authenticated;
