import "../impasto.css";

/**
 * La web pública. `impasto.css` va acá y no en el layout raíz: sus clases (`.topbar`, `.btn`,
 * `h1…h5`) pisaban las del panel y dejaban el título de cada sección crema sobre blanco.
 * El grupo `(sitio)` no forma parte de la URL.
 */
export default function SitioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
