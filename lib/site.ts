/**
 * URL canónica del sitio. Todo lo de SEO —canonical, og:url, sitemap,
 * robots y el JSON-LD— tiene que apuntar al mismo origen: si el canonical
 * dice una cosa y el sitemap otra, Google descarta las señales.
 *
 * Orden de preferencia:
 *  1. `NEXT_PUBLIC_SITE_URL`, para fijarla a mano cuando se compre el dominio.
 *  2. `URL`, que Netlify inyecta sola en el build con la URL principal del sitio.
 *  3. El subdominio de Netlify actual, para que nunca quede vacía.
 *
 * Ojo: como se lee en build, **cambiarla en Netlify exige reconstruir**.
 * Es el mismo caso que la public key de Mercado Pago.
 */
const CRUDA = process.env.NEXT_PUBLIC_SITE_URL
  || process.env.URL
  || "https://vocal-naiad-861a2c.netlify.app";

/** Sin barra final: los `${SITE_URL}/algo` de todo el proyecto la agregan. */
export const SITE_URL = CRUDA.replace(/\/+$/, "");

/** URL absoluta a partir de una ruta del sitio. */
export const urlAbsoluta = (ruta = "/") => `${SITE_URL}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
