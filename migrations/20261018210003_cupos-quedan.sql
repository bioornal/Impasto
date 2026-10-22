-- El panel maneja el cupo como "cuántas me quedan para vender esta noche" (pedido del dueño,
-- 18/10/2026): cada pizza arranca la noche en 100 (sin fila = sin límite) y él baja las que no tiene.
-- Fijar lo que queda = cupo = lo ya vendido + lo que queda, en un solo paso: si justo entra un
-- pedido, no se pisa. Servidor propio: sin OWNER TO postgres (todo es de project_admin).
CREATE FUNCTION public.fijar_cupo_restante(p_proyecto text, p_producto uuid, p_quedan_mitades integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE fila public.cupos_noche;
BEGIN
 IF p_quedan_mitades IS NULL OR p_quedan_mitades < 0 OR p_quedan_mitades > 2000 THEN
  RAISE EXCEPTION 'Cupo inválido';
 END IF;
 INSERT INTO public.cupos_noche(proyecto_id, noche, producto_id, cupo_mitades)
 VALUES (p_proyecto, public.noche_de_negocio(now()), p_producto, p_quedan_mitades)
 ON CONFLICT (proyecto_id, noche, producto_id) DO UPDATE
  SET cupo_mitades = LEAST(2000, public.cupos_noche.vendidas_mitades + EXCLUDED.cupo_mitades), actualizado_en = now()
 RETURNING * INTO fila;
 RETURN to_jsonb(fila);
END $$;
REVOKE ALL ON FUNCTION public.fijar_cupo_restante(text,uuid,integer) FROM PUBLIC, anon, authenticated;
