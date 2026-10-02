import {
  BASE_DE_TODAS,
  PIZZAS,
  PREPARACIONES,
  idDePreparacion,
  type PizzaGuia,
  type PreparacionGuia,
} from "@/lib/guia-cocina";
import { REAL_PRODUCT_PHOTOS } from "@/lib/stock-images";

function TarjetaPizza({ p, primera }: { p: PizzaGuia; primera: boolean }) {
  const foto = REAL_PRODUCT_PHOTOS[p.productoId];
  return (
    <article className="ck-pizza">
      {foto && (
        // Las fotos del bucket redirigen al CDN: el sitio las muestra con <img>
        // y no con next/image, que solo acepta el host del bucket.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="ck-foto"
          src={foto}
          alt={`Foto de ${p.nombre}`}
          width={1200}
          height={896}
          loading={primera ? "eager" : "lazy"}
          decoding="async"
        />
      )}
      <div className="ck-cuerpo">
        <h3>{p.nombre}</h3>
        <p className="ck-base-pizza">
          <span>Base</span>
          {p.base}
        </p>
        <ul className="ck-ing">
          {p.ingredientes.map((i) => (
            <li key={i.nombre}>
              <span>{i.nombre}</span>
              <b>{i.cantidad}</b>
            </li>
          ))}
        </ul>
        {p.despues && (
          <div className="ck-despues">
            <h4>Después del horno</h4>
            <p>{p.despues}</p>
          </div>
        )}
        {p.nota && <p className="ck-nota">{p.nota}</p>}
        {p.preparaciones.length > 0 && (
          <p className="ck-preps">
            Preparaciones:{" "}
            {p.preparaciones.map((n, i) => (
              <span key={n}>
                {i > 0 && ", "}
                <a href={`#prep-${idDePreparacion(n)}`}>{n}</a>
              </span>
            ))}
          </p>
        )}
      </div>
    </article>
  );
}

function TarjetaPreparacion({ p }: { p: PreparacionGuia }) {
  return (
    <article className="ck-prep" id={`prep-${idDePreparacion(p.nombre)}`}>
      <h3>{p.nombre}</h3>
      <p className="ck-para">Para: {p.para}</p>
      <p>{p.receta}</p>
      <p className="ck-cons">
        <span>Se guarda</span>
        {p.conservacion}
      </p>
    </article>
  );
}

export default function CocinaPage() {
  const enVenta = PIZZAS.filter((p) => p.estado === "venta");
  const proximas = PIZZAS.filter((p) => p.estado === "proximamente");
  const prepsHoy = PREPARACIONES.filter((p) => !p.proximamente);
  const prepsProximas = PREPARACIONES.filter((p) => p.proximamente);

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
        <a href="#proximamente">Próximamente ({proximas.length})</a>
        <a href="#preparaciones">Preparaciones ({PREPARACIONES.length})</a>
      </nav>

      <section id="venta">
        <h2>En venta</h2>
        <div className="ck-grid">
          {enVenta.map((p, i) => (
            <TarjetaPizza key={p.nombre} p={p} primera={i < 2} />
          ))}
        </div>
      </section>

      <section id="proximamente">
        <h2>Próximamente</h2>
        <p className="ck-aviso">Todavía no están en la carta. Pueden cambiar antes de salir.</p>
        <div className="ck-grid">
          {proximas.map((p) => (
            <TarjetaPizza key={p.nombre} p={p} primera={false} />
          ))}
        </div>
      </section>

      <section id="preparaciones">
        <h2>Preparaciones</h2>
        <p className="ck-aviso">
          Lo que lleva ajo, hierbas o verduras en aceite va tapado en la heladera y se usa en 4 días, o se congela en
          porciones.
        </p>
        <h3 className="ck-subtitulo">Para las pizzas en venta</h3>
        <div className="ck-grid ck-grid-preps">
          {prepsHoy.map((p) => (
            <TarjetaPreparacion key={p.nombre} p={p} />
          ))}
        </div>
        <h3 className="ck-subtitulo">Para las que vienen</h3>
        <div className="ck-grid ck-grid-preps">
          {prepsProximas.map((p) => (
            <TarjetaPreparacion key={p.nombre} p={p} />
          ))}
        </div>
      </section>
    </main>
  );
}
