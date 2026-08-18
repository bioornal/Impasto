"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/utils";
import { getMercadoPago, type IdentificationType, type MpInstance, type PayerCost, type SecureField } from "@/lib/mp-client";

/** Lo que enviamos al backend: sólo el token, nunca el número de tarjeta. */
export interface CardFormData {
  token: string;
  payment_method_id: string;
  payment_type_id: string;
  installments: number;
  payer: { email: string; identification: { type: string; number: string } };
}

interface CardPaymentProps {
  amount: number;
  /** Ya se pidió en el checkout: Mercado Pago lo necesita para el comprobante. */
  email: string;
  onClose: () => void;
  onSubmit: (card: CardFormData) => Promise<void>;
}

const PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || "";

/** Estilo de los campos seguros: los iframes de MP heredan la tipografía del sitio. */
const FIELD_STYLE = {
  height: "100%",
  fontSize: "16px",
  color: "#2a201a",
  placeholderColor: "#a3988c",
  fontFamily: "inherit",
};

export function CardPayment({ amount, email, onClose, onSubmit }: CardPaymentProps) {
  const mpRef = useRef<MpInstance | null>(null);
  const binHandlerRef = useRef<(bin: string) => void>(() => {});

  const [loading, setLoading] = useState(true);
  const [sdkError, setSdkError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [method, setMethod] = useState<{ id: string; type: string } | null>(null);
  const [payerCosts, setPayerCosts] = useState<PayerCost[]>([]);
  const [installments, setInstallments] = useState(1);
  const [idTypes, setIdTypes] = useState<IdentificationType[]>([]);

  const [nombre, setNombre] = useState("");
  const [docTipo, setDocTipo] = useState("DNI");
  const [docNum, setDocNum] = useState("");

  /** Al cambiar los primeros dígitos, MP nos dice marca, tipo y cuotas disponibles. */
  const onBinChange = useCallback(async (bin: string) => {
    const mp = mpRef.current;
    if (!mp || !bin || bin.length < 6) {
      setMethod(null);
      setPayerCosts([]);
      return;
    }
    try {
      const methods = await mp.getPaymentMethods({ bin });
      const found = methods.results?.[0];
      if (!found) {
        setMethod(null);
        setPayerCosts([]);
        setFormError("No reconocemos esa tarjeta.");
        return;
      }
      setFormError("");
      setMethod({ id: found.id, type: found.payment_type_id });

      const cuotas = await mp.getInstallments({
        amount: String(amount),
        bin,
        paymentTypeId: found.payment_type_id,
      });
      const costs = cuotas?.[0]?.payer_costs || [];
      setPayerCosts(costs);
      setInstallments(costs[0]?.installments || 1);
    } catch {
      setFormError("No pudimos verificar la tarjeta. Revisá el número.");
    }
  }, [amount]);

  // El handler vive en un ref para que el efecto de montaje no dependa del monto.
  useEffect(() => { binHandlerRef.current = onBinChange; }, [onBinChange]);

  useEffect(() => {
    if (!PUBLIC_KEY) return;
    let cancelled = false;
    const fields: SecureField[] = [];

    (async () => {
      try {
        const mp = await getMercadoPago(PUBLIC_KEY);
        if (cancelled) return;
        mpRef.current = mp;

        const numero = mp.fields.create("cardNumber", { placeholder: "1234 5678 9012 3456", style: FIELD_STYLE });
        numero.mount("mp-card-number");
        numero.on("binChange", (data) => binHandlerRef.current(String(data.bin || "")));
        fields.push(numero);

        const vencimiento = mp.fields.create("expirationDate", { placeholder: "MM/AA", style: FIELD_STYLE });
        vencimiento.mount("mp-card-expiration");
        fields.push(vencimiento);

        const cvv = mp.fields.create("securityCode", { placeholder: "123", style: FIELD_STYLE });
        cvv.mount("mp-card-cvv");
        fields.push(cvv);

        const tipos = await mp.getIdentificationTypes();
        if (cancelled) return;
        setIdTypes(tipos || []);
        if (tipos?.[0]?.id) setDocTipo(tipos[0].id);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setSdkError("No pudimos cargar el pago con tarjeta. Probá con efectivo o transferencia.");
          setLoading(false);
        }
      }
    })();

    // Desmontar los iframes deja el contenedor limpio para el próximo montaje.
    return () => {
      cancelled = true;
      fields.forEach((field) => { try { field.unmount(); } catch { /* ya desmontado */ } });
    };
  }, []);

  const pagar = async () => {
    const mp = mpRef.current;
    if (!mp || submitting) return;

    if (!nombre.trim()) return setFormError("Ingresá el nombre como figura en la tarjeta");
    if (!docNum.trim()) return setFormError("Ingresá el número de documento");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setFormError("Ingresá un email válido");
    if (!method) return setFormError("Completá el número de tarjeta");

    setSubmitting(true);
    setFormError("");
    try {
      const { id: token } = await mp.fields.createCardToken({
        cardholderName: nombre.trim(),
        identificationType: docTipo,
        identificationNumber: docNum.trim(),
      });

      await onSubmit({
        token,
        payment_method_id: method.id,
        payment_type_id: method.type,
        installments,
        payer: { email: email.trim(), identification: { type: docTipo, number: docNum.trim() } },
      });
    } catch (err: unknown) {
      // createCardToken devuelve un array de errores de validación de la tarjeta.
      const causes = (err as { length?: number } | undefined)?.length
        ? (err as unknown as { description?: string; message?: string }[])
        : null;
      setFormError(
        causes?.[0]?.description
          || (err instanceof Error ? err.message : "No se pudo procesar el pago"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!PUBLIC_KEY || sdkError) {
    return (
      <div className="pay-modal-overlay" onClick={onClose}>
        <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
          <div className="co-error">{sdkError || "Falta configurar la clave pública de Mercado Pago."}</div>
          <button className="btn btn-light" onClick={onClose}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pay-modal-overlay" onClick={onClose}>
      <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pay-modal-head">
          <div>
            <b>Pagar con tarjeta</b>
            <small>Total {fmt(amount)}</small>
          </div>
          <button className="btn btn-light btn-sm" onClick={onClose}>← Volver</button>
        </div>

        <div className="pay-form">
          <div className="field">
            <label htmlFor="mp-card-number">Número de tarjeta</label>
            <div className="mp-field" id="mp-card-number" />
          </div>

          <div className="pay-row-2">
            <div className="field">
              <label htmlFor="mp-card-expiration">Vencimiento</label>
              <div className="mp-field" id="mp-card-expiration" />
            </div>
            <div className="field">
              <label htmlFor="mp-card-cvv">Código</label>
              <div className="mp-field" id="mp-card-cvv" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="mp-nombre">Nombre como figura en la tarjeta</label>
            <input id="mp-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="JUAN PEREZ" autoComplete="cc-name" />
          </div>

          <div className="pay-row-2">
            <div className="field">
              <label htmlFor="mp-doc-tipo">Documento</label>
              <select id="mp-doc-tipo" value={docTipo} onChange={(e) => setDocTipo(e.target.value)}>
                {idTypes.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mp-doc-num">Número</label>
              <input id="mp-doc-num" value={docNum} onChange={(e) => setDocNum(e.target.value)} placeholder="12345678" inputMode="numeric" />
            </div>
          </div>

          {payerCosts.length > 1 && (
            <div className="field">
              <label htmlFor="mp-cuotas">Cuotas</label>
              <select id="mp-cuotas" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                {payerCosts.map((cost) => (
                  <option key={cost.installments} value={cost.installments}>{cost.recommended_message}</option>
                ))}
              </select>
            </div>
          )}

          {loading && <div className="pay-loading">Cargando formulario seguro…</div>}
          {formError && <div className="co-error">{formError}</div>}

          <button className="co-cta" onClick={pagar} disabled={submitting || loading}>
            {submitting ? "Procesando pago…" : `Pagar ${fmt(amount)}`}
          </button>

          <small className="pay-legal">
            Los datos de tu tarjeta viajan cifrados directo a Mercado Pago. No pasan por nuestros servidores.
          </small>
        </div>
      </div>
    </div>
  );
}
