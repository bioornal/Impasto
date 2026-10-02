/** Only an empty page proves completion when the backend caps results. */
export async function readPages<T extends {id?: unknown}>(read:(start:number,end:number)=>PromiseLike<{data:T[]|null;error:unknown}>,size=500):Promise<{data:T[]|null;error:Error|null}>{
 try{
  if(!Number.isSafeInteger(size)||size<1)throw new Error('Tamaño de página inválido');
  const rows:T[]=[];const seen=new Set<unknown>();
  while(true){
   const page=await read(rows.length,rows.length+size-1);
   if(page.error||!Array.isArray(page.data)||page.data.length>size)throw new Error('Lectura incompleta');
   if(!page.data.length)return {data:rows,error:null};
   for(const row of page.data){if(!row||row.id==null||row.id===''||seen.has(row.id))throw new Error('Lectura duplicada o sin identidad');seen.add(row.id);rows.push(row);}
  }
 }catch(error){return {data:null,error:error instanceof Error?error:new Error('Lectura incompleta')};}
}
