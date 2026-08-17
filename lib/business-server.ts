import { db } from "@/lib/insforge";
import { BUSINESS, SUCURSAL_ID, type BusinessConfig } from "@/lib/business";

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
      deliveryFee: Number(branch.delivery_fee || BUSINESS.deliveryFee),
    };
  } catch {
    return BUSINESS;
  }
}
