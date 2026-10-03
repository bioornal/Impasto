# `/cocina` automática — Paso 5: subir la foto desde el admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueño cambie la foto de cualquier producto desde Productos → Editar producto, sin entrar a InsForge, y que se vea al instante en la carta, en `/cocina` y en el admin.

**Architecture:** Una ruta nueva `POST /api/admin/productos/[id]/foto` (protegida con `requireAdmin`) valida el archivo por sus primeros bytes y lo sube con la clave de backend a `fotos/<id>/<fecha>.<ext>` (nunca pisa nada). Después vence la caché `fotos` y `/cocina`. La elección del paso 4 ya considera esa carpeta. El listado del admin agrega la foto elegida a cada producto y la miniatura la usa.

**Tech Stack:** Next 16 route handlers (`req.formData()`, `revalidateTag(tag, { expire: 0 })`, `revalidatePath`), `@insforge/sdk` (`storage.from('DB').upload`), React (admin), tests con `tsx`.

**Diseño:** `docs/superpowers/specs/2026-10-03-cocina-y-fotos-automaticas-design.md` (parte 4).

## Global Constraints

- Solo JPG, PNG o WebP, reconocidos por sus primeros bytes. **Hasta 4 MB** (el diseño decía 5: Netlify limita el cuerpo de las funciones a 6 MB y lo codifica en base64, que suma un tercio).
- El producto tiene que existir con `proyecto_id = 'impasto'` y una categoría de Impasto; el id tiene que ser un uuid.
- Clave `fotos/<id>/<AAAAMMDDTHHMMSSmmmZ>.<ext>`: nunca se reemplaza un archivo; las fotos anteriores quedan.
- Sin login, 401 como el resto del admin.
- Productos nuevos: el campo pide guardarlos primero (todavía no tienen id).
- Fuera de alcance: recortar, comprimir, borrar fotos y volver a una anterior.

## Archivos

- Crear `lib/foto-subida.ts` y `tests/foto-subida.test.ts` (agregar a `pnpm test`).
- Crear `app/api/admin/productos/[id]/foto/route.ts`.
- Modificar `app/api/admin/productos/route.ts` (GET agrega `foto`).
- Modificar `app/admin/components/types.ts`, `StoreProvider.tsx` (`adaptProduct` lee `foto`; acción para actualizarla), `ProductThumb.tsx`, `Products.tsx` (campo Foto).
- Modificar `CLAUDE.md`.

---

### Task 1: Validación y clave (puro)

- [ ] **Test** `tests/foto-subida.test.ts`:

```ts
import { TAMANO_MAXIMO, claveDeFoto, idValido, validarFoto } from "../lib/foto-subida";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}
const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]);
const GIF = bytes(0x47, 0x49, 0x46, 0x38);

const ok = (r: ReturnType<typeof validarFoto>) => (r.ok ? r.tipo.ext : r.error);
chequear("tipo · jpg", ok(validarFoto(JPG, JPG.length)) === "jpg");
chequear("tipo · png", ok(validarFoto(PNG, PNG.length)) === "png");
chequear("tipo · webp", ok(validarFoto(WEBP, WEBP.length)) === "webp");
chequear("tipo · otro formato se rechaza", ok(validarFoto(GIF, GIF.length)) === "La foto tiene que ser JPG, PNG o WebP.");
chequear("tamaño · vacío se rechaza", ok(validarFoto(new Uint8Array(), 0)) === "Elegí una foto.");
chequear("tamaño · más de 4 MB se rechaza", ok(validarFoto(JPG, TAMANO_MAXIMO + 1)) === "La foto pesa más de 4 MB.");
chequear("clave · carpeta del producto y fecha con milésimas",
  claveDeFoto("0d871df5-0e5c-4fe3-8450-5e63261de27a", new Date("2026-10-03T15:30:00.123Z"), "jpg") === "fotos/0d871df5-0e5c-4fe3-8450-5e63261de27a/20261003T153000123Z.jpg");
chequear("id · uuid válido", idValido("0d871df5-0e5c-4fe3-8450-5e63261de27a"));
chequear("id · rechaza rutas y basura", !idValido("../x") && !idValido("abc") && !idValido("0d871df5-0e5c-4fe3-8450-5e63261de27a/../y"));

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
```

- [ ] **Implementación** `lib/foto-subida.ts`:

```ts
/**
 * Fotos que el dueño sube desde el admin (Productos → Editar producto). Puro, para
 * testearse con `tsx`; la ruta es `app/api/admin/productos/[id]/foto/route.ts`.
 */
export const TAMANO_MAXIMO = 4 * 1024 * 1024; // Netlify: cuerpo de hasta 6 MB, en base64.

export interface TipoImagen { ext: "jpg" | "png" | "webp"; mime: string }

function empiezaCon(bytes: Uint8Array, firma: number[], desde = 0): boolean {
  return firma.every((b, i) => bytes[desde + i] === b);
}

/** Reconoce la imagen por sus primeros bytes, no por lo que declara el navegador. */
export function tipoDeImagen(bytes: Uint8Array): TipoImagen | null {
  if (empiezaCon(bytes, [0xff, 0xd8, 0xff])) return { ext: "jpg", mime: "image/jpeg" };
  if (empiezaCon(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", mime: "image/png" };
  if (empiezaCon(bytes, [0x52, 0x49, 0x46, 0x46]) && empiezaCon(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { ext: "webp", mime: "image/webp" };
  return null;
}

export function validarFoto(bytes: Uint8Array, tamano: number): { ok: true; tipo: TipoImagen } | { ok: false; error: string } {
  if (!tamano) return { ok: false, error: "Elegí una foto." };
  if (tamano > TAMANO_MAXIMO) return { ok: false, error: "La foto pesa más de 4 MB." };
  const tipo = tipoDeImagen(bytes);
  return tipo ? { ok: true, tipo } : { ok: false, error: "La foto tiene que ser JPG, PNG o WebP." };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const idValido = (id: string) => UUID.test(id);

/** `fotos/<id>/<fecha>.<ext>`: cada subida es un archivo nuevo; el CDN nunca sirve una foto vieja. */
export function claveDeFoto(productoId: string, fecha: Date, ext: TipoImagen["ext"]): string {
  const sello = fecha.toISOString().replace(/[-:.]/g, "");
  return `fotos/${productoId}/${sello}.${ext}`;
}
```

(`2026-10-03T15:30:00.123Z` → `20261003T153000123Z`.)

- [ ] `npx tsx tests/foto-subida.test.ts` → pasa; sumarlo a `pnpm test`; commit.

### Task 2: Ruta de subida y foto en el listado

- [ ] `app/api/admin/productos/[id]/foto/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";
import { claveDeFoto, idValido, validarFoto } from "@/lib/foto-subida";

const error = (mensaje: string, status: number) => NextResponse.json({ ok: false, error: mensaje }, { status });

/** Sube una foto nueva del producto. Nunca reemplaza: la carta y /cocina toman la más nueva. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  if (!idValido(id)) return error("Producto inválido.", 400);

  const { data: productos, error: errorLectura } = await db.database.from("productos").select("id")
    .eq("id", id).eq("proyecto_id", "impasto").in("categoria", [...CATEGORIAS_IMPASTO]).limit(1);
  if (errorLectura) return error("No se pudo verificar el producto.", 500);
  if (!productos?.length) return error("El producto no existe.", 404);

  let archivo: FormDataEntryValue | null;
  try { archivo = (await req.formData()).get("foto"); } catch { return error("Elegí una foto.", 400); }
  if (!(archivo instanceof Blob)) return error("Elegí una foto.", 400);
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const validacion = validarFoto(bytes, archivo.size);
  if (!validacion.ok) return error(validacion.error, validacion.error.includes("4 MB") ? 413 : 415);

  const clave = claveDeFoto(id, new Date(), validacion.tipo.ext);
  const { data: subido, error: errorSubida } = await db.storage.from("DB")
    .upload(clave, new Blob([bytes], { type: validacion.tipo.mime }));
  if (errorSubida || !subido) {
    console.error("[foto] No se pudo subir:", errorSubida);
    return error("No se pudo subir la foto. Probá de nuevo.", 502);
  }
  // Que la carta, /cocina y el admin la vean ya, sin esperar el minuto de caché.
  revalidateTag("fotos", { expire: 0 });
  revalidatePath("/cocina");
  const url = (subido as { url?: string }).url;
  return NextResponse.json({ ok: true, foto: url, clave });
}
```

- [ ] `app/api/admin/productos/route.ts` (GET): listar fotos en paralelo y devolver `data.map(p => ({ ...p, foto: elegirFoto(p, objetos) }))` (sin `foto` si no hay).

### Task 3: Admin

- [ ] `types.ts`: `foto?: string` en `AdminProduct`. `adaptProduct`: `foto: typeof p.foto === "string" ? p.foto : undefined`.
- [ ] `ProductThumb.tsx`: `let imgSrc = item.foto ?? ""` y, si está vacío, la lógica actual.
- [ ] `StoreProvider.tsx`: acción `setProductPhoto(dbId, foto)` que actualiza ese producto en `state.products` (mismo patrón que las otras acciones del store).
- [ ] `Products.tsx`, dentro de `ProductEdit`, primer campo del formulario:

```tsx
<div className="field full">
  <label>Foto</label>
  <FotoProducto product={product} isNew={isNew} />
</div>
```

con el componente en el mismo archivo:

```tsx
function FotoProducto({ product, isNew }: { product?: AdminProduct; isNew?: boolean }) {
  const { setProductPhoto } = useStore();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [estado, setEstado] = useState<{ tipo: "ok" | "error" | "subiendo"; texto: string } | null>(null);
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);
  if (isNew || !product) return <span className="text-muted" style={{ fontSize: 12.5 }}>Guardá el producto para poder agregarle la foto.</span>;

  const elegir = (f: File | null) => {
    setEstado(null);
    if (vista) URL.revokeObjectURL(vista);
    setArchivo(f);
    setVista(f ? URL.createObjectURL(f) : null);
  };
  const subir = async () => {
    if (!archivo) return;
    setEstado({ tipo: "subiendo", texto: "Subiendo…" });
    const cuerpo = new FormData();
    cuerpo.append("foto", archivo);
    try {
      const r = await fetch(`/api/admin/productos/${product._dbId}/foto`, { method: "POST", body: cuerpo });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "No se pudo subir la foto.");
      setProductPhoto(product._dbId, j.foto);
      elegir(null);
      setEstado({ tipo: "ok", texto: "Foto actualizada. Ya se ve en la carta y en /cocina." });
    } catch (e) {
      setEstado({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo subir la foto." });
    }
  };
  return (
    <div className="foto-producto">
      <div className="foto-producto-vista"><ProductThumb item={vista ? { ...product, foto: vista } : product} size={96} /></div>
      <div className="foto-producto-acciones">
        <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Elegir foto de ${product.nombre}`}
          onChange={e => elegir(e.target.files?.[0] ?? null)} disabled={estado?.tipo === "subiendo"} />
        {archivo && <button className="btn btn-primary btn-sm" onClick={subir} disabled={estado?.tipo === "subiendo"}>Subir foto</button>}
        <small className="text-muted">JPG, PNG o WebP, hasta 4 MB. La foto anterior queda guardada.</small>
        {estado && <small role="status" className={estado.tipo === "error" ? "text-danger" : "text-muted"}>{estado.texto}</small>}
      </div>
    </div>
  );
}
```

(`ProductThumb` suma un `size` opcional, 40 por defecto. Estilos `.foto-producto` en `admin.css`: fila con la vista de 96 px y las acciones en columna; en celular, en columna.)

### Task 4: Verificación y publicación

- [ ] `npx tsc --noEmit`, eslint de lo tocado, `pnpm test`, `pnpm build`.
- [ ] Navegador con la sesión del admin (el dueño inicia sesión en `/admin-login` del servidor local): Productos → Editar la Bondiola al Pangrattato (archivada, no se vende) → elegir `public/images/cocina/bondiola-miel-mostaza-v2.webp` (la misma imagen que ya tiene) → Subir. Ver el mensaje, la miniatura y que `/cocina` muestre la URL nueva `fotos/<id>/…webp`. Probar también un archivo que no es imagen (rechazo).
- [ ] Commit, `CLAUDE.md`, push y repetir la subida de prueba en producción si el dueño lo pide.
