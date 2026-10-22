'use client';
import { useEffect, useState } from 'react';
type Row = {id:string;referencia:string;canal:string;estado:string;motivo:string;intentos:number};
export function NotificationsRecovery() {
  const [rows,setRows]=useState<Row[]>([]); const [busy,setBusy]=useState(false); const [loaded,setLoaded]=useState(false); const [error,setError]=useState('');
  const [nextOffset,setNextOffset]=useState<number|null>(null); const [open,setOpen]=useState(false);
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
  // eslint-disable-next-line react-hooks/set-state-in-effect -- una consulta al abrir Pedidos
  useEffect(() => { void load(); }, []);
  if (loaded && rows.length === 0 && !error) return null;
  if (!loaded && !error) return null;
  if (!open && rows.length > 0 && !error) return <section className="panel" style={{padding:'8px 12px',marginBottom:12,display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}} aria-label="Recuperación de avisos">
    <strong style={{fontSize:13}}>{rows.length} {rows.length===1?'aviso sin entregar':'avisos sin entregar'}</strong>
    <button className="btn btn-ghost" onClick={()=>setOpen(true)}>Ver</button>
  </section>;
  return <section className="panel" style={{padding:12,marginBottom:12}} aria-label="Recuperación de avisos">
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><strong>Avisos pendientes de entrega</strong><span style={{display:'flex',gap:8}}><button className="btn btn-ghost" disabled={busy} onClick={()=>load()}>{busy?'Consultando…':loaded?'Actualizar avisos':'Consultar avisos'}</button>{rows.length>0 && <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Ocultar</button>}</span></div>
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
