"use client";
import { useState } from "react";
import type { Review } from "@/types";
import type { BusinessConfig } from "@/lib/business";
import { lineaProducto } from "@/lib/opiniones";
import { OpinionForm } from "@/components/opiniones/OpinionForm";

interface ReviewsProps {
  reviews: Review[];
  business: BusinessConfig;
  /** Lo que se puede elegir en "¿Qué probaste?": pizzas de la carta y "Empanadas". */
  productos: string[];
}

function WspCard({ business, texto }: { business: BusinessConfig; texto: string }) {
  return (
    <article className="wsp-card">
      <div>
        <b>Pedí por WhatsApp si preferís</b>
        <small>{texto}</small>
      </div>
      <a className="btn btn-cream" href={`https://wa.me/${business.whatsappPhone}`} target="_blank" rel="noreferrer">
        Abrir WhatsApp
      </a>
    </article>
  );
}

/** La invitación a opinar: una píldora que despliega el formulario. */
function Invitacion({ productos }: { productos: string[] }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="reviews-invite">
      {abierta ? (
        <OpinionForm modo="home" productos={productos} />
      ) : (
        <button type="button" className="reviews-invite-btn" onClick={() => setAbierta(true)}>
          <span className="reviews-invite-estrellas" aria-hidden="true">★★★★★</span>
          <span><b>¿Ya probaste Impasto?</b> Contanos qué te pareció</span>
          <span className="reviews-invite-flecha" aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

export function Reviews({ reviews, business, productos }: ReviewsProps) {
  // Sin opiniones publicadas, la sección es solo la invitación (y WhatsApp en
  // escritorio). Antes, en mobile, se ocultaba entera.
  if (reviews.length === 0) {
    return (
      <section className="reviews reviews-empty">
        <div className="container reviews-empty-inner">
          <Invitacion productos={productos} />
          <WspCard business={business} texto="Te confirmamos el pedido y te preparamos la orden directamente." />
        </div>
      </section>
    );
  }

  return (
    <section className="reviews">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="sec-index">05 — Opiniones</div>
            <h2>Lo que dicen los que ya probaron</h2>
          </div>
          <div className="side-note">Opiniones de<br />clientes de Impasto</div>
        </div>

        <div className="reviews-grid">
          {reviews.slice(0, 6).map((review, index) => (
            <article className="review-card" key={`${review.nombre}-${index}`}>
              <div className="review-stars">{"★".repeat(Math.max(1, Math.min(5, review.rating)))}</div>
              <p>&ldquo;{review.texto}&rdquo;</p>
              <div className="review-who">
                <div className="review-avatar">{review.nombre.trim().charAt(0).toUpperCase()}</div>
                <div>
                  <b>{review.nombre}</b>
                  <small>{lineaProducto(review.producto || "") || "Cliente de Impasto"}</small>
                </div>
              </div>
            </article>
          ))}

          <WspCard business={business} texto="Te confirmamos el pedido y te avisamos cuando sale del horno." />
        </div>

        <Invitacion productos={productos} />
      </div>
    </section>
  );
}
