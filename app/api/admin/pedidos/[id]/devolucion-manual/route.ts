import {NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/admin-auth';
import {db} from '@/lib/insforge';
import {SUCURSAL_ID} from '@/lib/business';
import {validateManualRefund,registerManualRefund} from '@/lib/manual-refund';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const unauthorized=await requireAdmin();if(unauthorized)return unauthorized;
 const {id}=await params;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return NextResponse.json({ok:false,error:'Pedido inválido'},{status:400});
 let body;
 try{body=validateManualRefund(await req.json());}catch{return NextResponse.json({ok:false,error:'Declaración manual inválida'},{status:400});}
 try{
  const result=await registerManualRefund((name,args)=>db.database.rpc(name,args),id,SUCURSAL_ID,body);
  return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'No se confirmó el registro'},{status:409});}
}
