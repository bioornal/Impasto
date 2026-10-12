"use client";

import { BUSINESS } from "../lib/business";
import { enlaceWhatsapp, MENSAJE_PEDIDO_WHATSAPP } from "../lib/contacto";
import Image from "next/image";
import styles from "./error.module.css";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const whatsappUrl = enlaceWhatsapp(BUSINESS.whatsappPhone, MENSAJE_PEDIDO_WHATSAPP);

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="error-title">
        <div className={styles.content}>
          <Image className={styles.logo} src="/logo.png" alt="Impasto · Pizzas a la piedra" width={1200} height={360} priority />
          <h1 id="error-title">La tienda online no está disponible en este momento</h1>
          <p className={styles.description}>
            Podés escribirnos por WhatsApp y te ayudamos con tu pedido. Tomamos pedidos de viernes a domingo.
          </p>

          <div className={styles.actions}>
            <a className={styles.whatsapp} href={whatsappUrl} target="_blank" rel="noreferrer">
              <svg className={styles.whatsappIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Zm0 2a8 8 0 0 1 0 16 8 8 0 0 1-4.1-1.1l-.4-.2-2.4.6.6-2.4-.2-.4A8 8 0 0 1 12 4Zm-3 3c-.3 0-.6.1-.8.4-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.2 1.6 2.6 4 3.5 2 .8 2.4.6 2.8.6.4-.1 1.3-.6 1.5-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.7-.4l-1.4-.7c-.2-.1-.4-.2-.6.2-.2.3-.6.7-.8.9-.1.2-.3.2-.6.1-.3-.1-1-.4-1.8-1.1-.7-.6-1.1-1.3-1.2-1.5-.1-.3 0-.4.1-.5l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5L9.7 7.3C9.5 7 9.3 7 9 7Z" />
              </svg>
              Pedir por WhatsApp
            </a>
            <button className={styles.retry} type="button" onClick={reset}>
              Reintentar
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
