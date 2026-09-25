import { db } from "@/lib/insforge";
import { BUSINESS, SUCURSAL_ID, type BusinessConfig } from "@/lib/business";

function parseDias(valor: unknown): number[] | null {
  const dias = String(valor || "")
    .split(",")
    .map((dia) => Number(dia.trim()))
    .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6);
  return dias.length > 0 ? dias : null;
}

function normalizarWhatsapp(valor: unknown): string {
  let digitos = String(valor || "").replace(/\D/g, "");
  if (!digitos) return BUSINESS.whatsappPhone;
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.length === 10) digitos = `54${digitos}`;
  return digitos;
}

export async function getBusinessConfig(branchId = SUCURSAL_ID): Promise<BusinessConfig> {
  try {
    const { data, error } = await db.database
      .from("sucursales")
      .select("*")
      .eq("id", branchId)
      .limit(1);
    const branch = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
    // Ante un error de base o una fila faltante, el resto de los datos cae a los
    // valores del código, pero las ventas se cierran: es preferible no tomar
    // pedidos que aceptarlos cuando no se pudo confirmar que el local esté abierto.
    if (error || !branch) return { ...BUSINESS, ventasActivas: false };
    return {
      id: String(branch.id || branchId),
      name: String(branch.nombre || BUSINESS.name),
      city: String(branch.ciudad || BUSINESS.city),
      locationLabel: String(branch.ciudad || BUSINESS.locationLabel),
      phone: String(branch.telefono || BUSINESS.phone),
      whatsappPhone: normalizarWhatsapp(branch.whatsapp),
      email: String(branch.email || BUSINESS.email),
      address: String(branch.direccion || BUSINESS.address),
      instagram: BUSINESS.instagram,
      facebook: BUSINESS.facebook,
      hours: String(branch.horarios || BUSINESS.hours),
      // Si el parseo diera vacío, el local quedaría cerrado para siempre:
      // ante cualquier duda se usa la configuración del código.

      diasApertura: parseDias(branch.dias_apertura) ?? BUSINESS.diasApertura,
      horaApertura: String(branch.hora_apertura || BUSINESS.horaApertura),
      horaCierre: String(branch.hora_cierre || BUSINESS.horaCierre),
      zonaHoraria: String(branch.zona_horaria || BUSINESS.zonaHoraria),
      ventasActivas: branch.ventas_activas !== false,
      mensajeCierre: String(branch.mensaje_cierre || ""),
      // Sin la columna (antes de la migración) cuenta como delivery activo.
      deliveryActivo: branch.delivery_activo !== false,
      mensajeDelivery: String(branch.mensaje_delivery || ""),
      deliveryFee: Number(branch.delivery_fee || BUSINESS.deliveryFee),
      freeShippingFrom: Number(branch.envio_gratis_desde || BUSINESS.freeShippingFrom),
      deliveryEstimate: String(branch.tiempo_entrega || BUSINESS.deliveryEstimate),
      cbu: String(branch.cbu || BUSINESS.cbu || ""),
      aliasCbu: String(branch.alias_cbu || BUSINESS.aliasCbu || ""),
      banco: String(branch.banco || BUSINESS.banco || ""),
      titularCuenta: String(branch.titular_cuenta || BUSINESS.titularCuenta || ""),
    };
  } catch {
    return { ...BUSINESS, ventasActivas: false };
  }
}
