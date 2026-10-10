import {
  BASE_DE_TODAS,
  BLANCA,
  FOTOS_EN_PRUEBA,
  SALSA,
  armarGuia,
  type LineaGuia,
  type PizzaGuia,
  type PreparacionGuia,
} from "@/lib/guia-cocina";
import { leerFilasGuia } from "@/lib/guia-cocina-datos";
import { elegirFoto, type ObjetoFoto } from "@/lib/fotos";
import { listarFotos } from "@/lib/fotos-bucket";
import { REAL_PRODUCT_PHOTOS } from "@/lib/stock-images";

// Se arma en cada visita y no en el build: el CI compila sin acceso a la base, y con
// `revalidate` Next la generaba en el build y el CI fallaba (desde el 03/10/2026).
// Las filas del recetario se guardan un minuto en `leerFilasGuia`; si la base falla
// al renovarlas, se sigue mostrando la última versión buena.
export const dynamic = "force-dynamic";

// La foto más nueva del bucket (por carpeta del producto o por nombre); si no hay,
// la del mapa del código, y para las pizzas en prueba, la de la guía.
const fotoDe = (objetos: ObjetoFoto[]) => (productoId: string | undefined, nombre: string) =>
  elegirFoto({ id: productoId, nombre }, objetos)
  ?? (productoId ? REAL_PRODUCT_PHOTOS[productoId] : undefined)
  ?? FOTOS_EN_PRUEBA[nombre];

function Nombre({ l }: { l: LineaGuia }) {
  return l.preparacion ? <a href={`#prep-${l.preparacion}`}>{l.nombre}</a> : <>{l.nombre}</>;
}

function Lista({ lineas }: { lineas: LineaGuia[] }) {
  return (
    <ul className="ck-ing">
      {lineas.map((l) => (
        <li key={l.nombre}>
          <span><Nombre l={l} /></span>
          <b>{l.cantidad}</b>
        </li>
      ))}
    </ul>
  );
}

function TarjetaPizza({ p, primera }: { p: PizzaGuia; primera: boolean }) {
  return (
    <article className="ck-pizza">
      {p.foto ? (
        // Las fotos del bucket redirigen al CDN: el sitio las muestra con <img>
        // y no con next/image, que solo acepta el host del bucket.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="ck-foto"
          src={p.foto}
          alt={`Foto de ${p.nombre}`}
          width={1200}
          height={896}
          loading={primera ? "eager" : "lazy"}
          decoding="async"
        />
      ) : (
        <div className="ck-sinfoto">Sin foto todavía</div>
      )}
      <div className="ck-cuerpo">
        <h3>{p.nombre}</h3>
        {p.sinReceta ? (
          <p className="ck-nota">Receta no cargada en el recetario.</p>
        ) : (
          <>
            <p className="ck-base-pizza">
              <span>Base</span>
              {!p.salsa && BLANCA}
              {p.salsaLegada && SALSA}
              {p.base.map((l, i) => (
                <span key={l.nombre} className="ck-base-linea">
                  {(p.salsaLegada || !p.salsa || i > 0) && " + "}
                  <Nombre l={l} />, {l.cantidad}
                </span>
              ))}
            </p>
            {p.horno.length > 0 && <Lista lineas={p.horno} />}
            {p.despues.length > 0 && (
              <div className="ck-despues">
                <h4>Después del horno</h4>
                <Lista lineas={p.despues} />
              </div>
            )}
          </>
        )}
        {p.nota && <p className="ck-nota">{p.nota}</p>}
      </div>
    </article>
  );
}

function TarjetaPreparacion({ p }: { p: PreparacionGuia }) {
  return (
    <article className="ck-prep" id={`prep-${p.id}`}>
      <h3>{p.nombre}</h3>
      <p className="ck-para">Para: {p.para.join(", ")} · Tanda: rinde {p.rinde}</p>
      <Lista lineas={p.ingredientes} />
      {p.indicaciones && <p>{p.indicaciones}</p>}
      {p.conservacion && (
        <p className="ck-cons">
          <span>Se guarda</span>
          {p.conservacion}
        </p>
      )}
    </article>
  );
}

export default async function CocinaPage() {
  const [filas, objetos] = await Promise.all([leerFilasGuia(), listarFotos()]);
  const { pizzas, preparaciones } = armarGuia(filas, fotoDe(objetos));
  const enVenta = pizzas.filter((p) => p.estado === "venta");
  const proximas = pizzas.filter((p) => p.estado === "proximamente");
  const enPrueba = pizzas.filter((p) => p.estado === "prueba");
  const prepsHoy = preparaciones.filter((p) => !p.proximamente);
  const prepsProximas = preparaciones.filter((p) => p.proximamente);

  return (
    <main className="ck">
      <header className="ck-top">
        <p className="ck-kicker">Impasto · Cocina</p>
        <h1>Armado de pizzas</h1>
        <ul className="ck-base">
          {BASE_DE_TODAS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </header>

      <nav className="ck-nav" aria-label="Secciones">
        <a href="#venta">En venta ({enVenta.length})</a>
        {proximas.length > 0 && <a href="#proximamente">Próximamente ({proximas.length})</a>}
        {enPrueba.length > 0 && <a href="#prueba">En prueba ({enPrueba.length})</a>}
        <a href="#preparaciones">Preparaciones ({preparaciones.length})</a>
      </nav>

      <section id="venta">
        <h2>En venta</h2>
        <div className="ck-grid">
          {enVenta.map((p, i) => (
            <TarjetaPizza key={p.nombre} p={p} primera={i < 2} />
          ))}
        </div>
      </section>

      {proximas.length > 0 && (
        <section id="proximamente">
          <h2>Próximamente</h2>
          <p className="ck-aviso">Todavía no están en la carta. Pueden cambiar antes de salir.</p>
          <div className="ck-grid">
            {proximas.map((p) => (
              <TarjetaPizza key={p.nombre} p={p} primera={false} />
            ))}
          </div>
        </section>
      )}

      {enPrueba.length > 0 && (
        <section id="prueba">
          <h2>En prueba</h2>
          <p className="ck-aviso">
            Pizzas nuevas que todavía se están probando. Los gramos pueden cambiar. Las imágenes son ilustrativas.
          </p>
          <div className="ck-grid">
            {enPrueba.map((p) => (
              <TarjetaPizza key={p.nombre} p={p} primera={false} />
            ))}
          </div>
        </section>
      )}

      <section id="preparaciones">
        <h2>Preparaciones</h2>
        <p className="ck-aviso">
          Lo que lleva ajo, hierbas o verduras en aceite va tapado en la heladera y se usa en 4 días, o se congela en
          porciones.
        </p>
        <h3 className="ck-subtitulo">Para las pizzas en venta</h3>
        <div className="ck-grid ck-grid-preps">
          {prepsHoy.map((p) => (
            <TarjetaPreparacion key={p.id} p={p} />
          ))}
        </div>
        {prepsProximas.length > 0 && (
          <>
            <h3 className="ck-subtitulo">Para las que todavía no están en la carta</h3>
            <div className="ck-grid ck-grid-preps">
              {prepsProximas.map((p) => (
                <TarjetaPreparacion key={p.id} p={p} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
