/**
 * Bucket PRIVADO `comprobantes`. Un comprobante lleva nombre, CBU y movimientos de
 * quien transfirió: nunca va al bucket público `DB`. Solo se lee desde el panel
 * (`/api/admin/pedidos/[id]/comprobante`), con la clave de backend.
 */
const BUCKET = "comprobantes";

const urlDe = (clave: string) =>
  `${process.env.INSFORGE_API_BASE_URL}/api/storage/buckets/${BUCKET}/objects/${clave.split("/").map(encodeURIComponent).join("/")}`;

/** PUT directo, como `subirFoto`: el SDK no deja fijar el tipo del archivo. */
export async function subirComprobante(clave: string, bytes: Uint8Array, mime: string): Promise<void> {
  const cuerpo = new FormData();
  cuerpo.append("file", new Blob([bytes as BlobPart], { type: mime }), clave.split("/").pop());
  const respuesta = await fetch(urlDe(clave), {
    method: "PUT",
    headers: { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}` },
    body: cuerpo,
  });
  if (!respuesta.ok) throw new Error(`La subida respondió ${respuesta.status}`);
}

export async function bajarComprobante(clave: string): Promise<Response> {
  return fetch(urlDe(clave), {
    headers: { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}` },
    cache: "no-store",
  });
}

/** Borra el archivo de un comprobante, al eliminar su pedido. */
export async function borrarComprobante(clave: string): Promise<void> {
  const respuesta = await fetch(urlDe(clave), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}` },
  });
  if (!respuesta.ok && respuesta.status !== 404) throw new Error(`El borrado respondió ${respuesta.status}`);
}
