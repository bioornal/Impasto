'use client';
import { useState } from 'react';
type Row = {id:string;referencia:string;canal:string;estado:string;motivo:string;intentos:number};
export function NotificationsRecovery() {
  const [rows,setRows]=useState<Row[]>([]); const [busy,setBusy]=useState(false); const [loaded,setLoaded]=useState(false); const [error,setError]=useState('');
  const [nextOffset,setNextOffset]=useState<number|null>(null);
  async function load(offset=0) {
    setBusy(true);setError('');
    try {const response=await fetch(`/api/admin/notificaciones?offset=${offset}`,{cache:'no-store'});const body=await response.json();if(!response.ok || !body.ok || !Array.isArray(body.data)) throw new Error('No se pudieron cargar los avisos');setRows(previous=>offset ? [...previous,...body.data.filter((row:Row)=>!previous.some(old=>old.id===row.id))] : body.data);setNextOffset(body.nextOffset);setLoaded(true);}
    catch(err){setError(err instanceof Error ? err.message : 'No se pudieron cargar los avisos');} finally{setBusy(false);}
  }
  async function recover(row:Row) {
    const uncertain=row.estado==='incierto';
    if(uncertain && !window.confirm(`El aviso ${row.referencia} puede haberse entregado. ¿Querés volver a enviarlo aun con riesgo de duplicarlo?`)) return;
    setBusy(true);setError('');
    try {const response=await fetch(`/api/admin/notificaciones/${row.id}/recuperar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmarDuplicado:uncertain})});const body=await response.json();if(!response.ok || !body.ok) throw new Error(body.error || 'No se pudo recuperar el aviso');await load();}
    catch(err){setError(err instanceof Error ? err.message : 'No se pudo recuperar el aviso');}finally{setBusy(false);}
  }
  return <section className="card" style={{padding:16,marginBottom:16}} aria-label="Recuperación de avisos">
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><strong>Avisos pendientes de entrega</strong><button className="btn btn-ghost" disabled={busy} onClick={()=>load()}>{busy?'Consultando…':loaded?'Actualizar avisos':'Consultar avisos'}</button></div>
    <p style={{fontSize:13}}>Podés recuperar avisos de email y Telegram. Los enviados no se vuelven a enviar. Revisá los casos sin entrega confirmada antes de reintentarlos.</p>
    {error && <p role="alert">{error}</p>}
    {loaded && !rows.length && <p>No hay avisos pendientes.</p>}
    {rows.map(row=><div key={row.id} style={{borderTop:'1px solid #ddd',padding:'12px 0',display:'flex',gap:12,alignItems:'center',justifyContent:'space-between'}}>
      <div><strong>{row.referencia}</strong> · {row.canal} · {row.estado}<small style={{display:'block'}}>{row.motivo || `${row.intentos} intento(s)`}</small></div>
      <button className="btn btn-ghost" disabled={busy || row.estado==='procesando'} onClick={()=>recover(row)}>{row.estado==='incierto'?'Revisar y reenviar':'Recuperar aviso'}</button>
    </div>)}
    {nextOffset!==null && <button className="btn btn-ghost" disabled={busy} onClick={()=>load(nextOffset)}>Cargar más avisos</button>}
  </section>;
}
