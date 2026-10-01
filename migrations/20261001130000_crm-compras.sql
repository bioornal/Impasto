-- Contact profiles are independent from purchases; old counters are left intact.
CREATE INDEX clientes_crm_telefono_idx ON public.clientes((regexp_replace(telefono,'[^0-9]','','g')));
CREATE FUNCTION public.guardar_perfil_cliente(p_perfil jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text; tel text; identidad text; existente text; saved public.clientes;
BEGIN
 IF jsonb_typeof(p_perfil) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_perfil) LOOP
  IF k NOT IN ('telefono','nombre','direccion','email','detalles') THEN RAISE EXCEPTION 'Campo no permitido'; END IF;
  IF jsonb_typeof(p_perfil->k) NOT IN ('string','null') THEN RAISE EXCEPTION 'Texto de perfil inválido'; END IF;
 END LOOP;
 tel:=btrim(p_perfil->>'telefono');
 IF tel IS NULL OR tel='' OR length(tel)>128 THEN RAISE EXCEPTION 'Teléfono inválido'; END IF;
 identidad:=regexp_replace(tel,'[^0-9]','','g');
 IF identidad='' THEN RAISE EXCEPTION 'Teléfono inválido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('crm:'||identidad,0));
 SELECT telefono INTO existente FROM public.clientes
 WHERE regexp_replace(telefono,'[^0-9]','','g')=identidad
 ORDER BY (telefono=tel) DESC,telefono LIMIT 1;
 tel:=coalesce(existente,tel);
 INSERT INTO public.clientes AS c(telefono,nombre,direccion,email,detalles)
 VALUES(tel,nullif(btrim(p_perfil->>'nombre'),''),coalesce(btrim(p_perfil->>'direccion'),''),coalesce(btrim(p_perfil->>'email'),''),nullif(btrim(p_perfil->>'detalles'),''))
 ON CONFLICT(telefono) DO UPDATE SET
 nombre=coalesce(EXCLUDED.nombre,c.nombre),
 direccion=coalesce(nullif(EXCLUDED.direccion,''),c.direccion),
 email=coalesce(nullif(EXCLUDED.email,''),c.email),
 detalles=coalesce(EXCLUDED.detalles,c.detalles)
 RETURNING * INTO saved;
 RETURN to_jsonb(saved);
END $$;
ALTER FUNCTION public.guardar_perfil_cliente(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guardar_perfil_cliente(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_perfil_cliente(jsonb) TO project_admin;

CREATE FUNCTION public.perfil_cliente_del_pedido() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.proyecto_id='impasto' AND nullif(btrim(NEW.telefono_cliente),'') IS NOT NULL THEN
  PERFORM public.guardar_perfil_cliente(jsonb_build_object('telefono',NEW.telefono_cliente,'nombre',NEW.nombre_cliente,'email',NEW.email_cliente,'direccion',CASE WHEN NEW.modalidad='takeaway' THEN '' ELSE NEW.direccion END));
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION public.perfil_cliente_del_pedido() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.perfil_cliente_del_pedido() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER pedidos_perfil_cliente AFTER INSERT ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.perfil_cliente_del_pedido();

-- Exact full digits only; names and phone suffixes never establish identity.
CREATE INDEX pedidos_crm_telefono_idx ON public.pedidos(proyecto_id,(regexp_replace(coalesce(telefono_cliente,''),'[^0-9]','','g')));
CREATE FUNCTION public.leer_clientes_crm(p_proyecto text DEFAULT 'impasto',p_telefono text DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 500) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF nullif(btrim(p_proyecto),'') IS NULL OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit<1 OR p_limit>1000 THEN RAISE EXCEPTION 'Consulta de clientes inválida'; END IF;
 WITH profiles AS (
  SELECT c.*,regexp_replace(c.telefono,'[^0-9]','','g') AS identidad FROM public.clientes c
  WHERE p_telefono IS NULL OR (regexp_replace(p_telefono,'[^0-9]','','g')<>'' AND regexp_replace(c.telefono,'[^0-9]','','g')=regexp_replace(p_telefono,'[^0-9]','','g'))
  ORDER BY c.telefono OFFSET p_offset LIMIT p_limit
 ), rows AS (
  SELECT (to_jsonb(c)-'identidad') || jsonb_build_object('cant_compras',a.compras,'total_cobrado',a.total,'ultima_compra',a.ultima,'compras_sin_importe',a.desconocidas) AS value,c.telefono
  FROM profiles c CROSS JOIN LATERAL (
   SELECT count(*) FILTER(WHERE x.neto>0) AS compras,coalesce(sum(x.neto) FILTER(WHERE x.neto>0),0) AS total,
    max(x.created_at) FILTER(WHERE x.neto>0) AS ultima,count(*) FILTER(WHERE x.desconocido) AS desconocidas
   FROM (
    SELECT p.created_at,
     CASE WHEN m.cantidad>0 THEN m.neto/100.0
      WHEN p.estado_pago='parcialmente_reembolsado' OR p.status='cancelado' OR p.estado_pago IN ('rechazado','reembolsado') THEN 0
      WHEN p.status='pagado_mp' OR (p.estado_pago='aprobado' AND p.metodo_pago IN ('efectivo','transferencia','mercadopago')) THEN greatest(coalesce(p.total,0),0)
      ELSE least(greatest(coalesce(p.total,0),0),greatest(coalesce(p.parcial_mp,0),0)) END AS neto,
     (m.cantidad=0 AND p.estado_pago='parcialmente_reembolsado') AS desconocido
    FROM public.pedidos p CROSS JOIN LATERAL (
     SELECT count(*) AS cantidad,coalesce(sum(CASE WHEN tipo='cobro' THEN monto_centavos ELSE -monto_centavos END),0) AS neto
     FROM public.pedido_movimientos WHERE pedido_id=p.id
    ) m
    WHERE p.proyecto_id=p_proyecto AND c.identidad<>'' AND regexp_replace(coalesce(p.telefono_cliente,''),'[^0-9]','','g')=c.identidad
   ) x
  ) a
 ) SELECT coalesce(jsonb_agg(value ORDER BY telefono),'[]'::jsonb) INTO result FROM rows;
 RETURN result;
END $$;
ALTER FUNCTION public.leer_clientes_crm(text,text,integer,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.leer_clientes_crm(text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.leer_clientes_crm(text,text,integer,integer) TO project_admin;
