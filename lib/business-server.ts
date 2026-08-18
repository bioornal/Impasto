import { db } from "@/lib/insforge";
import { BUSINESS, SUCURSAL_ID, type BusinessConfig } from "@/lib/business";

function parseDias(valor: unknown): number[] | null {
  const dias = String(valor || "")
    .split(",")
    .map((dia) => Number(dia.trim()))
    .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6);
  return dias.length > 0 ? dias : null;
}

export async function getBusinessConfig(branchId = SUCURSAL_ID): Promise<BusinessConfig> {
  try {
    const { data, error } = await db.database
      .from("sucursales")
      .select("*")
      .eq("id", branchId)
      .limit(1);
    const branch = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
    if (error || !branch) return BUSINESS;
    return {
      id: String(branch.id || branchId),
      name: String(branch.nombre || BUSINESS.name),
      city: String(branch.ciudad || BUSINESS.city),
      locationLabel: String(branch.ciudad || BUSINESS.locationLabel),
      phone: String(branch.telefono || BUSINESS.phone),
      whatsappPhone: String(branch.whatsapp || BUSINESS.whatsappPhone),
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
      deliveryFee: Number(branch.delivery_fee || BUSINESS.deliveryFee),
      freeShippingFrom: Number(branch.envio_gratis_desde || BUSINESS.freeShippingFrom),    };
  } catch {
    return BUSINESS;
  }
}
