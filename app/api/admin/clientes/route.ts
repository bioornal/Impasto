import { NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { leerClientesCrm } from '@/lib/crm';

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const data=await leerClientesCrm((name,args)=>db.database.rpc(name,args));
    return NextResponse.json({ok:true,data});
  } catch {
    return NextResponse.json({ok:false,error:'No se pudo verificar el historial de compras. Recargá el CRM.'},{status:503});
  }
}
